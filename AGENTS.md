# AGENTS.md

A semi-automated reference data and standardization service for global projects. The platform harmonizes common reference dimensions (marital status, education, nationality, employment status, and more) by semantically matching new raw values, routing them to reviewers for approval, and maintaining a central mapping repository.

## Setup Commands

### Docker Compose (Recommended)

```bash
# Start all services
docker compose up --build

# Access services
# - Reviewer UI: http://localhost:5173
# - API: http://localhost:8000
# - API Docs: http://localhost:8000/docs
# - PostgreSQL: localhost:5432
# - Target DB: localhost:5433
```

### Manual Backend Setup

```bash
cd api
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
export REFDATA_DATABASE_URL="postgresql+psycopg://refdata:refdata@localhost:5432/refdata"
export REFDATA_CORS_ORIGINS="http://localhost:5173"
uvicorn app.main:app --reload --port 8000
```

### Manual Frontend Setup

```bash
cd reviewer-ui
npm install
export VITE_API_BASE_URL="http://localhost:8000"
npm run dev
```

## Testing Commands

### Backend Tests (Pytest)

```bash
cd api

# Run all tests
pytest

# Run with coverage
pytest --cov=app --cov-report=html

# Run specific test
pytest tests/test_matcher.py::test_rank_with_embeddings

# Run with verbose output
pytest -v

# Run integration tests only
pytest -m integration
```

### Frontend Tests (Vitest)

```bash
cd reviewer-ui

# Run all tests
npm test

# Run in watch mode
npm test -- --watch

# Run with coverage
npm test -- --coverage

# Run specific test file
npm test -- CanonicalLibraryPage.test.tsx
```

## Code Style Guidelines

### Python (Backend)

- **PEP 8** style guide
- **Black** formatter (80-100 character line length)
- **Type hints** required for all functions
- **Docstrings** using Google style
- **Imports** grouped: stdlib, third-party, local

### TypeScript (Frontend)

- **ESLint** configuration in project root
- **Prettier** for formatting
- **Functional components** with hooks
- **TypeScript strict mode** enabled
- **No `any` types** allowed

## Commit Message Format

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <subject>

<body>

<footer>
```

**Types:**
- `feat` – New feature
- `fix` – Bug fix
- `docs` – Documentation changes
- `style` – Code style changes (formatting)
- `refactor` – Code refactoring
- `test` – Adding or updating tests
- `chore` – Maintenance tasks

**Examples:**
```
feat(matcher): add support for custom embedding models

Add a new parameter to the SemanticMatcher that allows users to specify
custom embedding models beyond the default TF-IDF.

Closes #123
```

```
fix(api): handle null values in canonical value attributes

Previously, null attributes would cause a 500 error. Now they're
properly handled and validated.

Fixes #456
```

## Project Structure

```
/refdata-hub
├── api/                          # FastAPI backend
│   ├── app/
│   │   ├── main.py               # Application entry point
│   │   ├── config.py             # Settings and configuration
│   │   ├── database.py           # Database engine and session
│   │   ├── models.py             # SQLModel database models
│   │   ├── schemas.py            # Pydantic schemas for API
│   │   ├── matcher.py            # Semantic matching logic
│   │   ├── seeds.py              # Database seeding
│   │   ├── routes/               # API route handlers
│   │   │   ├── config.py        # System configuration endpoints
│   │   │   ├── reference.py     # Canonical values & dimensions
│   │   │   └── source.py       # Source connections & mappings
│   │   └── services/            # Business logic services
│   │       ├── config.py         # Configuration service
│   │       ├── dimensions.py     # Dimension management
│   │       └── source_connections.py # Source system operations
│   ├── requirements.txt          # Python dependencies
│   └── Dockerfile              # Backend container image
│
├── reviewer-ui/                 # React frontend
│   ├── src/
│   │   ├── main.tsx           # React application root
│   │   ├── App.tsx            # Main app component
│   │   ├── api.ts             # API client functions
│   │   ├── types.ts           # TypeScript type definitions
│   │   ├── themes.ts          # Theme definitions
│   │   ├── components/        # Reusable UI components
│   │   │   └── ui.tsx       # Form, button, card primitives
│   │   ├── pages/            # Page components
│   │   │   ├── DashboardPage.tsx
│   │   │   ├── CanonicalLibraryPage.tsx
│   │   │   ├── DimensionsPage.tsx
│   │   │   ├── DimensionRelationsPage.tsx
│   │   │   ├── ConnectionsPage.tsx
│   │   │   ├── SourceConnectionDetailPage.tsx
│   │   │   ├── FieldMappingsPage.tsx
│   │   │   ├── MatchInsightsPage.tsx
│   │   │   ├── SuggestionsPage.tsx
│   │   │   ├── MappingHistoryPage.tsx
│   │   │   └── SettingsPage.tsx
│   │   ├── state/             # React Context providers
│   │   │   └── AppStateContext.tsx
│   │   └── styles.css        # Global styles
│   ├── package.json           # Node dependencies
│   ├── vite.config.ts         # Vite configuration
│   └── Dockerfile            # Frontend container image
│
├── db/                        # Database scripts
│   └── targetdb-init.sql       # Demo warehouse schema
│
├── tests/                     # Test suites
│   ├── conftest.py            # Pytest configuration
│   ├── test_api.py            # API integration tests
│   ├── test_matcher.py        # Matcher unit tests
│   ├── test_config.py         # Configuration tests
│   ├── test_database_migrations.py
│   ├── test_source_connections.py
│   ├── test_value_mapping_io.py
│   └── test_targetdb_seed.py
│
├── docs/                     # Documentation
│   ├── architecture.md
│   ├── development.md
│   ├── database-schema.md
│   ├── api.md
│   ├── deployment.md
│   └── ...
│
├── docker-compose.yml          # Multi-service orchestration
├── pytest.ini                 # Pytest configuration
└── mkdocs.yml                # Documentation site config
```

## Common Development Tasks

### Adding a New API Endpoint

1. Define Pydantic Schema in `api/app/schemas.py`
2. Define Route Handler in `api/app/routes/`
3. Register Router in `api/app/main.py`
4. Write Tests in `tests/test_api.py`

### Adding a New Frontend Page

1. Create Page Component in `reviewer-ui/src/pages/`
2. Add Type Definitions in `reviewer-ui/src/types.ts`
3. Add Route in `reviewer-ui/src/App.tsx`
4. Add API Function in `reviewer-ui/src/api.ts`

### Adding a New Canonical Dimension

1. Define dimension in UI or API
2. Add canonical values
3. Create field mappings to source systems
4. Review match insights

### Database Operations

```python
from sqlmodel import Session, select

# Create
session.add(new_value)
session.commit()

# Read
values = session.exec(
    select(CanonicalValue).where(
        CanonicalValue.dimension == "marital_status"
    )
).all()

# Update
value.canonical_label = "Unmarried"
session.add(value)
session.commit()

# Delete
session.delete(value)
session.commit()
```

### Semantic Matching Integration

```python
from ..matcher import SemanticMatcher

config = session.get(SystemConfig, 1)
canonical_values = session.exec(
    select(CanonicalValue).where(
        CanonicalValue.dimension == "marital_status"
    )
).all()

matcher = SemanticMatcher(config, canonical_values)
matches = matcher.rank("never married")
```

## Important Files

- `api/app/config.py` – System configuration settings
- `api/app/models.py` – SQLModel database models
- `api/app/matcher.py` – Semantic matching logic (TF-IDF + LLM)
- `tests/conftest.py` – Test fixtures and database setup (uses in-memory SQLite)
- `docker-compose.yml` – Multi-service orchestration with PostgreSQL, Ollama, API, and UI
- `.github/workflows/deploy-docs.yml` – GitHub Actions for documentation deployment

## Tech Stack

- **Backend:** FastAPI (Python) with SQLModel/PostgreSQL
- **Frontend:** React 18 + Vite + Tailwind CSS
- **Matching:** TF-IDF embeddings + OpenAI/Ollama LLM support
- **Testing:** Pytest (backend) + Vitest (frontend)
- **Infrastructure:** Docker Compose
