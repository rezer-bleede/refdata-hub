"""Regression tests for the demo target database seed script."""

from __future__ import annotations

import re
from pathlib import Path


SQL_PATH = Path("db/targetdb-init.sql")


def _normalize(sql: str) -> str:
    """Collapse whitespace to simplify pattern matching."""

    return re.sub(r"\s+", " ", sql).strip()


def test_departments_code_enforced_unique() -> None:
    """The departments seed relies on a unique code for ON CONFLICT clauses."""

    sql = SQL_PATH.read_text(encoding="utf-8")
    normalized = _normalize(sql).lower()

    assert "create table if not exists departments" in normalized

    has_inline_unique = re.search(
        r"code\s+text\s+not\s+null\s+unique",
        sql,
        flags=re.IGNORECASE | re.MULTILINE,
    )

    has_table_constraint = re.search(
        r"unique\s*\(\s*code\s*\)",
        sql,
        flags=re.IGNORECASE | re.MULTILINE,
    )

    assert has_inline_unique or has_table_constraint


def test_departments_seed_uses_on_conflict_code_clause() -> None:
    """The insert statement keeps boot idempotent by ignoring duplicates."""

    sql = SQL_PATH.read_text(encoding="utf-8")
    normalized = _normalize(sql).lower()

    assert "insert into departments" in normalized
    assert "on conflict (code) do nothing" in normalized
