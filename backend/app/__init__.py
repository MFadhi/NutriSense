import os
from flask import Flask
from .config import config_map
from .extensions import db, migrate, jwt, cors
from .errors import register_error_handlers


def create_app(config_name=None):
    if config_name is None:
        config_name = os.environ.get("FLASK_ENV", "development")
    app = Flask(__name__)
    app.config.from_object(config_map.get(config_name, config_map["development"]))

    # Extensions
    db.init_app(app)
    migrate.init_app(app, db)
    jwt.init_app(app)

    # CORS - handle null origin for single-file build from disk (dev only)
    origins = app.config["CORS_ORIGINS"]
    if app.config.get("CORS_ALLOW_NULL_ORIGIN") and app.config.get("DEBUG"):
        origins = origins + ["null"]
    cors.init_app(
        app,
        resources={r"/api/*": {"origins": origins}},
        supports_credentials=True,
    )

    # Blueprints
    from .api import register_blueprints
    register_blueprints(app)

    # CLI
    from .cli import register_cli
    register_cli(app)

    register_error_handlers(app)
    return app
