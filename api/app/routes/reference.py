"""Reference data endpoints."""

from __future__ import annotations

import io
import json
import logging
import re
from pathlib import Path
from typing import Any

import pandas as pd
from fastapi import (
    APIRouter,
    Depends,
    File,
    Form,
    HTTPException,
    Response,
    UploadFile,
    status,
)
from pydantic import ValidationError
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import aliased
from sqlalchemy.sql import func
from sqlmodel import Session, select

from ..database import get_session
from ..matcher import SemanticMatcher
from ..models import (
    CanonicalValue,
    Dimension,
    DimensionRelation,
    DimensionRelationLink,
    RawValue,
    SystemConfig,
)
from ..schemas import (
    BulkImportColumnMapping,
    BulkImportPreview,
    BulkImportPreviewColumn,
    BulkImportResult,
    CanonicalValueCreate,
    CanonicalValueRead,
    CanonicalValueUpdate,
    DimensionCreate,
    DimensionRead,
    DimensionRelationCreate,
    DimensionRelationLinkCreate,
    DimensionRelationLinkRead,
    DimensionRelationRead,
    DimensionRelationUpdate,
    DimensionUpdate,
    MatchRequest,
    MatchResponse,
    ProposedDimension,
)
from ..services.dimensions import (
    build_schema_lookup,
    dimension_to_read_model,
    ensure_dimension_can_be_removed,
    relation_to_read_model,
    remove_links_for_canonical,
    require_dimension,
    validate_attributes,
    validate_extra_fields,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/reference", tags=["reference"])

DIMENSION_COLUMN_KEYS = {
    "dimension",
    "dimension_code",
    "dimensionid",
    "dimension_name",
    "dimension_label",
    "dim",
    "domain",
    "category",
}
LABEL_COLUMN_KEYS = {
    "canonical_label",
    "canonical_value",
    "canonical_name",
    "label",
    "name",
    "value",
    "canonical",
    "canonicalvalue",
}
DESCRIPTION_COLUMN_KEYS = {
    "canonical_description",
    "long_description",
    "description",
    "detail",
    "details",
    "notes",
    "note",
    "summary",
    "comment",
}


def _normalise(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", "_", text.strip().lower()).strip("_")


def _load_dataframe(buffer: bytes, filename: str | None) -> pd.DataFrame:
    if not buffer:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Uploaded file is empty.",
        )

    extension = (Path(filename or "").suffix or "").lower()
    stream = io.BytesIO(buffer)
    logger.debug(
        "Attempting to parse uploaded table",
        extra={"filename": filename, "extension": extension, "size_bytes": len(buffer)},
    )

    if extension in {".xls", ".xlsx"}:
        try:
            df = pd.read_excel(stream)
        except ValueError as exc:  # pragma: no cover - defensive guard
            logger.exception("Failed to parse Excel payload", exc_info=exc)
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Unable to parse Excel file. Ensure the sheet includes a header row.",
            ) from exc
    else:
        df = None
        for separator in [None, ",", ";", "\t", "|"]:
            stream.seek(0)
            try:
                candidate = pd.read_csv(stream, sep=separator, engine="python")
            except Exception:  # pragma: no cover - pandas raises numerous subclasses
                continue
            if not candidate.empty:
                df = candidate
                break
        if df is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    "Unable to parse uploaded file. Provide a CSV or Excel sheet "
                    "with a header row describing each column."
                ),
            )

    df = df.dropna(how="all")
    df = df.dropna(axis=1, how="all")
    if df.empty:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Uploaded table does not contain any data rows.",
        )

    df.columns = [str(column) for column in df.columns]
    logger.debug(
        "Parsed uploaded table",
        extra={"row_count": len(df.index), "column_count": len(df.columns)},
    )
    return df


def _identify_columns(columns: list[str]) -> dict[str, str | None]:
    normalised_map = {_normalise(column): column for column in columns}
    dimension_column = next(
        (normalised_map[key] for key in DIMENSION_COLUMN_KEYS if key in normalised_map),
        None,
    )
    label_column = next(
        (normalised_map[key] for key in LABEL_COLUMN_KEYS if key in normalised_map),
        None,
    )
    description_column = next(
        (
            normalised_map[key]
            for key in DESCRIPTION_COLUMN_KEYS
            if key in normalised_map
        ),
        None,
    )
    return {
        "dimension": dimension_column,
        "label": label_column,
        "description": description_column,
    }


def _collect_samples(dataframe: pd.DataFrame, column: str, limit: int = 5) -> list[str]:
    samples: list[str] = []
    for value in dataframe[column].tolist():
        text = _safe_str(value)
        if not text:
            continue
        samples.append(text)
        if len(samples) >= limit:
            break
    return samples


def _create_dimension_inline(session: Session, payload: DimensionCreate) -> Dimension:
    extra_schema = validate_extra_fields(payload.extra_fields)
    dimension = Dimension(
        code=payload.code,
        label=payload.label,
        description=payload.description,
        extra_schema=extra_schema,
    )

    session.add(dimension)
    try:
        session.commit()
    except IntegrityError as exc:  # pragma: no cover - defensive guard
        session.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Dimension '{payload.code}' already exists.",
        ) from exc

    session.refresh(dimension)
    logger.info(
        "Created dimension during bulk import",
        extra={"dimension": dimension.code},
    )
    return dimension


def _suggest_dimension(
    dataframe: pd.DataFrame,
    column_map: dict[str, str | None],
    dimensions: dict[str, Dimension],
    dimension_hint: str | None,
) -> str | None:
    if dimension_hint:
        return dimension_hint

    if len(dimensions) == 1 and not column_map.get("dimension"):
        return next(iter(dimensions.keys()))

    dimension_column = column_map.get("dimension")
    if dimension_column:
        values = {
            value
            for value in (
                _safe_str(item) for item in dataframe[dimension_column].tolist()
            )
            if value
        }
        if len(values) == 1:
            candidate = next(iter(values))
            if candidate in dimensions:
                return candidate
    return None


def _propose_dimension(
    dataframe: pd.DataFrame,
    column_map: dict[str, str | None],
    dimensions: dict[str, Dimension],
    filename: str,
) -> ProposedDimension | None:
    if not dataframe.columns.tolist():
        return None

    base = Path(filename or "new_dimension").stem or "new_dimension"
    label_column = column_map.get("label") or dataframe.columns.tolist()[0]
    if label_column:
        base = _normalise(label_column) or base

    candidate = base or "new_dimension"
    candidate = re.sub(r"[^a-z0-9]+", "_", candidate.lower()).strip("_") or "new_dimension"

    unique_candidate = candidate
    suffix = 2
    while unique_candidate in dimensions:
        unique_candidate = f"{candidate}_{suffix}"
        suffix += 1

    label_guess = label_column.title() if label_column else "New Dimension"
    return ProposedDimension(code=unique_candidate, label=label_guess)


def _build_preview(
    dataframe: pd.DataFrame,
    session: Session,
    dimension_hint: str | None,
    filename: str,
) -> BulkImportPreview:
    column_map = _identify_columns(list(dataframe.columns))
    dimension_records = session.exec(select(Dimension)).all()
    dimension_lookup = {dimension.code: dimension for dimension in dimension_records}
    attribute_lookups = {
        dimension.code: build_schema_lookup(dimension.extra_schema)
        for dimension in dimension_records
    }

    preview_columns: list[BulkImportPreviewColumn] = []
    for column in dataframe.columns:
        normalised = _normalise(column)
        suggested_role: str | None = None
        suggested_attribute_key: str | None = None
        suggested_dimension: str | None = None

        if column_map.get("label") == column:
            suggested_role = "label"
        elif column_map.get("dimension") == column:
            suggested_role = "dimension"
        elif column_map.get("description") == column:
            suggested_role = "description"
        else:
            for dimension_code, lookup in attribute_lookups.items():
                schema = lookup.get(normalised)
                if schema:
                    suggested_role = "attribute"
                    suggested_attribute_key = schema.get("key")
                    suggested_dimension = dimension_code
                    break

        if not suggested_role:
            if "name" in normalised or "label" in normalised:
                suggested_role = "label"
            elif "description" in normalised or "note" in normalised:
                suggested_role = "description"
            elif "dimension" in normalised or "domain" in normalised:
                suggested_role = "dimension"

        preview_columns.append(
            BulkImportPreviewColumn(
                name=column,
                sample=_collect_samples(dataframe, column),
                suggested_role=suggested_role,
                suggested_attribute_key=suggested_attribute_key,
                suggested_dimension=suggested_dimension,
            )
        )

    suggested_dimension = _suggest_dimension(
        dataframe, column_map, dimension_lookup, dimension_hint
    )
    proposed_dimension = None
    if not suggested_dimension:
        proposed_dimension = _propose_dimension(
            dataframe, column_map, dimension_lookup, filename
        )

    return BulkImportPreview(
        columns=preview_columns,
        suggested_dimension=suggested_dimension,
        proposed_dimension=proposed_dimension,
    )


def _safe_str(value: Any) -> str | None:
    if value is None:
        return None
    try:
        if pd.isna(value):
            return None
    except TypeError:
        pass
    text = str(value).strip()
    return text or None


@router.get("/canonical", response_model=list[CanonicalValueRead])
def list_canonical_values(session: Session = Depends(get_session)) -> list[CanonicalValue]:
    """Return all canonical values ordered by dimension and label."""

    statement = select(CanonicalValue).order_by(
        CanonicalValue.dimension, CanonicalValue.canonical_label
    )
    results = session.exec(statement).all()
    logger.debug("Canonical values requested", extra={"count": len(results)})
    return results


@router.post(
    "/canonical/import/preview",
    response_model=BulkImportPreview,
    status_code=status.HTTP_200_OK,
)
async def preview_canonical_import(
    session: Session = Depends(get_session),
    dimension: str | None = Form(default=None),
    file: UploadFile | None = File(default=None),
    inline_text: str | None = Form(default=None),
) -> BulkImportPreview:
    if not file and not inline_text:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Provide a CSV/Excel file or paste tabular text to preview.",
        )

    filename = file.filename if file else "pasted.csv"
    if file:
        payload_bytes = await file.read()
    else:
        payload_bytes = inline_text.encode("utf-8") if inline_text else b""

    dataframe = _load_dataframe(payload_bytes, filename)
    preview = _build_preview(dataframe, session, dimension, filename)
    logger.debug(
        "Generated bulk import preview",
        extra={
            "filename": filename,
            "columns": [column.name for column in preview.columns],
            "suggested_dimension": preview.suggested_dimension,
        },
    )
    return preview


@router.post(
    "/canonical",
    response_model=CanonicalValueRead,
    status_code=status.HTTP_201_CREATED,
)
def create_canonical_value(
    payload: CanonicalValueCreate, session: Session = Depends(get_session)
) -> CanonicalValue:
    """Create and persist a canonical value."""

    dimension = require_dimension(session, payload.dimension)
    attributes = validate_attributes(dimension, payload.attributes)

    canonical = CanonicalValue(
        dimension=dimension.code,
        canonical_label=payload.canonical_label,
        description=payload.description,
        attributes=attributes,
    )
    session.add(canonical)
    session.commit()
    session.refresh(canonical)
    return canonical


@router.put("/canonical/{canonical_id}", response_model=CanonicalValueRead)
def update_canonical_value(
    canonical_id: int,
    payload: CanonicalValueUpdate,
    session: Session = Depends(get_session),
) -> CanonicalValue:
    """Update an existing canonical value."""

    canonical = session.get(CanonicalValue, canonical_id)
    if not canonical:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Canonical value not found"
        )

    target_dimension_code = payload.dimension or canonical.dimension
    dimension = require_dimension(session, target_dimension_code)

    if payload.attributes is not None:
        attributes = validate_attributes(dimension, payload.attributes)
    else:
        attributes = validate_attributes(dimension, canonical.attributes)

    data = payload.model_dump(exclude_unset=True, exclude={"attributes"})
    for key, value in data.items():
        setattr(canonical, key, value)

    canonical.attributes = attributes
    canonical.dimension = dimension.code

    session.add(canonical)
    session.commit()
    session.refresh(canonical)
    return canonical


@router.delete("/canonical/{canonical_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_canonical_value(
    canonical_id: int, session: Session = Depends(get_session)
) -> Response:
    """Remove a canonical value."""

    canonical = session.get(CanonicalValue, canonical_id)
    if not canonical:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Canonical value not found"
        )

    remove_links_for_canonical(session, canonical_id)
    session.delete(canonical)
    session.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/propose", response_model=MatchResponse)
def propose_match(
    payload: MatchRequest, session: Session = Depends(get_session)
) -> MatchResponse:
    """Score canonical matches for a raw value and persist the raw record."""

    config = session.exec(select(SystemConfig)).first()
    if not config:
        raise HTTPException(status_code=500, detail="System configuration missing")

    if payload.dimension:
        dimension = require_dimension(session, payload.dimension)
    else:
        dimension = require_dimension(session, config.default_dimension)

    dimension_code = dimension.code

    canonical_values = session.exec(
        select(CanonicalValue).where(CanonicalValue.dimension == dimension_code)
    ).all()

    if not canonical_values and dimension_code != config.default_dimension:
        fallback_dimension = require_dimension(session, config.default_dimension)
        canonical_values = session.exec(
            select(CanonicalValue).where(
                CanonicalValue.dimension == fallback_dimension.code
            )
        ).all()
        dimension_code = fallback_dimension.code

    matcher = SemanticMatcher(config=config, canonical_values=canonical_values)
    ranked = matcher.rank(payload.raw_text)
    filtered = [match for match in ranked if match.score >= config.match_threshold]

    raw = RawValue(
        dimension=dimension_code,
        raw_text=payload.raw_text,
        status="suggested" if filtered else "pending",
        proposed_canonical_id=filtered[0].canonical_id if filtered else None,
    )
    session.add(raw)
    session.commit()
    session.refresh(raw)

    return MatchResponse(
        raw_text=payload.raw_text, dimension=dimension_code, matches=filtered
    )


@router.get("/dimensions", response_model=list[DimensionRead])
def list_dimensions(session: Session = Depends(get_session)) -> list[DimensionRead]:
    dimensions = session.exec(select(Dimension).order_by(Dimension.label)).all()
    logger.debug("Dimensions requested", extra={"count": len(dimensions)})
    return [dimension_to_read_model(dimension) for dimension in dimensions]


@router.post("/dimensions", response_model=DimensionRead, status_code=status.HTTP_201_CREATED)
def create_dimension(
    payload: DimensionCreate, session: Session = Depends(get_session)
) -> DimensionRead:
    extra_schema = validate_extra_fields(payload.extra_fields)
    dimension = Dimension(
        code=payload.code,
        label=payload.label,
        description=payload.description,
        extra_schema=extra_schema,
    )

    session.add(dimension)
    try:
        session.commit()
    except IntegrityError as exc:
        session.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Dimension '{payload.code}' already exists.",
        ) from exc

    session.refresh(dimension)
    return dimension_to_read_model(dimension)


@router.put("/dimensions/{code}", response_model=DimensionRead)
def update_dimension(
    code: str, payload: DimensionUpdate, session: Session = Depends(get_session)
) -> DimensionRead:
    dimension = require_dimension(session, code)
    data = payload.model_dump(exclude_unset=True)

    if "extra_fields" in data:
        dimension.extra_schema = validate_extra_fields(data.pop("extra_fields"))

    for key, value in data.items():
        setattr(dimension, key, value)

    dimension.touch()
    session.add(dimension)
    session.commit()
    session.refresh(dimension)
    return dimension_to_read_model(dimension)


@router.delete("/dimensions/{code}", status_code=status.HTTP_204_NO_CONTENT)
def delete_dimension(code: str, session: Session = Depends(get_session)) -> Response:
    dimension = require_dimension(session, code)
    ensure_dimension_can_be_removed(session, code)
    session.delete(dimension)
    session.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get(
    "/dimension-relations",
    response_model=list[DimensionRelationRead],
)
def list_dimension_relations(
    session: Session = Depends(get_session),
) -> list[DimensionRelationRead]:
    relations = session.exec(select(DimensionRelation)).all()
    dimensions = session.exec(select(Dimension)).all()
    dimension_map = {dimension.code: dimension for dimension in dimensions}

    payloads: list[DimensionRelationRead] = []
    for relation in relations:
        parent = dimension_map.get(relation.parent_dimension_code)
        child = dimension_map.get(relation.child_dimension_code)
        if not parent or not child:
            logger.warning(
                "Dimension relation has orphaned references",
                extra={"relation_id": relation.id},
            )
            continue
        link_count = session.exec(
            select(func.count()).where(
                DimensionRelationLink.relation_id == relation.id
            )
        ).one()[0]
        payloads.append(
            relation_to_read_model(relation, parent=parent, child=child, link_count=link_count)
        )

    logger.debug(
        "Dimension relations requested", extra={"count": len(payloads)}
    )
    return payloads


@router.post(
    "/dimension-relations",
    response_model=DimensionRelationRead,
    status_code=status.HTTP_201_CREATED,
)
def create_dimension_relation(
    payload: DimensionRelationCreate, session: Session = Depends(get_session)
) -> DimensionRelationRead:
    parent = require_dimension(session, payload.parent_dimension_code)
    child = require_dimension(session, payload.child_dimension_code)

    if parent.code == child.code:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Parent and child dimensions must be different.",
        )

    relation = DimensionRelation(
        label=payload.label,
        parent_dimension_code=parent.code,
        child_dimension_code=child.code,
        description=payload.description,
    )
    session.add(relation)
    try:
        session.commit()
    except IntegrityError as exc:
        session.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A relation with the same label already exists for these dimensions.",
        ) from exc

    session.refresh(relation)
    return relation_to_read_model(relation, parent=parent, child=child, link_count=0)


@router.put(
    "/dimension-relations/{relation_id}",
    response_model=DimensionRelationRead,
)
def update_dimension_relation(
    relation_id: int,
    payload: DimensionRelationUpdate,
    session: Session = Depends(get_session),
) -> DimensionRelationRead:
    relation = session.get(DimensionRelation, relation_id)
    if not relation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Dimension relation not found"
        )

    data = payload.model_dump(exclude_unset=True)
    for key, value in data.items():
        setattr(relation, key, value)
    relation.touch()
    session.add(relation)
    session.commit()
    session.refresh(relation)

    parent = require_dimension(session, relation.parent_dimension_code)
    child = require_dimension(session, relation.child_dimension_code)
    link_count = session.exec(
        select(func.count()).where(DimensionRelationLink.relation_id == relation.id)
    ).one()[0]

    return relation_to_read_model(relation, parent=parent, child=child, link_count=link_count)


@router.delete(
    "/dimension-relations/{relation_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_dimension_relation(
    relation_id: int, session: Session = Depends(get_session)
) -> Response:
    relation = session.get(DimensionRelation, relation_id)
    if not relation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Dimension relation not found"
        )

    links = session.exec(
        select(DimensionRelationLink).where(DimensionRelationLink.relation_id == relation_id)
    ).all()
    for link in links:
        session.delete(link)

    session.delete(relation)
    session.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get(
    "/dimension-relations/{relation_id}/links",
    response_model=list[DimensionRelationLinkRead],
)
def list_dimension_relation_links(
    relation_id: int, session: Session = Depends(get_session)
) -> list[DimensionRelationLinkRead]:
    relation = session.get(DimensionRelation, relation_id)
    if not relation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Dimension relation not found"
        )

    parent_alias = aliased(CanonicalValue)
    child_alias = aliased(CanonicalValue)
    statement = (
        select(
            DimensionRelationLink,
            parent_alias.canonical_label,
            child_alias.canonical_label,
        )
        .join(parent_alias, parent_alias.id == DimensionRelationLink.parent_canonical_id)
        .join(child_alias, child_alias.id == DimensionRelationLink.child_canonical_id)
        .where(DimensionRelationLink.relation_id == relation_id)
        .order_by(parent_alias.canonical_label, child_alias.canonical_label)
    )

    results = session.exec(statement).all()
    payloads = [
        DimensionRelationLinkRead(
            id=link.id,
            relation_id=link.relation_id,
            parent_canonical_id=link.parent_canonical_id,
            child_canonical_id=link.child_canonical_id,
            parent_label=parent_label,
            child_label=child_label,
            created_at=link.created_at,
            updated_at=link.updated_at,
        )
        for link, parent_label, child_label in results
    ]

    logger.debug(
        "Dimension relation links requested",
        extra={"relation_id": relation_id, "count": len(payloads)},
    )
    return payloads


@router.post(
    "/dimension-relations/{relation_id}/links",
    response_model=DimensionRelationLinkRead,
    status_code=status.HTTP_201_CREATED,
)
def create_dimension_relation_link(
    relation_id: int,
    payload: DimensionRelationLinkCreate,
    session: Session = Depends(get_session),
) -> DimensionRelationLinkRead:
    relation = session.get(DimensionRelation, relation_id)
    if not relation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Dimension relation not found"
        )

    parent = session.get(CanonicalValue, payload.parent_canonical_id)
    child = session.get(CanonicalValue, payload.child_canonical_id)
    if not parent or not child:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid canonical identifiers supplied.",
        )

    if parent.dimension != relation.parent_dimension_code:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Parent canonical value does not belong to the parent dimension.",
        )

    if child.dimension != relation.child_dimension_code:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Child canonical value does not belong to the child dimension.",
        )

    existing = session.exec(
        select(DimensionRelationLink)
        .where(DimensionRelationLink.relation_id == relation_id)
        .where(DimensionRelationLink.parent_canonical_id == payload.parent_canonical_id)
        .where(DimensionRelationLink.child_canonical_id == payload.child_canonical_id)
    ).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This link already exists for the selected relation.",
        )

    link = DimensionRelationLink(
        relation_id=relation_id,
        parent_canonical_id=payload.parent_canonical_id,
        child_canonical_id=payload.child_canonical_id,
    )
    session.add(link)
    session.commit()
    session.refresh(link)

    return DimensionRelationLinkRead(
        id=link.id,
        relation_id=link.relation_id,
        parent_canonical_id=link.parent_canonical_id,
        child_canonical_id=link.child_canonical_id,
        parent_label=parent.canonical_label,
        child_label=child.canonical_label,
        created_at=link.created_at,
        updated_at=link.updated_at,
    )


@router.delete(
    "/dimension-relations/{relation_id}/links/{link_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_dimension_relation_link(
    relation_id: int,
    link_id: int,
    session: Session = Depends(get_session),
) -> Response:
    link = session.get(DimensionRelationLink, link_id)
    if not link or link.relation_id != relation_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Relation link not found"
        )

    session.delete(link)
    session.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post(
    "/canonical/import",
    response_model=BulkImportResult,
    status_code=status.HTTP_201_CREATED,
)
async def import_canonical_values(
    session: Session = Depends(get_session),
    dimension: str | None = Form(default=None),
    file: UploadFile | None = File(default=None),
    inline_text: str | None = Form(default=None),
    mapping: str | None = Form(default=None),
) -> BulkImportResult:
    if not file and not inline_text:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Provide a CSV/Excel file or paste tabular text to import.",
        )

    filename = file.filename if file else "pasted.csv"
    if file:
        payload_bytes = await file.read()
    else:
        payload_bytes = inline_text.encode("utf-8")

    logger.info(
        "Bulk canonical import received",
        extra={
            "filename": filename,
            "bytes": len(payload_bytes),
            "provided_dimension": dimension,
            "has_file": bool(file),
            "has_inline_text": bool(inline_text and inline_text.strip()),
        },
    )

    dataframe = _load_dataframe(payload_bytes, filename)

    mapping_payload: BulkImportColumnMapping | None = None
    if mapping:
        try:
            mapping_payload = BulkImportColumnMapping.model_validate_json(mapping)
        except ValidationError as exc:
            logger.warning("Invalid column mapping supplied", exc_info=exc)
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid column mapping payload provided.",
            ) from exc

    column_map = _identify_columns(list(dataframe.columns))
    logger.debug(
        "Detected import columns",
        extra={
            "dimension_column": column_map.get("dimension"),
            "label_column": column_map.get("label"),
            "description_column": column_map.get("description"),
        },
    )
    label_column = mapping_payload.label if mapping_payload and mapping_payload.label else column_map.get("label")
    if not label_column:
        logger.warning(
            "Bulk import aborted: missing canonical label column",
            extra={"available_columns": list(dataframe.columns)},
        )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "Select which column represents the canonical label before importing."
            ),
        )

    dimension_column = (
        mapping_payload.dimension
        if mapping_payload and mapping_payload.dimension
        else column_map.get("dimension")
    )
    description_column = (
        mapping_payload.description
        if mapping_payload and mapping_payload.description
        else column_map.get("description")
    )

    referenced_columns = [label_column]
    if dimension_column:
        referenced_columns.append(dimension_column)
    if description_column:
        referenced_columns.append(description_column)
    if mapping_payload:
        referenced_columns.extend(mapping_payload.attributes.values())

    missing_columns = {
        column for column in referenced_columns if column and column not in dataframe.columns
    }
    if missing_columns:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "Column mapping references unknown headers: "
                + ", ".join(sorted(missing_columns))
            ),
        )

    optional_columns: set[str]
    if mapping_payload and mapping_payload.attributes:
        optional_columns = set(mapping_payload.attributes.values())
    else:
        optional_columns = {
            column
            for column in dataframe.columns
            if column not in {dimension_column, label_column, description_column}
        }

    created: list[CanonicalValueRead] = []
    errors: list[str] = []
    dimension_cache: dict[str, Dimension] = {}

    default_dimension = (
        mapping_payload.default_dimension if mapping_payload else None
    ) or dimension

    def get_dimension(code: str) -> Dimension | None:
        if code not in dimension_cache:
            try:
                dimension_cache[code] = require_dimension(session, code)
            except HTTPException:
                if (
                    mapping_payload
                    and mapping_payload.dimension_definition
                    and mapping_payload.dimension_definition.code == code
                ):
                    dimension_cache[code] = _create_dimension_inline(
                        session, mapping_payload.dimension_definition
                    )
                else:
                    dimension_cache[code] = None  # type: ignore[assignment]
        return dimension_cache.get(code)

    for row_number, row in enumerate(
        dataframe.to_dict(orient="records"), start=2
    ):
        label_value = _safe_str(row.get(label_column))
        if not label_value:
            errors.append(f"Row {row_number}: Missing canonical label; skipping entry.")
            continue

        if dimension_column:
            dimension_value = _safe_str(row.get(dimension_column)) or default_dimension
        else:
            dimension_value = default_dimension

        if not dimension_value:
            errors.append(
                f"Row {row_number}: Missing dimension and no default provided; skipping entry."
            )
            continue

        dimension_model = get_dimension(dimension_value)
        if not dimension_model:
            errors.append(
                f"Row {row_number}: Dimension '{dimension_value}' does not exist."
            )
            continue

        description_value = _safe_str(row.get(description_column)) if description_column else None
        if mapping_payload and mapping_payload.attributes:
            attribute_payload = {
                key: row.get(column)
                for key, column in mapping_payload.attributes.items()
            }
        else:
            attribute_payload = {column: row.get(column) for column in optional_columns}

        try:
            attributes = validate_attributes(dimension_model, attribute_payload)
        except HTTPException as exc:
            errors.append(f"Row {row_number}: {exc.detail}")
            continue

        canonical = CanonicalValue(
            dimension=dimension_model.code,
            canonical_label=label_value,
            description=description_value,
            attributes=attributes,
        )

        session.add(canonical)
        try:
            session.commit()
        except IntegrityError as exc:  # pragma: no cover - depends on DB constraints
            session.rollback()
            errors.append(
                f"Row {row_number}: Unable to persist canonical value ({exc.orig})."
            )
            continue

        session.refresh(canonical)
        created.append(CanonicalValueRead.model_validate(canonical))

    logger.info(
        "Bulk canonical import processed",
        extra={"created": len(created), "errors": len(errors)},
    )
    return BulkImportResult(created=created, errors=errors)
