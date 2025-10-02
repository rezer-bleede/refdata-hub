"""Reference data endpoints."""

from __future__ import annotations

import io
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
)
from ..services.dimensions import (
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
    "dim",
    "domain",
    "category",
}
LABEL_COLUMN_KEYS = {
    "canonical_label",
    "label",
    "name",
    "value",
    "canonical",
    "canonicalvalue",
}
DESCRIPTION_COLUMN_KEYS = {
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

    dataframe = _load_dataframe(payload_bytes, filename)
    column_map = _identify_columns(list(dataframe.columns))
    label_column = column_map.get("label")
    if not label_column:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "Unable to identify the canonical label column. Add a header such as "
                "'label' or 'canonical_label'."
            ),
        )

    dimension_column = column_map.get("dimension")
    description_column = column_map.get("description")
    optional_columns = {
        column
        for column in dataframe.columns
        if column not in {dimension_column, label_column, description_column}
    }

    created: list[CanonicalValueRead] = []
    errors: list[str] = []
    dimension_cache: dict[str, Dimension] = {}

    def get_dimension(code: str) -> Dimension | None:
        if code not in dimension_cache:
            try:
                dimension_cache[code] = require_dimension(session, code)
            except HTTPException:
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
            dimension_value = _safe_str(row.get(dimension_column)) or dimension
        else:
            dimension_value = dimension

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
