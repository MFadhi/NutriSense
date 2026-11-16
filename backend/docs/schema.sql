-- =============================================================================
-- NutriLens Database Schema
-- MySQL 8.0 | ENGINE=InnoDB | utf8mb4_unicode_ci
-- =============================================================================
-- Run this file against an empty database to bootstrap the schema.
-- For production, prefer Flask-Migrate generated migrations instead.
-- =============================================================================

SET NAMES utf8mb4;
SET time_zone = '+00:00';
SET foreign_key_checks = 0;

-- ---------------------------------------------------------------------------
-- users
-- Core authentication table. Stores credentials only; profile data is in
-- user_profiles. Passwords are stored as bcrypt hashes via Werkzeug.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
    id              INT             NOT NULL AUTO_INCREMENT,
    email           VARCHAR(255)    NOT NULL COMMENT 'User email, used as login identifier',
    password_hash   VARCHAR(255)    NOT NULL COMMENT 'Werkzeug/bcrypt password hash',
    created_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    PRIMARY KEY (id),
    UNIQUE KEY uq_users_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='User accounts — credentials only';


-- ---------------------------------------------------------------------------
-- user_profiles
-- One-to-one extension of users. Holds diet preferences, body metrics, and
-- allergy list. Created lazily on first PATCH /auth/me call.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS user_profiles (
    id              INT             NOT NULL AUTO_INCREMENT,
    user_id         INT             NOT NULL COMMENT 'FK to users(id)',
    age             INT             DEFAULT NULL COMMENT 'Age in years',
    gender          VARCHAR(20)     DEFAULT NULL COMMENT 'male | female | other | prefer_not_to_say',
    height_cm       DECIMAL(5,1)    DEFAULT NULL COMMENT 'Height in centimetres',
    weight_kg       DECIMAL(5,1)    DEFAULT NULL COMMENT 'Weight in kilograms',
    activity_level  VARCHAR(30)     DEFAULT NULL COMMENT 'sedentary | light | moderate | active | very_active',
    diet_type       VARCHAR(20)     DEFAULT NULL COMMENT 'veg | vegan | nonveg | eggetarian',
    goal            TEXT            DEFAULT NULL COMMENT 'Free-text user goal (e.g. "Lose 5 kg")',
    allergies       JSON            DEFAULT NULL COMMENT 'JSON array of allergen strings, e.g. ["gluten","nuts"]',
    created_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    PRIMARY KEY (id),
    UNIQUE KEY uq_user_profiles_user_id (user_id),
    CONSTRAINT fk_user_profiles_user
        FOREIGN KEY (user_id) REFERENCES users (id)
        ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Extended user profile — diet preferences and body metrics';


-- ---------------------------------------------------------------------------
-- food_categories
-- Lookup table for food categories (grains, dairy, vegetables, etc.).
-- Seeded at startup via flask seed-foods; not user-editable.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS food_categories (
    id              INT             NOT NULL AUTO_INCREMENT,
    slug            VARCHAR(50)     NOT NULL COMMENT 'URL-safe identifier, e.g. "grains"',
    label_en        VARCHAR(100)    NOT NULL COMMENT 'Display name in English',

    PRIMARY KEY (id),
    UNIQUE KEY uq_food_categories_slug (slug)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Food category lookup table';


-- ---------------------------------------------------------------------------
-- foods
-- Master food item table. Includes per-100g macronutrient data, allergen and
-- tag metadata, and provenance fields. Sample foods are seeded from
-- seed/foods_seed.json; user-submitted custom foods have owner_user_id set and is_sample=0.
-- A FULLTEXT index on the three name columns powers search.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS foods (
    id              INT             NOT NULL AUTO_INCREMENT,
    seed_key        VARCHAR(100)    DEFAULT NULL  COMMENT 'Stable identifier used in seed JSON (e.g. "rice_white_cooked")',
    name_en         VARCHAR(200)    NOT NULL      COMMENT 'English name',
    name_hi         VARCHAR(200)    DEFAULT NULL  COMMENT 'Hindi name (Devanagari script)',
    name_kn         VARCHAR(200)    DEFAULT NULL  COMMENT 'Kannada name',
    category_id     INT             DEFAULT NULL  COMMENT 'FK to food_categories(id)',

    -- Diet classification
    diet            ENUM('vegan', 'veg', 'egg', 'nonveg') NOT NULL DEFAULT 'veg' COMMENT 'vegan | veg | egg | nonveg',

    -- Per-100g macronutrients (IFCT 2017 / USDA)
    kcal_per_100g       DECIMAL(7,2)  NOT NULL COMMENT 'Energy (kcal) per 100 g',
    protein_per_100g    DECIMAL(7,2)  NOT NULL COMMENT 'Protein (g) per 100 g',
    carbs_per_100g      DECIMAL(7,2)  NOT NULL COMMENT 'Carbohydrates (g) per 100 g',
    fat_per_100g        DECIMAL(7,2)  NOT NULL COMMENT 'Total fat (g) per 100 g',
    fibre_per_100g      DECIMAL(7,2)  DEFAULT 0.00 COMMENT 'Dietary fibre (g) per 100 g',

    -- Metadata & Phase 3 additions
    allergens       JSON            DEFAULT NULL COMMENT 'JSON array of allergen strings, e.g. ["gluten","dairy"]',
    tags            JSON            DEFAULT NULL COMMENT 'JSON array of descriptive tags, e.g. ["staple","south-indian"]',
    is_sample       TINYINT(1)      NOT NULL DEFAULT 1 COMMENT '1 = seeded sample data; 0 = user-submitted',
    source          ENUM('sample', 'user', 'openfoodfacts', 'usda') NOT NULL DEFAULT 'sample' COMMENT 'Data source: sample | user | openfoodfacts | usda',
    barcode         VARCHAR(50)     DEFAULT NULL  COMMENT 'EAN/UPC barcode for packaged foods',
    owner_user_id   INT             DEFAULT NULL  COMMENT 'FK to users(id); NULL = global catalogue food, set = custom food',
    diet_verified   TINYINT(1)      NOT NULL DEFAULT 1 COMMENT '1 = verified diet classification, 0 = unverified',
    needs_review    TINYINT(1)      NOT NULL DEFAULT 0 COMMENT '1 = incomplete nutrient data or unverified diet',

    created_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    PRIMARY KEY (id),
    UNIQUE KEY uq_foods_seed_key (seed_key),
    KEY idx_foods_name_en (name_en),
    KEY idx_foods_category_id (category_id),
    KEY idx_foods_barcode (barcode),
    KEY idx_foods_owner (owner_user_id),

    -- Full-text search across all language name columns (MySQL only)
    FULLTEXT INDEX ft_foods_names (name_en, name_hi, name_kn),

    CONSTRAINT fk_foods_category
        FOREIGN KEY (category_id) REFERENCES food_categories (id)
        ON DELETE SET NULL ON UPDATE CASCADE,

    CONSTRAINT fk_foods_owner
        FOREIGN KEY (owner_user_id) REFERENCES users (id)
        ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Master food item catalogue with per-100g nutrition data and user custom foods';


-- ---------------------------------------------------------------------------
-- food_aliases
-- Alternative names and transliterations for search. Each alias is stored
-- normalised (lowercase, stripped of diacritics) for fast LIKE/FULLTEXT
-- matching. E.g. "dahi" and "curd" both alias "Yoghurt".
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS food_aliases (
    id                  INT             NOT NULL AUTO_INCREMENT,
    food_id             INT             NOT NULL COMMENT 'FK to foods(id)',
    alias               VARCHAR(200)    NOT NULL COMMENT 'Display alias (original casing)',
    alias_normalized    VARCHAR(200)    NOT NULL COMMENT 'Lowercase, ASCII-folded alias for matching',

    PRIMARY KEY (id),
    KEY idx_food_aliases_food_id (food_id),
    KEY idx_food_aliases_normalized (alias_normalized),

    CONSTRAINT fk_food_aliases_food
        FOREIGN KEY (food_id) REFERENCES foods (id)
        ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Search aliases and transliterations for food items';


-- ---------------------------------------------------------------------------
-- portions
-- Pre-defined serving sizes for a food (e.g. "1 cup (cooked) = 200 g").
-- Exactly one portion per food may have is_default=1; the app falls back to
-- this when the user does not specify a portion_id in a log entry.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS portions (
    id              INT             NOT NULL AUTO_INCREMENT,
    food_id         INT             NOT NULL COMMENT 'FK to foods(id)',
    label           VARCHAR(100)    NOT NULL COMMENT 'Human-readable label, e.g. "1 cup (cooked)"',
    grams           DECIMAL(7,2)    NOT NULL COMMENT 'Weight in grams for this portion',
    is_default      TINYINT(1)      NOT NULL DEFAULT 0 COMMENT '1 = default portion for this food',

    PRIMARY KEY (id),
    KEY idx_portions_food_id (food_id),

    CONSTRAINT fk_portions_food
        FOREIGN KEY (food_id) REFERENCES foods (id)
        ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Serving size definitions for food items';


-- ---------------------------------------------------------------------------
-- food_logs
-- Diary entries: each row records one food a user ate at a specific meal.
-- Nutrient values (kcal, protein_g, etc.) are stored as a snapshot at log
-- time so that edits to the foods table do not retroactively change history.
-- food_id is SET NULL if the food is later deleted from the catalogue.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS food_logs (
    id              INT             NOT NULL AUTO_INCREMENT,
    user_id         INT             NOT NULL COMMENT 'FK to users(id)',
    food_id         INT             DEFAULT NULL  COMMENT 'FK to foods(id), nullable (SET NULL on food delete)',
    food_name       VARCHAR(200)    NOT NULL      COMMENT 'Snapshot of food name at log time',
    meal            ENUM('breakfast', 'lunch', 'snack', 'dinner') NOT NULL COMMENT 'breakfast | lunch | snack | dinner',
    logged_at       DATETIME        NOT NULL      COMMENT 'UTC timestamp when entry was created',
    log_date        DATE            NOT NULL      COMMENT 'Calendar date the entry belongs to (may differ from logged_at)',

    -- Quantity and portion snapshot
    quantity        DECIMAL(8,2)    NOT NULL      COMMENT 'Number of portions consumed',
    portion_label   VARCHAR(100)    DEFAULT NULL  COMMENT 'Snapshot of portion label, e.g. "1 cup (cooked)"',
    portion_grams   DECIMAL(7,2)    DEFAULT NULL  COMMENT 'Snapshot of portion weight in grams',

    -- Nutrient snapshot (scaled by quantity at log time, rescaled on PATCH)
    kcal            DECIMAL(8,2)    DEFAULT NULL  COMMENT 'Energy consumed (kcal)',
    protein_g       DECIMAL(8,2)    DEFAULT NULL  COMMENT 'Protein consumed (g)',
    carbs_g         DECIMAL(8,2)    DEFAULT NULL  COMMENT 'Carbohydrates consumed (g)',
    fat_g           DECIMAL(8,2)    DEFAULT NULL  COMMENT 'Fat consumed (g)',
    fibre_g         DECIMAL(8,2)    DEFAULT NULL  COMMENT 'Dietary fibre consumed (g)',

    created_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    PRIMARY KEY (id),

    -- Index for diary view queries: user's logs on a given date
    KEY idx_food_logs_user_date     (user_id, log_date),
    -- Index for recent-logs and timeline queries
    KEY idx_food_logs_user_logged   (user_id, logged_at),

    CONSTRAINT fk_food_logs_user
        FOREIGN KEY (user_id) REFERENCES users (id)
        ON DELETE CASCADE ON UPDATE CASCADE,

    CONSTRAINT fk_food_logs_food
        FOREIGN KEY (food_id) REFERENCES foods (id)
        ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Food diary entries — nutrient values are snapshots, not live FK values';


-- ---------------------------------------------------------------------------
-- water_logs
-- Daily water intake tracker entries.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS water_logs (
    id              INT             NOT NULL AUTO_INCREMENT,
    user_id         INT             NOT NULL COMMENT 'FK to users(id)',
    log_date        DATE            NOT NULL COMMENT 'Local date of the log',
    amount_ml       INT             NOT NULL COMMENT 'Millilitres of water consumed (1 - 2000)',
    logged_at       DATETIME        NOT NULL COMMENT 'UTC timestamp when entry was logged',
    created_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (id),
    KEY idx_water_logs_user_date (user_id, log_date),

    CONSTRAINT fk_water_logs_user
        FOREIGN KEY (user_id) REFERENCES users (id)
        ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Water intake tracking logs';


-- ---------------------------------------------------------------------------
-- external_product_cache
-- Cached Open Food Facts product responses and negative lookups.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS external_product_cache (
    barcode         VARCHAR(50)     NOT NULL COMMENT 'GS1 barcode (EAN-13, EAN-8, UPC-A)',
    source          VARCHAR(50)     NOT NULL DEFAULT 'openfoodfacts' COMMENT 'External provider name',
    status          ENUM('found', 'not_found') NOT NULL COMMENT 'Lookup outcome',
    payload         JSON            DEFAULT NULL COMMENT 'Parsed food draft payload (found only)',
    fetched_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at      DATETIME        NOT NULL COMMENT 'Cache expiration timestamp (UTC)',

    PRIMARY KEY (barcode)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Cache for external product API lookups (e.g. Open Food Facts)';


SET foreign_key_checks = 1;

-- =============================================================================
-- End of schema
-- =============================================================================
