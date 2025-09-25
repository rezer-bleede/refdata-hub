"""Initial data population helpers."""

from __future__ import annotations

from typing import Sequence

from sqlmodel import Session, select

from .config import Settings, load_settings
from .models import CanonicalValue, SystemConfig


DEFAULT_CANONICAL_VALUES: Sequence[dict[str, str]] = (
    {"dimension": "marital_status", "canonical_label": "Single", "description": "Not married"},
    {"dimension": "marital_status", "canonical_label": "Married", "description": "Married or civil partnership"},
    {"dimension": "education", "canonical_label": "High School", "description": "Completed secondary education"},
    {"dimension": "education", "canonical_label": "Bachelor's Degree", "description": "Undergraduate degree"},
    {"dimension": "employment_status", "canonical_label": "Employed", "description": "Currently employed"},
    {"dimension": "employment_status", "canonical_label": "Unemployed", "description": "Not presently employed"},
)


def seed_database(engine, settings: Settings | None = None) -> None:
    """Populate the database with configuration defaults and seed data."""

    settings = settings or load_settings()
    with Session(engine) as session:
        config = session.exec(select(SystemConfig)).first()
        if not config:
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

        existing = session.exec(select(CanonicalValue)).all()
        if not existing:
            for payload in DEFAULT_CANONICAL_VALUES:
                session.add(CanonicalValue(**payload))

        session.commit()
