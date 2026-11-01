"""Generic master data management APIs."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Callable, Optional, TypeVar

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy.exc import IntegrityError
from sqlmodel import Session, select

from ..database import get_session
from ..models import (
    MasterEntity,
    MasterRecord,
    MergeHistory,
    RecordLink,
    SourceConnection,
    SourceRecord,
    SystemConfig,
)
from ..schemas import (
    EntityQualityReport,
    MasterEntityCreate,
    MasterEntityRead,
    MasterEntityUpdate,
    MasterRecordCreate,
    MasterRecordLinkCreate,
    MasterRecordLinkRead,
    MasterRecordMerge,
    MasterRecordQuality,
    MasterRecordRead,
    MasterRecordUpdate,
    MDMCandidate,
    MDMSuggestionResponse,
    SourceRecordApprove,
    SourceRecordIngest,
    SourceRecordIngestResult,
    SourceRecordRead,
)
from ..services.mdm import (
    MDMConflict,
    MDMError,
    add_record_link,
    merge_records,
    quality_score,
    rank_master_records,
    record_match_text,
    unmerge_record,
    validate_attributes,
    validate_entity_config,
)

router = APIRouter(prefix="/mdm", tags=["master data management"])
T = TypeVar("T")


def _entity(session: Session, code: str) -> MasterEntity:
    entity = session.exec(select(MasterEntity).where(MasterEntity.code == code)).first()
    if not entity:
        raise HTTPException(status_code=404, detail="Master entity type not found")
    return entity


def _record(session: Session, record_id: int) -> MasterRecord:
    record = session.get(MasterRecord, record_id)
    if not record:
        raise HTTPException(status_code=404, detail="Master record not found")
    return record


def _translate_mdm_error(callable_: Callable[..., T], *args: Any) -> T:
    try:
        return callable_(*args)
    except MDMConflict as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    except MDMError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.get("/entities", response_model=list[MasterEntityRead])
def list_entities(session: Session = Depends(get_session)) -> list[MasterEntity]:
    return list(session.exec(select(MasterEntity).order_by(MasterEntity.label)).all())


@router.post("/entities", response_model=MasterEntityRead, status_code=status.HTTP_201_CREATED)
def create_entity(payload: MasterEntityCreate, session: Session = Depends(get_session)) -> MasterEntity:
    data = payload.model_dump()
    _translate_mdm_error(validate_entity_config, data)
    entity = MasterEntity(**data)
    session.add(entity)
    try:
        session.commit()
    except IntegrityError as exc:
        session.rollback()
        raise HTTPException(status_code=409, detail="Entity code already exists") from exc
    session.refresh(entity)
    return entity


@router.get("/entities/{code}", response_model=MasterEntityRead)
def get_entity(code: str, session: Session = Depends(get_session)) -> MasterEntity:
    return _entity(session, code)


@router.put("/entities/{code}", response_model=MasterEntityRead)
def update_entity(
    code: str, payload: MasterEntityUpdate, session: Session = Depends(get_session)
) -> MasterEntity:
    entity = _entity(session, code)
    data = payload.model_dump(exclude_unset=True)
    config = {
        "attribute_schema": data.get("attribute_schema", entity.attribute_schema),
        "match_fields": data.get("match_fields", entity.match_fields),
        "survivorship_rules": data.get("survivorship_rules", entity.survivorship_rules),
        "quality_rules": data.get("quality_rules", entity.quality_rules),
    }
    _translate_mdm_error(validate_entity_config, config)
    for key, value in data.items():
        setattr(entity, key, value)
    entity.updated_at = datetime.now(timezone.utc)
    session.add(entity)
    session.commit()
    session.refresh(entity)
    return entity


@router.delete("/entities/{code}", status_code=status.HTTP_204_NO_CONTENT)
def delete_entity(code: str, session: Session = Depends(get_session)) -> Response:
    entity = _entity(session, code)
    if session.exec(select(MasterRecord.id).where(MasterRecord.entity_code == code)).first() or session.exec(
        select(SourceRecord.id).where(SourceRecord.entity_code == code)
    ).first():
        raise HTTPException(status_code=409, detail="Cannot delete an entity type with records")
    session.delete(entity)
    session.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/records", response_model=list[MasterRecordRead])
def list_records(
    entity_code: Optional[str] = None,
    include_merged: bool = False,
    session: Session = Depends(get_session),
) -> list[MasterRecord]:
    query = select(MasterRecord)
    if entity_code:
        query = query.where(MasterRecord.entity_code == entity_code)
    if not include_merged:
        query = query.where(MasterRecord.status == "active")
    return list(session.exec(query.order_by(MasterRecord.id.desc())).all())


@router.post("/records", response_model=MasterRecordRead, status_code=status.HTTP_201_CREATED)
def create_record(payload: MasterRecordCreate, session: Session = Depends(get_session)) -> MasterRecord:
    entity = _entity(session, payload.entity_code)
    _translate_mdm_error(validate_attributes, entity, payload.attributes)
    record = MasterRecord(entity_code=entity.code, attributes=payload.attributes)
    session.add(record)
    session.commit()
    session.refresh(record)
    return record


@router.put("/records/{record_id}", response_model=MasterRecordRead)
def update_record(
    record_id: int, payload: MasterRecordUpdate, session: Session = Depends(get_session)
) -> MasterRecord:
    record = _record(session, record_id)
    if record.status != "active":
        raise HTTPException(status_code=409, detail="Merged records cannot be edited")
    entity = _entity(session, record.entity_code)
    _translate_mdm_error(validate_attributes, entity, payload.attributes)
    record.attributes = payload.attributes
    record.version += 1
    record.updated_at = datetime.now(timezone.utc)
    session.add(record)
    session.commit()
    session.refresh(record)
    return record


@router.post("/source-records", response_model=SourceRecordIngestResult, status_code=status.HTTP_200_OK)
def ingest_source_records(
    payload: SourceRecordIngest, session: Session = Depends(get_session)
) -> SourceRecordIngestResult:
    _entity(session, payload.entity_code)
    if not session.get(SourceConnection, payload.source_connection_id):
        raise HTTPException(status_code=404, detail="Source connection not found")
    created = updated = 0
    rows: list[SourceRecord] = []
    try:
        for item in payload.records:
            row = session.exec(
                select(SourceRecord).where(
                    SourceRecord.source_connection_id == payload.source_connection_id,
                    SourceRecord.source_table == payload.source_table,
                    SourceRecord.source_pk == item.source_pk,
                )
            ).first()
            if row:
                if row.entity_code != payload.entity_code:
                    raise HTTPException(
                        status_code=409,
                        detail=f"Source record {item.source_pk} already belongs to entity '{row.entity_code}'",
                    )
                row.payload = item.payload
                row.source_priority = item.source_priority
                row.source_updated_at = item.source_updated_at
                row.proposed_master_record_id = None
                row.updated_at = datetime.now(timezone.utc)
                if row.status != "approved":
                    row.status = "pending"
                    row.confidence = None
                    row.notes = None
                updated += 1
            else:
                row = SourceRecord(
                    source_connection_id=payload.source_connection_id,
                    entity_code=payload.entity_code,
                    source_table=payload.source_table,
                    source_pk=item.source_pk,
                    payload=item.payload,
                    source_priority=item.source_priority,
                    source_updated_at=item.source_updated_at,
                )
                session.add(row)
                created += 1
            rows.append(row)
        session.commit()
    except IntegrityError as exc:
        session.rollback()
        raise HTTPException(status_code=409, detail="Duplicate source record identity") from exc
    except Exception:
        session.rollback()
        raise
    for row in rows:
        session.refresh(row)
    return SourceRecordIngestResult(created=created, updated=updated, records=rows)


@router.get("/source-records", response_model=list[SourceRecordRead])
def list_source_records(
    entity_code: Optional[str] = None,
    status_filter: Optional[str] = Query(default=None, alias="status"),
    session: Session = Depends(get_session),
) -> list[SourceRecord]:
    query = select(SourceRecord)
    if entity_code:
        query = query.where(SourceRecord.entity_code == entity_code)
    if status_filter:
        query = query.where(SourceRecord.status == status_filter)
    return list(session.exec(query.order_by(SourceRecord.updated_at.desc())).all())


@router.post("/source-records/{source_record_id}/suggestions", response_model=MDMSuggestionResponse)
def suggest_source_record_matches(
    source_record_id: int, session: Session = Depends(get_session)
) -> MDMSuggestionResponse:
    source = session.get(SourceRecord, source_record_id)
    if not source:
        raise HTTPException(status_code=404, detail="Source record not found")
    if source.status == "approved":
        raise HTTPException(status_code=409, detail="Approved source records are already linked")
    entity = _entity(session, source.entity_code)
    if not entity.match_fields:
        raise HTTPException(status_code=400, detail="Configure match fields for this entity first")
    config = session.exec(select(SystemConfig)).first()
    if not config:
        raise HTTPException(status_code=500, detail="System configuration missing")
    text = record_match_text(entity, source.payload)
    if not text:
        raise HTTPException(status_code=400, detail="Source record has no configured match values")

    records = session.exec(
        select(MasterRecord).where(
            MasterRecord.entity_code == entity.code,
            MasterRecord.status == "active",
        )
    ).all()
    candidates = rank_master_records(config, entity, source.payload, records)
    if not candidates:
        return MDMSuggestionResponse(source_record_id=source.id or 0, entity_code=entity.code, candidates=[])
    result = [
        MDMCandidate(
            master_record_id=record.id or 0,
            attributes=record.attributes,
            score=score,
        )
        for record, score in candidates
    ]
    top = result[0] if result else None
    source.proposed_master_record_id = top.master_record_id if top else None
    source.confidence = top.score if top else None
    source.updated_at = datetime.now(timezone.utc)
    session.add(source)
    session.commit()
    return MDMSuggestionResponse(
        source_record_id=source.id or 0, entity_code=entity.code, candidates=result
    )


@router.post("/source-records/{source_record_id}/approve", response_model=SourceRecordRead)
def approve_source_record(
    source_record_id: int,
    payload: SourceRecordApprove,
    session: Session = Depends(get_session),
) -> SourceRecord:
    source = session.get(SourceRecord, source_record_id)
    if not source:
        raise HTTPException(status_code=404, detail="Source record not found")
    master_id = payload.master_record_id or source.proposed_master_record_id
    entity = _entity(session, source.entity_code)
    if master_id is None:
        allowed = {field["key"] for field in entity.attribute_schema}
        attributes = {key: value for key, value in source.payload.items() if key in allowed}
        _translate_mdm_error(validate_attributes, entity, attributes)
        record = MasterRecord(entity_code=entity.code, attributes=attributes)
        session.add(record)
        session.flush()
        master_id = record.id
    else:
        record = _record(session, master_id)
        if record.status != "active" or record.entity_code != source.entity_code:
            raise HTTPException(status_code=400, detail="Selected master record is not an active record of this entity")
    source.master_record_id = master_id
    source.proposed_master_record_id = None
    source.status = "approved"
    source.updated_at = datetime.now(timezone.utc)
    session.add(source)
    session.commit()
    session.refresh(source)
    return source


@router.post("/source-records/{source_record_id}/reject", response_model=SourceRecordRead)
def reject_source_record(source_record_id: int, session: Session = Depends(get_session)) -> SourceRecord:
    source = session.get(SourceRecord, source_record_id)
    if not source:
        raise HTTPException(status_code=404, detail="Source record not found")
    if source.status == "approved":
        raise HTTPException(status_code=409, detail="Approved source records cannot be rejected")
    source.status = "rejected"
    source.proposed_master_record_id = None
    source.updated_at = datetime.now(timezone.utc)
    session.add(source)
    session.commit()
    session.refresh(source)
    return source


@router.post("/records/{record_id}/merge", response_model=MasterRecordRead)
def merge_master_record(
    record_id: int, payload: MasterRecordMerge, session: Session = Depends(get_session)
) -> MasterRecord:
    loser = _record(session, record_id)
    survivor = _record(session, payload.survivor_id)
    entity = _entity(session, loser.entity_code)
    result = _translate_mdm_error(merge_records, session, loser, survivor, entity)
    return result["survivor"]


@router.post("/records/{record_id}/unmerge", response_model=MasterRecordRead)
def unmerge_master_record(record_id: int, session: Session = Depends(get_session)) -> MasterRecord:
    loser = _record(session, record_id)
    if not loser.merged_into_id:
        raise HTTPException(status_code=409, detail="Record is not merged")
    survivor = _record(session, loser.merged_into_id)
    history = session.exec(
        select(MergeHistory)
        .where(
            MergeHistory.merged_record_id == loser.id,
            MergeHistory.unmerged_at.is_(None),
        )
        .order_by(MergeHistory.id.desc())
    ).first()
    if not history:
        raise HTTPException(status_code=409, detail="Active merge history not found")
    _translate_mdm_error(unmerge_record, session, history, loser, survivor)
    session.refresh(loser)
    return loser


@router.get("/records/{record_id}/history", response_model=list[MergeHistory])
def get_merge_history(record_id: int, session: Session = Depends(get_session)) -> list[MergeHistory]:
    _record(session, record_id)
    return list(
        session.exec(
            select(MergeHistory)
            .where(
                (MergeHistory.survivor_id == record_id)
                | (MergeHistory.merged_record_id == record_id)
            )
            .order_by(MergeHistory.id.desc())
        ).all()
    )


@router.get("/links", response_model=list[MasterRecordLinkRead])
def list_record_links(
    entity_code: Optional[str] = None, session: Session = Depends(get_session)
) -> list[RecordLink]:
    query = select(RecordLink)
    if entity_code:
        ids = select(MasterRecord.id).where(MasterRecord.entity_code == entity_code)
        query = query.where(RecordLink.parent_id.in_(ids), RecordLink.child_id.in_(ids))
    return list(session.exec(query.order_by(RecordLink.id)).all())


@router.post("/links", response_model=MasterRecordLinkRead, status_code=status.HTTP_201_CREATED)
def create_record_link(
    payload: MasterRecordLinkCreate, session: Session = Depends(get_session)
) -> RecordLink:
    parent = _record(session, payload.parent_id)
    child = _record(session, payload.child_id)
    link = _translate_mdm_error(
        add_record_link, session, parent, child, payload.relation_type
    )
    return link


@router.delete("/links/{link_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_record_link(link_id: int, session: Session = Depends(get_session)) -> Response:
    link = session.get(RecordLink, link_id)
    if not link:
        raise HTTPException(status_code=404, detail="Record link not found")
    session.delete(link)
    session.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/entities/{code}/quality", response_model=EntityQualityReport)
def entity_quality(code: str, session: Session = Depends(get_session)) -> EntityQualityReport:
    entity = _entity(session, code)
    records = session.exec(
        select(MasterRecord).where(
            MasterRecord.entity_code == code, MasterRecord.status == "active"
        )
    ).all()
    results = []
    for record in records:
        score, violations = quality_score(entity, record.attributes)
        results.append(
            MasterRecordQuality(
                record=MasterRecordRead.model_validate(record),
                score=score,
                violations=violations,
            )
        )
    return EntityQualityReport(
        entity_code=code,
        total_records=len(results),
        compliant_records=sum(not row.violations for row in results),
        average_score=round(sum(row.score for row in results) / len(results), 4) if results else 1.0,
        records=results,
    )
