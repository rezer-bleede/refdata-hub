import io
from typing import Iterator

import pandas as pd
from fastapi.testclient import TestClient
from sqlmodel import Session

from api.app.config import Settings
from api.app.database import create_db_engine, get_session, init_db
from api.app.main import create_app


def build_client() -> TestClient:
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


def seed_mapping(client: TestClient):
    dimension = client.post(
        "/api/reference/dimensions",
        json={"code": "status_io", "label": "Status IO", "description": None, "extra_fields": []},
    )
    assert dimension.status_code == 201
    active = client.post(
        "/api/reference/canonical",
        json={"dimension": "status_io", "canonical_label": "Active"},
    ).json()
    inactive = client.post(
        "/api/reference/canonical",
        json={"dimension": "status_io", "canonical_label": "Inactive"},
    ).json()

    connection = client.post(
        "/api/source/connections",
        json={
            "name": "io-test",
            "db_type": "postgres",
            "host": "localhost",
            "port": 5432,
            "database": "analytics",
            "username": "svc",
            "password": "secret",
        },
    ).json()

    created = client.post(
        f"/api/source/connections/{connection['id']}/value-mappings",
        json={
            "source_table": "users",
            "source_field": "state",
            "raw_value": "CA",
            "canonical_id": active["id"],
            "status": "approved",
            "confidence": 0.9,
        },
    )
    assert created.status_code == 201

    return connection, active, inactive


def test_export_and_import_value_mappings_round_trip():
    client = build_client()
    connection, active, inactive = seed_mapping(client)

    csv_response = client.get("/api/source/value-mappings/export?format=csv")
    assert csv_response.status_code == 200
    csv_frame = pd.read_csv(io.StringIO(csv_response.text))
    assert {"raw_value", "canonical_id", "source_connection_id"}.issubset(csv_frame.columns)
    assert "CA" in set(csv_frame["raw_value"])

    xlsx_response = client.get(
        f"/api/source/value-mappings/export?format=xlsx&connection_id={connection['id']}"
    )
    assert xlsx_response.status_code == 200
    xlsx_frame = pd.read_excel(io.BytesIO(xlsx_response.content))
    assert len(xlsx_frame) == 1
    assert xlsx_frame.loc[0, "canonical_id"] == active["id"]

    import_payload = pd.DataFrame(
        [
            {
                "source_table": "users",
                "source_field": "state",
                "raw_value": "CA",
                "canonical_id": inactive["id"],
                "status": "pending",
                "confidence": 0.8,
            },
            {
                "source_table": "users",
                "source_field": "state",
                "raw_value": "NY",
                "canonical_id": active["id"],
                "status": "approved",
                "confidence": 0.92,
            },
        ]
    )
    buffer = io.StringIO()
    import_payload.to_csv(buffer, index=False)

    import_response = client.post(
        f"/api/source/value-mappings/import?connection_id={connection['id']}",
        files={"file": ("mappings.csv", buffer.getvalue(), "text/csv")},
    )
    assert import_response.status_code == 200
    import_result = import_response.json()
    assert import_result["created"] == 1
    assert import_result["updated"] == 1
    assert import_result["errors"] == []

    updated_response = client.get(f"/api/source/connections/{connection['id']}/value-mappings")
    assert updated_response.status_code == 200
    updated_records = updated_response.json()
    assert any(record["raw_value"] == "NY" for record in updated_records)
    updated_ca = next(record for record in updated_records if record["raw_value"] == "CA")
    assert updated_ca["canonical_id"] == inactive["id"]
    assert updated_ca["status"] == "pending"
    assert updated_ca["confidence"] == 0.8
