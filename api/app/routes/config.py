"""System configuration endpoints."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select

from ..database import get_session
from ..models import SystemConfig
from ..schemas import SystemConfigRead, SystemConfigUpdate

router = APIRouter(prefix="/config", tags=["config"])


@router.get("", response_model=SystemConfigRead)
def read_config(session: Session = Depends(get_session)) -> SystemConfigRead:
    config = session.exec(select(SystemConfig)).first()
    if not config:
        raise HTTPException(status_code=500, detail="System configuration missing")

    return SystemConfigRead(
        default_dimension=config.default_dimension,
        match_threshold=config.match_threshold,
        matcher_backend=config.matcher_backend,
        embedding_model=config.embedding_model,
        llm_model=config.llm_model,
        llm_api_base=config.llm_api_base,
        top_k=config.top_k,
        llm_api_key_set=bool(config.llm_api_key),
    )


@router.put("", response_model=SystemConfigRead)
def update_config(
    payload: SystemConfigUpdate, session: Session = Depends(get_session)
) -> SystemConfigRead:
    config = session.exec(select(SystemConfig)).first()
    if not config:
        raise HTTPException(status_code=500, detail="System configuration missing")

    data = payload.model_dump(exclude_unset=True)
    llm_key = data.pop("llm_api_key", None)

    for key, value in data.items():
        setattr(config, key, value)

    if llm_key is not None:
        config.llm_api_key = llm_key

    config.mark_updated()
    session.add(config)
    session.commit()
    session.refresh(config)

    return SystemConfigRead(
        default_dimension=config.default_dimension,
        match_threshold=config.match_threshold,
        matcher_backend=config.matcher_backend,
        embedding_model=config.embedding_model,
        llm_model=config.llm_model,
        llm_api_base=config.llm_api_base,
        top_k=config.top_k,
        llm_api_key_set=bool(config.llm_api_key),
    )
