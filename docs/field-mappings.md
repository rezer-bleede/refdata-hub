---
description: Bind upstream columns to canonical dimensions, capture live samples, and measure resulting match coverage.
---

# Field Mappings

<p class="rdh-eyebrow">Integration</p>

A field mapping is the instruction *"values in this source column belong to
this canonical dimension"*. Without one, RefData Hub has no way to know that
`employees.marital_status` should be matched against the `marital_status`
dimension, and therefore no way to score it.

Field mappings are scoped to a connection. Every endpoint below is nested under
`/api/source/connections/{connection_id}/`.

## The record

```json
{
  "source_table": "employees",
  "source_field": "marital_status",
  "ref_dimension": "marital_status",
  "description": "HR feed, refreshed nightly"
}
```

| Field | Meaning |
| --- | --- |
| `source_table` | Table or view name as it appears in the source catalog |
| `source_field` | Column name |
| `ref_dimension` | Dimension **code** — must match `dimension.code`, not its label |
| `description` | Free text for reviewer context |

!!! tip "`ref_dimension` takes a code, not a label"
    The dimension picker in the UI fills in the code. If you call the API
    directly, `ref_dimension: "Marital Status"` will create a mapping that never
    scores anything, because matching joins on `dimension.code`.

## Endpoints

| Method | Endpoint | Notes |
| --- | --- | --- |
| `GET` | `/api/source/connections/{id}/mappings` | Lists this connection's mappings |
| `POST` | `/api/source/connections/{id}/mappings` | Returns `201` |
| `PUT` | `/api/source/connections/{id}/mappings/{mapping_id}` | Partial update |
| `DELETE` | `/api/source/connections/{id}/mappings/{mapping_id}` | Returns `204` |

```bash
curl -X POST http://localhost:8000/api/source/connections/1/mappings \
  -H 'Content-Type: application/json' \
  -d '{"source_table": "employees", "source_field": "marital_status", "ref_dimension": "marital_status"}'
```

Like the Source Connections workspace, the Field Mappings page shows the
**existing mapping grid above** the creation form. The mappings are the
context for the decision you are about to make, so they stay in view.

## Capturing samples

Once a mapping exists, you can pull the distinct values straight out of the
upstream database:

```bash
curl -X POST http://localhost:8000/api/source/connections/1/mappings/7/capture \
  -H 'Content-Type: application/json'
```

`POST .../mappings/{mapping_id}/capture` returns `201` and writes the observed
values into `sourcesample` with an `occurrence_count` per distinct value. This
is how you get real data into the review queue without hand-copying values.

### Rapid ingestion without a live database

If you do not have upstream access — during modelling, or when testing the
review flow — post samples directly:

```bash
curl -X POST http://localhost:8000/api/source/connections/1/samples \
  -H 'Content-Type: application/json' \
  -d '{
        "source_table": "employees",
        "source_field": "marital_status",
        "values": [
          {"raw_value": "M", "occurrence_count": 412},
          {"raw_value": "Married", "occurrence_count": 2890},
          {"raw_value": "S", "occurrence_count": 377}
        ]
      }'
```

`occurrence_count` defaults to `1` and must be `>= 0`. Samples are upserted per
`(connection, table, field, raw_value)`, so re-posting the same value adds to
its count rather than duplicating the row. That is why repeated captures
collapse to distinct values with accurate totals.

Read them back with optional filters:

```bash
curl "http://localhost:8000/api/source/connections/1/samples?source_table=employees&source_field=marital_status"
```

## Why a mapping is not the same as a value mapping

This trips people up, so it is worth stating plainly:

| | Field mapping | Value mapping |
| --- | --- | --- |
| Answers | "Which dimension owns this column?" | "Does `M` equal `Married`?" |
| Granularity | One per column | One per distinct raw value |
| Table | `sourcefieldmapping` | `valuemapping` |
| Created by | You, deliberately | You, or by approving a suggestion |

A field mapping is the *scope*. Value mappings are the *content*. Match
statistics are computed per field mapping, because that is the unit you would
actually fix.

## Coverage reporting

```bash
curl http://localhost:8000/api/source/connections/1/match-stats
```

Each entry in the response is a `FieldMatchStats`:

```json
{
  "mapping_id": 7,
  "source_table": "employees",
  "source_field": "marital_status",
  "ref_dimension": "marital_status",
  "total_values": 3679,
  "matched_values": 3120,
  "unmatched_values": 559,
  "match_rate": 0.848,
  "top_unmatched": [ /* UnmatchedValuePreview[] */ ],
  "top_matched":   [ /* MatchedValuePreview[] */ ]
}
```

!!! info "Match rate is per mapping, not global"
    A mapping with no captured samples reports zero values and is filtered out
    of the dashboard rather than shown as a misleading `0/0`. If a field you
    expect to see is missing from Match Insights, it has no samples yet — go
    capture them.

## Next steps

<div class="grid cards" markdown>

-   :material-lightbulb: **Suggestions**

    ---

    Turn the unmatched values above into approved mappings.

    [:octicons-arrow-right-24: Triage unmatched values](suggestions.md)

-   :material-source-branch: **Source Connections**

    ---

    Need more columns? Go back and introspect the schema.

    [:octicons-arrow-right-24: Explore schemas](source-connections.md)

</div>