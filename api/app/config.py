"""Application configuration settings."""

from __future__ import annotations

from typing import Any, List

import json

from pydantic import Field, field_validator
from pydantic.fields import FieldInfo
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic_settings.sources import DotEnvSettingsSource, EnvSettingsSource, PydanticBaseSettingsSource


class LenientEnvSettingsSource(EnvSettingsSource):
    """Environment source that defers complex parsing for select fields."""

    def prepare_field_value(self, field_name: str, field: FieldInfo, value: Any, value_is_complex: bool) -> Any:  # type: ignore[override]
        if field_name == "cors_origins" and isinstance(value, str):
            return value
        return super().prepare_field_value(field_name, field, value, value_is_complex)


class LenientDotEnvSettingsSource(DotEnvSettingsSource):
    """DotEnv source that mirrors the lenient behaviour for environment values."""

    def prepare_field_value(self, field_name: str, field: FieldInfo, value: Any, value_is_complex: bool) -> Any:  # type: ignore[override]
        if field_name == "cors_origins" and isinstance(value, str):
            return value
        return super().prepare_field_value(field_name, field, value, value_is_complex)


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
        env_file=".env",
        env_prefix="REFDATA_",
        extra="ignore",
    )

    @classmethod
    def settings_customise_sources(
        cls,
        settings_cls: type[BaseSettings],
        init_settings: PydanticBaseSettingsSource,
        env_settings: PydanticBaseSettingsSource,
        dotenv_settings: PydanticBaseSettingsSource,
        file_secret_settings: PydanticBaseSettingsSource,
    ) -> tuple[PydanticBaseSettingsSource, ...]:
        return (
            init_settings,
            LenientEnvSettingsSource(settings_cls),
            LenientDotEnvSettingsSource(settings_cls),
            file_secret_settings,
        )

    @field_validator("cors_origins", mode="before")
    @classmethod
    def parse_cors_origins(cls, value: Any) -> List[str]:
        """Normalise CORS origins from environment variables.

        The validator accepts either JSON encoded lists/strings or comma separated values.
        Empty strings fall back to the configured defaults to avoid parsing errors.
        """

        if value in (None, ""):
            default_factory = cls.model_fields["cors_origins"].default_factory
            default_value = cls.model_fields["cors_origins"].default
            if default_factory is not None:
                return list(default_factory())
            if isinstance(default_value, list):
                return list(default_value)
            raise ValueError("cors_origins default is not configured as a list")

        if isinstance(value, str):
            stripped = value.strip()
            if not stripped:
                return cls.parse_cors_origins("")
            try:
                parsed = json.loads(stripped)
            except json.JSONDecodeError:
                origins = [origin.strip() for origin in stripped.split(",") if origin.strip()]
                return origins or cls.parse_cors_origins("")
        else:
            parsed = value

        if isinstance(parsed, str):
            return [parsed.strip()] if parsed.strip() else cls.parse_cors_origins("")

        if isinstance(parsed, list):
            normalised: List[str] = []
            for item in parsed:
                if not isinstance(item, str):
                    raise ValueError("cors_origins list entries must be strings")
                cleaned = item.strip()
                if cleaned:
                    normalised.append(cleaned)
            return normalised or cls.parse_cors_origins("")

        raise ValueError("cors_origins must be provided as a string or list of strings")


def load_settings() -> Settings:
    """Instantiate settings from the current environment."""

    return Settings()
