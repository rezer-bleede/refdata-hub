"""Tests for the agentic harmonization integration."""

from __future__ import annotations

import os
import sys
from typing import Any, Iterator, Optional

import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session, select

ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if ROOT_DIR not in sys.path:
    sys.path.insert(0, ROOT_DIR)

os.environ.setdefault("REFDATA_DATABASE_URL", "sqlite:///:memory:")

from api.app.config import Settings
from api.app.database import create_db_engine, init_db, get_session
from api.app.main import create_app
from api.app.models import CanonicalValue, RawValue, ValueMapping
from api.app.schemas import AgentToolCall
from api.app.services import agent as agent_service
from api.app.services.agent import AgentEngine, AgentError
from api.app.services.agent import parse_agent_tool_response


def build_test_client() -> tuple[TestClient, Any]:
    settings = Settings(database_url="sqlite:///:memory:", match_threshold=0.55)
    app = create_app(settings)
    engine = create_db_engine(settings)
    app.state.engine = engine
    init_db(engine, settings=settings)

    def session_override() -> Iterator[Session]:
        with Session(engine) as session:
            yield session

    app.dependency_overrides[get_session] = session_override
    return TestClient(app), engine


class ScriptedLLM:
    """Stub provider that replays scripted turns and then auto-finishes."""

    def __init__(
        self,
        turns: Optional[list[Any]] = None,
        default: Optional[Any] = None,
    ) -> None:
        self.turns = list(turns or [])
        self.default = default

    def __call__(self, config, messages):
        if self.turns:
            turn = self.turns.pop(0)
            if isinstance(turn, Exception):
                raise turn
            return turn
        if isinstance(self.default, Exception):
            raise self.default
        if self.default is not None:
            return self.default
        return AgentToolCall(name="finish", arguments={"summary": "Auto-finish."}), ""


def call(name: str, **arguments) -> tuple[AgentToolCall, str]:
    return AgentToolCall(name=name, arguments=arguments), ""


@pytest.fixture()
def client_and_engine() -> tuple[TestClient, Any]:
    return build_test_client()


@pytest.fixture()
def engine_setup():
    settings = Settings(database_url="sqlite:///:memory:", match_threshold=0.55)
    engine = create_db_engine(settings)
    init_db(engine, settings=settings)
    from api.app.models import SystemConfig

    with Session(engine) as session:
        config = session.exec(select(SystemConfig)).first()
    return engine, config


def test_tools_endpoint_lists_agent_tools(client_and_engine) -> None:
    client, _ = client_and_engine
    response = client.get("/api/agent/tools")
    assert response.status_code == 200
    names = {tool["name"] for tool in response.json()}
    assert names == {
        "rank_matches",
        "list_canonical_values",
        "list_dimensions",
        "propose_mapping",
        "flag_for_review",
        "finish",
    }


def test_harmonize_records_advisory_suggestion(
    client_and_engine, monkeypatch: pytest.MonkeyPatch
) -> None:
    client, engine = client_and_engine

    with Session(engine) as session:
        single = session.exec(
            select(CanonicalValue).where(CanonicalValue.canonical_label == "Single")
        ).first()
        assert single is not None
        canonical_id = single.id

    monkeypatch.setattr(
        agent_service,
        "request_llm_turn",
        ScriptedLLM(
            turns=[
                call("rank_matches", raw_text="never married", dimension="marital_status"),
                call(
                    "propose_mapping",
                    raw_value="never married",
                    canonical_id=canonical_id,
                    confidence=0.93,
                    notes="Strong paraphrase match.",
                ),
            ]
        ),
    )

    response = client.post(
        "/api/agent/harmonize",
        json={"raw_text": "never married", "dimension": "marital_status"},
    )
    assert response.status_code == 200
    results = response.json()
    assert len(results) == 1
    run = results[0]
    assert run["status"] == "completed"
    assert run["suggested_canonical_id"] == canonical_id
    assert [step["tool"] for step in run["steps"]] == [
        "rank_matches",
        "propose_mapping",
        "finish",
    ]

    with Session(engine) as session:
        suggestions = session.exec(
            select(RawValue).where(RawValue.raw_text == "never married")
        ).all()
        assert len(suggestions) == 1
        assert suggestions[0].status == "suggested"
        assert suggestions[0].proposed_canonical_id == canonical_id
        assert session.exec(select(ValueMapping)).all() == []


def test_agent_never_approves_mappings(
    client_and_engine, monkeypatch: pytest.MonkeyPatch
) -> None:
    client, engine = client_and_engine

    connections = client.get("/api/source/connections").json()
    assert connections
    connection_id = connections[0]["id"]

    with Session(engine) as session:
        married = session.exec(
            select(CanonicalValue).where(CanonicalValue.canonical_label == "Married")
        ).first()
        assert married is not None

    monkeypatch.setattr(
        agent_service,
        "request_llm_turn",
        ScriptedLLM(
            turns=[
                call(
                    "propose_mapping",
                    raw_value="Wed",
                    canonical_id=married.id,
                    confidence=0.99,
                    status="approved",
                ),
            ]
        ),
    )

    response = client.post(
        "/api/agent/harmonize",
        json={
            "raw_text": "Wed",
            "dimension": "marital_status",
            "source_connection_id": connection_id,
            "source_table": "customers",
            "source_field": "marital",
        },
    )
    assert response.status_code == 200
    run = response.json()[0]
    assert run["status"] == "completed"
    assert run["steps"][0]["observation"]["status"] == "pending"

    with Session(engine) as session:
        mappings = session.exec(select(ValueMapping)).all()
        assert len(mappings) == 1
        assert mappings[0].status == "pending"
        assert mappings[0].source_connection_id == connection_id
        assert mappings[0].confidence == pytest.approx(0.99)


def test_flag_for_review_queues_pending_raw_value(
    client_and_engine, monkeypatch: pytest.MonkeyPatch
) -> None:
    client, engine = client_and_engine
    monkeypatch.setattr(
        agent_service,
        "request_llm_turn",
        ScriptedLLM(
            turns=[
                call(
                    "flag_for_review",
                    raw_value="common-law",
                    reason="No candidate above threshold.",
                    dimension="marital_status",
                ),
            ]
        ),
    )

    response = client.post(
        "/api/agent/harmonize",
        json={"raw_text": "common-law", "dimension": "marital_status"},
    )
    assert response.status_code == 200
    run = response.json()[0]
    assert run["status"] == "completed"

    with Session(engine) as session:
        raw = session.exec(select(RawValue).where(RawValue.raw_text == "common-law")).all()
        assert len(raw) == 1
        assert raw[0].status == "pending"
        assert raw[0].proposed_canonical_id is None


def test_max_steps_guard_marks_run_incomplete(
    client_and_engine, monkeypatch: pytest.MonkeyPatch
) -> None:
    client, _ = client_and_engine
    monkeypatch.setattr(
        agent_service,
        "request_llm_turn",
        ScriptedLLM(
            turns=[call("rank_matches", raw_text="Single")],
            default=call("rank_matches", raw_text="Single"),
        ),
    )

    response = client.post(
        "/api/agent/harmonize",
        json={"raw_text": "Single", "dimension": "marital_status", "max_steps": 3},
    )
    assert response.status_code == 200
    run = response.json()[0]
    assert run["status"] == "incomplete"
    assert len(run["steps"]) == 3


def test_llm_failure_returns_error_status(
    client_and_engine, monkeypatch: pytest.MonkeyPatch
) -> None:
    client, _ = client_and_engine
    monkeypatch.setattr(
        agent_service,
        "request_llm_turn",
        ScriptedLLM(turns=[AgentError("LLM exploded")]),
    )

    response = client.post(
        "/api/agent/harmonize",
        json={"raw_text": "anything", "dimension": "marital_status"},
    )
    assert response.status_code == 200
    run = response.json()[0]
    assert run["status"] == "error"
    assert "LLM exploded" in run["error"]


def test_unknown_tool_produces_corrective_observation(
    client_and_engine, monkeypatch: pytest.MonkeyPatch
) -> None:
    client, _ = client_and_engine
    monkeypatch.setattr(
        agent_service,
        "request_llm_turn",
        ScriptedLLM(turns=[call("delete_everything")]),
    )

    response = client.post(
        "/api/agent/harmonize",
        json={"raw_text": "Single", "dimension": "marital_status"},
    )
    assert response.status_code == 200
    run = response.json()[0]
    assert run["steps"][0]["tool"] == "delete_everything"
    assert "Unknown tool" in run["steps"][0]["observation"]["error"]


def test_harmonize_batch_deduplicates_values(
    client_and_engine, monkeypatch: pytest.MonkeyPatch
) -> None:
    client, _ = client_and_engine
    monkeypatch.setattr(agent_service, "request_llm_turn", ScriptedLLM())

    response = client.post(
        "/api/agent/harmonize",
        json={"raw_text": "Single", "values": ["Single", "Married", " "]},
    )
    assert response.status_code == 200
    results = response.json()
    assert [run["raw_text"] for run in results] == ["Single", "Married"]


def test_harmonize_requires_values(client_and_engine) -> None:
    client, _ = client_and_engine
    response = client.post("/api/agent/harmonize", json={})
    assert response.status_code == 400


def test_harmonize_rejects_unknown_dimension(client_and_engine) -> None:
    client, _ = client_and_engine
    response = client.post(
        "/api/agent/harmonize",
        json={"raw_text": "Single", "dimension": "does_not_exist"},
    )
    assert response.status_code == 400


def test_harmonize_requires_full_source_context(client_and_engine) -> None:
    client, _ = client_and_engine
    response = client.post(
        "/api/agent/harmonize",
        json={"raw_text": "Single", "source_connection_id": 1},
    )
    assert response.status_code == 400


def test_rank_match_tool_uses_semantic_matcher(
    engine_setup, monkeypatch: pytest.MonkeyPatch
) -> None:
    engine, config = engine_setup
    monkeypatch.setattr(
        agent_service,
        "request_llm_turn",
        ScriptedLLM(
            turns=[call("rank_matches", raw_text="not married", dimension="marital_status")]
        ),
    )

    with Session(engine) as session:
        agent = AgentEngine(session=session, config=config)
        result = agent.run("not married", dimension="marital_status")

    assert result.status == "completed"
    observation = result.steps[0].observation
    assert observation["dimension"] == "marital_status"
    labels = {match["canonical_label"] for match in observation["matches"]}
    assert labels <= {"Single", "Married"}


def test_offline_tool_response_parsing() -> None:
    parsed = parse_agent_tool_response(
        '{"tool": "finish", "arguments": {"summary": "done"}}'
    )
    assert parsed is not None
    assert parsed.name == "finish"
    assert parsed.arguments == {"summary": "done"}

    fenced = parse_agent_tool_response(
        '```json\n{"name": "rank_matches", "arguments": "{\\"raw_text\\": \\"x\\"}"}\n```'
    )
    assert fenced is not None
    assert fenced.name == "rank_matches"
    assert fenced.arguments == {"raw_text": "x"}

    with_prose = parse_agent_tool_response(
        'Sure! {"tool": "flag_for_review", "arguments": {"raw_value": "x"}} -- done.'
    )
    assert with_prose is not None
    assert with_prose.name == "flag_for_review"

    assert parse_agent_tool_response("no json here") is None
    assert parse_agent_tool_response("") is None


def test_online_turn_requires_credentials() -> None:
    settings = Settings(database_url="sqlite:///:memory:")
    engine = create_db_engine(settings)
    init_db(engine, settings=settings)
    from api.app.models import SystemConfig

    with Session(engine) as session:
        config = session.exec(select(SystemConfig)).first()
        assert config is not None
        config.llm_mode = "online"
        config.llm_api_key = None
        with pytest.raises(AgentError):
            agent_service._request_online_turn(config, [{"role": "user", "content": "hi"}])
