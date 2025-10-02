"""Tests covering automatic database remediation logic."""

from __future__ import annotations

from sqlalchemy import inspect, text
from sqlmodel import Session, create_engine, select

from api.app.config import Settings
from api.app.database import init_db
from api.app.models import CanonicalValue


def test_init_db_adds_missing_canonical_attributes(tmp_path) -> None:
    """Legacy databases without the attributes column are upgraded in-place."""

    db_path = tmp_path / "legacy.sqlite"
    engine = create_engine(
        f"sqlite:///{db_path}", connect_args={"check_same_thread": False}
    )

    with engine.begin() as connection:
        connection.execute(
            text(
                """
                CREATE TABLE canonicalvalue (
                    id INTEGER PRIMARY KEY,
                    dimension VARCHAR NOT NULL,
                    canonical_label VARCHAR NOT NULL,
                    description VARCHAR,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )
                """
            )
        )
        connection.execute(
            text(
                """
                INSERT INTO canonicalvalue (dimension, canonical_label, description)
                VALUES ('legacy', 'Legacy Label', 'Legacy description')
                """
            )
        )

    settings = Settings(database_url=f"sqlite:///{db_path}")

    # First run upgrades the schema and loads seed data without raising.
    init_db(engine, settings=settings)

    inspector = inspect(engine)
    columns = {column["name"] for column in inspector.get_columns("canonicalvalue")}
    assert "attributes" in columns

    with Session(engine) as session:
        canonical_values = session.exec(select(CanonicalValue)).all()

    assert len(canonical_values) == 1
    assert canonical_values[0].attributes == {}

    # Subsequent runs must be no-ops to keep boot idempotent.
    init_db(engine, settings=settings)

    with Session(engine) as session:
        canonical_values = session.exec(select(CanonicalValue)).all()

    assert len(canonical_values) == 1
    assert canonical_values[0].attributes == {}
