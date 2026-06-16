"""REST API + SocketIO event handlers for messages."""

import html
import re
from flask import Blueprint, jsonify, request
from flask_socketio import emit

from app import socketio
from app.models.message import create_message, get_messages

api_bp = Blueprint("api", __name__, url_prefix="/api")


# ---------- Server-side content filter ----------

_POLITICAL = [
    '政治', '選舉', '投票', '民進黨', '國民黨', '共產黨', '民眾黨',
    '台獨', '統獨', '統一', '獨立', '兩岸', '一中', '九二共識',
    '總統', '立委', '議員', '黨派', '藍綠', '綠營', '藍營',
    '共匪', '支那', '中共', '台灣獨立', '中國統一',
]

_DISCRIMINATORY = [
    '歧視', '種族歧視', '性別歧視', '去死',
    '低端', '賤民', '賤人', '下等人', '殘廢',
    '黑鬼', '死同性戀', '娘炮',
    'nigger', 'negro', 'chink', 'gook', 'spic', 'kike',
    'faggot', 'retard', 'retarded',
]

_PROFANITY = [
    '幹你', '操你', '肏你', '靠北', '靠杯', '靠邀', '靠腰',
    '他媽', '你媽', '老母', '王八', '王八蛋', '狗娘',
    '白癡', '智障', '廢物', '腦殘', '死全家',
    '幹你娘', '操你媽', '你他媽', '媽的', '他媽的',
    '機掰', '雞掰', '機巴', '雞巴', '懶叫',
    '三小', '啥小', '殺小',
    'fuck', 'fucking', 'fucked', 'fucker',
    'shit', 'bullshit', 'shitty',
    'bitch', 'asshole', 'bastard', 'dick', 'pussy',
    'damn', 'damned', 'crap', 'wtf', 'stfu',
]

_ALL_BANNED = [w.lower() for w in (_POLITICAL + _DISCRIMINATORY + _PROFANITY)]
_URL_RE = re.compile(
    r'(?:https?|ftp)://[^\s]+|www\.[^\s]+|[a-zA-Z0-9][-a-zA-Z0-9]*\.[a-zA-Z]{2,}(?:/[^\s]*)?',
    re.IGNORECASE,
)


def _filter_content(text: str) -> str | None:
    """Return an error message if text is disallowed, or None if OK."""
    if _URL_RE.search(text):
        return "訊息中不允許包含網址或連結。"
    lower = text.lower()
    for word in _ALL_BANNED:
        if word in lower:
            return "訊息包含不當內容，請修改後重新發送。"
    return None


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
    # Server-side content filter
    filter_err = _filter_content(content)
    if filter_err:
        return jsonify({"error": filter_err}), 400
    category = data.get("category", "other")
    speed_level = data.get("speed_level")
    road_name = data.get("road_name")
    road_city = data.get("road_city")
    msg = create_message(content, category, speed_level)
    # Attach road info to broadcast payload
    msg["road_name"] = road_name
    msg["road_city"] = road_city
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
    # Server-side content filter
    filter_err = _filter_content(content)
    if filter_err:
        emit("error", {"message": filter_err})
        return
    category = data.get("category", "other")
    speed_level = data.get("speed_level")
    road_name = data.get("road_name")
    road_city = data.get("road_city")
    
    try:
        msg = create_message(content, category, speed_level)
        # Attach road info to broadcast payload so all clients can display it
        msg["road_name"] = road_name
        msg["road_city"] = road_city
        emit("new_message", msg, broadcast=True)
    except Exception as e:
        import traceback
        traceback.print_exc()
        emit("error", {"message": f"伺服器資料庫錯誤: {str(e)}"})


@socketio.on("request_history")
def handle_request_history():
    """Send recent messages to the connecting client."""
    messages = get_messages(limit=30)
    emit("message_history", messages)
