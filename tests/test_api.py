"""Minimal integration tests for the FastAPI backend."""

from __future__ import annotations

from typing import Iterator

import os
import sys

from fastapi.testclient import TestClient
from sqlmodel import Session

ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if ROOT_DIR not in sys.path:
    sys.path.insert(0, ROOT_DIR)

os.environ.setdefault("REFDATA_DATABASE_URL", "sqlite:///:memory:")

from api.app.main import create_app
from api.app.config import Settings
from api.app.database import create_db_engine, init_db, get_session


def build_test_client() -> TestClient:
    settings = Settings(database_url="sqlite:///:memory:", match_threshold=0.0)
    app = create_app(settings)
    engine = create_db_engine(settings)
    app.state.engine = engine
    init_db(engine, settings=settings)

    def session_override() -> Iterator[Session]:
        with Session(engine) as session:
            yield session

    app.dependency_overrides[get_session] = session_override
    return TestClient(app)


def test_health_endpoint() -> None:
    client = build_test_client()
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"


def test_match_proposal_returns_candidates() -> None:
    client = build_test_client()
    response = client.post(
        "/api/reference/propose",
        json={"raw_text": "married", "dimension": "marital_status"},
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["matches"]
    top_match = payload["matches"][0]
    assert top_match["canonical_label"] in {"Married", "Single"}
