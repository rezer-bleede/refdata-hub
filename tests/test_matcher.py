import json

import pytest

from api.app.matcher import SemanticMatcher
from api.app.models import CanonicalValue, SourceSample, SystemConfig
from api.app.routes.source import _suggestions_for_samples


class DummyResponse:
    def __init__(self, payload: dict[str, object]):
        self.payload = payload

    def raise_for_status(self) -> None:
        pass

    def json(self) -> dict[str, object]:
        return self.payload


class DummyHttpClient:
    def __init__(self, payload: dict[str, object], calls: list[dict[str, object]]):
        self.payload = payload
        self.calls = calls

    def __enter__(self):
        return self

    def __exit__(self, *_):
        return False

    def post(self, url: str, json: dict[str, object]) -> DummyResponse:
        self.calls.append({"url": url, "payload": json})
        return DummyResponse(self.payload)


@pytest.fixture
def canonical_values() -> list[CanonicalValue]:
    return [
        CanonicalValue(id=1, dimension="company", canonical_label="Acme Logistics LLC"),
        CanonicalValue(id=2, dimension="company", canonical_label="Acme Ventures"),
    ]


def test_default_uses_high_precision_name_similarity(canonical_values) -> None:
    matcher = SemanticMatcher(SystemConfig(), canonical_values)
    matches = matcher.rank("ACME LOGISTICS, LLC")
    assert matches[0].canonical_id == 1
    assert matches[0].score == 1

    typo = matcher.rank("Acme Logistcs LLC")
    assert typo[0].canonical_id == 1
    assert typo[0].score >= 0.9

    # A shared token or subset is not enough to suggest an identity match.
    assert matcher.rank("Acme")[0].score < 0.9


def test_name_similarity_handles_word_order_but_not_partial_names() -> None:
    values = [CanonicalValue(id=1, dimension="company", canonical_label="Saudi National Bank")]
    matches = SemanticMatcher(SystemConfig(), values).rank("National Saudi Bank")
    assert matches[0].score == 1
    assert SemanticMatcher(SystemConfig(), values).rank("Saudi")[0].score < 0.9


def test_tied_identity_candidates_stay_unmatched() -> None:
    values = [
        CanonicalValue(id=1, dimension="company", canonical_label="Acme Group"),
        CanonicalValue(id=2, dimension="company", canonical_label="Acme Group"),
    ]
    sample = SourceSample(
        source_connection_id=1,
        source_table="employers",
        source_field="company_name",
        raw_value="Acme Group",
        occurrence_count=1,
    )
    matched, unmatched, matched_values = _suggestions_for_samples(
        [sample], SemanticMatcher(SystemConfig(), values), 0.9, {}, {}
    )
    assert matched == 0
    assert not matched_values
    assert unmatched[0].suggestions[0].score == 1


def test_empty_input_has_no_candidates(canonical_values) -> None:
    assert SemanticMatcher(SystemConfig(), canonical_values).rank("  ") == []


def test_llm_backend_ranks_valid_response(monkeypatch: pytest.MonkeyPatch, canonical_values) -> None:
    calls: list[dict[str, object]] = []
    payload = {"message": {"content": json.dumps([
        {"id": 2, "score": 0.91}, {"id": 1, "score": 0.33},
    ])}}
    monkeypatch.setattr(
        "api.app.matcher.httpx.Client", lambda *args, **kwargs: DummyHttpClient(payload, calls)
    )
    matcher = SemanticMatcher(
        SystemConfig(matcher_backend="llm", llm_mode="offline", llm_model="llama3", top_k=2),
        canonical_values,
    )
    matches = matcher.rank("Acme Ventures")
    assert matches[0].canonical_id == 2
    assert calls and calls[0]["url"].endswith("/api/chat")


def test_llm_failure_falls_back_to_name_similarity(monkeypatch: pytest.MonkeyPatch, canonical_values) -> None:
    class FailingClient(DummyHttpClient):
        def post(self, url: str, json: dict[str, object]) -> DummyResponse:
            raise RuntimeError("offline provider unavailable")

    monkeypatch.setattr(
        "api.app.matcher.httpx.Client", lambda *args, **kwargs: FailingClient({}, [])
    )
    matcher = SemanticMatcher(
        SystemConfig(matcher_backend="llm", llm_mode="offline"), canonical_values
    )
    assert matcher.rank("Acme Logistics LLC")[0].score == 1


def test_parse_llm_json_extracts_fenced_list(canonical_values) -> None:
    matcher = SemanticMatcher(SystemConfig(matcher_backend="llm"), canonical_values)
    assert matcher._parse_llm_json('```json\n[{"id": 1, "score": 0.5}]\n```') == [
        {"id": 1, "score": 0.5}
    ]
