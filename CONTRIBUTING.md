# Contributing to RefData Hub

Thank you for your interest in contributing to RefData Hub! This document provides guidelines and instructions for contributing.

## Code of Conduct

- Be respectful and inclusive
- Welcome newcomers and help them learn
- Focus on constructive discussions
- Give and receive feedback gracefully

## Getting Started

### Prerequisites

- Python 3.10+
- Node.js 18+
- Docker & Docker Compose
- Git

### Fork and Clone

1. Fork the repository on GitHub
2. Clone your fork:
   ```bash
   git clone https://github.com/your-username/refdata-hub.git
   cd refdata-hub
   ```
3. Add upstream remote:
   ```bash
   git remote add upstream https://github.com/rezer-bleede/refdata-hub.git
   ```

### Development Setup

```bash
# Backend
cd api
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Frontend
cd ../reviewer-ui
npm install

# Start services
cd ..
docker compose up -d
```

See [Developer Guide](development.md) for detailed setup instructions.

---

## Workflow

### 1. Create a Branch

```bash
git checkout -b feature/your-feature-name
# or
git checkout -b fix/your-bug-fix
```

**Branch Naming Conventions:**
- `feature/` – New features
- `fix/` – Bug fixes
- `docs/` – Documentation updates
- `refactor/` – Code refactoring
- `test/` – Test additions

### 2. Make Changes

Follow the coding standards outlined below, write tests, and update documentation.

### 3. Commit Changes

```bash
git add .
git commit -m "feat: add user authentication"
```

**Commit Message Format:**

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

### 4. Push and Create Pull Request

```bash
git push origin feature/your-feature-name
```

1. Go to GitHub
2. Click "Compare & pull request"
3. Fill in the PR template
4. Link related issues
5. Request review from maintainers

---

## Coding Standards

### Python (Backend)

#### Style Guide

- Follow [PEP 8](https://pep8.org/)
- Use [Black](https://black.readthedocs.io/) for formatting
- Maximum line length: 100 characters
- Use type hints for all functions
- Write docstrings in Google style

#### Code Organization

```python
"""Module docstring explaining purpose."""

from __future__ import annotations

from typing import Optional
import fastapi
from . import local_module


class MyClass:
    """Class docstring."""

    def __init__(self, param: str):
        """Initialize the class.

        Args:
            param: Description of parameter.
        """
        self.param = param

    def my_method(self) -> Optional[int]:
        """Method docstring.

        Returns:
            Description of return value.
        """
        result = self._process()
        return result

    def _private_method(self) -> int:
        """Private method docstring."""
        return 42
```

#### Error Handling

```python
from fastapi import HTTPException
from sqlmodel import Session, select

def get_canonical_value(id: int, session: Session) -> CanonicalValue:
    """Get canonical value by ID."""
    value = session.get(CanonicalValue, id)
    if not value:
        raise HTTPException(
            status_code=404,
            detail=f"Canonical value with ID {id} not found"
        )
    return value
```

#### Database Operations

```python
from sqlmodel import Session, select

# Use context managers for transactions
def create_value(payload: dict, session: Session):
    """Create a canonical value."""
    with session:
        db_value = CanonicalValue(**payload)
        session.add(db_value)
        session.commit()
        session.refresh(db_value)
    return db_value

# Use select for queries
def get_values_by_dimension(dimension: str, session: Session):
    """Get all values for a dimension."""
    return session.exec(
        select(CanonicalValue).where(
            CanonicalValue.dimension == dimension
        )
    ).all()
```

### TypeScript (Frontend)

#### Style Guide

- Use ESLint with the provided configuration
- Use Prettier for formatting
- Prefer functional components with hooks
- Use TypeScript strictly (no `any` types)

#### Component Structure

```tsx
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchSomething } from '../api';

interface Props {
  title: string;
  onAction: () => void;
}

export function MyComponent({ title, onAction }: Props) {
  const [loading, setLoading] = React.useState(false);
  const navigate = useNavigate();

  const handleClick = async () => {
    setLoading(true);
    try {
      await fetchSomething();
      navigate('/success');
    } catch (error) {
      console.error('Failed:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4">
      <h2>{title}</h2>
      <button
        onClick={handleClick}
        disabled={loading}
        className="px-4 py-2 bg-blue-600 text-white rounded"
      >
        {loading ? 'Loading...' : 'Action'}
      </button>
    </div>
  );
}
```

#### API Calls

```tsx
import { useEffect, useState } from 'react';
import { fetchCanonicalValues, type CanonicalValue } from '../api';

export function CanonicalLibrary() {
  const [values, setValues] = useState<CanonicalValue[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchCanonicalValues()
      .then(setValues)
      .catch(err => setError(err.message));
  }, []);

  if (error) return <div>Error: {error}</div>;
  if (values.length === 0) return <div>Loading...</div>;

  return (
    <ul>
      {values.map(v => (
        <li key={v.id}>{v.canonical_label}</li>
      ))}
    </ul>
  );
}
```

---

## Testing

### Backend Tests

```python
import pytest
from fastapi.testclient import TestClient
from api.app.models import CanonicalValue

def test_create_canonical_value(client):
    """Test creating a canonical value."""
    response = client.post(
        "/api/reference/canonical",
        json={
            "dimension": "status",
            "canonical_label": "Active"
        }
    )
    
    assert response.status_code == 200
    data = response.json()
    assert data["dimension"] == "status"
    assert data["canonical_label"] == "Active"
    assert "id" in data

def test_create_canonical_value_invalid_dimension(client):
    """Test creating value with invalid dimension."""
    response = client.post(
        "/api/reference/canonical",
        json={
            "dimension": "",
            "canonical_label": "Active"
        }
    )
    
    assert response.status_code == 422  # Validation error
```

### Frontend Tests

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MyComponent } from './MyComponent';

describe('MyComponent', () => {
  it('renders with title', () => {
    render(<MyComponent title="Test" />);
    expect(screen.getByText('Test')).toBeInTheDocument();
  });

  it('calls action on click', async () => {
    const handleAction = vi.fn();
    render(<MyComponent onAction={handleAction} />);
    
    const button = screen.getByRole('button');
    await userEvent.click(button);
    
    expect(handleAction).toHaveBeenCalled();
  });
});
```

**Testing Requirements:**
- All new features must have tests
- Maintain > 70% code coverage
- Write unit tests for business logic
- Write integration tests for API endpoints
- Write component tests for UI changes

---

## Documentation

### Updating Docs

1. Update relevant markdown files in `/docs`
2. Update API reference if endpoints changed
3. Update CHANGELOG.md for new features
4. Review for clarity and completeness

### Documentation Style

- Use clear, concise language
- Include code examples
- Add diagrams where helpful
- Keep user-facing docs separate from dev docs

---

## Pull Request Guidelines

### Before Submitting

- [ ] Code follows project style guidelines
- [ ] Tests pass locally (`pytest` and `npm test`)
- [ ] New tests added for new functionality
- [ ] Documentation updated
- [ ] Commit messages follow conventional commits
- [ ] No merge conflicts with main branch
- [ ] All commits in the PR are yours (no merge commits)

### PR Template

When creating a pull request, fill in:

**Description:**
- Brief description of changes
- Motivation for the change
- Link to related issues

**Type of Change:**
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

**Testing:**
- [ ] Unit tests pass
- [ ] Integration tests pass
- [ ] Manual testing completed

**Checklist:**
- [ ] Code follows style guidelines
- [ ] Self-review of code completed
- [ ] Commented complex code
- [ ] Updated documentation
- [ ] No new warnings generated

---

## Project Structure

```
/refdata-hub
├── api/              # Backend code
│   └── app/
│       ├── main.py       # Application entry
│       ├── models.py     # Database models
│       ├── schemas.py    # Pydantic schemas
│       ├── routes/       # API endpoints
│       └── services/     # Business logic
├── reviewer-ui/      # Frontend code
│   └── src/
│       ├── pages/       # Page components
│       ├── components/  # Shared components
│       ├── api.ts       # API client
│       └── types.ts     # TypeScript types
├── tests/            # Test suites
├── docs/             # Documentation
└── mkdocs.yml        # Docs configuration
```

---

## Getting Help

### Resources

- [Documentation](https://rezer-bleede.github.io/refdata-hub/)
- [API Reference](http://localhost:8000/docs)
- [Issues](https://github.com/rezer-bleede/refdata-hub/issues)
- [Discussions](https://github.com/rezer-bleede/refdata-hub/discussions)

### Asking Questions

1. Search existing issues and discussions
2. Create a discussion for questions
3. Use issue template for bugs
4. Be specific and provide context

---

## Release Process

Maintainers follow these steps for releases:

1. Update version in package files
2. Update CHANGELOG.md
3. Create git tag: `git tag -a v1.0.0 -m "Release v1.0.0"`
4. Push tag: `git push upstream v1.0.0`
5. GitHub Actions will build and publish

---

## Recognition

Contributors will be:
- Listed in CONTRIBUTORS.md
- Mentioned in release notes
- Invited to join the organization (for significant contributions)

---

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
