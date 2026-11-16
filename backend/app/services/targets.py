"""Daily nutrition and hydration target calculations based on Mifflin-St Jeor."""

ACTIVITY_FACTORS = {
    "sedentary": 1.2,
    "light": 1.375,
    "lightly_active": 1.375,
    "moderate": 1.55,
    "moderately_active": 1.55,
    "active": 1.725,
    "very_active": 1.9,
    "extra_active": 1.9,
}


def is_profile_complete(profile) -> bool:
    """Return True if profile has all required metrics for calculating targets."""
    if not profile:
        return False
    if not (profile.age and int(profile.age) > 0):
        return False
    if not (profile.gender and str(profile.gender).strip()):
        return False
    if not (profile.height_cm and float(profile.height_cm) > 0):
        return False
    if not (profile.weight_kg and float(profile.weight_kg) > 0):
        return False
    return True


def calculate_bmr(weight_kg: float, height_cm: float, age: int, gender: str) -> float:
    """
    Calculate Basal Metabolic Rate using Mifflin-St Jeor equation.
    male +5, female -161, other -78.
    """
    gender_clean = (gender or "").strip().lower()
    if gender_clean == "male":
        s = 5.0
    elif gender_clean == "female":
        s = -161.0
    else:
        s = -78.0

    return (10.0 * float(weight_kg)) + (6.25 * float(height_cm)) - (5.0 * float(age)) + s


def calculate_targets(profile) -> dict:
    """
    Calculate daily calorie, macronutrient, fibre, and water targets from profile.
    Raises ValueError if profile is incomplete.
    """
    if not is_profile_complete(profile):
        raise ValueError("Profile is incomplete")

    age = int(profile.age)
    gender = str(profile.gender).strip().lower()
    height_cm = float(profile.height_cm)
    weight_kg = float(profile.weight_kg)

    # Activity factor
    act_str = str(profile.activity_level or "moderate").strip().lower().replace(" ", "_").replace("-", "_")
    activity_factor = ACTIVITY_FACTORS.get(act_str, 1.55)

    # 1. BMR & TDEE
    bmr = calculate_bmr(weight_kg, height_cm, age, gender)
    tdee = bmr * activity_factor

    # 2. Goal adjustments: lose -500, maintain 0, gain +300
    goal_str = str(profile.goal or "maintain").strip().lower()
    if "lose" in goal_str or "cut" in goal_str:
        adjustment = -500.0
        is_lose_or_gain = True
    elif "gain" in goal_str or "bulk" in goal_str:
        adjustment = 300.0
        is_lose_or_gain = True
    else:
        adjustment = 0.0
        is_lose_or_gain = False

    raw_kcal = tdee + adjustment

    # 3. Floor: female 1200, male 1500, other 1350
    if gender == "male":
        floor_kcal = 1500.0
    elif gender == "female":
        floor_kcal = 1200.0
    else:
        floor_kcal = 1350.0

    target_kcal = max(raw_kcal, floor_kcal)
    final_kcal = round(target_kcal)

    # 4. Protein: 1.6 g/kg (lose, gain) or 1.2 g/kg (maintain), capped at 35% kcal (4 kcal/g)
    protein_per_kg = 1.6 if is_lose_or_gain else 1.2
    raw_protein = weight_kg * protein_per_kg
    max_protein = (final_kcal * 0.35) / 4.0
    protein_g = min(raw_protein, max_protein)

    # 5. Fat: 25% of kcal (9 kcal/g)
    fat_g = (final_kcal * 0.25) / 9.0

    # 6. Carbs: remaining kcal (4 kcal/g)
    used_kcal = (protein_g * 4.0) + (fat_g * 9.0)
    carbs_kcal = max(0.0, final_kcal - used_kcal)
    carbs_g = carbs_kcal / 4.0

    # 7. Fibre: 14 g per 1000 kcal clamped to [25, 38] g
    raw_fibre = (final_kcal / 1000.0) * 14.0
    fibre_g = max(25.0, min(38.0, raw_fibre))

    # 8. Water: 35 ml/kg rounded to nearest 50 ml, clamped to [1500, 4000] ml
    raw_water = (weight_kg * 35.0) / 50.0
    rounded_water = round(raw_water) * 50
    water_ml = int(max(1500, min(4000, rounded_water)))

    return {
        "bmr": round(bmr, 2),
        "kcal": final_kcal,
        "protein_g": round(protein_g, 1),
        "carbs_g": round(carbs_g, 1),
        "fat_g": round(fat_g, 1),
        "fibre_g": round(fibre_g, 1),
        "water_ml": water_ml,
    }
