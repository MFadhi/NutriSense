import re
from flask import Blueprint, request, jsonify
from flask_jwt_extended import (
    create_access_token,
    create_refresh_token,
    jwt_required,
    get_jwt_identity,
)
from ..extensions import db
from ..models.user import User, UserProfile
from ..errors import error_response

auth_bp = Blueprint("auth", __name__)

EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
MIN_PASSWORD_LEN = 8

VALID_DIET_TYPES = {"veg", "nonveg", "eggetarian", "vegan"}
VALID_GENDERS = {"male", "female", "other"}
VALID_ACTIVITY_LEVELS = {
    "sedentary",
    "lightly_active",
    "moderately_active",
    "very_active",
    "extra_active",
}


def _validate_email(email):
    return email and EMAIL_RE.match(email)


def _validate_password(password):
    return password and len(password) >= MIN_PASSWORD_LEN


# ---------------------------------------------------------------------------
# POST /register
# ---------------------------------------------------------------------------
@auth_bp.route("/register", methods=["POST"])
def register():
    data = request.get_json(silent=True) or {}
    email = (data.get("email") or "").strip().lower()
    password = data.get("password", "")

    if not _validate_email(email):
        return error_response(
            "validation_error", "A valid email address is required.", status=422
        )
    if not _validate_password(password):
        return error_response(
            "validation_error",
            f"Password must be at least {MIN_PASSWORD_LEN} characters.",
            status=422,
        )

    if User.query.filter_by(email=email).first():
        return error_response(
            "conflict", "An account with that email already exists.", status=409
        )

    user = User(email=email)
    user.set_password(password)
    profile = UserProfile(user=user, allergies=[], diet_type=None)
    db.session.add(user)
    db.session.add(profile)
    db.session.commit()

    return jsonify({"message": "Account created.", "user": user.to_dict()}), 201


# ---------------------------------------------------------------------------
# POST /login
# ---------------------------------------------------------------------------
@auth_bp.route("/login", methods=["POST"])
def login():
    data = request.get_json(silent=True) or {}
    email = (data.get("email") or "").strip().lower()
    password = data.get("password", "")

    user = User.query.filter_by(email=email).first()
    if not user or not user.check_password(password):
        return error_response(
            "invalid_credentials", "Invalid email or password.", status=401
        )

    access_token = create_access_token(identity=str(user.id))
    refresh_token = create_refresh_token(identity=str(user.id))
    return jsonify(
        {
            "access_token": access_token,
            "refresh_token": refresh_token,
            "user": user.to_dict(),
        }
    ), 200


# ---------------------------------------------------------------------------
# POST /refresh
# ---------------------------------------------------------------------------
@auth_bp.route("/refresh", methods=["POST"])
@jwt_required(refresh=True)
def refresh():
    user_id = get_jwt_identity()
    access_token = create_access_token(identity=user_id)
    return jsonify({"access_token": access_token}), 200


# ---------------------------------------------------------------------------
# GET /me
# ---------------------------------------------------------------------------
@auth_bp.route("/me", methods=["GET"])
@jwt_required()
def me():
    user_id = int(get_jwt_identity())
    user = db.session.get(User, user_id)
    if not user:
        return error_response("not_found", "User not found.", status=404)
    result = user.to_dict()
    result["profile"] = user.profile.to_dict() if user.profile else None
    return jsonify(result), 200


# ---------------------------------------------------------------------------
# PATCH /me  — update profile fields
# ---------------------------------------------------------------------------
@auth_bp.route("/me", methods=["PATCH"])
@jwt_required()
def update_me():
    user_id = int(get_jwt_identity())
    user = db.session.get(User, user_id)
    if not user:
        return error_response("not_found", "User not found.", status=404)

    data = request.get_json(silent=True) or {}
    profile = user.profile
    if not profile:
        profile = UserProfile(user_id=user.id, allergies=[])
        db.session.add(profile)

    # Map friendly client aliases
    if "sex" in data and "gender" not in data:
        data["gender"] = data["sex"]

    if "dob" in data and ("age" not in data or data["age"] is None) and data["dob"]:
        try:
            from datetime import date, datetime
            birth_date = datetime.strptime(str(data["dob"])[:10], "%Y-%m-%d").date()
            today = date.today()
            age_calc = today.year - birth_date.year - ((today.month, today.day) < (birth_date.month, birth_date.day))
            if 0 <= age_calc <= 150:
                data["age"] = age_calc
        except Exception:
            pass

    act_aliases = {
        "sedentary": "sedentary",
        "light": "lightly_active",
        "lightly_active": "lightly_active",
        "moderate": "moderately_active",
        "moderately_active": "moderately_active",
        "active": "very_active",
        "very_active": "very_active",
        "extra_active": "extra_active",
    }
    if "activity_level" in data and data["activity_level"] in act_aliases:
        data["activity_level"] = act_aliases[data["activity_level"]]

    allowed = {
        "diet_type", "allergies", "age", "gender",
        "height_cm", "weight_kg", "activity_level", "goal",
    }
    errors = []

    for field in allowed:
        if field not in data:
            continue
        value = data[field]

        if field == "diet_type" and value is not None:
            if value not in VALID_DIET_TYPES:
                errors.append(f"diet_type must be one of {sorted(VALID_DIET_TYPES)}.")
                continue
        if field == "gender" and value is not None:
            if value not in VALID_GENDERS:
                errors.append(f"gender must be one of {sorted(VALID_GENDERS)}.")
                continue
        if field == "activity_level" and value is not None:
            if value not in VALID_ACTIVITY_LEVELS:
                errors.append(
                    f"activity_level must be one of {sorted(VALID_ACTIVITY_LEVELS)}."
                )
                continue
        if field == "age" and value is not None:
            if not isinstance(value, int) or value < 0 or value > 150:
                errors.append("age must be an integer between 0 and 150.")
                continue
        if field in ("height_cm", "weight_kg") and value is not None:
            try:
                value = float(value)
                if value <= 0:
                    raise ValueError
            except (TypeError, ValueError):
                errors.append(f"{field} must be a positive number.")
                continue
        if field == "allergies":
            if not isinstance(value, list):
                errors.append("allergies must be a list.")
                continue
            value = [str(a).strip().lower() for a in value if str(a).strip()]

        setattr(profile, field, value)

    if errors:
        return error_response("validation_error", "; ".join(errors), status=422)

    db.session.commit()
    result = user.to_dict()
    result["profile"] = profile.to_dict()
    return jsonify(result), 200


# ---------------------------------------------------------------------------
# DELETE /me/data  — delete logs + profile (not the account itself)
# ---------------------------------------------------------------------------
@auth_bp.route("/me/data", methods=["DELETE"])
@jwt_required()
def delete_my_data():
    user_id = int(get_jwt_identity())
    user = db.session.get(User, user_id)
    if not user:
        return error_response("not_found", "User not found.", status=404)

    from ..models.log import FoodLog
    FoodLog.query.filter_by(user_id=user.id).delete()
    if user.profile:
        db.session.delete(user.profile)
    db.session.commit()
    return jsonify({"message": "All logs and profile data deleted."}), 200
