# Quickstart Guide

Get RefData Hub up and running quickly with Docker.

## Prerequisites

- Docker installed on your machine
- Docker Compose installed (comes with Docker Desktop)

## Starting the Stack

Run the following command from the project root:

```bash
docker compose up --build
```

This will build and start all required services.

## What Gets Started

The Docker Compose setup includes the following services:

### PostgreSQL Database (`db`)
- Stores operational configuration and user/source-managed data
- No dimensions, canonical values, entities, records, or connections are preloaded
- Runs on port 5432 (internal to Docker network)

### FastAPI Backend (`api`)
- REST API endpoints available at `http://localhost:8000`
- API documentation at `http://localhost:8000/docs`
- Auto-creates schema and operational configuration on first run

### Reviewer UI (`reviewer-ui`)
- Modern React-based dashboard served at `http://localhost:5274`
- Theme switching (dark, light, midnight modes)
- Persistent navigation with collapsible rail
- Pre-configured to connect to the local FastAPI backend

### Ollama LLM Runtime (`ollama`, optional profile)
- Offline semantic matching using compact local models (e.g. `smollm:135m` or `tinyllama`)
- Optional service enabled via `--profile ollama` (not downloaded by default to save bandwidth and resource usage)
- Runs on port 11434 (internal to Docker network)

## Accessing the Application

Once all services are running:

1. Open your browser
2. Navigate to `http://localhost:5274`
3. You'll see the RefData Hub Reviewer UI

## First Steps

### 1. Explore the Dashboard
The dashboard gives you an overview of:
- Canonical coverage across dimensions
- Name-similarity playground for testing suggestions
- Quick access to key workspaces

### 2. Check Settings
Navigate to **Settings** to configure:
- Name-similarity threshold
- Matching method (name similarity by default; LLM is opt-in)
- LLM connectivity (switch between offline Ollama and hosted API)

### 3. Load real reference data
- Create dimensions and canonical values from your governed standards, or import them from an authoritative file
- Filters for dimension and keyword search
- Bulk import capabilities for CSV/TSV/Excel files

### 4. Connect a Source
Register a real source system in **Source Connections** with its approved
endpoint and credentials, then test the connection and inspect its schema.

### 5. Create a Field Mapping
To practice mapping:
1. Go to a registered connection's detail view
2. Click **New Mapping** in the Field Mappings section
3. Select a source table and field
4. Choose a target dimension
5. Capture samples to see available values
6. View match statistics in **Match Insights**

### 6. Review Suggestions
Approve or reject semantic suggestions:
1. Go to **Suggestions** page
2. Review unmatched values with inline suggestions
3. Approve mappings or manually link values

## Stopping the Stack

To stop all services:

```bash
docker compose down
```

To stop and remove volumes (deleting all data):

```bash
docker compose down -v
```

## Restarting Services

To restart individual services:

```bash
docker compose restart api
docker compose restart reviewer-ui
```

## Viewing Logs

To view logs for all services:

```bash
docker compose logs
```

To view logs for a specific service:

```bash
docker compose logs api
docker compose logs reviewer-ui
```

Follow logs in real-time with the `-f` flag:

```bash
docker compose logs -f api
```

## Troubleshooting

### Services Won't Start
- Check if ports 8000, 5274, 5432, or 5433 are already in use
- Ensure Docker is running: `docker ps`
- Check logs: `docker compose logs`

### Can't Access the UI
- Verify the reviewer-ui service is running: `docker compose ps`
- Check reviewer-ui logs: `docker compose logs reviewer-ui`
- Try refreshing the browser with a hard refresh (Ctrl+Shift+R or Cmd+Shift+R)

### API Not Responding
- Check the API service is running: `docker compose ps`
- View API logs: `docker compose logs api`
- Ensure the database service is also running

### Database Connection Errors
- Check the database service is running: `docker compose ps`
- View database logs: `docker compose logs db`
- Try restarting: `docker compose restart db`

For more troubleshooting guidance, see the [Troubleshooting Guide](troubleshooting.md).

## Next Steps

- Read the [Features Overview](features.md) to learn about all capabilities
- Explore the [Canonical Library Guide](canonical-library.md) for managing reference data
- Check the [API Reference](api.md) for integration options
- Review the [Troubleshooting Guide](troubleshooting.md) for common issues
