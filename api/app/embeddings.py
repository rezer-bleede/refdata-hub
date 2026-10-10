"""Local embedding providers backed by fastembed (ONNX).

Exposes a lazily initialised, thread-safe model registry plus a
content-addressed vector cache so canonical labels are only embedded once
per process. Tests can monkeypatch ``build_model`` to avoid downloading
real ONNX weights.
"""

from __future__ import annotations

import logging
import threading
from collections import OrderedDict
from typing import Any, Dict, Iterable, List, Sequence

import numpy as np

LOGGER = logging.getLogger(__name__)

LEGACY_MODEL_ALIASES = {"", "tfidf", "tf-idf"}
DEFAULT_MODEL_NAME = "BAAI/bge-small-en-v1.5"

MAX_CACHE_ENTRIES = 4096

_model_lock = threading.Lock()
_models: Dict[str, Any] = {}

_cache_lock = threading.Lock()
_vector_cache: "OrderedDict[tuple[str, str], np.ndarray]" = OrderedDict()


def resolve_model_name(embedding_model: str | None) -> str:
    """Map legacy or empty configuration values onto the default model."""

    name = (embedding_model or "").strip()
    if name.casefold() in LEGACY_MODEL_ALIASES:
        return DEFAULT_MODEL_NAME
    return name


def build_model(model_name: str) -> Any:
    """Instantiate a fastembed provider. Overridden by tests."""

    from fastembed import TextEmbedding

    LOGGER.info("Loading embedding model '%s'", model_name)
    return TextEmbedding(model_name=model_name)


def get_model(model_name: str) -> Any:
    """Return the shared provider instance for ``model_name``."""

    name = model_name.strip()
    with _model_lock:
        provider = _models.get(name)
        if provider is None:
            provider = build_model(name)
            _models[name] = provider
        return provider


def _normalise(vector: Iterable[float]) -> np.ndarray:
    array = np.asarray(vector, dtype=np.float32)
    norm = float(np.linalg.norm(array))
    if norm > 0.0:
        array = array / norm
    return array


def embed_texts(model_name: str, texts: Sequence[str]) -> np.ndarray:
    """Embed ``texts`` into a row-stacked, L2-normalised matrix.

    Results are cached per ``(model, text)`` pair; unchanged canonical
    values therefore never re-encode, and edits simply become new keys.
    """

    name = model_name.strip()
    if not texts:
        return np.zeros((0, 0), dtype=np.float32)

    vectors: List[np.ndarray | None] = []
    miss_indices: List[int] = []
    with _cache_lock:
        for index, text in enumerate(texts):
            key = (name, text)
            cached = _vector_cache.get(key)
            if cached is None:
                vectors.append(None)
                miss_indices.append(index)
            else:
                _vector_cache.move_to_end(key)
                vectors.append(cached)

    if miss_indices:
        provider = get_model(name)
        missing = [texts[index] for index in miss_indices]
        fresh = [_normalise(vector) for vector in provider.embed(missing)]
        with _cache_lock:
            for index, vector in zip(miss_indices, fresh):
                vectors[index] = vector
                key = (name, texts[index])
                _vector_cache[key] = vector
                _vector_cache.move_to_end(key)
            while len(_vector_cache) > MAX_CACHE_ENTRIES:
                _vector_cache.popitem(last=False)

    return np.vstack([vector for vector in vectors if vector is not None])


def reset_state() -> None:
    """Drop cached models and vectors (used by tests)."""

    with _model_lock:
        _models.clear()
    with _cache_lock:
        _vector_cache.clear()
