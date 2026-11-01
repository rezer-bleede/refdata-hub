---
description: Operational overview of the RefData Hub reviewer console, its metric tiles, and the semantic match playground.
---

# Dashboard

<p class="rdh-eyebrow">Workspace</p>

Operationalise semantic standards with observability inspired by modern data
catalogs. The Dashboard is the landing page of the reviewer console and the
fastest way to sanity-check that the matcher is behaving before you commit to a
batch of review work.

## What the dashboard shows

Three metric tiles read live from the app state context:

| Tile | Source | What it tells you |
| --- | --- | --- |
| **Canonical values** | `GET /api/reference/canonical` | Size of your approved golden-record set |
| **Dimensions** | `GET /api/reference/dimensions` | How many semantic domains you have defined |
| **Matcher backend** | `GET /api/config` | Whether matching uses name similarity or opt-in LLM ranking |

If the **Matcher backend** tile disagrees with what you set in
[Settings](settings.md), your most recent `PUT /api/config` did not persist.
Check that the API accepted the write and that the browser can reach it.

## Name match playground

The playground is the fastest feedback loop in the product. Enter a raw value
you expect to see in a source system, optionally pick a dimension, and see the
ranked candidates immediately.

```bash
curl -X POST http://localhost:8000/api/reference/propose \
  -H 'Content-Type: application/json' \
  -d '{"raw_text": "Never married", "dimension": "marital_status"}'
```

The response carries a `matches` array of `MatchCandidate` objects, each with a
`score` between `0.0` and `1.0`, ranked best-first:

```json
{
  "raw_text": "Never married",
  "dimension": "marital_status",
  "matches": [
    {
      "canonical_id": 3,
      "canonical_label": "Unmarried",
      "dimension": "marital_status",
      "score": 0.94,
      "description": "Never married, single, no legal partner"
    }
  ]
}
```

The UI renders this as a table of label, dimension, description, and similarity
score. The score is not a probability or confirmation of identity.

<figure class="rdh-figure">
  <img src="../screenshots/demo_semantic_matching.gif" alt="Name matching playground scoring raw values against canonical values">
  <figcaption>Illustrative UI capture — any values shown are not bundled runtime data.</figcaption>
</figure>

!!! tip "Read the score, not just the rank"
    A high score means the normalized names are textually similar. It does not
    mean they identify the same entity. Approval is always a deliberate act.

## Interpreting a weak match

| Symptom | Likely cause | Fix |
| --- | --- | --- |
| Every score is low | The names differ beyond the conservative similarity threshold | Review manually or add an approved alias; do not lower the threshold without checking false positives |
| A candidate from the wrong dimension ranks first | You left `dimension` unset, so the matcher searched the whole library | Pin the dimension in the playground |
| Good candidates exist but scores are below the threshold | `match_threshold` is set too high for your data | Lower it in [Settings](settings.md), or approve from [Suggestions](suggestions.md) |

## Next steps

<div class="grid cards" markdown>

-   :material-library: **Canonical Library**

    ---

    Curate the golden records the playground is matching against.

    [:octicons-arrow-right-24: Canonical Library](canonical-library.md)

-   :material-lightbulb: **Suggestions**

    ---

    Work through the queue the dashboard's scores feed into.

    [:octicons-arrow-right-24: Review suggestions](suggestions.md)

-   :material-cog: **Settings**

    ---

    Tune the name-similarity threshold and optional LLM settings.

    [:octicons-arrow-right-24: Tune the matcher](settings.md)

</div>
