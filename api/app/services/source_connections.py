"""Utilities for working with external source system connections."""

from __future__ import annotations

import json
import logging
import time
from dataclasses import dataclass
from typing import Any, Iterable, Optional
from urllib.parse import urlencode

from sqlalchemy import MetaData, Table, func, inspect, select, text
from sqlalchemy.engine import URL
from sqlalchemy.exc import SQLAlchemyError
from sqlmodel import create_engine

logger = logging.getLogger(__name__)


class SourceConnectionServiceError(Exception):
    """Base error for source connection helpers."""


@dataclass
class ConnectionSettings:
    """Lightweight representation of connection credentials."""

    db_type: str
    host: str
    port: int
    database: str
    username: str
    password: Optional[str] = None
    options: Optional[str] = None
    name: Optional[str] = None


@dataclass
class ParsedOptions:
    """Structured representation of optional connection metadata."""

    query: dict[str, str]
    connect_args: dict[str, Any]
    schema: Optional[str]


def _normalise_query_value(value: Any) -> Optional[str]:
    if value is None:
        return None
    if isinstance(value, bool):
        return "true" if value else "false"
    return str(value)


def _parse_options(raw: Optional[str]) -> ParsedOptions:
    if not raw:
        return ParsedOptions(query={}, connect_args={}, schema=None)

    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError as exc:  # pragma: no cover - defensive logging
        logger.debug("Failed to parse connection options JSON", exc_info=exc)
        raise SourceConnectionServiceError("Options must be valid JSON") from exc

    if not isinstance(parsed, dict):
        raise SourceConnectionServiceError("Options must decode to a JSON object")

    query: dict[str, Any] = {}
    connect_args: dict[str, Any] = {}
    schema: Optional[str] = None

    if "schema" in parsed:
        schema_value = parsed.pop("schema")
        if schema_value is not None and not isinstance(schema_value, str):
            raise SourceConnectionServiceError("schema option must be a string")
        schema = schema_value

    if "query" in parsed:
        query_value = parsed.pop("query")
        if not isinstance(query_value, dict):
            raise SourceConnectionServiceError("query option must be a JSON object")
        query.update(query_value)

    if "connect_args" in parsed:
        connect_value = parsed.pop("connect_args")
        if not isinstance(connect_value, dict):
            raise SourceConnectionServiceError("connect_args option must be a JSON object")
        connect_args.update(connect_value)

    for key, value in parsed.items():
        query[key] = value

    normalised_query = {
        str(key): _normalise_query_value(value)
        for key, value in query.items()
        if _normalise_query_value(value) is not None
    }

    return ParsedOptions(
        query=normalised_query,
        connect_args=connect_args,
        schema=schema,
    )


def _build_sqlalchemy_url(settings: ConnectionSettings, query: dict[str, str]) -> URL | str:
    dialect = settings.db_type.strip().lower()

    if dialect in {"postgres", "postgresql", "postgresql+psycopg"}:
        return URL.create(
            "postgresql+psycopg",
            username=settings.username or None,
            password=settings.password or None,
            host=settings.host or None,
            port=settings.port or None,
            database=settings.database or None,
            query=query or None,
        )

    if dialect == "sqlite":
        database = settings.database.strip()
        if not database:
            raise SourceConnectionServiceError("Database path is required for sqlite connections")

        if database.startswith("sqlite:"):
            if query:
                separator = "&" if "?" in database else "?"
                return f"{database}{separator}{urlencode(query)}"
            return database

        return URL.create("sqlite", database=database, query=query or None)

    raise SourceConnectionServiceError(f"Unsupported database type '{settings.db_type}'")


def _create_engine(settings: ConnectionSettings) -> tuple[Any, ParsedOptions]:
    parsed = _parse_options(settings.options)
    url = _build_sqlalchemy_url(settings, parsed.query)
    engine = create_engine(url, pool_pre_ping=True, connect_args=parsed.connect_args)
    return engine, parsed


def _should_skip_table(dialect: str, schema: Optional[str], name: str) -> bool:
    if dialect == "sqlite" and name.startswith("sqlite_"):
        return True
    if schema in {"pg_catalog", "information_schema"}:
        return True
    return False


def test_connection(settings: ConnectionSettings) -> float:
    try:
        engine, _ = _create_engine(settings)
    except SourceConnectionServiceError:
        raise
    except Exception as exc:  # pragma: no cover - defensive logging
        logger.debug(
            "Failed to initialise engine for %s",
            settings.name or settings.database,
            exc_info=exc,
        )
        raise SourceConnectionServiceError(str(exc)) from exc

    try:
        start = time.perf_counter()
        with engine.connect() as connection:
            connection.execute(text("SELECT 1"))
        elapsed_ms = (time.perf_counter() - start) * 1000
    except SQLAlchemyError as exc:
        logger.debug(
            "Connection test failed for %s",
            settings.name or settings.database,
            exc_info=exc,
        )
        raise SourceConnectionServiceError(str(exc)) from exc
    finally:
        engine.dispose()

    return float(elapsed_ms)


def list_tables(settings: ConnectionSettings) -> list[dict[str, Any]]:
    try:
        engine, parsed = _create_engine(settings)
    except SourceConnectionServiceError:
        raise
    except Exception as exc:  # pragma: no cover - defensive logging
        logger.debug("Failed to initialise engine for table discovery", exc_info=exc)
        raise SourceConnectionServiceError(str(exc)) from exc

    inspector = inspect(engine)
    dialect = engine.dialect.name

    try:
        if parsed.schema:
            schemas: Iterable[Optional[str]] = [parsed.schema]
        else:
            try:
                schemas = inspector.get_schema_names()
            except NotImplementedError:
                schemas = [getattr(inspector, "default_schema_name", None)]

        results: list[dict[str, Any]] = []
        for schema in schemas:
            try:
                table_names = inspector.get_table_names(schema=schema)
                view_names = inspector.get_view_names(schema=schema)
            except SQLAlchemyError as exc:
                logger.debug("Failed to inspect schema %s", schema, exc_info=exc)
                raise SourceConnectionServiceError(str(exc)) from exc

            for name in table_names:
                if _should_skip_table(dialect, schema, name):
                    continue
                results.append({"name": name, "schema": schema, "type": "table"})

            for name in view_names:
                if _should_skip_table(dialect, schema, name):
                    continue
                results.append({"name": name, "schema": schema, "type": "view"})

        unique: dict[tuple[Optional[str], str, str], dict[str, Any]] = {}
        for item in results:
            unique[(item.get("schema"), item["name"], item["type"])] = item

        ordered = sorted(
            unique.values(),
            key=lambda item: ((item.get("schema") or ""), item["name"], item["type"]),
        )
        return ordered
    finally:
        engine.dispose()


def list_fields(
    settings: ConnectionSettings, table_name: str, schema: Optional[str]
) -> list[dict[str, Any]]:
    try:
        engine, parsed = _create_engine(settings)
    except SourceConnectionServiceError:
        raise
    except Exception as exc:  # pragma: no cover - defensive logging
        logger.debug("Failed to initialise engine for column discovery", exc_info=exc)
        raise SourceConnectionServiceError(str(exc)) from exc

    inspector = inspect(engine)
    target_schema = schema if schema is not None else parsed.schema

    try:
        columns = inspector.get_columns(table_name, schema=target_schema)
    except SQLAlchemyError as exc:
        logger.debug(
            "Failed to inspect columns for %s.%s",
            target_schema,
            table_name,
            exc_info=exc,
        )
        raise SourceConnectionServiceError(str(exc)) from exc
    finally:
        engine.dispose()

    fields: list[dict[str, Any]] = []
    for column in columns:
        column_type = column.get("type")
        default = column.get("default")
        fields.append(
            {
                "name": column["name"],
                "data_type": str(column_type) if column_type is not None else None,
                "nullable": column.get("nullable"),
                "default": str(default) if default is not None else None,
            }
        )

    fields.sort(key=lambda item: item["name"])
    return fields


def sample_field_values(
    settings: ConnectionSettings,
    table_name: str,
    field_name: str,
    schema: Optional[str],
    limit: int = 100,
) -> list[tuple[str, int]]:
    try:
        engine, parsed = _create_engine(settings)
    except SourceConnectionServiceError:
        raise
    except Exception as exc:  # pragma: no cover - defensive logging
        logger.debug("Failed to initialise engine for sample capture", exc_info=exc)
        raise SourceConnectionServiceError(str(exc)) from exc

    target_schema = schema if schema is not None else parsed.schema

    try:
        metadata = MetaData(schema=target_schema)
        table = Table(table_name, metadata, autoload_with=engine, schema=target_schema)
        if field_name not in table.c:
            raise SourceConnectionServiceError(
                f"Field '{field_name}' not found on {table_name}."
            )
        column = table.c[field_name]
        query = (
            select(column.label("raw_value"), func.count().label("occurrence_count"))
            .select_from(table)
            .where(column.is_not(None))
            .group_by(column)
            .order_by(func.count().desc())
            .limit(limit)
        )
        with engine.connect() as connection:
            rows = connection.execute(query).fetchall()
    except SQLAlchemyError as exc:
        logger.debug(
            "Failed to sample values for %s.%s",
            table_name,
            field_name,
            exc_info=exc,
        )
        raise SourceConnectionServiceError(str(exc)) from exc
    finally:
        engine.dispose()

    return [(str(row.raw_value), int(row.occurrence_count)) for row in rows]


def merge_settings(
    connection: Any, overrides: Optional[dict[str, Any]] = None
) -> ConnectionSettings:
    data = {
        "db_type": connection.db_type,
        "host": connection.host,
        "port": connection.port,
        "database": connection.database,
        "username": connection.username,
        "password": connection.password,
        "options": connection.options,
        "name": getattr(connection, "name", None),
    }

    if overrides:
        for key, value in overrides.items():
            if value is None:
                continue
            if key == "password" and value == "":
                continue
            if key == "options" and value == "":
                continue
            data[key] = value

    return ConnectionSettings(**data)


def settings_from_payload(payload: dict[str, Any]) -> ConnectionSettings:
    data = payload.copy()
    if not data.get("password"):
        data.pop("password", None)
    if data.get("options") in {"", None}:
        data.pop("options", None)
    return ConnectionSettings(**data)
