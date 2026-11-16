import json
import pytest
from unittest.mock import patch, MagicMock
from decimal import Decimal
from datetime import datetime, timedelta, timezone
import urllib.error

from app.extensions import db
from app.models.user import User, UserProfile
from app.models.food import Food, Portion
from app.models.cache import ExternalProductCache
from app.models.log import FoodLog
from app.services.barcode import (
    validate_gs1_barcode,
    map_off_allergens,
    map_off_diet,
    parse_off_nutriments,
)


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


# ---------------------------------------------------------------------------
# 1. GS1 Check Digit Validation Unit Tests
# ---------------------------------------------------------------------------
def test_gs1_barcode_validation():
    # Valid EAN-13
    assert validate_gs1_barcode("7350053850019") is True
    # Valid EAN-8
    assert validate_gs1_barcode("96385074") is True
    # Valid UPC-A (12 digits)
    assert validate_gs1_barcode("036000291452") is True

    # Bad check digit
    assert validate_gs1_barcode("7350053850018") is False
    assert validate_gs1_barcode("96385070") is False
    assert validate_gs1_barcode("036000291450") is False

    # Invalid lengths or characters
    assert validate_gs1_barcode("1234567") is False
    assert validate_gs1_barcode("1234567890") is False
    assert validate_gs1_barcode("abcdefghijklm") is False
    assert validate_gs1_barcode("") is False


# ---------------------------------------------------------------------------
# 2. Nutrient and Allergen Parsing Unit Tests
# ---------------------------------------------------------------------------
def test_off_nutrient_and_allergen_mapping():
    # Allergens mapping
    raw_allergens = ["en:peanuts", "en:soybeans", "en:gluten", "unknown:something"]
    mapped = map_off_allergens(raw_allergens)
    assert mapped == ["gluten", "peanut", "soy"]

    # Diet mapping
    assert map_off_diet(["en:vegan", "en:palm-oil-free"]) == ("vegan", True)
    assert map_off_diet(["en:vegetarian"]) == ("veg", True)
    assert map_off_diet(["en:non-vegetarian"]) == ("nonveg", True)
    assert map_off_diet([]) == ("veg", False)

    # Nutrients with kJ conversion
    nutriments = {
        "energy-kj_100g": 1046,  # 1046 / 4.184 = 250 kcal
        "proteins_100g": 10.0,
        "carbohydrates_100g": 30.0,
        "fat_100g": 5.0,
        "fiber_100g": 2.5,
    }
    per_100g, missing = parse_off_nutriments(nutriments)
    assert per_100g["kcal"] == 250.0
    assert per_100g["protein"] == 10.0
    assert per_100g["carbs"] == 30.0
    assert per_100g["fat"] == 5.0
    assert per_100g["fibre"] == 2.5
    assert missing == []

    # Missing nutrients
    partial_nutriments = {"proteins_100g": 5.0}
    per_100g_p, missing_p = parse_off_nutriments(partial_nutriments)
    assert "kcal" in missing_p
    assert "carbs" in missing_p
    assert "fat" in missing_p
    assert "fibre" in missing_p


# ---------------------------------------------------------------------------
# 3. Barcode API & Local-First Lookup
# ---------------------------------------------------------------------------
def test_barcode_invalid_request(client, user1):
    _, token = user1
    headers = {"Authorization": f"Bearer {token}"}

    # Invalid barcode
    res = client.get("/api/v1/barcodes/123456", headers=headers)
    assert res.status_code == 400
    assert res.get_json()["error"]["code"] == "invalid_barcode"


def test_barcode_local_first(client, user1, user2):
    u1, token1 = user1
    u2, token2 = user2

    # User 1 creates custom food with barcode 7350053850019
    food1 = Food(
        name_en="User 1 Granola",
        diet="vegan",
        kcal_per_100g=Decimal("450.0"),
        protein_per_100g=Decimal("12.0"),
        carbs_per_100g=Decimal("60.0"),
        fat_per_100g=Decimal("15.0"),
        fibre_per_100g=Decimal("8.0"),
        barcode="7350053850019",
        owner_user_id=u1.id,
        is_sample=False,
    )
    food1.portions.append(Portion(label="1 bowl", grams=Decimal("50.0"), is_default=True))
    db.session.add(food1)
    db.session.commit()

    # User 1 queries barcode -> finds local food with source="user"
    res1 = client.get("/api/v1/barcodes/7350053850019", headers={"Authorization": f"Bearer {token1}"})
    assert res1.status_code == 200
    data1 = res1.get_json()
    assert data1["source"] == "user"
    assert data1["draft"]["name_en"] == "User 1 Granola"
    assert data1["attribution"] == "User custom food"

    # User 2 queries same barcode -> not found locally, tries OFF
    with patch("urllib.request.urlopen") as mock_url:
        mock_resp = MagicMock()
        mock_resp.getcode.return_value = 200
        mock_resp.read.return_value = json.dumps({"status": 0}).encode("utf-8")
        mock_url.return_value.__enter__.return_value = mock_resp

        res2 = client.get("/api/v1/barcodes/7350053850019", headers={"Authorization": f"Bearer {token2}"})
        # Should not leak User 1's food! Returns 404 from OFF
        assert res2.status_code == 404
        assert res2.get_json()["error"]["code"] == "product_not_found"


# ---------------------------------------------------------------------------
# 4. Open Food Facts Lookup with Caching and Errors
# ---------------------------------------------------------------------------
def test_off_caching_and_negative_cache(client, user1):
    _, token = user1
    headers = {"Authorization": f"Bearer {token}"}
    barcode = "96385074"  # valid EAN-8

    # 1. Cache Miss -> OFF returns found product
    off_payload = {
        "status": 1,
        "product": {
            "product_name_en": "Organic Oat Milk",
            "brands": "OatBrand",
            "quantity": "1 L",
            "serving_size": "200 ml",
            "serving_quantity": 200,
            "nutriments": {
                "energy-kcal_100g": 45,
                "proteins_100g": 1.0,
                "carbohydrates_100g": 6.5,
                "fat_100g": 1.5,
                "fiber_100g": 0.8,
            },
            "allergens_tags": ["en:gluten"],
            "traces_tags": ["en:nuts"],
            "ingredients_analysis_tags": ["en:vegan"],
        },
    }

    with patch("urllib.request.urlopen") as mock_url:
        mock_resp = MagicMock()
        mock_resp.getcode.return_value = 200
        mock_resp.read.return_value = json.dumps(off_payload).encode("utf-8")
        mock_url.return_value.__enter__.return_value = mock_resp

        res = client.get(f"/api/v1/barcodes/{barcode}", headers=headers)
        assert res.status_code == 200
        data = res.get_json()
        assert data["cached"] is False
        assert data["source"] == "openfoodfacts"
        assert data["draft"]["name_en"] == "Organic Oat Milk"
        assert data["draft"]["diet"] == "vegan"
        assert data["draft"]["diet_verified"] is True
        assert data["draft"]["allergens"] == ["gluten"]
        assert data["draft"]["traces"] == ["tree_nut"]
        assert len(data["draft"]["portions"]) == 2  # 200g serving + 100g

    # 2. Cache Hit -> Should not call urlopen again
    with patch("urllib.request.urlopen") as mock_url:
        res_cached = client.get(f"/api/v1/barcodes/{barcode}", headers=headers)
        assert res_cached.status_code == 200
        data_cached = res_cached.get_json()
        assert data_cached["cached"] is True
        mock_url.assert_not_called()

    # 3. Negative Caching (status: 0)
    barcode_unknown = "036000291452"
    with patch("urllib.request.urlopen") as mock_url:
        mock_resp = MagicMock()
        mock_resp.getcode.return_value = 200
        mock_resp.read.return_value = json.dumps({"status": 0}).encode("utf-8")
        mock_url.return_value.__enter__.return_value = mock_resp

        res_neg = client.get(f"/api/v1/barcodes/{barcode_unknown}", headers=headers)
        assert res_neg.status_code == 404
        assert res_neg.get_json()["error"]["code"] == "product_not_found"

    # Second request to unknown barcode should hit negative cache directly
    with patch("urllib.request.urlopen") as mock_url:
        res_neg2 = client.get(f"/api/v1/barcodes/{barcode_unknown}", headers=headers)
        assert res_neg2.status_code == 404
        mock_url.assert_not_called()


def test_off_upstream_unavailable(client, user1):
    _, token = user1
    headers = {"Authorization": f"Bearer {token}"}
    barcode = "7350053850019"

    # Ensure not cached
    cached = db.session.get(ExternalProductCache, barcode)
    if cached:
        db.session.delete(cached)
        db.session.commit()

    with patch("urllib.request.urlopen", side_effect=TimeoutError("Request timed out")):
        res = client.get(f"/api/v1/barcodes/{barcode}", headers=headers)
        assert res.status_code == 503
        assert res.headers.get("Retry-After") == "30"
        assert res.get_json()["error"]["code"] == "upstream_unavailable"


# ---------------------------------------------------------------------------
# 5. Custom Foods CRUD and Permissions
# ---------------------------------------------------------------------------
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
        "barcode": "7350053850019",
    }
    create_res = client.post("/api/v1/foods/custom", json=create_payload, headers=headers1)
    assert create_res.status_code == 201
    created_food = create_res.get_json()["food"]
    food_id = created_food["id"]
    assert created_food["owner_user_id"] == u1.id
    assert created_food["name_en"] == "Homemade Protein Bar"
    assert created_food["is_sample"] is False

    # 3. Barcode duplicate conflict for same user
    dup_res = client.post("/api/v1/foods/custom", json=create_payload, headers=headers1)
    assert dup_res.status_code == 409
    assert dup_res.get_json()["error"]["code"] == "conflict"

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


def test_production_config_validation(monkeypatch):
    from app import create_app

    # Placeholder user-agent should raise ValueError in production mode
    monkeypatch.setenv("OFF_USER_AGENT", "NutriLens/0.1 (user@nutrilens.app)")
    with pytest.raises(ValueError):
        create_app("production")

    # Real contact email should succeed
    monkeypatch.setenv("OFF_USER_AGENT", "NutriLens/1.0 (contact@nutriproject.org)")
    prod_app = create_app("production")
    assert prod_app is not None
