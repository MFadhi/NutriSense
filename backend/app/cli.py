import click
import json
import unicodedata
from decimal import Decimal


def register_cli(app):
    @app.cli.command("seed-foods")
    @click.option(
        "--file",
        "seed_file",
        default="seed/foods_seed.json",
        show_default=True,
        help="Path to the seed JSON file.",
    )
    @click.option(
        "--reset",
        is_flag=True,
        help="Delete all existing seed foods before importing.",
    )
    def seed_foods(seed_file, reset):
        """Seed the database with foods from a JSON file."""
        from .extensions import db
        from .models.food import Food, FoodCategory, FoodAlias, Portion
        from .services.food_search import invalidate_cache

        VALID_ALLERGENS = {
            "peanut", "tree_nut", "milk", "egg", "gluten",
            "soy", "fish", "shellfish", "sesame", "mustard",
        }
        VALID_DIETS = {"vegan", "veg", "egg", "nonveg"}

        CATEGORIES = [
            ("breakfast", "Breakfast"),
            ("mains", "Mains"),
            ("snacks", "Snacks"),
            ("beverages", "Beverages"),
            ("dairy", "Dairy"),
            ("fruits", "Fruits"),
            ("sweets", "Sweets"),
            ("salads", "Salads"),
            ("others", "Others"),
        ]

        with open(seed_file, "r", encoding="utf-8") as f:
            data = json.load(f)

        foods_data = data.get("foods", [])
        errors = []
        warnings_list = []

        # Seed categories first (needed for validation)
        for slug, label in CATEGORIES:
            if not FoodCategory.query.filter_by(slug=slug).first():
                db.session.add(FoodCategory(slug=slug, label_en=label))
        db.session.flush()

        # Validate all entries before writing
        for item in foods_data:
            key = item.get("key", "?")
            if item.get("diet") not in VALID_DIETS:
                errors.append(f"[{key}] Unknown diet: {item.get('diet')}")

            cat_slug = item.get("category")
            if not FoodCategory.query.filter_by(slug=cat_slug).first():
                errors.append(f"[{key}] Unknown category: {cat_slug}")

            for allergen in item.get("allergens", []):
                if allergen not in VALID_ALLERGENS:
                    warnings_list.append(f"[{key}] Non-standard allergen: {allergen}")

            portions = item.get("portions", [])
            if not any(p.get("default") for p in portions):
                errors.append(f"[{key}] No default portion defined")

            kcal = item.get("kcal", 0)
            protein = item.get("protein", 0)
            carbs = item.get("carbs", 0)
            fat = item.get("fat", 0)
            calc = 4 * protein + 4 * carbs + 9 * fat
            if abs(kcal - calc) > 50:
                warnings_list.append(
                    f"[{key}] kcal mismatch: stated={kcal}, calc={calc:.1f}"
                )

        if errors:
            click.echo("ERRORS (fix before import):")
            for e in errors:
                click.echo(f"  {e}")
            return
        if warnings_list:
            click.echo("WARNINGS:")
            for w in warnings_list:
                click.echo(f"  {w}")

        if reset:
            Food.query.filter_by(is_sample=True).delete()
            db.session.flush()
            click.echo("Reset: deleted existing sample foods.")

        created = updated = 0
        for item in foods_data:
            cat = FoodCategory.query.filter_by(slug=item["category"]).first()
            existing = Food.query.filter_by(seed_key=item["key"]).first()
            if existing:
                food = existing
                updated += 1
            else:
                food = Food(seed_key=item["key"])
                db.session.add(food)
                created += 1

            food.name_en = item["name"]
            food.name_hi = item.get("hi")
            food.name_kn = item.get("kn")
            food.category_id = cat.id if cat else None
            food.diet = item["diet"]
            food.kcal_per_100g = Decimal(str(item["kcal"]))
            food.protein_per_100g = Decimal(str(item["protein"]))
            food.carbs_per_100g = Decimal(str(item["carbs"]))
            food.fat_per_100g = Decimal(str(item["fat"]))
            food.fibre_per_100g = Decimal(str(item.get("fibre", 0)))
            food.allergens = item.get("allergens", [])
            food.tags = item.get("tags", [])
            food.is_sample = True
            food.source = "sample"

            db.session.flush()  # get food.id

            # Aliases
            FoodAlias.query.filter_by(food_id=food.id).delete()
            for alias in item.get("aliases", []):
                normalized = "".join(
                    ch
                    for ch in alias
                    if unicodedata.category(ch)[0] in ("L", "N", "M")
                ).lower()
                db.session.add(
                    FoodAlias(
                        food_id=food.id,
                        alias=alias,
                        alias_normalized=normalized,
                    )
                )

            # Portions
            Portion.query.filter_by(food_id=food.id).delete()
            for p in item.get("portions", []):
                db.session.add(
                    Portion(
                        food_id=food.id,
                        label=p["label"],
                        grams=Decimal(str(p["grams"])),
                        is_default=bool(p.get("default")),
                    )
                )

        db.session.commit()
        invalidate_cache()
        click.echo(
            f"Done: {created} created, {updated} updated. "
            f"Version: {data.get('seedVersion')}"
        )
