# RefData Hub

A semi-automated reference data and standardization service for global projects. The platform harmonizes common reference dimensions (marital status, education, nationality, employment status, and more) by semantically matching new raw values, routing them to reviewers for approval, and adding them to a central mapping.

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

Each directory currently contains a placeholder `.gitkeep` file to keep the structure under version control. Implementation details will evolve as components are developed.

## Feature Breakdown

See [`docs/FEATURES.md`](docs/FEATURES.md) for a detailed description of the planned functionality, including the core reference data service, semantic matching workflows, reviewer experience, integration options, governance controls, and roadmap items.

## Tech Stack (Proposed)

- **Backend:** FastAPI (Python) or Node.js (Express)
- **Database:** PostgreSQL with audit/versioning tables
- **Frontend:** Lightweight React reviewer dashboard
- **Matching:** spaCy / HuggingFace embeddings / sentence-transformers

## License

This project is released under the [MIT License](LICENSE).
