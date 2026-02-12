# RefData Hub

[![Documentation](https://img.shields.io/badge/docs-latest-blue.svg)][docs-url]
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)][license-url]

[docs-url]: https://rezer-bleede.github.io/refdata-hub/
[license-url]: LICENSE

A semi-automated reference data and standardization service for global projects. The platform harmonizes common reference dimensions (marital status, education, nationality, employment status, and more) by semantically matching new raw values, routing them to reviewers for approval, and maintaining a central mapping repository.

## Quick Start

Get RefData Hub running in under 5 minutes with Docker:

```bash
docker compose up --build
```

Access the application:
- **Reviewer UI:** http://localhost:5173
- **API Documentation:** http://localhost:8000/docs

The stack includes PostgreSQL databases, a FastAPI backend, React frontend, and an offline Ollama LLM for semantic matching.

## Key Features

- **Semantic Matching** – Auto-suggest canonical values using TF-IDF embeddings or LLM models
- **Reviewer UI** – Modern, theme-switchable dashboard for curation workflows
- **Source Connections** – Connect to upstream systems and profile data in real time
- **Field Mappings** – Align source tables/fields to reference dimensions
- **Match Insights** – Visualize match rates and track harmonization health
- **Bulk Operations** – Import/export canonical values and mappings via CSV/Excel
- **Dimension Relations** – Model parent/child hierarchies (e.g., regions → districts)

## Documentation

| Document | Description |
|----------|-------------|
| [Quickstart Guide][quickstart] | Get up and running with Docker |
| [Architecture][architecture] | System design and component interactions |
| [Developer Guide][development] | Local development setup and workflow |
| [API Reference][api] | REST endpoints and integration examples |
| [Database Schema][database] | Complete data model documentation |
| [Deployment Guide][deployment] | Production deployment options |
| [Configuration][configuration] | System settings and environment variables |

[quickstart]: docs/quickstart.md
[architecture]: docs/architecture.md
[development]: docs/development.md
[api]: docs/api.md
[database]: docs/database-schema.md
[deployment]: docs/deployment.md
[configuration]: docs/configuration.md

## Tech Stack

- **Backend:** FastAPI (Python) with SQLModel/PostgreSQL
- **Frontend:** React 18 + Vite + Tailwind CSS
- **Matching:** TF-IDF embeddings + OpenAI/Ollama LLM support
- **Testing:** Pytest (backend) + Vitest (frontend)
- **Infrastructure:** Docker Compose

## Project Structure

```
/refdata-hub
├── api/              # FastAPI backend and REST endpoints
├── reviewer-ui/      # React frontend dashboard
├── db/               # Database initialization scripts
├── tests/            # Integration and unit tests
├── docs/             # Documentation and guides
└── docker-compose.yml # Multi-service orchestration
```

## Getting Started

1. **Prerequisites**
   - Docker and Docker Compose installed
   - (Optional) Python 3.10+, Node 18+ for local development

2. **Launch Services**
   ```bash
   docker compose up --build
   ```

3. **Explore the Demo**
   - Open http://localhost:5173
   - Try the semantic matching playground on the Dashboard
   - Connect to the demo `targetdb` in Source Connections
   - Create field mappings and review match insights

## Development

### Backend

```bash
cd api
pip install -r requirements.txt
pytest
uvicorn app.main:app --reload
```

### Frontend

```bash
cd reviewer-ui
npm install
npm run dev
npm test
```

For detailed development setup, see the [Developer Guide][development].

## Contributing

We welcome contributions! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## License

This project is released under the [MIT License](LICENSE).

## Support

- 📖 [Documentation][docs-url]
- 🐛 [Issue Tracker](https://github.com/rezer-bleede/refdata-hub/issues)
- 💬 [Discussions](https://github.com/rezer-bleede/refdata-hub/discussions)
