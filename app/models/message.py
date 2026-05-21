"""Message model — CRUD operations for the messages table."""

from datetime import datetime, timedelta, timezone

from app.models import get_db
from flask import current_app


def create_message(content: str, category: str = "other", speed_level: str | None = None) -> dict:
    """Insert a new message and return it as a dict."""
    db = get_db(current_app)
    cursor = db.execute(
        "INSERT INTO messages (content, category, speed_level) VALUES (?, ?, ?)",
        (content[:100], category, speed_level),
    )
    db.commit()
    row = db.execute("SELECT * FROM messages WHERE id = ?", (cursor.lastrowid,)).fetchone()
    db.close()
    return dict(row)


def get_messages(category: str | None = None, limit: int = 50) -> list[dict]:
    """Return recent messages, optionally filtered by category."""
    db = get_db(current_app)
    if category:
        rows = db.execute(
            "SELECT * FROM messages WHERE category = ? ORDER BY created_at DESC LIMIT ?",
            (category, limit),
        ).fetchall()
    else:
        rows = db.execute(
            "SELECT * FROM messages ORDER BY created_at DESC LIMIT ?",
            (limit,),
        ).fetchall()
    db.close()
    return [dict(r) for r in rows]


def cleanup_old_messages():
    """Delete messages older than 24 hours."""
    db = get_db(current_app)
    cutoff = datetime.now(timezone.utc) - timedelta(hours=24)
    db.execute("DELETE FROM messages WHERE created_at < ?", (cutoff.isoformat(),))
    db.commit()
    db.close()
