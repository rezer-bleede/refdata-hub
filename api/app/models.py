"""Database models for the RefData Hub."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional

from sqlmodel import Field, SQLModel


class CanonicalValue(SQLModel, table=True):
    """Canonical representation of a reference data value."""

    id: Optional[int] = Field(default=None, primary_key=True)
    dimension: str = Field(index=True, description="Semantic domain of the value.")
    canonical_label: str = Field(description="Normalized label reviewers have approved.")
    description: Optional[str] = Field(default=None, description="Additional reviewer notes.")
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
