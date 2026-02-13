# Developer Guide

This guide helps you set up a local development environment and understand the project structure for contributing to RefData Hub.

## Prerequisites

### Required Tools

- **Python 3.10+** – Backend development
- **Node.js 18+** – Frontend development
- **Docker & Docker Compose** – Local infrastructure
- **Git** – Version control
- **PostgreSQL client** – (Optional) For direct database access

### Recommended Tools

- **VS Code** – IDE with Python/TypeScript extensions
- **Postman** – API testing
- **pgAdmin** – Database management
- **Chrome DevTools** – Frontend debugging

## Local Development Setup

### Option 1: Docker Compose (Recommended)

Fastest way to get all services running:

```bash
# Clone repository
git clone https://github.com/rezer-bleede/refdata-hub.git
cd refdata-hub

# Start all services
docker compose up --build

# Access services
# - Reviewer UI: http://localhost:5274
# - API: http://localhost:8000
# - API Docs: http://localhost:8000/docs
# - PostgreSQL: localhost:5432
# - Target DB: localhost:5433
```

### Option 2: Manual Setup

For development with hot reload and debugging.

#### Backend Setup

```bash
# Create virtual environment
cd api
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Set environment variables
export REFDATA_DATABASE_URL="postgresql+psycopg://refdata:refdata@localhost:5432/refdata"
export REFDATA_CORS_ORIGINS="http://localhost:5274"

# Start development server
uvicorn app.main:app --reload --port 8000
```

#### Frontend Setup

```bash
# Install dependencies
cd reviewer-ui
npm install

# Set API base URL
export VITE_API_BASE_URL="http://localhost:8000"

# Start development server
npm run dev
```

#### Database Setup

```bash
# Start PostgreSQL (if not using Docker)
docker run -d \
  --name refdata-db \
  -e POSTGRES_DB=refdata \
  -e POSTGRES_USER=refdata \
  -e POSTGRES_PASSWORD=refdata \
  -p 5432:5432 \
  postgres:15-alpine

# The backend auto-initializes schema on first run
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
├── mkdocs.yml                # Documentation site config
├── README.md                  # Project overview
└── LICENSE                    # MIT License
```

## Backend Development Workflow

### Adding a New API Endpoint

1. **Define Pydantic Schema** (`api/app/schemas.py`):
```python
from pydantic import BaseModel
from typing import Optional

class MyResourceCreate(BaseModel):
    name: str
    value: Optional[int] = None

class MyResourceRead(BaseModel):
    id: int
    name: str
    value: Optional[int] = None
```

2. **Define Route Handler** (`api/app/routes/`):
```python
from fastapi import APIRouter, HTTPException, Depends
from sqlmodel import Session, select
from ..database import get_session
from ..schemas import MyResourceCreate, MyResourceRead

router = APIRouter(prefix="/my-resources", tags=["my-resources"])

@router.post("/", response_model=MyResourceRead)
def create_resource(
    payload: MyResourceCreate,
    session: Session = Depends(get_session)
):
    db_resource = MyResource(**payload.dict())
    session.add(db_resource)
    session.commit()
    session.refresh(db_resource)
    return db_resource
```

3. **Register Router** (`api/app/main.py`):
```python
from .routes import my_resources as my_resources_routes

api_router.include_router(my_resources_routes.router)
```

4. **Write Tests** (`tests/test_api.py`):
```python
def test_create_my_resource(client):
    response = client.post(
        "/api/my-resources/",
        json={"name": "Test", "value": 42}
    )
    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "Test"
```

### Working with Database

```python
from sqlmodel import Session, select
from ..models import CanonicalValue

# Create
new_value = CanonicalValue(
    dimension="marital_status",
    canonical_label="Single"
)
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
from ..models import CanonicalValue, SystemConfig

# Get config and canonical values
config = session.get(SystemConfig, 1)
canonical_values = session.exec(
    select(CanonicalValue).where(
        CanonicalValue.dimension == "marital_status"
    )
).all()

# Create matcher and rank
matcher = SemanticMatcher(config, canonical_values)
matches = matcher.rank("never married")
```

## Frontend Development Workflow

### Adding a New Page

1. **Create Page Component** (`reviewer-ui/src/pages/MyNewPage.tsx`):
```tsx
import React from 'react';
import { fetchMyData } from '../api';

export function MyNewPage() {
  const [data, setData] = React.useState([]);

  React.useEffect(() => {
    fetchMyData().then(setData);
  }, []);

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold">My Page</h1>
      {/* content */}
    </div>
  );
}
```

2. **Add Type Definitions** (`reviewer-ui/src/types.ts`):
```typescript
export interface MyData {
  id: number;
  name: string;
  value: number;
}

export async function fetchMyData(): Promise<MyData[]> {
  return apiFetchJson<MyData[]>('/api/my-data');
}
```

3. **Add Route** (`reviewer-ui/src/App.tsx`):
```tsx
import { MyNewPage } from './pages/MyNewPage';

// Add to navigation items
const navItems = [
  // ... existing items
  { path: '/my-new-page', label: 'My Page', icon: StarIcon },
];
```

4. **Add API Function** (`reviewer-ui/src/api.ts`):
```typescript
export async function fetchMyData(): Promise<MyData[]> {
  return apiFetchJson<MyData[]>('/api/my-resources');
}
```

### Using Shared UI Components

```tsx
import { Form, Button, Card } from './components/ui';

export function MyForm() {
  return (
    <Card>
      <Form onSubmit={handleSubmit}>
        <Form.Group>
          <Form.Label>Name</Form.Label>
          <Form.Control type="text" name="name" />
        </Form.Group>
        <Button type="submit">Save</Button>
      </Form>
    </Card>
  );
}
```

### Styling with Tailwind

```tsx
// Use Tailwind utility classes
<div className="flex items-center justify-between p-4 bg-white rounded-lg shadow">
  <h2 className="text-xl font-semibold text-gray-900">Title</h2>
  <button className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
    Action
  </button>
</div>
```

## Database Development

### Viewing Schema

```bash
# Connect to database
docker exec -it refdata-hub-db-1 psql -U refdata -d refdata

# List tables
\dt

# Describe table
\d canonicalvalue

# Run queries
SELECT * FROM canonicalvalue LIMIT 10;
```

### Adding Migrations

The project uses auto-migration via SQLModel:

```python
# In api/app/database.py
def init_db(engine: Engine, settings: Settings):
    SQLModel.metadata.create_all(engine)
    # Schema created automatically
```

For complex changes, use SQL scripts:

```bash
# Create migration file
cat > db/migrations/001_add_new_column.sql << EOF
ALTER TABLE canonicalvalue ADD COLUMN new_field TEXT;
EOF

# Apply migration
docker exec -i refdata-hub-db-1 psql -U refdata -d refdata < db/migrations/001_add_new_column.sql
```

## Testing

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

### Test Database Setup

Tests use an in-memory SQLite database by default (configured in `tests/conftest.py`):

```python
import pytest
from sqlmodel import create_engine, Session
from sqlmodel import SQLModel

@pytest.fixture
def session():
    engine = create_engine("sqlite:///:memory:")
    SQLModel.metadata.create_all(engine)
    with Session(engine) as session:
        yield session
```

## Debugging

### Backend Debugging

```bash
# Enable debug logging
export LOG_LEVEL=DEBUG

# Run with VS Code debugger
# Create .vscode/launch.json:
{
  "name": "FastAPI",
  "type": "debugpy",
  "request": "launch",
  "module": "uvicorn",
  "args": ["app.main:app", "--reload"],
  "jinja": true
}
```

### Frontend Debugging

```bash
# Chrome DevTools integration
npm run dev

# Set breakpoints in VS Code
# .vscode/launch.json:
{
  "name": "Chrome",
  "type": "chrome",
  "request": "launch",
  "url": "http://localhost:5274",
  "webRoot": "${workspaceFolder}/reviewer-ui"
}
```

### Database Debugging

```bash
# Enable query logging
export REFDATA_SQLALCHEMY_LOG_LEVEL=DEBUG

# View slow queries
docker exec refdata-hub-db-1 psql -U refdata -d refdata \
  -c "SELECT * FROM pg_stat_statements ORDER BY total_time DESC LIMIT 10;"
```

## Code Style Guidelines

### Python (Backend)

- **PEP 8** style guide
- **Black** formatter (80 character line length)
- **Type hints** required for all functions
- **Docstrings** using Google style
- **Imports** grouped: stdlib, third-party, local

```python
"""Module docstring."""

from typing import Optional
import fastapi
from . import local_module


def my_function(param: str) -> Optional[int]:
    """Function docstring.

    Args:
        param: Description of parameter.

    Returns:
        Description of return value.
    """
    result = process(param)
    return result
```

### TypeScript (Frontend)

- **ESLint** configuration in `.eslintrc.json`
- **Prettier** for formatting
- **Functional components** with hooks
- **TypeScript strict mode** enabled

```tsx
import React from 'react';

interface Props {
  title: string;
  onClick: () => void;
}

export function MyComponent({ title, onClick }: Props) {
  return (
    <button onClick={onClick}>{title}</button>
  );
}
```

## Common Development Tasks

### Adding a New Canonical Dimension

1. Define dimension in UI or API
2. Add canonical values
3. Create field mappings to source systems
4. Review match insights

### Customizing Semantic Matching

1. Modify `api/app/matcher.py`
2. Test with various inputs
3. Adjust confidence thresholds in settings
4. Monitor match accuracy

### Adding Source Connection Type

1. Update `SourceConnection` model if needed
2. Add connection logic in `api/app/services/source_connections.py`
3. Update UI form fields
4. Test connection validation

## Performance Tips

### Backend

- Use database indexes on frequently queried columns
- Implement pagination for large datasets
- Use `select_in` for batch queries
- Cache canonical values in memory
- Use connection pooling

### Frontend

- Use React.memo for expensive renders
- Implement virtual scrolling for long lists
- Debounce search inputs
- Lazy load routes with React.lazy()
- Optimize images and assets

## Getting Help

- **Documentation:** See `/docs` folder
- **API Docs:** http://localhost:8000/docs
- **Issues:** https://github.com/rezer-bleede/refdata-hub/issues
- **Discussions:** https://github.com/rezer-bleede/refdata-hub/discussions
