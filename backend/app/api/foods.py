from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity, verify_jwt_in_request
from ..extensions import db
from ..models.food import Food, FoodCategory
from ..models.log import FoodLog
from ..models.user import User
from ..services.food_search import search_foods
from ..services.food_compatibility import get_warnings
from ..errors import error_response

foods_bp = Blueprint("foods", __name__)

DATA_NOTICE = (
    "Nutritional values are approximate sample data. "
    "Verify against IFCT 2017 for clinical use."
)


def _optional_user_profile():
    """Return the UserProfile for the current JWT user, or None if not authenticated."""
    try:
        verify_jwt_in_request(optional=True)
        uid = get_jwt_identity()
        if uid:
            user = db.session.get(User, int(uid))
            return user.profile if user else None
    except Exception:
        pass
    return None


def _food_summary(food, profile=None):
    """Serialize a food for list responses."""
    dp = food.default_portion()
    kcal_per_portion = None
    if dp:
        kcal_per_portion = round(
            float(food.kcal_per_100g) * float(dp.grams) / 100, 2
        )
    return {
        "id": food.id,
        "seed_key": food.seed_key,
        "name_en": food.name_en,
        "name_hi": food.name_hi,
        "name_kn": food.name_kn,
        "category": food.category.to_dict() if food.category else None,
        "diet": food.diet,
        "default_portion": dp.to_dict() if dp else None,
        "kcal_per_portion": kcal_per_portion,
        "is_sample": food.is_sample,
        "warnings": get_warnings(food, profile) if profile else [],
    }


# ---------------------------------------------------------------------------
# GET /foods/categories  — MUST be before /foods/<int:food_id>
# ---------------------------------------------------------------------------
@foods_bp.route("/foods/categories", methods=["GET"])
def list_categories():
    cats = FoodCategory.query.order_by(FoodCategory.slug).all()
    return jsonify({"categories": [c.to_dict() for c in cats]}), 200


# ---------------------------------------------------------------------------
# GET /foods/recent  — MUST be before /foods/<int:food_id>
# ---------------------------------------------------------------------------
@foods_bp.route("/foods/recent", methods=["GET"])
@jwt_required()
def recent_foods():
    user_id = int(get_jwt_identity())
    profile = _optional_user_profile()

    # Last 10 distinct food_ids logged by user (by most recent log)
    subq = (
        db.session.query(
            FoodLog.food_id,
            db.func.max(FoodLog.logged_at).label("last_logged"),
        )
        .filter(FoodLog.user_id == user_id, FoodLog.food_id.isnot(None))
        .group_by(FoodLog.food_id)
        .order_by(db.func.max(FoodLog.logged_at).desc())
        .limit(10)
        .subquery()
    )
    food_ids = [row[0] for row in db.session.query(subq.c.food_id).all()]
    foods = Food.query.filter(Food.id.in_(food_ids)).all()

    # Sort to match the order returned from the subquery
    id_order = {fid: idx for idx, fid in enumerate(food_ids)}
    foods.sort(key=lambda f: id_order.get(f.id, 999))

    return jsonify({"foods": [_food_summary(f, profile) for f in foods]}), 200


# ---------------------------------------------------------------------------
# GET /foods?q=&category=&diet=&limit=&offset=
# ---------------------------------------------------------------------------
@foods_bp.route("/foods", methods=["GET"])
def search():
    q = request.args.get("q", "").strip()
    category_slug = request.args.get("category", "").strip() or None
    diet = request.args.get("diet", "").strip() or None
    try:
        limit = max(1, min(100, int(request.args.get("limit", 20))))
    except (TypeError, ValueError):
        limit = 20
    try:
        offset = max(0, int(request.args.get("offset", 0)))
    except (TypeError, ValueError):
        offset = 0

    profile = _optional_user_profile()
    foods_page, total = search_foods(
        q, category_slug=category_slug, diet=diet, limit=limit, offset=offset
    )

    return jsonify(
        {
            "foods": [_food_summary(f, profile) for f in foods_page],
            "total": total,
            "limit": limit,
            "offset": offset,
        }
    ), 200


# ---------------------------------------------------------------------------
# GET /foods/<int:food_id>  — full detail
# ---------------------------------------------------------------------------
@foods_bp.route("/foods/<int:food_id>", methods=["GET"])
def food_detail(food_id):
    food = db.session.get(Food, food_id)
    if not food:
        return error_response("not_found", "Food not found.", status=404)

    profile = _optional_user_profile()

    return jsonify(
        {
            "id": food.id,
            "seed_key": food.seed_key,
            "name_en": food.name_en,
            "name_hi": food.name_hi,
            "name_kn": food.name_kn,
            "category": food.category.to_dict() if food.category else None,
            "diet": food.diet,
            "kcal_per_100g": float(food.kcal_per_100g),
            "protein_per_100g": float(food.protein_per_100g),
            "carbs_per_100g": float(food.carbs_per_100g),
            "fat_per_100g": float(food.fat_per_100g),
            "fibre_per_100g": float(food.fibre_per_100g)
            if food.fibre_per_100g is not None
            else 0,
            "allergens": food.allergens or [],
            "tags": food.tags or [],
            "portions": [p.to_dict() for p in food.portions],
            "is_sample": food.is_sample,
            "source": food.source,
            "warnings": get_warnings(food, profile) if profile else [],
            "data_notice": DATA_NOTICE,
        }
    ), 200
