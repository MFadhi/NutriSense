from datetime import datetime, date, timezone
from decimal import Decimal
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from ..extensions import db
from ..models.log import FoodLog
from ..models.food import Food, Portion
from ..services.nutrition import compute_nutrients, quantize, _compute_nutrients
from ..errors import error_response

logs_bp = Blueprint("logs", __name__)

VALID_MEALS = {"breakfast", "lunch", "snack", "dinner"}


def _parse_date(date_str):
    """Parse YYYY-MM-DD string to date object, or raise ValueError."""
    return datetime.strptime(date_str, "%Y-%m-%d").date()


# ---------------------------------------------------------------------------
# POST /logs
# ---------------------------------------------------------------------------
@logs_bp.route("/logs", methods=["POST"])
@jwt_required()
def create_log():
    user_id = int(get_jwt_identity())
    data = request.get_json(silent=True) or {}

    # --- Validate required fields ---
    food_id = data.get("food_id")
    food_name = (data.get("food_name") or "").strip()
    if not food_id and not food_name:
        return error_response(
            "validation_error", "Either food_id or food_name is required.", status=422
        )

    meal = (data.get("meal") or "").strip().lower()
    if meal not in VALID_MEALS:
        return error_response(
            "validation_error",
            f"meal must be one of {sorted(VALID_MEALS)}. Note: use 'snack' (singular), not 'snacks'.",
            status=422,
        )

    log_date_str = data.get("log_date")
    if not log_date_str:
        return error_response(
            "validation_error", "log_date (YYYY-MM-DD) is required.", status=422
        )
    try:
        log_date = _parse_date(log_date_str)
    except ValueError:
        return error_response(
            "validation_error",
            "log_date must be a valid date in YYYY-MM-DD format.",
            status=422,
        )

    try:
        quantity = Decimal(str(data.get("quantity", 1)))
        if quantity <= 0 or quantity > 9999:
            raise ValueError
    except (TypeError, ValueError, Exception):
        return error_response(
            "validation_error",
            "quantity must be a positive number no greater than 9999.",
            status=422,
        )

    # --- Resolve food ---
    food = None
    portion = None
    if food_id:
        food = db.session.get(Food, int(food_id))
        if not food:
            return error_response("not_found", "Food not found.", status=404)
        food_name = food_name or food.name_en

        # Resolve portion
        portion_id = data.get("portion_id")
        grams_mode = "grams" in data and data.get("grams") is not None
        if portion_id:
            portion = Portion.query.filter_by(
                id=int(portion_id), food_id=food.id
            ).first()
            if not portion:
                return error_response(
                    "not_found", "Portion not found for this food.", status=404
                )
            portion_label = portion.label
            portion_grams = portion.grams
        elif grams_mode:
            portion_label = "g"
            portion_grams = Decimal("1.00")
            grams_val = Decimal(str(data.get("grams", 1)))
            quantity = quantize(grams_val * quantity)
        else:
            portion = food.default_portion()
            if portion:
                portion_label = portion.label
                portion_grams = portion.grams
            else:
                portion_label = "100g"
                portion_grams = Decimal("100.00")

    # Build log entry
    logged_at_str = data.get("logged_at")
    if logged_at_str:
        try:
            logged_at = datetime.fromisoformat(
                logged_at_str.replace("Z", "+00:00")
            ).replace(tzinfo=None)
        except ValueError:
            logged_at = datetime.now(timezone.utc).replace(tzinfo=None)
    else:
        # Combine log_date + current time
        now = datetime.now(timezone.utc)
        logged_at = datetime(
            log_date.year, log_date.month, log_date.day,
            now.hour, now.minute, now.second,
        )

    log = FoodLog(
        user_id=user_id,
        food_id=food.id if food else None,
        food_name=food_name or (food.name_en if food else "Unknown"),
        meal=meal,
        logged_at=logged_at,
        log_date=log_date,
        quantity=quantity,
    )

    if food and portion_grams:
        log.portion_label = portion_label
        log.portion_grams = portion_grams
        nutrients = _compute_nutrients(food, float(portion_grams), float(quantity))
        log.kcal = nutrients["kcal"]
        log.protein_g = nutrients["protein_g"]
        log.carbs_g = nutrients["carbs_g"]
        log.fat_g = nutrients["fat_g"]
        log.fibre_g = nutrients["fibre_g"]
    else:
        # Manual entry — accept explicit nutrition values or default to 0
        log.portion_label = data.get("portion_label")
        log.portion_grams = data.get("portion_grams")
        log.kcal = quantize(data.get("kcal", 0))
        log.protein_g = quantize(data.get("protein_g", 0))
        log.carbs_g = quantize(data.get("carbs_g", 0))
        log.fat_g = quantize(data.get("fat_g", 0))
        log.fibre_g = quantize(data.get("fibre_g", 0))

    db.session.add(log)
    db.session.commit()
    return jsonify({"log": log.to_dict()}), 201


# ---------------------------------------------------------------------------
# GET /logs?date=YYYY-MM-DD
# ---------------------------------------------------------------------------
@logs_bp.route("/logs", methods=["GET"])
@jwt_required()
def list_logs():
    user_id = int(get_jwt_identity())
    date_str = request.args.get("date", "")
    if not date_str:
        return error_response(
            "validation_error", "Query param 'date' (YYYY-MM-DD) is required.", status=422
        )
    try:
        log_date = _parse_date(date_str)
    except ValueError:
        return error_response(
            "validation_error", "date must be a valid YYYY-MM-DD.", status=422
        )

    logs = (
        FoodLog.query.filter_by(user_id=user_id, log_date=log_date)
        .order_by(FoodLog.logged_at)
        .all()
    )

    # Group by meal and compute per-meal and day totals
    meal_order = ["breakfast", "lunch", "snack", "dinner"]
    meals: dict = {m: [] for m in meal_order}
    for log in logs:
        meals.setdefault(log.meal, []).append(log.to_dict())

    def _sum_nutrients(log_dicts):
        totals = {"kcal": 0.0, "protein_g": 0.0, "carbs_g": 0.0, "fat_g": 0.0, "fibre_g": 0.0}
        for ld in log_dicts:
            for k in totals:
                totals[k] = round(totals[k] + (ld.get(k) or 0), 2)
        return totals

    meal_data = {}
    for m in meal_order:
        entries = meals.get(m, [])
        meal_data[m] = {"logs": entries, "totals": _sum_nutrients(entries)}

    # Also include any unexpected meal values (shouldn't happen but be safe)
    for m, entries_dicts in meals.items():
        if m not in meal_data:
            meal_data[m] = {"logs": entries_dicts, "totals": _sum_nutrients(entries_dicts)}

    all_logs = [log.to_dict() for log in logs]
    day_totals = _sum_nutrients(all_logs)

    return jsonify(
        {
            "date": log_date.isoformat(),
            "meals": meal_data,
            "day_totals": day_totals,
            "total_entries": len(logs),
        }
    ), 200


# ---------------------------------------------------------------------------
# PATCH /logs/<id>
# ---------------------------------------------------------------------------
@logs_bp.route("/logs/<int:log_id>", methods=["PATCH"])
@jwt_required()
def update_log(log_id):
    user_id = int(get_jwt_identity())
    log = db.session.get(FoodLog, log_id)
    if not log or log.user_id != user_id:
        return error_response("not_found", "Log entry not found.", status=404)

    data = request.get_json(silent=True) or {}
    errors = []

    if "meal" in data:
        meal = (data["meal"] or "").strip().lower()
        if meal not in VALID_MEALS:
            errors.append(f"meal must be one of {sorted(VALID_MEALS)}.")
        else:
            log.meal = meal

    if "quantity" in data:
        try:
            new_qty = Decimal(str(data["quantity"]))
            if new_qty <= 0 or new_qty > 9999:
                raise ValueError
        except (TypeError, ValueError):
            errors.append("quantity must be a positive number no greater than 9999.")
        else:
            # Rescale nutrients proportionally from snapshot
            if log.quantity:
                old_qty = Decimal(str(log.quantity))
                if old_qty > 0:
                    ratio = new_qty / old_qty
                    log.kcal = quantize(Decimal(str(log.kcal or 0)) * ratio)
                    log.protein_g = quantize(Decimal(str(log.protein_g or 0)) * ratio)
                    log.carbs_g = quantize(Decimal(str(log.carbs_g or 0)) * ratio)
                    log.fat_g = quantize(Decimal(str(log.fat_g or 0)) * ratio)
                    log.fibre_g = quantize(Decimal(str(log.fibre_g or 0)) * ratio)
            log.quantity = new_qty

    if errors:
        return error_response("validation_error", "; ".join(errors), status=422)

    db.session.commit()
    return jsonify({"log": log.to_dict()}), 200


# ---------------------------------------------------------------------------
# DELETE /logs/<id>
# ---------------------------------------------------------------------------
@logs_bp.route("/logs/<int:log_id>", methods=["DELETE"])
@jwt_required()
def delete_log(log_id):
    user_id = int(get_jwt_identity())
    log = db.session.get(FoodLog, log_id)
    if not log or log.user_id != user_id:
        return error_response("not_found", "Log entry not found.", status=404)

    db.session.delete(log)
    db.session.commit()
    return jsonify({"message": "Log entry deleted."}), 200


# ---------------------------------------------------------------------------
# DELETE /me/data  — delete the user's logs
# ---------------------------------------------------------------------------
@logs_bp.route("/me/data", methods=["DELETE"])
@jwt_required()
def delete_my_logs():
    """Delete all food logs for the authenticated user."""
    user_id = int(get_jwt_identity())
    FoodLog.query.filter_by(user_id=user_id).delete()
    db.session.commit()
    return jsonify({"message": "All food logs deleted."}), 200
