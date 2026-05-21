"""REST API + SocketIO event handlers for messages."""

import html
from flask import Blueprint, jsonify, request
from flask_socketio import emit

from app import socketio
from app.models.message import create_message, get_messages

api_bp = Blueprint("api", __name__, url_prefix="/api")


# ---------- REST endpoints (backup) ----------

@api_bp.route("/messages", methods=["GET"])
def list_messages():
    """Return recent messages as JSON, optionally filtered by ?category=."""
    category = request.args.get("category")
    messages = get_messages(category=category)
    return jsonify(messages)


@api_bp.route("/post", methods=["POST"])
def post_message():
    """Create a message via REST (backup for SocketIO)."""
    data = request.get_json(force=True)
    content = html.escape(data.get("content", "").strip())
    if not content or len(content) > 100:
        return jsonify({"error": "內容不得為空且最多 100 字"}), 400
    category = data.get("category", "other")
    speed_level = data.get("speed_level")
    msg = create_message(content, category, speed_level)
    socketio.emit("new_message", msg, broadcast=True)
    return jsonify(msg), 201


# ---------- SocketIO events ----------

@socketio.on("post_message")
def handle_post_message(data):
    """Receive a message from any client, save to DB, broadcast to all."""
    content = html.escape(data.get("content", "").strip())
    if not content or len(content) > 100:
        emit("error", {"message": "內容不得為空且最多 100 字"})
        return
    category = data.get("category", "other")
    speed_level = data.get("speed_level")
    msg = create_message(content, category, speed_level)
    emit("new_message", msg, broadcast=True)


@socketio.on("request_history")
def handle_request_history():
    """Send recent messages to the connecting client."""
    messages = get_messages(limit=30)
    emit("message_history", messages)
