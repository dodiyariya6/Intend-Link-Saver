"""
Application settings, loaded from environment variables / .env file.

Just the configuration surface the rest of the app (db.py, main.py,
services) reads from.
"""
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "Intend Link Saver"
    environment: str = "development"

    database_url: str = "postgresql+psycopg://postgres:postgres@db:5432/intend_link_saver"

    jwt_secret: str = "change-me"
    jwt_algorithm: str = "HS256"

    # Google Gemini — the app's single AI provider. Used both for chat
    # generation (summarization/tagging/intent classification and the
    # Memory Assistant's answers, app/services/ai_service.py) and for
    # embeddings (semantic-search vectors, app/services/embedding_service.py).
    # One key covers both, so there's only one credential to configure.
    gemini_api_key: str = ""
    embedding_model: str = "gemini-embedding-001"

    cors_origins: list[str] = ["http://localhost:5173"]

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")


settings = Settings()
