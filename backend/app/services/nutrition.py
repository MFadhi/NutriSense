from decimal import Decimal, ROUND_HALF_UP


def quantize(val) -> Decimal:
    """Round to 2 decimal places with ROUND_HALF_UP."""
    if val is None:
        return Decimal("0.00")
    return Decimal(str(val)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def compute_nutrients(food, portion_grams, quantity) -> dict[str, Decimal]:
    """
    Return dict of computed nutrient snapshots using Decimal arithmetic quantized to 2 decimals:
    kcal, protein_g, carbs_g, fat_g, fibre_g.
    """
    q = Decimal(str(quantity))
    pg = Decimal(str(portion_grams))
    grams = pg * q  # total grams consumed
    factor = grams / Decimal("100")

    kcal_per_100 = Decimal(str(getattr(food, "kcal_per_100g", 0) or 0))
    protein_per_100 = Decimal(str(getattr(food, "protein_per_100g", 0) or 0))
    carbs_per_100 = Decimal(str(getattr(food, "carbs_per_100g", 0) or 0))
    fat_per_100 = Decimal(str(getattr(food, "fat_per_100g", 0) or 0))
    fibre_per_100 = Decimal(str(getattr(food, "fibre_per_100g", 0) or 0))

    return {
        "kcal": quantize(factor * kcal_per_100),
        "protein_g": quantize(factor * protein_per_100),
        "carbs_g": quantize(factor * carbs_per_100),
        "fat_g": quantize(factor * fat_per_100),
        "fibre_g": quantize(factor * fibre_per_100),
    }


# Backwards compatibility alias
_compute_nutrients = compute_nutrients
