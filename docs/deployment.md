# Deployment Guide

This guide covers deployment strategies for RefData Hub, from local Docker Compose setups to production environments.

## Deployment Options

| Option | Use Case | Complexity | Scalability |
|--------|-----------|-------------|--------------|
| Docker Compose | Development, testing, small deployments | Low | Single node |
| Kubernetes | Production, multi-environment | High | Highly scalable |
| Cloud Services | Managed infrastructure | Medium | Managed scaling |

---

## Cloudflare Pages + Pages Functions (Free Tier)

This repository now supports a Cloudflare-first frontend + API deployment model:

- Static React app from `reviewer-ui/dist` on Cloudflare Pages
- Same-origin `/api/*` handlers from `reviewer-ui/functions/api/[[path]].ts`
- Core data routes backed by Postgres (Hyperdrive binding preferred)
- Heavy and dynamic routes proxied to an external companion service

### Build Settings (Cloudflare Pages)

- **Framework preset:** `None` (Vite custom build)
- **Root directory:** `reviewer-ui`
- **Build command:** `npm run build`
- **Build output directory:** `dist`
- **Node version:** `20`

### Required Environment Variables

Set these in both **Production** and **Preview** environments:

```bash
VITE_API_BASE_URL=/api
COMPANION_API_BASE_URL=https://your-companion-service.example.com
COMPANION_TIMEOUT_MS=20000
COMPANION_RETRIES=2
COMPANION_CIRCUIT_BREAKER_THRESHOLD=3
COMPANION_CIRCUIT_BREAKER_COOLDOWN_MS=30000
```

Set this as a secret (not plain env):

```bash
COMPANION_API_TOKEN=replace-with-strong-secret
```

### Hyperdrive Binding

Configure a Hyperdrive binding named `HYPERDRIVE` for the Pages project, or provide a fallback `DATABASE_URL`.

Template config is included at `reviewer-ui/wrangler.toml`.

### Routing Notes

- SPA history fallback is handled by `reviewer-ui/public/_redirects`
- Frontend API client defaults to same-origin `/api` when `VITE_API_BASE_URL` is unset on hosted domains
- Source-system and heavy-processing routes are proxied to the companion service with retry + circuit-breaker behavior

### Deployment Checklist

1. Create a Pages project connected to this repository.
2. Apply the build settings above.
3. Add env vars and secret token.
4. Add Hyperdrive binding (or `DATABASE_URL`).
5. Deploy and verify:
   - UI loads from `https://<project>.pages.dev`
   - Deep links (for example `/settings`) do not 404
   - `/api/config` responds from Pages Functions
   - companion-backed routes return expected responses

---

## 1. Docker Compose Deployment

### Quick Start

```bash
# Clone repository
git clone https://github.com/rezer-bleede/refdata-hub.git
cd refdata-hub

# Start all services
docker compose up -d --build

# View logs
docker compose logs -f

# Stop services
docker compose down
```

### Service Ports

| Service | Port | Description |
|----------|-------|-------------|
| PostgreSQL (db) | 5432 | Primary database |
| PostgreSQL (targetdb) | 5433 | Demo database |
| FastAPI (api) | 8000 | Backend API |
| Reviewer UI | 5274 | Frontend UI |
| Ollama | 11434 | LLM service |

### Environment Configuration

Create a `.env` file in the project root:

```bash
# Database
REFDATA_DATABASE_URL=postgresql+psycopg://refdata:refdata@db:5432/refdata
REFDATA_CORS_ORIGINS=http://localhost:5274,http://127.0.0.1:5274

# LLM Configuration
REFDATA_LLM_MODE=offline
REFDATA_LLM_MODEL=llama3
REFDATA_LLM_API_BASE=http://ollama:11434
REFDATA_LLM_API_KEY=

# Frontend
VITE_API_BASE_URL=http://localhost:8000
```

### Production Docker Compose

Create `docker-compose.prod.yml`:

```yaml
version: '3.9'

services:
  db:
    image: postgres:15-alpine
    environment:
      POSTGRES_DB: refdata_prod
      POSTGRES_USER: ${DB_USER}
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ['CMD-SHELL', 'pg_isready -U ${DB_USER}']
      interval: 10s
      timeout: 5s
      retries: 5
    restart: unless-stopped

  api:
    build:
      context: ./api
      dockerfile: Dockerfile
    environment:
      REFDATA_DATABASE_URL: postgresql+psycopg://${DB_USER}:${DB_PASSWORD}@db:5432/${DB_NAME}
      REFDATA_CORS_ORIGINS: ${CORS_ORIGINS}
      REFDATA_LLM_MODE: ${LLM_MODE}
      REFDATA_LLM_MODEL: ${LLM_MODEL}
      REFDATA_LLM_API_BASE: ${LLM_API_BASE}
      REFDATA_LLM_API_KEY: ${LLM_API_KEY}
    depends_on:
      db:
        condition: service_healthy
    restart: unless-stopped
    ports:
      - "8000:8000"

  reviewer-ui:
    build:
      context: ./reviewer-ui
      dockerfile: Dockerfile
      args:
        VITE_API_BASE_URL: ${FRONTEND_API_URL}
    depends_on:
      - api
    restart: unless-stopped
    ports:
      - "80:80"

volumes:
  pgdata:
```

Deploy:

```bash
export DB_USER=prod_user
export DB_PASSWORD=secure_password
export DB_NAME=refdata_prod
export CORS_ORIGINS=https://refdata.example.com
export FRONTEND_API_URL=https://api.refdata.example.com
export LLM_MODE=online
export LLM_MODEL=gpt-3.5-turbo
export LLM_API_BASE=https://api.openai.com/v1
export LLM_API_KEY=sk-...

docker compose -f docker-compose.prod.yml up -d
```

---

## 2. Kubernetes Deployment

### Prerequisites

- Kubernetes cluster (v1.20+)
- kubectl configured
- Ingress controller (e.g., NGINX)
- Persistent storage provisioner
- Secrets management

### Namespace Setup

```yaml
# namespace.yaml
apiVersion: v1
kind: Namespace
metadata:
  name: refdata-hub
```

```bash
kubectl apply -f namespace.yaml
```

### Secrets

Create `k8s-secrets.yaml`:

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: refdata-secrets
  namespace: refdata-hub
type: Opaque
stringData:
  db-user: refdata_prod
  db-password: secure_password_here
  db-name: refdata_prod
  llm-api-key: sk-openai-key-here
```

```bash
kubectl apply -f k8s-secrets.yaml
```

### PostgreSQL Deployment

Create `postgres-deployment.yaml`:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: postgres
  namespace: refdata-hub
spec:
  replicas: 1
  selector:
    matchLabels:
      app: postgres
  template:
    metadata:
      labels:
        app: postgres
    spec:
      containers:
      - name: postgres
        image: postgres:15-alpine
        env:
        - name: POSTGRES_DB
          valueFrom:
            secretKeyRef:
              name: refdata-secrets
              key: db-name
        - name: POSTGRES_USER
          valueFrom:
            secretKeyRef:
              name: refdata-secrets
              key: db-user
        - name: POSTGRES_PASSWORD
          valueFrom:
            secretKeyRef:
              name: refdata-secrets
              key: db-password
        ports:
        - containerPort: 5432
        volumeMounts:
        - name: postgres-storage
          mountPath: /var/lib/postgresql/data
      volumes:
      - name: postgres-storage
        persistentVolumeClaim:
          claimName: postgres-pvc
---
apiVersion: v1
kind: Service
metadata:
  name: postgres
  namespace: refdata-hub
spec:
  selector:
    app: postgres
  ports:
  - port: 5432
    targetPort: 5432
```

### Persistent Volume Claim

```yaml
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: postgres-pvc
  namespace: refdata-hub
spec:
  accessModes:
    - ReadWriteOnce
  resources:
    requests:
      storage: 10Gi
```

### API Deployment

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: api
  namespace: refdata-hub
spec:
  replicas: 3
  selector:
    matchLabels:
      app: api
  template:
    metadata:
      labels:
        app: api
    spec:
      containers:
      - name: api
        image: ghcr.io/your-org/refdata-api:latest
        env:
        - name: REFDATA_DATABASE_URL
          value: postgresql+psycopg://$(DB_USER):$(DB_PASSWORD)@postgres:5432/$(DB_NAME)
        - name: DB_USER
          valueFrom:
            secretKeyRef:
              name: refdata-secrets
              key: db-user
        - name: DB_PASSWORD
          valueFrom:
            secretKeyRef:
              name: refdata-secrets
              key: db-password
        - name: DB_NAME
          valueFrom:
            secretKeyRef:
              name: refdata-secrets
              key: db-name
        - name: REFDATA_CORS_ORIGINS
          value: "https://refdata.example.com"
        ports:
        - containerPort: 8000
        livenessProbe:
          httpGet:
            path: /health
            port: 8000
          initialDelaySeconds: 10
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /health
            port: 8000
          initialDelaySeconds: 5
          periodSeconds: 5
---
apiVersion: v1
kind: Service
metadata:
  name: api
  namespace: refdata-hub
spec:
  selector:
    app: api
  ports:
  - port: 8000
    targetPort: 8000
  type: ClusterIP
```

### Reviewer UI Deployment

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: reviewer-ui
  namespace: refdata-hub
spec:
  replicas: 2
  selector:
    matchLabels:
      app: reviewer-ui
  template:
    metadata:
      labels:
        app: reviewer-ui
    spec:
      containers:
      - name: reviewer-ui
        image: ghcr.io/your-org/refdata-ui:latest
        env:
        - name: VITE_API_BASE_URL
          value: https://api.refdata.example.com
        ports:
        - containerPort: 80
---
apiVersion: v1
kind: Service
metadata:
  name: reviewer-ui
  namespace: refdata-hub
spec:
  selector:
    app: reviewer-ui
  ports:
  - port: 80
    targetPort: 80
  type: ClusterIP
```

### Ingress Configuration

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: refdata-ingress
  namespace: refdata-hub
  annotations:
    kubernetes.io/ingress.class: nginx
    cert-manager.io/cluster-issuer: letsencrypt-prod
spec:
  tls:
  - hosts:
    - api.refdata.example.com
    - refdata.example.com
    secretName: refdata-tls
  rules:
  - host: api.refdata.example.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: api
            port:
              number: 8000
  - host: refdata.example.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: reviewer-ui
            port:
              number: 80
```

### Deploy to Kubernetes

```bash
# Apply all manifests
kubectl apply -f k8s/

# Check deployment status
kubectl get pods -n refdata-hub

# View logs
kubectl logs -f deployment/api -n refdata-hub

# Scale API
kubectl scale deployment api --replicas=5 -n refdata-hub
```

---

## 3. Cloud Platform Deployment

### AWS ECS + RDS

1. **Create RDS PostgreSQL Instance**
   ```bash
   aws rds create-db-instance \
     --db-instance-identifier refdata-prod \
     --db-instance-class db.t3.micro \
     --engine postgres \
     --master-username refdata \
     --master-user-password secure_password \
     --allocated-storage 20
   ```

2. **Build and Push Images**
   ```bash
   # Backend
   docker build -t refdata-api ./api
   docker tag refdata-api:latest your-registry/refdata-api:latest
   docker push your-registry/refdata-api:latest

   # Frontend
   docker build -t refdata-ui ./reviewer-ui
   docker tag refdata-ui:latest your-registry/refdata-ui:latest
   docker push your-registry/refdata-ui:latest
   ```

3. **Create ECS Task Definition**
   ```json
   {
     "family": "refdata-api",
     "containerDefinitions": [
       {
         "name": "api",
         "image": "your-registry/refdata-api:latest",
         "environment": [
           {
             "name": "REFDATA_DATABASE_URL",
             "value": "postgresql+psycopg://refdata:password@rds-endpoint:5432/refdata"
           }
         ],
         "portMappings": [
           {
             "containerPort": 8000,
             "protocol": "tcp"
           }
         ]
       }
     ]
   }
   ```

4. **Create ECS Service**
   ```bash
   aws ecs create-service \
     --cluster refdata-cluster \
     --service-name refdata-api \
     --task-definition refdata-api \
     --desired-count 3
   ```

### Google Cloud Run

1. **Deploy API**
   ```bash
   gcloud run deploy refdata-api \
     --image gcr.io/your-project/refdata-api:latest \
     --platform managed \
     --region us-central1 \
     --allow-unauthenticated \
     --set-env-vars REFDATA_DATABASE_URL=postgresql+psycopg://...
   ```

2. **Deploy UI**
   ```bash
   gcloud run deploy refdata-ui \
     --image gcr.io/your-project/refdata-ui:latest \
     --platform managed \
     --region us-central1 \
     --allow-unauthenticated
   ```

### Azure Container Instances

```bash
az container create \
  --resource-group refdata-rg \
  --name refdata-api \
  --image your-registry/refdata-api:latest \
  --dns-name-label refdata-api \
  --environment-variables REFDATA_DATABASE_URL=postgresql+psycopg://...
```

---

## 4. Environment Variables Reference

### Backend Variables

| Variable | Required | Default | Description |
|-----------|-----------|----------|-------------|
| `REFDATA_DATABASE_URL` | Yes | - | PostgreSQL connection string |
| `REFDATA_CORS_ORIGINS` | No | * | Comma-separated allowed origins |
| `REFDATA_LLM_MODE` | No | online | LLM mode (online/offline) |
| `REFDATA_LLM_MODEL` | No | gpt-3.5-turbo | LLM model name |
| `REFDATA_LLM_API_BASE` | No | https://api.openai.com | LLM API endpoint |
| `REFDATA_LLM_API_KEY` | No | - | LLM API key |
| `LOG_LEVEL` | No | INFO | Logging level (DEBUG/INFO/WARNING/ERROR) |
| `REFDATA_SQLALCHEMY_LOG_LEVEL` | No | WARNING | SQLAlchemy log level |

### Frontend Variables

| Variable | Required | Default | Description |
|-----------|-----------|----------|-------------|
| `VITE_API_BASE_URL` | No | http://localhost:8000 | Backend API URL |

---

## 5. Security Considerations

### TLS/SSL Configuration

**Nginx (Docker):**

```nginx
server {
    listen 443 ssl http2;
    server_name refdata.example.com;

    ssl_certificate /etc/nginx/certs/fullchain.pem;
    ssl_certificate_key /etc/nginx/certs/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    location / {
        proxy_pass http://api:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

**Kubernetes Ingress:**

```yaml
spec:
  tls:
  - hosts:
    - refdata.example.com
    secretName: tls-secret
```

### Secrets Management

**Never commit secrets to Git.** Use:

1. **Environment Variables** (development)
2. **Kubernetes Secrets** (Kubernetes)
3. **AWS Secrets Manager** (AWS)
4. **Azure Key Vault** (Azure)
5. **Google Secret Manager** (GCP)

**Example Kubernetes Secret:**

```bash
kubectl create secret generic llm-secrets \
  --from-literal=api-key=sk-your-key \
  --namespace refdata-hub
```

### Network Security

1. **Firewall Rules:**
   - Restrict database access to API nodes only
   - Limit public exposure to HTTP/HTTPS ports
   - Use VPCs for network isolation

2. **API Security (Future):**
   - Implement authentication (JWT, OAuth)
   - Rate limiting per user
   - Input validation and sanitization

---

## 6. Monitoring and Logging

### Health Checks

**Endpoint:** `GET /health`

**Response:**
```json
{
  "status": "ok"
}
```

### Logging Configuration

**Backend (structured JSON):**

```python
import logging
import json

class JSONFormatter(logging.Formatter):
    def format(self, record):
        return json.dumps({
            "timestamp": self.formatTime(record),
            "level": record.levelname,
            "message": record.getMessage(),
            "logger": record.name
        })

logging.basicConfig(
    level=logging.INFO,
    format='%(message)s',
    handlers=[logging.StreamHandler()]
)
```

**Monitoring Tools:**

- **Prometheus** – Metrics collection
- **Grafana** – Visualization
- **Loki** – Log aggregation
- **Jaeger** – Distributed tracing

---

## 7. Backup and Restore

### Database Backup

```bash
# Automated backup script
#!/bin/bash
BACKUP_DIR=/backups/refdata
DATE=$(date +%Y%m%d_%H%M%S)
pg_dump -h $DB_HOST -U $DB_USER -d $DB_NAME | gzip > $BACKUP_DIR/refdata_$DATE.sql.gz

# Retain last 30 days
find $BACKUP_DIR -name "refdata_*.sql.gz" -mtime +30 -delete
```

### Kubernetes Backup

```bash
# Backup secrets
kubectl get secrets -n refdata-hub -o yaml > secrets-backup.yaml

# Backup database
kubectl exec -it postgres-0 -n refdata-hub -- pg_dump -U refdata refdata > backup.sql
```

---

## 8. Scaling Strategies

### Horizontal Scaling

**API Pods:**
```bash
kubectl scale deployment api --replicas=10 -n refdata-hub
```

**Auto-scaling (HPA):**
```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: api-hpa
  namespace: refdata-hub
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: api
  minReplicas: 3
  maxReplicas: 20
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
```

### Database Scaling

1. **Read Replicas:**
   - Offload read queries to replicas
   - Reduce load on primary

2. **Connection Pooling:**
   ```python
   engine = create_engine(
       DATABASE_URL,
       pool_size=20,
       max_overflow=10,
       pool_pre_ping=True
   )
   ```

3. **Caching Layer:**
   - Redis for session management
   - Cache canonical values
   - Cache match results

---

## 9. Troubleshooting Deployment Issues

### Container Won't Start

```bash
# Check logs
docker compose logs api
kubectl logs -f deployment/api -n refdata-hub

# Check environment
docker compose exec api env
kubectl exec -it api-pod -- env
```

### Database Connection Issues

```bash
# Test connectivity
docker compose exec db pg_isready -U refdata
kubectl exec -it postgres-0 -- pg_isready -U refdata

# Check connection string
echo $REFDATA_DATABASE_URL
```

### High CPU/Memory Usage

```bash
# Check resource usage
kubectl top pods -n refdata-hub

# Check limits
kubectl describe pod api-pod -n refdata-hub
```

---

## 10. Upgrading

### Zero-Downtime Deployment

```yaml
# Rolling update strategy
spec:
  replicas: 3
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1
      maxUnavailable: 0
```

**Deploy New Version:**

```bash
# Update image
kubectl set image deployment/api api=refdata-api:v2.0 -n refdata-hub

# Monitor rollout
kubectl rollout status deployment/api -n refdata-hub

# Rollback if needed
kubectl rollout undo deployment/api -n refdata-hub
```

### Database Migrations

```bash
# Run migrations before deploying
kubectl exec -it postgres-0 -n refdata-hub -- psql -U refdata -d refdata < migration.sql

# Then deploy new application version
kubectl set image deployment/api api=refdata-api:v2.0 -n refdata-hub
```

---

## 11. Cost Optimization

### Resource Recommendations

| Component | Minimum | Production | Notes |
|------------|----------|-------------|--------|
| PostgreSQL | t3.micro | db.r5.large | Scale based on data size |
| API Pod | 512 MB | 2 GB | 3-5 replicas |
| UI Pod | 256 MB | 512 MB | 2-3 replicas |
| LLM Service | - | GPU instance | Optional |

### Cost Saving Tips

1. **Use Spot Instances** (non-critical workloads)
2. **Auto-scaling** to scale down during low usage
3. **Reserved Instances** for predictable workloads
4. **Optimize Images** (multi-stage builds, alpine base)
5. **Compress Static Assets**

---

## Checklist

### Pre-Deployment

- [ ] Environment variables configured
- [ ] Secrets created and tested
- [ ] Database backup performed
- [ ] Health checks configured
- [ ] Monitoring and logging set up
- [ ] SSL certificates provisioned
- [ ] Firewall rules reviewed

### Post-Deployment

- [ ] All pods/services healthy
- [ ] Health check endpoint responding
- [ ] API accessible from external domain
- [ ] UI loading without errors
- [ ] Database connections working
- [ ] LLM service reachable (if configured)
- [ ] Logs showing no errors
- [ ] Monitoring metrics normal
- [ ] Smoke tests passing

---

## Additional Resources

- [Kubernetes Documentation](https://kubernetes.io/docs/)
- [Docker Documentation](https://docs.docker.com/)
- [PostgreSQL High Availability](https://www.postgresql.org/docs/current/high-availability.html)
- [FastAPI Deployment](https://fastapi.tiangolo.com/deployment/)
