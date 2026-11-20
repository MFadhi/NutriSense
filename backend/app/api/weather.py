from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity

from ..models import UserProfile
from ..services.weather_service import (
    get_or_fetch_weather,
    calculate_weather_hydration_guidance,
    get_weather_food_suggestions,
)
from ..services.targets import calculate_targets

weather_bp = Blueprint("weather", __name__)


@weather_bp.route("/weather/current", methods=["GET"])
def get_current_weather():
    """
    Returns current weather data. Does not strictly require authentication so the app
    or widgets can display public weather safely.
    """
    try:
        lat = float(request.args.get("lat", 18.5204))  # Default Pune, India
        lon = float(request.args.get("lon", 73.8567))
    except (ValueError, TypeError):
        return jsonify({
            "error": {
                "code": "invalid_coordinates",
                "message": "Latitude and longitude must be valid floating point numbers.",
                "details": {},
            }
        }), 400

    city = request.args.get("city")
    data = get_or_fetch_weather(lat, lon, city)
    return jsonify(data), 200


@weather_bp.route("/weather/recommendations", methods=["GET"])
@jwt_required(optional=True)
def get_weather_recommendations():
    """
    Combines weather conditions with the user's hydration targets and dietary preferences
    to produce personalized weather-aware nutrition and fluid recommendations.
    """
    try:
        lat = float(request.args.get("lat", 18.5204))
        lon = float(request.args.get("lon", 73.8567))
    except (ValueError, TypeError):
        return jsonify({
            "error": {
                "code": "invalid_coordinates",
                "message": "Latitude and longitude must be valid floating point numbers.",
                "details": {},
            }
        }), 400

    city = request.args.get("city")
    weather = get_or_fetch_weather(lat, lon, city)

    temp = weather.get("temperature", 25.0)
    humidity = weather.get("humidity", 50.0)

    # Defaults
    baseline_water_ml = 2500
    user_diet = None
    user_allergens = []

    user_id = get_jwt_identity()
    if user_id:
        profile = UserProfile.query.filter_by(user_id=int(user_id)).first()
        if profile:
            user_diet = profile.diet_type
            user_allergens = profile.allergies or []
            if profile.weight_kg and profile.height_cm and profile.age:
                try:
                    t = calculate_targets(profile)
                    baseline_water_ml = t.get("water_ml", 2500)
                except Exception:
                    pass

    hydration = calculate_weather_hydration_guidance(
        temperature=temp,
        humidity=humidity,
        baseline_water_ml=baseline_water_ml,
    )

    food_suggestions = get_weather_food_suggestions(
        temperature=temp,
        humidity=humidity,
        user_diet=user_diet,
        user_allergens=user_allergens,
        limit=6,
    )

    return jsonify({
        "weather": weather,
        "hydration": hydration,
        "food_suggestions": food_suggestions,
    }), 200
