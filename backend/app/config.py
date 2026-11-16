import os
from datetime import timedelta
from sqlalchemy.pool import StaticPool


class Config:
    SECRET_KEY = os.environ.get("SECRET_KEY", "dev-secret-change-me")
    SQLALCHEMY_DATABASE_URI = os.environ.get("DATABASE_URL", "sqlite:///nutrilens_dev.db")
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    JWT_SECRET_KEY = os.environ.get("JWT_SECRET_KEY", "dev-jwt-change-me")
    JWT_ACCESS_TOKEN_EXPIRES = timedelta(minutes=15)
    JWT_REFRESH_TOKEN_EXPIRES = timedelta(days=30)
    CORS_ORIGINS = os.environ.get("CORS_ORIGINS", "http://localhost:5173").split(",")
    CORS_ALLOW_NULL_ORIGIN = os.environ.get("CORS_ALLOW_NULL_ORIGIN", "false").lower() == "true"

    # Open Food Facts configuration
    OFF_BASE_URL = os.environ.get("OFF_BASE_URL", "https://world.openfoodfacts.org")
    OFF_USER_AGENT = os.environ.get("OFF_USER_AGENT", "NutriLens/0.1 (user@nutrilens.app)")
    OFF_TIMEOUT_S = float(os.environ.get("OFF_TIMEOUT_S", "5.0"))
    OFF_CACHE_TTL_DAYS = int(os.environ.get("OFF_CACHE_TTL_DAYS", "30"))

    # Rate limiting
    RATELIMIT_ENABLED = True

    # Support MySQL SSL CA path for hosted providers (e.g. Aiven)
    _ssl_ca = os.environ.get("DB_SSL_CA")
    if _ssl_ca:
        SQLALCHEMY_ENGINE_OPTIONS = {
            "connect_args": {
                "ssl": {"ca": _ssl_ca}
            }
        }


class DevelopmentConfig(Config):
    DEBUG = True


class TestingConfig(Config):
    TESTING = True
    SQLALCHEMY_DATABASE_URI = os.environ.get("TEST_DATABASE_URL", "sqlite://")
    SQLALCHEMY_ENGINE_OPTIONS = {
        "poolclass": StaticPool,
        "connect_args": {"check_same_thread": False},
    }
    JWT_ACCESS_TOKEN_EXPIRES = timedelta(hours=1)
    SECRET_KEY = "test-secret-key-not-for-production"
    JWT_SECRET_KEY = "test-jwt-secret-key-not-for-production"
    WTF_CSRF_ENABLED = False
    RATELIMIT_ENABLED = False
    OFF_TIMEOUT_S = 1.0


class ProductionConfig(Config):
    DEBUG = False

    @classmethod
    def validate_config(cls):
        ua = os.environ.get("OFF_USER_AGENT", "")
        if (
            not ua
            or "example" in ua.lower()
            or "user@nutrilens.app" in ua.lower()
            or "change-me" in ua.lower()
        ):
            raise ValueError(
                "In production, OFF_USER_AGENT must be configured with a real contact (e.g. 'NutriLens/1.0 (contact@nutrilens.app)')."
            )


config_map = {
    "development": DevelopmentConfig,
    "testing": TestingConfig,
    "production": ProductionConfig,
}
