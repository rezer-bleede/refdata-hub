---
description: Tune match thresholds, embedding models, top-K, and online or offline LLM escalation for semantic matching.
---

# Settings

<p class="rdh-eyebrow">System</p>

Settings holds the single-row `systemconfig` record that drives the matcher.
Every control here changes how suggestions are scored and ranked for everyone
using the deployment.

## Configuration record

```bash
curl http://localhost:8000/api/config
```

```json
{
  "default_dimension": "general",
  "match_threshold": 0.45,
  "matcher_backend": "embedding",
  "embedding_model": "BAAI/bge-small-en-v1.5",
  "llm_mode": "online",
  "llm_model": "gpt-3.5-turbo",
  "llm_api_base": null,
  "llm_escalation": false,
  "top_k": 5,
  "llm_api_key_set": true
}
```

| Setting | Default | Constraints | Effect |
| --- | --- | --- | --- |
| `default_dimension` | `general` | — | Dimension assumed when a caller does not pin one |
| `match_threshold` | `0.45` | `0.0`–`1.0` | Below this, a match is not trusted automatically |
| `matcher_backend` | `embedding` | — | Which scoring stage runs |
| `embedding_model` | `BAAI/bge-small-en-v1.5` | — | Sentence-transformer used for cosine similarity |
| `llm_mode` | `online` | `online` or `offline` | Which LLM runtime to escalate to |
| `llm_model` | `gpt-3.5-turbo` | — | Model identifier for the chosen runtime |
| `llm_api_base` | `null` | — | Custom OpenAI-compatible base URL |
| `llm_escalation` | `false` | — | Send near-tied results to the LLM for a tiebreak |
| `top_k` | `5` | `1`–`20` | How many candidates to return |

!!! danger "The API key is write-only"
    The read response exposes `llm_api_key_set` as a boolean, never the key
    itself. To rotate a key you must send a new one; there is no way to read
    the current value back. To clear a key, send an empty-but-valid value per
    your deployment's conventions — the schema requires `min_length: 4`.

## Partial updates win

`PUT /api/config` accepts any subset of fields and only writes what you send:

```bash
# Raise the confidence bar without touching anything else
curl -X PUT http://localhost:8000/api/config \
  -H 'Content-Type: application/json' \
  -d '{"match_threshold": 0.62}'
```

The UI does exactly this — it diffs the draft against the loaded config and
sends only the changed keys. If you find a setting you changed did not stick,
check whether the write included it at all before suspecting the API.

## Tuning guidance

### `match_threshold`

The single highest-leverage setting. It decides how much ambiguity reaches a
human.

| Situation | Effect of raising it |
| --- | --- |
| Large trusted upstream, few surprises | Fewer false approvals, smaller review queue |
| Long-tail consumer data, noisy spellings | Higher-confidence auto-resolutions, larger queue |

Start at `0.45`. If reviewers are correcting a lot of suggestions, the threshold
is too low for your data — raise it and re-measure. If the queue is enormous
and mostly obvious, lower it slightly.

### `top_k`

How many candidates each raw value is offered. `5` is a good default. Raising
it past ~10 adds noise to the Suggestions UI without meaningfully improving the
chance the right answer appears; raising it also increases LLM token cost per
escalated item.

### `matcher_backend`

| Value | Behaviour |
| --- | --- |
| `embedding` | Sentence-transformer cosine similarity, with lexical fallback |
| lexical-only variants | Pure token overlap — faster, no model download, much weaker on synonyms |

If embeddings fail to download in a constrained environment, the matcher falls
back rather than erroring. Scores from the fallback are **not** comparable to
embedding scores, so do not tune `match_threshold` across a backend change
without re-measuring.

### `llm_escalation`

When enabled, candidates whose embedding scores are too close to call get a
second opinion from the configured LLM. This helps on genuinely ambiguous pairs
and costs latency on every ambiguous request.

To run fully offline, set `llm_mode` to `offline` and point at a local Ollama
instance:

```bash
docker compose --profile ollama up -d
docker compose exec ollama ollama pull smollm:135m
```

```bash
curl -X PUT http://localhost:8000/api/config \
  -H 'Content-Type: application/json' \
  -d '{"llm_mode": "offline", "llm_model": "smollm:135m", "llm_escalation": true}'
```

For a self-hosted OpenAI-compatible endpoint, set `llm_api_base` alongside
`llm_model` and `llm_api_key`.

## Environment overrides

Anything here can be seeded from the environment at deploy time, which is
usually better for containers than clicking through the UI on every boot. See
[Configuration Reference](configuration.md) for the full list of
`REFDATA_*` variables and their precedence.

## After you change something

<div class="rdh-panel rdh-panel--accent" markdown>

Configuration writes are global and immediate — there is no per-session
override. After changing the matcher:

1. Re-run the **semantic match playground** on [Dashboard](dashboard.md) to
   confirm scores respond.
2. Re-check [Match Insights](match-insights.md) to see whether coverage moved.
3. Re-check [Suggestions](suggestions.md); a threshold change alters what is
   queued.

</div>