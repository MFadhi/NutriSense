import json
import pytest
from decimal import Decimal
from datetime import datetime, timezone

from app.extensions import db
from app.models.user import User, UserProfile
from app.models.food import Food, Portion
from app.models.log import FoodLog


@pytest.fixture
def user1(client):
    user = User(email="user1@example.com")
    user.set_password("SecurePass123!")
    profile = UserProfile(age=25, gender="female", height_cm=165, weight_kg=58, diet_type="veg")
    user.profile = profile
    db.session.add(user)
    db.session.commit()

    res = client.post("/api/v1/auth/login", json={"email": "user1@example.com", "password": "SecurePass123!"})
    token = res.get_json()["access_token"]
    return user, token


@pytest.fixture
def user2(client):
    user = User(email="user2@example.com")
    user.set_password("SecurePass123!")
    db.session.add(user)
    db.session.commit()

    res = client.post("/api/v1/auth/login", json={"email": "user2@example.com", "password": "SecurePass123!"})
    token = res.get_json()["access_token"]
    return user, token


def test_custom_food_crud(client, user1, user2):
    u1, token1 = user1
    u2, token2 = user2
    headers1 = {"Authorization": f"Bearer {token1}"}
    headers2 = {"Authorization": f"Bearer {token2}"}

    # 1. Validation errors on create
    bad_res = client.post("/api/v1/foods/custom", json={"name_en": ""}, headers=headers1)
    assert bad_res.status_code == 422

    # Negative nutrient
    bad_nutrient = client.post(
        "/api/v1/foods/custom",
        json={
            "name_en": "Bad Nutrients",
            "diet": "veg",
            "kcal_per_100g": -10,
            "protein_per_100g": 5,
            "carbs_per_100g": 10,
            "fat_per_100g": 2,
            "portions": [{"label": "1 serving", "grams": 100}],
        },
        headers=headers1,
    )
    assert bad_nutrient.status_code == 422

    # Sum of macros > 100g
    bad_sum = client.post(
        "/api/v1/foods/custom",
        json={
            "name_en": "Super Dense",
            "diet": "veg",
            "kcal_per_100g": 500,
            "protein_per_100g": 60,
            "carbs_per_100g": 50,
            "fat_per_100g": 10,
            "portions": [{"label": "1 serving", "grams": 100}],
        },
        headers=headers1,
    )
    assert bad_sum.status_code == 422

    # 2. Successful creation
    create_payload = {
        "name_en": "Homemade Protein Bar",
        "diet": "veg",
        "kcal_per_100g": 380.0,
        "protein_per_100g": 25.0,
        "carbs_per_100g": 40.0,
        "fat_per_100g": 10.0,
        "fibre_per_100g": 8.0,
        "allergens": ["peanut", "milk"],
        "portions": [
            {"label": "1 bar", "grams": 60.0, "default": True},
            {"label": "100g", "grams": 100.0, "default": False},
        ],
    }
    create_res = client.post("/api/v1/foods/custom", json=create_payload, headers=headers1)
    assert create_res.status_code == 201
    created_food = create_res.get_json()["food"]
    food_id = created_food["id"]
    assert created_food["owner_user_id"] == u1.id
    assert created_food["name_en"] == "Homemade Protein Bar"
    assert created_food["is_sample"] is False

    # 3. Duplicate conflict for same food
    dup_res = client.post("/api/v1/foods/custom", json={**create_payload, "barcode": "12345"}, headers=headers1)
    assert dup_res.status_code == 201
    dup_res2 = client.post("/api/v1/foods/custom", json={**create_payload, "barcode": "12345"}, headers=headers1)
    assert dup_res2.status_code == 409

    # 4. Search visibility & isolation
    # User 1 searches and finds it
    search_res1 = client.get("/api/v1/foods?q=homemade", headers=headers1)
    assert any(f["id"] == food_id for f in search_res1.get_json()["foods"])

    # User 2 searches and CANNOT find it
    search_res2 = client.get("/api/v1/foods?q=homemade", headers=headers2)
    assert not any(f["id"] == food_id for f in search_res2.get_json()["foods"])

    # 5. Detail visibility & isolation
    # User 1 gets detail -> 200
    detail_res1 = client.get(f"/api/v1/foods/{food_id}", headers=headers1)
    assert detail_res1.status_code == 200

    # User 2 gets detail -> 404 (isolated)
    detail_res2 = client.get(f"/api/v1/foods/{food_id}", headers=headers2)
    assert detail_res2.status_code == 404

    # 6. PATCH
    # User 2 tries to PATCH -> 404
    patch_u2 = client.patch(
        f"/api/v1/foods/custom/{food_id}",
        json={"name_en": "Hacked Name"},
        headers=headers2,
    )
    assert patch_u2.status_code == 404

    # User 1 patches -> 200
    patch_u1 = client.patch(
        f"/api/v1/foods/custom/{food_id}",
        json={"name_en": "Super Protein Bar", "diet_verified": True},
        headers=headers1,
    )
    assert patch_u1.status_code == 200
    assert patch_u1.get_json()["food"]["name_en"] == "Super Protein Bar"

    # 7. DELETE
    # User 2 tries to DELETE -> 404
    del_u2 = client.delete(f"/api/v1/foods/custom/{food_id}", headers=headers2)
    assert del_u2.status_code == 404

    # User 1 logs this food first to verify SET NULL behavior
    log_res = client.post(
        "/api/v1/logs",
        json={
            "food_id": food_id,
            "meal": "snack",
            "log_date": "2026-03-30",
            "quantity": 1,
            "portion_label": "1 bar",
        },
        headers=headers1,
    )
    assert log_res.status_code == 201
    log_id = log_res.get_json()["log"]["id"]

    # User 1 deletes own custom food -> 200
    del_u1 = client.delete(f"/api/v1/foods/custom/{food_id}", headers=headers1)
    assert del_u1.status_code == 200

    # Food is now gone
    assert client.get(f"/api/v1/foods/{food_id}", headers=headers1).status_code == 404

    # Log entry still exists, snapshot intact, food_id is SET NULL
    fl = db.session.get(FoodLog, log_id)
    assert fl is not None
    assert fl.food_id is None
    assert fl.food_name == "Super Protein Bar"
