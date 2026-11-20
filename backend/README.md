# NutriLens Backend

Flask REST API backend for the NutriLens diet-tracking app.

## Stack
- **Flask 3** + Flask-SQLAlchemy + Flask-Migrate + Flask-JWT-Extended + Flask-CORS + Flask-Limiter
- **MySQL 8** in production / **SQLite** for local dev & tests
- **Python 3.11+**

## Quick Start

```bash
# 1. Create venv
python -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate

# 2. Install deps
pip install -r requirements.txt

# 3. Configure environment
cp .env.example .env
# Edit .env with your DB credentials

# 4. Init database (SQLite for local dev)
flask db init
flask db migrate -m "Initial schema"
flask db upgrade

# 5. Seed foods
flask seed-foods

# 6. Run dev server
flask run
```

## Running with Docker (MySQL)

```bash
docker-compose up -d          # start MySQL
cp .env.example .env          # configure MySQL URL
flask db upgrade
flask seed-foods
flask run
```

## Tests

```bash
pytest -v
```

## Phase 4: Laboratory Management, Rule Engine & Weather Integration

### 1. Data Security & Encryption
- All laboratory parameter values are encrypted at rest with **AES-256-GCM**.
- Key loaded via `LAB_ENCRYPTION_KEY` environment variable (32-byte base64 string).
- Explicit user consent required prior to storing any clinical records (`/api/v1/lab/consent`).

### 2. Supported Laboratory Parameters
1. Fasting Blood Glucose (`mg/dL`)
2. HbA1c (`%`)
3. LDL Cholesterol (`mg/dL`)
4. HDL Cholesterol (`mg/dL`)
5. Triglycerides (`mg/dL`)
6. Haemoglobin (`g/dL`)
7. Vitamin D (25-OH) (`ng/mL`)
8. Vitamin B12 (`pg/mL`)

### 3. Rule Engine
Configured via JSON files in `app/rules/`:
- `lab_reference_ranges.json`: Reference boundaries, standard units, alternative unit conversion factors.
- `lab_nutrition_rules.json`: Explainable dietary recommendations mapped to Indian food database tags and categories, respecting dietary preferences (veg/vegan/nonveg) and excluding allergens.

### 4. OCR Extraction
- Modular OCR service in `app/services/ocr_service.py` using `pypdf` and `pytesseract`.
- Extracted values returned as **editable drafts** with confidence scoring. Values are never saved automatically without explicit user confirmation.

### 5. Weather Integration
- Open-Meteo API integration with 30-minute database caching (`WeatherCache`).
- Weather-aware hydration guidance with temperature/humidity adjustments.
- Climate-tailored food recommendations (cooling, hydrating, warming foods).

### 6. Phase 4 API Endpoints
- `GET, POST, DELETE /api/v1/lab/consent`
- `POST /api/v1/lab/reports/upload` (multipart/form-data)
- `GET, DELETE /api/v1/lab/reports`, `GET /api/v1/lab/reports/<id>`
- `GET, POST /api/v1/lab/results`
- `GET /api/v1/lab/results/history`
- `PATCH, DELETE /api/v1/lab/results/<id>`
- `GET /api/v1/lab/insights`
- `POST /api/v1/lab/insights/evaluate`
- `GET /api/v1/weather/current`
- `GET /api/v1/weather/recommendations`

## Project Structure

```
backend/
  app/
    __init__.py          # create_app factory
    config.py            # Config classes
    extensions.py        # db, migrate, jwt, cors
    errors.py            # error handlers
    cli.py               # flask seed-foods command
    models/              # SQLAlchemy models
    api/                 # Blueprint routes
    services/            # Business logic
    schemas/             # (reserved for Marshmallow schemas)
  migrations/            # Alembic migrations
  seed/                  # foods_seed.json
  tests/                 # pytest test suite
  docs/                  # API docs, schema SQL, frontend integration guide
```

## API Overview

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | /api/v1/auth/register | — | Create account |
| POST | /api/v1/auth/login | — | Login, get JWT tokens |
| POST | /api/v1/auth/refresh | Refresh token | New access token |
| GET | /api/v1/auth/me | ✓ | Current user + profile |
| PATCH | /api/v1/auth/me | ✓ | Update profile |
| DELETE | /api/v1/auth/me/data | ✓ | Delete logs & profile |
| GET | /api/v1/foods | optional | Search foods |
| GET | /api/v1/foods/categories | — | List categories |
| GET | /api/v1/foods/<id> | optional | Food detail |
| GET | /api/v1/foods/recent | ✓ | Recent logged foods |
| POST | /api/v1/foods/custom | ✓ | Create custom food |
| PATCH | /api/v1/foods/custom/<id> | ✓ | Update custom food |
| DELETE | /api/v1/foods/custom/<id> | ✓ | Delete custom food |
| POST | /api/v1/logs | ✓ | Log a food |
| GET | /api/v1/logs?date= | ✓ | Get logs for a date |
| PATCH | /api/v1/logs/<id> | ✓ | Update log entry |
| DELETE | /api/v1/logs/<id> | ✓ | Delete log entry |
| POST | /api/v1/water | ✓ | Log water intake |
| GET | /api/v1/water?date= | ✓ | Get water logs & glasses |
| DELETE | /api/v1/water/<id> | ✓ | Delete water log |
| GET | /api/v1/dashboard/daily?date= | ✓ | Daily summary & targets |
| GET | /api/v1/dashboard/weekly?end=&days= | ✓ | Weekly history (Recharts) |

See `docs/api.md` for full request/response schemas.

## MySQL Workbench Connection Steps

To manage the MySQL 8.0 database using MySQL Workbench:

1. **Start the MySQL container**:
   ```bash
   docker-compose up -d
   ```
2. **Open MySQL Workbench** and click the **`+`** icon next to *MySQL Connections*.
3. **Configure the connection settings**:
   - **Connection Name**: `NutriLens Local (Docker)`
   - **Hostname**: `127.0.0.1` (or `localhost`)
   - **Port**: `3306`
   - **Username**: `nutrilens` (or `root`)
   - **Password**: Click *Store in Keychain / Vault* and enter `nutrilens_password` (or `rootpassword` for root)
   - **Default Schema**: `nutrilens_db`
4. Click **Test Connection** to verify that MySQL 8.0 connects and responds.
5. Click **OK** to save and open the connection.
6. Open and execute `docs/sample_queries.sql` to test querying categories, foods, logs, and nutrient snapshots.

## Render Deployment Notes

NutriLens Backend includes production configuration and a `Procfile` for deploying as a Web Service on [Render](https://render.com):

1. **Build Command**: `pip install -r requirements.txt`
2. **Start Command**: `gunicorn "app:create_app()"` (also declared in `Procfile`)
3. **Health Check Path**: `/health` (or `/api/v1/health`)
4. **Environment Variables**:
   - `FLASK_ENV`: `production`
   - `SECRET_KEY`: Long random hexadecimal string
   - `JWT_SECRET_KEY`: Long random string
   - `DATABASE_URL`: Hosted MySQL connection string (e.g., from Aiven)
   - `DB_SSL_CA`: Path to CA certificate (if required by hosted database)
   - `CORS_ORIGINS`: Your production frontend URL (e.g. `https://nutrilens.onrender.com`)

---

## Hosted MySQL & Aiven Notes

Hosted MySQL services like [Aiven for MySQL](https://aiven.io/mysql) enforce TLS/SSL encryption for all client connections:

1. Download the project's CA certificate file (`ca.pem`) from the Aiven console.
2. Store the certificate on the server/container and set the environment variable:
   ```bash
   DB_SSL_CA=/path/to/ca.pem
   ```
3. Set `DATABASE_URL` using the PyMySQL dialect:
   ```bash
   DATABASE_URL=mysql+pymysql://<user>:<password>@<host>:<port>/<dbname>
   ```
4. The application automatically injects `{"ssl": {"ca": DB_SSL_CA}}` into SQLAlchemy engine `connect_args` when `DB_SSL_CA` is set.
5. In production MySQL 8, character sets must be `utf8mb4` with collation `utf8mb4_unicode_ci` to properly support Indic scripts (Devanagari for Hindi and Kannada script) and emoji.

---

## Rate Limiting Architecture (Flask-Limiter)

NutriLens integrates `Flask-Limiter` to protect both backend resources and third-party upstream providers (Open Food Facts):
- **User-Aware Key Function**: Key function extracts authenticated user identity (`user:<id>`) via `get_jwt_identity()`, falling back to client IP address (`get_remote_address()`).
- **Endpoint Limits**: `/api/v1/barcodes/<code>` is limited to **30 requests per minute** per user to prevent Open Food Facts quota throttling.
- **Fail-Safe Error Handling**: When triggered, returns standardized JSON HTTP 429:
  ```json
  {
    "error": {
      "code": "rate_limit_exceeded",
      "message": "Rate limit exceeded. Please try again later.",
      "details": null
    }
  }
  ```
- **Test Isolation**: Rate limiting is automatically disabled during tests via `RATELIMIT_ENABLED = False` in `TestingConfig`.

---

## Verification Status

- **Automated Tests**: All **93 unit and integration tests** run with `pytest` on an in-memory SQLite database (`sqlite://` with `StaticPool` and `check_same_thread=False`) passing cleanly in ~6.8 seconds.
- **Seed Pipeline**: Tested locally via `flask seed-foods --file seed/foods_seed.json --reset` (137 foods seeded) followed by an idempotent re-run (137 updated, 0 duplicates created).
- **Environment & Linting**: Checked and validated against Python 3.12 syntax and formatting.
- **What could NOT be directly verified**:
  - Live remote connections to Aiven MySQL or live deployment to Render were not directly executed as they require active external user credentials and network access outside the sandbox.
  - The React frontend was deliberately NOT modified, per task requirements.

---

## TODOs for Later Phases (Phase 3B+)

- [ ] **Phase 3B — Frontend Wiring**: Wire React dashboard, water tracker, and barcode scanner modal to Phase 3A backend APIs.
- [ ] **Phase 4 — OCR & Lab Reports**: Integrate OCR pipeline to extract blood markers (lipid profile, HbA1c, vitamin D) and map to dietary micronutrient targets.
- [ ] **Phase 4 — Context-Aware Recommendations**: Implement weather-aware hydration & meal suggestion service combining open-meteo API and user targets.
- [ ] **Phase 4 — Meal Planner & Recipe Suggestions**: Recipe generation engine matching pantry ingredients against user diet restrictions and nutrient targets.
- [ ] **Phase 5 — Full USDA / IFCT 2017 Bulk Importer**: Asynchronous celery worker to ingest complete IFCT 2017 tables with micronutrients (calcium, iron, folate).
- [ ] **Phase 5 — Image Hosting**: S3/Cloud Storage presigned URL integration for user-uploaded food photos.

---

## Notes
- Meal values in the API: `breakfast`, `lunch`, `snack`, `dinner` (singular "snack", vs frontend "snacks")
- Nutrient math uses Python `Decimal` with `ROUND_HALF_UP` and quantizes to 2 decimals
- All nutritional values are IFCT-approximate sample data — see `data_notice` field
- SQLite in-memory is used for fast test execution; MySQL 8 with `utf8mb4_unicode_ci` is used for production/docker
