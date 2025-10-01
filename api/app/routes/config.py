"""System configuration endpoints."""

from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlmodel import Session

from ..database import get_session
from ..schemas import SystemConfigRead, SystemConfigUpdate
from ..services.config import ensure_system_config, system_config_to_read

router = APIRouter(prefix="/config", tags=["config"])


@router.get("", response_model=SystemConfigRead)
def read_config(session: Session = Depends(get_session)) -> SystemConfigRead:
    config = ensure_system_config(session)
    return system_config_to_read(config)


@router.put("", response_model=SystemConfigRead)
def update_config(
    payload: SystemConfigUpdate, session: Session = Depends(get_session)
) -> SystemConfigRead:
    config = ensure_system_config(session)

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

    return system_config_to_read(config)
