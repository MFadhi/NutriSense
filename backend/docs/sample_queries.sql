-- NutriLens sample_queries.sql
-- MySQL Workbench sample queries

-- 1. Find all foods in a category
SELECT f.id, f.name_en, f.name_hi, f.diet, f.kcal_per_100g
FROM foods f
JOIN food_categories c ON f.category_id = c.id
WHERE c.slug = 'mains'
ORDER BY f.name_en;

-- 2. Search foods by name (English)
SELECT id, name_en, name_hi, diet, kcal_per_100g
FROM foods
WHERE name_en LIKE '%paneer%'
   OR name_hi LIKE '%पनीर%'
ORDER BY name_en
LIMIT 20;

-- 3. Get user's logs for a specific date
SELECT fl.id, fl.food_name, fl.meal, fl.quantity, fl.portion_label,
       fl.kcal, fl.protein_g, fl.carbs_g, fl.fat_g, fl.fibre_g
FROM food_logs fl
WHERE fl.user_id = 1
  AND fl.log_date = '2026-11-14'
ORDER BY fl.logged_at;

-- 4. Nutrient totals by meal for a user+date
SELECT
    meal,
    ROUND(SUM(kcal), 2)      AS total_kcal,
    ROUND(SUM(protein_g), 2) AS total_protein_g,
    ROUND(SUM(carbs_g), 2)   AS total_carbs_g,
    ROUND(SUM(fat_g), 2)     AS total_fat_g,
    ROUND(SUM(fibre_g), 2)   AS total_fibre_g
FROM food_logs
WHERE user_id = 1
  AND log_date = '2026-11-14'
GROUP BY meal
ORDER BY FIELD(meal, 'breakfast', 'lunch', 'snack', 'dinner');

-- 5. Most logged foods for a user (top 10 by frequency)
SELECT
    fl.food_name,
    fl.food_id,
    COUNT(*) AS times_logged,
    ROUND(AVG(fl.kcal), 1) AS avg_kcal
FROM food_logs fl
WHERE fl.user_id = 1
  AND fl.food_id IS NOT NULL
GROUP BY fl.food_id, fl.food_name
ORDER BY times_logged DESC
LIMIT 10;

-- 6. Check kcal consistency in seed data
-- Flags foods where stated kcal differs from 4P+4C+9F by more than 50
SELECT
    id,
    seed_key,
    name_en,
    kcal_per_100g AS stated_kcal,
    ROUND(4*protein_per_100g + 4*carbs_per_100g + 9*fat_per_100g, 1) AS calculated_kcal,
    ROUND(ABS(kcal_per_100g - (4*protein_per_100g + 4*carbs_per_100g + 9*fat_per_100g)), 1) AS diff
FROM foods
WHERE is_sample = 1
  AND ABS(kcal_per_100g - (4*protein_per_100g + 4*carbs_per_100g + 9*fat_per_100g)) > 50
ORDER BY diff DESC;
