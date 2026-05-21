import os

BASE_DIR = os.path.abspath(os.path.dirname(__file__))


class Config:
    SECRET_KEY = os.environ.get("SECRET_KEY", "road-bulletin-dev-secret")
    DATABASE = os.path.join(BASE_DIR, "instance", "database.db")
