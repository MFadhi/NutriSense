from datetime import datetime, timedelta, date
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from ..extensions import db
from ..models.user import User
from ..models.log import FoodLog
from ..models.water import WaterLog
from ..services.targets import calculate_targets, is_profile_complete
from ..errors import error_response

dashboard_bp = Blueprint("dashboard", __name__)

MEAL_NAMES = ["breakfast", "lunch", "snack", "dinner"]


@dashboard_bp.route("/dashboard/daily", methods=["GET"])
@jwt_required()
def daily_summary():
    user_id = int(get_jwt_identity())
    date_str = request.args.get("date", "")
    if not date_str:
        return error_response("validation_error", "Query parameter 'date' (YYYY-MM-DD) is required.", status=422)
    try:
        log_date = datetime.strptime(date_str, "%Y-%m-%d").date()
    except ValueError:
        return error_response("validation_error", "date must be in YYYY-MM-DD format.", status=422)

    user = db.session.get(User, user_id)
    if not user or not is_profile_complete(user.profile):
        p = user.profile if user else None
        missing = []
        if not p or not (p.age and int(p.age) > 0):
            missing.append("age")
        if not p or not (p.gender and str(p.gender).strip()):
            missing.append("gender")
        if not p or not (p.height_cm and float(p.height_cm) > 0):
            missing.append("height_cm")
        if not p or not (p.weight_kg and float(p.weight_kg) > 0):
            missing.append("weight_kg")
        return error_response(
            "profile_incomplete",
            f"User profile is incomplete. Please set {', '.join(missing)} to view dashboard targets.",
            details={"missing_fields": missing},
            status=409,
        )

    targets = calculate_targets(user.profile)

    # Food logs for the day
    food_logs = (
        FoodLog.query.filter_by(user_id=user_id, log_date=log_date)
        .order_by(FoodLog.logged_at)
        .all()
    )

    consumed_kcal = 0.0
    consumed_protein = 0.0
    consumed_carbs = 0.0
    consumed_fat = 0.0
    consumed_fibre = 0.0

    meals_data = {m: {"kcal": 0.0, "entries": []} for m in MEAL_NAMES}

    for fl in food_logs:
        kc = float(fl.kcal or 0)
        p = float(fl.protein_g or 0)
        c = float(fl.carbs_g or 0)
        f = float(fl.fat_g or 0)
        fib = float(fl.fibre_g or 0)

        consumed_kcal += kc
        consumed_protein += p
        consumed_carbs += c
        consumed_fat += f
        consumed_fibre += fib

        meal_key = fl.meal if fl.meal in meals_data else "snack"
        meals_data[meal_key]["kcal"] = round(meals_data[meal_key]["kcal"] + kc, 1)
        meals_data[meal_key]["entries"].append(fl.to_dict())

    consumed = {
        "kcal": round(consumed_kcal, 1),
        "protein_g": round(consumed_protein, 1),
        "carbs_g": round(consumed_carbs, 1),
        "fat_g": round(consumed_fat, 1),
        "fibre_g": round(consumed_fibre, 1),
    }

    remaining_kcal = round(max(0.0, float(targets["kcal"]) - consumed["kcal"]), 1)

    # Macro split percentages
    protein_cal = consumed["protein_g"] * 4.0
    carbs_cal = consumed["carbs_g"] * 4.0
    fat_cal = consumed["fat_g"] * 9.0
    macro_total = protein_cal + carbs_cal + fat_cal

    if macro_total > 0:
        macro_split_pct = {
            "protein": round((protein_cal / macro_total) * 100.0, 1),
            "carbs": round((carbs_cal / macro_total) * 100.0, 1),
            "fat": round((fat_cal / macro_total) * 100.0, 1),
        }
    else:
        macro_split_pct = {"protein": 0.0, "carbs": 0.0, "fat": 0.0}

    # Water logs for the day
    water_logs = WaterLog.query.filter_by(user_id=user_id, log_date=log_date).all()
    water_consumed_ml = sum(w.amount_ml for w in water_logs)
    water_data = {
        "ml": int(water_consumed_ml),
        "goal_ml": targets["water_ml"],
        "glasses": round(water_consumed_ml / 250.0, 1),
    }

    return jsonify(
        {
            "date": log_date.isoformat(),
            "targets": targets,
            "consumed": consumed,
            "remaining": {"kcal": remaining_kcal},
            "macro_split_pct": macro_split_pct,
            "meals": meals_data,
            "water": water_data,
        }
    ), 200


@dashboard_bp.route("/dashboard/weekly", methods=["GET"])
@jwt_required()
def weekly_summary():
    user_id = int(get_jwt_identity())

    # end date
    end_str = request.args.get("end")
    if end_str:
        try:
            end_date = datetime.strptime(end_str, "%Y-%m-%d").date()
        except ValueError:
            return error_response("validation_error", "end must be in YYYY-MM-DD format.", status=422)
    else:
        end_date = date.today()

    # days count (1 - 31)
    try:
        days = int(request.args.get("days", 7))
        if days < 1 or days > 31:
            raise ValueError
    except (TypeError, ValueError):
        return error_response("validation_error", "days must be an integer between 1 and 31.", status=422)

    user = db.session.get(User, user_id)
    if not user or not is_profile_complete(user.profile):
        p = user.profile if user else None
        missing = []
        if not p or not (p.age and int(p.age) > 0):
            missing.append("age")
        if not p or not (p.gender and str(p.gender).strip()):
            missing.append("gender")
        if not p or not (p.height_cm and float(p.height_cm) > 0):
            missing.append("height_cm")
        if not p or not (p.weight_kg and float(p.weight_kg) > 0):
            missing.append("weight_kg")
        return error_response(
            "profile_incomplete",
            f"User profile is incomplete. Please set {', '.join(missing)} to view dashboard targets.",
            details={"missing_fields": missing},
            status=409,
        )

    targets = calculate_targets(user.profile)
    start_date = end_date - timedelta(days=days - 1)

    # 1. Single aggregate query for foods
    food_rows = (
        db.session.query(
            FoodLog.log_date,
            db.func.sum(FoodLog.kcal).label("kcal"),
            db.func.sum(FoodLog.protein_g).label("protein_g"),
            db.func.sum(FoodLog.carbs_g).label("carbs_g"),
            db.func.sum(FoodLog.fat_g).label("fat_g"),
            db.func.sum(FoodLog.fibre_g).label("fibre_g"),
        )
        .filter(
            FoodLog.user_id == user_id,
            FoodLog.log_date >= start_date,
            FoodLog.log_date <= end_date,
        )
        .group_by(FoodLog.log_date)
        .all()
    )

    food_by_date = {
        row.log_date: {
            "kcal": float(row.kcal or 0),
            "protein_g": float(row.protein_g or 0),
            "carbs_g": float(row.carbs_g or 0),
            "fat_g": float(row.fat_g or 0),
            "fibre_g": float(row.fibre_g or 0),
        }
        for row in food_rows
    }

    # 2. Single aggregate query for water
    water_rows = (
        db.session.query(
            WaterLog.log_date,
            db.func.sum(WaterLog.amount_ml).label("water_ml"),
        )
        .filter(
            WaterLog.user_id == user_id,
            WaterLog.log_date >= start_date,
            WaterLog.log_date <= end_date,
        )
        .group_by(WaterLog.log_date)
        .all()
    )

    water_by_date = {row.log_date: int(row.water_ml or 0) for row in water_rows}

    # Build contiguous zero-filled range
    day_list = []
    total_kcal = 0.0
    total_protein = 0.0
    total_carbs = 0.0
    total_fat = 0.0
    total_fibre = 0.0
    total_water = 0
    days_logged_count = 0

    curr = start_date
    while curr <= end_date:
        f_data = food_by_date.get(curr, {})
        w_ml = water_by_date.get(curr, 0)

        kc = round(f_data.get("kcal", 0.0), 1)
        p = round(f_data.get("protein_g", 0.0), 1)
        c = round(f_data.get("carbs_g", 0.0), 1)
        f = round(f_data.get("fat_g", 0.0), 1)
        fib = round(f_data.get("fibre_g", 0.0), 1)

        is_logged = (curr in food_by_date) or (curr in water_by_date)
        if is_logged:
            days_logged_count += 1

        total_kcal += kc
        total_protein += p
        total_carbs += c
        total_fat += f
        total_fibre += fib
        total_water += w_ml

        day_list.append(
            {
                "date": curr.isoformat(),
                "label": curr.strftime("%a"),
                "kcal": kc,
                "target_kcal": targets["kcal"],
                "protein_g": p,
                "carbs_g": c,
                "fat_g": f,
                "fibre_g": fib,
                "water_ml": w_ml,
                "water_goal_ml": targets["water_ml"],
                "logged": is_logged,
            }
        )
        curr += timedelta(days=1)

    num_days = len(day_list) or 1
    averages = {
        "kcal": round(total_kcal / num_days, 1),
        "protein_g": round(total_protein / num_days, 1),
        "carbs_g": round(total_carbs / num_days, 1),
        "fat_g": round(total_fat / num_days, 1),
        "fibre_g": round(total_fibre / num_days, 1),
        "water_ml": round(total_water / num_days, 1),
    }

    return jsonify(
        {
            "start": start_date.isoformat(),
            "end": end_date.isoformat(),
            "days": day_list,
            "averages": averages,
            "days_logged": days_logged_count,
        }
    ), 200
