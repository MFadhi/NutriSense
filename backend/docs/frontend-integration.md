# NutriLens — Frontend Integration Guide

This guide covers everything a Vite + React frontend needs to talk to the NutriLens Flask backend.

---

## Table of Contents

1. [Environment Setup](#1-environment-setup)
2. [Field Name Mapping](#2-field-name-mapping)
3. [Ready-to-Copy `api.js` Module](#3-ready-to-copy-apijs-module)
4. [JWT Token Storage & Refresh Flow](#4-jwt-token-storage--refresh-flow)

---

## 1. Environment Setup

Create (or update) `.env.local` in your Vite project root:

```bash
# .env.local  — do NOT commit this file
VITE_API_URL=http://localhost:5000/api/v1
```

> **Important:** Vite only exposes variables prefixed with `VITE_` to the browser bundle. Plain `API_URL` will be `undefined` at runtime.

For other environments:

| File              | Purpose                             |
|-------------------|-------------------------------------|
| `.env.local`      | Local development (git-ignored)     |
| `.env.staging`    | Staging/preview deploys             |
| `.env.production` | Production build (`npm run build`)  |

Add `.env.local` to `.gitignore` if not already there:

```
# .gitignore
.env.local
.env.*.local
```

---

## 2. Field Name Mapping

The frontend and backend use different naming conventions for several fields. Use this table as a reference when reading API responses or building request payloads.

| Frontend field   | API field                   | Notes                                                                 |
|------------------|-----------------------------|-----------------------------------------------------------------------|
| `calories`       | `kcal_per_100g` / `kcal`   | Per-100g in foods, snapshot in logs                                   |
| `servings`       | `quantity`                  | Diary uses servings, logs API uses quantity                           |
| `snacks` (meal id) | `snack`                   | Frontend plural, API singular                                         |
| `protein/carbs/fat` | `protein_g/carbs_g/fat_g` | Logs response uses `_g` suffix                                      |
| `food.id` (string) | `food.id` (int) + `seed_key` | Frontend uses string slugs, API uses integers                      |
| `food.serving`   | `portions[]`                | Per-serving string → structured portions array                        |
| `food.image`     | *(not in API)*              | API does not serve images in Phase 2                                  |

### Key Gotchas

- **`meal` values:** Always send singular lowercase: `"breakfast"`, `"lunch"`, `"snack"`, `"dinner"`. The frontend may store `"snacks"` — normalise it before POSTing.
- **`food.id`:** API returns integer IDs. If your frontend stores food IDs as strings (e.g. from local state), cast with `parseInt()` before sending.
- **`calories` display:** Use `kcal_per_100g` from `/foods` for search results and food detail; use `kcal` from `/logs` for diary totals.
- **Images:** Phase 2 returns no image URLs. Use a local placeholder or category icon — do not attempt to append a path to the food ID.

---

## 3. Ready-to-Copy `api.js` Module

Save this file as `src/api.js` (or `src/lib/api.js`) in your Vite project. It provides typed fetch helpers for every endpoint and handles JWT access-token refresh automatically.

```js
// src/api.js
// NutriLens API client — ES module, no external dependencies.
// Requires: VITE_API_URL in .env.local

const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:5000/api/v1';

// ---------------------------------------------------------------------------
// Token storage helpers
// ---------------------------------------------------------------------------
// Tokens are stored in memory for security (see §4 for trade-offs).
// On page reload the user will need to log in again unless you persist the
// refresh token (e.g. in localStorage) and call refreshToken() on boot.
// ---------------------------------------------------------------------------

let _accessToken  = null;
let _refreshToken = null;

/** Call after a successful login() or refreshToken() */
export function setTokens({ access_token, refresh_token }) {
  _accessToken  = access_token  ?? _accessToken;
  _refreshToken = refresh_token ?? _refreshToken;
}

export function clearTokens() {
  _accessToken  = null;
  _refreshToken = null;
}

export function getAccessToken()  { return _accessToken; }
export function getRefreshToken() { return _refreshToken; }


// ---------------------------------------------------------------------------
// Core fetch helper with auto-refresh
// ---------------------------------------------------------------------------

let _isRefreshing = false;
let _refreshQueue = []; // callbacks waiting for the new token

async function _drainQueue(newToken, error) {
  _refreshQueue.forEach(cb => cb(newToken, error));
  _refreshQueue = [];
}

/**
 * Wraps fetch() with:
 *  - automatic Authorization header injection
 *  - 401 → silent token refresh → one automatic retry
 *  - consistent error shape: throws { status, code, message, details }
 */
async function request(path, options = {}, useRefreshToken = false) {
  const token = useRefreshToken ? _refreshToken : _accessToken;
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers ?? {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  const res = await fetch(`${BASE_URL}${path}`, { ...options, headers });

  // ---- Happy path ----------------------------------------------------------
  if (res.ok) {
    if (res.status === 204) return null; // No content
    return res.json();
  }

  // ---- 401: attempt token refresh, then retry once -------------------------
  if (res.status === 401 && !useRefreshToken && _refreshToken) {
    if (_isRefreshing) {
      // Another request is already refreshing — queue this one
      return new Promise((resolve, reject) => {
        _refreshQueue.push((newToken, err) => {
          if (err) return reject(err);
          resolve(request(path, options)); // retry with new token in closure
        });
      });
    }

    _isRefreshing = true;
    try {
      const data = await request('/auth/refresh', { method: 'POST' }, true);
      setTokens({ access_token: data.access_token });
      _drainQueue(data.access_token, null);
      return request(path, options); // retry original request
    } catch (refreshErr) {
      clearTokens();
      _drainQueue(null, refreshErr);
      throw refreshErr;
    } finally {
      _isRefreshing = false;
    }
  }

  // ---- All other errors ----------------------------------------------------
  let errorBody;
  try { errorBody = await res.json(); } catch { errorBody = {}; }
  const apiError = errorBody?.error ?? {};
  const err = Object.assign(new Error(apiError.message ?? res.statusText), {
    status:  res.status,
    code:    apiError.code    ?? 'unknown_error',
    message: apiError.message ?? res.statusText,
    details: apiError.details ?? null,
  });
  throw err;
}


// ---------------------------------------------------------------------------
// Auth endpoints  —  /auth/*
// ---------------------------------------------------------------------------

/**
 * Register a new account.
 * @param {string} email
 * @param {string} password
 * @returns {{ message: string, user: { id, email, created_at } }}
 */
export async function register(email, password) {
  return request('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
}

/**
 * Log in and store the returned tokens.
 * @param {string} email
 * @param {string} password
 * @returns {{ access_token, refresh_token, user }}
 */
export async function login(email, password) {
  const data = await request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  setTokens(data);
  return data;
}

/**
 * Exchange the stored refresh token for a new access token.
 * Called automatically by request() on 401, but you can call it manually on
 * app boot if you have persisted the refresh token.
 * @returns {{ access_token: string }}
 */
export async function refreshToken() {
  const data = await request('/auth/refresh', { method: 'POST' }, true);
  setTokens({ access_token: data.access_token });
  return data;
}

/**
 * Get the authenticated user's profile.
 * @returns {{ id, email, created_at, profile: { ... } }}
 */
export async function getMe() {
  return request('/auth/me');
}

/**
 * Update the user's profile (any subset of fields).
 * @param {Partial<{ age, gender, height_cm, weight_kg, activity_level, diet_type, goal, allergies }>} updates
 * @returns Updated user + profile
 */
export async function updateMe(updates) {
  return request('/auth/me', {
    method: 'PATCH',
    body: JSON.stringify(updates),
  });
}

/**
 * Delete all logs and profile data (account stays).
 * @returns {{ message: string }}
 */
export async function deleteMyData() {
  return request('/auth/me/data', { method: 'DELETE' });
}


// ---------------------------------------------------------------------------
// Foods endpoints  —  /foods/*
// ---------------------------------------------------------------------------

/**
 * Search and filter foods.
 * @param {{ q?, category?, diet?, limit?, offset? }} params
 * @returns {{ foods: Food[], total, limit, offset }}
 */
export async function searchFoods({ q, category, diet, limit = 20, offset = 0 } = {}) {
  const qs = new URLSearchParams();
  if (q)        qs.set('q',        q);
  if (category) qs.set('category', category);
  if (diet)     qs.set('diet',     diet);
  qs.set('limit',  String(limit));
  qs.set('offset', String(offset));
  return request(`/foods?${qs}`);
}

/**
 * Get full nutritional detail for one food.
 * @param {number} id
 * @returns {FoodDetail}
 */
export async function getFoodDetail(id) {
  return request(`/foods/${id}`);
}

/**
 * List all food categories.
 * @returns {{ categories: { id, slug, label_en }[] }}
 */
export async function getCategories() {
  return request('/foods/categories');
}

/**
 * Get the last 10 distinct foods logged by the current user.
 * Requires authentication.
 * @returns {{ foods: Food[] }}
 */
export async function getRecentFoods() {
  return request('/foods/recent');
}


// ---------------------------------------------------------------------------
// Log endpoints  —  /logs/*
// ---------------------------------------------------------------------------

/**
 * Create a new diary entry.
 * @param {{ food_id?, food_name?, meal, log_date, quantity, portion_id? }} entry
 * @returns {{ log: LogEntry }}
 */
export async function createLog({ food_id, food_name, meal, log_date, quantity, portion_id } = {}) {
  // Normalise frontend "snacks" -> API "snack"
  const normalisedMeal = meal === 'snacks' ? 'snack' : meal;
  return request('/logs', {
    method: 'POST',
    body: JSON.stringify({
      ...(food_id   != null ? { food_id: parseInt(food_id, 10) } : {}),
      ...(food_name != null ? { food_name } : {}),
      meal:     normalisedMeal,
      log_date,
      quantity: Number(quantity),
      ...(portion_id != null ? { portion_id } : {}),
    }),
  });
}

/**
 * Get diary entries for a date, grouped by meal.
 * @param {string} date  YYYY-MM-DD
 * @returns {{ date, meals: { breakfast, lunch, snack, dinner }, day_totals, total_entries }}
 */
export async function getLogs(date) {
  return request(`/logs?date=${encodeURIComponent(date)}`);
}

/**
 * Update a log entry's quantity and/or meal.
 * Nutrient values are rescaled server-side when quantity changes.
 * @param {number} id
 * @param {{ quantity?, meal? }} updates
 * @returns {{ log: LogEntry }}
 */
export async function updateLog(id, { quantity, meal } = {}) {
  const normalisedMeal = meal === 'snacks' ? 'snack' : meal;
  return request(`/logs/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({
      ...(quantity != null ? { quantity: Number(quantity) } : {}),
      ...(normalisedMeal != null ? { meal: normalisedMeal } : {}),
    }),
  });
}

/**
 * Delete a log entry.
 * @param {number} id
 * @returns {{ message: string }}
 */
export async function deleteLog(id) {
  return request(`/logs/${id}`, { method: 'DELETE' });
}
```

### Usage Examples

```js
import { login, searchFoods, createLog, getLogs } from './api';

// Log in
await login('user@example.com', 'password123');

// Search
const { foods } = await searchFoods({ q: 'rice', diet: 'veg' });

// Add a diary entry
await createLog({
  food_id:  foods[0].id,
  meal:     'lunch',
  log_date: '2024-01-15',
  quantity: 1.5,
});

// Retrieve today's diary
const diary = await getLogs('2024-01-15');
console.log(diary.day_totals.kcal); // e.g. 540
```

---

## 4. JWT Token Storage & Refresh Flow

### Storage Strategies

| Strategy                   | XSS Risk | CSRF Risk | Survives Reload | Recommendation             |
|----------------------------|----------|-----------|-----------------|----------------------------|
| **Memory (JS variable)**   | ✅ Low   | ✅ Low    | ❌ No           | Use for access token       |
| **`localStorage`**         | ⚠ High  | ✅ Low    | ✅ Yes          | Avoid for access token     |
| **`sessionStorage`**       | ⚠ High  | ✅ Low    | ❌ No (tab only)| Acceptable for access token|
| **`HttpOnly` cookie**      | ✅ Low   | ⚠ Medium | ✅ Yes          | Ideal but needs backend change |

**Recommended approach (implemented in `api.js` above):**

- Store the **access token in memory only** — it expires in 15 minutes anyway.
- Store the **refresh token in `localStorage`** so users stay logged in across page reloads. Accept the XSS risk and mitigate with a strict CSP.
- On **app boot**, read the refresh token from `localStorage` and call `refreshToken()` to get a fresh access token before rendering protected routes.

```js
// main.jsx / App.jsx  — run once on boot
import { refreshToken, setTokens } from './api';

async function boot() {
  const storedRefresh = localStorage.getItem('refresh_token');
  if (storedRefresh) {
    setTokens({ refresh_token: storedRefresh });
    try {
      await refreshToken();         // populates _accessToken in memory
    } catch {
      localStorage.removeItem('refresh_token'); // expired — force re-login
    }
  }
}
```

After `login()`, persist the refresh token:

```js
const data = await login(email, password);
localStorage.setItem('refresh_token', data.refresh_token);
```

On logout, clear everything:

```js
import { clearTokens } from './api';
clearTokens();
localStorage.removeItem('refresh_token');
```

### Refresh Flow Diagram

```
Browser                        API server
  |                               |
  |── GET /logs?date=... ────────>|
  |<── 401 Unauthorized ──────────|
  |                               |
  |  [api.js detects 401,         |
  |   queues concurrent requests] |
  |── POST /auth/refresh ────────>|  (uses refresh_token)
  |<── { access_token: "..." } ───|
  |                               |
  |── GET /logs?date=... ────────>|  (retried with new access_token)
  |<── { date, meals, ... } ──────|
  |                               |
  |  [all queued requests retry   |
  |   with new access_token]      |
```

### Token Expiry Reference

| Token         | Lifetime   | Action on expiry              |
|---------------|------------|-------------------------------|
| Access token  | 15 minutes | Auto-refreshed by `api.js`    |
| Refresh token | 30 days    | User must log in again        |

> **Security note:** Never send tokens to third-party services, never log them to the console in production, and always use HTTPS in staging/production.
