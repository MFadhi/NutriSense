import sys
from pathlib import Path

# Ensure backend root is on sys.path for direct script execution and IDE resolution
backend_dir = Path(__file__).resolve().parent.parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

import pytest
from app import create_app
from app.extensions import db as _db
from app.models.food import Food, FoodCategory, FoodAlias, Portion


@pytest.fixture(scope="session")
def app():
    app = create_app("testing")
    with app.app_context():
        _db.create_all()

        # Seed minimal categories
        cat_mains = FoodCategory(slug="mains", label_en="Mains")
        cat_dairy = FoodCategory(slug="dairy", label_en="Dairy")
        cat_breakfast = FoodCategory(slug="breakfast", label_en="Breakfast")
        _db.session.add_all([cat_mains, cat_dairy, cat_breakfast])
        _db.session.flush()

        # Paneer
        paneer = Food(
            seed_key="paneer",
            name_en="Paneer",
            name_hi="पनीर",
            name_kn="ಪನೀರ್",
            category_id=cat_dairy.id,
            diet="veg",
            kcal_per_100g=265,
            protein_per_100g=18.3,
            carbs_per_100g=1.2,
            fat_per_100g=20.8,
            fibre_per_100g=0,
            allergens=["milk"],
            tags=["high-protein", "dairy"],
            is_sample=True,
            source="sample",
        )
        _db.session.add(paneer)
        _db.session.flush()
        _db.session.add(FoodAlias(food_id=paneer.id, alias="cottage cheese", alias_normalized="cottagecheese"))
        _db.session.add(Portion(food_id=paneer.id, label="100g", grams=100, is_default=True))
        _db.session.add(Portion(food_id=paneer.id, label="1 slice (30g)", grams=30, is_default=False))

        # Dal Tadka
        dal = Food(
            seed_key="dal_tadka",
            name_en="Dal Tadka",
            name_hi="दाल तड़का",
            name_kn="ದಾಲ್ ತಡ್ಕಾ",
            category_id=cat_mains.id,
            diet="veg",
            kcal_per_100g=103,
            protein_per_100g=5.5,
            carbs_per_100g=15.0,
            fat_per_100g=2.5,
            fibre_per_100g=3.5,
            allergens=[],
            tags=["lentils", "high-fibre"],
            is_sample=True,
            source="sample",
        )
        _db.session.add(dal)
        _db.session.flush()
        _db.session.add(Portion(food_id=dal.id, label="1 katori (150g)", grams=150, is_default=True))

        # Idli
        idli = Food(
            seed_key="idli",
            name_en="Idli",
            name_hi="इडली",
            name_kn="ಇಡ್ಲಿ",
            category_id=cat_breakfast.id,
            diet="veg",
            kcal_per_100g=58,
            protein_per_100g=2.0,
            carbs_per_100g=11.5,
            fat_per_100g=0.5,
            fibre_per_100g=0.8,
            allergens=[],
            tags=["south-indian"],
            is_sample=True,
            source="sample",
        )
        _db.session.add(idli)
        _db.session.flush()
        _db.session.add(FoodAlias(food_id=idli.id, alias="idly", alias_normalized="idly"))
        _db.session.add(Portion(food_id=idli.id, label="1 piece (40g)", grams=40, is_default=True))

        # Dosa
        dosa = Food(
            seed_key="dosa",
            name_en="Dosa",
            name_hi="डोसा",
            name_kn="ದೋಸೆ",
            category_id=cat_breakfast.id,
            diet="veg",
            kcal_per_100g=168,
            protein_per_100g=3.8,
            carbs_per_100g=29.0,
            fat_per_100g=3.7,
            fibre_per_100g=1.2,
            allergens=[],
            tags=["south-indian"],
            is_sample=True,
            source="sample",
        )
        _db.session.add(dosa)
        _db.session.flush()
        _db.session.add(Portion(food_id=dosa.id, label="1 medium (80g)", grams=80, is_default=True))

        # Chapati
        chapati = Food(
            seed_key="chapati",
            name_en="Chapati",
            name_hi="चपाती",
            name_kn="ಚಪಾತಿ",
            category_id=cat_mains.id,
            diet="veg",
            kcal_per_100g=297,
            protein_per_100g=10.0,
            carbs_per_100g=50.0,
            fat_per_100g=4.0,
            fibre_per_100g=8.0,
            allergens=["gluten"],
            tags=["flatbread"],
            is_sample=True,
            source="sample",
        )
        _db.session.add(chapati)
        _db.session.flush()
        _db.session.add(FoodAlias(food_id=chapati.id, alias="roti", alias_normalized="roti"))
        _db.session.add(Portion(food_id=chapati.id, label="1 roti (40g)", grams=40, is_default=True))

        # Chicken Curry
        chicken = Food(
            seed_key="chicken_curry",
            name_en="Chicken Curry",
            name_hi="चिकन करी",
            name_kn="ಚಿಕನ್ ಕರಿ",
            category_id=cat_mains.id,
            diet="nonveg",
            kcal_per_100g=165,
            protein_per_100g=18.0,
            carbs_per_100g=5.0,
            fat_per_100g=8.0,
            fibre_per_100g=1.5,
            allergens=[],
            tags=["high-protein"],
            is_sample=True,
            source="sample",
        )
        _db.session.add(chicken)
        _db.session.flush()
        _db.session.add(Portion(food_id=chicken.id, label="1 katori (200g)", grams=200, is_default=True))

        _db.session.commit()
        yield app
        _db.session.remove()
        _db.drop_all()


@pytest.fixture
def client(app):
    return app.test_client()


@pytest.fixture
def auth_headers(client):
    """Register + login a fresh user, return auth headers."""
    email = "testuser_fixture@example.com"
    pw = "password123"
    client.post("/api/v1/auth/register", json={"email": email, "password": pw})
    resp = client.post("/api/v1/auth/login", json={"email": email, "password": pw})
    token = resp.get_json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def two_users(client):
    """Register two separate users and return their tokens."""
    for email, pw in [("a@test.com", "password123"), ("b@test.com", "password123")]:
        client.post("/api/v1/auth/register", json={"email": email, "password": pw})

    token_a = client.post(
        "/api/v1/auth/login", json={"email": "a@test.com", "password": "password123"}
    ).get_json()["access_token"]
    token_b = client.post(
        "/api/v1/auth/login", json={"email": "b@test.com", "password": "password123"}
    ).get_json()["access_token"]
    return {"token_a": token_a, "token_b": token_b}
