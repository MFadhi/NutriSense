# NutriLens Backend

Flask REST API backend for the NutriLens diet-tracking app.

## Stack
- **Flask 3** + Flask-SQLAlchemy + Flask-Migrate + Flask-JWT-Extended + Flask-CORS
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
| POST | /api/v1/logs | ✓ | Log a food |
| GET | /api/v1/logs?date= | ✓ | Get logs for a date |
| PATCH | /api/v1/logs/<id> | ✓ | Update log entry |
| DELETE | /api/v1/logs/<id> | ✓ | Delete log entry |

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

---

## TODOs for Later Phases (Phase 3+)

- [ ] **Phase 3 — OCR & Lab Reports**: Integrate OCR pipeline to extract blood markers (lipid profile, HbA1c, vitamin D) and map to dietary micronutrient targets.
- [ ] **Phase 3 — Barcode & Open Food Facts**: Add barcode lookup endpoint `GET /foods/barcode/<barcode>` backed by Open Food Facts API and local cache.
- [ ] **Phase 3 — Rate Limiting**: Add `Flask-Limiter` with Redis backend to protect search and authentication endpoints against abuse.
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
