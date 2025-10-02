"""Database models for the RefData Hub."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Optional

from sqlalchemy import Column, JSON, UniqueConstraint
from sqlmodel import Field, SQLModel


class CanonicalValue(SQLModel, table=True):
    """Canonical representation of a reference data value."""

    id: Optional[int] = Field(default=None, primary_key=True)
    dimension: str = Field(index=True, description="Semantic domain of the value.")
    canonical_label: str = Field(description="Normalized label reviewers have approved.")
    description: Optional[str] = Field(default=None, description="Additional reviewer notes.")
    attributes: dict[str, Any] = Field(
        default_factory=dict,
        sa_column=Column(JSON, nullable=False, server_default="{}"),
        description="Dimension-specific attributes captured for this canonical value.",
    )
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc), nullable=False
    )


class RawValue(SQLModel, table=True):
    """Raw values awaiting review."""

    id: Optional[int] = Field(default=None, primary_key=True)
    dimension: str = Field(index=True)
    raw_text: str = Field(description="Unstandardized text received from source systems.")
    status: str = Field(default="pending", index=True)
    proposed_canonical_id: Optional[int] = Field(
        default=None,
        foreign_key="canonicalvalue.id",
        description="Suggested canonical match identifier.",
    )
    notes: Optional[str] = None
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc), nullable=False
    )


class SystemConfig(SQLModel, table=True):
    """Single row table containing reviewer-configurable knobs."""

    id: Optional[int] = Field(default=None, primary_key=True)
    default_dimension: str = Field(default="general")
    match_threshold: float = Field(default=0.6)
    matcher_backend: str = Field(default="embedding")
    embedding_model: str = Field(default="tfidf")
    llm_model: Optional[str] = Field(default="gpt-3.5-turbo")
    llm_api_base: Optional[str] = None
    llm_api_key: Optional[str] = Field(default=None, description="Stored securely in the database.")
    top_k: int = Field(default=5)
    updated_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc), nullable=False
    )

    def mark_updated(self) -> None:
        """Update the timestamp when settings change."""

        self.updated_at = datetime.now(timezone.utc)


class SourceConnection(SQLModel, table=True):
    """Connection metadata for external source systems."""

    id: Optional[int] = Field(default=None, primary_key=True)
    name: str = Field(
        index=True,
        description="Human readable name for the connection.",
        sa_column_kwargs={"unique": True},
    )
    db_type: str = Field(
        description="Database technology (postgres, mysql, snowflake, etc.)."
    )
    host: str = Field(description="Hostname or address of the database server.")
    port: int = Field(default=5432, description="Database port number.")
    database: str = Field(description="Database or schema name.")
    username: str = Field(description="Service account username.")
    password: Optional[str] = Field(
        default=None,
        description="Optional credential stored securely in the database.",
    )
    options: Optional[str] = Field(
        default=None,
        description="JSON encoded optional parameters (SSL mode, warehouse, etc.).",
    )
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc), nullable=False
    )
    updated_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc), nullable=False
    )

    def touch(self) -> None:
        """Update the modification timestamp."""

        self.updated_at = datetime.now(timezone.utc)


class SourceFieldMapping(SQLModel, table=True):
    """Mapping metadata between source fields and canonical dimensions."""

    id: Optional[int] = Field(default=None, primary_key=True)
    source_connection_id: int = Field(
        foreign_key="sourceconnection.id", index=True, nullable=False
    )
    source_table: str = Field(description="Table or collection containing the field.")
    source_field: str = Field(description="Column name within the source table.")
    ref_dimension: str = Field(
        description="Canonical reference dimension the field harmonizes to."
    )
    description: Optional[str] = Field(default=None)
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc), nullable=False
    )
    updated_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc), nullable=False
    )

    def touch(self) -> None:
        """Update the modification timestamp."""

        self.updated_at = datetime.now(timezone.utc)


class SourceSample(SQLModel, table=True):
    """Aggregated samples for raw values sourced from external systems."""

    id: Optional[int] = Field(default=None, primary_key=True)
    source_connection_id: int = Field(
        foreign_key="sourceconnection.id", index=True, nullable=False
    )
    source_table: str = Field(index=True)
    source_field: str = Field(index=True)
    dimension: Optional[str] = Field(
        default=None,
        description="Optional dimension hint captured with the sample.",
    )
    raw_value: str = Field(description="Observed raw value.")
    occurrence_count: int = Field(default=1, ge=0)
    last_seen_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc), nullable=False
    )


class ValueMapping(SQLModel, table=True):
    """Approved mappings from raw source values to canonical entries."""

    id: Optional[int] = Field(default=None, primary_key=True)
    source_connection_id: int = Field(
        foreign_key="sourceconnection.id", index=True, nullable=False
    )
    source_table: str = Field(index=True)
    source_field: str = Field(index=True)
    raw_value: str = Field(index=True)
    canonical_id: int = Field(
        foreign_key="canonicalvalue.id", description="Mapped canonical value identifier."
    )
    status: str = Field(default="approved", index=True)
    confidence: Optional[float] = Field(
        default=None, description="Confidence score captured at approval time."
    )
    suggested_label: Optional[str] = Field(default=None)
    notes: Optional[str] = Field(default=None)
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc), nullable=False
    )
    updated_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc), nullable=False
    )

    def touch(self) -> None:
        """Update modification timestamp."""

        self.updated_at = datetime.now(timezone.utc)


class Dimension(SQLModel, table=True):
    """Describes a canonical dimension and its dynamic attribute schema."""

    id: Optional[int] = Field(default=None, primary_key=True)
    code: str = Field(
        index=True,
        description="Unique identifier used by canonical values and mappings.",
        sa_column_kwargs={"unique": True},
    )
    label: str = Field(description="Human readable name for the dimension.")
    description: Optional[str] = Field(default=None)
    extra_schema: list[dict[str, Any]] = Field(
        default_factory=list,
        sa_column=Column(JSON, nullable=False, server_default="[]"),
        description="JSON schema describing additional fields captured per canonical value.",
    )
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc), nullable=False
    )
    updated_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc), nullable=False
    )

    def touch(self) -> None:
        """Update modification timestamp."""

        self.updated_at = datetime.now(timezone.utc)


class DimensionRelation(SQLModel, table=True):
    """Represents a hierarchical link between two dimensions."""

    __table_args__ = (
        UniqueConstraint(
            "parent_dimension_code",
            "child_dimension_code",
            "label",
            name="uq_relation_parent_child_label",
        ),
    )

    id: Optional[int] = Field(default=None, primary_key=True)
    label: str = Field(description="Display name describing the relation.")
    parent_dimension_code: str = Field(
        index=True, foreign_key="dimension.code", description="Parent dimension code."
    )
    child_dimension_code: str = Field(
        index=True, foreign_key="dimension.code", description="Child dimension code."
    )
    description: Optional[str] = Field(default=None)
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc), nullable=False
    )
    updated_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc), nullable=False
    )

    def touch(self) -> None:
        """Update modification timestamp."""

        self.updated_at = datetime.now(timezone.utc)


class DimensionRelationLink(SQLModel, table=True):
    """Associates canonical values across a dimension relation."""

    __table_args__ = (
        UniqueConstraint(
            "relation_id",
            "parent_canonical_id",
            "child_canonical_id",
            name="uq_relation_link_parent_child",
        ),
    )

    id: Optional[int] = Field(default=None, primary_key=True)
    relation_id: int = Field(
        foreign_key="dimensionrelation.id", index=True, nullable=False
    )
    parent_canonical_id: int = Field(
        foreign_key="canonicalvalue.id", index=True, nullable=False
    )
    child_canonical_id: int = Field(
        foreign_key="canonicalvalue.id", index=True, nullable=False
    )
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc), nullable=False
    )
    updated_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc), nullable=False
    )

    def touch(self) -> None:
        """Update modification timestamp."""

        self.updated_at = datetime.now(timezone.utc)
