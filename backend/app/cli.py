import click
import json
from decimal import Decimal
from .services.food_search import normalize_food_text, invalidate_cache

VALID_ALLERGENS = {
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
}

VALID_DIETS = {"vegan", "veg", "egg", "nonveg"}

CANONICAL_CATEGORIES = {
    "breads": "Breads",
    "grains": "Grains",
    "tiffin": "Tiffin",
    "dals": "Dals",
    "veg_dishes": "Veg Dishes",
    "egg_meat_fish": "Egg, Meat & Fish",
    "dairy": "Dairy",
    "fruits": "Fruits",
    "vegetables": "Vegetables",
    "nuts_seeds": "Nuts & Seeds",
    "snacks": "Snacks",
    "sweets": "Sweets",
    "drinks": "Drinks",
    "staples": "Staples",
}


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
        help="Delete all existing sample foods before importing.",
    )
    def seed_foods(seed_file, reset):
        """Seed the database with foods from a JSON file in one transaction."""
        from .extensions import db
        from .models.food import Food, FoodCategory, FoodAlias, Portion

        with open(seed_file, "r", encoding="utf-8") as f:
            data = json.load(f)

        foods_data = data.get("foods", [])
        version = data.get("seedVersion", "unknown")
        disclaimer = data.get("disclaimer", "")

        errors = []
        kcal_warnings = []

        # Gather all categories from file
        category_slugs = set(CANONICAL_CATEGORIES.keys())
        for item in foods_data:
            cat = item.get("category")
            if cat:
                category_slugs.add(cat)

        # Validate entries
        for item in foods_data:
            key = item.get("key", "?")
            diet = item.get("diet")
            if diet not in VALID_DIETS:
                errors.append(f"[{key}] Unknown diet: {diet}")

            for allergen in item.get("allergens", []):
                if allergen not in VALID_ALLERGENS:
                    errors.append(f"[{key}] Unknown allergen: {allergen}")

            portions = item.get("portions", [])
            if not portions or not any(p.get("default") for p in portions):
                errors.append(f"[{key}] No default portion defined")

            # Check kcal vs 4p + 4c + 9f
            try:
                kcal = float(item.get("kcal", 0))
                protein = float(item.get("protein", 0))
                carbs = float(item.get("carbs", 0))
                fat = float(item.get("fat", 0))
                calc = 4.0 * protein + 4.0 * carbs + 9.0 * fat
                if calc > 0:
                    diff_pct = abs(kcal - calc) / calc
                    if diff_pct > 0.25:
                        kcal_warnings.append(
                            f"[{key}] kcal differs by {diff_pct * 100:.1f}% from 4p+4c+9f (stated={kcal}, calculated={calc:.1f})"
                        )
            except (ValueError, TypeError):
                pass

        # Print validation report
        click.echo("================ SEED VALIDATION REPORT ================")
        click.echo(f"Seed Version: {version}")
        if disclaimer:
            click.echo(f"Disclaimer:   {disclaimer}")
        click.echo(f"Foods found:  {len(foods_data)}")
        click.echo(f"Errors:       {len(errors)}")
        click.echo(f"Kcal warnings (>25%): {len(kcal_warnings)}")

        if errors:
            click.echo("\nValidation Errors encountered:")
            for e in errors:
                click.echo(f"  ERROR: {e}")
            click.echo("\nSeed aborted due to validation errors.")
            return

        if kcal_warnings:
            click.echo("\nEnergy validation notices:")
            for w in kcal_warnings:
                click.echo(f"  NOTICE: {w}")
        click.echo("========================================================")

        try:
            # 1. Upsert categories
            for slug in category_slugs:
                cat = FoodCategory.query.filter_by(slug=slug).first()
                if not cat:
                    label = CANONICAL_CATEGORIES.get(slug, slug.replace("_", " ").title())
                    db.session.add(FoodCategory(slug=slug, label_en=label))
            db.session.flush()

            # 2. Reset if requested
            if reset:
                # Food logs reference foods with SET NULL, portions/aliases cascade
                Food.query.filter_by(is_sample=True).delete()
                db.session.flush()
                click.echo("Reset: existing sample foods removed.")

            # 3. Idempotent upsert in one transaction
            cat_map = {c.slug: c.id for c in FoodCategory.query.all()}
            created = 0
            updated = 0

            for item in foods_data:
                key = item.get("key")
                existing = Food.query.filter_by(seed_key=key).first()
                if existing:
                    food = existing
                    updated += 1
                else:
                    food = Food(seed_key=key)
                    db.session.add(food)
                    created += 1

                food.name_en = item["name"]
                food.name_hi = item.get("hi")
                food.name_kn = item.get("kn")
                food.category_id = cat_map.get(item.get("category"))
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

                db.session.flush()

                # Portions: replace
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

                # Aliases: replace using normalized rule
                FoodAlias.query.filter_by(food_id=food.id).delete()
                for alias in item.get("aliases", []):
                    db.session.add(
                        FoodAlias(
                            food_id=food.id,
                            alias=alias,
                            alias_normalized=normalize_food_text(alias),
                        )
                    )

            db.session.commit()
            invalidate_cache()
            click.echo(
                f"Successfully seeded foods in ONE transaction: {created} created, {updated} updated."
            )
        except Exception as ex:
            db.session.rollback()
            click.echo(f"Database error during seed: {ex}", err=True)
            raise
