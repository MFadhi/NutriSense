import os
import json
from typing import Dict, List, Any, Optional
from ..models import Food, FoodCategory


def get_rules_dir() -> str:
    return os.path.join(os.path.dirname(os.path.dirname(__file__)), "rules")


def load_reference_ranges() -> dict:
    path = os.path.join(get_rules_dir(), "lab_reference_ranges.json")
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def load_nutrition_rules() -> dict:
    path = os.path.join(get_rules_dir(), "lab_nutrition_rules.json")
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


class LabRuleEngine:
    def __init__(self):
        self.ref_data = load_reference_ranges()
        self.nutrition_data = load_nutrition_rules()
        self.parameters = self.ref_data.get("parameters", {})
        self.rules = self.nutrition_data.get("rules", [])

    def normalize_value(self, param_key: str, value: float, unit: str) -> tuple[float, str]:
        """
        Converts alternative units to standard units if defined in rules.
        Returns (normalized_value, standard_unit).
        """
        param_def = self.parameters.get(param_key)
        if not param_def:
            return value, unit

        standard_unit = param_def.get("standard_unit", unit)
        if unit == standard_unit:
            return round(value, 2), standard_unit

        alt_units = param_def.get("alternative_units", {})
        if unit in alt_units:
            factor = alt_units[unit]
            converted = value * factor
            return round(converted, 2), standard_unit

        return round(value, 2), unit

    def classify_value(self, param_key: str, value: float, unit: str) -> dict:
        """
        Classifies a numerical lab value against the configured reference intervals.
        """
        norm_val, norm_unit = self.normalize_value(param_key, value, unit)
        param_def = self.parameters.get(param_key)

        if not param_def:
            return {
                "classification": "insufficient_information",
                "label": "Unknown Parameter",
                "explanation": f"Parameter '{param_key}' is not in configured reference ranges.",
                "reference_range": {"min": None, "max": None},
                "standard_unit": norm_unit,
                "normalized_value": norm_val,
            }

        ranges = param_def.get("ranges", [])
        matched_classification = "insufficient_information"
        matched_label = "Unclassified"
        matched_explanation = ""
        ref_min = None
        ref_max = None

        # Find within_reference boundary for display
        for r in ranges:
            if r.get("classification") == "within_reference":
                ref_min = r.get("min")
                ref_max = r.get("max")

        for r in ranges:
            rmin = r.get("min")
            rmax = r.get("max")

            above_min = True if rmin is None else (norm_val >= rmin)
            below_max = True if rmax is None else (norm_val <= rmax)

            if above_min and below_max:
                matched_classification = r.get("classification", "within_reference")
                matched_label = r.get("label", "")
                matched_explanation = r.get("explanation", "")
                break

        return {
            "classification": matched_classification,
            "label": matched_label,
            "explanation": matched_explanation,
            "reference_range": {"min": ref_min, "max": ref_max},
            "standard_unit": norm_unit,
            "normalized_value": norm_val,
            "display_name": param_def.get("display_name", param_key),
        }

    def evaluate_result(
        self,
        param_key: str,
        value: float,
        unit: str,
        user_diet: Optional[str] = None,
        user_allergens: Optional[List[str]] = None,
    ) -> dict:
        """
        Evaluates a single lab parameter value, returns classification and
        tailored food recommendations matching the user's diet and allergies.
        """
        classification_info = self.classify_value(param_key, value, unit)
        cls_code = classification_info["classification"]

        recommendations = []
        requires_review = False

        # Find applicable nutrition rules
        for rule in self.rules:
            if rule.get("parameter") == param_key and rule.get("condition") == cls_code:
                if rule.get("requires_professional_review", False):
                    requires_review = True

                suggested_foods = self._find_matching_foods(
                    tags=rule.get("suggested_tags", []),
                    category_slugs=rule.get("suggested_categories", []),
                    user_diet=user_diet,
                    user_allergens=user_allergens,
                    limit=5,
                )

                limit_foods = []
                if rule.get("limit_tags"):
                    limit_foods = self._find_matching_foods(
                        tags=rule.get("limit_tags", []),
                        category_slugs=[],
                        user_diet=user_diet,
                        user_allergens=user_allergens,
                        limit=4,
                    )

                recommendations.append({
                    "title": rule.get("title", ""),
                    "summary": rule.get("summary", ""),
                    "explanation": rule.get("explanation", ""),
                    "suggested_tags": rule.get("suggested_tags", []),
                    "foods": [f.to_dict() for f in suggested_foods],
                    "limit_explanation": rule.get("limit_explanation", ""),
                    "limit_foods": [f.to_dict() for f in limit_foods],
                })

        return {
            "parameter": param_key,
            "display_name": classification_info.get("display_name", param_key),
            "value": value,
            "unit": unit,
            "normalized_value": classification_info["normalized_value"],
            "standard_unit": classification_info["standard_unit"],
            "classification": cls_code,
            "label": classification_info["label"],
            "reference_range": classification_info["reference_range"],
            "explanation": classification_info["explanation"],
            "recommendations": recommendations,
            "requires_professional_review": requires_review,
        }

    def _find_matching_foods(
        self,
        tags: List[str],
        category_slugs: List[str],
        user_diet: Optional[str] = None,
        user_allergens: Optional[List[str]] = None,
        limit: int = 5,
    ) -> List[Food]:
        """
        Queries existing foods matching given tags or categories while filtering by
        diet preference and excluding allergens.
        """
        query = Food.query.filter_by(is_sample=True)

        # Diet filtering
        diet_hierarchy = {
            "vegan": ["vegan"],
            "veg": ["vegan", "veg"],
            "egg": ["vegan", "veg", "egg"],
            "eggetarian": ["vegan", "veg", "egg"],
            "nonveg": ["vegan", "veg", "egg", "nonveg"],
        }
        if user_diet and user_diet.lower() in diet_hierarchy:
            allowed_diets = diet_hierarchy[user_diet.lower()]
            query = query.filter(Food.diet.in_(allowed_diets))

        candidate_foods = query.all()
        matched = []
        user_allergens_set = set(a.lower() for a in (user_allergens or []))

        for food in candidate_foods:
            # Check allergens
            food_allergens = [a.lower() for a in (food.allergens or [])]
            if any(allergen in user_allergens_set for allergen in food_allergens):
                continue

            food_tags = [t.lower() for t in (food.tags or [])]
            tag_hit = any(t.lower() in food_tags for t in tags)

            cat_hit = False
            if category_slugs and food.category:
                cat_hit = food.category.slug in category_slugs

            if tag_hit or cat_hit:
                matched.append(food)
                if len(matched) >= limit:
                    break

        return matched


# Global singleton helper
_rule_engine_instance = None

def get_rule_engine() -> LabRuleEngine:
    global _rule_engine_instance
    if _rule_engine_instance is None:
        _rule_engine_instance = LabRuleEngine()
    return _rule_engine_instance
