---
description: Review ranked semantic match suggestions and approve raw values into canonical mappings.
---

# Suggestions

<p class="rdh-eyebrow">Quality Control</p>

The Suggestions workspace is the human-in-the-loop core of RefData Hub. It
lists every unmatched raw value the matcher could not confidently resolve, ranks
candidates for each one, and lets you approve a mapping in a single action.

## The review loop

<div class="rdh-panel rdh-panel--accent" markdown>

1. Pick a **source connection** — suggestions are scoped per connection.
2. Work down the list of unmatched values. Each shows a **Needs review** badge.
3. Either click a ranked suggestion (`Married (0.92)`) to accept it, or use
   **Link to canonical** to choose manually.
4. The manual dropdown is filtered to your `ref_dimension`, so you only see
   candidates that are actually valid for this column.

</div>

The manual picker being dimension-filtered matters: it is the safety rail that
stops an approver from creating a mapping into a dimension that does not own the
column.

## What drives the ranking

Candidates come from `GET /api/source/connections/{id}/unmatched`, and each
unmatched value carries its own suggestion list:

```json
{
  "raw_value": "M",
  "occurrence_count": 412,
  "suggestions": [
    {
      "canonical_id": 1,
      "canonical_label": "Married",
      "dimension": "marital_status",
      "score": 0.88
    }
  ]
}
```

The scorer combines, in order of the configured pipeline:

1. **Semantic embeddings** — a sentence-transformer model (default
   `BAAI/bge-small-en-v1.5`) encodes the raw text and each canonical label, then
   ranks by cosine similarity.
2. **Lexical fallback** — if embeddings are unavailable, a token-overlap score
   keeps the queue populated rather than failing closed.
3. **LLM re-ranking** — when `llm_escalation` is on, near-tied embedding
   candidates are escalated to an online or offline LLM for a tiebreak.

The full pipeline is described in
[Architecture → Semantic matching](architecture.md#semantic-matching-workflow).

## Approving a suggestion

Each action creates a value mapping:

```bash
curl -X POST http://localhost:8000/api/source/connections/1/value-mappings \
  -H 'Content-Type: application/json' \
  -d '{
        "source_table": "employees",
        "source_field": "marital_status",
        "raw_value": "M",
        "canonical_id": 1,
        "status": "approved",
        "confidence": 0.88
      }'
```

| Field | Notes |
| --- | --- |
| `raw_value` | Must match the source value exactly |
| `canonical_id` | The `canonicalvalue.id` you are approving into |
| `status` | Defaults to `"approved"` |
| `confidence` | `0.0`–`1.0`. Persist the score you were shown so the decision is auditable. |
| `suggested_label` | Optional snapshot of what the matcher proposed |
| `notes` | Optional reviewer rationale |

Mappings are upserted on `(connection, table, field, raw_value)`, so approving
the same raw value twice updates the existing row rather than creating a
conflict. That also makes corrections cheap: re-approve with a different
`canonical_id` and the mapping is repointed, with the change recorded in
[Mapping History](mapping-history.md).

## When no suggestion is good enough

If the top candidate is wrong, the correct value probably does not exist yet in
the canonical library. Add it first, then come back:

<div class="rdh-steps" markdown>

1. **Check for a near-miss first.** Sometimes the right answer exists as a
   synonym. Search the canonical library for the concept before creating
   anything new.
2. **Add the missing canonical value** under the correct dimension, with a
   description that names the raw spellings it covers.
3. **Return and link manually** via **Link to canonical**. The new value is now
   in the filtered dropdown.
4. **Fix the underlying gap.** If you needed a new canonical value, other
   sources will need it too. Note the raw spellings in the description so the
   matcher generalises next time.

</div>

!!! warning "Approving is not reversible by deletion alone"
    A value mapping affects every downstream consumer of that column. Prefer
    correcting the mapping to deleting it — deletion drops the audit trail that
    explains why the column looks the way it does.

## Bulk clearing a queue

For large backlogs, export, edit, and re-import rather than clicking through:

<div class="grid cards" markdown>

-   :material-download: **Export mappings**

    ---

    CSV or XLSX of every value mapping, for offline review.

    [:octicons-arrow-right-24: Mapping History](mapping-history.md)

-   :material-chart-line: **Match Insights**

    ---

    Confirm the queue is shrinking and see coverage by field.

    [:octicons-arrow-right-24: Track coverage](match-insights.md)

</div>