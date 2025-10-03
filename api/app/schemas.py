"""Pydantic schemas for API payloads."""

from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field, ConfigDict


class CanonicalValueBase(BaseModel):
    dimension: str
    canonical_label: str
    description: Optional[str] = None
    attributes: dict[str, Any] | None = None


class CanonicalValueCreate(CanonicalValueBase):
    pass


class CanonicalValueRead(CanonicalValueBase):
    id: int

    model_config = ConfigDict(from_attributes=True)


class CanonicalValueUpdate(BaseModel):
    dimension: Optional[str] = None
    canonical_label: Optional[str] = None
    description: Optional[str] = None
    attributes: Optional[dict[str, Any]] = None


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


class SourceConnectionBase(BaseModel):
    name: str
    db_type: str
    host: str
    port: int = 5432
    database: str
    username: str
    options: Optional[str] = None


class SourceConnectionCreate(SourceConnectionBase):
    password: Optional[str] = Field(default=None, min_length=1)


class SourceConnectionRead(SourceConnectionBase):
    id: int
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class SourceConnectionUpdate(BaseModel):
    name: Optional[str] = None
    db_type: Optional[str] = None
    host: Optional[str] = None
    port: Optional[int] = Field(default=None, ge=1, le=65535)
    database: Optional[str] = None
    username: Optional[str] = None
    password: Optional[str] = Field(default=None, min_length=1)
    options: Optional[str] = None


class SourceFieldMappingBase(BaseModel):
    source_table: str
    source_field: str
    ref_dimension: str
    description: Optional[str] = None


class SourceFieldMappingCreate(SourceFieldMappingBase):
    pass


class SourceFieldMappingRead(SourceFieldMappingBase):
    id: int
    source_connection_id: int
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class SourceFieldMappingUpdate(BaseModel):
    source_table: Optional[str] = None
    source_field: Optional[str] = None
    ref_dimension: Optional[str] = None
    description: Optional[str] = None


class SourceSampleValue(BaseModel):
    raw_value: str
    occurrence_count: int = Field(default=1, ge=0)
    dimension: Optional[str] = None


class SourceSampleIngestRequest(BaseModel):
    source_table: str
    source_field: str
    values: List[SourceSampleValue]


class SourceSampleRead(BaseModel):
    id: int
    source_connection_id: int
    source_table: str
    source_field: str
    dimension: Optional[str]
    raw_value: str
    occurrence_count: int
    last_seen_at: datetime

    model_config = ConfigDict(from_attributes=True)


class UnmatchedValuePreview(BaseModel):
    raw_value: str
    occurrence_count: int
    suggestions: List[MatchCandidate]


class UnmatchedValueRecord(UnmatchedValuePreview):
    mapping_id: int
    source_table: str
    source_field: str
    ref_dimension: str


class FieldMatchStats(BaseModel):
    mapping_id: int
    source_table: str
    source_field: str
    ref_dimension: str
    total_values: int
    matched_values: int
    unmatched_values: int
    match_rate: float
    top_unmatched: List[UnmatchedValuePreview]


class ValueMappingBase(BaseModel):
    source_table: str
    source_field: str
    raw_value: str
    canonical_id: int
    status: Optional[str] = Field(default="approved")
    confidence: Optional[float] = Field(default=None, ge=0.0, le=1.0)
    suggested_label: Optional[str] = None
    notes: Optional[str] = None


class ValueMappingCreate(ValueMappingBase):
    pass


class ValueMappingRead(ValueMappingBase):
    id: int
    source_connection_id: int
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ValueMappingUpdate(BaseModel):
    source_table: Optional[str] = None
    source_field: Optional[str] = None
    raw_value: Optional[str] = None
    canonical_id: Optional[int] = None
    status: Optional[str] = None
    confidence: Optional[float] = Field(default=None, ge=0.0, le=1.0)
    suggested_label: Optional[str] = None
    notes: Optional[str] = None


class ValueMappingExpanded(ValueMappingRead):
    canonical_label: str
    ref_dimension: str


class DimensionExtraFieldDefinition(BaseModel):
    key: str = Field(..., min_length=1)
    label: str = Field(..., min_length=1)
    description: Optional[str] = None
    data_type: str = Field(..., pattern="^(string|number|boolean)$")
    required: bool = False


class DimensionBase(BaseModel):
    code: str = Field(..., min_length=1)
    label: str = Field(..., min_length=1)
    description: Optional[str] = None
    extra_fields: List[DimensionExtraFieldDefinition] = Field(default_factory=list)


class DimensionCreate(DimensionBase):
    pass


class DimensionUpdate(BaseModel):
    label: Optional[str] = None
    description: Optional[str] = None
    extra_fields: Optional[List[DimensionExtraFieldDefinition]] = None


class DimensionRead(DimensionBase):
    id: int
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class DimensionRelationBase(BaseModel):
    label: str
    parent_dimension_code: str
    child_dimension_code: str
    description: Optional[str] = None


class DimensionRelationCreate(DimensionRelationBase):
    pass


class DimensionRelationUpdate(BaseModel):
    label: Optional[str] = None
    description: Optional[str] = None


class DimensionRelationRead(DimensionRelationBase):
    id: int
    parent_dimension: DimensionRead
    child_dimension: DimensionRead
    link_count: int
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class DimensionRelationLinkBase(BaseModel):
    parent_canonical_id: int
    child_canonical_id: int


class DimensionRelationLinkCreate(DimensionRelationLinkBase):
    pass


class DimensionRelationLinkRead(DimensionRelationLinkBase):
    id: int
    relation_id: int
    parent_label: str
    child_label: str
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ProposedDimension(BaseModel):
    code: str
    label: str


class BulkImportPreviewColumn(BaseModel):
    name: str
    sample: List[str]
    suggested_role: Optional[str] = None
    suggested_attribute_key: Optional[str] = None
    suggested_dimension: Optional[str] = None


class BulkImportPreview(BaseModel):
    columns: List[BulkImportPreviewColumn]
    suggested_dimension: Optional[str] = None
    proposed_dimension: Optional[ProposedDimension] = None


class BulkImportColumnMapping(BaseModel):
    label: Optional[str] = None
    dimension: Optional[str] = None
    description: Optional[str] = None
    attributes: Dict[str, str] = Field(default_factory=dict)
    default_dimension: Optional[str] = None
    dimension_definition: Optional[DimensionCreate] = None


class BulkImportResult(BaseModel):
    created: List[CanonicalValueRead]
    errors: List[str]
