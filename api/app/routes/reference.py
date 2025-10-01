"""Reference data endpoints."""

from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlmodel import Session, select

from ..database import get_session
from ..matcher import SemanticMatcher
from ..models import CanonicalValue, RawValue, SystemConfig
from ..schemas import (
    CanonicalValueCreate,
    CanonicalValueRead,
    CanonicalValueUpdate,
    MatchRequest,
    MatchResponse,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/reference", tags=["reference"])


@router.get("/canonical", response_model=list[CanonicalValueRead])
def list_canonical_values(session: Session = Depends(get_session)) -> list[CanonicalValue]:
    """Return all canonical values ordered by dimension and label."""

    statement = select(CanonicalValue).order_by(CanonicalValue.dimension, CanonicalValue.canonical_label)
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

    canonical = CanonicalValue(**payload.model_dump())
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
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Canonical value not found")

    data = payload.model_dump(exclude_unset=True)
    for key, value in data.items():
        setattr(canonical, key, value)

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
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Canonical value not found")

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

    dimension = payload.dimension or config.default_dimension

    canonical_values = session.exec(
        select(CanonicalValue).where(CanonicalValue.dimension == dimension)
    ).all()

    if not canonical_values:
        canonical_values = session.exec(
            select(CanonicalValue).where(CanonicalValue.dimension == config.default_dimension)
        ).all()

    matcher = SemanticMatcher(config=config, canonical_values=canonical_values)
    ranked = matcher.rank(payload.raw_text)
    filtered = [match for match in ranked if match.score >= config.match_threshold]

    raw = RawValue(
        dimension=dimension,
        raw_text=payload.raw_text,
        status="suggested" if filtered else "pending",
        proposed_canonical_id=filtered[0].canonical_id if filtered else None,
    )
    session.add(raw)
    session.commit()
    session.refresh(raw)

    return MatchResponse(raw_text=payload.raw_text, dimension=dimension, matches=filtered)
