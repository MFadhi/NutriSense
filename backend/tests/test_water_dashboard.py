import pytest
from datetime import date, datetime, timezone
from decimal import Decimal
from app.extensions import db
from app.models.user import User, UserProfile
from app.models.water import WaterLog
from app.models.food import Food, FoodCategory
from app.models.log import FoodLog


@pytest.fixture
def user_with_profile(client):
    """User with a complete profile for target calculations."""
    user = User(email="active_user@example.com")
    user.set_password("SecurePass123!")
    profile = UserProfile(
        age=30,
        gender="male",
        height_cm=Decimal("175.0"),
        weight_kg=Decimal("70.0"),
        activity_level="moderate",
        goal="maintain",
    )
    user.profile = profile
    db.session.add(user)
    db.session.commit()

    # Login to get token
    res = client.post(
        "/api/v1/auth/login",
        json={"email": "active_user@example.com", "password": "SecurePass123!"},
    )
    token = res.get_json()["access_token"]
    return user, token


@pytest.fixture
def incomplete_user(client):
    """User without complete profile fields."""
    user = User(email="incomplete@example.com")
    user.set_password("SecurePass123!")
    profile = UserProfile(age=None, gender="male", height_cm=None, weight_kg=None)
    user.profile = profile
    db.session.add(user)
    db.session.commit()

    res = client.post(
        "/api/v1/auth/login",
        json={"email": "incomplete@example.com", "password": "SecurePass123!"},
    )
    token = res.get_json()["access_token"]
    return user, token


def test_water_logging_and_validation(client, user_with_profile):
    _, token = user_with_profile
    headers = {"Authorization": f"Bearer {token}"}

    # Invalid amount (< 1)
    res = client.post(
        "/api/v1/water",
        json={"amount_ml": 0, "log_date": "2026-03-30"},
        headers=headers,
    )
    assert res.status_code == 422
    assert res.get_json()["error"]["code"] == "validation_error"

    # Invalid amount (> 2000)
    res = client.post(
        "/api/v1/water",
        json={"amount_ml": 2500, "log_date": "2026-03-30"},
        headers=headers,
    )
    assert res.status_code == 422

    # Invalid date format
    res = client.post(
        "/api/v1/water",
        json={"amount_ml": 250, "log_date": "30-03-2026"},
        headers=headers,
    )
    assert res.status_code == 422

    # Valid post
    res = client.post(
        "/api/v1/water",
        json={"amount_ml": 250, "log_date": "2026-03-30"},
        headers=headers,
    )
    assert res.status_code == 201
    entry = res.get_json()["water_log"]
    assert entry["amount_ml"] == 250
    assert entry["log_date"] == "2026-03-30"

    # Second entry
    res = client.post(
        "/api/v1/water",
        json={"amount_ml": 500, "log_date": "2026-03-30"},
        headers=headers,
    )
    assert res.status_code == 201

    # Get water for date
    res = client.get("/api/v1/water?date=2026-03-30", headers=headers)
    assert res.status_code == 200
    data = res.get_json()
    assert data["date"] == "2026-03-30"
    assert data["total_ml"] == 750
    assert data["glasses"] == 3.0
    assert len(data["entries"]) == 2


def test_water_delete_isolation(client, user_with_profile, app):
    user1, token1 = user_with_profile

    # Create user 2
    user2 = User(email="other_user@example.com")
    user2.set_password("SecurePass123!")
    db.session.add(user2)
    db.session.commit()
    res2 = client.post(
        "/api/v1/auth/login",
        json={"email": "other_user@example.com", "password": "SecurePass123!"},
    )
    token2 = res2.get_json()["access_token"]

    # user1 logs water
    post_res = client.post(
        "/api/v1/water",
        json={"amount_ml": 300, "log_date": "2026-03-30"},
        headers={"Authorization": f"Bearer {token1}"},
    )
    water_id = post_res.get_json()["water_log"]["id"]

    # user2 tries to delete user1's water entry -> 404 (not 403)
    del_res = client.delete(
        f"/api/v1/water/{water_id}",
        headers={"Authorization": f"Bearer {token2}"},
    )
    assert del_res.status_code == 404
    assert del_res.get_json()["error"]["code"] == "not_found"

    # user1 deletes own entry -> 200
    del_res2 = client.delete(
        f"/api/v1/water/{water_id}",
        headers={"Authorization": f"Bearer {token1}"},
    )
    assert del_res2.status_code == 200

    # Delete again -> 404
    del_res3 = client.delete(
        f"/api/v1/water/{water_id}",
        headers={"Authorization": f"Bearer {token1}"},
    )
    assert del_res3.status_code == 404


def test_dashboard_incomplete_profile(client, incomplete_user):
    _, token = incomplete_user
    headers = {"Authorization": f"Bearer {token}"}

    res_daily = client.get("/api/v1/dashboard/daily?date=2026-03-30", headers=headers)
    assert res_daily.status_code == 409
    assert res_daily.get_json()["error"]["code"] == "profile_incomplete"

    res_weekly = client.get("/api/v1/dashboard/weekly?end=2026-03-30&days=7", headers=headers)
    assert res_weekly.status_code == 409
    assert res_weekly.get_json()["error"]["code"] == "profile_incomplete"


def test_dashboard_daily_summary(client, user_with_profile):
    user, token = user_with_profile
    headers = {"Authorization": f"Bearer {token}"}

    # Create category & food
    cat = FoodCategory(slug="dairy_dash", label_en="Dairy")
    food = Food(
        name_en="Paneer",
        category=cat,
        diet="veg",
        kcal_per_100g=Decimal("265.0"),
        protein_per_100g=Decimal("18.3"),
        carbs_per_100g=Decimal("1.2"),
        fat_per_100g=Decimal("20.8"),
        fibre_per_100g=Decimal("0.0"),
    )
    db.session.add_all([cat, food])
    db.session.commit()

    # Log 100g Paneer for lunch on 2026-03-30
    log1 = FoodLog(
        user_id=user.id,
        food_id=food.id,
        food_name="Paneer",
        meal="lunch",
        logged_at=datetime.now(timezone.utc),
        log_date=date(2026, 3, 30),
        quantity=Decimal("1.0"),
        portion_label="100g",
        portion_grams=Decimal("100.0"),
        kcal=Decimal("265.0"),
        protein_g=Decimal("18.3"),
        carbs_g=Decimal("1.2"),
        fat_g=Decimal("20.8"),
        fibre_g=Decimal("0.0"),
    )
    db.session.add(log1)

    # Log water 500ml on 2026-03-30
    w_log = WaterLog(
        user_id=user.id,
        log_date=date(2026, 3, 30),
        amount_ml=500,
    )
    db.session.add(w_log)
    db.session.commit()

    res = client.get("/api/v1/dashboard/daily?date=2026-03-30", headers=headers)
    assert res.status_code == 200
    data = res.get_json()

    assert data["date"] == "2026-03-30"
    # User anchor targets: male, 30y, 175cm, 70kg, moderate, maintain -> kcal 2556, water 2450
    assert data["targets"]["kcal"] == 2556
    assert data["targets"]["water_ml"] == 2450

    # Consumed
    assert data["consumed"]["kcal"] == 265.0
    assert data["consumed"]["protein_g"] == 18.3
    assert data["consumed"]["carbs_g"] == 1.2
    assert data["consumed"]["fat_g"] == 20.8
    assert data["consumed"]["fibre_g"] == 0.0

    # Remaining
    assert data["remaining"]["kcal"] == 2556 - 265.0

    # Meals
    assert data["meals"]["lunch"]["kcal"] == 265.0
    assert len(data["meals"]["lunch"]["entries"]) == 1
    assert data["meals"]["breakfast"]["kcal"] == 0.0

    # Water
    assert data["water"]["ml"] == 500
    assert data["water"]["goal_ml"] == 2450
    assert data["water"]["glasses"] == 2.0


def test_dashboard_weekly_summary(client, user_with_profile):
    user, token = user_with_profile
    headers = {"Authorization": f"Bearer {token}"}

    # Log food and water on 2026-03-29 and 2026-03-30
    log_prev = FoodLog(
        user_id=user.id,
        food_name="Apple",
        meal="snack",
        logged_at=datetime.now(timezone.utc),
        log_date=date(2026, 3, 29),
        quantity=Decimal("1.0"),
        portion_label="1 fruit",
        portion_grams=Decimal("150.0"),
        kcal=Decimal("78.0"),
        protein_g=Decimal("0.4"),
        carbs_g=Decimal("20.7"),
        fat_g=Decimal("0.3"),
        fibre_g=Decimal("3.6"),
    )
    w_log_prev = WaterLog(
        user_id=user.id,
        log_date=date(2026, 3, 29),
        amount_ml=1000,
    )
    db.session.add_all([log_prev, w_log_prev])
    db.session.commit()

    res = client.get("/api/v1/dashboard/weekly?end=2026-03-30&days=7", headers=headers)
    assert res.status_code == 200
    data = res.get_json()

    assert data["start"] == "2026-03-24"
    assert data["end"] == "2026-03-30"
    assert len(data["days"]) == 7
    # 2026-03-29 is logged
    day_29 = next(d for d in data["days"] if d["date"] == "2026-03-29")
    assert day_29["logged"] is True
    assert day_29["kcal"] == 78.0
    assert day_29["water_ml"] == 1000

    # Zero-filled day
    day_24 = next(d for d in data["days"] if d["date"] == "2026-03-24")
    assert day_24["logged"] is False
    assert day_24["kcal"] == 0.0
    assert day_24["water_ml"] == 0

    assert data["days_logged"] >= 1
    assert "averages" in data
