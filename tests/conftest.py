"""Pytest fixtures and configuration shared across test modules."""

from __future__ import annotations

import os
import sys
from pathlib import Path


def _ensure_repo_on_path() -> None:
    """Insert the repository root into ``sys.path`` for package imports."""

    repo_root = Path(__file__).resolve().parent.parent
    root_str = str(repo_root)
    if root_str not in sys.path:
        sys.path.insert(0, root_str)

    # Ensure the environment matches the dynamically created engine URLs in tests.
    os.environ.setdefault("REFDATA_DATABASE_URL", "sqlite:///:memory:")


_ensure_repo_on_path()
