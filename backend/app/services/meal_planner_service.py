import random
from typing import Dict, List, Any, Optional
from ..extensions import db
from ..models import Food, FoodCategory, Portion, User, UserProfile, LabResult
from ..services.targets import calculate_targets, is_profile_complete
from ..services.lab_rule_engine import get_rule_engine


MEAL_DISTRIBUTIONS = {
    4: {
        "breakfast": {"pct": 0.25, "label": "Breakfast"},
        "lunch": {"pct": 0.35, "label": "Lunch"},
        "snack": {"pct": 0.10, "label": "Evening Snack"},
        "dinner": {"pct": 0.30, "label": "Dinner"},
    },
    3: {
        "breakfast": {"pct": 0.30, "label": "Breakfast"},
        "lunch": {"pct": 0.40, "label": "Lunch"},
        "dinner": {"pct": 0.30, "label": "Dinner"},
    },
}

DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]


class MealPlannerEngine:
    def __init__(self, user: User, preferences: Optional[dict] = None):
        self.user = user
        self.profile = user.profile if user else None
        self.preferences = preferences or {}
        self.rule_engine = get_rule_engine()

        # Compute targets from profile, or fallback to sensible defaults
        if self.profile and is_profile_complete(self.profile):
            self.targets = calculate_targets(self.profile)
        else:
            self.targets = {
                "kcal": 2000,
                "protein_g": 85.0,
                "carbs_g": 250.0,
                "fat_g": 60.0,
                "fibre_g": 28.0,
                "water_ml": 2500,
            }

        # Resolve diet & allergies
        self.diet = (
            self.preferences.get("diet_type")
            or (self.profile.diet_type if self.profile else None)
            or "veg"
        )
        self.allergies = set(
            a.lower() for a in (self.profile.allergies if self.profile and self.profile.allergies else [])
        )
        self.avoided_tags = set(
            t.lower() for t in self.preferences.get("avoided_tags", [])
        )
        self.liked_tags = set(
            t.lower() for t in self.preferences.get("liked_tags", [])
        )
        self.meals_per_day = 4 if self.preferences.get("include_snacks", True) else 3

        # Retrieve relevant lab insights for personalization
        self.lab_insights = self._get_user_lab_insights()

    def _get_user_lab_insights(self) -> dict:
        """
        Retrieves confirmed lab results and matches them against nutrition rules.
        Returns a dict of {suggested_tags: set(), reasons: dict(tag->explanation)}
        """
        if not self.user:
            return {"tags": set(), "reasons": {}}

        lab_results = (
            LabResult.query.filter_by(user_id=self.user.id)
            .order_by(LabResult.test_date.desc())
            .all()
        )
        if not lab_results:
            return {"tags": set(), "reasons": {}}

        latest_by_param = {}
        for r in lab_results:
            if r.parameter not in latest_by_param:
                latest_by_param[r.parameter] = r

        suggested_tags = set()
        tag_reasons = {}

        for param, res in latest_by_param.items():
            ev = self.rule_engine.evaluate_result(
                param_key=param,
                value=res.value,
                unit=res.unit,
                user_diet=self.diet,
                user_allergens=list(self.allergies),
            )
            for rec in ev.get("recommendations", []):
                for t in rec.get("suggested_tags", []):
                    suggested_tags.add(t.lower())
                    tag_reasons[t.lower()] = rec.get("title") or ev.get("explanation")

        return {"tags": suggested_tags, "reasons": tag_reasons}

    def _get_eligible_foods(self) -> List[Food]:
        """
        Queries sample foods filtered strictly by user diet, allergy avoidance,
        and avoided tags.
        """
        query = Food.query.filter_by(is_sample=True)

        diet_hierarchy = {
            "vegan": ["vegan"],
            "veg": ["vegan", "veg"],
            "egg": ["vegan", "veg", "egg"],
            "eggetarian": ["vegan", "veg", "egg"],
            "nonveg": ["vegan", "veg", "egg", "nonveg"],
        }
        allowed_diets = diet_hierarchy.get(self.diet.lower(), ["vegan", "veg"])
        query = query.filter(Food.diet.in_(allowed_diets))

        all_candidates = query.all()
        safe_foods = []

        for f in all_candidates:
            # 1. Allergy check
            food_allergens = [a.lower() for a in (f.allergens or [])]
            if any(a in self.allergies for a in food_allergens):
                continue

            # 2. Avoided tags check
            food_tags = [t.lower() for t in (f.tags or [])]
            if any(t in self.avoided_tags for t in food_tags):
                continue

            safe_foods.append(f)

        return safe_foods

    def _classify_foods_by_meal(self, safe_foods: List[Food]) -> Dict[str, List[Food]]:
        """
        Groups safe foods into categories suitable for breakfast, lunch, snack, and dinner.
        """
        breakfast_cats = {"breakfast", "tiffin", "breads", "grains"}
        main_cats = {"mains", "dals", "veg_dishes", "breads", "staples", "egg_meat_fish"}
        snack_cats = {"fruits", "snacks", "drinks", "salads", "nuts_seeds", "dairy"}

        groups = {
            "breakfast": [],
            "lunch": [],
            "snack": [],
            "dinner": [],
        }

        for f in safe_foods:
            cat_slug = f.category.slug if f.category else "others"
            tags = [t.lower() for t in (f.tags or [])]

            if cat_slug in breakfast_cats or "breakfast" in tags:
                groups["breakfast"].append(f)
            if cat_slug in main_cats or "curry" in tags or "dal" in tags or "rice" in tags or "flatbread" in tags:
                groups["lunch"].append(f)
                groups["dinner"].append(f)
            if cat_slug in snack_cats or "snack" in tags or "fruit" in tags:
                groups["snack"].append(f)

        # Fallbacks if a bucket is sparse
        for k in groups:
            if not groups[k]:
                groups[k] = safe_foods

        return groups

    def generate_meal(
        self,
        meal_key: str,
        target_kcal: float,
        food_pool: List[Food],
        used_food_ids: Optional[set] = None,
    ) -> dict:
        """
        Selects 1-2 complementary food items for a meal and calculates portion scaling.
        """
        used_food_ids = used_food_ids or set()
        eligible = [f for f in food_pool if f.id not in used_food_ids] or food_pool

        # Prioritize foods matching lab insights or liked tags
        def score_food(food: Food) -> int:
            score = 0
            tags = [t.lower() for t in (food.tags or [])]
            for t in tags:
                if t in self.lab_insights["tags"]:
                    score += 3
                if t in self.liked_tags:
                    score += 2
            return score

        eligible.sort(key=score_food, reverse=True)
        top_candidates = eligible[: min(10, len(eligible))]
        selected_food = random.choice(top_candidates) if top_candidates else food_pool[0]

        # Calculate portion multiplier
        kcal_100g = float(selected_food.kcal_per_100g or 150.0)
        if kcal_100g <= 0:
            kcal_100g = 150.0

        # Try to find a defined household portion
        default_portion = Portion.query.filter_by(food_id=selected_food.id, is_default=True).first()
        if not default_portion:
            default_portion = Portion.query.filter_by(food_id=selected_food.id).first()

        portion_grams = float(default_portion.grams) if default_portion else 100.0
        portion_label = default_portion.label if default_portion else "100g"

        # Scale grams to approximate meal target (clamped between 0.8x and 2.5x standard portion)
        needed_grams = (target_kcal / kcal_100g) * 100.0
        scaled_grams = max(portion_grams * 0.8, min(portion_grams * 2.5, needed_grams))
        scaling_ratio = scaled_grams / 100.0

        item_kcal = round(kcal_100g * scaling_ratio, 1)
        item_protein = round(float(selected_food.protein_per_100g or 0) * scaling_ratio, 1)
        item_carbs = round(float(selected_food.carbs_per_100g or 0) * scaling_ratio, 1)
        item_fat = round(float(selected_food.fat_per_100g or 0) * scaling_ratio, 1)
        item_fibre = round(float(selected_food.fibre_per_100g or 0) * scaling_ratio, 1)

        # Build explanation
        tags = [t.lower() for t in (selected_food.tags or [])]
        matched_lab_tags = [t for t in tags if t in self.lab_insights["tags"]]
        if matched_lab_tags:
            tag = matched_lab_tags[0]
            reason = f"Selected for {selected_food.name_en} ({tag.replace('_', ' ')}), supporting your laboratory health profile."
        elif item_protein >= 15:
            reason = f"Rich in protein ({item_protein}g) to support daily muscle and satiety targets."
        elif item_fibre >= 5:
            reason = f"High in dietary fibre ({item_fibre}g) for digestive balance and gradual glycemic release."
        else:
            reason = f"Balanced wholesome meal component aligned with your {self.diet} dietary preference."

        return {
            "meal_key": meal_key,
            "label": meal_key.capitalize(),
            "target_kcal": round(target_kcal),
            "total_kcal": item_kcal,
            "total_protein_g": item_protein,
            "total_carbs_g": item_carbs,
            "total_fat_g": item_fat,
            "total_fibre_g": item_fibre,
            "reason": reason,
            "has_lab_insight": len(matched_lab_tags) > 0,
            "items": [
                {
                    "food_id": selected_food.id,
                    "food_name": selected_food.name_en,
                    "food_name_hi": selected_food.name_hi,
                    "diet": selected_food.diet,
                    "portion_label": portion_label,
                    "portion_grams": round(scaled_grams),
                    "kcal": item_kcal,
                    "protein_g": item_protein,
                    "carbs_g": item_carbs,
                    "fat_g": item_fat,
                    "fibre_g": item_fibre,
                }
            ],
        }

    def generate_daily_plan(self, day_label: str = "Today") -> dict:
        """
        Generates a balanced day plan containing breakfast, lunch, dinner, and optional snack.
        """
        safe_foods = self._get_eligible_foods()
        food_groups = self._classify_foods_by_meal(safe_foods)
        dist = MEAL_DISTRIBUTIONS.get(self.meals_per_day, MEAL_DISTRIBUTIONS[4])

        daily_kcal_target = float(self.targets.get("kcal", 2000))
        used_ids = set()
        meals = {}

        for m_key, m_info in dist.items():
            meal_target_kcal = daily_kcal_target * m_info["pct"]
            meal_data = self.generate_meal(
                meal_key=m_key,
                target_kcal=meal_target_kcal,
                food_pool=food_groups[m_key],
                used_food_ids=used_ids,
            )
            meals[m_key] = meal_data
            for item in meal_data["items"]:
                used_ids.add(item["food_id"])

        day_total_kcal = round(sum(m["total_kcal"] for m in meals.values()))
        day_total_protein = round(sum(m["total_protein_g"] for m in meals.values()), 1)
        day_total_carbs = round(sum(m["total_carbs_g"] for m in meals.values()), 1)
        day_total_fat = round(sum(m["total_fat_g"] for m in meals.values()), 1)
        day_total_fibre = round(sum(m["total_fibre_g"] for m in meals.values()), 1)

        return {
            "day": day_label,
            "meals": meals,
            "totals": {
                "kcal": day_total_kcal,
                "protein_g": day_total_protein,
                "carbs_g": day_total_carbs,
                "fat_g": day_total_fat,
                "fibre_g": day_total_fibre,
            },
            "targets": self.targets,
        }

    def generate_weekly_plan(self) -> dict:
        """
        Generates 7 daily plans (Monday through Sunday) with variety tracking.
        """
        days = []
        for day_name in DAY_NAMES:
            day_plan = self.generate_daily_plan(day_label=day_name)
            days.append(day_plan)

        avg_kcal = round(sum(d["totals"]["kcal"] for d in days) / len(days))
        avg_protein = round(sum(d["totals"]["protein_g"] for d in days) / len(days), 1)
        avg_carbs = round(sum(d["totals"]["carbs_g"] for d in days) / len(days), 1)
        avg_fat = round(sum(d["totals"]["fat_g"] for d in days) / len(days), 1)

        return {
            "plan_type": "weekly",
            "days": days,
            "averages": {
                "kcal": avg_kcal,
                "protein_g": avg_protein,
                "carbs_g": avg_carbs,
                "fat_g": avg_fat,
            },
            "targets": self.targets,
            "preferences": {
                "diet_type": self.diet,
                "meals_per_day": self.meals_per_day,
                "allergies": list(self.allergies),
            },
        }

    def get_meal_alternatives(self, meal_key: str, exclude_food_id: int, target_kcal: float) -> List[dict]:
        """
        Returns 3 alternative options for replacing a single meal.
        """
        safe_foods = self._get_eligible_foods()
        food_groups = self._classify_foods_by_meal(safe_foods)
        pool = [f for f in food_groups.get(meal_key, safe_foods) if f.id != exclude_food_id]
        if not pool:
            pool = safe_foods

        alternatives = []
        random.shuffle(pool)
        for food in pool[:4]:
            alt = self.generate_meal(meal_key, target_kcal, [food])
            alternatives.append(alt)

        return alternatives
