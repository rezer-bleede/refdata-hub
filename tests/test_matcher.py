import json

import numpy as np
import pytest

from api.app import embeddings as embeddings_module
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


class FakeEmbeddingModel:
    """Deterministic embedding provider stub for tests."""

    def __init__(self, vectors: dict[str, list[float]]):
        self.vectors = vectors
        self.calls: list[list[str]] = []

    def embed(self, texts):
        self.calls.append(list(texts))
        missing = [text for text in texts if text not in self.vectors]
        if missing:
            raise KeyError(f"fake model missing vectors for {missing}")
        return [np.asarray(self.vectors[text], dtype=np.float32) for text in texts]


@pytest.fixture(autouse=True)
def _fresh_embedding_state():
    """Clear the global model registry and vector cache between tests."""

    embeddings_module.reset_state()
    yield
    embeddings_module.reset_state()


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

    def boom(model_name: str):
        raise RuntimeError("model download unavailable")

    monkeypatch.setattr(embeddings_module, "build_model", boom)

    config = SystemConfig(
        matcher_backend="llm",
        llm_mode="offline",
        llm_model="llama3",
        embedding_model="BAAI/fake-unreachable-model",
    )
    matcher = SemanticMatcher(config=config, canonical_values=canonical_values)
    results = matcher.rank("example")

    # Falls back to embeddings (then lexical) when offline provider fails
    assert results
    assert all(result.score >= 0 for result in results)


def test_parse_llm_json_extracts_list(canonical_values) -> None:
    config = SystemConfig(matcher_backend="llm", llm_mode="offline")
    matcher = SemanticMatcher(config=config, canonical_values=canonical_values)
    fenced = "```json\n[{\"id\": 1, \"score\": 0.5}]\n```"
    parsed = matcher._parse_llm_json(fenced)
    assert parsed == [{"id": 1, "score": 0.5}]


def test_embedding_rank_respects_exact_label_match(
    monkeypatch: pytest.MonkeyPatch, canonical_values
) -> None:
    fake = FakeEmbeddingModel(
        {
            "  single ": [0.0, 1.0],
            "Married": [1.0, 0.0],
            "Single": [0.6, 0.8],
        }
    )
    monkeypatch.setattr(embeddings_module, "build_model", lambda name: fake)

    config = SystemConfig(
        matcher_backend="embedding",
        embedding_model="BAAI/fake-exact-model",
        top_k=2,
    )
    matcher = SemanticMatcher(config=config, canonical_values=canonical_values)

    matches = matcher.rank("  single ")

    assert matches
    assert matches[0].canonical_label == "Single"
    assert matches[0].score == 1.0


def test_rank_with_semantic_embeddings_ranks_by_cosine(
    monkeypatch: pytest.MonkeyPatch, canonical_values
) -> None:
    fake = FakeEmbeddingModel(
        {
            "Single": [1.0, 0.0],
            "Married": [0.0, 1.0],
            "never married": [0.95, 0.05],
        }
    )
    monkeypatch.setattr(embeddings_module, "build_model", lambda name: fake)

    config = SystemConfig(
        matcher_backend="embedding",
        embedding_model="BAAI/fake-semantic-model",
        top_k=2,
    )
    matcher = SemanticMatcher(config=config, canonical_values=canonical_values)
    matches = matcher.rank("never married")

    assert matches[0].canonical_label == "Single"
    assert matches[0].score > 0.9
    assert matches[1].canonical_label == "Married"
    assert matches[1].score < 0.1


def test_semantic_embeddings_caches_canonical_vectors(
    monkeypatch: pytest.MonkeyPatch, canonical_values
) -> None:
    fake = FakeEmbeddingModel(
        {
            "Single": [1.0, 0.0],
            "Married": [0.0, 1.0],
            "never married": [0.95, 0.05],
            "happily wed": [0.05, 0.95],
        }
    )
    monkeypatch.setattr(embeddings_module, "build_model", lambda name: fake)

    config = SystemConfig(
        matcher_backend="embedding",
        embedding_model="BAAI/fake-cache-model",
        top_k=2,
    )
    matcher = SemanticMatcher(config=config, canonical_values=canonical_values)

    first = matcher.rank("never married")
    second = matcher.rank("happily wed")

    assert first[0].canonical_label == "Single"
    assert second[0].canonical_label == "Married"
    # Canonical labels are only embedded once; the second query embeds itself alone.
    assert len(fake.calls) == 2
    assert fake.calls[0] == ["never married", "Married", "Single"]
    assert fake.calls[1] == ["happily wed"]


def test_legacy_tfidf_config_resolves_to_default_model(
    monkeypatch: pytest.MonkeyPatch, canonical_values
) -> None:
    captured: list[str] = []
    fake = FakeEmbeddingModel(
        {
            "Single": [1.0, 0.0],
            "Married": [0.0, 1.0],
            "never married": [0.95, 0.05],
        }
    )

    def spy(model_name: str):
        captured.append(model_name)
        return fake

    monkeypatch.setattr(embeddings_module, "build_model", spy)

    config = SystemConfig(
        matcher_backend="embedding",
        embedding_model="tfidf",
        top_k=2,
    )
    matcher = SemanticMatcher(config=config, canonical_values=canonical_values)
    matches = matcher.rank("never married")

    assert captured == [embeddings_module.DEFAULT_MODEL_NAME]
    assert matches[0].canonical_label == "Single"


def test_semantic_embedding_failure_falls_back_to_lexical(
    monkeypatch: pytest.MonkeyPatch, canonical_values
) -> None:
    def boom(model_name: str):
        raise RuntimeError("model download unavailable")

    monkeypatch.setattr(embeddings_module, "build_model", boom)

    config = SystemConfig(
        matcher_backend="embedding",
        embedding_model="BAAI/fake-broken-model",
        top_k=2,
    )
    matcher = SemanticMatcher(config=config, canonical_values=canonical_values)
    matches = matcher.rank("Single")

    assert matches
    assert matches[0].canonical_label == "Single"
    assert matches[0].score == 1.0


AMBIGUOUS_VECTORS = {
    "Single": [0.9, 0.44],
    "Married": [0.9, -0.44],
    "never married": [1.0, 0.0],
}


def _escalation_config(model_name: str, enabled: bool) -> SystemConfig:
    return SystemConfig(
        matcher_backend="embedding",
        embedding_model=model_name,
        llm_escalation=enabled,
        llm_mode="offline",
        llm_model="llama3",
        top_k=2,
    )


def _llm_payload() -> dict[str, object]:
    return {
        "message": {
            "content": json.dumps(
                [
                    {"id": 2, "score": 0.91},
                    {"id": 1, "score": 0.2},
                ]
            )
        }
    }


def test_llm_escalation_reranks_ambiguous_matches(
    monkeypatch: pytest.MonkeyPatch, canonical_values
) -> None:
    fake = FakeEmbeddingModel(AMBIGUOUS_VECTORS)
    monkeypatch.setattr(embeddings_module, "build_model", lambda name: fake)

    calls: list[dict[str, object]] = []
    monkeypatch.setattr(
        "api.app.matcher.httpx.Client",
        lambda *args, **kwargs: DummyHttpClient(_llm_payload(), calls),
    )

    config = _escalation_config("BAAI/fake-escalation-model", enabled=True)
    matcher = SemanticMatcher(config=config, canonical_values=canonical_values)
    matches = matcher.rank("never married")

    assert calls, "expected an escalation request to the configured LLM"
    assert matches[0].canonical_label == "Single"
    assert matches[0].score == 0.91


def test_llm_escalation_is_disabled_by_default(
    monkeypatch: pytest.MonkeyPatch, canonical_values
) -> None:
    fake = FakeEmbeddingModel(AMBIGUOUS_VECTORS)
    monkeypatch.setattr(embeddings_module, "build_model", lambda name: fake)

    calls: list[dict[str, object]] = []
    monkeypatch.setattr(
        "api.app.matcher.httpx.Client",
        lambda *args, **kwargs: DummyHttpClient(_llm_payload(), calls),
    )

    config = _escalation_config("BAAI/fake-no-escalation-model", enabled=False)
    matcher = SemanticMatcher(config=config, canonical_values=canonical_values)
    matches = matcher.rank("never married")

    assert not calls
    assert matches[1].score <= 0.91
    assert {match.canonical_label for match in matches} == {"Single", "Married"}


def test_llm_escalation_keeps_embeddings_when_llm_unavailable(
    monkeypatch: pytest.MonkeyPatch, canonical_values
) -> None:
    fake = FakeEmbeddingModel(AMBIGUOUS_VECTORS)
    monkeypatch.setattr(embeddings_module, "build_model", lambda name: fake)

    class FailingClient(DummyHttpClient):
        def post(self, url: str, json: dict[str, object]) -> DummyResponse:
            raise RuntimeError("ollama unavailable")

    monkeypatch.setattr(
        "api.app.matcher.httpx.Client",
        lambda *args, **kwargs: FailingClient({}, []),
    )

    config = _escalation_config("BAAI/fake-llm-down-model", enabled=True)
    matcher = SemanticMatcher(config=config, canonical_values=canonical_values)
    matches = matcher.rank("never married")

    assert matches
    assert {match.canonical_label for match in matches} == {"Single", "Married"}


def test_llm_escalation_skipped_for_confident_matches(
    monkeypatch: pytest.MonkeyPatch, canonical_values
) -> None:
    fake = FakeEmbeddingModel(
        {
            "Single": [1.0, 0.0],
            "Married": [0.0, 1.0],
            "never married": [0.99, 0.01],
        }
    )
    monkeypatch.setattr(embeddings_module, "build_model", lambda name: fake)

    calls: list[dict[str, object]] = []
    monkeypatch.setattr(
        "api.app.matcher.httpx.Client",
        lambda *args, **kwargs: DummyHttpClient(_llm_payload(), calls),
    )

    config = _escalation_config("BAAI/fake-confident-model", enabled=True)
    matcher = SemanticMatcher(config=config, canonical_values=canonical_values)
    matches = matcher.rank("never married")

    assert not calls
    assert matches[0].canonical_label == "Single"
