<div align="center">

# 🌐 RefData Hub

### **Enterprise Reference Data Management (RDM) & Data Harmonization Platform**

*Automate, harmonize, and standardize reference data dimensions across global enterprise systems with AI-assisted semantic matching and intuitive human-in-the-loop curation workflows.*

[![Documentation](https://img.shields.io/badge/Docs-Latest-blue.svg)][docs-url]
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)][license-url]
[![Python 3.10+](https://img.shields.io/badge/Python-3.10%2B-blue.svg)](https://www.python.org/)
[![React 18](https://img.shields.io/badge/React-18-61dafb.svg)](https://react.dev/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.110.0-009688.svg)](https://fastapi.tiangolo.com/)

[docs-url]: https://rezer-bleede.github.io/refdata-hub/
[license-url]: LICENSE

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

- 🧠 **AI-Assisted Semantic Matching:** Harmonize messy reference data automatically using TF-IDF vector similarity or configurable LLM providers (OpenAI API or local offline Ollama models).
- 🛡️ **Human-in-the-Loop Curation:** A streamlined dashboard for data stewards and reviewers to inspect confidence scores, approve auto-suggestions, or manually map complex edge cases.
- 🔗 **Source System Connectors:** Connect directly to upstream SQL databases (PostgreSQL, MySQL, Snowflake, etc.), inspect schemas, and sample unstandardized values in real time.
- 📐 **Canonical Library & Custom Schemas:** Define flexible reference dimensions with custom JSON metadata schemas (e.g., ISO codes, regional attributes, sorting priority).
- 📊 **Match Insights & Coverage Analytics:** Track overall harmonization health, percentage of standardized values, and unmapped raw value frequencies across source systems.
- 🌳 **Dimension Hierarchies & Relations:** Model multi-level parent/child relationships (e.g., *Country → State → District*).
- 📁 **Bulk Import & Export:** Effortlessly import/export canonical values and field mappings via CSV, TSV, or Excel formats.
- 🎨 **Modern Themeable UI:** Built with React 18, Vite, and Tailwind CSS with full support for Light, Dark, and Midnight themes.

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

Get the complete RefData Hub platform running in under **2 minutes**:

```bash
docker compose up --build
```

### 🌐 Access Service Endpoints

- 🎨 **Reviewer UI (Dashboard):** [http://localhost:5274](http://localhost:5274)
- ⚡ **Backend REST API Docs (Swagger):** [http://localhost:8000/docs](http://localhost:8000/docs)
- 🗄️ **Primary Application DB (PostgreSQL):** `localhost:5432`
- 🧪 **Bundled Demo Target DB (PostgreSQL):** `localhost:5433`

> 💡 **Lightweight by Default:** The default `docker compose up` stack starts PostgreSQL, the FastAPI backend, the React frontend, and a seeded target database. It requires minimal memory and CPU resources.

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

<figure>
  <img src="docs/screenshots/dashboard/overview.png" alt="RefData Hub Reference Data Management Dashboard Overview" width="1200">
  <figcaption><em>Main Dashboard displaying reference dimension coverage metrics and interactive semantic playground.</em></figcaption>
</figure>

<br/>

<figure>
  <img src="docs/screenshots/canonical-library/library-grid.png" alt="RefData Hub Canonical Library View" width="1200">
  <figcaption><em>Canonical Reference Library organizing standardized values, metadata attributes, and search filters.</em></figcaption>
</figure>

<br/>

<figure>
  <img src="docs/screenshots/connections/schema-explorer.png" alt="Source System Schema Explorer" width="1200">
  <figcaption><em>Source System Connector & Schema Explorer for profiling upstream databases.</em></figcaption>
</figure>

---

## 🛠️ Tech Stack

| Component | Technology | Description |
|---|---|---|
| **Backend API** | [FastAPI](https://fastapi.tiangolo.com/) + [Python 3.10+](https://www.python.org/) | High-performance asynchronous REST API |
| **ORM / Database** | [SQLModel](https://sqlmodel.tiangolo.com/) + [PostgreSQL 15](https://www.postgresql.org/) | Type-safe SQL querying and schema migrations |
| **Frontend UI** | [React 18](https://react.dev/) + [Vite](https://vitejs.dev/) + [Tailwind CSS](https://tailwindcss.com/) | Fast, themeable single-page application |
| **Matching Engine** | [scikit-learn](https://scikit-learn.org/) + [OpenAI](https://openai.com/) / [Ollama](https://ollama.com/) | TF-IDF vector embeddings & LLM re-ranking |
| **Testing** | [Pytest](https://docs.pytest.org/) & [Vitest](https://vitest.dev/) | Complete unit, integration, and UI test coverage |
| **Containerization** | [Docker](https://www.docker.com/) & Docker Compose | Multi-container service orchestration |

---

## 💻 Local Development Workflow

### Backend Setup

```bash
# Create and activate virtual environment
python3 -m venv .venv
source .venv/bin/activate

# Install dependencies
pip install -r api/requirements.txt pytest pytest-cov

# Run API server locally
cd api
uvicorn app.main:app --reload --port 8000

# Execute backend tests
pytest
```

### Frontend Setup

```bash
# Navigate to UI directory
cd reviewer-ui

# Install dependencies
npm install

# Start Vite dev server
npm run dev

# Run UI test suite
npm test
```

---

## 📖 Complete Documentation Index

| Guide | Description |
|---|---|
| 🚀 [Quickstart Guide](docs/quickstart.md) | Detailed walkthrough for Docker and local setup |
| 🏛️ [Architecture Guide](docs/architecture.md) | Deep dive into system components and vector matching |
| 🗄️ [Database Schema Reference](docs/database-schema.md) | Complete ERD, table specs, and migration guides |
| 📡 [REST API Documentation](docs/api.md) | API endpoints, payloads, and integration examples |
| ⚙️ [Configuration Reference](docs/configuration.md) | Environment variables, matcher settings, and tuning |
| 🛠️ [Developer Guide](docs/development.md) | Local development, testing, and contribution patterns |
| ☁️ [Deployment Guide](docs/deployment.md) | Production Docker, Kubernetes, and Cloudflare Pages setup |

---

## 🤝 Contributing

We welcome contributions from the community! Please read our [CONTRIBUTING.md](CONTRIBUTING.md) guide for details on submitting pull requests, coding standards, and running tests.

---

## 📜 License

This project is open-source software licensed under the [MIT License](LICENSE).
