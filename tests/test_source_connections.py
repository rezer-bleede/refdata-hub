"""Unit coverage for source connection service helpers."""

from __future__ import annotations

import types

import pytest
from sqlalchemy.exc import OperationalError

from api.app.services import source_connections as svc


class DummyEngine:
    def __init__(self) -> None:
        self.dialect = types.SimpleNamespace(name="postgres")
        self.disposed = False

    def dispose(self) -> None:  # pragma: no cover - simple state flag
        self.disposed = True


def _operational_error(message: str) -> OperationalError:
    return OperationalError(message, None, None)


def _patched_engine(monkeypatch: pytest.MonkeyPatch) -> DummyEngine:
    engine = DummyEngine()
    parsed = svc.ParsedOptions(query={}, connect_args={}, schema=None)
    monkeypatch.setattr(svc, "_create_engine", lambda settings: (engine, parsed))
    return engine


def _patch_inspect(monkeypatch: pytest.MonkeyPatch, message: str) -> None:
    def _raise(_engine: DummyEngine) -> None:
        raise _operational_error(message)

    monkeypatch.setattr(svc, "inspect", _raise)


def test_list_tables_wrapped_inspection_error(monkeypatch: pytest.MonkeyPatch) -> None:
    engine = _patched_engine(monkeypatch)
    _patch_inspect(monkeypatch, "DNS failure")

    settings = svc.ConnectionSettings(
        db_type="postgresql",
        host="bad-host",
        port=5432,
        database="demo",
        username="user",
        password="pass",
    )

    with pytest.raises(svc.SourceConnectionServiceError) as excinfo:
        svc.list_tables(settings)

    assert "DNS failure" in str(excinfo.value)
    assert engine.disposed is True


def test_list_fields_wrapped_inspection_error(monkeypatch: pytest.MonkeyPatch) -> None:
    engine = _patched_engine(monkeypatch)
    _patch_inspect(monkeypatch, "connect failed")

    settings = svc.ConnectionSettings(
        db_type="postgresql",
        host="bad-host",
        port=5432,
        database="demo",
        username="user",
        password="pass",
    )

    with pytest.raises(svc.SourceConnectionServiceError) as excinfo:
        svc.list_fields(settings, table_name="customers", schema=None)

    assert "connect failed" in str(excinfo.value)
    assert engine.disposed is True
