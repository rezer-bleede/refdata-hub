# Master Data Management

The Master Data workspace governs entity-level records separately from the
existing value-level reference dimensions. Entity types are generic: configure
an attribute schema and reuse the same workflow for organizations, people,
products, locations, or other domains.

The application starts without entity types or golden records. Load them from
real sources or create them explicitly; synthetic records are reserved for
isolated tests and are never inserted into the runtime database.

## Capabilities

- **Entity configuration:** attributes and types, matching fields, candidate
  threshold, per-field survivorship strategy, and data-quality rules.
- **Golden records:** versioned records with JSON attributes validated against
  the configured schema. Required-field gaps remain visible as quality issues
  instead of blocking remediation workflows.
- **Source crosswalk:** idempotent push ingestion keyed by source connection,
  table, and source primary key. Ingest updates the source payload while keeping
  already-approved identity links intact.
- **Identity stewardship:** matcher and optional configured LLM rank active
  golden records. Suggestions and AI-agent proposals remain pending until an
  explicit human approval.
- **Merge and unmerge:** per-attribute survivorship (`master_wins`,
  `fill_nulls`, `incoming_wins`, `source_priority`, or `newest`) is recorded in
  merge history. An unmerge restores the pre-merge attributes and crosswalk
  ownership only if the survivor has not changed since the merge.
- **Hierarchy:** typed parent/child links are restricted to one entity type;
  cycle-forming links are rejected.
- **Quality:** required, pattern, minimum, maximum, and enum checks are computed
  on demand. The score is the fraction of configured checks that pass.

## Workflow

1. Add an entity type and configure its attribute schema and `match_fields`.
2. Register a source connection in **Source Connections**.
3. Push source records into `/api/mdm/source-records` with a stable `source_pk`.
4. Request match suggestions or run the advisory MDM agent.
5. Approve a candidate link, or create a new golden record; reject records that
   should not be mastered.
6. Review quality issues, link related records, and merge duplicates. Every
   merge stays reversible until the survivor is subsequently changed.

## Entity configuration example

This illustrative schema shows configuration shape only; it is not runtime data
and is not loaded into the application database.

```json
{
  "code": "organization",
  "label": "Organization",
  "attribute_schema": [
    {"key": "name", "label": "Legal name", "data_type": "string", "required": true},
    {"key": "domain", "label": "Website domain", "data_type": "string"},
    {"key": "employee_count", "label": "Employee count", "data_type": "number"}
  ],
  "match_fields": ["name", "domain"],
  "match_threshold": 0.95,
  "survivorship_rules": {"name": "source_priority", "domain": "fill_nulls"},
  "quality_rules": [
    {"key": "domain", "type": "pattern", "value": "[a-z0-9.-]+\\.[a-z]{2,}"},
    {"key": "employee_count", "type": "min", "value": 0}
  ]
}
```

`source_priority` compares the integer priority provided on ingested source
records. `newest` compares `source_updated_at`; ties retain the existing golden
record value. Similarity scores are rankings, not probabilities, and the
threshold is a governance setting rather than automatic approval.

## API

| Method | Endpoint | Purpose |
|---|---|---|
| GET / POST | `/api/mdm/entities` | List or create entity types |
| GET / PUT / DELETE | `/api/mdm/entities/{code}` | Read, update, or delete an unused type |
| GET / POST | `/api/mdm/records` | List or create golden records |
| PUT | `/api/mdm/records/{id}` | Update an active golden record |
| POST | `/api/mdm/source-records` | Idempotently ingest source identities |
| GET | `/api/mdm/source-records` | List crosswalk rows, optionally by entity/status |
| POST | `/api/mdm/source-records/{id}/suggestions` | Rank likely golden-record matches |
| POST | `/api/mdm/source-records/{id}/approve` | Approve a link or create a golden record |
| POST | `/api/mdm/source-records/{id}/reject` | Reject a pending crosswalk row |
| POST | `/api/mdm/records/{id}/merge` | Merge this record into a survivor |
| POST | `/api/mdm/records/{id}/unmerge` | Safely restore an audited merge |
| GET | `/api/mdm/records/{id}/history` | Read merge audit history |
| GET / POST | `/api/mdm/links` | List or create record hierarchy links |
| DELETE | `/api/mdm/links/{id}` | Remove a hierarchy link |
| GET | `/api/mdm/entities/{code}/quality` | Calculate quality summary and violations |
| GET / POST | `/api/agent/mdm/tools`, `/api/agent/mdm/harmonize` | Inspect/run advisory MDM agent tools |

Source ingestion accepts at most 1,000 rows per request. Live database polling,
downstream publishing, authentication/RBAC, and persisted quality snapshots are
not part of this module; source systems push their records through the API.

## Operational safety

- LLM and matcher results never write `master_record_id`; a reviewer must call
  the approve endpoint.
- Merge history snapshots the survivor and crosswalk IDs. Unmerge returns a
  conflict if the survivor has been edited, preventing silent data loss.
- Hierarchy cycle detection currently scans the in-memory edge set; a closure
  table is a future optimization if hierarchies become very large.
