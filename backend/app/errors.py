from flask import jsonify
from werkzeug.exceptions import HTTPException


def error_response(code, message, details=None, status=400):
    return (
        jsonify({"error": {"code": code, "message": message, "details": details}}),
        status,
    )


def register_error_handlers(app):
    @app.errorhandler(400)
    def bad_request(e):
        return error_response("bad_request", str(e), status=400)

    @app.errorhandler(401)
    def unauthorized(e):
        return error_response("unauthorized", "Authentication required", status=401)

    @app.errorhandler(404)
    def not_found(e):
        return error_response("not_found", "Resource not found", status=404)

    @app.errorhandler(405)
    def method_not_allowed(e):
        return error_response("method_not_allowed", str(e), status=405)

    @app.errorhandler(409)
    def conflict(e):
        return error_response("conflict", str(e), status=409)

    @app.errorhandler(422)
    def unprocessable(e):
        return error_response("unprocessable", str(e), status=422)

    @app.errorhandler(500)
    def internal_error(e):
        # Log the error but NOT sensitive data
        app.logger.error(f"Internal error: {e}")
        return error_response(
            "internal_error", "An unexpected error occurred", status=500
        )

    @app.errorhandler(HTTPException)
    def handle_http(e):
        return error_response(
            e.name.lower().replace(" ", "_"), e.description, status=e.code
        )
