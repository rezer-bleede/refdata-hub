"""Pytest fixtures and configuration shared across test modules."""

from __future__ import annotations

import os
import sys
from pathlib import Path


def _ensure_repo_on_path() -> None:
    """Insert the repository root into ``sys.path`` for package imports."""

    repo_root = Path(__file__).resolve().parent.parent
    root_str = str(repo_root)
    if root_str not in sys.path:
        sys.path.insert(0, root_str)

    # Ensure the environment matches the dynamically created engine URLs in tests.
    os.environ.setdefault("REFDATA_DATABASE_URL", "sqlite:///:memory:")


_ensure_repo_on_path()


def seed_test_data(engine, *, include_source_connection: bool = True) -> None:
    """Insert isolated synthetic records needed by integration tests."""

    from sqlmodel import Session, select

    from api.app.models import CanonicalValue, Dimension, SourceConnection

    with Session(engine) as session:
        for code, label, extra_schema in (
            ("general", "General", []),
            (
                "marital_status",
                "Marital status",
                [{"key": "code", "label": "Code", "data_type": "string"}],
            ),
            (
                "education",
                "Education level",
                [{"key": "unesco_level", "label": "UNESCO Level", "data_type": "string"}],
            ),
            ("employment_status", "Employment status", []),
        ):
            if not session.exec(select(Dimension).where(Dimension.code == code)).first():
                session.add(
                    Dimension(code=code, label=label, extra_schema=extra_schema)
                )
        session.flush()

        for dimension, label, description, attributes in (
            ("marital_status", "Single", "Not married", {"code": "S"}),
            ("marital_status", "Married", "Married or civil partnership", {"code": "M"}),
            ("education", "High School", "Completed secondary education", {"unesco_level": "2"}),
            ("education", "Bachelor's Degree", "Undergraduate degree", {"unesco_level": "6"}),
            ("employment_status", "Employed", "Currently employed", {}),
            ("employment_status", "Unemployed", "Not presently employed", {}),
        ):
            if not session.exec(
                select(CanonicalValue).where(
                    CanonicalValue.dimension == dimension,
                    CanonicalValue.canonical_label == label,
                )
            ).first():
                session.add(
                    CanonicalValue(
                        dimension=dimension,
                        canonical_label=label,
                        description=description,
                        attributes=attributes,
                    )
                )

        if include_source_connection and not session.exec(
            select(SourceConnection)
        ).first():
            session.add(
                SourceConnection(
                    name="test-source",
                    db_type="postgres",
                    host="localhost",
                    database="test_source",
                    username="test_user",
                )
            )
        session.commit()
