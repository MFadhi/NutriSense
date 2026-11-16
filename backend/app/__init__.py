import os
from flask import Flask
from .config import config_map
from .extensions import db, migrate, jwt, cors, limiter
from .errors import register_error_handlers


def create_app(config_name=None):
    if config_name is None:
        config_name = os.environ.get("FLASK_ENV", "development")
    cfg_class = config_map.get(config_name, config_map["development"])
    if config_name == "production" and hasattr(cfg_class, "validate_config"):
        cfg_class.validate_config()

    app = Flask(__name__)
    app.config.from_object(cfg_class)

    # Extensions
    db.init_app(app)
    migrate.init_app(app, db)
    jwt.init_app(app)
    limiter.init_app(app)

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

    @app.route("/health", methods=["GET"])
    def root_health():
        from flask import jsonify
        return jsonify({"status": "ok"}), 200

    register_error_handlers(app)
    return app
