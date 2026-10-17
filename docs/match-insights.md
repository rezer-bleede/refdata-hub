---
description: Measure harmonization coverage, inspect top matched and unmatched values, and monitor data quality per source field.
---

# Match Insights

<p class="rdh-eyebrow">Quality Control</p>

Match Insights answers one question: *how much of my reference data is actually
harmonized, and where is it failing?* It reports coverage per field mapping,
which is the unit you would realistically fix.

<figure class="rdh-figure">
  <img src="../screenshots/demo_match_insights.gif" alt="Match insights coverage reporting and human curation workflow">
  <figcaption>Match insights coverage reporting alongside the human curation workflow.</figcaption>
</figure>

## Reading the page

The page is driven by three API calls:

```bash
# 1. Connections, for the picker
curl http://localhost:8000/api/source/connections

# 2. Which columns are mapped, and therefore reportable
curl http://localhost:8000/api/source/connections

# 3. The statistics themselves
curl http://localhost:8000/api/source/connections/1/match-stats
```

Pick a connection and you get an overall match rate with a progress bar, then
one card per mapped field.

## FieldMatchStats

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
  "top_unmatched": [
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
  ],
  "top_matched": [
    {
      "raw_value": "Married",
      "occurrence_count": 2890,
      "canonical_label": "Married",
      "match_type": "mapping",
      "confidence": 1.0
    }
  ]
}
```

### Reading the numbers

| Field | Meaning |
| --- | --- |
| `total_values` | Distinct raw values captured for this column |
| `matched_values` | Distinct values with an approved mapping |
| `unmatched_values` | `total_values` − `matched_values` |
| `match_rate` | `matched_values / total_values`, between `0.0` and `1.0` |

`match_rate` is computed over **distinct values**, not row counts. A column of
3,679 rows with 12 distinct spellings can read 100% while still carrying a
messy source — use `occurrence_count` to judge the real blast radius.

### `match_type` on matched values

| Value | Meaning |
| --- | --- |
| `mapping` | Resolved by an approved value mapping — deterministic, trust it |
| `semantic` | Resolved by embedding similarity — probabilistic, verify it |

A high rate dominated by `semantic` matches deserves more scrutiny than the same
rate driven by `mapping` rows.

!!! note "Mappings created by hand appear here immediately"
    Cards refresh when mappings are created or edited, and when the global sync
    action runs. If a new mapping is not reflected, check that the write
    succeeded before assuming a caching problem.

## No samples yet

Fields with no captured samples have nothing to report. Rather than showing a
misleading `0/0`, Match Insights:

- falls back to configured field mappings when statistics are empty, so you can
  still see which columns are wired up and which are simply unpopulated
- keeps the cards visible so the gap is visible rather than hidden

!!! tip "A missing card is a data problem, not a bug"
    If a field you expect is absent, it has no samples. Go to
    [Field Mappings](field-mappings.md) and run **capture** against that
    mapping.

## Using the numbers to prioritise

<div class="rdh-panel" markdown>

1. **Start with high-volume unmatched values.** Sort `top_unmatched` by
   `occurrence_count`. One spelling covering 40% of a column beats forty
   spellings covering 1% each.
2. **Check whether the canonical value exists.** If it does, approve it. If it
   does not, you are finding a library gap, not a mapping gap.
3. **Watch for `semantic` matches on short raw values.** A raw value of `M` or
   `1` embeds poorly. These are the most likely source of silent mismatches.
4. **Re-measure after each batch.** Coverage is only meaningful as a trend.

</div>

## Related

<div class="grid cards" markdown>

-   :material-lightbulb: **Suggestions**

    ---

    The actionable queue behind these numbers.

    [:octicons-arrow-right-24: Triage unmatched values](suggestions.md)

-   :material-history: **Mapping History**

    ---

    Audit what was approved, by whom, and when.

    [:octicons-arrow-right-24: Trace decisions](mapping-history.md)

</div>