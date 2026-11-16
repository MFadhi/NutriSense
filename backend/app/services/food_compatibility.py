STANDARD_ALLERGENS = {
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


def get_warnings(food, user_profile):
    """
    Evaluate food compatibility against user profile diet and allergies.
    Warn, never hide.
    veg -> warn for egg and nonveg
    eggetarian -> warn for nonveg
    vegan -> anything not vegan
    nonveg -> none
    Allergy -> warn if in food.allergens, or (custom text allergy) if it appears in name/aliases.
    Return [{kind: "allergen"|"diet", detail}].
    """
    warnings = []
    if not user_profile:
        return warnings

    diet = (user_profile.diet_type or "").strip().lower()

    # Diet warnings
    if diet == "veg":
        if food.diet in ("egg", "nonveg"):
            warnings.append(
                {
                    "kind": "diet",
                    "detail": (
                        "This food is egg-based and may not suit your vegetarian preference."
                        if food.diet == "egg"
                        else "This food is non-vegetarian and may not suit your vegetarian preference."
                    ),
                }
            )
    elif diet == "eggetarian":
        if food.diet == "nonveg":
            warnings.append(
                {
                    "kind": "diet",
                    "detail": "This food is non-vegetarian and may not suit your eggetarian preference.",
                }
            )
    elif diet == "vegan":
        if food.diet != "vegan":
            warnings.append({"kind": "diet", "detail": "This food is not vegan."})
    # nonveg: no warnings

    # Unverified diet warning for veg/eggetarian/vegan
    diet_verified = getattr(food, "diet_verified", True)
    if diet_verified is False and diet in ("veg", "eggetarian", "vegan"):
        warnings.append(
            {
                "kind": "unverified_diet",
                "detail": "Diet classification is unverified for this product.",
            }
        )

    # Allergy warnings
    food_allergens = [str(a).strip().lower() for a in (food.allergens or [])]
    for allergen in user_profile.allergies or []:
        allergen_clean = str(allergen).strip().lower()
        if not allergen_clean:
            continue
        if allergen_clean in food_allergens:
            warnings.append(
                {
                    "kind": "allergen",
                    "detail": f"Contains {allergen} — matches your allergy profile.",
                }
            )
        elif allergen_clean not in STANDARD_ALLERGENS:
            # Custom allergen text: check in food names and aliases
            names_to_check = [
                food.name_en or "",
                food.name_hi or "",
                food.name_kn or "",
            ] + [a.alias for a in (food.aliases or [])]
            for name in names_to_check:
                if allergen_clean in name.lower():
                    warnings.append(
                        {
                            "kind": "allergen",
                            "detail": f"Food name contains '{allergen}' — matches your allergy profile.",
                        }
                    )
                    break

    return warnings
