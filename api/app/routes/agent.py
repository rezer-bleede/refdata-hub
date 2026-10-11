"""Agentic harmonization endpoints."""

from __future__ import annotations

from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session, select

from ..database import get_session
from ..models import Dimension, SourceConnection, SystemConfig
from ..schemas import AgentHarmonizeRequest, AgentRunResult, AgentToolInfo
from ..services.agent import AGENT_TOOLS, AgentEngine, AgentSourceContext

router = APIRouter(prefix="/agent", tags=["agent"])


def _get_config(session: Session) -> SystemConfig:
    config = session.exec(select(SystemConfig)).first()
    if not config:
        raise HTTPException(status_code=500, detail="System configuration missing")
    return config


@router.get("/tools", response_model=List[AgentToolInfo])
def list_agent_tools() -> List[AgentToolInfo]:
    """Expose the catalog of tools available to the harmonization agent."""

    return [
        AgentToolInfo(
            name=tool["name"],
            description=tool["description"],
            parameters=tool["parameters"],
        )
        for tool in AGENT_TOOLS
    ]


@router.post("/harmonize", response_model=List[AgentRunResult])
def harmonize_values(
    payload: AgentHarmonizeRequest, session: Session = Depends(get_session)
) -> List[AgentRunResult]:
    """Run the advisory harmonization agent over one or more raw values."""

    candidates: List[str] = []
    if payload.raw_text:
        candidates.append(payload.raw_text)
    candidates.extend(payload.values)

    values: list[str] = []
    for candidate in candidates:
        text = (candidate or "").strip()
        if text and text not in values:
            values.append(text)

    if not values:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Provide 'raw_text' or at least one entry in 'values'.",
        )

    config = _get_config(session)

    if payload.dimension:
        exists = session.exec(
            select(Dimension).where(Dimension.code == payload.dimension)
        ).first()
        if not exists:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Dimension '{payload.dimension}' does not exist.",
            )

    source_context = _resolve_source_context(session, payload)

    engine = AgentEngine(session=session, config=config)
    return [
        engine.run(
            value,
            dimension=payload.dimension,
            max_steps=payload.max_steps,
            source_context=source_context,
        )
        for value in values
    ]


def _resolve_source_context(
    session: Session, payload: AgentHarmonizeRequest
) -> AgentSourceContext | None:
    provided = [
        payload.source_connection_id is not None,
        bool(payload.source_table),
        bool(payload.source_field),
    ]
    if not any(provided):
        return None
    if not all(provided):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "source_connection_id, source_table, and source_field must be "
                "provided together."
            ),
        )

    connection = session.get(SourceConnection, payload.source_connection_id)
    if not connection:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Connection not found"
        )

    return AgentSourceContext(
        source_connection_id=payload.source_connection_id or 0,
        source_table=payload.source_table or "",
        source_field=payload.source_field or "",
    )
