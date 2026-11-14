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
    warnings = []
    if not user_profile:
        return warnings

    diet = user_profile.diet_type

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

    # Allergy warnings
    for allergen in user_profile.allergies or []:
        allergen_lower = allergen.lower()
        if allergen_lower in (food.allergens or []):
            warnings.append(
                {
                    "kind": "allergy",
                    "detail": f"Contains {allergen} — matches your allergy profile.",
                }
            )
        elif allergen_lower not in STANDARD_ALLERGENS:
            # Custom allergen text: check in food names and aliases
            names_to_check = [
                food.name_en or "",
                food.name_hi or "",
                food.name_kn or "",
            ] + [a.alias for a in food.aliases]
            for name in names_to_check:
                if allergen_lower in name.lower():
                    warnings.append(
                        {
                            "kind": "allergy",
                            "detail": f"Food name contains '{allergen}' — matches your allergy profile.",
                        }
                    )
                    break

    return warnings
