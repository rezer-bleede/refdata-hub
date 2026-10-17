<div align="center">

# 🌐 RefData Hub

### **Enterprise Reference Data Management (RDM) & Data Harmonization Platform**

*Automate, harmonize, and standardize reference data dimensions across global enterprise systems with AI-assisted semantic matching and intuitive human-in-the-loop curation workflows.*

[![Documentation](https://img.shields.io/badge/Docs-Live-4f46e5.svg)][docs-url]
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)][license-url]
[![Python 3.10+](https://img.shields.io/badge/Python-3.10%2B-blue.svg)](https://www.python.org/)
[![React 18](https://img.shields.io/badge/React-18-61dafb.svg)](https://react.dev/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.110.0-009688.svg)](https://fastapi.tiangolo.com/)

[docs-url]: https://rezer-bleede.github.io/refdata-hub/
[license-url]: LICENSE

---

<figure align="center">
  <table border="0" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td width="50%" align="center" style="padding: 6px;">
        <img src="docs/screenshots/demo_semantic_matching.gif" alt="AI Semantic Matching & Playground" width="100%">
        <br><sub><b>1. AI Semantic Matching & Playground</b></sub>
      </td>
      <td width="50%" align="center" style="padding: 6px;">
        <img src="docs/screenshots/demo_canonical_library.gif" alt="Canonical Reference Library" width="100%">
        <br><sub><b>2. Canonical Reference Library</b></sub>
      </td>
    </tr>
    <tr>
      <td width="50%" align="center" style="padding: 6px;">
        <img src="docs/screenshots/demo_source_connections.gif" alt="Source System Connections & Profiling" width="100%">
        <br><sub><b>3. Source System Connections & Profiling</b></sub>
      </td>
      <td width="50%" align="center" style="padding: 6px;">
        <img src="docs/screenshots/demo_match_insights.gif" alt="Match Insights & Human Curation" width="100%">
        <br><sub><b>4. Match Insights & Curation Workflow</b></sub>
      </td>
    </tr>
  </table>
  <figcaption><em>Multi-Tiled Interactive Demo: Harmonizing unstandardized reference data across 4 core enterprise platform use cases.</em></figcaption>
</figure>

---

</div>

## 📌 Overview

**RefData Hub** is an open-source **Reference Data Management (RDM)** and **Data Harmonization** platform designed to solve reference data fragmentation across modern enterprise architectures.

In inconsistent multi-system environments, raw reference values—such as country codes, employment statuses, education levels, or marital statuses—vary widely between source databases, analytics pipelines, and third-party APIs. RefData Hub establishes a single source of truth by:

1. **Ingesting & Profiling** raw source data from upstream databases.
2. **Semantically Matching** disparate raw values to canonical dimensions using AI embedding vectors or LLM-powered re-ranking.
3. **Empowering Reviewers** with a modern human-in-the-loop dashboard to inspect, approve, or refine suggestions.
4. **Publishing Canonical Mappings** to downstream data warehouses, business intelligence tools, and microservices.

---

## ✨ Key Features

- 🧠 **AI-Assisted Semantic Matching:** Harmonize messy reference data automatically using local sentence-transformer embeddings ([fastembed](https://github.com/qdrant/fastembed)), or configurable LLM providers (OpenAI API or local offline Ollama models) — including optional LLM escalation that re-ranks near-tied embedding results.
- 🛡️ **Human-in-the-Loop Curation:** A streamlined dashboard for data stewards and reviewers to inspect confidence scores, approve auto-suggestions, or manually map complex edge cases.
- 🔗 **Source System Connectors:** Connect directly to upstream databases — PostgreSQL, MySQL, ClickHouse, Snowflake, SQL Server, Oracle, MongoDB, SQLite, DuckDB, or a generic SQL driver — inspect live schemas, and sample unstandardized values in real time.
- 📐 **Canonical Library & Custom Schemas:** Define flexible reference dimensions with custom JSON metadata schemas (e.g., ISO codes, regional attributes, sorting priority).
- 📊 **Match Insights & Coverage Analytics:** Track overall harmonization health, percentage of standardized values, and unmapped raw value frequencies across source systems.
- 🌳 **Dimension Hierarchies & Relations:** Model multi-level parent/child relationships (e.g., *Country → State → District*).
- 📁 **Bulk Import & Export:** Effortlessly import/export canonical values and field mappings via CSV, TSV, or Excel formats.
- 🎨 **12-Palette Themeable UI:** Built with React 18, Vite, and Tailwind CSS, with twelve palettes plus a `System` option that follows your OS. The selection persists in `localStorage` and is shared with the documentation site, so both stay on the same theme.

---

## 🏗️ Architecture & Data Flow

RefData Hub acts as an intelligent middleware layer between operational source systems and downstream reporting/data warehouses:

```
┌─────────────────┐       ┌────────────────────────────────────────────────────────┐       ┌─────────────────────┐
│  Source Systems │       │                      RefData Hub                       │       │ Downstream Consumers│
│  (DBs, APIs,    │ ────> │  ┌──────────────┐   ┌───────────────┐   ┌───────────┐  │ ────> │ (Data Warehouses,   │
│   Legacy Data)  │       │  │ Schema &     │   │ AI Semantic   │   │ Reviewer  │  │       │  BI & Analytics,    │
└─────────────────┘       │  │ Connectors   │ ─>│ Match Engine  │ ─>│ Dashboard │  │       │  Microservices)     │
                          │  └──────────────┘   └───────────────┘   └───────────┘  │       └─────────────────────┘
                          └────────────────────────────────────────────────────────┘
```

1. **Extraction & Sampling:** Source connectors pull distinct raw values and record counts.
2. **Semantic Vector Matching:** Matcher scores candidates using cosine vector similarity or LLMs.
3. **Approval Thresholds:** High-confidence matches auto-approve while uncertain values route to human reviewers.
4. **Central Repository:** Approved canonical mappings are persisted and accessible via REST APIs.

---

## 🚀 Quick Start (Docker Compose)

Get the complete RefData Hub platform running with a single command:

```bash
docker compose up --build
```

### 🌐 Access Service Endpoints

- 🎨 **Reviewer UI (Dashboard):** [http://localhost:5274](http://localhost:5274)
- ⚡ **Backend REST API Docs (Swagger):** [http://localhost:8000/docs](http://localhost:8000/docs)
- 🗄️ **Primary Application DB (PostgreSQL 15):** `localhost:5432`
- 🧪 **Bundled Demo Target DB (PostgreSQL 15):** `localhost:5433`

> 💡 **Lightweight by Default:** The default `docker compose up` stack starts PostgreSQL, the FastAPI backend, the React frontend, and a seeded target database. It requires minimal memory and CPU resources.
>
> Note the port difference: compose serves the UI on **5274**, while `npm run dev` serves it on **5173**.

---

## 🤖 Optional Offline Local LLM Setup (Ollama)

Heavy preloaded LLM images are **not downloaded by default** to conserve bandwidth and system memory.

If you want to use local offline LLM semantic matching, start the optional Ollama service profile:

```bash
# Launch the core stack WITH the optional local Ollama LLM runtime
docker compose --profile ollama up --build
```

### Pulling Lightweight Models

When running the optional Ollama container, pull a compact, lightweight model such as `smollm:135m` or `tinyllama`:

```bash
docker compose exec ollama ollama pull smollm:135m
```

You can then select **Offline Ollama** in the **Settings workspace** of the Reviewer UI or configure `REFDATA_LLM_MODEL=smollm:135m` in your environment.

---

## 📸 Interface Preview

A single end-to-end pass through the reviewer console — dashboard metrics, the canonical library, source profiling, and the approval queue.

<figure>
  <img src="docs/screenshots/demo.gif" alt="RefData Hub Reviewer Console end-to-end walkthrough" width="100%">
  <figcaption><em>RefData Hub Reference Data Management Dashboard: from raw upstream values to approved canonical mappings.</em></figcaption>
</figure>

---

## 🛠️ Tech Stack

| Component | Technology | Description |
|---|---|---|
| **Backend API** | [FastAPI](https://fastapi.tiangolo.com/) + [Python 3.10+](https://www.python.org/) | High-performance asynchronous REST API |
| **ORM / Database** | [SQLModel](https://sqlmodel.tiangolo.com/) + [PostgreSQL 15](https://www.postgresql.org/) | Type-safe SQL querying and schema migrations |
| **Frontend UI** | [React 18](https://react.dev/) + [Vite](https://vitejs.dev/) + [Tailwind CSS](https://tailwindcss.com/) | Fast, themeable single-page application |
| **Matching Engine** | [fastembed](https://github.com/qdrant/fastembed) + [OpenAI](https://openai.com/) / [Ollama](https://ollama.com/) | ONNX sentence-transformer embeddings & LLM re-ranking |
| **Testing** | [Pytest](https://docs.pytest.org/) & [Vitest](https://vitest.dev/) | Complete unit, integration, and UI test coverage |
| **Containerization** | [Docker](https://www.docker.com/) & Docker Compose | Multi-container service orchestration |

---

## 💻 Local Development Workflow

### Backend Setup

Run from the repository root. `REFDATA_DATABASE_URL` is required for the API
server; without it the app falls back to the compose-internal hostname `db:5432`,
which does not resolve outside Docker.

```bash
# Create and activate virtual environment
python3 -m venv .venv
source .venv/bin/activate

# Install dependencies
pip install -r api/requirements.txt pytest pytest-cov

# Point the API at a reachable database
export REFDATA_DATABASE_URL="postgresql+psycopg://refdata:refdata@localhost:5432/refdata"
export REFDATA_CORS_ORIGINS="http://localhost:5173"

# Run API server locally
uvicorn app.main:app --app-dir api --reload --port 8000
```

### Frontend Setup

```bash
# Navigate to UI directory
cd reviewer-ui

# Install dependencies
npm install

# Start Vite dev server (http://localhost:5173)
npm run dev

# Run UI test suite
npm test
```

The UI defaults to `http://localhost:8000` for API calls on localhost. Set
`VITE_API_BASE_URL` to point it elsewhere.

### Tests

The test suite lives in `tests/` at the repository root, so run pytest from
there. Tests use an in-memory SQLite database and need no running Postgres.

```bash
# Backend — from the repository root
pytest

# With coverage
pytest --cov=app --cov-report=html

# Integration tests only
pytest -m integration

# Frontend
cd reviewer-ui && npm test
```

### Documentation

```bash
pip install -r requirements-docs.txt

# Port 8000 is the API, so serve the docs on 8001
mkdocs serve -a localhost:8001
```

The docs theme is generated from the app's stylesheet. After changing a palette
in `reviewer-ui/src/styles.css`, regenerate it with:

```bash
python scripts/generate_docs_tokens.py
```

---

## 📖 Complete Documentation Index

**Full documentation is published at → https://rezer-bleede.github.io/refdata-hub/**

The hosted site is the canonical, always-current version of every guide below.
It ships the same 12-palette theme switcher as the Reviewer UI, so it reads as
part of the product rather than a separate website. The Markdown sources for
each page are committed in [`docs/`](docs/) and build locally with
`mkdocs serve`.

### Getting Started

| Guide | Description |
|---|---|
| 🚀 [Quickstart Guide](docs/quickstart.md) | Detailed walkthrough for Docker and local setup |

### Workspace

| Guide | Description |
|---|---|
| 🏠 [Features Overview](docs/features.md) | What the platform does, capability by capability |
| 📊 [Dashboard](docs/dashboard.md) | Metric tiles and the semantic match playground |
| 🧱 [Dimensions](docs/dimensions.md) | Dimension definitions, attribute schemas, and parent/child relations |
| 📚 [Canonical Library](docs/canonical-library.md) | Curating golden records, bulk import, and attributes |

### Integration

| Guide | Description |
|---|---|
| 🔌 [Source Connections](docs/source-connections.md) | Register upstreams, test connectivity, introspect live schemas |
| 🗺️ [Field Mappings](docs/field-mappings.md) | Bind source columns to dimensions and capture samples |

### Quality Control

| Guide | Description |
|---|---|
| 📈 [Match Insights](docs/match-insights.md) | Coverage rates, top matched and unmatched values |
| 💡 [Suggestions](docs/suggestions.md) | Reviewing and approving semantic match suggestions |
| 🕓 [Mapping History](docs/mapping-history.md) | Audit trail plus CSV/XLSX round-trip |

### Reference & Developers

| Guide | Description |
|---|---|
| ⚙️ [System Settings](docs/settings.md) | Match thresholds, embedding models, LLM escalation |
| 🏛️ [Architecture Guide](docs/architecture.md) | Deep dive into system components and vector matching |
| 🗄️ [Database Schema Reference](docs/database-schema.md) | Complete ERD, table specs, and migration guides |
| 📡 [REST API Documentation](docs/api.md) | API endpoints, payloads, and integration examples |
| 🔧 [Configuration Reference](docs/configuration.md) | Environment variables, matcher settings, and tuning |
| 🛠️ [Developer Guide](docs/development.md) | Local development, testing, and contribution patterns |
| 🧪 [Testing Guide](docs/testing.md) | Test strategies and execution |
| ☁️ [Deployment Guide](docs/deployment.md) | Production Docker, Kubernetes, and Cloudflare Pages setup |
| 🆘 [Troubleshooting](docs/troubleshooting.md) | Common issues and solutions |

---

## 🤝 Contributing

We welcome contributions from the community! Please read our [CONTRIBUTING.md](CONTRIBUTING.md) guide for details on submitting pull requests, coding standards, and running tests.

---

## 📜 License

This project is open-source software licensed under the [MIT License](LICENSE).
