# RefData Hub

A semi-automated reference data and standardization service for global projects. The platform harmonizes common reference dimensions (marital status, education, nationality, employment status, and more) by semantically matching new raw values, routing them to reviewers for approval, and adding them to a central mapping.

## Quickstart (Docker)

The stack ships with a minimal end-to-end experience. With Docker and Docker Compose installed, run:

```bash
docker compose up --build
```

This command starts:


- **PostgreSQL** (`db`) seeded with example canonical values and configuration defaults.
- **Target Demo Postgres** (`targetdb`) populated with a realistic customer, order, and product
  warehouse for mapping demos and tests. The dataset now spans departments, employees,
  globally-distributed customers with demographic attributes, detailed addresses, orders,
  and catalog items. Upserts keep every insert idempotent so the data set stays consistent
  across container restarts while still reflecting the richer schema.
- **FastAPI backend** (`api`) exposing REST endpoints under `http://localhost:8000`.
- **Reviewer UI** (`reviewer-ui`) served from `http://localhost:5173` with a Tailwind-powered design system, shared UI component primitives, and multi-theme support.
- **Ollama llama3 runtime** (`ollama`) delivering an offline LLM endpoint for semantic matching experiments.

The reviewer UI container now ships a custom Nginx configuration that falls back to `index.html`, so deep links such as
`http://localhost:5173/dashboard` or browser refreshes on nested routes resolve correctly without returning a 404. The image also
bakes in a browser-friendly `VITE_API_BASE_URL` pointing at `http://localhost:8000`, so the dashboard can reach the FastAPI backend
without extra host aliases.
The first boot performs all schema creation and seeding automatically. The Docker Compose profile defaults to the offline Ollama matcher so you can experiment with semantic ranking without external credentials. Switch to the hosted API mode from the dashboard when you want to provide your own OpenAI-compatible endpoint. All runtime changes (matching thresholds, preferred matcher backend, API keys, additional canonical values, etc.) should be made through the Reviewer UI. No extra scripts are required after `docker compose up`. If you ever wipe the database manually, simply refresh the UI—the backend now recreates the default configuration record on demand so the dashboard no longer stalls with "Unable to load configuration" toasts. Legacy deployments that predate the JSON `canonicalvalue.attributes` column are also remediated at startup, preventing the `UndefinedColumn` errors that previously surfaced in the API logs. For connectivity troubleshooting tips and a breakdown of the new debug logging surfaced in both the UI console and backend logs, see [`docs/TROUBLESHOOTING.md`](docs/TROUBLESHOOTING.md).

### Reviewer UI at a glance

The interface is organised into task-focused pages that surface the entire curation workflow:

- A persistent navigation rail, global action header, and glassmorphism-inspired surfaces echo the ergonomics of a modern
  observability catalog, giving analysts a familiar workspace with responsive theme
  switching and mobile-friendly navigation. The rail now remains pinned while scrolling long datasets and can collapse on
  large displays so reviewers can reclaim horizontal space without losing orientation. When collapsed, the navigation now
  swaps placeholder dots for meaningful icons so reviewers can still recognise each workspace at a glance. A bespoke
  RefData helix mark now lives in the top-left of the rail so the product brand stays visible on every theme and screen
  size. The redesign leans on Tailwind CSS utility tokens rendered through shared UI primitives, enabling a futuristic,
  neon-accented experience without rewriting the reviewer workflows. The browser tab now ships with a branded favicon, and
  the collapse toggle sits alongside the logo in the rail header for quicker access to the expanded/collapsed states. Theme
  preferences are saved between sessions and drive distinct palettes for dark, light, and midnight modes so accessibility
  is maintained regardless of ambient lighting.
- **Dashboard** – monitor canonical coverage and experiment with semantic suggestions in a live playground.
- **Settings** – manage matcher thresholds, embedding defaults, and LLM connectivity in a dedicated workspace.
- **Canonical Library** – manage curated reference values, filter by dimension, import tabular data in bulk, and export the library to CSV. Dimension chips now use high-contrast aurora badges so codes stay legible against the dark canvas.
- **Dimensions** – maintain each dimension's code, label, description, and custom attribute schema. Each row now opens a
  dedicated detail view that aggregates canonical coverage, attribute fill rates, and mapping health for that dimension so
  reviewers can audit governance readiness before onboarding new sources.
- **Dimension Relations** – model parent/child hierarchies such as regions to districts and manage canonical value pairings.
- **Source Connections** – register and maintain connectivity metadata for upstream systems, verify credentials with the
  built-in **Test connection** action, and deep-dive into each source to inspect schemas, tables, fields, match statistics, and
  profiled sample values. Distinct sample previews now consolidate duplicate raw values captured across ingestion runs and roll
  their counts together so analysts always review truly unique source content. The existing connections grid now sits above the
  registration form so teams can audit connectivity before onboarding new integrations. Port and password fields in the
  registration workflow now use the dark input treatment so entered values stay legible against the rest of the form. A demo
  connection targeting the bundled `targetdb` Postgres instance is seeded automatically for tutorials and integration tests.
- **Field Mappings** – align source tables/fields to reference dimensions and ingest sample values for reconciliation analytics.
  Available tables and columns are now surfaced directly from the connected database so analysts can choose valid metadata from
  dropdowns instead of typing freeform text. The existing mappings table is pinned above the creation form to keep context
  visible while adding or editing records.
- **Match Insights** – visualise match rates per mapping, inspect top outliers, and track overall harmonisation health, with
  automatic sample capture when mappings are created or updated, clear empty states when no samples have been captured yet,
  and fallback insights that stay visible from configured field mappings even before statistics are available. Insights refresh
  on-demand via the global **Sync data** action.
- **Suggestions** – approve semantic suggestions or manually link raw values to canonical standards.
- **Mapping History** – audit every approved mapping, edit or retire entries, export CSV/Excel snapshots, or import bulk updates per connection.

Detailed curation guidance, including an import-ready Abu Dhabi region dataset for the canonical library, lives in
[`docs/CANONICAL_LIBRARY.md`](docs/CANONICAL_LIBRARY.md).

### Target demo warehouse data model

The bundled `targetdb` database is now representative of a modern B2B warehouse. It includes:

- **Departments & employees** with cost centres, regional coverage, and seeded staff across finance,
  engineering, HR, marketing, and operations.
- **Customers** enriched with loyalty tiers, income bands, marital status, globally formatted phone
  numbers, and an owning department to mirror account executive coverage.
- **Addresses** with a unique `(customer_id, address_type)` constraint so billing, shipping, and home
  locations can be tracked independently without creating duplicates.
- **Products and services** spanning accessories, enterprise software, hardware, and marketing
  packages—ideal for field mapping walkthroughs.
- **Orders and order items** linked to both customers and employees, with totals that align with the
  seeded line items and a spread of workflow statuses (`Completed`, `Processing`, `Shipped`, and
  `Pending Payment`).

Use the reviewer UI's Source Connections workspace to explore the schema and practice aligning
fields to the canonical library using the richer, globally diverse sample values.

For a visual tour of the refreshed reviewer workspace, see [`docs/FEATURES.md`](docs/FEATURES.md) which now calls out the
observability-inspired experience and design principles.

### API highlights

The FastAPI service now exposes a rich set of endpoints under `/api`:

- `/reference/canonical` – full CRUD for canonical reference values.
- `/reference/canonical/import` – parse CSV/TSV/Excel uploads and create canonical values in bulk. Requests now accept an
  explicit column mapping payload so spreadsheets with arbitrary headers can be harmonised, and optional dimension definitions
  allow brand-new dimensions to be created automatically during an import. The loader now scans every worksheet in an Excel
  workbook, skips prefatory metadata blocks, and promotes the first detected header row even when it appears below merged
  title cells or version banners, making it resilient to the multi-sheet templates typically shared by governance teams.
  When a workbook includes multiple tabs, the API reports every sheet so the UI can prompt the reviewer to pick which one to
  import. Each request processes exactly one sheet, making it safe to work through large templates sequentially. The import
  workflow also performs a dry run to surface existing canonical values before anything is written—reviewers can decide to
  update the matching records in place or skip them entirely.
- `/reference/canonical/import/preview` – analyse an uploaded table and return detected columns, suggested roles, and proposed
  dimension mappings. The Reviewer UI uses this endpoint to power the interactive bulk-import wizard.
- `/reference/dimensions` – manage the dimension catalog and attribute schema.
- `/reference/dimension-relations` – define parent/child relationships and retrieve linked canonical pairs.
- `/source/connections` – manage source system connection metadata.
- `/source/connections/{id}` – retrieve the full configuration for an individual connection.
- `/source/connections/test` – validate new connection details on demand and surface connection latency without saving the
  record.
- `/source/connections/{id}/tables` – discover available tables and views for a connection so mapping workflows can present
  authoritative dropdowns. Connection or DNS failures are now surfaced as clear 400-level responses instead of generic 500s,
  making it easier to diagnose unreachable hosts directly from the UI.
- `/source/connections/{id}/tables/{table}/fields` – inspect column metadata for a given table (or view) to power the field
  selector in the reviewer UI.
- `/source/connections/{id}/mappings` – create/update/delete field mappings to reference dimensions.
- `/source/connections/{id}/samples` – ingest aggregated raw samples collected from source systems or manual uploads.
- `/source/connections/{id}/match-stats` – compute match rates, top matched and unmatched values, plus semantic suggestions.
- `/source/connections/{id}/unmatched` – retrieve unmatched raw values with inline suggestions for remediation.
- `/source/connections/{id}/value-mappings` – approve, update, or delete specific raw-to-canonical mappings.
- `/source/value-mappings` – consolidated view of all mappings across connections.
- `/source/value-mappings/export` – download mapping history as CSV or Excel across all connections or filtered by connection.
- `/source/value-mappings/import` – upload CSV/Excel mapping updates with validation feedback and connection scoping.

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

## Testing

Run the Python unit and integration test suite with:

```bash
pytest
```

### Reviewer UI

The React workspace ships with Vitest-driven unit and integration coverage. From the
`reviewer-ui/` directory install dependencies and execute the frontend checks:

```bash
npm install
npm run build
npm test
```

The build step runs TypeScript in strict mode alongside the Vite production bundle to catch typing regressions in mocked React
components. The dedicated `createProps` helper inside `src/App.test.tsx` wraps Vitest mocks with real callbacks so TypeScript
accepts them as valid `AppScaffold` props while still exposing rich assertion helpers for the tests. The navigation suite now
covers the new dimension governance and relation workspaces, ensuring the shared toast and routing scaffolding continue to
operate as the UI grows.

The `reviewer-ui/src/components/ui.tsx` primitives model both input and textarea props explicitly. When you need a multiline
field, pass `as="textarea"` plus an optional `rows` count so TypeScript can validate the component and the runtime renders the
expected `<textarea>` element.

The new Reviewer UI deployment checks verify that the custom Nginx configuration is copied into the container image and that it
rewrites unknown application routes back to `index.html`. This prevents regressions where client-side routes return HTTP 404s
after a page refresh.

## Feature Breakdown

See [`docs/FEATURES.md`](docs/FEATURES.md) for a detailed description of the planned functionality, including the core reference data service, semantic matching workflows, reviewer experience, integration options, governance controls, and roadmap items.

## Tech Stack (Proposed)

- **Backend:** FastAPI (Python) or Node.js (Express)
- **Database:** PostgreSQL with audit/versioning tables
- **Frontend:** Lightweight React reviewer dashboard
- **Matching:** TF-IDF embeddings by default, with an optional LLM orchestrator

### Semantic Matching

The backend uses a pluggable `SemanticMatcher` abstraction. In Docker Compose deployments the matcher starts in offline mode, issuing ranking prompts to the bundled Ollama llama3 container. Provide the API base URL, model identifier, and optional API key in the Reviewer UI to switch `llm_mode` between offline and online providers. When `llm_mode` is set to `online`, the matcher routes requests to an OpenAI-compatible endpoint and falls back to TF-IDF embeddings if the provider is unreachable.

When the semantic playground is used without explicitly selecting a dimension, the `/api/reference/propose` endpoint now falls back to the dimension that contains available canonical values instead of returning an empty result for the `general` placeholder dimension. This ensures that common values such as “Single” still resolve to their canonical matches even when the default dimension is sparsely populated.

## License

This project is released under the [MIT License](LICENSE).
