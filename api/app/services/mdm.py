"""Core validation and survivorship logic for master data management."""

from __future__ import annotations

import json
import re
from datetime import datetime, timezone
from typing import Any

from sqlmodel import Session, select

from ..matcher import SemanticMatcher
from ..models import (
    CanonicalValue,
    MasterEntity,
    MasterRecord,
    MergeHistory,
    RecordLink,
    SourceRecord,
    SystemConfig,
)


class MDMError(ValueError):
    """Invalid MDM operation or configuration."""


class MDMConflict(MDMError):
    """An operation conflicts with current master-record state."""


def validate_entity_config(data: dict[str, Any]) -> None:
    fields = data.get("attribute_schema") or []
    keys: set[str] = set()
    for field in fields:
        key = field.get("key")
        data_type = field.get("data_type", "string")
        if not isinstance(key, str) or not re.fullmatch(r"[A-Za-z_][A-Za-z0-9_]*", key):
            raise MDMError("Attribute keys must be valid identifiers.")
        if key in keys:
            raise MDMError(f"Duplicate attribute key '{key}'.")
        if data_type not in {"string", "number", "boolean", "date", "object"}:
            raise MDMError(f"Unsupported data type for '{key}'.")
        keys.add(key)

    match_fields = data.get("match_fields") or []
    if len(set(match_fields)) != len(match_fields):
        raise MDMError("Match fields must be unique.")
    unknown_matches = set(match_fields) - keys
    if unknown_matches:
        raise MDMError(f"Unknown match fields: {', '.join(sorted(unknown_matches))}.")

    rules = data.get("quality_rules") or []
    for rule in rules:
        key = rule.get("key")
        rule_type = rule.get("type")
        if key not in keys:
            raise MDMError(f"Quality rule references unknown attribute '{key}'.")
        if rule_type not in {"required", "pattern", "min", "max", "enum"}:
            raise MDMError(f"Unsupported quality rule for '{key}'.")
        if rule_type == "pattern":
            try:
                re.compile(str(rule.get("value", "")))
            except re.error as exc:
                raise MDMError(f"Invalid pattern for '{key}': {exc}.") from exc
        if rule_type in {"min", "max"} and not isinstance(rule.get("value"), (int, float)):
            raise MDMError(f"The {rule_type} rule for '{key}' needs a number.")
        if rule_type == "enum" and not isinstance(rule.get("values"), list):
            raise MDMError(f"The enum rule for '{key}' needs a values list.")

    unknown_rule_fields = set(data.get("survivorship_rules") or {}) - keys
    if unknown_rule_fields:
        raise MDMError(
            f"Survivorship rules reference unknown attributes: {', '.join(sorted(unknown_rule_fields))}."
        )


def validate_attributes(entity: MasterEntity, attributes: dict[str, Any]) -> None:
    fields = {field["key"]: field for field in entity.attribute_schema}
    unknown = set(attributes) - set(fields)
    if unknown:
        raise MDMError(f"Unknown attributes: {', '.join(sorted(unknown))}.")

    for key, value in attributes.items():
        if value is None:
            continue
        data_type = fields[key].get("data_type", "string")
        valid = {
            "string": lambda item: isinstance(item, str),
            "number": lambda item: isinstance(item, (int, float)) and not isinstance(item, bool),
            "boolean": lambda item: isinstance(item, bool),
            "date": lambda item: isinstance(item, str) and _is_date(item),
            "object": lambda item: isinstance(item, (dict, list)),
        }[data_type](value)
        if not valid:
            raise MDMError(f"Attribute '{key}' must be {data_type}.")


def _is_date(value: str) -> bool:
    try:
        datetime.fromisoformat(value.replace("Z", "+00:00"))
        return True
    except ValueError:
        return False


def quality_violations(entity: MasterEntity, attributes: dict[str, Any]) -> list[str]:
    violations: list[str] = []
    for field in entity.attribute_schema:
        key = field["key"]
        if field.get("required") and attributes.get(key) in (None, ""):
            violations.append(f"{key}: required (schema)")

    for rule in entity.quality_rules:
        key = rule["key"]
        value = attributes.get(key)
        kind = rule["type"]
        failed = False
        if kind == "required":
            failed = value in (None, "")
        elif value is not None and kind == "pattern":
            failed = not re.fullmatch(str(rule.get("value", "")), str(value))
        elif value is not None and kind == "min":
            failed = not isinstance(value, (int, float)) or value < rule["value"]
        elif value is not None and kind == "max":
            failed = not isinstance(value, (int, float)) or value > rule["value"]
        elif value is not None and kind == "enum":
            failed = value not in rule["values"]
        if failed:
            violations.append(f"{key}: {kind}")
    return violations


def quality_score(entity: MasterEntity, attributes: dict[str, Any]) -> tuple[float, list[str]]:
    violations = quality_violations(entity, attributes)
    rule_count = sum(bool(field.get("required")) for field in entity.attribute_schema)
    rule_count += len(entity.quality_rules)
    return (1.0 if rule_count == 0 else round(max(0, 1 - len(violations) / rule_count), 4), violations)


def record_match_text(entity: MasterEntity, attributes: dict[str, Any]) -> str:
    return " ; ".join(
        f"{key}: {json.dumps(attributes[key], ensure_ascii=False, sort_keys=True)}"
        for key in entity.match_fields
        if attributes.get(key) not in (None, "")
    )


def rank_master_records(
    config: SystemConfig,
    entity: MasterEntity,
    source_attributes: dict[str, Any],
    records: list[MasterRecord],
) -> list[tuple[MasterRecord, float]]:
    """Reuse the configured value matcher for entity-level match fields."""

    candidates = [record for record in records if record_match_text(entity, record.attributes)]
    matcher_values = [
        CanonicalValue(
            id=record.id,
            dimension=entity.code,
            canonical_label=record_match_text(entity, record.attributes),
        )
        for record in candidates
    ]
    by_id = {record.id: record for record in candidates}
    return [
        (by_id[match.canonical_id], match.score)
        for match in SemanticMatcher(config, matcher_values).rank(
            record_match_text(entity, source_attributes)
        )
        if match.canonical_id in by_id
    ]


def merge_records(session: Session, loser: MasterRecord, survivor: MasterRecord, entity: MasterEntity) -> dict[str, Any]:
    if loser.id == survivor.id:
        raise MDMError("A record cannot be merged into itself.")
    if loser.entity_code != survivor.entity_code or loser.entity_code != entity.code:
        raise MDMError("Records must belong to the same entity type.")
    if loser.status != "active" or survivor.status != "active":
        raise MDMConflict("Only active records can be merged.")
    if session.exec(
        select(MasterRecord).where(MasterRecord.merged_into_id == loser.id)
    ).first():
        raise MDMConflict("Unmerge child records before merging this record.")

    rules = entity.survivorship_rules or {}
    loser_sources = session.exec(
        select(SourceRecord).where(SourceRecord.master_record_id == loser.id)
    ).all()
    survivor_sources = session.exec(
        select(SourceRecord).where(SourceRecord.master_record_id == survivor.id)
    ).all()
    loser_priority = max((row.source_priority for row in loser_sources), default=0)
    survivor_priority = max((row.source_priority for row in survivor_sources), default=0)
    loser_newest = max((_timestamp(row.source_updated_at) for row in loser_sources), default=0)
    survivor_newest = max((_timestamp(row.source_updated_at) for row in survivor_sources), default=0)

    before = dict(survivor.attributes)
    merged = dict(before)
    keys = set(loser.attributes) | set(survivor.attributes)
    used: dict[str, str] = {}
    for key in keys:
        strategy = rules.get(key, "master_wins")
        existing = survivor.attributes.get(key)
        incoming = loser.attributes.get(key)
        use_incoming = False
        if strategy == "incoming_wins":
            use_incoming = incoming not in (None, "")
        elif strategy == "fill_nulls":
            use_incoming = existing in (None, "") and incoming not in (None, "")
        elif strategy == "source_priority":
            use_incoming = loser_priority > survivor_priority and incoming not in (None, "")
        elif strategy == "newest":
            use_incoming = loser_newest > survivor_newest and incoming not in (None, "")
        else:
            use_incoming = existing in (None, "") and incoming not in (None, "")
        if use_incoming:
            merged[key] = incoming
        used[key] = strategy

    validate_attributes(entity, merged)
    source_ids = [row.id for row in loser_sources if row.id is not None]
    survivor.attributes = merged
    survivor.version += 1
    survivor.updated_at = datetime.now(timezone.utc)
    loser.status = "merged"
    loser.merged_into_id = survivor.id
    loser.version += 1
    loser.updated_at = datetime.now(timezone.utc)
    for row in loser_sources:
        row.master_record_id = survivor.id
        row.updated_at = datetime.now(timezone.utc)
    session.add(survivor)
    session.add(loser)
    session.add_all(loser_sources)

    history = MergeHistory(
        survivor_id=survivor.id or 0,
        merged_record_id=loser.id or 0,
        survivor_before=before,
        survivor_after=merged,
        source_record_ids=source_ids,
        survivorship_used=used,
        survivor_version_after=survivor.version,
    )
    session.add(history)
    session.commit()
    session.refresh(survivor)
    return {"survivor": survivor, "merged_record": loser, "history": history, "rules": used}


def unmerge_record(
    session: Session,
    history: MergeHistory,
    loser: MasterRecord,
    survivor: MasterRecord,
) -> None:
    if loser.status != "merged" or loser.merged_into_id != survivor.id:
        raise MDMConflict("The record is not currently merged into this survivor.")
    if survivor.status != "active":
        raise MDMConflict("Unmerge the survivor from any later merge first.")
    if survivor.version != history.survivor_version_after or survivor.attributes != history.survivor_after:
        raise MDMConflict("The survivor changed after this merge; restore it manually before unmerging.")

    survivor.attributes = history.survivor_before
    survivor.version += 1
    survivor.updated_at = datetime.now(timezone.utc)
    loser.status = "active"
    loser.merged_into_id = None
    loser.version += 1
    loser.updated_at = datetime.now(timezone.utc)
    if history.source_record_ids:
        source_records = session.exec(
            select(SourceRecord).where(SourceRecord.id.in_(history.source_record_ids))
        ).all()
        for row in source_records:
            row.master_record_id = loser.id
            row.updated_at = datetime.now(timezone.utc)
        session.add_all(source_records)
    history.unmerged_at = datetime.now(timezone.utc)
    session.add_all([survivor, loser, history])
    session.commit()


def _timestamp(value: datetime | None) -> float:
    if value is None:
        return 0
    if value.tzinfo is None:
        value = value.replace(tzinfo=timezone.utc)
    return value.timestamp()


def add_record_link(session: Session, parent: MasterRecord, child: MasterRecord, relation_type: str) -> RecordLink:
    if parent.id == child.id:
        raise MDMError("A record cannot be its own parent.")
    if parent.entity_code != child.entity_code:
        raise MDMError("Parent and child records must have the same entity type.")
    if parent.status != "active" or child.status != "active":
        raise MDMError("Hierarchy links can only reference active records.")

    if session.exec(
        select(RecordLink).where(
            RecordLink.parent_id == parent.id,
            RecordLink.child_id == child.id,
            RecordLink.relation_type == relation_type,
        )
    ).first():
        raise MDMConflict("This hierarchy link already exists.")

    # ponytail: O(n) adjacency scan is enough for current record volumes; add a closure table if hierarchy size demands it.
    links = session.exec(select(RecordLink)).all()
    children: dict[int, list[int]] = {}
    for link in links:
        children.setdefault(link.parent_id, []).append(link.child_id)
    pending = [child.id]
    visited: set[int] = set()
    while pending:
        current = pending.pop()
        if current == parent.id:
            raise MDMError("This link would create a hierarchy cycle.")
        if current not in visited:
            visited.add(current)
            pending.extend(children.get(current, []))

    link = RecordLink(parent_id=parent.id or 0, child_id=child.id or 0, relation_type=relation_type)
    session.add(link)
    session.commit()
    session.refresh(link)
    return link
