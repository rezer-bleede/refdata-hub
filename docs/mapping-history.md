---
description: Audit approved raw-to-canonical mappings, correct decisions, and round-trip value mappings through CSV and XLSX.
---

# Mapping History

<p class="rdh-eyebrow">Quality Control</p>

Mapping History is the audit trail and the bulk-edit surface. Every approved,
corrected, or reverted raw-to-canonical mapping lives here, with the confidence
that was recorded at approval time.

## The expanded view

The page reads `GET /api/source/value-mappings`, which returns
`ValueMappingExpanded` — a value mapping joined with its canonical label and
dimension:

```json
{
  "id": 42,
  "source_connection_id": 1,
  "source_table": "employees",
  "source_field": "marital_status",
  "raw_value": "M",
  "canonical_id": 1,
  "canonical_label": "Married",
  "ref_dimension": "marital_status",
  "status": "approved",
  "confidence": 0.88,
  "suggested_label": "Married",
  "notes": "Standard HR abbreviation",
  "created_at": "2026-02-11T09:14:22Z",
  "updated_at": "2026-02-11T09:14:22Z"
}
```

The connection filter narrows to a single source, or shows all of them at once.

!!! info "`suggested_label` is a snapshot"
    It records what the matcher proposed at the time, even if you approved a
    different target. When you later wonder why a reviewer rejected the obvious
    suggestion, that column is the evidence.

## Correcting a mapping

Corrections go through `PUT`, not `DELETE` followed by re-create. Repointing
keeps the row, updates `updated_at`, and preserves the audit context:

```bash
curl -X PUT http://localhost:8000/api/source/connections/1/value-mappings/42 \
  -H 'Content-Type: application/json' \
  -d '{"canonical_id": 3, "notes": "Reclassified as never-married per HR policy", "confidence": 0.41}'
```

Every field is optional — omitted keys are left untouched, so you can update
just the note without resending the whole record.

## Bulk round-trip

### Export

```bash
# CSV for a specific connection
curl "http://localhost:8000/api/source/value-mappings/export?format=csv&connection_id=1" -o mappings.csv

# XLSX across all connections
curl "http://localhost:8000/api/source/value-mappings/export?format=xlsx" -o mappings.xlsx
```

The UI's **Export CSV** / **Export XLSX** buttons call these and save the blob
client-side.

### Import

```bash
curl -X POST "http://localhost:8000/api/source/value-mappings/import?connection_id=1" \
  -F 'file=@mappings.csv'
```

`connection_id` is optional — omit it to import across all connections, in which
case the connection must be identifiable from the file itself.

The response is a `ValueMappingImportResult`:

```json
{
  "created": 128,
  "updated": 34,
  "errors": ["Row 91: canonical_id 999 not found"]
}
```

!!! warning "Import is upsert, not append"
    Rows are matched on `(connection, table, field, raw_value)`. Re-importing a
    file you already imported updates rather than duplicates — which is what
    makes the export → edit → import loop safe.

    Read `errors` before you close the tab. A partial import is a common source
    of "why is coverage lower than expected".

## Recommended bulk workflow

<div class="rdh-steps" markdown>

1. **Export** the mappings you want to review as CSV.
2. **Filter locally** — by dimension, by low `confidence`, or by `raw_value`
   pattern — to isolate the rows you actually need to judge.
3. **Edit in a spreadsheet**, keeping `canonical_id` values you got from
   `GET /api/reference/canonical`.
4. **Re-import** and check `created` / `updated` / `errors` in the response.
5. **Re-check Match Insights** to confirm coverage moved in the expected
   direction.

</div>

!!! tip "Low `confidence` is the highest-yield filter"
    Sorting ascending by `confidence` surfaces the mappings most likely to be
    wrong. Every value approved at `0.0`–`0.3` deserves a second look, and
    those above `0.9` rarely do.

## Deleting

`DELETE /api/source/connections/{id}/value-mappings/{mapping_id}` returns `204`.
Prefer correcting over deleting where you can — a deleted mapping looks
identical to a raw value that was never mapped, so it silently reintroduces the
problem into the Suggestions queue without explanation.

## Related

<div class="grid cards" markdown>

-   :material-lightbulb: **Suggestions**

    ---

    Where unapproved values enter the pipeline.

    [:octicons-arrow-right-24: Review suggestions](suggestions.md)

-   :material-chart-line: **Match Insights**

    ---

    Confirm your bulk edit actually improved coverage.

    [:octicons-arrow-right-24: Check coverage](match-insights.md)

</div>