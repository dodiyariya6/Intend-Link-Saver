"""
Application settings, loaded from environment variables / .env file.

No business logic here yet — just the configuration surface the rest of the
app (db.py, main.py, future services) will read from.
"""
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "Intend Link Saver"
    environment: str = "development"

    database_url: str = "postgresql+psycopg://postgres:postgres@db:5432/intend_link_saver"

    # Placeholder for future auth work (not implemented yet)
    jwt_secret: str = "change-me"
    jwt_algorithm: str = "HS256"

    # Placeholder for future AI integration (not implemented yet)
    anthropic_api_key: str = ""

    cors_origins: list[str] = ["http://localhost:5173"]

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")


settings = Settings()
