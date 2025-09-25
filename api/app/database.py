"""Database session management utilities."""

from __future__ import annotations

from typing import Iterator

from fastapi import Request
from sqlalchemy.pool import StaticPool
from sqlmodel import Session, SQLModel, create_engine

from .config import Settings
from .seeds import seed_database


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


def init_db(engine, settings: Settings | None = None) -> None:
    """Create database tables and seed initial data."""

    SQLModel.metadata.create_all(engine)
    seed_database(engine, settings=settings)


def get_session(request: Request) -> Iterator[Session]:
    """FastAPI dependency that yields a database session."""

    engine = request.app.state.engine
    with Session(engine) as session:
        yield session
