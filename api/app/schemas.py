"""Pydantic schemas for API payloads."""

from __future__ import annotations

from typing import List, Optional

from pydantic import BaseModel, Field, ConfigDict


class CanonicalValueBase(BaseModel):
    dimension: str
    canonical_label: str
    description: Optional[str] = None


class CanonicalValueCreate(CanonicalValueBase):
    pass


class CanonicalValueRead(CanonicalValueBase):
    id: int

    model_config = ConfigDict(from_attributes=True)


class RawValueRead(BaseModel):
    id: int
    dimension: str
    raw_text: str
    status: str
    proposed_canonical_id: Optional[int] = None

    model_config = ConfigDict(from_attributes=True)


class MatchCandidate(BaseModel):
    canonical_id: int
    canonical_label: str
    dimension: str
    description: Optional[str] = None
    score: float = Field(ge=0.0, le=1.0)


class MatchRequest(BaseModel):
    raw_text: str = Field(..., min_length=1)
    dimension: Optional[str] = None


class MatchResponse(BaseModel):
    raw_text: str
    dimension: str
    matches: List[MatchCandidate]


class SystemConfigRead(BaseModel):
    default_dimension: str
    match_threshold: float
    matcher_backend: str
    embedding_model: str
    llm_model: Optional[str]
    llm_api_base: Optional[str]
    top_k: int
    llm_api_key_set: bool


class SystemConfigUpdate(BaseModel):
    default_dimension: Optional[str] = None
    match_threshold: Optional[float] = Field(default=None, ge=0.0, le=1.0)
    matcher_backend: Optional[str] = None
    embedding_model: Optional[str] = None
    llm_model: Optional[str] = None
    llm_api_base: Optional[str] = None
    top_k: Optional[int] = Field(default=None, ge=1, le=20)
    llm_api_key: Optional[str] = Field(default=None, min_length=4)
