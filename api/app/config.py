"""Application configuration settings."""

from __future__ import annotations

from typing import List

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Runtime configuration values for the RefData Hub backend."""

    database_url: str = Field(
        default="postgresql+psycopg://refdata:refdata@db:5432/refdata",
        description="SQLAlchemy compatible database URL.",
    )
    cors_origins: List[str] = Field(
        default_factory=lambda: ["http://localhost:5173", "http://127.0.0.1:5173"],
        description="Allowed origins for CORS requests.",
    )
    default_dimension: str = Field(
        default="general", description="Fallback dimension when none is provided."
    )
    match_threshold: float = Field(
        default=0.6, ge=0.0, le=1.0, description="Minimum similarity score to surface matches."
    )
    matcher_backend: str = Field(
        default="embedding",
        description="Selected matcher backend (embedding or llm).",
    )
    embedding_model: str = Field(
        default="tfidf",
        description="Identifier for the embedding backend (tfidf or external model path).",
    )
    llm_model: str | None = Field(
        default="gpt-3.5-turbo", description="LLM model identifier when matcher_backend is 'llm'."
    )
    llm_api_base: str | None = Field(
        default=None, description="Optional override for the LLM API base URL."
    )
    top_k: int = Field(
        default=5, ge=1, le=20, description="Maximum number of match candidates to return."
    )

    model_config = SettingsConfigDict(
        env_file=".env", env_prefix="REFDATA_", extra="ignore"
    )


def load_settings() -> Settings:
    """Instantiate settings from the current environment."""

    return Settings()
