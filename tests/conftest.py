"""Pytest fixtures and configuration shared across test modules."""

from __future__ import annotations

import hashlib
import os
import sys
from pathlib import Path

import numpy as np
import pytest


def _ensure_repo_on_path() -> None:
    """Insert the repository root into ``sys.path`` for package imports."""

    repo_root = Path(__file__).resolve().parent.parent
    root_str = str(repo_root)
    if root_str not in sys.path:
        sys.path.insert(0, root_str)

    # Ensure the environment matches the dynamically created engine URLs in tests.
    os.environ.setdefault("REFDATA_DATABASE_URL", "sqlite:///:memory:")


_ensure_repo_on_path()

EMBEDDING_DIM = 64


class DeterministicEmbeddings:
    """Offline stub that replaces fastembed providers during tests."""

    def embed(self, texts):
        for text in texts:
            yield self._vector(text)

    @staticmethod
    def _vector(text: str) -> np.ndarray:
        tokens = text.casefold().replace("-", " ").split() or [text.casefold()]
        vector = np.zeros(EMBEDDING_DIM, dtype=np.float32)
        for token in tokens:
            seed = int.from_bytes(
                hashlib.blake2b(token.encode("utf-8"), digest_size=8).digest(), "big"
            )
            rng = np.random.default_rng(seed)
            vector += rng.standard_normal(EMBEDDING_DIM).astype(np.float32)
        return vector


@pytest.fixture(autouse=True)
def stub_embedding_provider(monkeypatch: pytest.MonkeyPatch) -> None:
    """Keep the suite offline and hermetic by faking the ONNX model loader."""

    monkeypatch.setattr(
        "api.app.embeddings.build_model", lambda model_name: DeterministicEmbeddings()
    )
