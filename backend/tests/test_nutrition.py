"""Tests for nutrient computation (Decimal arithmetic)."""
from decimal import Decimal
from app.api.logs import _compute_nutrients, quantize


class _MockFood:
    kcal_per_100g = 265
    protein_per_100g = 18.3
    carbs_per_100g = 1.2
    fat_per_100g = 20.8
    fibre_per_100g = 0


def test_quantize_rounds_half_up():
    assert quantize(1.005) == Decimal("1.01")
    assert quantize(1.004) == Decimal("1.00")


def test_compute_nutrients_100g():
    food = _MockFood()
    nutrients = _compute_nutrients(food, portion_grams=100, quantity=1)
    assert nutrients["kcal"] == Decimal("265.00")
    assert nutrients["protein_g"] == Decimal("18.30")
    assert nutrients["carbs_g"] == Decimal("1.20")
    assert nutrients["fat_g"] == Decimal("20.80")
    assert nutrients["fibre_g"] == Decimal("0.00")


def test_compute_nutrients_half_portion():
    food = _MockFood()
    nutrients = _compute_nutrients(food, portion_grams=100, quantity=0.5)
    assert nutrients["kcal"] == Decimal("132.50")
    assert nutrients["protein_g"] == Decimal("9.15")


def test_compute_nutrients_multiple_portions():
    food = _MockFood()
    nutrients = _compute_nutrients(food, portion_grams=30, quantity=2)
    # 60g total
    assert nutrients["kcal"] == Decimal("159.00")
    assert nutrients["protein_g"] == Decimal("10.98")


def test_compute_nutrients_returns_decimal_types():
    food = _MockFood()
    nutrients = _compute_nutrients(food, portion_grams=100, quantity=1)
    for key, val in nutrients.items():
        assert isinstance(val, Decimal), f"{key} should be Decimal"


def test_compute_nutrients_large_quantity():
    food = _MockFood()
    nutrients = _compute_nutrients(food, portion_grams=100, quantity=99)
    assert nutrients["kcal"] > Decimal("0")
