from unittest.mock import patch
from app.services.weather_service import (
    calculate_weather_hydration_guidance,
    get_weather_food_suggestions,
)


def test_weather_hydration_guidance():
    # Mild day -> no adjustment
    mild = calculate_weather_hydration_guidance(temperature=22.0, humidity=45.0, baseline_water_ml=2500)
    assert mild["weather_adjustment_ml"] == 0
    assert mild["suggested_total_ml"] == 2500

    # Hot day (36°C) -> +500 ml
    hot = calculate_weather_hydration_guidance(temperature=36.0, humidity=50.0, baseline_water_ml=2400)
    assert hot["weather_adjustment_ml"] == 500
    assert hot["suggested_total_ml"] == 2900

    # Hot & humid day (31°C, 75%) -> +250 + +250 = +500 ml
    hot_humid = calculate_weather_hydration_guidance(temperature=31.0, humidity=75.0, baseline_water_ml=2000)
    assert hot_humid["weather_adjustment_ml"] == 500
    assert hot_humid["suggested_total_ml"] == 2500


def test_weather_food_suggestions(app):
    # Hot day -> cooling, hydrating foods
    suggs = get_weather_food_suggestions(temperature=34.0, humidity=50.0, user_diet="veg")
    assert len(suggs) > 0
    for s in suggs:
        assert s["diet"] in ["vegan", "veg"]


def test_weather_api_endpoints(client):
    mock_open_meteo = {
        "current": {
            "temperature_2m": 33.5,
            "relative_humidity_2m": 60.0,
            "apparent_temperature": 36.2,
            "weather_code": 1,
        }
    }

    with patch("app.services.weather_service.fetch_open_meteo", return_value=mock_open_meteo) as mock_fetch:
        # First call fetches and caches
        res = client.get("/api/v1/weather/current?lat=18.5204&lon=73.8567")
        assert res.status_code == 200
        data = res.get_json()
        assert data["temperature"] == 33.5
        assert data["condition_text"] == "Mainly clear"
        assert mock_fetch.call_count == 1

        # Second call hits cache (mock_fetch not called again)
        res2 = client.get("/api/v1/weather/current?lat=18.5204&lon=73.8567")
        assert res2.status_code == 200
        assert mock_fetch.call_count == 1

        # Recommendations endpoint
        rec_res = client.get("/api/v1/weather/recommendations?lat=18.5204&lon=73.8567")
        assert rec_res.status_code == 200
        rec_data = rec_res.get_json()
        assert "weather" in rec_data
        assert "hydration" in rec_data
        assert "food_suggestions" in rec_data
