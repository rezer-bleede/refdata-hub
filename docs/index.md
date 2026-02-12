# RefData Hub

A semi-automated reference data and standardization service for global projects. The platform harmonizes common reference dimensions (marital status, education, nationality, employment status, and more) by semantically matching new raw values, routing them to reviewers for approval, and adding them to a central mapping.

## Key Features

- **Semantic Matching** – Use NLP and embedding models to suggest standardized values for new raw inputs, with configurable confidence thresholds
- **Reviewer UI** – Modern, theme-switchable interface for approving suggestions and managing the canonical library
- **Source Connections** – Connect to upstream systems, inspect schemas, and profile data in real time
- **Field Mappings** – Align source tables/fields to reference dimensions with automated sampling
- **Match Insights** – Visualize match rates per mapping, track overall harmonization health
- **Dimension Relations** – Model parent/child hierarchies (e.g., regions to districts)
- **Bulk Import/Export** – Import tabular data in bulk and export the library to CSV or Excel

## Quick Start

The fastest way to get started is with Docker. With Docker and Docker Compose installed, run:

```bash
docker compose up --build
```

This command starts:

- **PostgreSQL** (`db`) seeded with example canonical values and configuration defaults
- **Target Demo Postgres** (`targetdb`) populated with a realistic customer, order, and product warehouse
- **FastAPI backend** (`api`) exposing REST endpoints under `http://localhost:8000`
- **Reviewer UI** (`reviewer-ui`) served from `http://localhost:5173` with a Tailwind-powered design system
- **Ollama llama3 runtime** (`ollama`) delivering an offline LLM endpoint for semantic matching experiments

For detailed setup instructions, see the [Quickstart Guide](quickstart.md).

## Documentation

- **[Quickstart Guide](quickstart.md)** – Get up and running with Docker
- **[Features](features.md)** – Detailed feature overview and capabilities
- **[Canonical Library Guide](canonical-library.md)** – Managing curated reference values
- **[API Reference](api.md)** – REST endpoints and integration options
- **[Troubleshooting](troubleshooting.md)** – Common issues and solutions

## Tech Stack

- **Backend:** FastAPI (Python)
- **Database:** PostgreSQL with audit/versioning tables
- **Frontend:** React with Tailwind CSS
- **Matching:** TF-IDF embeddings with optional LLM orchestrator (Ollama/OpenAI-compatible)

## License

This project is released under the [MIT License](https://github.com/rezer-bleede/refdata-hub/blob/main/LICENSE).
