"""Unit tests for Mifflin-St Jeor targets service."""
import pytest
from app.services.targets import calculate_bmr, calculate_targets, is_profile_complete


class _MockProfile:
    def __init__(self, age=30, gender="male", height_cm=175.0, weight_kg=70.0, activity_level="moderate", goal="maintain"):
        self.age = age
        self.gender = gender
        self.height_cm = height_cm
        self.weight_kg = weight_kg
        self.activity_level = activity_level
        self.goal = goal


def test_anchor_target():
    """Anchor test: male, 30 y, 175 cm, 70 kg, moderate, maintain -> BMR 1648.75, kcal 2556, protein 84 g, water 2450 ml."""
    profile = _MockProfile(
        age=30,
        gender="male",
        height_cm=175,
        weight_kg=70,
        activity_level="moderate",
        goal="maintain",
    )
    targets = calculate_targets(profile)
    assert targets["bmr"] == 1648.75
    assert targets["kcal"] == 2556
    assert targets["protein_g"] == 84.0
    assert targets["water_ml"] == 2450
    assert targets["fat_g"] == 71.0
    assert targets["carbs_g"] == 395.2  # (2556 - 336 - 639) / 4 = 395.25
    assert 25 <= targets["fibre_g"] <= 38


def test_female_bmr_and_lose_goal():
    profile = _MockProfile(
        age=28,
        gender="female",
        height_cm=160,
        weight_kg=60,
        activity_level="sedentary",
        goal="lose",
    )
    # BMR: 10*60 + 6.25*160 - 5*28 - 161 = 600 + 1000 - 140 - 161 = 1299
    assert calculate_bmr(60, 160, 28, "female") == 1299.0
    targets = calculate_targets(profile)
    # TDEE: 1299 * 1.2 = 1558.8, lose: -500 -> 1058.8, floor is 1200 for female!
    assert targets["kcal"] == 1200
    # Protein: 1.6 * 60 = 96g; cap at 35% of 1200 = 420 kcal / 4 = 105g -> 96g
    assert targets["protein_g"] == 96.0
    # Water: 60 * 35 = 2100 ml
    assert targets["water_ml"] == 2100


def test_floor_male():
    profile = _MockProfile(
        age=60,
        gender="male",
        height_cm=150,
        weight_kg=45,
        activity_level="sedentary",
        goal="lose",
    )
    # BMR: 10*45 + 6.25*150 - 5*60 + 5 = 450 + 937.5 - 300 + 5 = 1092.5
    # TDEE: 1092.5 * 1.2 = 1311, lose: -500 = 811
    # Male floor is 1500
    targets = calculate_targets(profile)
    assert targets["kcal"] == 1500


def test_other_gender():
    profile = _MockProfile(
        age=25,
        gender="other",
        height_cm=170,
        weight_kg=65,
        activity_level="light",
        goal="maintain",
    )
    # BMR s is -78
    # BMR: 10*65 + 6.25*170 - 5*25 - 78 = 650 + 1062.5 - 125 - 78 = 1509.5
    assert calculate_bmr(65, 170, 25, "other") == 1509.5
    targets = calculate_targets(profile)
    assert targets["kcal"] > 1350  # other floor is 1350


def test_profile_completeness():
    assert not is_profile_complete(None)
    assert not is_profile_complete(_MockProfile(age=None))
    assert not is_profile_complete(_MockProfile(gender=""))
    assert not is_profile_complete(_MockProfile(height_cm=0))
    assert not is_profile_complete(_MockProfile(weight_kg=-5))
    assert is_profile_complete(_MockProfile())

    with pytest.raises(ValueError):
        calculate_targets(_MockProfile(age=None))
