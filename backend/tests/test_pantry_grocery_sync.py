from datetime import date, timedelta
from unittest.mock import patch
from app.models import PantryItem, GroceryItem, PurchaseTransaction, User
from app.extensions import db


def test_pantry_crud_and_dashboard(client, auth_headers):
    # 1. Add pantry item
    today = date.today()
    exp_soon = today + timedelta(days=2)
    res = client.post(
        "/api/v1/pantry",
        headers=auth_headers,
        json={
            "name": "Fresh Spinach",
            "category": "Vegetables",
            "quantity": 250,
            "unit": "g",
            "purchase_date": today.isoformat(),
            "expiry_date": exp_soon.isoformat(),
            "notes": "Organic baby spinach",
        },
    )
    assert res.status_code == 201
    item = res.get_json()
    assert item["name"] == "Fresh Spinach"
    assert item["quantity"] == 250.0
    assert item["unit"] == "g"
    item_id = item["id"]

    # 2. Add an expired item
    expired_date = today - timedelta(days=2)
    client.post(
        "/api/v1/pantry",
        headers=auth_headers,
        json={
            "name": "Old Milk",
            "category": "Dairy",
            "quantity": 500,
            "unit": "ml",
            "expiry_date": expired_date.isoformat(),
        },
    )

    # 3. Check pantry dashboard
    dash_res = client.get("/api/v1/pantry/dashboard", headers=auth_headers)
    assert dash_res.status_code == 200
    dash = dash_res.get_json()
    assert dash["total_items"] == 2
    assert dash["expiring_soon"] == 1
    assert dash["expired"] == 1
    assert len(dash["recently_added"]) == 2

    # 4. Partial consume
    consume_res = client.post(
        f"/api/v1/pantry/{item_id}/consume",
        headers=auth_headers,
        json={"amount": 100},
    )
    assert consume_res.status_code == 200
    c_item = consume_res.get_json()
    assert c_item["quantity"] == 150.0
    assert c_item["is_consumed"] is False

    # 5. Full consume
    full_consume = client.post(
        f"/api/v1/pantry/{item_id}/consume",
        headers=auth_headers,
        json={"amount": 200},
    )
    assert full_consume.status_code == 200
    assert full_consume.get_json()["is_consumed"] is True


def test_grocery_batch_and_crud(client, auth_headers):
    # Batch add
    res = client.post(
        "/api/v1/grocery/batch",
        headers=auth_headers,
        json={
            "source": "Weekly Meal Plan",
            "items": [
                {"name": "Basmati Rice", "category": "Grains", "quantity": 1, "unit": "kg"},
                {"name": "Tomatoes", "category": "Vegetables", "quantity": 500, "unit": "g"},
            ],
        },
    )
    assert res.status_code == 201
    items = res.get_json()
    assert len(items) == 2
    assert items[0]["name"] == "Basmati Rice"

    # List
    list_res = client.get("/api/v1/grocery", headers=auth_headers)
    assert list_res.status_code == 200
    assert len(list_res.get_json()) >= 2


def test_grocery_purchase_sync_new_ingredient(client, auth_headers):
    # Create a grocery item
    g_res = client.post(
        "/api/v1/grocery",
        headers=auth_headers,
        json={"name": "Almonds", "category": "Nuts & Seeds", "quantity": 200, "unit": "g"},
    )
    assert g_res.status_code == 201
    g_item = g_res.get_json()
    g_id = g_item["id"]

    # Confirm purchase with sync to pantry
    today = date.today().isoformat()
    exp = (date.today() + timedelta(days=60)).isoformat()
    sync_res = client.post(
        f"/api/v1/grocery/{g_id}/purchase",
        headers=auth_headers,
        json={
            "purchased_quantity": 250,
            "unit": "g",
            "purchase_date": today,
            "expiry_date": exp,
            "notes": "Bought roasted almonds",
        },
    )
    assert sync_res.status_code == 200
    sync_data = sync_res.get_json()
    assert sync_data["grocery_item"]["is_purchased"] is True
    assert sync_data["grocery_item"]["purchased_quantity"] == 250.0
    assert sync_data["pantry_item"]["name"] == "Almonds"
    assert sync_data["pantry_item"]["quantity"] == 250.0
    assert sync_data["pantry_item"]["unit"] == "g"
    assert sync_data["transaction"]["purchased_quantity"] == 250.0


def test_grocery_purchase_sync_merge_existing_quantity_with_unit_conversion(client, auth_headers):
    # Pre-seed pantry with 500 g of Basmati Rice
    p_res = client.post(
        "/api/v1/pantry",
        headers=auth_headers,
        json={"name": "Basmati Rice", "category": "Grains", "quantity": 500, "unit": "g"},
    )
    assert p_res.status_code == 201

    # Create grocery item for 2 kg
    g_res = client.post(
        "/api/v1/grocery",
        headers=auth_headers,
        json={"name": "Basmati Rice", "category": "Grains", "quantity": 2, "unit": "kg"},
    )
    g_id = g_res.get_json()["id"]

    # Purchase 2 kg
    sync_res = client.post(
        f"/api/v1/grocery/{g_id}/purchase",
        headers=auth_headers,
        json={"purchased_quantity": 2, "unit": "kg"},
    )
    assert sync_res.status_code == 200
    sync_data = sync_res.get_json()
    # 500g + 2kg = 2.5 kg
    p_item = sync_data["pantry_item"]
    assert p_item["name"] == "Basmati Rice"
    assert p_item["quantity"] == 2.5
    assert p_item["unit"] == "kg"


def test_partial_purchase(client, auth_headers):
    # Grocery item requests 10 apples
    g_res = client.post(
        "/api/v1/grocery",
        headers=auth_headers,
        json={"name": "Crisp Apples", "category": "Fruits", "quantity": 10, "unit": "pcs"},
    )
    g_id = g_res.get_json()["id"]

    # User only bought 6 apples
    sync_res = client.post(
        f"/api/v1/grocery/{g_id}/purchase",
        headers=auth_headers,
        json={"purchased_quantity": 6, "unit": "pcs"},
    )
    assert sync_res.status_code == 200
    sync_data = sync_res.get_json()
    assert sync_data["grocery_item"]["purchased_quantity"] == 6.0
    assert sync_data["pantry_item"]["quantity"] == 6.0


def test_duplicate_purchase_prevention(client, auth_headers):
    g_res = client.post(
        "/api/v1/grocery",
        headers=auth_headers,
        json={"name": "Turmeric Powder", "category": "Spices", "quantity": 100, "unit": "g"},
    )
    g_id = g_res.get_json()["id"]

    # First purchase succeeds
    res1 = client.post(f"/api/v1/grocery/{g_id}/purchase", headers=auth_headers, json={})
    assert res1.status_code == 200

    # Second immediate purchase must fail with 400
    res2 = client.post(f"/api/v1/grocery/{g_id}/purchase", headers=auth_headers, json={})
    assert res2.status_code == 400
    assert res2.get_json()["error"]["code"] == "duplicate_purchase"


def test_purchase_quantity_correction(client, auth_headers):
    g_res = client.post(
        "/api/v1/grocery",
        headers=auth_headers,
        json={"name": "Olive Oil", "category": "Oils", "quantity": 1, "unit": "L"},
    )
    g_id = g_res.get_json()["id"]

    # Purchase 1 L
    sync_res = client.post(f"/api/v1/grocery/{g_id}/purchase", headers=auth_headers, json={"purchased_quantity": 1})
    assert sync_res.status_code == 200

    # User corrects purchase to 2 L
    corr_res = client.patch(
        f"/api/v1/grocery/{g_id}/purchase-correction",
        headers=auth_headers,
        json={"purchased_quantity": 2.0},
    )
    assert corr_res.status_code == 200
    corr_data = corr_res.get_json()
    assert corr_data["grocery_item"]["purchased_quantity"] == 2.0
    assert corr_data["pantry_item"]["quantity"] == 2.0


def test_separate_batches_for_different_expiry_dates(client, auth_headers):
    today = date.today()
    exp1 = today + timedelta(days=10)
    exp2 = today + timedelta(days=30)

    # 1. Existing batch of milk expiring in 10 days
    client.post(
        "/api/v1/pantry",
        headers=auth_headers,
        json={"name": "Fresh Milk", "category": "Dairy", "quantity": 1, "unit": "L", "expiry_date": exp1.isoformat()},
    )

    # 2. Grocery item for new milk
    g_res = client.post(
        "/api/v1/grocery",
        headers=auth_headers,
        json={"name": "Fresh Milk", "category": "Dairy", "quantity": 1, "unit": "L"},
    )
    g_id = g_res.get_json()["id"]

    # 3. Confirm purchase with different expiry date (30 days)
    sync_res = client.post(
        f"/api/v1/grocery/{g_id}/purchase",
        headers=auth_headers,
        json={"purchased_quantity": 1, "unit": "L", "expiry_date": exp2.isoformat()},
    )
    assert sync_res.status_code == 200

    # Check pantry: Should have TWO separate batches of Fresh Milk because expiry dates differ
    p_list = client.get("/api/v1/pantry?search=Fresh+Milk", headers=auth_headers).get_json()
    assert len(p_list) == 2


def test_transaction_rollback_on_failure(client, auth_headers):
    g_res = client.post(
        "/api/v1/grocery",
        headers=auth_headers,
        json={"name": "Saffron", "category": "Spices", "quantity": 5, "unit": "g"},
    )
    g_id = g_res.get_json()["id"]

    with patch("app.services.pantry_sync_service.PantryItem", side_effect=Exception("Database lock simulated")):
        sync_res = client.post(
            f"/api/v1/grocery/{g_id}/purchase",
            headers=auth_headers,
            json={"purchased_quantity": 5, "unit": "g"},
        )
        assert sync_res.status_code == 500

    # Verify grocery item remains UNPURCHASED due to rollback
    check = client.get("/api/v1/grocery", headers=auth_headers).get_json()
    item = next(x for x in check if x["id"] == g_id)
    assert item["is_purchased"] is False


def test_user_ownership_isolation(client, auth_headers):
    # User A creates a grocery item
    g_res = client.post(
        "/api/v1/grocery",
        headers=auth_headers,
        json={"name": "Private Coffee", "category": "Beverages", "quantity": 1, "unit": "pack"},
    )
    g_id = g_res.get_json()["id"]

    # Register User B
    client.post(
        "/api/v1/auth/register",
        json={"email": "user_b@example.com", "password": "Password123!"},
    )
    login_b = client.post(
        "/api/v1/auth/login",
        json={"email": "user_b@example.com", "password": "Password123!"},
    ).get_json()
    token_b = login_b["access_token"]
    headers_b = {"Authorization": f"Bearer {token_b}"}

    # User B tries to view or purchase User A's item -> 404
    b_purchase = client.post(f"/api/v1/grocery/{g_id}/purchase", headers=headers_b, json={})
    assert b_purchase.status_code == 404

    b_del = client.delete(f"/api/v1/grocery/{g_id}", headers=headers_b)
    assert b_del.status_code == 404
