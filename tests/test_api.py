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
    settings = Settings(database_url="sqlite:///:memory:", match_threshold=0.55)
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


def test_canonical_crud_operations() -> None:
    client = build_test_client()

    create_response = client.post(
        "/api/reference/canonical",
        json={"dimension": "test", "canonical_label": "Alpha", "description": "seed"},
    )
    assert create_response.status_code == 201
    created = create_response.json()
    canonical_id = created["id"]

    update_response = client.put(
        f"/api/reference/canonical/{canonical_id}",
        json={"canonical_label": "Alpha Prime"},
    )
    assert update_response.status_code == 200
    assert update_response.json()["canonical_label"] == "Alpha Prime"

    delete_response = client.delete(f"/api/reference/canonical/{canonical_id}")
    assert delete_response.status_code == 204


def test_source_mapping_flow() -> None:
    client = build_test_client()

    # Create a source connection
    connection_response = client.post(
        "/api/source/connections",
        json={
            "name": "crm",
            "db_type": "postgres",
            "host": "localhost",
            "port": 5432,
            "database": "crm",
            "username": "svc",
        },
    )
    assert connection_response.status_code == 201
    connection_id = connection_response.json()["id"]

    # Map a field to the marital_status dimension
    mapping_response = client.post(
        f"/api/source/connections/{connection_id}/mappings",
        json={
            "source_table": "customers",
            "source_field": "marital",
            "ref_dimension": "marital_status",
        },
    )
    assert mapping_response.status_code == 201
    mapping_id = mapping_response.json()["id"]

    # Ingest raw values (one typo, one exact match)
    ingest_response = client.post(
        f"/api/source/connections/{connection_id}/samples",
        json={
            "source_table": "customers",
            "source_field": "marital",
            "values": [
                {"raw_value": "Singel", "occurrence_count": 3, "dimension": "marital_status"},
                {"raw_value": "Married", "occurrence_count": 5, "dimension": "marital_status"},
            ],
        },
    )
    assert ingest_response.status_code == 201

    # Compute match statistics
    stats_response = client.get(f"/api/source/connections/{connection_id}/match-stats")
    assert stats_response.status_code == 200
    stats = stats_response.json()
    assert stats
    stat = next(item for item in stats if item["mapping_id"] == mapping_id)
    assert stat["unmatched_values"] >= 1
    assert stat["total_values"] == 8

    # Retrieve unmatched values (should include "Singel")
    unmatched_response = client.get(f"/api/source/connections/{connection_id}/unmatched")
    assert unmatched_response.status_code == 200
    unmatched = unmatched_response.json()
    assert any(record["raw_value"] == "Singel" for record in unmatched)

    # Approve a mapping for the typo using the existing canonical "Single"
    canonical_response = client.get("/api/reference/canonical")
    canonical_options = canonical_response.json()
    single = next(item for item in canonical_options if item["canonical_label"] == "Single")

    create_mapping_response = client.post(
        f"/api/source/connections/{connection_id}/value-mappings",
        json={
            "source_table": "customers",
            "source_field": "marital",
            "raw_value": "Singel",
            "canonical_id": single["id"],
            "status": "approved",
        },
    )
    assert create_mapping_response.status_code == 201

    # The value should disappear from unmatched results
    unmatched_after = client.get(f"/api/source/connections/{connection_id}/unmatched").json()
    assert not any(record["raw_value"] == "Singel" for record in unmatched_after)

    # Connection specific mapping list
    connection_mappings = client.get(
        f"/api/source/connections/{connection_id}/value-mappings"
    )
    assert connection_mappings.status_code == 200
    assert connection_mappings.json()

    # Global mapping list
    all_mappings = client.get("/api/source/value-mappings")
    assert all_mappings.status_code == 200
    assert all_mappings.json()
