# NutriLens API Reference

**Base URL:** `http://localhost:5000/api/v1`  
**Content-Type:** `application/json` (all requests and responses)  
**Authentication:** JWT Bearer tokens (see [Auth](#auth-apiv1auth))

---

## Table of Contents

1. [Health](#health-get-health)
2. [Auth](#auth-apiv1auth)
3. [Foods](#foods-apiv1foods)
4. [Logs](#logs-apiv1logs)
5. [Water](#water-apiv1water)
6. [Dashboard](#dashboard-apiv1dashboard)
7. [Barcodes](#barcodes-apiv1barcodes)
8. [Custom Foods](#custom-foods-apiv1foodscustom)
9. [Error Handling](#error-handling)

---

## Health `GET /health`

### `GET /health` or `GET /api/v1/health`

Deployment and monitoring health check endpoint. Requires no authentication.

**Response `200 OK`**

```json
{
  "status": "ok"
}
```

---

## Auth `/api/v1/auth`

### `POST /auth/register`

Create a new user account.

**Request Body**

```json
{
  "email": "user@example.com",
  "password": "strongpassword123"
}
```

| Field    | Type   | Required | Constraints             |
|----------|--------|----------|-------------------------|
| email    | string | ✅       | Valid email format       |
| password | string | ✅       | Minimum 8 characters    |

**Response `201 Created`**

```json
{
  "message": "User registered successfully.",
  "user": {
    "id": 1,
    "email": "user@example.com",
    "created_at": "2024-01-15T10:30:00Z"
  }
}
```

**Error Responses**

| Status | Code               | Description                      |
|--------|--------------------|----------------------------------|
| 409    | `conflict`         | Email already registered         |
| 422    | `validation_error` | Missing/invalid fields           |

---

### `POST /auth/login`

Authenticate and receive JWT tokens.

**Request Body**

```json
{
  "email": "user@example.com",
  "password": "strongpassword123"
}
```

**Response `200 OK`**

```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": 1,
    "email": "user@example.com",
    "created_at": "2024-01-15T10:30:00Z"
  }
}
```

**Token Lifetimes**

| Token         | Lifetime |
|---------------|----------|
| access_token  | 15 minutes |
| refresh_token | 30 days  |

**Error Responses**

| Status | Code                 | Description              |
|--------|----------------------|--------------------------|
| 401    | `invalid_credentials`| Wrong email or password  |
| 422    | `validation_error`   | Missing/invalid fields   |

---

### `POST /auth/refresh`

Exchange a refresh token for a new access token.

**Request Headers**

```
Authorization: Bearer <refresh_token>
```

**Response `200 OK`**

```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Error Responses**

| Status | Code           | Description                        |
|--------|----------------|------------------------------------|
| 401    | `unauthorized` | Missing, expired, or invalid token |

---

### `GET /auth/me`

Get the authenticated user's profile.

**Request Headers**

```
Authorization: Bearer <access_token>
```

**Response `200 OK`**

```json
{
  "id": 1,
  "email": "user@example.com",
  "created_at": "2024-01-15T10:30:00Z",
  "profile": {
    "age": 28,
    "gender": "female",
    "height_cm": 165.0,
    "weight_kg": 60.5,
    "activity_level": "moderate",
    "diet_type": "veg",
    "goal": "Weight loss",
    "allergies": ["gluten", "nuts"]
  }
}
```

> `profile` fields are `null` until the user sets them via `PATCH /auth/me`.

**Error Responses**

| Status | Code           | Description            |
|--------|----------------|------------------------|
| 401    | `unauthorized` | Missing/invalid token  |

---

### `PATCH /auth/me`

Update the authenticated user's profile. Send any subset of fields.

**Request Headers**

```
Authorization: Bearer <access_token>
```

**Request Body** (all fields optional)

```json
{
  "age": 28,
  "gender": "female",
  "height_cm": 165.0,
  "weight_kg": 60.5,
  "activity_level": "moderate",
  "diet_type": "veg",
  "goal": "Weight loss",
  "allergies": ["gluten", "nuts"]
}
```

| Field          | Type            | Allowed Values                                              |
|----------------|-----------------|-------------------------------------------------------------|
| age            | integer         | 1–120                                                       |
| gender         | string          | `"male"`, `"female"`, `"other"`, `"prefer_not_to_say"`     |
| height_cm      | number          | Positive decimal                                            |
| weight_kg      | number          | Positive decimal                                            |
| activity_level | string          | `"sedentary"`, `"light"`, `"moderate"`, `"active"`, `"very_active"` |
| diet_type      | string          | `"veg"`, `"vegan"`, `"nonveg"`, `"eggetarian"`             |
| goal           | string          | Free text                                                   |
| allergies      | array of string | e.g. `["gluten", "nuts", "dairy"]`                         |

**Response `200 OK`**

Returns the full updated user + profile object (same shape as `GET /auth/me`).

**Error Responses**

| Status | Code               | Description                    |
|--------|--------------------|--------------------------------|
| 401    | `unauthorized`     | Missing/invalid token          |
| 422    | `validation_error` | Invalid field values           |

---

### `DELETE /auth/me/data`

Delete the user's food logs and profile data. **The account itself is NOT deleted.**

**Request Headers**

```
Authorization: Bearer <access_token>
```

**Response `200 OK`**

```json
{
  "message": "All log and profile data deleted successfully."
}
```

**Error Responses**

| Status | Code           | Description           |
|--------|----------------|-----------------------|
| 401    | `unauthorized` | Missing/invalid token |

---

## Foods `/api/v1/foods`

### `GET /foods`

Search and filter the food database.

**Query Parameters**

| Parameter | Type    | Default | Description                                                   |
|-----------|---------|---------|---------------------------------------------------------------|
| q         | string  | —       | Search term (matches name_en, name_hi, name_kn, aliases)      |
| category  | string  | —       | Category slug (e.g. `"grains"`, `"dairy"`)                    |
| diet      | string  | —       | Filter by diet type: `"veg"`, `"vegan"`, `"nonveg"`, `"eggetarian"` |
| limit     | integer | 20      | Max results per page (1–100)                                  |
| offset    | integer | 0       | Pagination offset                                             |

**Response `200 OK`**

```json
{
  "foods": [
    {
      "id": 42,
      "seed_key": "rice_white_cooked",
      "name_en": "White Rice (Cooked)",
      "name_hi": "सफ़ेद चावल",
      "name_kn": "ಬಿಳಿ ಅಕ್ಕಿ",
      "category": "grains",
      "diet": "veg",
      "default_portion": "1 cup (200g)",
      "kcal_per_portion": 260,
      "is_sample": true,
      "warnings": [
        {
          "kind": "diet_mismatch",
          "detail": "This food may not suit your diet type."
        }
      ]
    }
  ],
  "total": 150,
  "limit": 20,
  "offset": 0
}
```

**Warning Kinds**

| Kind           | Meaning                                       |
|----------------|-----------------------------------------------|
| `diet_mismatch`| Food doesn't match user's diet preference    |
| `allergen`     | Food contains a user-listed allergen          |

---

### `GET /foods/categories`

List all food categories.

**Response `200 OK`**

```json
{
  "categories": [
    { "id": 1, "slug": "grains", "label_en": "Grains & Cereals" },
    { "id": 2, "slug": "dairy", "label_en": "Dairy" },
    { "id": 3, "slug": "vegetables", "label_en": "Vegetables" }
  ]
}
```

---

### `GET /foods/<id>`

Get full nutritional detail for a single food item.

**Path Parameters**

| Parameter | Type    | Description  |
|-----------|---------|--------------|
| id        | integer | Food item ID |

**Response `200 OK`**

```json
{
  "id": 42,
  "seed_key": "rice_white_cooked",
  "name_en": "White Rice (Cooked)",
  "name_hi": "सफ़ेद चावल",
  "name_kn": "ಬಿಳಿ ಅಕ್ಕಿ",
  "category": "grains",
  "diet": "veg",
  "kcal_per_100g": 130.0,
  "protein_per_100g": 2.7,
  "carbs_per_100g": 28.2,
  "fat_per_100g": 0.3,
  "fibre_per_100g": 0.4,
  "allergens": [],
  "tags": ["staple", "south-indian"],
  "portions": [
    { "id": 1, "label": "1 cup (cooked)", "grams": 200.0, "is_default": true },
    { "id": 2, "label": "1 small bowl", "grams": 150.0, "is_default": false }
  ],
  "warnings": [],
  "data_notice": "Nutritional values are approximate and sourced from IFCT 2017."
}
```

**Error Responses**

| Status | Code        | Description         |
|--------|-------------|---------------------|
| 404    | `not_found` | Food ID not found   |

---

### `GET /foods/recent`

Get the last 10 distinct foods logged by the authenticated user.

**Request Headers**

```
Authorization: Bearer <access_token>
```

**Response `200 OK`**

```json
{
  "foods": [
    {
      "id": 42,
      "name_en": "White Rice (Cooked)",
      "kcal_per_100g": 130.0,
      "diet": "veg"
    }
  ]
}
```

**Error Responses**

| Status | Code           | Description           |
|--------|----------------|-----------------------|
| 401    | `unauthorized` | Missing/invalid token |

---

## Logs `/api/v1/logs`

All log endpoints require authentication.

**Request Headers (all endpoints)**

```
Authorization: Bearer <access_token>
```

---

### `POST /logs`

Create a new food log entry.

**Request Body**

```json
{
  "food_id": 42,
  "meal": "lunch",
  "log_date": "2024-01-15",
  "quantity": 1.5,
  "portion_id": 1
}
```

| Field     | Type    | Required      | Description                                                        |
|-----------|---------|---------------|--------------------------------------------------------------------|
| food_id   | integer | ✅ (or food_name) | ID of a known food                                            |
| food_name | string  | ✅ (or food_id)   | Custom food name (when food not in DB)                        |
| meal      | string  | ✅            | `"breakfast"`, `"lunch"`, `"snack"`, `"dinner"`                    |
| log_date  | string  | ✅            | ISO date `YYYY-MM-DD`                                              |
| quantity  | number  | ✅            | Number of portions (e.g. `1.5`)                                    |
| portion_id| integer | ❌            | Portion ID from `/foods/<id>` response; uses default if omitted    |

**Response `201 Created`**

```json
{
  "log": {
    "id": 101,
    "food_id": 42,
    "food_name": "White Rice (Cooked)",
    "meal": "lunch",
    "log_date": "2024-01-15",
    "logged_at": "2024-01-15T12:34:56Z",
    "quantity": 1.5,
    "portion_label": "1 cup (cooked)",
    "portion_grams": 200.0,
    "kcal": 390.0,
    "protein_g": 8.1,
    "carbs_g": 84.6,
    "fat_g": 0.9,
    "fibre_g": 1.2
  }
}
```

**Error Responses**

| Status | Code               | Description                      |
|--------|--------------------|----------------------------------|
| 400    | `bad_request`      | food_id and food_name both given |
| 401    | `unauthorized`     | Missing/invalid token            |
| 404    | `not_found`        | food_id not found                |
| 422    | `validation_error` | Missing/invalid fields           |

---

### `GET /logs`

Retrieve all logs for a specific date, grouped by meal.

**Query Parameters**

| Parameter | Type   | Required | Description              |
|-----------|--------|----------|--------------------------|
| date      | string | ✅       | ISO date `YYYY-MM-DD`    |

**Response `200 OK`**

```json
{
  "date": "2024-01-15",
  "meals": {
    "breakfast": {
      "logs": [ { "id": 100, "food_name": "Oats", "kcal": 150.0, "..." : "..." } ],
      "totals": { "kcal": 150.0, "protein_g": 5.0, "carbs_g": 27.0, "fat_g": 3.0, "fibre_g": 4.0 }
    },
    "lunch": {
      "logs": [ { "id": 101, "food_name": "White Rice (Cooked)", "kcal": 390.0, "...": "..." } ],
      "totals": { "kcal": 390.0, "protein_g": 8.1, "carbs_g": 84.6, "fat_g": 0.9, "fibre_g": 1.2 }
    },
    "snack": { "logs": [], "totals": { "kcal": 0, "protein_g": 0, "carbs_g": 0, "fat_g": 0, "fibre_g": 0 } },
    "dinner": { "logs": [], "totals": { "kcal": 0, "protein_g": 0, "carbs_g": 0, "fat_g": 0, "fibre_g": 0 } }
  },
  "day_totals": {
    "kcal": 540.0,
    "protein_g": 13.1,
    "carbs_g": 111.6,
    "fat_g": 3.9,
    "fibre_g": 5.2
  },
  "total_entries": 2
}
```

**Error Responses**

| Status | Code               | Description             |
|--------|--------------------|-------------------------|
| 400    | `bad_request`      | Missing or invalid date |
| 401    | `unauthorized`     | Missing/invalid token   |

---

### `PATCH /logs/<id>`

Update a log entry's quantity and/or meal. Nutrient values are automatically rescaled when quantity changes.

**Path Parameters**

| Parameter | Type    | Description |
|-----------|---------|-------------|
| id        | integer | Log entry ID |

**Request Body** (all fields optional)

```json
{
  "quantity": 2.0,
  "meal": "dinner"
}
```

**Response `200 OK`**

Returns the updated log object (same shape as a single log in `POST /logs` response).

```json
{
  "log": {
    "id": 101,
    "food_name": "White Rice (Cooked)",
    "meal": "dinner",
    "quantity": 2.0,
    "kcal": 520.0,
    "protein_g": 10.8,
    "carbs_g": 112.8,
    "fat_g": 1.2,
    "fibre_g": 1.6,
    "..."  : "..."
  }
}
```

**Error Responses**

| Status | Code               | Description              |
|--------|--------------------|--------------------------|
| 401    | `unauthorized`     | Missing/invalid token    |
| 403    | `forbidden`        | Log belongs to another user |
| 404    | `not_found`        | Log ID not found         |
| 422    | `validation_error` | Invalid field values     |

---

### `DELETE /logs/<id>`

Delete a food log entry.

**Path Parameters**

| Parameter | Type    | Description  |
|-----------|---------|--------------|
| id        | integer | Log entry ID |

**Response `200 OK`**

```json
{
  "message": "Log entry deleted."
}
```

**Error Responses**

| Status | Code           | Description                                  |
|--------|----------------|----------------------------------------------|
| 401    | `unauthorized` | Missing/invalid token                        |
| 404    | `not_found`    | Log ID not found (or belongs to another user)|

---

### `DELETE /me/data`

Delete all food logs for the authenticated user.

**Authentication:** Required (`Bearer <access_token>`)

**Response `200 OK`**

```json
{
  "message": "All food logs deleted."
}
```

**Error Responses**

| Status | Code           | Description                 |
|--------|----------------|-----------------------------|
| 401    | `unauthorized` | Missing/invalid token       |

---

## Water `/api/v1/water`

All water endpoints require JWT authentication.

### `POST /water`

Log water intake (in millilitres).

**Request Body**

```json
{
  "amount_ml": 250,
  "log_date": "2026-03-30",
  "logged_at": "2026-03-30T10:15:00Z"
}
```

| Field       | Type   | Required | Constraints                            |
|-------------|--------|----------|----------------------------------------|
| `amount_ml` | int    | Yes      | Integer between `1` and `2000`         |
| `log_date`  | string | Yes      | Date in `YYYY-MM-DD` format            |
| `logged_at` | string | No       | ISO 8601 UTC timestamp (default: now) |

**Response `201 Created`**

```json
{
  "water_log": {
    "id": 1,
    "user_id": 42,
    "log_date": "2026-03-30",
    "amount_ml": 250,
    "logged_at": "2026-03-30T10:15:00"
  }
}
```

---

### `GET /water?date=YYYY-MM-DD`

Retrieve all water entries, total millilitres, and glasses (250 ml/glass) for a specific day.

**Response `200 OK`**

```json
{
  "date": "2026-03-30",
  "entries": [
    {
      "id": 1,
      "amount_ml": 250,
      "logged_at": "2026-03-30T10:15:00"
    }
  ],
  "total_ml": 250,
  "glasses": 1.0
}
```

---

### `DELETE /water/<id>`

Delete a specific water entry. Users may only delete their own entries; deleting another user's entry returns `404 not_found`.

**Response `200 OK`**

```json
{
  "message": "Water log entry deleted."
}
```

---

## Dashboard `/api/v1/dashboard`

All dashboard endpoints require JWT authentication.
If the authenticated user's profile is incomplete (missing `age`, `gender`, `height_cm`, or `weight_kg`), these endpoints return `409 Conflict` with error code `profile_incomplete`.

### `GET /dashboard/daily?date=YYYY-MM-DD`

Aggregated daily nutrition totals, targets, macro splits, and water intake.

**Response `200 OK`**

```json
{
  "date": "2026-03-30",
  "targets": {
    "bmr": 1648.75,
    "kcal": 2556,
    "protein_g": 84.0,
    "carbs_g": 395.2,
    "fat_g": 71.0,
    "fibre_g": 35.8,
    "water_ml": 2450
  },
  "consumed": {
    "kcal": 650.0,
    "protein_g": 32.5,
    "carbs_g": 75.0,
    "fat_g": 20.0,
    "fibre_g": 8.0
  },
  "remaining": {
    "kcal": 1906.0
  },
  "macro_split_pct": {
    "protein": 21.3,
    "carbs": 49.2,
    "fat": 29.5
  },
  "meals": {
    "breakfast": { "kcal": 350.0, "entries": [...] },
    "lunch": { "kcal": 300.0, "entries": [...] },
    "snack": { "kcal": 0.0, "entries": [] },
    "dinner": { "kcal": 0.0, "entries": [] }
  },
  "water": {
    "ml": 1250,
    "goal_ml": 2450,
    "glasses": 5.0
  }
}
```

---

### `GET /dashboard/weekly?end=YYYY-MM-DD&days=7`

Contiguous, zero-filled daily history array and range averages ready for Recharts.
Grouped with two single aggregate queries (no N+1).

**Query Parameters**

| Parameter | Type   | Default | Description                            |
|-----------|--------|---------|----------------------------------------|
| `end`     | string | today   | End date (`YYYY-MM-DD`)                |
| `days`    | int    | 7       | Number of days in window (`1` to `31`) |

**Response `200 OK`**

```json
{
  "start": "2026-03-24",
  "end": "2026-03-30",
  "days": [
    {
      "date": "2026-03-24",
      "label": "Tue",
      "kcal": 0.0,
      "target_kcal": 2556,
      "protein_g": 0.0,
      "carbs_g": 0.0,
      "fat_g": 0.0,
      "fibre_g": 0.0,
      "water_ml": 0,
      "water_goal_ml": 2450,
      "logged": false
    }
  ],
  "averages": {
    "kcal": 1850.5,
    "protein_g": 72.0,
    "carbs_g": 210.0,
    "fat_g": 52.0,
    "fibre_g": 24.0,
    "water_ml": 1800.0
  },
  "days_logged": 5
}
```

---

## Barcodes `/api/v1/barcodes`

### `GET /barcodes/<code>`

Look up product details by barcode (GS1 EAN-13, EAN-8, UPC-A).
Requires JWT authentication. Rate limited to 30 requests per minute per user.

**Resolution Order:**
1. **Local-first:** Checks if caller owns a custom food with this barcode (`source: "user"`).
2. **Cache:** Checks `external_product_cache` (positive TTL: 30 days, negative TTL: 1 day).
3. **Upstream:** Fetches from Open Food Facts API v2 (timeout 5s, 1 retry, HTTPS only).

**Response `200 OK`**

```json
{
  "barcode": "7350053850019",
  "found": true,
  "cached": false,
  "source": "openfoodfacts",
  "draft": {
    "name_en": "Oat Milk Barista",
    "brand": "Oatly",
    "quantity": "1 L",
    "per_100g": {
      "kcal": 59.0,
      "protein": 1.0,
      "carbs": 6.6,
      "fat": 3.0,
      "fibre": 0.8
    },
    "portions": [
      { "label": "250 ml", "grams": 250.0, "default": true },
      { "label": "100g", "grams": 100.0, "default": false }
    ],
    "allergens": ["gluten"],
    "traces": [],
    "diet": "vegan",
    "diet_verified": true,
    "missing_fields": [],
    "needs_review": false
  },
  "attribution": "Data from Open Food Facts (ODbL)"
}
```

**Error Responses**
- `400 invalid_barcode`: Invalid length or failing GS1 check digit.
- `404 product_not_found`: Product not found in local custom foods or Open Food Facts.
- `503 upstream_unavailable`: Open Food Facts timed out or returned 5xx/429. Includes `Retry-After: 30`.

---

## Custom Foods `/api/v1/foods/custom`

All custom food endpoints require JWT authentication.
Custom foods are strictly private to the creating user (`owner_user_id == user.id`). Other users receive `404 not_found` when attempting to read, update, or delete them.

### `POST /foods/custom`

Create a new custom food item.

**Request Body**

```json
{
  "name_en": "Homemade Protein Bar",
  "diet": "veg",
  "kcal_per_100g": 380.0,
  "protein_per_100g": 25.0,
  "carbs_per_100g": 40.0,
  "fat_per_100g": 10.0,
  "fibre_per_100g": 8.0,
  "allergens": ["peanut", "milk"],
  "portions": [
    { "label": "1 bar", "grams": 60.0, "default": true }
  ],
  "barcode": "7350053850019"
}
```

**Constraints:**
- `kcal_per_100g` between `0` and `900`.
- `protein + carbs + fat <= 100g` per 100g.
- Duplicate barcode for same user returns `409 conflict` with `details: {"existing_food_id": ...}`.

**Response `201 Created`**

Returns `{ "food": { ... } }` containing full serialized food details.

---

### `PATCH /foods/custom/<id>`

Update an existing custom food owned by caller.

**Response `200 OK`**

Returns `{ "food": { ... } }` with updated values.

---

### `DELETE /foods/custom/<id>`

Delete a custom food owned by caller. Any existing log entries maintain their historical snapshots with `food_id = NULL`.

**Response `200 OK`**

```json
{
  "message": "Custom food deleted."
}
```

---

## Error Handling

All API errors return a consistent JSON structure:

```json
{
  "error": {
    "code": "snake_case_code",
    "message": "Human-readable description of the error.",
    "details": null
  }
}
```

### Standard Error Codes

| HTTP Status | Code                    | When it occurs                                              |
|-------------|-------------------------|-------------------------------------------------------------|
| 400         | `bad_request`           | Malformed request body or syntax error                      |
| 400         | `invalid_barcode`       | Non-numeric, wrong length, or bad GS1 check digit           |
| 401         | `unauthorized`          | Missing, invalid, or expired JWT token                      |
| 401         | `invalid_credentials`   | Wrong email or password at `/auth/login`                    |
| 404         | `not_found`             | Resource not found or isolated custom food of another user  |
| 404         | `product_not_found`     | Barcode not found in catalogue, user foods, or OFF          |
| 405         | `method_not_allowed`    | HTTP method not supported for endpoint                      |
| 409         | `conflict`              | Resource conflict (e.g. duplicate email or barcode)         |
| 409         | `profile_incomplete`    | Profile missing required fields for target calculation      |
| 422         | `validation_error`      | Request parameters or body failed validation rules          |
| 429         | `rate_limit_exceeded`   | Too many requests against rate-limited endpoint             |
| 500         | `internal_error`        | Unexpected server error                                     |
| 503         | `upstream_unavailable`  | Open Food Facts upstream API timeout or service unavailable |

---

## Rate Limiting

- `/api/v1/barcodes/<code>`: Rate limited to **30 requests per minute** per user identity via `Flask-Limiter`.
- Exceeding the rate limit returns `429 Too Many Requests` with code `rate_limit_exceeded`.
