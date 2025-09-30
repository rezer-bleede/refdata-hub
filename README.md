# RefData Hub

A semi-automated reference data and standardization service for global projects. The platform harmonizes common reference dimensions (marital status, education, nationality, employment status, and more) by semantically matching new raw values, routing them to reviewers for approval, and adding them to a central mapping.

## Quickstart (Docker)

The stack ships with a minimal end-to-end experience. With Docker and Docker Compose installed, run:

```bash
docker compose up --build
```

This command starts:

- **PostgreSQL** (`db`) seeded with example canonical values and configuration defaults.
- **FastAPI backend** (`api`) exposing REST endpoints under `http://localhost:8000`.
- **Reviewer UI** (`reviewer-ui`) served from `http://localhost:5173` with a Material UI design system and multi-theme support.

The first boot performs all schema creation and seeding automatically. All runtime changes (matching thresholds, preferred matcher backend, API keys, additional canonical values, etc.) should be made through the Reviewer UI. No extra scripts are required after `docker compose up`.

### Reviewer UI at a glance

The interface is organised into task-focused pages that surface the entire curation workflow:

- **Dashboard** – configure matcher parameters, experiment with semantic suggestions, and curate canonical values with inline editing.
- **Source Connections** – register and maintain connectivity metadata for upstream systems.
- **Field Mappings** – align source tables/fields to reference dimensions and ingest sample values for reconciliation analytics.
- **Match Insights** – visualise match rates per mapping, inspect top outliers, and track overall harmonisation health.
- **Suggestions** – approve semantic suggestions or manually link raw values to canonical standards.
- **Mapping History** – audit every approved mapping, edit or retire entries, and export a normalised view per connection.

### API highlights

The FastAPI service now exposes a rich set of endpoints under `/api`:

- `/reference/canonical` – full CRUD for canonical reference values.
- `/source/connections` – manage source system connection metadata.
- `/source/connections/{id}/mappings` – create/update/delete field mappings to reference dimensions.
- `/source/connections/{id}/samples` – ingest aggregated raw samples collected from source systems or manual uploads.
- `/source/connections/{id}/match-stats` – compute match rates, top unmatched values, and semantic suggestions.
- `/source/connections/{id}/unmatched` – retrieve unmatched raw values with inline suggestions for remediation.
- `/source/connections/{id}/value-mappings` – approve, update, or delete specific raw-to-canonical mappings.
- `/source/value-mappings` – consolidated view of all mappings across connections.

Endpoints accept and return structured JSON payloads that align with the React TypeScript models in `reviewer-ui/src/types.ts`.

## Project Structure

```
/refdata-hub
├── api/              # REST/GraphQL endpoints and transport layer
├── matcher/          # Semantic matching engine and NLP pipelines
├── reviewer-ui/      # Reviewer dashboard (React or similar)
├── db/               # Database schema definitions and migrations
├── tests/            # Unit and integration test suites
├── docs/             # Architecture, design notes, runbooks
└── README.md
```

The repository now contains a fully functional end-to-end workflow with integration tests in `tests/`, a semantic matcher in `matcher/`, a FastAPI backend in `api/`, and a multi-page React dashboard in `reviewer-ui/` with accessible theme switching baked into the header.

## Feature Breakdown

See [`docs/FEATURES.md`](docs/FEATURES.md) for a detailed description of the planned functionality, including the core reference data service, semantic matching workflows, reviewer experience, integration options, governance controls, and roadmap items.

## Tech Stack (Proposed)

- **Backend:** FastAPI (Python) or Node.js (Express)
- **Database:** PostgreSQL with audit/versioning tables
- **Frontend:** Lightweight React reviewer dashboard
- **Matching:** TF-IDF embeddings by default, with an optional LLM orchestrator

### Semantic Matching

The backend uses a pluggable `SemanticMatcher` abstraction. By default it applies TF-IDF embeddings for lightweight similarity search and gracefully falls back to lexical overlap if vectorization fails. Switch the matcher backend to `llm` in the Reviewer UI configuration panel to orchestrate a hosted large language model (OpenAI-compatible) for semantic ranking. Provide the API base URL, model identifier, and API key directly through the UI to route matches through your chosen LLM.

## License

This project is released under the [MIT License](LICENSE).
