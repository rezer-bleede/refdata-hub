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

    conflict_clause = re.search(
        r"on\s+conflict\s*\(\s*code\s*\)\s+do\s+update",
        normalized,
    )

    assert conflict_clause, "Department seed should upsert by code to stay idempotent"


def test_customers_table_includes_demographic_columns() -> None:
    """The richer customer profile should expose demographic and loyalty signals."""

    sql = SQL_PATH.read_text(encoding="utf-8")

    create_stmt = re.search(
        r"create\s+table\s+if\s+not\s+exists\s+customers\s*\((?P<body>.*?)\)\s*;",
        sql,
        flags=re.IGNORECASE | re.DOTALL,
    )

    assert create_stmt, "Customers table definition missing"

    body = create_stmt.group("body").lower()
    for column in (
        "customer_number text not null unique",
        "phone text",
        "marital_status text",
        "date_of_birth date",
        "loyalty_status text",
        "annual_income numeric",
    ):
        assert column in body, f"Expected column definition for {column}"


def test_orders_and_items_cover_multiple_statuses_and_categories() -> None:
    """Seeded orders should exercise the richer catalogue and workflow states."""

    sql = SQL_PATH.read_text(encoding="utf-8")
    normalized = _normalize(sql).lower()

    assert "create table if not exists orders" in normalized
    assert "create table if not exists order_items" in normalized

    for status in ("completed", "processing", "shipped", "pending payment"):
        assert status in normalized, f"Order status '{status}' not represented"

    for category in ("accessories", "software", "hardware", "services"):
        assert category in normalized, f"Product category '{category}' missing"


def test_seed_includes_realistic_global_addresses() -> None:
    """Verify the address inserts span multiple regions for mapping demos."""

    sql = SQL_PATH.read_text(encoding="utf-8")
    normalized = _normalize(sql).lower()

    for country in (
        "united arab emirates",
        "ireland",
        "india",
        "colombia",
        "japan",
        "united states",
        "nigeria",
        "sweden",
    ):
        assert country in normalized, f"Expected address example for {country}"

    assert "unique (customer_id, address_type)" in normalized
