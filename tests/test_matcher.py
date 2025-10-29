import json

import pytest

from api.app.matcher import SemanticMatcher
from api.app.models import CanonicalValue, SystemConfig


class DummyResponse:
    def __init__(self, payload: dict[str, object]):
        self._payload = payload

    def raise_for_status(self) -> None:  # pragma: no cover - no-op for tests
        return None

    def json(self) -> dict[str, object]:
        return self._payload


class DummyHttpClient:
    def __init__(self, payload: dict[str, object], recorder: list[dict[str, object]]):
        self._payload = payload
        self._recorder = recorder

    def __enter__(self) -> "DummyHttpClient":
        return self

    def __exit__(self, exc_type, exc, tb) -> bool:  # pragma: no cover - no cleanup needed
        return False

    def post(self, url: str, json: dict[str, object]) -> DummyResponse:
        self._recorder.append({"url": url, "payload": json})
        return DummyResponse(self._payload)


@pytest.fixture()
def canonical_values() -> list[CanonicalValue]:
    return [
        CanonicalValue(id=1, dimension="marital_status", canonical_label="Married"),
        CanonicalValue(id=2, dimension="marital_status", canonical_label="Single"),
    ]


def test_rank_with_offline_llm(monkeypatch: pytest.MonkeyPatch, canonical_values) -> None:
    calls: list[dict[str, object]] = []
    payload = {
        "message": {
            "content": json.dumps(
                [
                    {"id": 2, "score": 0.91},
                    {"id": 1, "score": 0.33},
                ]
            )
        }
    }

    monkeypatch.setattr(
        "api.app.matcher.httpx.Client",
        lambda *args, **kwargs: DummyHttpClient(payload, calls),
    )

    config = SystemConfig(
        matcher_backend="llm",
        llm_mode="offline",
        llm_model="llama3",
        top_k=2,
    )
    matcher = SemanticMatcher(config=config, canonical_values=canonical_values)
    matches = matcher.rank("Divorced")

    assert len(matches) == 2
    assert matches[0].canonical_label == "Single"
    assert calls and calls[0]["url"].endswith("/api/chat")


def test_rank_with_offline_llm_handles_invalid_json(monkeypatch: pytest.MonkeyPatch, canonical_values) -> None:
    class FailingClient(DummyHttpClient):
        def post(self, url: str, json: dict[str, object]) -> DummyResponse:
            raise RuntimeError("offline provider unavailable")

    monkeypatch.setattr(
        "api.app.matcher.httpx.Client",
        lambda *args, **kwargs: FailingClient({}, []),
    )

    config = SystemConfig(
        matcher_backend="llm",
        llm_mode="offline",
        llm_model="llama3",
    )
    matcher = SemanticMatcher(config=config, canonical_values=canonical_values)
    results = matcher.rank("example")

    # Falls back to embeddings when offline provider fails
    assert results
    assert all(result.score >= 0 for result in results)


def test_parse_llm_json_extracts_list(canonical_values) -> None:
    config = SystemConfig(matcher_backend="llm", llm_mode="offline")
    matcher = SemanticMatcher(config=config, canonical_values=canonical_values)
    fenced = "```json\n[{\"id\": 1, \"score\": 0.5}]\n```"
    parsed = matcher._parse_llm_json(fenced)
    assert parsed == [{"id": 1, "score": 0.5}]
