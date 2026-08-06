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

    # Claude — summarization/tagging/intent classification (app/services/ai_service.py)
    anthropic_api_key: str = ""

    # Embeddings — semantic-search vectors (app/services/embedding_service.py).
    # text-embedding-3-small outputs 1536 dims, matching Link.embedding's
    # column size exactly. Separate provider/model from Claude on purpose —
    # Anthropic doesn't offer an embeddings API, and keeping this behind its
    # own setting makes swapping providers (e.g. Voyage) a config change.
    openai_api_key: str = ""
    embedding_model: str = "text-embedding-3-small"

    cors_origins: list[str] = ["http://localhost:5173"]

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")


settings = Settings()
