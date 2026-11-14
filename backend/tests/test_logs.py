"""Tests for food log API endpoints."""
import pytest
from datetime import date


TODAY = "2026-11-14"


def _log_payload(**kwargs):
    base = {
        "food_id": 1,
        "meal": "lunch",
        "log_date": TODAY,
        "quantity": 1,
    }
    base.update(kwargs)
    return base


# ---------------------------------------------------------------------------
# POST /logs
# ---------------------------------------------------------------------------
def test_create_log_requires_auth(client):
    resp = client.post("/api/v1/logs", json=_log_payload())
    assert resp.status_code == 401


def test_create_log_success(client, auth_headers, app):
    with app.app_context():
        from app.models.food import Food
        food = Food.query.first()
        food_id = food.id

    resp = client.post(
        "/api/v1/logs",
        json=_log_payload(food_id=food_id),
        headers=auth_headers,
    )
    assert resp.status_code == 201
    data = resp.get_json()
    assert "log" in data
    log = data["log"]
    assert log["food_id"] == food_id
    assert log["meal"] == "lunch"
    assert log["kcal"] > 0


def test_create_log_manual_entry(client, auth_headers):
    resp = client.post(
        "/api/v1/logs",
        json={
            "food_name": "Homemade dal",
            "meal": "dinner",
            "log_date": TODAY,
            "quantity": 1,
            "kcal": 120,
            "protein_g": 6,
            "carbs_g": 18,
            "fat_g": 2,
            "fibre_g": 3,
        },
        headers=auth_headers,
    )
    assert resp.status_code == 201
    log = resp.get_json()["log"]
    assert log["food_name"] == "Homemade dal"
    assert log["kcal"] == 120.0


def test_create_log_invalid_meal(client, auth_headers, app):
    with app.app_context():
        from app.models.food import Food
        food_id = Food.query.first().id
    resp = client.post(
        "/api/v1/logs",
        json=_log_payload(food_id=food_id, meal="snacks"),  # wrong: plural
        headers=auth_headers,
    )
    assert resp.status_code == 422


def test_create_log_invalid_quantity(client, auth_headers, app):
    with app.app_context():
        from app.models.food import Food
        food_id = Food.query.first().id
    resp = client.post(
        "/api/v1/logs",
        json=_log_payload(food_id=food_id, quantity=-1),
        headers=auth_headers,
    )
    assert resp.status_code == 422


def test_create_log_bad_date(client, auth_headers, app):
    with app.app_context():
        from app.models.food import Food
        food_id = Food.query.first().id
    resp = client.post(
        "/api/v1/logs",
        json=_log_payload(food_id=food_id, log_date="not-a-date"),
        headers=auth_headers,
    )
    assert resp.status_code == 422


# ---------------------------------------------------------------------------
# GET /logs?date=
# ---------------------------------------------------------------------------
def test_list_logs_requires_auth(client):
    resp = client.get(f"/api/v1/logs?date={TODAY}")
    assert resp.status_code == 401


def test_list_logs_no_date(client, auth_headers):
    resp = client.get("/api/v1/logs", headers=auth_headers)
    assert resp.status_code == 422


def test_list_logs_returns_structure(client, auth_headers, app):
    with app.app_context():
        from app.models.food import Food
        food_id = Food.query.first().id

    client.post(
        "/api/v1/logs",
        json=_log_payload(food_id=food_id, meal="breakfast"),
        headers=auth_headers,
    )
    resp = client.get(f"/api/v1/logs?date={TODAY}", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.get_json()
    assert "meals" in data
    assert "day_totals" in data
    assert "breakfast" in data["meals"]
    assert "lunch" in data["meals"]


# ---------------------------------------------------------------------------
# User isolation: 404 not 403
# ---------------------------------------------------------------------------
def test_delete_log_other_user_gets_404(client, two_users, app):
    with app.app_context():
        from app.models.food import Food
        food_id = Food.query.first().id

    # User A creates a log
    resp_a = client.post(
        "/api/v1/logs",
        json=_log_payload(food_id=food_id),
        headers={"Authorization": f"Bearer {two_users['token_a']}"},
    )
    log_id = resp_a.get_json()["log"]["id"]

    # User B tries to delete it
    resp_b = client.delete(
        f"/api/v1/logs/{log_id}",
        headers={"Authorization": f"Bearer {two_users['token_b']}"},
    )
    assert resp_b.status_code == 404  # NOT 403


# ---------------------------------------------------------------------------
# PATCH /logs/<id>
# ---------------------------------------------------------------------------
def test_update_log_quantity(client, auth_headers, app):
    with app.app_context():
        from app.models.food import Food
        food_id = Food.query.first().id

    create_resp = client.post(
        "/api/v1/logs",
        json=_log_payload(food_id=food_id, quantity=1),
        headers=auth_headers,
    )
    log_id = create_resp.get_json()["log"]["id"]
    original_kcal = create_resp.get_json()["log"]["kcal"]

    patch_resp = client.patch(
        f"/api/v1/logs/{log_id}",
        json={"quantity": 2},
        headers=auth_headers,
    )
    assert patch_resp.status_code == 200
    new_kcal = patch_resp.get_json()["log"]["kcal"]
    # Nutrients should be roughly doubled
    assert abs(new_kcal - original_kcal * 2) < 1


def test_update_log_meal(client, auth_headers, app):
    with app.app_context():
        from app.models.food import Food
        food_id = Food.query.first().id

    create_resp = client.post(
        "/api/v1/logs",
        json=_log_payload(food_id=food_id, meal="lunch"),
        headers=auth_headers,
    )
    log_id = create_resp.get_json()["log"]["id"]

    patch_resp = client.patch(
        f"/api/v1/logs/{log_id}",
        json={"meal": "dinner"},
        headers=auth_headers,
    )
    assert patch_resp.status_code == 200
    assert patch_resp.get_json()["log"]["meal"] == "dinner"


# ---------------------------------------------------------------------------
# DELETE /logs/<id>
# ---------------------------------------------------------------------------
def test_delete_log_success(client, auth_headers, app):
    with app.app_context():
        from app.models.food import Food
        food_id = Food.query.first().id

    create_resp = client.post(
        "/api/v1/logs",
        json=_log_payload(food_id=food_id),
        headers=auth_headers,
    )
    log_id = create_resp.get_json()["log"]["id"]

    del_resp = client.delete(f"/api/v1/logs/{log_id}", headers=auth_headers)
    assert del_resp.status_code == 200

    # Confirm gone
    list_resp = client.get(f"/api/v1/logs?date={TODAY}", headers=auth_headers)
    ids = [
        log["id"]
        for meal_data in list_resp.get_json()["meals"].values()
        for log in meal_data["logs"]
    ]
    assert log_id not in ids


def test_delete_nonexistent_log(client, auth_headers):
    resp = client.delete("/api/v1/logs/999999", headers=auth_headers)
    assert resp.status_code == 404


def test_create_log_grams_mode(client, auth_headers, app):
    with app.app_context():
        from app.models.food import Food
        food = Food.query.first()
        food_id = food.id
        expected_kcal = round(float(food.kcal_per_100g) * 150 / 100, 2)

    resp = client.post(
        "/api/v1/logs",
        json={
            "food_id": food_id,
            "grams": 150,
            "quantity": 1,
            "meal": "lunch",
            "log_date": TODAY,
        },
        headers=auth_headers,
    )
    assert resp.status_code == 201
    log = resp.get_json()["log"]
    assert log["portion_label"] == "g"
    assert log["portion_grams"] == 1.0
    assert abs(log["kcal"] - expected_kcal) < 0.05


def test_snapshot_immutability_when_food_changes(client, auth_headers, app):
    with app.app_context():
        from app.models.food import Food
        from app.extensions import db
        food = Food.query.first()
        food_id = food.id

    # Create log with initial food values
    resp = client.post(
        "/api/v1/logs",
        json=_log_payload(food_id=food_id, quantity=1),
        headers=auth_headers,
    )
    assert resp.status_code == 201
    log_id = resp.get_json()["log"]["id"]
    initial_kcal = resp.get_json()["log"]["kcal"]

    # Now mutate food in database (e.g. food formulation changed)
    with app.app_context():
        from app.models.food import Food
        from app.extensions import db
        f = db.session.get(Food, food_id)
        f.kcal_per_100g = 999.0
        db.session.commit()

    # Re-fetch log: snapshot MUST remain unchanged!
    get_resp = client.get(f"/api/v1/logs?date={TODAY}", headers=auth_headers)
    assert get_resp.status_code == 200
    all_logs = [
        item for m in get_resp.get_json()["meals"].values() for item in m["logs"]
    ]
    target_log = next(x for x in all_logs if x["id"] == log_id)
    assert target_log["kcal"] == initial_kcal


def test_patch_log_other_user_gets_404(client, two_users, app):
    with app.app_context():
        from app.models.food import Food
        food_id = Food.query.first().id

    # User A creates a log
    resp_a = client.post(
        "/api/v1/logs",
        json=_log_payload(food_id=food_id),
        headers={"Authorization": f"Bearer {two_users['token_a']}"},
    )
    log_id = resp_a.get_json()["log"]["id"]

    # User B tries to patch it -> 404 (never 403)
    resp_b = client.patch(
        f"/api/v1/logs/{log_id}",
        json={"quantity": 3},
        headers={"Authorization": f"Bearer {two_users['token_b']}"},
    )
    assert resp_b.status_code == 404

