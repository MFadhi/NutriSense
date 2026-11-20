import urllib.request
import urllib.parse
import json
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, Optional, List
from ..extensions import db
from ..models import WeatherCache, Food

WMO_WEATHER_CODES = {
    0: "Clear sky",
    1: "Mainly clear",
    2: "Partly cloudy",
    3: "Overcast",
    45: "Foggy",
    48: "Depositing rime fog",
    51: "Light drizzle",
    53: "Moderate drizzle",
    55: "Dense drizzle",
    61: "Slight rain",
    63: "Moderate rain",
    65: "Heavy rain",
    71: "Slight snow",
    73: "Moderate snow",
    75: "Heavy snow",
    80: "Slight rain showers",
    81: "Moderate rain showers",
    82: "Violent rain showers",
    95: "Thunderstorm",
    96: "Thunderstorm with slight hail",
    99: "Thunderstorm with heavy hail",
}


def weather_code_to_text(code: Optional[int]) -> str:
    if code is None:
        return "Unknown"
    return WMO_WEATHER_CODES.get(code, "Variable")


def fetch_open_meteo(lat: float, lon: float, timeout_s: float = 4.0) -> dict:
    """
    Calls Open-Meteo API. Returns parsed current weather JSON or raises Exception.
    """
    params = {
        "latitude": round(lat, 4),
        "longitude": round(lon, 4),
        "current": "temperature_2m,relative_humidity_2m,apparent_temperature,weather_code",
    }
    url = f"https://api.open-meteo.com/v1/forecast?{urllib.parse.urlencode(params)}"
    req = urllib.request.Request(url, headers={"User-Agent": "NutriSense/1.0"})
    with urllib.request.urlopen(req, timeout=timeout_s) as resp:
        if resp.status != 200:
            raise RuntimeError(f"Open-Meteo returned status {resp.status}")
        return json.loads(resp.read().decode("utf-8"))


def get_or_fetch_weather(lat: float, lon: float, city: Optional[str] = None) -> dict:
    """
    Fetches weather with a 30-minute DB cache. Returns weather dict.
    """
    now = datetime.now(timezone.utc)
    # Check cache within ~0.05 degrees (approx 5km) and not expired
    cached = (
        WeatherCache.query.filter(
            WeatherCache.latitude.between(lat - 0.05, lat + 0.05),
            WeatherCache.longitude.between(lon - 0.05, lon + 0.05),
            WeatherCache.expires_at > now,
        )
        .order_by(WeatherCache.fetched_at.desc())
        .first()
    )

    if cached:
        return cached.to_dict()

    # Try live fetch
    try:
        data = fetch_open_meteo(lat, lon)
        current = data.get("current", {})
        temp = float(current.get("temperature_2m", 25.0))
        humidity = float(current.get("relative_humidity_2m", 50.0))
        apparent_temp = current.get("apparent_temperature")
        if apparent_temp is not None:
            apparent_temp = float(apparent_temp)
        wcode = current.get("weather_code")
        cond_text = weather_code_to_text(wcode)

        # Store in cache
        expires = now + timedelta(minutes=30)
        cache_entry = WeatherCache(
            latitude=lat,
            longitude=lon,
            city=city or "Current Location",
            temperature=temp,
            humidity=humidity,
            apparent_temperature=apparent_temp,
            weather_code=wcode,
            condition_text=cond_text,
            fetched_at=now,
            expires_at=expires,
        )
        db.session.add(cache_entry)
        db.session.commit()
        return cache_entry.to_dict()

    except Exception:
        # Fallback to expired cache if available
        stale = (
            WeatherCache.query.filter(
                WeatherCache.latitude.between(lat - 0.1, lat + 0.1),
                WeatherCache.longitude.between(lon - 0.1, lon + 0.1),
            )
            .order_by(WeatherCache.fetched_at.desc())
            .first()
        )
        if stale:
            d = stale.to_dict()
            d["is_stale"] = True
            return d

        # Graceful default weather
        return {
            "latitude": lat,
            "longitude": lon,
            "city": city or "Local Weather",
            "temperature": 27.0,
            "humidity": 55.0,
            "apparent_temperature": 28.0,
            "weather_code": 1,
            "condition_text": "Partly cloudy",
            "fetched_at": now.isoformat(),
            "expires_at": (now + timedelta(minutes=15)).isoformat(),
            "is_fallback": True,
        }


def calculate_weather_hydration_guidance(
    temperature: float,
    humidity: float,
    baseline_water_ml: int = 2500,
) -> dict:
    """
    Computes an explainable weather-aware hydration recommendation
    WITHOUT overwriting the baseline target.
    """
    adjustment_ml = 0
    reasons = []

    if temperature >= 35.0:
        adjustment_ml += 500
        reasons.append(f"High ambient temperature ({temperature:.1f}°C) significantly increases fluid loss through perspiration.")
    elif temperature >= 30.0:
        adjustment_ml += 250
        reasons.append(f"Warm weather ({temperature:.1f}°C) elevates daily hydration requirements.")

    if humidity >= 70.0 and temperature >= 28.0:
        adjustment_ml += 250
        reasons.append(f"High humidity ({humidity:.0f}%) impairs evaporative cooling, requiring regular fluid intake.")
    elif humidity <= 25.0:
        adjustment_ml += 150
        reasons.append(f"Dry air ({humidity:.0f}%) accelerates respiratory moisture loss.")

    suggested_total = baseline_water_ml + adjustment_ml

    return {
        "baseline_water_ml": baseline_water_ml,
        "weather_adjustment_ml": adjustment_ml,
        "suggested_total_ml": suggested_total,
        "temperature": temperature,
        "humidity": humidity,
        "explanation": " ".join(reasons) if reasons else "Mild weather conditions; standard daily baseline hydration is sufficient.",
    }


def get_weather_food_suggestions(
    temperature: float,
    humidity: float,
    user_diet: Optional[str] = None,
    user_allergens: Optional[List[str]] = None,
    limit: int = 6,
) -> List[dict]:
    """
    Finds foods from the database tailored to weather conditions,
    respecting user dietary choices and allergens.
    """
    target_tags = []
    if temperature >= 28.0:
        target_tags.extend(["cooling", "hydrating", "fruit", "salad", "coconut", "curd"])
    elif temperature <= 20.0:
        target_tags.extend(["warming", "comfort_food", "spiced", "soup", "hot_drink"])

    if humidity >= 65.0:
        target_tags.extend(["digestive", "light", "steamed", "fermented"])

    if not target_tags:
        target_tags = ["cooling", "hydrating", "digestive"]

    query = Food.query.filter_by(is_sample=True)

    diet_hierarchy = {
        "vegan": ["vegan"],
        "veg": ["vegan", "veg"],
        "egg": ["vegan", "veg", "egg"],
        "eggetarian": ["vegan", "veg", "egg"],
        "nonveg": ["vegan", "veg", "egg", "nonveg"],
    }
    if user_diet and user_diet.lower() in diet_hierarchy:
        allowed_diets = diet_hierarchy[user_diet.lower()]
        query = query.filter(Food.diet.in_(allowed_diets))

    foods = query.all()
    matched = []
    user_allergens_set = set(a.lower() for a in (user_allergens or []))

    for f in foods:
        f_allergens = [a.lower() for a in (f.allergens or [])]
        if any(a in user_allergens_set for a in f_allergens):
            continue

        f_tags = [t.lower() for t in (f.tags or [])]
        if any(t in f_tags for t in target_tags):
            matched.append(f.to_dict())
            if len(matched) >= limit:
                break

    # If no foods matched specific tags (e.g. minimal test suite), return safe candidates
    if not matched:
        for f in foods:
            f_allergens = [a.lower() for a in (f.allergens or [])]
            if not any(a in user_allergens_set for a in f_allergens):
                matched.append(f.to_dict())
                if len(matched) >= limit:
                    break

    return matched
