from decimal import Decimal
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity, verify_jwt_in_request
from ..extensions import db
from ..models.food import Food, FoodCategory, Portion
from ..models.log import FoodLog
from ..models.user import User
from ..services.food_search import search_foods, invalidate_cache
from ..services.food_compatibility import get_warnings
from ..errors import error_response

VALID_ALLERGENS = [
    "peanut",
    "tree_nut",
    "milk",
    "egg",
    "gluten",
    "soy",
    "fish",
    "shellfish",
    "sesame",
    "mustard",
    "celery",
    "lupin",
    "molluscs",
    "sulphites",
]

foods_bp = Blueprint("foods", __name__)

DATA_NOTICE = (
    "Nutritional values are approximate sample data. "
    "Verify against IFCT 2017 for clinical use."
)


@foods_bp.route("/health", methods=["GET"])
def health():
    """Deployment health check."""
    return jsonify({"status": "ok"}), 200


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
    if dp and food.kcal_per_100g is not None:
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
        "source": food.source,
        "barcode": food.barcode,
        "owner_user_id": food.owner_user_id,
        "diet_verified": food.diet_verified,
        "needs_review": food.needs_review,
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

    user_id = None
    try:
        verify_jwt_in_request(optional=True)
        uid = get_jwt_identity()
        if uid:
            user_id = int(uid)
    except Exception:
        pass

    profile = _optional_user_profile()
    foods_page, total = search_foods(
        q, category_slug=category_slug, diet=diet, limit=limit, offset=offset, user_id=user_id
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
def _serialize_food_detail(food, profile=None):
    """Serialize full detail for a food object."""
    return {
        "id": food.id,
        "seed_key": food.seed_key,
        "name_en": food.name_en,
        "name_hi": food.name_hi,
        "name_kn": food.name_kn,
        "category": food.category.to_dict() if food.category else None,
        "diet": food.diet,
        "kcal_per_100g": float(food.kcal_per_100g) if food.kcal_per_100g is not None else 0.0,
        "protein_per_100g": float(food.protein_per_100g) if food.protein_per_100g is not None else 0.0,
        "carbs_per_100g": float(food.carbs_per_100g) if food.carbs_per_100g is not None else 0.0,
        "fat_per_100g": float(food.fat_per_100g) if food.fat_per_100g is not None else 0.0,
        "fibre_per_100g": float(food.fibre_per_100g) if food.fibre_per_100g is not None else 0.0,
        "allergens": food.allergens or [],
        "tags": food.tags or [],
        "portions": [p.to_dict() for p in food.portions],
        "is_sample": food.is_sample,
        "source": food.source,
        "barcode": food.barcode,
        "owner_user_id": food.owner_user_id,
        "diet_verified": food.diet_verified,
        "needs_review": food.needs_review,
        "warnings": get_warnings(food, profile) if profile else [],
        "data_notice": DATA_NOTICE,
    }


# ---------------------------------------------------------------------------
# GET /foods/<int:food_id>  — full detail
# ---------------------------------------------------------------------------
@foods_bp.route("/foods/<int:food_id>", methods=["GET"])
def food_detail(food_id):
    user_id = None
    try:
        verify_jwt_in_request(optional=True)
        uid = get_jwt_identity()
        if uid:
            user_id = int(uid)
    except Exception:
        pass

    food = db.session.get(Food, food_id)
    if not food:
        return error_response("not_found", "Food not found.", status=404)

    # Custom food isolation: another user's custom food is 404
    if food.owner_user_id is not None and food.owner_user_id != user_id:
        return error_response("not_found", "Food not found.", status=404)

    profile = _optional_user_profile()
    return jsonify(_serialize_food_detail(food, profile)), 200


# ---------------------------------------------------------------------------
# Custom foods CRUD (auth required)
# ---------------------------------------------------------------------------
@foods_bp.route("/foods/custom", methods=["POST"])
@jwt_required()
def create_custom_food():
    user_id = int(get_jwt_identity())
    data = request.get_json(silent=True) or {}

    # Validate name_en
    name_en = (data.get("name_en") or "").strip()
    if not name_en:
        return error_response("validation_error", "name_en is required.", status=422)

    # Validate diet
    diet = data.get("diet")
    if diet not in ("vegan", "veg", "egg", "nonveg"):
        return error_response(
            "validation_error",
            "diet must be one of: vegan, veg, egg, nonveg.",
            status=422,
        )

    # Validate per_100g nutrients
    try:
        kcal = Decimal(str(data.get("kcal_per_100g", 0)))
        protein = Decimal(str(data.get("protein_per_100g", 0)))
        carbs = Decimal(str(data.get("carbs_per_100g", 0)))
        fat = Decimal(str(data.get("fat_per_100g", 0)))
        fibre = Decimal(str(data.get("fibre_per_100g", 0)))
    except Exception:
        return error_response(
            "validation_error",
            "Nutrient values per 100g must be valid numbers.",
            status=422,
        )

    if any(val < 0 for val in (kcal, protein, carbs, fat, fibre)):
        return error_response(
            "validation_error",
            "Nutrient values per 100g cannot be negative.",
            status=422,
        )

    if kcal > 900:
        return error_response(
            "validation_error",
            "kcal_per_100g cannot exceed 900.",
            status=422,
        )

    if (protein + carbs + fat) > Decimal("100.5"):
        return error_response(
            "validation_error",
            "Sum of protein, carbs, and fat per 100g cannot exceed 100g.",
            status=422,
        )

    # Validate allergens
    allergens = data.get("allergens") or []
    if not isinstance(allergens, list):
        return error_response("validation_error", "allergens must be a list.", status=422)
    invalid_allergens = [a for a in allergens if a not in VALID_ALLERGENS]
    if invalid_allergens:
        return error_response(
            "validation_error",
            f"Invalid allergens: {invalid_allergens}. Allowed: {VALID_ALLERGENS}",
            status=422,
        )

    # Validate portions
    portions_data = data.get("portions")
    if not portions_data or not isinstance(portions_data, list):
        return error_response(
            "validation_error",
            "At least one portion is required.",
            status=422,
        )

    has_default = any(bool(p.get("default")) for p in portions_data)
    validated_portions = []
    for idx, p in enumerate(portions_data):
        label = (p.get("label") or "").strip()
        if not label:
            return error_response("validation_error", "Each portion must have a label.", status=422)
        try:
            grams = Decimal(str(p.get("grams", 0)))
            if grams <= 0:
                raise ValueError
        except Exception:
            return error_response(
                "validation_error",
                f"Portion '{label}' must have grams > 0.",
                status=422,
            )
        is_def = bool(p.get("default")) or (not has_default and idx == 0)
        validated_portions.append((label, grams, is_def))

    # Barcode (if provided)
    barcode = data.get("barcode")
    if barcode:
        barcode = str(barcode).strip()
        # Check duplicate barcode among caller's custom foods
        existing = Food.query.filter_by(barcode=barcode, owner_user_id=user_id).first()
        if existing:
            return error_response(
                "conflict",
                f"A custom food with barcode '{barcode}' already exists.",
                details={"existing_food_id": existing.id},
                status=409,
            )
    else:
        barcode = None

    source = data.get("source", "user")
    if source not in ("user", "openfoodfacts"):
        source = "user"

    diet_verified = data.get("diet_verified", True)
    needs_review = data.get("needs_review", False)
    category_id = data.get("category_id")

    food = Food(
        name_en=name_en,
        name_hi=data.get("name_hi"),
        name_kn=data.get("name_kn"),
        category_id=category_id,
        diet=diet,
        kcal_per_100g=kcal,
        protein_per_100g=protein,
        carbs_per_100g=carbs,
        fat_per_100g=fat,
        fibre_per_100g=fibre,
        allergens=allergens,
        tags=data.get("tags") or [],
        is_sample=False,
        source=source,
        barcode=barcode,
        owner_user_id=user_id,
        diet_verified=diet_verified,
        needs_review=needs_review,
    )
    for lbl, g, is_def in validated_portions:
        food.portions.append(Portion(label=lbl, grams=g, is_default=is_def))

    db.session.add(food)
    db.session.commit()
    invalidate_cache()

    profile = _optional_user_profile()
    return jsonify({"food": _serialize_food_detail(food, profile)}), 201


@foods_bp.route("/foods/custom/<int:food_id>", methods=["PATCH"])
@jwt_required()
def update_custom_food(food_id):
    user_id = int(get_jwt_identity())
    food = Food.query.filter_by(id=food_id, owner_user_id=user_id).first()
    if not food:
        return error_response("not_found", "Custom food not found.", status=404)

    data = request.get_json(silent=True) or {}

    if "name_en" in data:
        name_en = (data["name_en"] or "").strip()
        if not name_en:
            return error_response("validation_error", "name_en cannot be empty.", status=422)
        food.name_en = name_en

    if "diet" in data:
        diet = data["diet"]
        if diet not in ("vegan", "veg", "egg", "nonveg"):
            return error_response("validation_error", "Invalid diet.", status=422)
        food.diet = diet

    # Nutrients
    for field in ("kcal_per_100g", "protein_per_100g", "carbs_per_100g", "fat_per_100g", "fibre_per_100g"):
        if field in data:
            try:
                val = Decimal(str(data[field]))
                if val < 0:
                    raise ValueError
                setattr(food, field, val)
            except Exception:
                return error_response("validation_error", f"{field} must be a non-negative number.", status=422)

    if float(food.kcal_per_100g) > 900:
        return error_response("validation_error", "kcal_per_100g cannot exceed 900.", status=422)

    if (Decimal(str(food.protein_per_100g)) + Decimal(str(food.carbs_per_100g)) + Decimal(str(food.fat_per_100g))) > Decimal("100.5"):
        return error_response(
            "validation_error",
            "Sum of protein, carbs, and fat per 100g cannot exceed 100g.",
            status=422,
        )

    if "allergens" in data:
        allergens = data["allergens"] or []
        invalid = [a for a in allergens if a not in VALID_ALLERGENS]
        if invalid:
            return error_response("validation_error", f"Invalid allergens: {invalid}", status=422)
        food.allergens = allergens

    if "tags" in data:
        food.tags = data["tags"] or []

    if "diet_verified" in data:
        food.diet_verified = bool(data["diet_verified"])

    if "needs_review" in data:
        food.needs_review = bool(data["needs_review"])

    if "barcode" in data:
        bc = data["barcode"]
        if bc:
            bc = str(bc).strip()
            dup = Food.query.filter(
                Food.barcode == bc,
                Food.owner_user_id == user_id,
                Food.id != food_id,
            ).first()
            if dup:
                return error_response(
                    "conflict",
                    f"A custom food with barcode '{bc}' already exists.",
                    details={"existing_food_id": dup.id},
                    status=409,
                )
            food.barcode = bc
        else:
            food.barcode = None

    if "portions" in data:
        portions_data = data["portions"]
        if not portions_data or not isinstance(portions_data, list):
            return error_response("validation_error", "portions must be a non-empty list.", status=422)
        has_default = any(bool(p.get("default")) for p in portions_data)
        validated_portions = []
        for idx, p in enumerate(portions_data):
            label = (p.get("label") or "").strip()
            if not label:
                return error_response("validation_error", "Each portion must have a label.", status=422)
            try:
                grams = Decimal(str(p.get("grams", 0)))
                if grams <= 0:
                    raise ValueError
            except Exception:
                return error_response("validation_error", f"Portion '{label}' must have grams > 0.", status=422)
            is_def = bool(p.get("default")) or (not has_default and idx == 0)
            validated_portions.append(Portion(label=label, grams=grams, is_default=is_def))

        food.portions = validated_portions

    db.session.commit()
    invalidate_cache()

    profile = _optional_user_profile()
    return jsonify({"food": _serialize_food_detail(food, profile)}), 200


@foods_bp.route("/foods/custom/<int:food_id>", methods=["DELETE"])
@jwt_required()
def delete_custom_food(food_id):
    user_id = int(get_jwt_identity())
    food = Food.query.filter_by(id=food_id, owner_user_id=user_id).first()
    if not food:
        return error_response("not_found", "Custom food not found.", status=404)

    db.session.delete(food)
    db.session.commit()
    invalidate_cache()

    return jsonify({"message": "Custom food deleted."}), 200
