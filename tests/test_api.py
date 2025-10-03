"""Minimal integration tests for the FastAPI backend."""

from __future__ import annotations

from typing import Iterator

import json
import os
import sys
import io

import pandas as pd
from openpyxl import Workbook

from fastapi.testclient import TestClient
from sqlmodel import Session, delete, select

ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if ROOT_DIR not in sys.path:
    sys.path.insert(0, ROOT_DIR)

os.environ.setdefault("REFDATA_DATABASE_URL", "sqlite:///:memory:")

from api.app.main import create_app
from api.app.config import Settings
from api.app.database import create_db_engine, init_db, get_session
from api.app.models import SystemConfig


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

    dimension_code = "test"
    dimension_response = client.post(
        "/api/reference/dimensions",
        json={
            "code": dimension_code,
            "label": "Test dimension",
            "description": "Dimension used for CRUD tests",
            "extra_fields": [
                {
                    "key": "numeric_code",
                    "label": "Numeric Code",
                    "data_type": "number",
                    "required": False,
                }
            ],
        },
    )
    assert dimension_response.status_code == 201

    create_response = client.post(
        "/api/reference/canonical",
        json={
            "dimension": dimension_code,
            "canonical_label": "Alpha",
            "description": "seed",
            "attributes": {"numeric_code": 101},
        },
    )
    assert create_response.status_code == 201
    created = create_response.json()
    canonical_id = created["id"]

    update_response = client.put(
        f"/api/reference/canonical/{canonical_id}",
        json={"canonical_label": "Alpha Prime", "attributes": {"numeric_code": 202}},
    )
    assert update_response.status_code == 200
    assert update_response.json()["canonical_label"] == "Alpha Prime"
    assert update_response.json()["attributes"]["numeric_code"] == 202

    delete_response = client.delete(f"/api/reference/canonical/{canonical_id}")
    assert delete_response.status_code == 204


def test_dimension_crud_and_extra_fields() -> None:
    client = build_test_client()

    payload = {
        "code": "region",
        "label": "Region",
        "description": "Geographic region",
        "extra_fields": [
            {
                "key": "iso_code",
                "label": "ISO Code",
                "data_type": "string",
                "required": True,
            }
        ],
    }

    create_response = client.post("/api/reference/dimensions", json=payload)
    assert create_response.status_code == 201

    list_response = client.get("/api/reference/dimensions")
    assert list_response.status_code == 200
    dimensions = list_response.json()
    assert any(dimension["code"] == "region" for dimension in dimensions)

    update_response = client.put(
        "/api/reference/dimensions/region",
        json={
            "label": "Region Updated",
            "extra_fields": [
                {
                    "key": "iso_code",
                    "label": "ISO",
                    "data_type": "string",
                    "required": True,
                },
                {
                    "key": "area_sq_km",
                    "label": "Area (km²)",
                    "data_type": "number",
                    "required": False,
                },
            ],
        },
    )
    assert update_response.status_code == 200
    updated = update_response.json()
    assert updated["label"] == "Region Updated"
    assert len(updated["extra_fields"]) == 2

    delete_response = client.delete("/api/reference/dimensions/region")
    assert delete_response.status_code == 204

    confirm_response = client.get("/api/reference/dimensions")
    assert confirm_response.status_code == 200
    assert all(dimension["code"] != "region" for dimension in confirm_response.json())


def test_dimension_relation_flow() -> None:
    client = build_test_client()

    for code, label in (("region", "Region"), ("district", "District")):
        client.post(
            "/api/reference/dimensions",
            json={
                "code": code,
                "label": label,
                "description": f"{label} dimension",
                "extra_fields": [],
            },
        )

    region = client.post(
        "/api/reference/canonical",
        json={"dimension": "region", "canonical_label": "North"},
    ).json()
    district = client.post(
        "/api/reference/canonical",
        json={"dimension": "district", "canonical_label": "North-01"},
    ).json()

    relation_response = client.post(
        "/api/reference/dimension-relations",
        json={
            "label": "Region to District",
            "parent_dimension_code": "region",
            "child_dimension_code": "district",
            "description": "Regions contain multiple districts",
        },
    )
    assert relation_response.status_code == 201
    relation_id = relation_response.json()["id"]

    link_response = client.post(
        f"/api/reference/dimension-relations/{relation_id}/links",
        json={
            "parent_canonical_id": region["id"],
            "child_canonical_id": district["id"],
        },
    )
    assert link_response.status_code == 201

    links = client.get(
        f"/api/reference/dimension-relations/{relation_id}/links"
    ).json()
    assert any(link["parent_canonical_id"] == region["id"] for link in links)

    delete_link = client.delete(
        f"/api/reference/dimension-relations/{relation_id}/links/{links[0]['id']}"
    )
    assert delete_link.status_code == 204

    delete_relation = client.delete(f"/api/reference/dimension-relations/{relation_id}")
    assert delete_relation.status_code == 204


def test_bulk_import_csv_and_excel() -> None:
    client = build_test_client()

    client.post(
        "/api/reference/dimensions",
        json={
            "code": "bulk",
            "label": "Bulk Dimension",
            "description": "Dimension used for bulk import",
            "extra_fields": [
                {
                    "key": "code",
                    "label": "Code",
                    "data_type": "string",
                    "required": False,
                }
            ],
        },
    )

    csv_content = "dimension,label,code\nbulk,Value A,A1\n,Value B,A2\n"
    csv_response = client.post(
        "/api/reference/canonical/import",
        data={"dimension": "bulk"},
        files={"file": ("values.csv", csv_content.encode("utf-8"), "text/csv")},
    )
    assert csv_response.status_code == 201
    payload = csv_response.json()
    assert len(payload["created"]) == 2
    assert not payload["errors"]

    dataframe = pd.DataFrame(
        [
            {"label": "Value C", "description": "Excel row", "code": "A3"},
            {"label": "Value D", "description": "Excel row", "code": "A4"},
        ]
    )
    excel_buffer = io.BytesIO()
    dataframe.to_excel(excel_buffer, index=False)
    excel_buffer.seek(0)

    excel_response = client.post(
        "/api/reference/canonical/import",
        data={"dimension": "bulk"},
        files={
            "file": (
                "values.xlsx",
                excel_buffer.getvalue(),
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            )
        },
    )
    assert excel_response.status_code == 201
    excel_payload = excel_response.json()
    assert len(excel_payload["created"]) == 2
    assert not excel_payload["errors"]


def test_bulk_import_excel_with_metadata_and_multiple_sheets() -> None:
    client = build_test_client()

    client.post(
        "/api/reference/dimensions",
        json={
            "code": "bulk_multi",
            "label": "Bulk multi-sheet dimension",
            "description": "Dimension used for Excel metadata parsing",
            "extra_fields": [
                {
                    "key": "code",
                    "label": "Code",
                    "data_type": "string",
                    "required": False,
                }
            ],
        },
    )

    workbook = Workbook()
    metadata = workbook.active
    metadata.title = "Metadata"
    metadata["A1"] = "Dataset"
    metadata["B1"] = "Canonical values"

    sheet = workbook.create_sheet("2024 Data")
    sheet.merge_cells("A1:C1")
    sheet["A1"] = "Reference data extract"
    sheet["A3"] = "Dimension"
    sheet["B3"] = "Canonical Label"
    sheet["C3"] = "Code"
    sheet["A4"] = "bulk_multi"
    sheet["B4"] = "Excel value one"
    sheet["C4"] = "EX-1"
    sheet["A5"] = "bulk_multi"
    sheet["B5"] = "Excel value two"
    sheet["C5"] = "EX-2"

    notes = workbook.create_sheet("Notes")
    notes["A1"] = "Generated"
    notes["B1"] = "2024"

    excel_buffer = io.BytesIO()
    workbook.save(excel_buffer)
    excel_buffer.seek(0)

    response = client.post(
        "/api/reference/canonical/import",
        data={"dimension": "bulk_multi"},
        files={
            "file": (
                "bulk_multi.xlsx",
                excel_buffer.getvalue(),
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            )
        },
    )

    assert response.status_code == 201
    payload = response.json()
    assert payload["errors"] == []
    labels = [entry["canonical_label"] for entry in payload["created"]]
    assert {"Excel value one", "Excel value two"} == set(labels)


def test_bulk_import_csv_with_preface_metadata() -> None:
    client = build_test_client()

    client.post(
        "/api/reference/dimensions",
        json={
            "code": "bulk_preface",
            "label": "Bulk metadata dimension",
            "description": "Dimension used for CSV metadata parsing",
            "extra_fields": [
                {
                    "key": "code",
                    "label": "Code",
                    "data_type": "string",
                    "required": False,
                }
            ],
        },
    )

    csv_content = (
        "Report generated,2024-05-11,\n"
        "Owner,Data Steward,\n"
        "Canonical Label,Description,Code\n"
        "CSV value one,Imported from CSV,CS-1\n"
        "CSV value two,Imported from CSV,CS-2\n"
    )

    response = client.post(
        "/api/reference/canonical/import",
        data={"dimension": "bulk_preface"},
        files={
            "file": ("bulk_preface.csv", csv_content.encode("utf-8"), "text/csv")
        },
    )

    assert response.status_code == 201
    payload = response.json()
    assert payload["errors"] == []
    created = {entry["canonical_label"] for entry in payload["created"]}
    assert created == {"CSV value one", "CSV value two"}


def test_bulk_import_accepts_canonical_value_header() -> None:
    client = build_test_client()

    client.post(
        "/api/reference/dimensions",
        json={
            "code": "bulk_headers",
            "label": "Bulk header dimension",
            "description": "Dimension used to verify header detection",
            "extra_fields": [
                {
                    "key": "numeric_code",
                    "label": "Numeric Code",
                    "data_type": "number",
                    "required": False,
                }
            ],
        },
    )

    csv_content = (
        "dimension name,canonical value,long description,Numeric Code\n"
        "bulk_headers,Header Label,Additional context,7\n"
    )

    response = client.post(
        "/api/reference/canonical/import",
        data={"dimension": "bulk_headers"},
        files={
            "file": (
                "headers.csv",
                csv_content.encode("utf-8"),
                "text/csv",
            )
        },
    )

    assert response.status_code == 201
    payload = response.json()
    assert payload["errors"] == []
    assert len(payload["created"]) == 1
    created_entry = payload["created"][0]
    assert created_entry["canonical_label"] == "Header Label"
    assert created_entry["description"] == "Additional context"
    assert created_entry["attributes"]["numeric_code"] == 7


def test_bulk_import_preview_suggests_mapping() -> None:
    client = build_test_client()

    client.post(
        "/api/reference/dimensions",
        json={
            "code": "region",
            "label": "Region",
            "extra_fields": [
                {
                    "key": "numeric_code",
                    "label": "Numeric Code",
                    "data_type": "number",
                }
            ],
        },
    )

    csv_content = "Region Label,Numeric Code\nAbu Dhabi,01\nDubai,02\n"
    response = client.post(
        "/api/reference/canonical/import/preview",
        files={"file": ("regions.csv", csv_content.encode("utf-8"), "text/csv")},
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["columns"][0]["suggested_role"] in {"label", "dimension"}
    assert any(
        column.get("suggested_attribute_key") == "numeric_code"
        for column in payload["columns"]
    )
    assert payload["proposed_dimension"] is not None


def test_bulk_import_accepts_explicit_mapping() -> None:
    client = build_test_client()

    client.post(
        "/api/reference/dimensions",
        json={
            "code": "region",
            "label": "Region",
            "extra_fields": [
                {
                    "key": "numeric_code",
                    "label": "Numeric Code",
                    "data_type": "number",
                }
            ],
        },
    )

    csv_content = "Region Name,Code\nAbu Dhabi,01\nDubai,02\n"
    mapping_payload = {
        "label": "Region Name",
        "default_dimension": "region",
        "attributes": {"numeric_code": "Code"},
    }

    response = client.post(
        "/api/reference/canonical/import",
        data={"mapping": json.dumps(mapping_payload)},
        files={"file": ("regions.csv", csv_content.encode("utf-8"), "text/csv")},
    )

    assert response.status_code == 201
    payload = response.json()
    assert len(payload["created"]) == 2
    labels = {item["canonical_label"] for item in payload["created"]}
    assert labels == {"Abu Dhabi", "Dubai"}


def test_bulk_import_creates_dimension_from_mapping_definition() -> None:
    client = build_test_client()

    csv_content = "City,Code\nSharjah,03\n"
    mapping_payload = {
        "label": "City",
        "default_dimension": "city",
        "attributes": {"numeric_code": "Code"},
        "dimension_definition": {
            "code": "city",
            "label": "City",
            "extra_fields": [
                {
                    "key": "numeric_code",
                    "label": "Numeric Code",
                    "data_type": "string",
                }
            ],
        },
    }

    response = client.post(
        "/api/reference/canonical/import",
        data={"mapping": json.dumps(mapping_payload)},
        files={"file": ("cities.csv", csv_content.encode("utf-8"), "text/csv")},
    )

    assert response.status_code == 201
    payload = response.json()
    assert payload["errors"] == []
    assert payload["created"][0]["dimension"] == "city"

    dimension_response = client.get("/api/reference/dimensions")
    assert dimension_response.status_code == 200
    dimension_payloads = dimension_response.json()
    city_dimension = next(item for item in dimension_payloads if item["code"] == "city")
    assert any(field["key"] == "numeric_code" for field in city_dimension["extra_fields"])


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


def test_config_endpoint_auto_seeds_when_missing(tmp_path) -> None:
    db_path = tmp_path / "config.db"
    settings = Settings(database_url=f"sqlite:///{db_path}")
    app = create_app(settings)
    engine = create_db_engine(settings)
    app.state.engine = engine
    init_db(engine, settings=settings)

    def session_override() -> Iterator[Session]:
        with Session(engine) as session:
            yield session

    app.dependency_overrides[get_session] = session_override

    with TestClient(app) as client:
        with Session(engine) as session:
            session.exec(delete(SystemConfig))
            session.commit()

        response = client.get("/api/config")
        assert response.status_code == 200
        payload = response.json()
        assert payload["default_dimension"] == settings.default_dimension
        assert payload["match_threshold"] == settings.match_threshold

        with Session(engine) as session:
            config = session.exec(select(SystemConfig)).first()
            assert config is not None
            assert config.default_dimension == settings.default_dimension
