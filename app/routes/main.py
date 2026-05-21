"""Main page route — serves the single-page application."""

from flask import Blueprint, render_template

main_bp = Blueprint("main", __name__)


@main_bp.route("/")
def index():
    """Render the single-page Road Bulletin interface."""
    return render_template("index.html")
