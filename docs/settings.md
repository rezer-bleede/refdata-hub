---
description: Configure conservative name matching and optional LLM ranking.
---

# Settings

Settings holds the single-row `systemconfig` record used to rank candidates.
Name similarity is the default; suggestions are not approvals.

## Configuration

```bash
curl http://localhost:8000/api/config
```

| Setting | Default | Effect |
| --- | --- | --- |
| `default_dimension` | `general` | Dimension used when a caller omits one |
| `match_threshold` | `0.97` | Suggestion threshold; candidates can show from 0.02 below it, with a `0.95` floor |
| `matcher_backend` | `lexical` | `lexical` name similarity or explicitly selected `llm` ranking |
| `top_k` | `5` | Maximum candidates returned |
| `llm_mode` | `online` | `online` API or `offline` Ollama when LLM ranking is selected |
| `llm_model` | `gpt-3.5-turbo` | Model identifier |
| `llm_api_base` | `null` | Optional OpenAI-compatible endpoint |

The default scorer normalizes Unicode, case, punctuation, whitespace and word
order, then uses RapidFuzz character/token-order similarity. The default `0.97`
threshold surfaces suggestions down to `0.95`. Similarity scores are not
probabilities and do not prove two records identify the same company. Only an
approved `ValueMapping` is an accepted identity mapping.

## Partial updates

`PUT /api/config` accepts only the settings being changed:

```bash
curl -X PUT http://localhost:8000/api/config \
  -H 'Content-Type: application/json' \
  -d '{"match_threshold": 0.94}'
```

To opt into LLM ranking, set `matcher_backend` to `llm` and configure the
appropriate `llm_mode`, `llm_model`, and credentials. If the LLM is unavailable,
RefDataHub falls back to the default name-similarity scorer.

The API never returns the LLM key; it only returns `llm_api_key_set`. Send a new
`llm_api_key` to rotate it.

Environment overrides: `REFDATA_MATCHER_BACKEND`,
`REFDATA_MATCH_THRESHOLD`, `REFDATA_LLM_MODE`, `REFDATA_LLM_MODEL`,
`REFDATA_LLM_API_BASE`, and `REFDATA_LLM_API_KEY`.
