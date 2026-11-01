"""MDM API coverage for crosswalk review, merges, hierarchy, and quality."""

from __future__ import annotations

import os
from typing import Iterator

from fastapi.testclient import TestClient
from sqlmodel import Session

os.environ.setdefault("REFDATA_DATABASE_URL", "sqlite:///:memory:")

from api.app.config import Settings
from api.app.database import get_session
from api.app.main import create_app
from api.app.schemas import AgentToolCall

TEST_ENTITY = "test_organization"


def client_with_db() -> TestClient:
    app = create_app(Settings(database_url="sqlite:///:memory:"))
    engine = app.state.engine

    def session_override() -> Iterator[Session]:
        with Session(engine) as session:
            yield session

    app.dependency_overrides[get_session] = session_override
    return TestClient(app)


def create_entity(client: TestClient) -> dict:
    response = client.post(
        "/api/mdm/entities",
        json={
            "code": TEST_ENTITY,
            "label": "Organization",
            "attribute_schema": [
                {"key": "name", "data_type": "string", "required": True},
                {"key": "domain", "data_type": "string", "required": True},
            ],
            "match_fields": ["name", "domain"],
            "survivorship_rules": {"name": "source_priority", "domain": "fill_nulls"},
            "quality_rules": [
                {"key": "domain", "type": "pattern", "value": r"[a-z0-9.-]+\.[a-z]{2,}"}
            ],
        },
    )
    assert response.status_code == 201, response.text
    return response.json()


def create_connection(client: TestClient) -> int:
    response = client.post(
        "/api/source/connections",
        json={
            "name": "mdm-test-source",
            "db_type": "postgres",
            "host": "localhost",
            "database": "source",
            "username": "readonly",
        },
    )
    assert response.status_code == 201, response.text
    return response.json()["id"]


def test_mdm_crosswalk_matching_approval_and_quality() -> None:
    client = client_with_db()
    create_entity(client)
    connection_id = create_connection(client)
    master = client.post(
        "/api/mdm/records",
        json={"entity_code": TEST_ENTITY, "attributes": {"name": "Acme Limited", "domain": "acme.com"}},
    )
    assert master.status_code == 201, master.text
    master_id = master.json()["id"]

    ingested = client.post(
        "/api/mdm/source-records",
        json={
            "source_connection_id": connection_id,
            "entity_code": TEST_ENTITY,
            "source_table": "companies",
            "records": [{"source_pk": "42", "payload": {"name": "Acme Ltd", "domain": "acme.com"}}],
        },
    )
    assert ingested.status_code == 200, ingested.text
    source_id = ingested.json()["records"][0]["id"]
    matches = client.post(f"/api/mdm/source-records/{source_id}/suggestions")
    assert matches.status_code == 200, matches.text
    assert matches.json()["candidates"][0]["master_record_id"] == master_id

    approved = client.post(
        f"/api/mdm/source-records/{source_id}/approve", json={}
    )
    assert approved.status_code == 200, approved.text
    assert approved.json()["master_record_id"] == master_id
    assert approved.json()["status"] == "approved"

    quality = client.get(f"/api/mdm/entities/{TEST_ENTITY}/quality")
    assert quality.status_code == 200, quality.text
    assert quality.json()["compliant_records"] == 1
    assert quality.json()["average_score"] == 1.0

    invalid = client.post(
        "/api/mdm/records",
        json={"entity_code": TEST_ENTITY, "attributes": {"name": "Bad Domain", "domain": "not-a-domain"}},
    )
    assert invalid.status_code == 201, invalid.text
    quality = client.get(f"/api/mdm/entities/{TEST_ENTITY}/quality").json()
    assert quality["compliant_records"] == 1
    bad_quality = next(row for row in quality["records"] if row["record"]["id"] == invalid.json()["id"])
    assert bad_quality["violations"] == ["domain: pattern"]

    reingested = client.post(
        "/api/mdm/source-records",
        json={
            "source_connection_id": connection_id,
            "entity_code": TEST_ENTITY,
            "source_table": "companies",
            "records": [{"source_pk": "42", "payload": {"name": "Acme Ltd", "domain": "acme.com"}}],
        },
    )
    assert reingested.status_code == 200, reingested.text
    assert reingested.json()["created"] == 0
    assert reingested.json()["updated"] == 1
    assert reingested.json()["records"][0]["master_record_id"] == master_id
    deleted = client.delete(f"/api/source/connections/{connection_id}")
    assert deleted.status_code == 204, deleted.text
    assert client.get(f"/api/mdm/source-records?entity_code={TEST_ENTITY}").json() == []


def test_mdm_merge_survivorship_unmerge_and_hierarchy_cycle_guard() -> None:
    client = client_with_db()
    create_entity(client)
    connection_id = create_connection(client)
    survivor = client.post(
        "/api/mdm/records",
        json={"entity_code": TEST_ENTITY, "attributes": {"name": "Acme", "domain": None}},
    ).json()
    loser = client.post(
        "/api/mdm/records",
        json={"entity_code": TEST_ENTITY, "attributes": {"name": "Acme Holdings", "domain": "acme.com"}},
    ).json()
    client.post(
        "/api/mdm/source-records",
        json={
            "source_connection_id": connection_id,
            "entity_code": TEST_ENTITY,
            "source_table": "companies",
            "records": [
                {"source_pk": "1", "payload": {"name": "Acme", "domain": None}, "source_priority": 1},
                {"source_pk": "2", "payload": {"name": "Acme Holdings", "domain": "acme.com"}, "source_priority": 10},
            ],
        },
    )
    rows = client.get(f"/api/mdm/source-records?entity_code={TEST_ENTITY}").json()
    for source in rows:
        master_id = survivor["id"] if source["source_pk"] == "1" else loser["id"]
        response = client.post(
            f"/api/mdm/source-records/{source['id']}/approve", json={"master_record_id": master_id}
        )
        assert response.status_code == 200, response.text

    merged = client.post(
        f"/api/mdm/records/{loser['id']}/merge", json={"survivor_id": survivor["id"]}
    )
    assert merged.status_code == 200, merged.text
    assert merged.json()["attributes"] == {"name": "Acme Holdings", "domain": "acme.com"}
    assert client.get(f"/api/mdm/records/{loser['id']}/history").json()

    unmerged = client.post(f"/api/mdm/records/{loser['id']}/unmerge")
    assert unmerged.status_code == 200, unmerged.text
    assert unmerged.json()["status"] == "active"
    restored = client.get(f"/api/mdm/records?entity_code={TEST_ENTITY}").json()
    assert next(row for row in restored if row["id"] == survivor["id"])["attributes"] == {
        "name": "Acme", "domain": None
    }
    restored_sources = client.get(f"/api/mdm/source-records?entity_code={TEST_ENTITY}").json()
    assert next(row for row in restored_sources if row["source_pk"] == "2")["master_record_id"] == loser["id"]

    link = client.post(
        "/api/mdm/links",
        json={"parent_id": survivor["id"], "child_id": loser["id"], "relation_type": "subsidiary_of"},
    )
    assert link.status_code == 201, link.text
    cycle = client.post(
        "/api/mdm/links",
        json={"parent_id": loser["id"], "child_id": survivor["id"], "relation_type": "subsidiary_of"},
    )
    assert cycle.status_code == 400
    assert "cycle" in cycle.json()["detail"]

    assert client.post(
        f"/api/mdm/records/{loser['id']}/merge", json={"survivor_id": survivor["id"]}
    ).status_code == 200
    changed = client.put(
        f"/api/mdm/records/{survivor['id']}",
        json={"attributes": {"name": "Edited after merge", "domain": "acme.com"}},
    )
    assert changed.status_code == 200
    assert client.post(f"/api/mdm/records/{loser['id']}/unmerge").status_code == 409


def test_mdm_agent_only_proposes_links(monkeypatch) -> None:
    client = client_with_db()
    create_entity(client)
    connection_id = create_connection(client)
    master = client.post(
        "/api/mdm/records",
        json={"entity_code": TEST_ENTITY, "attributes": {"name": "Acme", "domain": "acme.com"}},
    ).json()
    source = client.post(
        "/api/mdm/source-records",
        json={
            "source_connection_id": connection_id,
            "entity_code": TEST_ENTITY,
            "source_table": "companies",
            "records": [{"source_pk": "1", "payload": {"name": "Acme", "domain": "acme.com"}}],
        },
    ).json()["records"][0]

    from api.app.services import agent

    calls = iter([
        (AgentToolCall(name="rank_master_matches"), ""),
        (AgentToolCall(name="propose_record_link", arguments={"master_record_id": master["id"], "confidence": 0.99}), ""),
        (AgentToolCall(name="finish", arguments={"summary": "Suggested a likely match."}), ""),
    ])
    monkeypatch.setattr(agent, "request_llm_turn", lambda *_args: next(calls))
    result = client.post("/api/agent/mdm/harmonize", json={"source_record_id": source["id"]})
    assert result.status_code == 200, result.text
    assert result.json()["status"] == "completed"
    assert result.json()["steps"][1]["observation"]["status"] == "pending"
    current = client.get(f"/api/mdm/source-records?entity_code={TEST_ENTITY}").json()[0]
    assert current["status"] == "pending"
    assert current["master_record_id"] is None
    assert current["proposed_master_record_id"] == master["id"]
