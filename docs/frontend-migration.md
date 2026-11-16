# NutriLens Phase 3B: Frontend Migration & API Integration Specification

This document details the migration of NutriLens from client-side LocalStorage simulation to full backend integration with the Flask REST API (Phases 1–3A).

---

## 1. LocalStorage to API Mapping Table

| LocalStorage Key | Component(s) Using It | Current Client Data Shape | Replaced By Backend API Endpoint |
|---|---|---|---|
| `nutrisense_auth` | `AppContext`, `Topbar`, `AuthModal`, `Login`, `Register` | `{ token: string, refreshToken: string, user: { email, name, diet }, isAuthenticated: boolean }` | `POST /api/v1/auth/login`, `POST /api/v1/auth/register`, `POST /api/v1/auth/refresh`, `GET /api/v1/auth/me`. Tokens stored via `tokenStore.js` (access token in memory, refresh token in `sessionStorage`). |
| `nutrisense_profile` | `Settings`, `Topbar`, `Dashboard`, `AppContext` | `{ name, email, age, height, weight, activity, avatar, diet: [], goals: [] }` | `GET /api/v1/auth/me` (reads `user` and `profile`), `PATCH /api/v1/auth/me` (updates biometrics and preferences). |
| `nutrisense_targets` | `Dashboard`, `Nutrition`, `Settings`, `AppContext` | `{ calories, protein, carbs, fat, water }` | `GET /api/v1/dashboard/daily?date=YYYY-MM-DD` (targets dynamically calculated via Mifflin-St Jeor equation by backend targets service). |
| `nutrisense_diary` | `Nutrition`, `Dashboard`, `AddFoodModal`, `AppContext` | `{ breakfast: [item], lunch: [item], snacks: [item], dinner: [item] }` where each item has `{ id, servings, time, foodId, customFood }` | `GET /api/v1/logs?date=YYYY-MM-DD`, `POST /api/v1/logs`, `PATCH /api/v1/logs/<id>`, `DELETE /api/v1/logs/<id>`. Snapshots nutrients at log time. |
| `nutrisense_water_ml`| `Dashboard`, `AppContext` | `number` (cumulative ml integer, e.g. `1250`) | `POST /api/v1/water` (adds individual glass/amount), `GET /api/v1/water?date=YYYY-MM-DD`, `DELETE /api/v1/water/<id>`. |
| `nutrisense_prefs` | `Settings`, `AppContext` | `{ mealReminders, hydrationAlerts, weatherUpdates, weeklyReport, newRecipes }` | Retained locally (UI preferences not currently tracked in backend DB schema). |
| `nutrisense_pantry`| `Pantry`, `AppContext` | `[{ id, name, category, qty, tags }]` | Retained locally (pantry/recipes is out of scope for Phase 3). |
| `nutrisense_shopping`| `ShoppingList`, `AppContext` | `[{ id, name, category, qty, purchased, source }]` | Retained locally (shopping list out of scope for Phase 3). |
| `nutrisense_reports`| `LabReports`, `AppContext` | `[{ id, name, date, values }]` | Retained locally (lab reports / OCR out of scope for Phase 3). |
| `nutrisense_notifs` | `Topbar`, `AppContext` | `[{ id, title, desc, time, read, icon }]` | Retained locally (mock in-app notification center). |

---

## 2. Field-Name & Model Mismatches

| Dimension | Frontend Client (Old) | Backend Flask API | Resolution / Adapter Strategy |
|---|---|---|---|
| **Meal Type Enum** | `snacks` (plural) | `snack` (singular: `breakfast`, `lunch`, `snack`, `dinner`) | Frontend UI renders label as "Snacks", but maps `snacks` &rarr; `snack` in API requests (`LogsAPI.createLog`, `updateLog`) and translates `snack` &rarr; `snacks` when populating local state. |
| **Nutrient Names (Energy)** | `calories` (kcal integer) | `kcal` (log snapshot), `kcal_per_100g` (food model) | Standardized: displayed as `kcal` / calories in UI; client maps `food.kcal_per_100g` and `log.kcal`. |
| **Protein Field** | `protein` (g) | `protein_g` (log snapshot), `protein_per_100g` (food model) | Client maps `log.protein_g` and `food.protein_per_100g`. |
| **Carbohydrate Field** | `carbs` (g) | `carbs_g` (log snapshot), `carbs_per_100g` (food model) | Client maps `log.carbs_g` and `food.carbs_per_100g`. |
| **Fat Field** | `fat` (g) | `fat_g` (log snapshot), `fat_per_100g` (food model) | Client maps `log.fat_g` and `food.fat_per_100g`. |
| **Fibre Field** | `fibre` (g) | `fibre_g` (log snapshot), `fibre_per_100g` (food model) | Client displays `fibre_g` and `fibre_per_100g`. |
| **Height** | `height` (cm) | `height_cm` (DECIMAL/Integer) | `Settings.jsx` maps `height` &rarr; `height_cm` when sending `PATCH /auth/me`. |
| **Weight** | `weight` (kg) | `weight_kg` (DECIMAL) | `Settings.jsx` maps `weight` &rarr; `weight_kg` when sending `PATCH /auth/me`. |
| **Activity Level** | `"Moderately active"` | `"moderate"` (enum: `sedentary`, `light`, `moderate`, `active`, `very_active`) | Bidirectional mapping in `Settings.jsx` and `AppContext.jsx`. |
| **Dietary Preference** | `diet: ["Vegetarian"]` (array of strings) | `diet_type: "veg"` (enum: `veg`, `vegan`, `nonveg`, `eggetarian`) | UI presents chips/radios and serializes as scalar `diet_type` string. |
| **Serving / Portions**| `serving: "1 bowl (250g)"` (free text) | `portions: [{ id, label, grams, is_default }]` | Portion chip selector selects `activePortion.label` and `activePortion.grams`, or "Custom g" mode sends custom portion grams. |
| **Log Dates** | `new Date().toISOString()` (UTC datetime string) | `log_date: YYYY-MM-DD` (local calendar date), `logged_at: UTC ISO` | Handled via `src/utils/date.js`: `localToday()` guarantees local day representation (`YYYY-MM-DD`) without timezone rollback. |

---

## 3. Architecture & Token Security

1. **Access Token**:
   - Resides exclusively in memory (`_accessToken` in `src/auth/tokenStore.js`).
   - Mitigates persistent token theft from XSS attacks.
2. **Refresh Token**:
   - Kept in `sessionStorage` under `nl_rt`.
   - Cleared automatically when the user closes the browser tab.
   - *Phase 7 roadmap note*: Will be transitioned to HttpOnly, SameSite cookies on the backend to completely eliminate JavaScript token exposure.
3. **Automatic Refresh Cycle**:
   - `src/api/client.js` intercepts 401 responses.
   - Makes a single refresh attempt with the stored refresh token.
   - If successful, retries the original request with the new access token.
   - If refresh fails, clears all credentials and dispatches `nutrilens:signout` event.

---

## 4. Manual Testing Checklist

- [ ] **1. User Authentication**:
  - Register new user via `AuthModal` or `/register` (with dietary preference selection).
  - Verify tokens received and stored correctly without `console.log` leaks.
  - Sign in with existing credentials; verify welcome toast and session initialization.
  - Sign out; verify diary and water states reset cleanly and tokens are deleted.

- [ ] **2. Food Search & Autocomplete**:
  - Open Add Food dialog; type query (e.g., "paneer", "oats").
  - Verify 250ms debouncing.
  - Verify loading skeleton displays during fetch.
  - Verify food items show Hindi/Kannada regional names if available and dietary badges (`VEG`, `VEGAN`).
  - Verify warning badges appear for diet mismatches or allergen alerts.

- [ ] **3. Portion Preview & Food Logging**:
  - Select portion chips (e.g. "1 bowl (250g)") or switch to "Custom g".
  - Adjust quantity stepper (+/-); verify live calorie and macro preview updates instantly.
  - Click "Log to Meal"; verify `POST /api/v1/logs` is called.
  - Verify diary updates immediately.

- [ ] **4. Diary Management & Undo**:
  - View today's diary in `/nutrition`.
  - Edit logged entry: change meal (e.g. Lunch to Dinner) or quantity; verify `PATCH /api/v1/logs/<id>`.
  - Delete an entry; verify item is removed and floating Undo banner appears for 5 seconds.
  - Click Undo; verify item is re-created via `POST /api/v1/logs` with original nutrient snapshots.

- [ ] **5. Hydration & Optimistic Updates**:
  - On Dashboard, click "+ 250 ml".
  - Verify water gauge and glass count increase immediately (optimistic UI).
  - Verify `POST /api/v1/water` succeeds.
  - If network drops, verify counter rolls back to prior value and displays error toast.

- [ ] **6. Barcode Scanner & Open Food Facts**:
  - Open `/scanner`.
  - Allow camera access or enter manual barcode (e.g. `8901030383749`).
  - Verify `GET /api/v1/barcodes/<code>` is queried.
  - If 404: verify "Not found in Open Food Facts" message.
  - If 200: verify draft form displays prefilled values, `missing_fields` alert (if any), and `diet_verified` badge.
  - Click "Save as Custom Food"; verify `POST /api/v1/foods/custom`.
  - Click "Log to Diary"; verify food log entry is created.

- [ ] **7. Biometrics & Mifflin-St Jeor Targets**:
  - In `/settings`, view profile biometrics (age, sex, height, weight, activity).
  - If profile fields are missing, verify 409 alert banner surfaces exact missing fields.
  - Update profile and save via `PATCH /api/v1/auth/me`.
  - Verify targets recalculate automatically from `/dashboard/daily`.

- [ ] **8. Mock Mode (Demo Mode)**:
  - Set `VITE_USE_MOCK=true` in `.env.local` or environment.
  - Start application; verify all actions (search, logging, water, scanner, profile) function seamlessly without running the Flask server.
