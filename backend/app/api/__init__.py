def register_blueprints(app):
    from .auth import auth_bp
    from .foods import foods_bp
    from .logs import logs_bp
    from .water import water_bp
    from .dashboard import dashboard_bp

    app.register_blueprint(auth_bp, url_prefix="/api/v1/auth")
    app.register_blueprint(foods_bp, url_prefix="/api/v1")
    app.register_blueprint(logs_bp, url_prefix="/api/v1")
    app.register_blueprint(water_bp, url_prefix="/api/v1")
    app.register_blueprint(dashboard_bp, url_prefix="/api/v1")
