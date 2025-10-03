"""Routes managing source system integrations and harmonization workflows."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Iterable, List, Sequence

from fastapi import APIRouter, Body, Depends, HTTPException, Query, Response, status
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
    SourceConnectionCreate,
    SourceConnectionRead,
    SourceConnectionUpdate,
    SourceConnectionTestOverrides,
    SourceConnectionTestPayload,
    SourceConnectionTestResult,
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
    ValueMappingRead,
    ValueMappingUpdate,
)
from ..services.source_connections import (
    SourceConnectionServiceError,
    list_fields as service_list_fields,
    list_tables as service_list_tables,
    merge_settings,
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


@router.get(
    "/connections/{connection_id}/samples",
    response_model=List[SourceSampleRead],
)
def list_samples(
    connection_id: int,
    source_table: str | None = Query(default=None),
    source_field: str | None = Query(default=None),
    session: Session = Depends(get_session),
) -> List[SourceSample]:
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
    return session.exec(statement).all()


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


def _suggestions_for_samples(
    samples: Iterable[SourceSample],
    matcher: SemanticMatcher,
    threshold: float,
    mapped_values: set[str],
) -> tuple[int, List[UnmatchedValuePreview]]:
    matched_count = 0
    unmatched: list[UnmatchedValuePreview] = []
    for sample in samples:
        if sample.raw_value in mapped_values:
            matched_count += sample.occurrence_count
            continue

        ranked = matcher.rank(sample.raw_value)
        if ranked and ranked[0].score >= threshold:
            matched_count += sample.occurrence_count
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

    return matched_count, unmatched


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
        mapped_values = {
            vm.raw_value
            for vm in session.exec(
                select(ValueMapping).where(
                    and_(
                        ValueMapping.source_connection_id == connection.id,
                        ValueMapping.source_table == mapping.source_table,
                        ValueMapping.source_field == mapping.source_field,
                    )
                )
            ).all()
        }

        matched_count, unmatched = _suggestions_for_samples(
            samples, matcher, config.match_threshold, mapped_values
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
    value_mapping_index: dict[tuple[str, str], set[str]] = {}
    for vm in session.exec(
        select(ValueMapping).where(ValueMapping.source_connection_id == connection.id)
    ).all():
        key = (vm.source_table, vm.source_field)
        value_mapping_index.setdefault(key, set()).add(vm.raw_value)

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

        _, unmatched = _suggestions_for_samples(
            samples,
            matcher,
            config.match_threshold,
            value_mapping_index.get((mapping.source_table, mapping.source_field), set()),
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
