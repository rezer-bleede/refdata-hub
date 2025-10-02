"""Initial data population helpers."""

from __future__ import annotations

import logging
from typing import Any, Sequence

from sqlmodel import Session, select

from .config import Settings, load_settings
from .models import CanonicalValue, Dimension
from .services.config import ensure_system_config

logger = logging.getLogger(__name__)


DEFAULT_DIMENSIONS: Sequence[dict[str, Any]] = (
    {
        "code": "general",
        "label": "General",
        "description": "Fallback dimension used when no specific taxonomy is selected.",
        "extra_schema": [],
    },
    {
        "code": "marital_status",
        "label": "Marital status",
        "description": "Standardised marital state descriptors.",
        "extra_schema": [
            {
                "key": "code",
                "label": "Code",
                "description": "Short code used by legacy systems.",
                "data_type": "string",
                "required": False,
            }
        ],
    },
    {
        "code": "education",
        "label": "Education level",
        "description": "Highest attained education for an individual.",
        "extra_schema": [
            {
                "key": "unesco_level",
                "label": "UNESCO Level",
                "description": "International education classification code.",
                "data_type": "string",
                "required": False,
            }
        ],
    },
    {
        "code": "employment_status",
        "label": "Employment status",
        "description": "Employment standing as reported by HR or census sources.",
        "extra_schema": [],
    },
)

DEFAULT_CANONICAL_VALUES: Sequence[dict[str, Any]] = (
    {
        "dimension": "marital_status",
        "canonical_label": "Single",
        "description": "Not married",
        "attributes": {"code": "S"},
    },
    {
        "dimension": "marital_status",
        "canonical_label": "Married",
        "description": "Married or civil partnership",
        "attributes": {"code": "M"},
    },
    {
        "dimension": "education",
        "canonical_label": "High School",
        "description": "Completed secondary education",
        "attributes": {"unesco_level": "2"},
    },
    {
        "dimension": "education",
        "canonical_label": "Bachelor's Degree",
        "description": "Undergraduate degree",
        "attributes": {"unesco_level": "6"},
    },
    {
        "dimension": "employment_status",
        "canonical_label": "Employed",
        "description": "Currently employed",
    },
    {
        "dimension": "employment_status",
        "canonical_label": "Unemployed",
        "description": "Not presently employed",
    },
)


def seed_database(engine, settings: Settings | None = None) -> None:
    """Populate the database with configuration defaults and seed data."""

    settings = settings or load_settings()
    with Session(engine) as session:
        ensure_system_config(session, settings=settings)

        existing_dimensions = session.exec(select(Dimension)).all()
        if not existing_dimensions:
            logger.info(
                "Seeding default dimensions", extra={"count": len(DEFAULT_DIMENSIONS)}
            )
            for payload in DEFAULT_DIMENSIONS:
                session.add(Dimension(**payload))
            session.commit()
        else:
            logger.debug(
                "Dimensions already present", extra={"count": len(existing_dimensions)}
            )

        existing_canonical = session.exec(select(CanonicalValue)).all()
        if not existing_canonical:
            logger.info(
                "Seeding default canonical values",
                extra={"count": len(DEFAULT_CANONICAL_VALUES)},
            )
            for payload in DEFAULT_CANONICAL_VALUES:
                session.add(CanonicalValue(**payload))
            session.commit()
        else:
            logger.debug(
                "Canonical library already seeded", extra={"count": len(existing_canonical)}
            )

        logger.debug("Database seed process complete")
