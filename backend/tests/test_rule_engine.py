import pytest
from app.services.lab_rule_engine import LabRuleEngine, load_reference_ranges, load_nutrition_rules


def test_json_rules_load():
    ref_ranges = load_reference_ranges()
    assert "parameters" in ref_ranges
    assert "fasting_blood_glucose" in ref_ranges["parameters"]
    assert "hba1c" in ref_ranges["parameters"]
    assert "ldl_cholesterol" in ref_ranges["parameters"]
    assert "hdl_cholesterol" in ref_ranges["parameters"]
    assert "triglycerides" in ref_ranges["parameters"]
    assert "haemoglobin" in ref_ranges["parameters"]
    assert "vitamin_d" in ref_ranges["parameters"]
    assert "vitamin_b12" in ref_ranges["parameters"]

    nutrition_rules = load_nutrition_rules()
    assert "rules" in nutrition_rules
    assert len(nutrition_rules["rules"]) > 0


def test_unit_normalization():
    engine = LabRuleEngine()
    # Glucose: 5.55 mmol/L * 18.0182 ~= 100 mg/dL
    val, unit = engine.normalize_value("fasting_blood_glucose", 5.55, "mmol/L")
    assert unit == "mg/dL"
    assert round(val, 0) == 100

    # Same unit stays unchanged
    val, unit = engine.normalize_value("fasting_blood_glucose", 95, "mg/dL")
    assert unit == "mg/dL"
    assert val == 95.0


def test_classification():
    engine = LabRuleEngine()

    # Fasting glucose
    normal = engine.classify_value("fasting_blood_glucose", 85, "mg/dL")
    assert normal["classification"] == "within_reference"

    prediabetes = engine.classify_value("fasting_blood_glucose", 110, "mg/dL")
    assert prediabetes["classification"] == "borderline"

    diabetes = engine.classify_value("fasting_blood_glucose", 140, "mg/dL")
    assert diabetes["classification"] == "above_reference"

    # HbA1c
    hba1c_norm = engine.classify_value("hba1c", 5.2, "%")
    assert hba1c_norm["classification"] == "within_reference"

    hba1c_high = engine.classify_value("hba1c", 7.1, "%")
    assert hba1c_high["classification"] == "above_reference"

    # Vitamin B12
    b12_low = engine.classify_value("vitamin_b12", 150, "pg/mL")
    assert b12_low["classification"] == "below_reference"


def test_recommendations_with_diet(app):
    engine = LabRuleEngine()

    # Low hemoglobin -> should suggest iron-rich foods
    res_veg = engine.evaluate_result("haemoglobin", 10.0, "g/dL", user_diet="veg")
    assert res_veg["classification"] == "below_reference"
    assert len(res_veg["recommendations"]) > 0
    rec = res_veg["recommendations"][0]
    assert rec["title"] == "Dietary Iron Support"
    # Ensure all recommended foods are vegetarian
    for f in rec["foods"]:
        assert f["diet"] in ["vegan", "veg"]

    # Low B12 for nonveg
    res_nonveg = engine.evaluate_result("vitamin_b12", 160, "pg/mL", user_diet="nonveg")
    assert res_nonveg["classification"] == "below_reference"
    assert len(res_nonveg["recommendations"]) > 0
