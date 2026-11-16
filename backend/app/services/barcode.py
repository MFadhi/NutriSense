import json
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from flask import current_app
from ..extensions import db
from ..models.cache import ExternalProductCache

VALID_ALLERGENS = [
    "peanut",
    "tree_nut",
    "milk",
    "egg",
    "gluten",
    "soy",
    "fish",
    "shellfish",
    "sesame",
    "mustard",
    "celery",
    "lupin",
    "molluscs",
    "sulphites",
]

OFF_ALLERGEN_MAP = {
    "peanuts": "peanut",
    "peanut": "peanut",
    "nuts": "tree_nut",
    "tree-nuts": "tree_nut",
    "tree_nuts": "tree_nut",
    "tree_nut": "tree_nut",
    "milk": "milk",
    "dairy": "milk",
    "eggs": "egg",
    "egg": "egg",
    "gluten": "gluten",
    "wheat": "gluten",
    "soybeans": "soy",
    "soybean": "soy",
    "soy": "soy",
    "fish": "fish",
    "crustaceans": "shellfish",
    "crustacean": "shellfish",
    "molluscs": "molluscs",
    "mollusc": "molluscs",
    "shellfish": "shellfish",
    "sesame-seeds": "sesame",
    "sesame-seed": "sesame",
    "sesame": "sesame",
    "mustard": "mustard",
    "celery": "celery",
    "lupin": "lupin",
    "sulphur-dioxide-and-sulphites": "sulphites",
    "sulphites": "sulphites",
    "sulfites": "sulphites",
}


class UpstreamUnavailableError(Exception):
    """Raised when upstream API (Open Food Facts) is down, timed out, or rate limited."""
    pass


def validate_gs1_barcode(code: str) -> bool:
    """
    Validate barcode digits and length (8, 12, or 13 digits)
    along with GS1 standard check digit calculation.
    """
    if not isinstance(code, str) or not code.isdigit():
        return False
    if len(code) not in (8, 12, 13):
        return False

    payload = [int(x) for x in code[:-1]]
    check_digit = int(code[-1])

    # Right-to-left weighting: 3, 1, 3, 1... starting immediately left of check digit
    weighted_sum = sum(
        d * (3 if i % 2 == 1 else 1)
        for i, d in enumerate(reversed(payload), start=1)
    )
    expected_check = (10 - (weighted_sum % 10)) % 10
    return check_digit == expected_check


def map_off_allergens(tags) -> list[str]:
    """Map Open Food Facts allergen or trace tags to our canonical allergen list."""
    if not tags or not isinstance(tags, (list, tuple)):
        return []
    mapped = set()
    for raw in tags:
        if not isinstance(raw, str):
            continue
        cleaned = raw.lower().strip()
        if ":" in cleaned:
            cleaned = cleaned.split(":", 1)[1]
        cleaned = cleaned.replace("_", "-")
        canonical = OFF_ALLERGEN_MAP.get(cleaned)
        if canonical and canonical in VALID_ALLERGENS:
            mapped.add(canonical)
        elif cleaned in VALID_ALLERGENS:
            mapped.add(cleaned)
    return sorted(list(mapped))


def map_off_diet(ingredients_analysis_tags) -> tuple[str, bool]:
    """
    Map ingredients_analysis_tags to (diet, diet_verified).
    en:vegan -> ('vegan', True)
    en:vegetarian -> ('veg', True)
    en:non-vegetarian -> ('nonveg', True)
    absent / unknown -> ('veg', False)
    """
    if not ingredients_analysis_tags or not isinstance(ingredients_analysis_tags, (list, tuple)):
        return ("veg", False)

    tags = set(ingredients_analysis_tags)
    if "en:vegan" in tags:
        return ("vegan", True)
    if "en:vegetarian" in tags:
        return ("veg", True)
    if "en:non-vegetarian" in tags:
        return ("nonveg", True)
    return ("veg", False)


def parse_off_nutriments(nutriments: dict) -> tuple[dict, list[str]]:
    """
    Extract per_100g nutrients and track missing fields.
    Returns (per_100g_dict, missing_fields).
    """
    nutriments = nutriments or {}
    missing = []

    # 1. Kcal
    kcal = None
    if "energy-kcal_100g" in nutriments and nutriments["energy-kcal_100g"] is not None:
        try:
            kcal = float(nutriments["energy-kcal_100g"])
        except (ValueError, TypeError):
            pass
    elif "energy-kcal" in nutriments and nutriments["energy-kcal"] is not None:
        try:
            kcal = float(nutriments["energy-kcal"])
        except (ValueError, TypeError):
            pass
    elif "energy-kj_100g" in nutriments and nutriments["energy-kj_100g"] is not None:
        try:
            # 1 kcal = 4.184 kJ
            kcal = float(nutriments["energy-kj_100g"]) / 4.184
        except (ValueError, TypeError):
            pass
    elif "energy_100g" in nutriments and nutriments["energy_100g"] is not None:
        try:
            val = float(nutriments["energy_100g"])
            unit = str(nutriments.get("energy_unit", "")).lower()
            if "kj" in unit:
                kcal = val / 4.184
            else:
                kcal = val
        except (ValueError, TypeError):
            pass

    if kcal is None:
        missing.append("kcal")
        kcal = 0.0

    # 2. Protein
    protein = None
    if "proteins_100g" in nutriments and nutriments["proteins_100g"] is not None:
        try:
            protein = float(nutriments["proteins_100g"])
        except (ValueError, TypeError):
            pass
    if protein is None:
        missing.append("protein")
        protein = 0.0

    # 3. Carbs
    carbs = None
    if "carbohydrates_100g" in nutriments and nutriments["carbohydrates_100g"] is not None:
        try:
            carbs = float(nutriments["carbohydrates_100g"])
        except (ValueError, TypeError):
            pass
    if carbs is None:
        missing.append("carbs")
        carbs = 0.0

    # 4. Fat
    fat = None
    if "fat_100g" in nutriments and nutriments["fat_100g"] is not None:
        try:
            fat = float(nutriments["fat_100g"])
        except (ValueError, TypeError):
            pass
    if fat is None:
        missing.append("fat")
        fat = 0.0

    # 5. Fibre
    fibre = None
    if "fiber_100g" in nutriments and nutriments["fiber_100g"] is not None:
        try:
            fibre = float(nutriments["fiber_100g"])
        except (ValueError, TypeError):
            pass
    if fibre is None:
        missing.append("fibre")
        fibre = 0.0

    per_100g = {
        "kcal": round(kcal, 2),
        "protein": round(protein, 2),
        "carbs": round(carbs, 2),
        "fat": round(fat, 2),
        "fibre": round(fibre, 2),
    }
    return per_100g, missing


def build_draft_from_off(code: str, product: dict) -> dict:
    """Build draft dictionary from raw Open Food Facts product dict."""
    name_en = (
        product.get("product_name_en")
        or product.get("product_name")
        or "Unnamed Product"
    ).strip()

    per_100g, missing_fields = parse_off_nutriments(product.get("nutriments", {}))
    allergens = map_off_allergens(product.get("allergens_tags", []))
    traces = map_off_allergens(product.get("traces_tags", []))
    diet, diet_verified = map_off_diet(product.get("ingredients_analysis_tags", []))

    # Portions
    portions = []
    serving_quantity = product.get("serving_quantity")
    serving_size = product.get("serving_size")
    has_serving = False

    if serving_quantity:
        try:
            sq = float(serving_quantity)
            if sq > 0:
                has_serving = True
                label = serving_size.strip() if serving_size else f"{sq}g"
                portions.append({"label": label, "grams": round(sq, 2), "default": True})
        except (ValueError, TypeError):
            pass

    portions.append({"label": "100g", "grams": 100.0, "default": not has_serving})

    needs_review = bool(missing_fields or not diet_verified)

    return {
        "name_en": name_en,
        "brand": product.get("brands"),
        "quantity": product.get("quantity"),
        "per_100g": per_100g,
        "portions": portions,
        "allergens": allergens,
        "traces": traces,
        "diet": diet,
        "diet_verified": diet_verified,
        "missing_fields": missing_fields,
        "needs_review": needs_review,
    }


def lookup_barcode(code: str) -> tuple[dict | None, bool]:
    """
    Look up barcode with local database caching and fallback to Open Food Facts API v2.
    Returns (draft_dict or None, is_cached_bool).
    Raises UpstreamUnavailableError if Open Food Facts upstream service is down/unavailable.
    """
    # 1. Check local cache
    cached = db.session.get(ExternalProductCache, code)
    now = datetime.now(timezone.utc)
    if cached and cached.expires_at:
        # Normalize expires_at to aware UTC for comparison
        exp = cached.expires_at
        if exp.tzinfo is None:
            exp = exp.replace(tzinfo=timezone.utc)
        if exp > now:
            if cached.status == "found":
                return cached.payload, True
            else:
                return None, True

    # 2. Cache miss or expired: Query Open Food Facts API v2
    base_url = current_app.config.get("OFF_BASE_URL", "https://world.openfoodfacts.org").rstrip("/")
    timeout_s = float(current_app.config.get("OFF_TIMEOUT_S", 5.0))
    user_agent = current_app.config.get("OFF_USER_AGENT", "NutriLens/0.1 (user@nutrilens.app)")
    ttl_days = int(current_app.config.get("OFF_CACHE_TTL_DAYS", 30))

    fields = (
        "code,product_name,product_name_en,brands,quantity,"
        "serving_size,serving_quantity,nutriments,allergens_tags,"
        "traces_tags,ingredients_analysis_tags"
    )
    url = f"{base_url}/api/v2/product/{urllib.parse.quote(code)}.json?fields={fields}"
    req = urllib.request.Request(
        url,
        headers={
            "User-Agent": user_agent,
            "Accept": "application/json",
        },
    )

    max_attempts = 2  # 1 initial + 1 retry
    last_error = None
    data = None
    http_code = None

    for attempt in range(max_attempts):
        try:
            with urllib.request.urlopen(req, timeout=timeout_s) as response:
                http_code = response.getcode()
                raw_bytes = response.read()
                data = json.loads(raw_bytes.decode("utf-8"))
                break
        except urllib.error.HTTPError as he:
            http_code = he.code
            last_error = he
            if http_code == 404:
                data = {"status": 0}
                break
            if http_code in (429, 500, 502, 503, 504):
                if attempt < max_attempts - 1:
                    time.sleep(0.5)
                    continue
                raise UpstreamUnavailableError(f"Upstream returned HTTP {http_code}") from he
            # Other 4xx
            break
        except (urllib.error.URLError, TimeoutError, OSError) as e:
            last_error = e
            if attempt < max_attempts - 1:
                time.sleep(0.5)
                continue
            raise UpstreamUnavailableError("Upstream connection failed or timed out.") from e

    if data is None and last_error:
        raise UpstreamUnavailableError("Upstream connection failed.") from last_error

    # 3. Evaluate OFF payload
    if data and data.get("status") == 1 and "product" in data:
        draft = build_draft_from_off(code, data["product"])
        # Update or create cache
        cache_entry = cached or ExternalProductCache(barcode=code, source="openfoodfacts")
        cache_entry.status = "found"
        cache_entry.payload = draft
        cache_entry.fetched_at = datetime.now(timezone.utc)
        cache_entry.expires_at = datetime.now(timezone.utc) + timedelta(days=ttl_days)
        db.session.add(cache_entry)
        db.session.commit()
        return draft, False
    else:
        # Product not found: cache negative result with TTL 1 day
        cache_entry = cached or ExternalProductCache(barcode=code, source="openfoodfacts")
        cache_entry.status = "not_found"
        cache_entry.payload = None
        cache_entry.fetched_at = datetime.now(timezone.utc)
        cache_entry.expires_at = datetime.now(timezone.utc) + timedelta(days=1)
        db.session.add(cache_entry)
        db.session.commit()
        return None, False
