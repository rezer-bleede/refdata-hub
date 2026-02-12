# Testing Guide

This guide covers testing strategies, test execution, and best practices for RefData Hub.

## Test Overview

RefData Hub uses two testing frameworks:

- **Backend:** pytest for Python unit and integration tests
- **Frontend:** Vitest for React component and integration tests

## Backend Testing (Pytest)

### Prerequisites

```bash
cd api

# Create virtual environment
python -m venv venv
source venv/bin/activate

# Install dependencies with test extras
pip install -r requirements.txt
pip install pytest pytest-cov pytest-asyncio httpx
```

### Running Tests

```bash
# Run all tests
pytest

# Run with verbose output
pytest -v

# Run specific test file
pytest tests/test_matcher.py

# Run specific test
pytest tests/test_matcher.py::test_rank_with_embeddings

# Run with coverage
pytest --cov=app --cov-report=html

# Run integration tests only
pytest -m integration
```

### Test Structure

```
tests/
├── conftest.py              # Pytest configuration and fixtures
├── test_api.py              # API integration tests
├── test_matcher.py           # Matcher unit tests
├── test_config.py            # Configuration tests
├── test_database_migrations.py
├── test_source_connections.py
├── test_value_mapping_io.py
└── test_targetdb_seed.py
```

### Fixtures

**File:** `tests/conftest.py`

```python
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlmodel import Session, SQLModel

from api.app.main import app
from api.app.database import get_session

# Test database (SQLite in-memory)
@pytest.fixture
def test_db():
    engine = create_engine("sqlite:///:memory:")
    SQLModel.metadata.create_all(engine)
    with Session(engine) as session:
        yield session

# Override dependency
@pytest.fixture
def client(test_db):
    def override_get_session():
        return test_db

    app.dependency_overrides[get_session] = override_get_session
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()
```

### Writing Tests

#### Unit Tests

**Example:** `tests/test_matcher.py`

```python
import pytest
from api.app.matcher import SemanticMatcher
from api.app.models import CanonicalValue, SystemConfig

def test_rank_with_embeddings():
    """Test TF-IDF embedding matching."""
    config = SystemConfig(
        matcher_backend="embedding",
        top_k=5
    )
    
    canonical_values = [
        CanonicalValue(
            id=1,
            dimension="marital_status",
            canonical_label="Single",
            description="Never married"
        ),
        CanonicalValue(
            id=2,
            dimension="marital_status",
            canonical_label="Married",
            description="Currently married"
        )
    ]
    
    matcher = SemanticMatcher(config, canonical_values)
    matches = matcher.rank("unmarried")
    
    assert len(matches) > 0
    assert matches[0].score > 0.5
    assert matches[0].canonical_id == 1
```

#### Integration Tests

**Example:** `tests/test_api.py`

```python
def test_create_canonical_value(client):
    """Test creating a canonical value via API."""
    response = client.post(
        "/api/reference/canonical",
        json={
            "dimension": "marital_status",
            "canonical_label": "Divorced"
        }
    )
    
    assert response.status_code == 200
    data = response.json()
    assert data["dimension"] == "marital_status"
    assert data["canonical_label"] == "Divorced"
    assert "id" in data

def test_get_canonical_values(client, test_db):
    """Test retrieving canonical values."""
    # Seed test data
    from api.app.models import CanonicalValue
    test_db.add(CanonicalValue(
        dimension="education",
        canonical_label="Bachelor"
    ))
    test_db.commit()
    
    # Fetch from API
    response = client.get("/api/reference/canonical")
    
    assert response.status_code == 200
    data = response.json()
    assert len(data) >= 1
    assert any(v["canonical_label"] == "Bachelor" for v in data)
```

### Test Markers

Use markers to categorize tests:

```python
import pytest

@pytest.mark.unit
def test_matcher_ranking():
    pass

@pytest.mark.integration
def test_api_endpoint():
    pass

@pytest.mark.slow
def test_large_import():
    pass
```

Run specific markers:

```bash
pytest -m unit        # Only unit tests
pytest -m integration # Only integration tests
pytest -m "not slow" # Skip slow tests
```

### Async Tests

```python
import pytest

@pytest.mark.asyncio
async def test_async_operation():
    result = await some_async_function()
    assert result is not None
```

---

## Frontend Testing (Vitest)

### Prerequisites

```bash
cd reviewer-ui

# Install dependencies
npm install
```

### Running Tests

```bash
# Run all tests
npm test

# Run in watch mode
npm test -- --watch

# Run with coverage
npm test -- --coverage

# Run specific file
npm test -- CanonicalLibraryPage.test.tsx

# Run UI mode (helps debug)
npm test -- --ui
```

### Test Structure

```
reviewer-ui/src/
├── components/
│   └── ui.test.tsx        # UI component tests
├── pages/
│   ├── CanonicalLibraryPage.test.tsx
│   ├── ConnectionsPage.test.tsx
│   ├── FieldMappingsPage.test.tsx
│   ├── MatchInsightsPage.test.tsx
│   └── ...
├── api.test.ts              # API client tests
├── App.test.tsx            # Main app tests
└── indexHtml.test.ts        # Index page tests
```

### Writing Component Tests

**Example:** `reviewer-ui/src/components/ui.test.tsx`

```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Form, Button } from './ui';

describe('UI Components', () => {
  describe('Button', () => {
    it('renders button with text', () => {
      render(<Button>Click me</Button>);
      expect(screen.getByText('Click me')).toBeInTheDocument();
    });

    it('calls onClick handler', async () => {
      const handleClick = vi.fn();
      render(<Button onClick={handleClick}>Click me</Button>);
      
      const button = screen.getByText('Click me');
      await userEvent.click(button);
      
      expect(handleClick).toHaveBeenCalledTimes(1);
    });
  });

  describe('Form', () => {
    it('renders form with fields', () => {
      render(
        <Form onSubmit={() => {}}>
          <Form.Group>
            <Form.Label>Name</Form.Label>
            <Form.Control type="text" name="name" />
          </Form.Group>
        </Form>
      );
      
      expect(screen.getByLabelText('Name')).toBeInTheDocument();
    });
  });
});
```

### Writing Page Tests

**Example:** `reviewer-ui/src/pages/CanonicalLibraryPage.test.tsx`

```tsx
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { CanonicalLibraryPage } from './CanonicalLibraryPage';
import * as api from '../api';

// Mock API calls
vi.mock('../api', () => ({
  fetchCanonicalValues: vi.fn(),
  createCanonicalValue: vi.fn(),
}));

describe('CanonicalLibraryPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('displays canonical values after loading', async () => {
    const mockValues = [
      { id: 1, dimension: 'status', canonical_label: 'Active' },
      { id: 2, dimension: 'status', canonical_label: 'Inactive' },
    ];
    
    vi.mocked(api.fetchCanonicalValues).mockResolvedValue(mockValues);
    
    render(<CanonicalLibraryPage />);
    
    await waitFor(() => {
      expect(screen.getByText('Active')).toBeInTheDocument();
      expect(screen.getByText('Inactive')).toBeInTheDocument();
    });
  });

  it('shows loading state initially', () => {
    vi.mocked(api.fetchCanonicalValues).mockReturnValue(new Promise(() => {}));
    
    render(<CanonicalLibraryPage />);
    
    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });

  it('handles error state', async () => {
    vi.mocked(api.fetchCanonicalValues).mockRejectedValue(
      new Error('Failed to fetch')
    );
    
    render(<CanonicalLibraryPage />);
    
    await waitFor(() => {
      expect(screen.getByText(/error/i)).toBeInTheDocument();
    });
  });
});
```

### Writing API Client Tests

**Example:** `reviewer-ui/src/api.test.ts`

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchCanonicalValues, createCanonicalValue } from './api';

describe('API Client', () => {
  beforeEach(() => {
    global.fetch = vi.fn();
  });

  it('fetches canonical values', async () => {
    const mockResponse = [
      { id: 1, dimension: 'status', canonical_label: 'Active' },
    ];
    
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => mockResponse,
    } as Response);
    
    const values = await fetchCanonicalValues();
    
    expect(values).toEqual(mockResponse);
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/reference/canonical')
    );
  });

  it('creates canonical value', async () => {
    const new_value = {
      dimension: 'status',
      canonical_label: 'Pending',
    };
    
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ id: 2, ...new_value }),
    } as Response);
    
    const result = await createCanonicalValue(new_value);
    
    expect(result).toEqual({ id: 2, ...new_value });
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/reference/canonical'),
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
        }),
        body: expect.stringContaining(JSON.stringify(new_value)),
      })
    );
  });
});
```

### Testing User Interactions

```tsx
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MyForm } from './MyForm';

describe('MyForm', () => {
  it('submits form with entered data', async () => {
    const handleSubmit = vi.fn();
    render(<MyForm onSubmit={handleSubmit} />);
    
    // Type into input
    const input = screen.getByLabelText('Name');
    await userEvent.type(input, 'John Doe');
    
    // Click submit
    const button = screen.getByText('Submit');
    await userEvent.click(button);
    
    // Verify submission
    await waitFor(() => {
      expect(handleSubmit).toHaveBeenCalledWith({ name: 'John Doe' });
    });
  });
});
```

---

## Integration Tests

### End-to-End Test Example

**File:** `tests/test_e2e.py`

```python
def test_full_mapping_workflow(client, test_db):
    """Test complete workflow from connection to mapping."""
    
    # 1. Create dimension
    dimension_response = client.post(
        "/api/reference/dimensions",
        json={"code": "status", "label": "Status"}
    )
    assert dimension_response.status_code == 200
    
    # 2. Create canonical values
    client.post("/api/reference/canonical", json={
        "dimension": "status",
        "canonical_label": "Active"
    })
    client.post("/api/reference/canonical", json={
        "dimension": "status",
        "canonical_label": "Inactive"
    })
    
    # 3. Create source connection
    connection_response = client.post(
        "/api/source/connections",
        json={
            "name": "Test DB",
            "db_type": "postgres",
            "host": "localhost",
            "port": 5432,
            "database": "test",
            "username": "user",
            "password": "pass"
        }
    )
    assert connection_response.status_code == 200
    connection_id = connection_response.json()["id"]
    
    # 4. Create field mapping
    mapping_response = client.post(
        f"/api/source/connections/{connection_id}/mappings",
        json={
            "source_table": "customers",
            "source_field": "status_raw",
            "ref_dimension": "status"
        }
    )
    assert mapping_response.status_code == 200
    
    # 5. Ingest samples
    client.post(
        f"/api/source/connections/{connection_id}/samples",
        json={
            "source_table": "customers",
            "source_field": "status_raw",
            "values": [
                {"raw_value": "active", "count": 100},
                {"raw_value": "inactive", "count": 50}
            ]
        }
    )
    
    # 6. Get match statistics
    stats_response = client.get(
        f"/api/source/connections/{connection_id}/match-stats"
    )
    assert stats_response.status_code == 200
    stats = stats_response.json()
    
    assert len(stats) > 0
    assert stats[0]["match_rate"] > 0
```

---

## Test Coverage

### Backend Coverage

```bash
# Run tests with coverage
pytest --cov=app --cov-report=html

# View report
open htmlcov/index.html  # macOS
xdg-open htmlcov/index.html  # Linux
```

**Target Coverage:**
- Unit tests: > 80%
- Integration tests: > 60%
- Overall: > 70%

### Frontend Coverage

```bash
# Run tests with coverage
npm test -- --coverage

# View report
open coverage/index.html  # macOS
```

---

## Mocking and Stubbing

### Backend Mocking

```python
import pytest
from unittest.mock import patch, MagicMock

def test_with_mocked_llm():
    """Test matcher with mocked LLM."""
    with patch('api.app.matcher.openai.ChatCompletion.create') as mock_llm:
        mock_llm.return_value = {
            "choices": [{
                "message": {
                    "content": '[{"id": 1, "score": 0.9}]'
                }
            }]
        }
        
        # Run code that uses LLM
        result = some_function_that_uses_llm()
        
        # Verify LLM was called
        mock_llm.assert_called_once()
        assert result is not None
```

### Frontend Mocking

```tsx
import { render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import { MyComponent } from './MyComponent';

describe('MyComponent', () => {
  it('uses mocked API', () => {
    const mockFn = vi.fn();
    mockFn.mockResolvedValue({ data: 'test' });
    
    render(<MyComponent fetchData={mockFn} />);
    
    expect(mockFn).toHaveBeenCalled();
  });
});
```

---

## Test Best Practices

### Backend

1. **Isolate Tests:** Each test should be independent
2. **Use Fixtures:** Reuse test setup with pytest fixtures
3. **Mock External Dependencies:** Don't make real API calls
4. **Test Edge Cases:** Empty inputs, null values, errors
5. **Use Descriptive Names:** `test_create_canonical_value_success`
6. **Arrange-Act-Assert Pattern:**
   ```python
   def test_example():
       # Arrange
       input = "test"
       
       # Act
       result = process(input)
       
       # Assert
       assert result == expected
   ```

### Frontend

1. **Test User Behavior, Not Implementation:** Focus on what users see
2. **Use waitFor for Async:** Wait for elements to appear
3. **Mock API Calls:** Don't make real network requests
4. **Test Accessibility:** Use getByRole, getByLabel
5. **Avoid Implementation Details:** Don't test React internals

---

## Continuous Integration

### GitHub Actions Example

**File:** `.github/workflows/test.yml`

```yaml
name: Tests

on: [push, pull_request]

jobs:
  backend:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Set up Python
      uses: actions/setup-python@v4
      with:
        python-version: '3.10'
    
    - name: Install dependencies
      run: |
        cd api
        pip install -r requirements.txt
        pip install pytest pytest-cov
    
    - name: Run tests
      run: |
        cd api
        pytest --cov=app --cov-report=xml
    
    - name: Upload coverage
      uses: codecov/codecov-action@v3
      with:
        files: ./api/coverage.xml

  frontend:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: '18'
    
    - name: Install dependencies
      run: |
        cd reviewer-ui
        npm ci
    
    - name: Run tests
      run: |
        cd reviewer-ui
        npm test -- --coverage
    
    - name: Upload coverage
      uses: codecov/codecov-action@v3
      with:
        files: ./reviewer-ui/coverage/coverage-final.json
```

---

## Troubleshooting

### Tests Failing with Import Errors

**Issue:** `ModuleNotFoundError: No module named 'api'`

**Solution:**
```bash
# Add project root to Python path
export PYTHONPATH="${PYTHONPATH}:/path/to/refdata-hub"

# Or use pytest.ini configuration
# [pytest]
# pythonpath = .
```

### Frontend Tests Failing

**Issue:** Tests fail in CI but pass locally

**Solutions:**
1. Check for timezone differences (use fake timers)
2. Ensure proper cleanup between tests
3. Check for race conditions in async tests
4. Use `waitFor` instead of `find` for dynamic content

### Slow Tests

**Solutions:**
1. Mark slow tests with `@pytest.mark.slow`
2. Skip in CI with `pytest -m "not slow"`
3. Use in-memory database instead of PostgreSQL
4. Mock expensive operations (LLM calls)

---

## Additional Resources

- [Pytest Documentation](https://docs.pytest.org/)
- [Vitest Documentation](https://vitest.dev/)
- [React Testing Library](https://testing-library.com/react)
- [Python Testing Best Practices](https://docs.python-guide.org/writing/tests/)
- [JavaScript Testing Best Practices](https://github.com/goldbergyoni/javascript-testing-best-practices)
