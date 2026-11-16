"""Tests for foods REST API endpoints and health checks."""
import pytest


def test_health_endpoints(client):
    # Root /health
    resp1 = client.get("/health")
    assert resp1.status_code == 200
    assert resp1.get_json() == {"status": "ok"}

    # Blueprint /api/v1/health
    resp2 = client.get("/api/v1/health")
    assert resp2.status_code == 200
    assert resp2.get_json() == {"status": "ok"}


def test_list_categories(client):
    resp = client.get("/api/v1/foods/categories")
    assert resp.status_code == 200
    cats = resp.get_json()["categories"]
    assert len(cats) >= 3
    slugs = [c["slug"] for c in cats]
    assert "dairy" in slugs
    assert "tiffin" in slugs or "dals" in slugs


def test_food_detail(client, app):
    with app.app_context():
        from app.models.food import Food
        food = Food.query.first()
        food_id = food.id

    resp = client.get(f"/api/v1/foods/{food_id}")
    assert resp.status_code == 200
    data = resp.get_json()
    assert data["id"] == food_id
    assert "kcal_per_100g" in data
    assert "portions" in data
    assert "allergens" in data
    assert "tags" in data
    assert "data_notice" in data


def test_food_detail_not_found(client):
    resp = client.get("/api/v1/foods/999999")
    assert resp.status_code == 404
    data = resp.get_json()
    assert "error" in data
    assert data["error"]["code"] == "not_found"


def test_foods_warnings_with_and_without_jwt(client, auth_headers):
    # 1. Unauthenticated request -> warnings empty
    resp_anon = client.get("/api/v1/foods?q=paneer")
    assert resp_anon.status_code == 200
    foods_anon = resp_anon.get_json()["foods"]
    assert len(foods_anon) >= 1
    assert foods_anon[0]["warnings"] == []

    # 2. Update user profile to be vegan (paneer is veg/dairy -> warning)
    patch_resp = client.patch(
        "/api/v1/auth/me",
        json={"diet_type": "vegan"},
        headers=auth_headers,
    )
    assert patch_resp.status_code == 200

    # 3. Authenticated request -> warnings populated
    resp_auth = client.get("/api/v1/foods?q=paneer", headers=auth_headers)
    assert resp_auth.status_code == 200
    foods_auth = resp_auth.get_json()["foods"]
    assert len(foods_auth) >= 1
    paneer = next(f for f in foods_auth if f["name_en"] == "Paneer")
    assert len(paneer["warnings"]) >= 1
    assert paneer["warnings"][0]["kind"] == "diet"


def test_recent_foods_authenticated(client, auth_headers, app):
    with app.app_context():
        from app.models.food import Food
        f = Food.query.first()
        food_id = f.id

    # Create a log entry
    client.post(
        "/api/v1/logs",
        json={
            "food_id": food_id,
            "meal": "lunch",
            "log_date": "2026-11-16",
            "quantity": 1,
        },
        headers=auth_headers,
    )

    resp = client.get("/api/v1/foods/recent", headers=auth_headers)
    assert resp.status_code == 200
    recent = resp.get_json()["foods"]
    assert len(recent) >= 1
    assert recent[0]["id"] == food_id


def test_delete_my_data_endpoint(client, auth_headers, app):
    with app.app_context():
        from app.models.food import Food
        food_id = Food.query.first().id

    # Log food
    client.post(
        "/api/v1/logs",
        json={
            "food_id": food_id,
            "meal": "breakfast",
            "log_date": "2026-11-16",
            "quantity": 1,
        },
        headers=auth_headers,
    )

    # Call DELETE /api/v1/me/data
    del_resp = client.delete("/api/v1/me/data", headers=auth_headers)
    assert del_resp.status_code == 200

    # Verify logs for this day are empty
    list_resp = client.get("/api/v1/logs?date=2026-11-16", headers=auth_headers)
    assert list_resp.status_code == 200
    assert list_resp.get_json()["total_entries"] == 0
