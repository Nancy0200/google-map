"""Flask application factory for Road Bulletin."""

from flask import Flask
from flask_socketio import SocketIO

from config import Config

socketio = SocketIO()


def create_app():
    """Create and configure the Flask application."""
    app = Flask(__name__)
    app.config.from_object(Config)

    # Ensure instance folder exists
    import os
    os.makedirs(os.path.dirname(app.config["DATABASE"]), exist_ok=True)

    # Initialize database
    from app.models import init_db
    init_db(app)

    # Register blueprints
    from app.routes.main import main_bp
    from app.routes.api import api_bp
    app.register_blueprint(main_bp)
    app.register_blueprint(api_bp)

    # Initialize SocketIO
    socketio.init_app(app, cors_allowed_origins="*")

    # Register SocketIO events
    from app.routes import api  # noqa: F811 — triggers @socketio.on registration

    return app
