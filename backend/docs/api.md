# NutriLens API Reference

**Base URL:** `http://localhost:5000/api/v1`  
**Content-Type:** `application/json` (all requests and responses)  
**Authentication:** JWT Bearer tokens (see [Auth](#auth-apiv1auth))

---

## Table of Contents

1. [Auth](#auth-apiv1auth)
2. [Foods](#foods-apiv1foods)
3. [Logs](#logs-apiv1logs)
4. [Error Handling](#error-handling)

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

| Status | Code           | Description                 |
|--------|----------------|-----------------------------|
| 401    | `unauthorized` | Missing/invalid token       |
| 403    | `forbidden`    | Log belongs to another user |
| 404    | `not_found`    | Log ID not found            |

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

`details` is `null` for most errors, or an object/array with extra context (e.g. field validation failures).

### Standard Error Codes

| HTTP Status | Code                  | When it occurs                                    |
|-------------|-----------------------|---------------------------------------------------|
| 400         | `bad_request`         | Malformed request body or conflicting parameters  |
| 401         | `unauthorized`        | Missing or expired JWT token                      |
| 401         | `invalid_credentials` | Wrong email or password at `/auth/login`          |
| 404         | `not_found`           | Resource with given ID does not exist             |
| 405         | `method_not_allowed`  | HTTP method not supported for this endpoint       |
| 409         | `conflict`            | Resource already exists (e.g. duplicate email)    |
| 422         | `validation_error`    | Request body fails validation rules               |
| 422         | `unprocessable`       | Syntactically valid but semantically unprocessable|
| 500         | `internal_error`      | Unexpected server error                           |

### Validation Error Example

```json
{
  "error": {
    "code": "validation_error",
    "message": "Request validation failed.",
    "details": {
      "email": ["Not a valid email address."],
      "password": ["Shorter than minimum length 8."]
    }
  }
}
```

---

> **Rate Limiting:** TODO — planned for Phase 3.
