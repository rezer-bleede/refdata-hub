"""Initial data population helpers."""

from __future__ import annotations

from sqlmodel import Session

from .config import Settings, load_settings
from .services.config import ensure_system_config


def seed_database(engine, settings: Settings | None = None) -> None:
    """Initialize operational configuration without inserting business data."""

    settings = settings or load_settings()
    with Session(engine) as session:
        ensure_system_config(session, settings=settings)
