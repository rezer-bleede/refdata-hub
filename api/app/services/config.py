"""System configuration service utilities."""

from __future__ import annotations

from sqlmodel import Session, select

from ..config import Settings, load_settings
from ..models import SystemConfig
from ..schemas import SystemConfigRead


def ensure_system_config(
    session: Session, settings: Settings | None = None
) -> SystemConfig:
    """Return the persisted configuration, creating defaults when missing."""

    config = session.exec(select(SystemConfig)).first()
    if config:
        return config

    settings = settings or load_settings()
    config = SystemConfig(
        default_dimension=settings.default_dimension,
        match_threshold=settings.match_threshold,
        matcher_backend=settings.matcher_backend,
        embedding_model=settings.embedding_model,
        llm_model=settings.llm_model,
        llm_api_base=settings.llm_api_base,
        top_k=settings.top_k,
    )
    session.add(config)
    session.commit()
    session.refresh(config)
    return config


def system_config_to_read(config: SystemConfig) -> SystemConfigRead:
    """Map a ``SystemConfig`` ORM model to the API response schema."""

    return SystemConfigRead(
        default_dimension=config.default_dimension,
        match_threshold=config.match_threshold,
        matcher_backend=config.matcher_backend,
        embedding_model=config.embedding_model,
        llm_model=config.llm_model,
        llm_api_base=config.llm_api_base,
        top_k=config.top_k,
        llm_api_key_set=bool(config.llm_api_key),
    )
