"""Database initialisation helpers."""

import sqlite3
import os


def get_db(app):
    """Return a new SQLite connection for the given app."""
    db = sqlite3.connect(app.config["DATABASE"])
    db.row_factory = sqlite3.Row
    return db


def init_db(app):
    """Create tables if they do not exist."""
    os.makedirs(os.path.dirname(app.config["DATABASE"]), exist_ok=True)
    db = get_db(app)
    db.execute(
        """
        CREATE TABLE IF NOT EXISTS messages (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            content     TEXT    NOT NULL,
            category    TEXT    NOT NULL DEFAULT 'other',
            speed_level TEXT,
            created_at  DATETIME NOT NULL DEFAULT (datetime('now'))
        )
        """
    )
    db.commit()
    db.close()
