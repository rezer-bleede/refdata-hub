"""Database session management utilities."""

from __future__ import annotations

import logging
from typing import Iterator

from fastapi import Request
from sqlalchemy import inspect, text
from sqlalchemy.pool import StaticPool
from sqlmodel import Session, SQLModel, create_engine

from .config import Settings
from .seeds import seed_database

logger = logging.getLogger(__name__)


def create_db_engine(settings: Settings):
    """Create a SQLModel engine from application settings."""

    connect_args = {}
    if settings.database_url.startswith("sqlite"):
        connect_args["check_same_thread"] = False
        if settings.database_url.endswith(":memory:"):
            return create_engine(
                settings.database_url,
                echo=False,
                connect_args=connect_args,
                poolclass=StaticPool,
            )

    return create_engine(settings.database_url, echo=False, connect_args=connect_args)


def _ensure_canonical_attributes_column(engine) -> None:
    """Ensure the ``canonicalvalue`` table exposes the ``attributes`` column.

    Early iterations of the project shipped without the JSON ``attributes`` column
    on the ``canonicalvalue`` table. When the application boots it eagerly queries
    the canonical library which raises ``UndefinedColumn`` on existing
    installations.  To provide a seamless upgrade path we detect the legacy schema
    and amend it in-place before any queries are executed.
    """

    inspector = inspect(engine)
    tables = set(inspector.get_table_names())
    if "canonicalvalue" not in tables:
        logger.debug(
            "Skipping canonicalvalue migration because the table does not exist"
        )
        return

    columns = {column["name"] for column in inspector.get_columns("canonicalvalue")}
    if "attributes" in columns:
        logger.debug("canonicalvalue.attributes column already present")
        return

    logger.info("Adding missing canonicalvalue.attributes column")
    with engine.begin() as connection:
        dialect = connection.dialect.name
        if dialect == "postgresql":
            column_type = "JSONB"
            default_clause = "DEFAULT '{}'::jsonb"
            update_literal = "'{}'::jsonb"
        elif dialect in {"sqlite", "mysql", "mariadb"}:
            column_type = "JSON"
            default_clause = "DEFAULT '{}'"
            update_literal = "'{}'"
        else:
            # Fallback to a textual column for databases without JSON support.
            column_type = "TEXT"
            default_clause = "DEFAULT '{}'"
            update_literal = "'{}'"

        connection.execute(
            text(
                "ALTER TABLE canonicalvalue "
                f"ADD COLUMN attributes {column_type} NOT NULL {default_clause}"
            )
        )

        # Align legacy rows with the SQLModel default factory which is an empty dict.
        connection.execute(
            text(
                "UPDATE canonicalvalue SET attributes = "
                f"{update_literal} WHERE attributes IS NULL"
            )
        )


def init_db(engine, settings: Settings | None = None) -> None:
    """Create database tables and seed initial data."""

    SQLModel.metadata.create_all(engine)
    _ensure_canonical_attributes_column(engine)
    seed_database(engine, settings=settings)


def get_session(request: Request) -> Iterator[Session]:
    """FastAPI dependency that yields a database session."""

    engine = request.app.state.engine
    with Session(engine) as session:
        yield session
