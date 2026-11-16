from datetime import datetime, timezone
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from ..extensions import db
from ..models.water import WaterLog
from ..errors import error_response

water_bp = Blueprint("water", __name__)


@water_bp.route("/water", methods=["POST"])
@jwt_required()
def log_water():
    user_id = int(get_jwt_identity())
    data = request.get_json(silent=True) or {}

    # Validate amount_ml
    try:
        amount_ml = int(data.get("amount_ml", 0))
        if amount_ml < 1 or amount_ml > 2000:
            raise ValueError
    except (TypeError, ValueError):
        return error_response(
            "validation_error",
            "amount_ml must be an integer between 1 and 2000.",
            status=422,
        )

    # Validate log_date
    date_str = data.get("log_date")
    if not date_str:
        return error_response("validation_error", "log_date (YYYY-MM-DD) is required.", status=422)
    try:
        log_date = datetime.strptime(date_str, "%Y-%m-%d").date()
    except ValueError:
        return error_response("validation_error", "log_date must be in YYYY-MM-DD format.", status=422)

    # logged_at
    logged_at_str = data.get("logged_at")
    if logged_at_str:
        try:
            logged_at = datetime.fromisoformat(logged_at_str.replace("Z", "+00:00")).replace(tzinfo=None)
        except ValueError:
            logged_at = datetime.now(timezone.utc).replace(tzinfo=None)
    else:
        logged_at = datetime.now(timezone.utc).replace(tzinfo=None)

    entry = WaterLog(
        user_id=user_id,
        log_date=log_date,
        amount_ml=amount_ml,
        logged_at=logged_at,
    )
    db.session.add(entry)
    db.session.commit()

    return jsonify({"water_log": entry.to_dict()}), 201


@water_bp.route("/water", methods=["GET"])
@jwt_required()
def get_water():
    user_id = int(get_jwt_identity())
    date_str = request.args.get("date", "")
    if not date_str:
        return error_response("validation_error", "Query parameter 'date' (YYYY-MM-DD) is required.", status=422)
    try:
        log_date = datetime.strptime(date_str, "%Y-%m-%d").date()
    except ValueError:
        return error_response("validation_error", "date must be in YYYY-MM-DD format.", status=422)

    entries = (
        WaterLog.query.filter_by(user_id=user_id, log_date=log_date)
        .order_by(WaterLog.logged_at)
        .all()
    )
    total_ml = sum(w.amount_ml for w in entries)
    glasses = round(total_ml / 250.0, 1)

    return jsonify(
        {
            "date": log_date.isoformat(),
            "entries": [w.to_dict() for w in entries],
            "total_ml": total_ml,
            "glasses": glasses,
        }
    ), 200


@water_bp.route("/water/<int:water_id>", methods=["DELETE"])
@jwt_required()
def delete_water(water_id):
    user_id = int(get_jwt_identity())
    entry = db.session.get(WaterLog, water_id)
    if not entry or entry.user_id != user_id:
        return error_response("not_found", "Water log entry not found.", status=404)

    db.session.delete(entry)
    db.session.commit()
    return jsonify({"message": "Water log entry deleted."}), 200
