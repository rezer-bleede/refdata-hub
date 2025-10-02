"""Utilities for managing dimension schemas and validations."""

from __future__ import annotations

import logging
import re
from typing import Any, Iterable

from fastapi import HTTPException, status
from sqlmodel import Session, select

from ..models import CanonicalValue, Dimension, DimensionRelation, DimensionRelationLink
from ..schemas import (
    DimensionExtraFieldDefinition,
    DimensionRead,
    DimensionRelationRead,
)

logger = logging.getLogger(__name__)

SUPPORTED_FIELD_TYPES = {"string", "number", "boolean"}


def _normalise_key(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "_", value.strip().lower()).strip("_")


def validate_extra_fields(
    definitions: Iterable[DimensionExtraFieldDefinition | dict[str, Any]],
) -> list[dict[str, Any]]:
    """Ensure the dimension extra field schema is well-defined."""

    normalised_keys: set[str] = set()
    validated: list[dict[str, Any]] = []

    coerced: list[DimensionExtraFieldDefinition] = []
    for definition in definitions:
        if isinstance(definition, DimensionExtraFieldDefinition):
            coerced.append(definition)
        else:
            coerced.append(DimensionExtraFieldDefinition.model_validate(definition))

    for definition in coerced:
        key = definition.key.strip()
        if not key:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Dimension field keys cannot be empty.",
            )

        normalised = _normalise_key(key)
        if not normalised:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid dimension field key '{definition.key}'.",
            )

        if normalised in normalised_keys:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Duplicate dimension field key '{definition.key}'.",
            )

        if definition.data_type not in SUPPORTED_FIELD_TYPES:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Unsupported data type '{definition.data_type}'.",
            )

        normalised_keys.add(normalised)
        validated.append(
            {
                "key": key,
                "label": definition.label,
                "description": definition.description,
                "data_type": definition.data_type,
                "required": definition.required,
            }
        )

    logger.debug("Validated dimension extra fields", extra={"count": len(validated)})
    return validated


def get_dimension_by_code(session: Session, code: str) -> Dimension | None:
    return session.exec(select(Dimension).where(Dimension.code == code)).first()


def require_dimension(session: Session, code: str) -> Dimension:
    dimension = get_dimension_by_code(session, code)
    if not dimension:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Dimension '{code}' not found.",
        )
    return dimension


def _coerce_value(value: Any, data_type: str) -> Any:
    if value is None or (isinstance(value, str) and not value.strip()):
        return None

    if data_type == "string":
        return str(value).strip()

    if data_type == "number":
        try:
            return float(value)
        except (TypeError, ValueError) as exc:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Value '{value}' is not a valid number.",
            ) from exc

    if data_type == "boolean":
        if isinstance(value, bool):
            return value
        text = str(value).strip().lower()
        if text in {"true", "1", "yes", "y"}:
            return True
        if text in {"false", "0", "no", "n"}:
            return False
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Value '{value}' is not a valid boolean.",
        )

    return value


def build_schema_lookup(
    extra_schema: Iterable[dict[str, Any]]
) -> dict[str, dict[str, Any]]:
    lookup: dict[str, dict[str, Any]] = {}
    for definition in extra_schema:
        key = definition.get("key")
        if not key:
            continue
        lookup[_normalise_key(key)] = definition
        label = definition.get("label")
        if label:
            lookup.setdefault(_normalise_key(label), definition)
    return lookup


def validate_attributes(
    dimension: Dimension, attributes: dict[str, Any] | None
) -> dict[str, Any]:
    attributes = attributes or {}
    if not dimension.extra_schema:
        filtered = {k: v for k, v in attributes.items() if v is not None}
        logger.debug(
            "Dimension has no extra schema; stripped to %s keys", len(filtered)
        )
        return filtered

    lookup = build_schema_lookup(dimension.extra_schema)
    cleaned: dict[str, Any] = {}

    for raw_key, raw_value in attributes.items():
        schema = lookup.get(_normalise_key(raw_key))
        if not schema:
            logger.debug(
                "Ignoring attribute for undefined key", extra={"key": raw_key}
            )
            continue

        coerced = _coerce_value(raw_value, schema.get("data_type", "string"))
        cleaned[schema["key"]] = coerced

    for definition in dimension.extra_schema:
        if definition.get("required") and cleaned.get(definition["key"]) is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Missing required attribute '{definition['key']}'.",
            )

    logger.debug(
        "Validated canonical attributes", extra={"dimension": dimension.code}
    )
    return cleaned


def dimension_to_read_model(dimension: Dimension) -> DimensionRead:
    extra_fields = [
        DimensionExtraFieldDefinition.model_validate(field)
        for field in dimension.extra_schema
    ]
    return DimensionRead(
        id=dimension.id,
        code=dimension.code,
        label=dimension.label,
        description=dimension.description,
        extra_fields=extra_fields,
        created_at=dimension.created_at,
        updated_at=dimension.updated_at,
    )


def relation_to_read_model(
    relation: DimensionRelation, parent: Dimension, child: Dimension, link_count: int
) -> DimensionRelationRead:
    payload = DimensionRelationRead(
        id=relation.id,
        label=relation.label,
        description=relation.description,
        parent_dimension_code=relation.parent_dimension_code,
        child_dimension_code=relation.child_dimension_code,
        parent_dimension=dimension_to_read_model(parent),
        child_dimension=dimension_to_read_model(child),
        link_count=link_count,
        created_at=relation.created_at,
        updated_at=relation.updated_at,
    )
    logger.debug(
        "Serialised dimension relation", extra={"relation_id": relation.id}
    )
    return payload


def ensure_dimension_can_be_removed(session: Session, code: str) -> None:
    """Ensure a dimension is not referenced before deletion."""

    canonical_count = session.exec(
        select(CanonicalValue).where(CanonicalValue.dimension == code)
    ).all()
    if canonical_count:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete a dimension that still has canonical values.",
        )

    relation_count = session.exec(
        select(DimensionRelation).where(
            (DimensionRelation.parent_dimension_code == code)
            | (DimensionRelation.child_dimension_code == code)
        )
    ).all()
    if relation_count:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete a dimension that participates in relations.",
        )


def remove_links_for_canonical(session: Session, canonical_id: int) -> None:
    links = session.exec(
        select(DimensionRelationLink).where(
            (DimensionRelationLink.parent_canonical_id == canonical_id)
            | (DimensionRelationLink.child_canonical_id == canonical_id)
        )
    ).all()
    for link in links:
        session.delete(link)

