# Configuration Reference

This document details all configuration options for RefData Hub, including system settings, environment variables, and Docker Compose overrides.

## System Configuration

The `systemconfig` table stores application-wide settings. These can be modified via the API or Reviewer UI (Settings page).

### Configuration Fields

| Field | Type | Default | Description |
|-------|------|----------|-------------|
| `default_dimension` | VARCHAR | 'general' | Default dimension for semantic matching |
| `match_threshold` | FLOAT | 0.6 | Minimum confidence score (0.0-1.0) for auto-approval |
| `matcher_backend` | VARCHAR | 'embedding' | Primary matching strategy: 'embedding' or 'llm' |
| `embedding_model` | VARCHAR | 'tfidf' | Embedding model: 'tfidf' (currently only option) |
| `llm_mode` | VARCHAR | 'online' | LLM operation mode: 'online' or 'offline' |
| `llm_model` | VARCHAR | 'gpt-3.5-turbo' | LLM model name (e.g., 'gpt-3.5-turbo', 'llama3') |
| `llm_api_base` | VARCHAR | NULL | API endpoint URL for LLM service |
| `llm_api_key` | VARCHAR | NULL | API key for LLM authentication |
| `top_k` | INTEGER | 5 | Number of match candidates to return |

<figure>
  <img src="../screenshots/settings/matcher-config.png" alt="Matcher Settings" width="1000">
  <figcaption>Configure matcher thresholds and matching strategy</figcaption>
</figure>

<figure>
  <img src="../screenshots/settings/llm-settings.png" alt="LLM Settings" width="1000">
  <figcaption>Configure LLM connectivity and model settings</figcaption>
</figure>

### Configuration via API

**Get Configuration:**
```bash
curl http://localhost:8000/api/config
```

**Update Configuration:**
```bash
curl -X PUT http://localhost:8000/api/config \
  -H "Content-Type: application/json" \
  -d '{
    "match_threshold": 0.75,
    "matcher_backend": "llm",
    "llm_mode": "offline",
    "llm_model": "llama3",
    "top_k": 10
  }'
```

---

## Environment Variables

Environment variables control runtime behavior and are typically set in:

- **Docker Compose:** `.env` file or `docker-compose.yml`
- **Kubernetes:** ConfigMap and Secret resources
- **Direct:** Shell environment or systemd service

### Backend Environment Variables

#### Database Configuration

| Variable | Required | Default | Description |
|----------|-----------|----------|-------------|
| `REFDATA_DATABASE_URL` | Yes | - | PostgreSQL connection string in SQLAlchemy format |

**Format:**
```
postgresql+psycopg://[user]:[password]@[host]:[port]/[database]
```

**Examples:**
```bash
# Local development
export REFDATA_DATABASE_URL="postgresql+psycopg://refdata:refdata@localhost:5432/refdata"

# Docker Compose
export REFDATA_DATABASE_URL="postgresql+psycopg://refdata:refdata@db:5432/refdata"

# Production with SSL
export REFDATA_DATABASE_URL="postgresql+psycopg://user:pass@host:5432/db?sslmode=require"
```

#### CORS Configuration

| Variable | Required | Default | Description |
|----------|-----------|----------|-------------|
| `REFDATA_CORS_ORIGINS` | No | * | Comma-separated list of allowed origins |

**Examples:**
```bash
# Development
export REFDATA_CORS_ORIGINS="http://localhost:5274,http://127.0.0.1:5274"

# Production
export REFDATA_CORS_ORIGINS="https://refdata.example.com,https://app.refdata.com"

# Allow all (not recommended for production)
export REFDATA_CORS_ORIGINS="*"
```

#### LLM Configuration

| Variable | Required | Default | Description |
|----------|-----------|----------|-------------|
| `REFDATA_LLM_MODE` | No | online | LLM mode: 'online' or 'offline' |
| `REFDATA_LLM_MODEL` | No | gpt-3.5-turbo | LLM model identifier |
| `REFDATA_LLM_API_BASE` | No | https://api.openai.com | LLM API endpoint URL |
| `REFDATA_LLM_API_KEY` | No | - | API key for LLM authentication |

**Examples:**

**OpenAI (Online Mode):**
```bash
export REFDATA_LLM_MODE="online"
export REFDATA_LLM_MODEL="gpt-3.5-turbo"
export REFDATA_LLM_API_BASE="https://api.openai.com/v1"
export REFDATA_LLM_API_KEY="sk-your-openai-api-key"
```

**Ollama (Offline Mode):**
```bash
export REFDATA_LLM_MODE="offline"
export REFDATA_LLM_MODEL="llama3"
export REFDATA_LLM_API_BASE="http://ollama:11434"
export REFDATA_LLM_API_KEY=""  # Not needed for Ollama
```

**Custom OpenAI-Compatible Endpoint:**
```bash
export REFDATA_LLM_MODE="online"
export REFDATA_LLM_MODEL="your-model-name"
export REFDATA_LLM_API_BASE="https://your-llm-endpoint.com/v1"
export REFDATA_LLM_API_KEY="your-custom-api-key"
```

#### Logging Configuration

| Variable | Required | Default | Description |
|----------|-----------|----------|-------------|
| `LOG_LEVEL` | No | INFO | Application log level |
| `REFDATA_SQLALCHEMY_LOG_LEVEL` | No | WARNING | SQLAlchemy-specific log level |

**Valid Values:**
- `DEBUG` – Detailed diagnostic information
- `INFO` – General informational messages
- `WARNING` – Warning messages for potentially harmful situations
- `ERROR` – Error messages for serious problems

**Examples:**
```bash
export LOG_LEVEL="DEBUG"
export REFDATA_SQLALCHEMY_LOG_LEVEL="INFO"
```

### Frontend Environment Variables

| Variable | Required | Default | Description |
|----------|-----------|----------|-------------|
| `VITE_API_BASE_URL` | No | http://localhost:8000 | Backend API base URL |

**Examples:**
```bash
# Development
export VITE_API_BASE_URL="http://localhost:8000"

# Production
export VITE_API_BASE_URL="https://api.refdata.example.com"

# Relative path (when served from same domain)
export VITE_API_BASE_URL="/api"
```

### Cloudflare Pages Functions Variables

These variables are used by the `reviewer-ui/functions` backend layer.

| Variable | Required | Default | Description |
|----------|-----------|----------|-------------|
| `DATABASE_URL` | Conditional | - | Direct Postgres URL fallback when Hyperdrive binding is not configured |
| `COMPANION_API_BASE_URL` | Yes (for companion-backed routes) | - | Base URL for heavy/dynamic route proxy |
| `COMPANION_API_TOKEN` | Yes | - | Shared secret used for bearer auth + request signing |
| `COMPANION_TIMEOUT_MS` | No | `20000` | Request timeout per companion attempt |
| `COMPANION_RETRIES` | No | `2` | Number of retry attempts for transient companion failures |
| `COMPANION_CIRCUIT_BREAKER_THRESHOLD` | No | `3` | Consecutive failures before opening circuit |
| `COMPANION_CIRCUIT_BREAKER_COOLDOWN_MS` | No | `30000` | Cooldown window while circuit is open |

**Cloudflare binding:**

- Preferred DB integration is a Hyperdrive binding named `HYPERDRIVE` (see `reviewer-ui/wrangler.toml`).
- If Hyperdrive is unavailable in local/dev workflows, set `DATABASE_URL` directly.

---

## Docker Compose Configuration

### Default docker-compose.yml

```yaml
version: '3.9'

services:
  db:
    image: postgres:15-alpine
    environment:
      POSTGRES_DB: refdata
      POSTGRES_USER: refdata
      POSTGRES_PASSWORD: refdata
    volumes:
      - db_data:/var/lib/postgresql/data

  api:
    build:
      context: ./api
    environment:
      REFDATA_DATABASE_URL: postgresql+psycopg://refdata:refdata@db:5432/refdata
      REFDATA_CORS_ORIGINS: http://localhost:5274
      REFDATA_LLM_MODE: offline
      REFDATA_LLM_MODEL: llama3
      REFDATA_LLM_API_BASE: http://ollama:11434
    depends_on:
      - db

  reviewer-ui:
    build:
      context: ./reviewer-ui
      args:
        VITE_API_BASE_URL: http://localhost:8000
    depends_on:
      - api

  ollama:
    image: rezerbleede/ollama-preloaded:llama3
    ports:
      - '11434:11434'
```

### Custom Configuration

**Create `docker-compose.override.yml`:**

```yaml
version: '3.9'

services:
  api:
    environment:
      REFDATA_LLM_MODE: online
      REFDATA_LLM_MODEL: gpt-3.5-turbo
      REFDATA_LLM_API_BASE: https://api.openai.com/v1
      REFDATA_LLM_API_KEY: ${OPENAI_API_KEY}
      LOG_LEVEL: DEBUG
```

**Run with overrides:**
```bash
docker compose up -d
```

### Production Docker Compose

**Create `docker-compose.prod.yml`:**

```yaml
version: '3.9'

services:
  db:
    image: postgres:15-alpine
    environment:
      POSTGRES_DB: ${DB_NAME}
      POSTGRES_USER: ${DB_USER}
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes:
      - prod_db_data:/var/lib/postgresql/data
    restart: unless-stopped
    healthcheck:
      test: ['CMD-SHELL', 'pg_isready -U ${DB_USER}']
      interval: 10s
      timeout: 5s
      retries: 5

  api:
    build:
      context: ./api
      dockerfile: Dockerfile.prod
    environment:
      REFDATA_DATABASE_URL: postgresql+psycopg://${DB_USER}:${DB_PASSWORD}@db:5432/${DB_NAME}
      REFDATA_CORS_ORIGINS: ${CORS_ORIGINS}
      REFDATA_LLM_MODE: ${LLM_MODE}
      REFDATA_LLM_MODEL: ${LLM_MODEL}
      REFDATA_LLM_API_BASE: ${LLM_API_BASE}
      REFDATA_LLM_API_KEY: ${LLM_API_KEY}
      LOG_LEVEL: ${LOG_LEVEL}
    depends_on:
      db:
        condition: service_healthy
    restart: unless-stopped
    healthcheck:
      test: ['CMD', 'curl', '-f', 'http://localhost:8000/health']
      interval: 30s
      timeout: 10s
      retries: 3

  reviewer-ui:
    build:
      context: ./reviewer-ui
      dockerfile: Dockerfile.prod
      args:
        VITE_API_BASE_URL: ${FRONTEND_API_URL}
    depends_on:
      - api
    restart: unless-stopped

volumes:
  prod_db_data:
```

**Deploy:**
```bash
export DB_NAME=refdata_prod
export DB_USER=prod_user
export DB_PASSWORD=secure_password
export CORS_ORIGINS=https://refdata.example.com
export FRONTEND_API_URL=https://api.refdata.example.com
export LLM_MODE=online
export LLM_MODEL=gpt-3.5-turbo
export LLM_API_BASE=https://api.openai.com/v1
export LLM_API_KEY=sk-your-key
export LOG_LEVEL=INFO

docker compose -f docker-compose.prod.yml up -d
```

---

## Kubernetes Configuration

### ConfigMap

**File:** `configmap.yaml`

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: refdata-config
  namespace: refdata-hub
data:
  cors-origins: "https://refdata.example.com"
  llm-mode: "online"
  llm-model: "gpt-3.5-turbo"
  llm-api-base: "https://api.openai.com/v1"
  log-level: "INFO"
```

**Apply:**
```bash
kubectl apply -f configmap.yaml
```

### Secrets

**File:** `secrets.yaml`

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: refdata-secrets
  namespace: refdata-hub
type: Opaque
stringData:
  db-password: secure_password
  llm-api-key: sk-your-openai-key
```

**Apply:**
```bash
kubectl apply -f secrets.yaml
```

### Using in Deployment

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: api
  namespace: refdata-hub
spec:
  template:
    spec:
      containers:
      - name: api
        env:
        - name: REFDATA_DATABASE_URL
          value: "postgresql+psycopg://refdata:$(db-password)@postgres:5432/refdata"
        - name: REFDATA_CORS_ORIGINS
          valueFrom:
            configMapKeyRef:
              name: refdata-config
              key: cors-origins
        - name: REFDATA_LLM_MODE
          valueFrom:
            configMapKeyRef:
              name: refdata-config
              key: llm-mode
        - name: REFDATA_LLM_API_KEY
          valueFrom:
            secretKeyRef:
              name: refdata-secrets
              key: llm-api-key
```

---

## Configuration Best Practices

### Security

1. **Never commit secrets to version control**
   - Use `.gitignore` for `.env` files
   - Use secrets management (Kubernetes Secrets, AWS Secrets Manager)
   - Rotate API keys regularly

2. **Use separate credentials per environment**
   ```bash
   .env.local       # Local development
   .env.development # Shared development
   .env.staging     # Staging environment
   .env.production  # Production environment
   ```

3. **Encrypt sensitive data in production**
   - Use TLS for database connections
   - Store API keys encrypted at rest
   - Use secret scanning tools (e.g., git-secrets)

### Environment-Specific Configuration

**Development (.env):**
```bash
REFDATA_DATABASE_URL=postgresql+psycopg://refdata:refdata@localhost:5432/refdata
REFDATA_CORS_ORIGINS=http://localhost:5274
LOG_LEVEL=DEBUG
REFDATA_LLM_MODE=offline
```

**Staging (.env.staging):**
```bash
REFDATA_DATABASE_URL=postgresql+psycopg://refdata:password@staging-db.example.com:5432/refdata
REFDATA_CORS_ORIGINS=https://staging.refdata.com
LOG_LEVEL=INFO
REFDATA_LLM_MODE=online
REFDATA_LLM_MODEL=gpt-3.5-turbo
REFDATA_LLM_API_KEY=${LLM_API_KEY}
```

**Production (.env.production):**
```bash
REFDATA_DATABASE_URL=postgresql+psycopg://refdata:${DB_PASSWORD}@prod-db.example.com:5432/refdata?sslmode=require
REFDATA_CORS_ORIGINS=https://refdata.com
LOG_LEVEL=WARNING
REFDATA_LLM_MODE=online
REFDATA_LLM_MODEL=gpt-4
REFDATA_LLM_API_KEY=${LLM_API_KEY}
```

### Performance Tuning

#### Match Threshold

- **Lower (0.4-0.5):** More suggestions, lower precision
- **Medium (0.6-0.7):** Balanced approach
- **Higher (0.8-0.9):** Fewer suggestions, higher precision

#### Top K Candidates

- **Small (3-5):** Faster, fewer options to review
- **Medium (10):** Balanced
- **Large (20+):** More comprehensive, slower

#### LLM vs. Embeddings

| Strategy | Speed | Cost | Accuracy |
|----------|-------|------|----------|
| TF-IDF Embeddings | Fast | Free | Good for exact/fuzzy matches |
| LLM (Online) | Slow | Paid | Best for semantic understanding |
| LLM (Offline) | Medium | Free | Good semantic understanding |

---

## Validation

### Test Database Connection

```bash
# Using psql
psql $REFDATA_DATABASE_URL -c "SELECT 1"

# Using Python
python -c "from sqlalchemy import create_engine; engine = create_engine('$REFDATA_DATABASE_URL'); print('Connected')"
```

### Test LLM Configuration

**Online Mode:**
```bash
curl -X POST https://api.openai.com/v1/chat/completions \
  -H "Authorization: Bearer $REFDATA_LLM_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-3.5-turbo",
    "messages": [{"role": "user", "content": "test"}]
  }'
```

**Offline Mode (Ollama):**
```bash
curl -X POST http://localhost:11434/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "model": "llama3",
    "messages": [{"role": "user", "content": "test"}]
  }'
```

### Test API Configuration

```bash
# Health check
curl http://localhost:8000/health

# Get current config
curl http://localhost:8000/api/config

# Test CORS
curl -H "Origin: http://localhost:5274" \
   -H "Access-Control-Request-Method: POST" \
   -X OPTIONS http://localhost:8000/api/reference/canonical
```

---

## Troubleshooting

### Database Connection Failed

**Issue:** `sqlalchemy.exc.OperationalError: could not connect to server`

**Solutions:**
1. Verify `REFDATA_DATABASE_URL` format
2. Check database is running and accessible
3. Verify credentials and host/port
4. Check firewall rules

### LLM Configuration Errors

**Issue:** `LLM ranking failed: Connection refused`

**Solutions:**
1. Verify `REFDATA_LLM_API_BASE` is correct
2. Check LLM service is running
3. For online mode, verify API key is valid
4. For offline mode, verify Ollama is accessible

### CORS Issues

**Issue:** Browser shows CORS error

**Solutions:**
1. Add frontend origin to `REFDATA_CORS_ORIGINS`
2. Ensure origin matches exactly (including protocol)
3. Check for typos in URL

### Configuration Not Persisting

**Issue:** Changes to settings don't persist after restart

**Solutions:**
1. Configuration is stored in database, not environment variables
2. Changes made via Settings page are persisted
3. Environment variables only set initial configuration

---

## Configuration Migration

### Upgrading from Previous Versions

If upgrading RefData Hub, the system will automatically:

1. Add new columns to `systemconfig` table
2. Set sensible defaults for new fields
3. Migrate existing configuration
4. Validate configuration integrity

### Manual Configuration Update

```sql
-- Update configuration directly in database
UPDATE systemconfig
SET
  match_threshold = 0.75,
  matcher_backend = 'llm',
  top_k = 10,
  updated_at = NOW()
WHERE id = 1;
```

---

## Additional Resources

- [Environment Variables (Python)](https://docs.python.org/3/library/os.html#os.getenv)
- [Docker Compose Environment](https://docs.docker.com/compose/environment-variables/)
- [Kubernetes Configuration](https://kubernetes.io/docs/concepts/configuration/overview/)
- [FastAPI Settings](https://fastapi.tiangolo.com/advanced/settings/)
