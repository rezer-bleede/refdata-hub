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


def _ensure_systemconfig_llm_mode_column(engine) -> None:
    """Add the ``llm_mode`` column for legacy installations."""

    inspector = inspect(engine)
    tables = set(inspector.get_table_names())
    if "systemconfig" not in tables:
        return

    columns = {column["name"] for column in inspector.get_columns("systemconfig")}
    if "llm_mode" in columns:
        return

    logger.info("Adding missing systemconfig.llm_mode column with default 'online'")
    with engine.begin() as connection:
        connection.execute(
            text(
                "ALTER TABLE systemconfig "
                "ADD COLUMN llm_mode VARCHAR(20) NOT NULL DEFAULT 'online'"
            )
        )
        connection.execute(
            text(
                "UPDATE systemconfig SET llm_mode = 'online' WHERE llm_mode IS NULL"
            )
        )


def _migrate_matcher_config(engine) -> None:
    """Replace the retired embedding backend and remove its stored settings."""
    inspector = inspect(engine)
    if "systemconfig" not in inspector.get_table_names():
        return

    columns = {column["name"] for column in inspector.get_columns("systemconfig")}
    with engine.begin() as connection:
        if "matcher_backend" in columns:
            connection.execute(text(
                "UPDATE systemconfig SET matcher_backend = 'lexical', match_threshold = 0.97 "
                "WHERE matcher_backend IS NULL OR matcher_backend NOT IN ('lexical', 'llm')"
            ))
        for column in ("embedding_model", "llm_escalation"):
            if column in columns:
                logger.info("Dropping retired systemconfig.%s column", column)
                connection.execute(text(f"ALTER TABLE systemconfig DROP COLUMN {column}"))


def init_db(engine, settings: Settings | None = None) -> None:
    """Create database tables and initialize operational configuration."""

    SQLModel.metadata.create_all(engine)
    _ensure_canonical_attributes_column(engine)
    _ensure_systemconfig_llm_mode_column(engine)
    _migrate_matcher_config(engine)
    seed_database(engine, settings=settings)


def get_session(request: Request) -> Iterator[Session]:
    """FastAPI dependency that yields a database session."""

    engine = request.app.state.engine
    with Session(engine) as session:
        yield session
