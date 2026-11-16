"""Tests for food compatibility service (diet and allergy warnings)."""
import pytest
from app.services.food_compatibility import get_warnings


class _MockProfile:
    def __init__(self, diet_type=None, allergies=None):
        self.diet_type = diet_type
        self.allergies = allergies or []


class _MockFood:
    def __init__(self, diet="veg", allergens=None, name_en="", name_hi=None, name_kn=None, aliases=None):
        self.diet = diet
        self.allergens = allergens or []
        self.name_en = name_en
        self.name_hi = name_hi
        self.name_kn = name_kn
        self.aliases = aliases or []


class _MockAlias:
    def __init__(self, alias):
        self.alias = alias


def test_veg_user_warnings():
    profile = _MockProfile(diet_type="veg")

    # Veg food -> no diet warning
    veg_food = _MockFood(diet="veg")
    assert len(get_warnings(veg_food, profile)) == 0

    # Egg food -> warning
    egg_food = _MockFood(diet="egg")
    warns = get_warnings(egg_food, profile)
    assert len(warns) == 1
    assert warns[0]["kind"] == "diet"
    assert "egg" in warns[0]["detail"].lower()

    # Nonveg food -> warning
    nonveg_food = _MockFood(diet="nonveg")
    warns = get_warnings(nonveg_food, profile)
    assert len(warns) == 1
    assert warns[0]["kind"] == "diet"
    assert "non-vegetarian" in warns[0]["detail"].lower()


def test_eggetarian_user_warnings():
    profile = _MockProfile(diet_type="eggetarian")

    # Egg food -> no warning
    egg_food = _MockFood(diet="egg")
    assert len(get_warnings(egg_food, profile)) == 0

    # Nonveg food -> warning
    nonveg_food = _MockFood(diet="nonveg")
    warns = get_warnings(nonveg_food, profile)
    assert len(warns) == 1
    assert warns[0]["kind"] == "diet"


def test_vegan_user_warnings():
    profile = _MockProfile(diet_type="vegan")

    # Vegan food -> no warning
    vegan_food = _MockFood(diet="vegan")
    assert len(get_warnings(vegan_food, profile)) == 0

    # Veg (dairy) food -> warning
    veg_food = _MockFood(diet="veg")
    warns = get_warnings(veg_food, profile)
    assert len(warns) == 1
    assert warns[0]["kind"] == "diet"
    assert "not vegan" in warns[0]["detail"].lower()


def test_nonveg_user_no_diet_warnings():
    profile = _MockProfile(diet_type="nonveg")
    for d in ["vegan", "veg", "egg", "nonveg"]:
        assert len(get_warnings(_MockFood(diet=d), profile)) == 0


def test_standard_allergen_warning():
    profile = _MockProfile(diet_type="nonveg", allergies=["peanut", "milk"])
    food = _MockFood(diet="veg", allergens=["milk"])

    warns = get_warnings(food, profile)
    assert len(warns) == 1
    assert warns[0]["kind"] == "allergen"
    assert "milk" in warns[0]["detail"].lower()


def test_custom_text_allergy_in_name_or_alias():
    profile = _MockProfile(diet_type="nonveg", allergies=["mushroom"])

    # In English name
    food1 = _MockFood(name_en="Mushroom Masala")
    warns1 = get_warnings(food1, profile)
    assert len(warns1) == 1
    assert warns1[0]["kind"] == "allergen"

    # In alias
    food2 = _MockFood(name_en="Creamy Soup", aliases=[_MockAlias("mushroom soup")])
    warns2 = get_warnings(food2, profile)
    assert len(warns2) == 1
    assert warns2[0]["kind"] == "allergen"


def test_unverified_diet_warning():
    profile = _MockProfile(diet_type="veg")
    food = _MockFood(diet="veg")
    food.diet_verified = False

    warns = get_warnings(food, profile)
    assert len(warns) == 1
    assert warns[0]["kind"] == "unverified_diet"
    assert "unverified" in warns[0]["detail"].lower()

    # nonveg user should not receive unverified_diet warning
    nonveg_profile = _MockProfile(diet_type="nonveg")
    assert len(get_warnings(food, nonveg_profile)) == 0
