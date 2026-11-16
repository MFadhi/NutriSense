from flask import Blueprint, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from ..extensions import db, limiter
from ..models.food import Food
from ..services.barcode import (
    validate_gs1_barcode,
    lookup_barcode,
    UpstreamUnavailableError,
)
from ..errors import error_response

barcodes_bp = Blueprint("barcodes", __name__)


@barcodes_bp.route("/barcodes/<string:code>", methods=["GET"])
@jwt_required()
@limiter.limit("30 per minute")
def get_barcode_product(code):
    """
    Look up barcode details. Local-first: checks user's custom foods first,
    then checks cache, then fetches from Open Food Facts API v2.
    """
    user_id = int(get_jwt_identity())

    code = code.strip()
    if not validate_gs1_barcode(code):
        return error_response(
            "invalid_barcode",
            "Invalid barcode. Must be 8, 12, or 13 digits with a valid GS1 check digit.",
            status=400,
        )

    # 1. Local-first check: caller's custom food with this barcode
    user_food = Food.query.filter_by(barcode=code, owner_user_id=user_id).first()
    if user_food:
        draft = {
            "food_id": user_food.id,
            "name_en": user_food.name_en,
            "brand": None,
            "quantity": None,
            "per_100g": {
                "kcal": float(user_food.kcal_per_100g),
                "protein": float(user_food.protein_per_100g),
                "carbs": float(user_food.carbs_per_100g),
                "fat": float(user_food.fat_per_100g),
                "fibre": float(user_food.fibre_per_100g) if user_food.fibre_per_100g is not None else 0.0,
            },
            "portions": [p.to_dict() for p in user_food.portions],
            "allergens": user_food.allergens or [],
            "traces": [],
            "diet": user_food.diet,
            "diet_verified": user_food.diet_verified,
            "missing_fields": [],
            "needs_review": user_food.needs_review,
        }
        return jsonify(
            {
                "barcode": code,
                "found": True,
                "cached": False,
                "source": "user",
                "draft": draft,
                "attribution": "User custom food",
            }
        ), 200

    # 2. Cache + Open Food Facts
    try:
        draft, is_cached = lookup_barcode(code)
    except UpstreamUnavailableError:
        response = jsonify(
            {
                "error": {
                    "code": "upstream_unavailable",
                    "message": "Open Food Facts is currently unavailable. Please try again later.",
                    "details": None,
                }
            }
        )
        response.status_code = 503
        response.headers["Retry-After"] = "30"
        return response

    if draft is None:
        return error_response(
            "product_not_found",
            f"Product not found for barcode '{code}'.",
            status=404,
        )

    return jsonify(
        {
            "barcode": code,
            "found": True,
            "cached": is_cached,
            "source": "openfoodfacts",
            "draft": draft,
            "attribution": "Data from Open Food Facts (ODbL)",
        }
    ), 200
