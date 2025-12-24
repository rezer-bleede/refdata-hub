"""Routes managing source system integrations and harmonization workflows."""

from __future__ import annotations

from datetime import datetime, timezone
from io import BytesIO, StringIO
from pathlib import Path
from typing import Iterable, List, Literal, Sequence

import pandas as pd
from fastapi import (APIRouter, Body, Depends, File, HTTPException, Query, Response,
                     UploadFile, status)
from sqlalchemy.exc import IntegrityError
from sqlmodel import Session, and_, delete, select

from ..database import get_session
from ..matcher import SemanticMatcher
from ..models import (
    CanonicalValue,
    SourceConnection,
    SourceFieldMapping,
    SourceSample,
    SystemConfig,
    ValueMapping,
)
from ..schemas import (
    FieldMatchStats,
    MatchedValuePreview,
    SourceConnectionCreate,
    SourceConnectionRead,
    SourceConnectionTestOverrides,
    SourceConnectionTestPayload,
    SourceConnectionTestResult,
    SourceConnectionUpdate,
    SourceFieldMappingCreate,
    SourceFieldMappingRead,
    SourceFieldMappingUpdate,
    SourceFieldMetadata,
    SourceSampleIngestRequest,
    SourceSampleRead,
    SourceTableMetadata,
    UnmatchedValuePreview,
    UnmatchedValueRecord,
    ValueMappingCreate,
    ValueMappingExpanded,
    ValueMappingImportResult,
    ValueMappingRead,
    ValueMappingUpdate,
)
from ..services.source_connections import (
    SourceConnectionServiceError,
    list_fields as service_list_fields,
    list_tables as service_list_tables,
    merge_settings,
    sample_field_values as service_sample_field_values,
    settings_from_payload,
    test_connection as service_test_connection,
)


router = APIRouter(prefix="/source", tags=["source"])


def _get_config(session: Session) -> SystemConfig:
    config = session.exec(select(SystemConfig)).first()
    if not config:
        raise HTTPException(status_code=500, detail="System configuration missing")
    return config


def _require_connection(session: Session, connection_id: int) -> SourceConnection:
    connection = session.get(SourceConnection, connection_id)
    if not connection:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Connection not found")
    return connection


def _split_table_identifier(identifier: str) -> tuple[str, str | None]:
    if "." in identifier:
        schema, name = identifier.split(".", 1)
        if name:
            return name.strip('"'), schema.strip('"') or None
    return identifier.strip('"'), None


def _load_canonical_values(
    session: Session, dimension: str
) -> Sequence[CanonicalValue]:
    statement = select(CanonicalValue).where(CanonicalValue.dimension == dimension)
    return session.exec(statement).all()


def _canonical_lookup(session: Session, identifiers: set[int]) -> dict[int, CanonicalValue]:
    if not identifiers:
        return {}
    statement = select(CanonicalValue).where(CanonicalValue.id.in_(identifiers))
    return {canonical.id: canonical for canonical in session.exec(statement).all()}


def _value_mapping_export_rows(
    records: Sequence[ValueMapping],
    canonicals: dict[int, CanonicalValue],
    connections: dict[int, SourceConnection],
) -> list[dict[str, object | None]]:
    rows: list[dict[str, object | None]] = []
    for record in records:
        canonical = canonicals.get(record.canonical_id)
        connection = connections.get(record.source_connection_id)
        rows.append(
            {
                "source_connection_id": record.source_connection_id,
                "connection_name": connection.name if connection else "",
                "source_table": record.source_table,
                "source_field": record.source_field,
                "raw_value": record.raw_value,
                "canonical_id": record.canonical_id,
                "canonical_label": canonical.canonical_label if canonical else "",
                "ref_dimension": canonical.dimension if canonical else "",
                "status": record.status,
                "confidence": record.confidence,
                "suggested_label": record.suggested_label,
                "notes": record.notes,
                "created_at": record.created_at.isoformat(),
                "updated_at": record.updated_at.isoformat(),
            }
        )

    rows.sort(
        key=lambda item: (
            item.get("source_connection_id"),
            item.get("source_table"),
            item.get("source_field"),
            item.get("raw_value"),
        )
    )
    return rows


def _build_connection_test_result(latency_ms: float) -> SourceConnectionTestResult:
    rounded = round(latency_ms, 2)
    if rounded >= 1:
        message = f"Connection succeeded ({rounded:.0f} ms)."
    elif rounded > 0:
        message = f"Connection succeeded ({rounded:.2f} ms)."
    else:
        message = "Connection succeeded."
    return SourceConnectionTestResult(success=True, message=message, latency_ms=rounded)


@router.get("/connections", response_model=List[SourceConnectionRead])
def list_connections(session: Session = Depends(get_session)) -> List[SourceConnection]:
    statement = select(SourceConnection).order_by(SourceConnection.name)
    return session.exec(statement).all()


@router.get("/connections/{connection_id}", response_model=SourceConnectionRead)
def get_connection(
    connection_id: int, session: Session = Depends(get_session)
) -> SourceConnection:
    """Return a single source connection."""

    return _require_connection(session, connection_id)


@router.post(
    "/connections",
    response_model=SourceConnectionRead,
    status_code=status.HTTP_201_CREATED,
)
def create_connection(
    payload: SourceConnectionCreate, session: Session = Depends(get_session)
) -> SourceConnection:
    connection = SourceConnection(**payload.model_dump())
    try:
        session.add(connection)
        session.commit()
    except IntegrityError as exc:  # pragma: no cover - exercised via tests
        session.rollback()
        raise HTTPException(status_code=400, detail="Connection name must be unique") from exc

    session.refresh(connection)
    return connection


@router.put("/connections/{connection_id}", response_model=SourceConnectionRead)
def update_connection(
    connection_id: int,
    payload: SourceConnectionUpdate,
    session: Session = Depends(get_session),
) -> SourceConnection:
    connection = _require_connection(session, connection_id)
    data = payload.model_dump(exclude_unset=True)
    if not data:
        return connection

    password = data.pop("password", None)
    for key, value in data.items():
        setattr(connection, key, value)

    if password is not None:
        connection.password = password

    connection.touch()
    try:
        session.add(connection)
        session.commit()
    except IntegrityError as exc:
        session.rollback()
        raise HTTPException(status_code=400, detail="Connection name must be unique") from exc

    session.refresh(connection)
    return connection


@router.delete("/connections/{connection_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_connection(
    connection_id: int, session: Session = Depends(get_session)
) -> Response:
    connection = _require_connection(session, connection_id)

    # Cascade deletes manually because SQLite lacks ON DELETE CASCADE by default.
    session.exec(
        delete(SourceFieldMapping).where(
            SourceFieldMapping.source_connection_id == connection_id
        )
    )
    session.exec(
        delete(SourceSample).where(SourceSample.source_connection_id == connection_id)
    )
    session.exec(
        delete(ValueMapping).where(ValueMapping.source_connection_id == connection_id)
    )

    session.delete(connection)
    session.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/connections/test", response_model=SourceConnectionTestResult)
def test_connection_endpoint(
    payload: SourceConnectionTestPayload,
) -> SourceConnectionTestResult:
    try:
        settings = settings_from_payload(payload.model_dump(exclude_none=True))
        latency_ms = service_test_connection(settings)
    except SourceConnectionServiceError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    return _build_connection_test_result(latency_ms)


@router.post(
    "/connections/{connection_id}/test",
    response_model=SourceConnectionTestResult,
)
def test_existing_connection(
    connection_id: int,
    overrides: SourceConnectionTestOverrides | None = Body(default=None),
    session: Session = Depends(get_session),
) -> SourceConnectionTestResult:
    connection = _require_connection(session, connection_id)
    override_data = (
        overrides.model_dump(exclude_unset=True, exclude_none=True)
        if overrides
        else None
    )

    try:
        settings = merge_settings(connection, override_data)
        latency_ms = service_test_connection(settings)
    except SourceConnectionServiceError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    return _build_connection_test_result(latency_ms)


@router.get(
    "/connections/{connection_id}/tables",
    response_model=List[SourceTableMetadata],
)
def list_source_tables(
    connection_id: int, session: Session = Depends(get_session)
) -> List[SourceTableMetadata]:
    connection = _require_connection(session, connection_id)

    try:
        settings = merge_settings(connection)
        records = service_list_tables(settings)
    except SourceConnectionServiceError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    return [SourceTableMetadata(**record) for record in records]


@router.get(
    "/connections/{connection_id}/tables/{table_name}/fields",
    response_model=List[SourceFieldMetadata],
)
def list_source_fields(
    connection_id: int,
    table_name: str,
    schema: str | None = Query(default=None),
    session: Session = Depends(get_session),
) -> List[SourceFieldMetadata]:
    connection = _require_connection(session, connection_id)

    effective_schema = schema
    effective_table = table_name
    if effective_schema is None and "." in table_name:
        potential_schema, potential_table = table_name.split(".", 1)
        if potential_table:
            effective_schema = potential_schema or None
            effective_table = potential_table

    if effective_schema:
        effective_schema = effective_schema.strip('"')
    effective_table = effective_table.strip('"')

    try:
        settings = merge_settings(connection)
        records = service_list_fields(settings, effective_table, effective_schema)
    except SourceConnectionServiceError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    return [SourceFieldMetadata(**record) for record in records]


@router.get(
    "/connections/{connection_id}/mappings",
    response_model=List[SourceFieldMappingRead],
)
def list_field_mappings(
    connection_id: int,
    session: Session = Depends(get_session),
) -> List[SourceFieldMapping]:
    _require_connection(session, connection_id)
    statement = (
        select(SourceFieldMapping)
        .where(SourceFieldMapping.source_connection_id == connection_id)
        .order_by(SourceFieldMapping.source_table, SourceFieldMapping.source_field)
    )
    return session.exec(statement).all()


@router.post(
    "/connections/{connection_id}/mappings",
    response_model=SourceFieldMappingRead,
    status_code=status.HTTP_201_CREATED,
)
def create_field_mapping(
    connection_id: int,
    payload: SourceFieldMappingCreate,
    session: Session = Depends(get_session),
) -> SourceFieldMapping:
    _require_connection(session, connection_id)
    mapping = SourceFieldMapping(
        source_connection_id=connection_id, **payload.model_dump()
    )
    session.add(mapping)
    session.commit()
    session.refresh(mapping)
    return mapping


@router.put(
    "/connections/{connection_id}/mappings/{mapping_id}",
    response_model=SourceFieldMappingRead,
)
def update_field_mapping(
    connection_id: int,
    mapping_id: int,
    payload: SourceFieldMappingUpdate,
    session: Session = Depends(get_session),
) -> SourceFieldMapping:
    _require_connection(session, connection_id)
    mapping = session.get(SourceFieldMapping, mapping_id)
    if not mapping or mapping.source_connection_id != connection_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Mapping not found")

    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(mapping, key, value)

    mapping.touch()
    session.add(mapping)
    session.commit()
    session.refresh(mapping)
    return mapping


@router.delete(
    "/connections/{connection_id}/mappings/{mapping_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_field_mapping(
    connection_id: int, mapping_id: int, session: Session = Depends(get_session)
) -> Response:
    _require_connection(session, connection_id)
    mapping = session.get(SourceFieldMapping, mapping_id)
    if not mapping or mapping.source_connection_id != connection_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Mapping not found")

    session.delete(mapping)
    session.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post(
    "/connections/{connection_id}/mappings/{mapping_id}/capture",
    response_model=List[SourceSampleRead],
    status_code=status.HTTP_201_CREATED,
)
def capture_mapping_samples(
    connection_id: int,
    mapping_id: int,
    session: Session = Depends(get_session),
) -> List[SourceSample]:
    connection = _require_connection(session, connection_id)
    mapping = session.get(SourceFieldMapping, mapping_id)
    if not mapping or mapping.source_connection_id != connection.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Mapping not found")

    settings = merge_settings(connection)
    table_name, schema = _split_table_identifier(mapping.source_table)
    try:
        sampled_values = service_sample_field_values(
            settings,
            table_name,
            mapping.source_field,
            schema=schema,
            limit=100,
        )
    except SourceConnectionServiceError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    now = datetime.now(timezone.utc)
    updated: list[SourceSample] = []
    for raw_value, occurrence_count in sampled_values:
        statement = select(SourceSample).where(
            and_(
                SourceSample.source_connection_id == connection.id,
                SourceSample.source_table == mapping.source_table,
                SourceSample.source_field == mapping.source_field,
                SourceSample.raw_value == raw_value,
            )
        )
        sample = session.exec(statement).first()
        if sample:
            sample.occurrence_count = occurrence_count
            sample.dimension = mapping.ref_dimension
            sample.last_seen_at = now
        else:
            sample = SourceSample(
                source_connection_id=connection.id,
                source_table=mapping.source_table,
                source_field=mapping.source_field,
                dimension=mapping.ref_dimension,
                raw_value=raw_value,
                occurrence_count=occurrence_count,
                last_seen_at=now,
            )
        session.add(sample)
        updated.append(sample)

    session.commit()
    for sample in updated:
        session.refresh(sample)
    return updated


@router.get(
    "/connections/{connection_id}/samples",
    response_model=List[SourceSampleRead],
)
def list_samples(
    connection_id: int,
    source_table: str | None = Query(default=None),
    source_field: str | None = Query(default=None),
    session: Session = Depends(get_session),
) -> List[SourceSampleRead]:
    _require_connection(session, connection_id)
    statement = select(SourceSample).where(
        SourceSample.source_connection_id == connection_id
    )
    if source_table:
        statement = statement.where(SourceSample.source_table == source_table)
    if source_field:
        statement = statement.where(SourceSample.source_field == source_field)

    statement = statement.order_by(
        SourceSample.source_table, SourceSample.source_field, SourceSample.raw_value
    )

    samples = session.exec(statement).all()

    aggregated: dict[tuple[str, str, str], SourceSampleRead] = {}
    for sample in samples:
        key = (sample.source_table, sample.source_field, sample.raw_value)
        existing = aggregated.get(key)
        if existing is None:
            aggregated[key] = SourceSampleRead.model_validate(sample)
            continue

        existing.occurrence_count += sample.occurrence_count
        if sample.dimension and not existing.dimension:
            existing.dimension = sample.dimension
        if sample.last_seen_at > existing.last_seen_at:
            existing.last_seen_at = sample.last_seen_at

    return sorted(
        aggregated.values(),
        key=lambda item: (-item.occurrence_count, item.raw_value.lower()),
    )


@router.post(
    "/connections/{connection_id}/samples",
    response_model=List[SourceSampleRead],
    status_code=status.HTTP_201_CREATED,
)
def ingest_samples(
    connection_id: int,
    payload: SourceSampleIngestRequest,
    session: Session = Depends(get_session),
) -> List[SourceSample]:
    _require_connection(session, connection_id)
    now = datetime.now(timezone.utc)
    updated: list[SourceSample] = []

    for value in payload.values:
        statement = select(SourceSample).where(
            and_(
                SourceSample.source_connection_id == connection_id,
                SourceSample.source_table == payload.source_table,
                SourceSample.source_field == payload.source_field,
                SourceSample.raw_value == value.raw_value,
            )
        )
        sample = session.exec(statement).first()
        if sample:
            sample.occurrence_count += value.occurrence_count
            sample.dimension = value.dimension or sample.dimension
            sample.last_seen_at = now
        else:
            sample = SourceSample(
                source_connection_id=connection_id,
                source_table=payload.source_table,
                source_field=payload.source_field,
                dimension=value.dimension,
                raw_value=value.raw_value,
                occurrence_count=value.occurrence_count,
                last_seen_at=now,
            )
            session.add(sample)
        updated.append(sample)

    session.commit()
    for sample in updated:
        session.refresh(sample)
    return updated


def _record_matched_preview(
    accumulator: dict[str, MatchedValuePreview],
    sample: SourceSample,
    *,
    canonical_label: str,
    match_type: Literal["mapping", "semantic"],
    confidence: float | None,
) -> None:
    existing = accumulator.get(sample.raw_value)
    if existing:
        existing.occurrence_count += sample.occurrence_count
        if confidence is not None:
            existing.confidence = max(existing.confidence or 0.0, confidence)
        if existing.match_type == "semantic" and match_type == "mapping":
            existing.match_type = match_type
            existing.canonical_label = canonical_label
        return

    accumulator[sample.raw_value] = MatchedValuePreview(
        raw_value=sample.raw_value,
        occurrence_count=sample.occurrence_count,
        canonical_label=canonical_label,
        match_type=match_type,
        confidence=confidence,
    )


def _suggestions_for_samples(
    samples: Iterable[SourceSample],
    matcher: SemanticMatcher,
    threshold: float,
    mapped_values: dict[str, ValueMapping],
    canonical_lookup: dict[int, CanonicalValue],
) -> tuple[int, List[UnmatchedValuePreview], List[MatchedValuePreview]]:
    matched_count = 0
    unmatched: list[UnmatchedValuePreview] = []
    matched: dict[str, MatchedValuePreview] = {}
    for sample in samples:
        mapping = mapped_values.get(sample.raw_value)
        if mapping:
            canonical_label = (
                canonical_lookup.get(mapping.canonical_id).canonical_label
                if mapping.canonical_id in canonical_lookup
                else "Mapped canonical value"
            )
            matched_count += sample.occurrence_count
            _record_matched_preview(
                matched,
                sample,
                canonical_label=canonical_label,
                match_type="mapping",
                confidence=mapping.confidence,
            )
            continue

        ranked = matcher.rank(sample.raw_value)
        if ranked and ranked[0].score >= threshold:
            best = ranked[0]
            matched_count += sample.occurrence_count
            _record_matched_preview(
                matched,
                sample,
                canonical_label=best.canonical_label,
                match_type="semantic",
                confidence=best.score,
            )
            continue

        candidate_threshold = max(threshold * 0.75, 0.2)
        suggestions = [
            match for match in ranked if match.score >= candidate_threshold
        ][:3]
        unmatched.append(
            UnmatchedValuePreview(
                raw_value=sample.raw_value,
                occurrence_count=sample.occurrence_count,
                suggestions=suggestions,
            )
        )

    matched_values = sorted(
        matched.values(), key=lambda item: item.occurrence_count, reverse=True
    )
    return matched_count, unmatched, matched_values


@router.get(
    "/connections/{connection_id}/match-stats",
    response_model=List[FieldMatchStats],
)
def compute_match_statistics(
    connection_id: int, session: Session = Depends(get_session)
) -> List[FieldMatchStats]:
    connection = _require_connection(session, connection_id)
    config = _get_config(session)

    mappings = session.exec(
        select(SourceFieldMapping)
        .where(SourceFieldMapping.source_connection_id == connection.id)
        .order_by(SourceFieldMapping.source_table, SourceFieldMapping.source_field)
    ).all()

    results: list[FieldMatchStats] = []

    for mapping in mappings:
        canonical_values = _load_canonical_values(session, mapping.ref_dimension)
        matcher = SemanticMatcher(config=config, canonical_values=canonical_values)

        samples = session.exec(
            select(SourceSample).where(
                and_(
                    SourceSample.source_connection_id == connection.id,
                    SourceSample.source_table == mapping.source_table,
                    SourceSample.source_field == mapping.source_field,
                )
            )
        ).all()

        total = sum(sample.occurrence_count for sample in samples)
        value_mappings = session.exec(
            select(ValueMapping).where(
                and_(
                    ValueMapping.source_connection_id == connection.id,
                    ValueMapping.source_table == mapping.source_table,
                    ValueMapping.source_field == mapping.source_field,
                )
            )
        ).all()
        mapped_values = {vm.raw_value: vm for vm in value_mappings}
        canonical_lookup = _canonical_lookup(
            session, {vm.canonical_id for vm in value_mappings if vm.canonical_id}
        )

        matched_count, unmatched, matched_values = _suggestions_for_samples(
            samples, matcher, config.match_threshold, mapped_values, canonical_lookup
        )
        unmatched.sort(key=lambda item: item.occurrence_count, reverse=True)

        results.append(
            FieldMatchStats(
                mapping_id=mapping.id or 0,
                source_table=mapping.source_table,
                source_field=mapping.source_field,
                ref_dimension=mapping.ref_dimension,
                total_values=total,
                matched_values=matched_count,
                unmatched_values=max(total - matched_count, 0),
                match_rate=float(matched_count / total) if total else 0.0,
                top_unmatched=unmatched[:10],
                top_matched=matched_values[:10],
            )
        )

    return results


@router.get(
    "/connections/{connection_id}/unmatched",
    response_model=List[UnmatchedValueRecord],
)
def list_unmatched_values(
    connection_id: int,
    session: Session = Depends(get_session),
) -> List[UnmatchedValueRecord]:
    connection = _require_connection(session, connection_id)
    config = _get_config(session)

    mappings = session.exec(
        select(SourceFieldMapping)
        .where(SourceFieldMapping.source_connection_id == connection.id)
    ).all()

    records: list[UnmatchedValueRecord] = []
    value_mapping_index: dict[tuple[str, str], dict[str, ValueMapping]] = {}
    for vm in session.exec(
        select(ValueMapping).where(ValueMapping.source_connection_id == connection.id)
    ).all():
        key = (vm.source_table, vm.source_field)
        value_mapping_index.setdefault(key, {})[vm.raw_value] = vm

    for mapping in mappings:
        canonical_values = _load_canonical_values(session, mapping.ref_dimension)
        matcher = SemanticMatcher(config=config, canonical_values=canonical_values)
        samples = session.exec(
            select(SourceSample).where(
                and_(
                    SourceSample.source_connection_id == connection.id,
                    SourceSample.source_table == mapping.source_table,
                    SourceSample.source_field == mapping.source_field,
                )
            )
        ).all()

        mapped_values = value_mapping_index.get(
            (mapping.source_table, mapping.source_field), {}
        )
        canonical_lookup = _canonical_lookup(
            session, {vm.canonical_id for vm in mapped_values.values() if vm.canonical_id}
        )

        _, unmatched, _ = _suggestions_for_samples(
            samples,
            matcher,
            config.match_threshold,
            mapped_values,
            canonical_lookup,
        )

        for item in unmatched:
            records.append(
                UnmatchedValueRecord(
                    mapping_id=mapping.id or 0,
                    source_table=mapping.source_table,
                    source_field=mapping.source_field,
                    ref_dimension=mapping.ref_dimension,
                    raw_value=item.raw_value,
                    occurrence_count=item.occurrence_count,
                    suggestions=item.suggestions,
                )
            )

    records.sort(key=lambda item: item.occurrence_count, reverse=True)
    return records


@router.post(
    "/connections/{connection_id}/value-mappings",
    response_model=ValueMappingRead,
    status_code=status.HTTP_201_CREATED,
)
def create_value_mapping(
    connection_id: int,
    payload: ValueMappingCreate,
    session: Session = Depends(get_session),
) -> ValueMapping:
    _require_connection(session, connection_id)
    canonical = session.get(CanonicalValue, payload.canonical_id)
    if not canonical:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Canonical value not found")

    mapping = ValueMapping(
        source_connection_id=connection_id,
        **payload.model_dump(),
    )
    mapping.touch()
    session.add(mapping)
    session.commit()
    session.refresh(mapping)
    return mapping


@router.get(
    "/connections/{connection_id}/value-mappings",
    response_model=List[ValueMappingExpanded],
)
def list_value_mappings(
    connection_id: int,
    session: Session = Depends(get_session),
) -> List[ValueMappingExpanded]:
    _require_connection(session, connection_id)
    statement = select(ValueMapping).where(
        ValueMapping.source_connection_id == connection_id
    )
    records = session.exec(statement).all()

    expanded: list[ValueMappingExpanded] = []
    canonical_by_id = _canonical_lookup(
        session, {record.canonical_id for record in records}
    )

    for record in records:
        canonical = canonical_by_id.get(record.canonical_id)
        expanded.append(
            ValueMappingExpanded(
                id=record.id or 0,
                source_connection_id=record.source_connection_id,
                source_table=record.source_table,
                source_field=record.source_field,
                raw_value=record.raw_value,
                canonical_id=record.canonical_id,
                status=record.status,
                confidence=record.confidence,
                suggested_label=record.suggested_label,
                notes=record.notes,
                created_at=record.created_at,
                updated_at=record.updated_at,
                canonical_label=canonical.canonical_label if canonical else "Unknown",
                ref_dimension=canonical.dimension if canonical else "",
            )
        )

    expanded.sort(key=lambda item: (item.source_table, item.source_field, item.raw_value))
    return expanded


@router.put(
    "/connections/{connection_id}/value-mappings/{mapping_id}",
    response_model=ValueMappingRead,
)
def update_value_mapping(
    connection_id: int,
    mapping_id: int,
    payload: ValueMappingUpdate,
    session: Session = Depends(get_session),
) -> ValueMapping:
    _require_connection(session, connection_id)
    mapping = session.get(ValueMapping, mapping_id)
    if not mapping or mapping.source_connection_id != connection_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Value mapping not found")

    data = payload.model_dump(exclude_unset=True)
    canonical_id = data.get("canonical_id")
    if canonical_id is not None and not session.get(CanonicalValue, canonical_id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Canonical value not found")

    for key, value in data.items():
        setattr(mapping, key, value)

    mapping.touch()
    session.add(mapping)
    session.commit()
    session.refresh(mapping)
    return mapping


@router.delete(
    "/connections/{connection_id}/value-mappings/{mapping_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_value_mapping(
    connection_id: int, mapping_id: int, session: Session = Depends(get_session)
) -> Response:
    _require_connection(session, connection_id)
    mapping = session.get(ValueMapping, mapping_id)
    if not mapping or mapping.source_connection_id != connection_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Value mapping not found")

    session.delete(mapping)
    session.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/value-mappings", response_model=List[ValueMappingExpanded])
def list_all_value_mappings(session: Session = Depends(get_session)) -> List[ValueMappingExpanded]:
    statement = select(ValueMapping)
    records = session.exec(statement).all()
    canonical_by_id = _canonical_lookup(
        session, {record.canonical_id for record in records}
    )

    expanded: list[ValueMappingExpanded] = []
    for record in records:
        canonical = canonical_by_id.get(record.canonical_id)
        expanded.append(
            ValueMappingExpanded(
                id=record.id or 0,
                source_connection_id=record.source_connection_id,
                source_table=record.source_table,
                source_field=record.source_field,
                raw_value=record.raw_value,
                canonical_id=record.canonical_id,
                status=record.status,
                confidence=record.confidence,
                suggested_label=record.suggested_label,
                notes=record.notes,
                created_at=record.created_at,
                updated_at=record.updated_at,
                canonical_label=canonical.canonical_label if canonical else "Unknown",
                ref_dimension=canonical.dimension if canonical else "",
            )
        )

    expanded.sort(key=lambda item: (item.source_connection_id, item.source_table, item.source_field, item.raw_value))
    return expanded


@router.get("/value-mappings/export")
def export_value_mappings(
    format: Literal["csv", "xlsx"] = Query("csv", description="Export file format"),
    connection_id: int | None = Query(None, description="Optional source connection filter"),
    session: Session = Depends(get_session),
) -> Response:
    statement = select(ValueMapping)
    if connection_id is not None:
        _require_connection(session, connection_id)
        statement = statement.where(ValueMapping.source_connection_id == connection_id)

    records = session.exec(statement).all()
    canonical_by_id = _canonical_lookup(session, {record.canonical_id for record in records})
    connections = {
        connection.id: connection
        for connection in session.exec(select(SourceConnection)).all()
        if connection.id is not None
    }
    rows = _value_mapping_export_rows(records, canonical_by_id, connections)

    if format == "xlsx":
        buffer = BytesIO()
        pd.DataFrame(rows).to_excel(buffer, index=False)
        buffer.seek(0)
        return Response(
            content=buffer.getvalue(),
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": "attachment; filename=value-mappings.xlsx"},
        )

    buffer = StringIO()
    pd.DataFrame(rows).to_csv(buffer, index=False)
    return Response(
        content=buffer.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=value-mappings.csv"},
    )


@router.post("/value-mappings/import", response_model=ValueMappingImportResult)
async def import_value_mappings(
    connection_id: int | None = Query(None, description="Default connection to apply to imported rows"),
    file: UploadFile = File(...),
    session: Session = Depends(get_session),
) -> ValueMappingImportResult:
    raw_content = await file.read()
    if not raw_content:
        raise HTTPException(status_code=400, detail="Upload a non-empty CSV or Excel file.")

    suffix = Path(file.filename or "").suffix.lower()
    buffer = BytesIO(raw_content)
    try:
        if suffix in {".xlsx", ".xls"}:
            dataframe = pd.read_excel(buffer)
        else:
            dataframe = pd.read_csv(buffer)
    except Exception as exc:  # pragma: no cover - exercised in tests
        raise HTTPException(status_code=400, detail="Unable to parse uploaded file.") from exc

    dataframe.columns = [str(column).strip() for column in dataframe.columns]
    required_columns = ["source_table", "source_field", "raw_value", "canonical_id"]
    if connection_id is None:
        required_columns.append("source_connection_id")

    missing = [column for column in required_columns if column not in dataframe.columns]
    if missing:
        raise HTTPException(
            status_code=400, detail=f"Missing required columns: {', '.join(sorted(missing))}"
        )

    if dataframe.empty:
        return ValueMappingImportResult(created=0, updated=0, errors=["Uploaded file contains no rows."])

    connections = {
        connection.id: connection
        for connection in session.exec(select(SourceConnection)).all()
        if connection.id is not None
    }
    canonicals: dict[int, CanonicalValue] = {
        canonical.id: canonical
        for canonical in session.exec(select(CanonicalValue)).all()
        if canonical.id is not None
    }

    created = 0
    updated = 0
    errors: list[str] = []

    for index, row in dataframe.iterrows():
        row_number = index + 2  # account for header row in spreadsheets

        resolved_connection_id = connection_id or row.get("source_connection_id")
        if pd.isna(resolved_connection_id):
            errors.append(f"Row {row_number}: source_connection_id is required when no default is provided.")
            continue
        resolved_connection_id = int(resolved_connection_id)
        if resolved_connection_id not in connections:
            errors.append(f"Row {row_number}: connection {resolved_connection_id} does not exist.")
            continue

        try:
            canonical_identifier = int(row.get("canonical_id"))
        except (TypeError, ValueError):
            errors.append(f"Row {row_number}: canonical_id must be a valid integer.")
            continue

        canonical = canonicals.get(canonical_identifier)
        if not canonical:
            errors.append(f"Row {row_number}: canonical value {canonical_identifier} was not found.")
            continue

        raw_value = row.get("raw_value")
        source_table = row.get("source_table")
        source_field = row.get("source_field")
        if any(pd.isna(value) for value in (raw_value, source_table, source_field)):
            errors.append(
                f"Row {row_number}: source_table, source_field, and raw_value must all be provided."
            )
            continue

        status = (row.get("status") or "approved").strip()
        if status not in {"approved", "pending", "rejected"}:
            errors.append(f"Row {row_number}: status '{status}' is not supported.")
            continue

        confidence_value = row.get("confidence")
        confidence = None
        if pd.notna(confidence_value):
            try:
                confidence = float(confidence_value)
            except (TypeError, ValueError):
                errors.append(f"Row {row_number}: confidence must be numeric.")
                continue
            if confidence < 0 or confidence > 1:
                errors.append(f"Row {row_number}: confidence must be between 0 and 1.")
                continue

        payload = {
            "source_connection_id": resolved_connection_id,
            "source_table": str(source_table),
            "source_field": str(source_field),
            "raw_value": str(raw_value),
            "canonical_id": canonical_identifier,
            "status": status,
            "confidence": confidence,
            "suggested_label": row.get("suggested_label") if not pd.isna(row.get("suggested_label")) else None,
            "notes": row.get("notes") if not pd.isna(row.get("notes")) else None,
        }

        existing = session.exec(
            select(ValueMapping).where(
                and_(
                    ValueMapping.source_connection_id == resolved_connection_id,
                    ValueMapping.source_table == payload["source_table"],
                    ValueMapping.source_field == payload["source_field"],
                    ValueMapping.raw_value == payload["raw_value"],
                )
            )
        ).first()

        if existing:
            for key, value in payload.items():
                setattr(existing, key, value)
            existing.touch()
            session.add(existing)
            updated += 1
            continue

        mapping = ValueMapping(**payload)
        mapping.touch()
        session.add(mapping)
        created += 1

    session.commit()

    return ValueMappingImportResult(created=created, updated=updated, errors=errors)
