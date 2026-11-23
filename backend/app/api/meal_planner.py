from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity

from ..extensions import db
from ..models import User, MealPlan, MealPlanPreference
from ..services.meal_planner_service import MealPlannerEngine

meal_planner_bp = Blueprint("meal_planner", __name__)


# ---------------------------------------------------------------------------
# Preferences
# ---------------------------------------------------------------------------
@meal_planner_bp.route("/meal-planner/preferences", methods=["GET"])
@jwt_required()
def get_preferences():
    user_id = int(get_jwt_identity())
    user = db.session.get(User, user_id)
    pref = MealPlanPreference.query.filter_by(user_id=user_id).first()

    profile_diet = user.profile.diet_type if (user and user.profile) else "veg"
    profile_allergies = user.profile.allergies if (user and user.profile) else []

    if not pref:
        return jsonify({
            "meals_per_day": 4,
            "include_snacks": True,
            "diet_type": profile_diet,
            "liked_tags": [],
            "avoided_tags": [],
            "allergies": profile_allergies,
        }), 200

    data = pref.to_dict()
    data["diet_type"] = pref.diet_type or profile_diet
    data["allergies"] = profile_allergies
    return jsonify(data), 200


@meal_planner_bp.route("/meal-planner/preferences", methods=["PUT"])
@jwt_required()
def update_preferences():
    user_id = int(get_jwt_identity())
    body = request.get_json(silent=True) or {}

    pref = MealPlanPreference.query.filter_by(user_id=user_id).first()
    if not pref:
        pref = MealPlanPreference(user_id=user_id)
        db.session.add(pref)

    if "meals_per_day" in body:
        pref.meals_per_day = int(body["meals_per_day"])
    if "include_snacks" in body:
        pref.include_snacks = bool(body["include_snacks"])
    if "diet_type" in body:
        pref.diet_type = body["diet_type"]
    if "liked_tags" in body:
        pref.liked_tags = body["liked_tags"]
    if "avoided_tags" in body:
        pref.avoided_tags = body["avoided_tags"]

    db.session.commit()
    return jsonify(pref.to_dict()), 200


# ---------------------------------------------------------------------------
# Meal Plan Generation
# ---------------------------------------------------------------------------
@meal_planner_bp.route("/meal-planner/generate/daily", methods=["POST"])
@jwt_required()
def generate_daily():
    user_id = int(get_jwt_identity())
    user = db.session.get(User, user_id)
    if not user:
        return jsonify({"error": {"code": "not_found", "message": "User not found."}}), 404

    pref = MealPlanPreference.query.filter_by(user_id=user_id).first()
    pref_dict = pref.to_dict() if pref else {}

    # Merge body overrides if provided
    body = request.get_json(silent=True) or {}
    pref_dict.update(body)

    engine = MealPlannerEngine(user=user, preferences=pref_dict)
    daily_plan = engine.generate_daily_plan(day_label=body.get("day", "Today"))
    return jsonify(daily_plan), 200


@meal_planner_bp.route("/meal-planner/generate/weekly", methods=["POST"])
@jwt_required()
def generate_weekly():
    user_id = int(get_jwt_identity())
    user = db.session.get(User, user_id)
    if not user:
        return jsonify({"error": {"code": "not_found", "message": "User not found."}}), 404

    pref = MealPlanPreference.query.filter_by(user_id=user_id).first()
    pref_dict = pref.to_dict() if pref else {}

    body = request.get_json(silent=True) or {}
    pref_dict.update(body)

    engine = MealPlannerEngine(user=user, preferences=pref_dict)
    weekly_plan = engine.generate_weekly_plan()
    return jsonify(weekly_plan), 200


@meal_planner_bp.route("/meal-planner/replace-meal", methods=["POST"])
@jwt_required()
def replace_meal():
    user_id = int(get_jwt_identity())
    user = db.session.get(User, user_id)
    body = request.get_json(silent=True) or {}

    meal_key = body.get("meal_key", "lunch")
    exclude_food_id = int(body.get("exclude_food_id", 0))
    target_kcal = float(body.get("target_kcal", 500.0))

    pref = MealPlanPreference.query.filter_by(user_id=user_id).first()
    pref_dict = pref.to_dict() if pref else {}

    engine = MealPlannerEngine(user=user, preferences=pref_dict)
    alternatives = engine.get_meal_alternatives(meal_key, exclude_food_id, target_kcal)
    return jsonify({"alternatives": alternatives}), 200


# ---------------------------------------------------------------------------
# Saved Meal Plans CRUD
# ---------------------------------------------------------------------------
@meal_planner_bp.route("/meal-planner/save", methods=["POST"])
@jwt_required()
def save_plan():
    user_id = int(get_jwt_identity())
    body = request.get_json(silent=True) or {}

    title = body.get("title") or "Personalized Meal Plan"
    plan_type = body.get("plan_type", "weekly")
    plan_data = body.get("plan_data")

    if not plan_data:
        return jsonify({
            "error": {
                "code": "missing_plan_data",
                "message": "plan_data is required to save a meal plan.",
            }
        }), 400

    totals = body.get("totals") or {}
    total_kcal = totals.get("kcal")
    total_protein = totals.get("protein_g")
    total_carbs = totals.get("carbs_g")
    total_fat = totals.get("fat_g")

    new_plan = MealPlan(
        user_id=user_id,
        title=title,
        plan_type=plan_type,
        is_active=body.get("is_active", False),
        total_kcal=total_kcal,
        total_protein_g=total_protein,
        total_carbs_g=total_carbs,
        total_fat_g=total_fat,
        plan_data=plan_data,
    )
    db.session.add(new_plan)
    db.session.commit()

    return jsonify(new_plan.to_dict()), 201


@meal_planner_bp.route("/meal-planner", methods=["GET"])
@jwt_required()
def list_plans():
    user_id = int(get_jwt_identity())
    plans = MealPlan.query.filter_by(user_id=user_id).order_by(MealPlan.created_at.desc()).all()
    return jsonify([p.to_dict() for p in plans]), 200


@meal_planner_bp.route("/meal-planner/<int:plan_id>", methods=["GET"])
@jwt_required()
def get_plan(plan_id: int):
    user_id = int(get_jwt_identity())
    plan = MealPlan.query.filter_by(id=plan_id, user_id=user_id).first()
    if not plan:
        return jsonify({"error": {"code": "not_found", "message": "Meal plan not found."}}), 404
    return jsonify(plan.to_dict()), 200


@meal_planner_bp.route("/meal-planner/<int:plan_id>/active", methods=["PUT"])
@jwt_required()
def set_active_plan(plan_id: int):
    user_id = int(get_jwt_identity())
    plan = MealPlan.query.filter_by(id=plan_id, user_id=user_id).first()
    if not plan:
        return jsonify({"error": {"code": "not_found", "message": "Meal plan not found."}}), 404

    # Deactivate other plans for user
    MealPlan.query.filter_by(user_id=user_id).update({"is_active": False})
    plan.is_active = True
    db.session.commit()
    return jsonify(plan.to_dict()), 200


@meal_planner_bp.route("/meal-planner/<int:plan_id>", methods=["DELETE"])
@jwt_required()
def delete_plan(plan_id: int):
    user_id = int(get_jwt_identity())
    plan = MealPlan.query.filter_by(id=plan_id, user_id=user_id).first()
    if not plan:
        return jsonify({"error": {"code": "not_found", "message": "Meal plan not found."}}), 404

    db.session.delete(plan)
    db.session.commit()
    return jsonify({"message": "Meal plan deleted successfully."}), 200
