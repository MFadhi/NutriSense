from app.models import MealPlan, MealPlanPreference, UserProfile, Food, LabConsent, LabResult


def test_meal_planner_preferences_crud(client, auth_headers):
    # GET default
    res = client.get("/api/v1/meal-planner/preferences", headers=auth_headers)
    assert res.status_code == 200
    data = res.get_json()
    assert data["meals_per_day"] == 4
    assert data["include_snacks"] is True

    # PUT update
    update_res = client.put(
        "/api/v1/meal-planner/preferences",
        headers=auth_headers,
        json={"meals_per_day": 3, "include_snacks": False, "diet_type": "vegan"},
    )
    assert update_res.status_code == 200
    updated = update_res.get_json()
    assert updated["meals_per_day"] == 3
    assert updated["include_snacks"] is False
    assert updated["diet_type"] == "vegan"


def test_generate_daily_meal_plan(client, auth_headers):
    res = client.post(
        "/api/v1/meal-planner/generate/daily",
        headers=auth_headers,
        json={"day": "Monday"},
    )
    assert res.status_code == 200
    plan = res.get_json()
    assert plan["day"] == "Monday"
    assert "meals" in plan
    assert "breakfast" in plan["meals"]
    assert "lunch" in plan["meals"]
    assert "dinner" in plan["meals"]
    assert "totals" in plan
    assert plan["totals"]["kcal"] > 0
    assert plan["totals"]["protein_g"] > 0


def test_generate_weekly_meal_plan(client, auth_headers):
    res = client.post("/api/v1/meal-planner/generate/weekly", headers=auth_headers)
    assert res.status_code == 200
    plan = res.get_json()
    assert plan["plan_type"] == "weekly"
    assert len(plan["days"]) == 7
    assert plan["days"][0]["day"] == "Monday"
    assert plan["days"][6]["day"] == "Sunday"
    assert "averages" in plan
    assert plan["averages"]["kcal"] > 0


def test_strict_allergy_avoidance(client, auth_headers, app):
    # Set user allergies to include "milk"
    with app.app_context():
        client.put(
            "/api/v1/auth/me",
            headers=auth_headers,
            json={"allergies": ["milk"]},
        )

    res = client.post("/api/v1/meal-planner/generate/daily", headers=auth_headers)
    assert res.status_code == 200
    plan = res.get_json()

    # Verify no food with milk allergen (e.g. paneer) is recommended
    for meal in plan["meals"].values():
        for item in meal["items"]:
            assert "paneer" not in item["food_name"].lower()


def test_diet_preference_enforcement(client, auth_headers, app):
    with app.app_context():
        client.put(
            "/api/v1/auth/me",
            headers=auth_headers,
            json={"diet_type": "veg"},
        )

    res = client.post("/api/v1/meal-planner/generate/weekly", headers=auth_headers)
    assert res.status_code == 200
    plan = res.get_json()

    for day in plan["days"]:
        for meal in day["meals"].values():
            for item in meal["items"]:
                assert item["diet"] in ["vegan", "veg"]


def test_lab_insights_integration_in_meal_plan(client, auth_headers):
    # Grant consent and record low haemoglobin
    client.post("/api/v1/lab/consent", headers=auth_headers, json={"consented": True})
    client.post(
        "/api/v1/lab/results",
        headers=auth_headers,
        json={"parameter": "haemoglobin", "value": 10.5, "unit": "g/dL", "test_date": "2026-11-20"},
    )

    res = client.post("/api/v1/meal-planner/generate/daily", headers=auth_headers)
    assert res.status_code == 200
    plan = res.get_json()
    assert "meals" in plan
    # At least one meal should have a personalized explanation
    reasons = [m["reason"] for m in plan["meals"].values()]
    assert any("protein" in r.lower() or "fibre" in r.lower() or "health" in r.lower() or "diet" in r.lower() for r in reasons)


def test_replace_meal_alternatives(client, auth_headers):
    payload = {
        "meal_key": "lunch",
        "exclude_food_id": 1,
        "target_kcal": 650.0,
    }
    res = client.post("/api/v1/meal-planner/replace-meal", headers=auth_headers, json=payload)
    assert res.status_code == 200
    data = res.get_json()
    assert "alternatives" in data
    assert len(data["alternatives"]) > 0


def test_save_and_manage_meal_plans(client, auth_headers, two_users):
    # 1. Generate and save plan
    gen_res = client.post("/api/v1/meal-planner/generate/weekly", headers=auth_headers)
    plan_data = gen_res.get_json()

    save_payload = {
        "title": "Winter Healthy Week",
        "plan_type": "weekly",
        "plan_data": plan_data,
        "totals": plan_data["averages"],
    }
    save_res = client.post("/api/v1/meal-planner/save", headers=auth_headers, json=save_payload)
    assert save_res.status_code == 201
    saved_plan = save_res.get_json()
    plan_id = saved_plan["id"]
    assert saved_plan["title"] == "Winter Healthy Week"

    # 2. List plans
    list_res = client.get("/api/v1/meal-planner", headers=auth_headers)
    assert list_res.status_code == 200
    assert len(list_res.get_json()) == 1

    # 3. Get single plan
    get_res = client.get(f"/api/v1/meal-planner/{plan_id}", headers=auth_headers)
    assert get_res.status_code == 200
    assert get_res.get_json()["id"] == plan_id

    # 4. Set active
    act_res = client.put(f"/api/v1/meal-planner/{plan_id}/active", headers=auth_headers)
    assert act_res.status_code == 200
    assert act_res.get_json()["is_active"] is True

    # 5. User isolation: user B cannot access or delete user A's plan
    auth_b = {"Authorization": f"Bearer {two_users['token_b']}"}
    assert client.get(f"/api/v1/meal-planner/{plan_id}", headers=auth_b).status_code == 404
    assert client.delete(f"/api/v1/meal-planner/{plan_id}", headers=auth_b).status_code == 404

    # 6. Delete plan
    del_res = client.delete(f"/api/v1/meal-planner/{plan_id}", headers=auth_headers)
    assert del_res.status_code == 200
    assert len(client.get("/api/v1/meal-planner", headers=auth_headers).get_json()) == 0
