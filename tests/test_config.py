"""Unit tests for configuration handling."""

from __future__ import annotations

from typing import List

import os

import pytest

from api.app.config import Settings


def _reset_env(var_name: str) -> None:
    os.environ.pop(var_name, None)


@pytest.fixture(autouse=True)
def clear_env() -> List[str]:
    """Ensure environment mutations from tests do not leak."""

    existing = os.environ.get("REFDATA_CORS_ORIGINS")
    try:
        yield
    finally:
        if existing is None:
            _reset_env("REFDATA_CORS_ORIGINS")
        else:
            os.environ["REFDATA_CORS_ORIGINS"] = existing


def test_cors_origins_default_is_preserved() -> None:
    settings = Settings()
    assert settings.cors_origins == [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ]


def test_cors_origins_accepts_comma_separated_values() -> None:
    os.environ["REFDATA_CORS_ORIGINS"] = "https://example.com, https://foo.bar"
    settings = Settings()
    assert settings.cors_origins == [
        "https://example.com",
        "https://foo.bar",
    ]


def test_cors_origins_accepts_json_list() -> None:
    os.environ["REFDATA_CORS_ORIGINS"] = "[\"https://one\", \"https://two\"]"
    settings = Settings()
    assert settings.cors_origins == [
        "https://one",
        "https://two",
    ]


def test_cors_origins_handles_single_json_string() -> None:
    os.environ["REFDATA_CORS_ORIGINS"] = '"https://solo"'
    settings = Settings()
    assert settings.cors_origins == ["https://solo"]


def test_cors_origins_falls_back_to_default_on_blank_string() -> None:
    os.environ["REFDATA_CORS_ORIGINS"] = ""
    settings = Settings()
    assert settings.cors_origins == [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ]


def test_cors_origins_rejects_non_string_entries() -> None:
    os.environ["REFDATA_CORS_ORIGINS"] = "[\"https://one\", 42]"
    with pytest.raises(ValueError):
        Settings()
