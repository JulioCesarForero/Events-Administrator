# Environment Setup Guide

## Prerequisites

- Docker Engine with Compose v2
- Python 3.12+ (for local backend development without Docker)
- Node.js 20+ and npm 10+ (for frontend development)
- PostgreSQL 16+ (if running DB locally)

## Quick Start (Docker)

```bash
# 1. Copy environment template
cp .env.example .env

# 2. Edit .env with your values (defaults work for local dev)

# 3. Start full stack (DB + Backend + Nginx)
docker compose -f docker/compose.local.yml --env-file .env up --build

# 4. Apply database schema (first run)
# Schema is managed by data-model/scripts, applied by docker/init on fresh volumes
```

## URLs

| Service | URL | Notes |
|---------|-----|-------|
| Frontend (via Nginx) | `http://localhost` | Port configurable via `NGINX_PORT` |
| API (via Nginx) | `http://localhost/api/v1/...` | Nginx strips `/api` prefix |
| API (direct) | `http://localhost:8000/v1/...` | Port configurable via `BACKEND_PORT` |
| Swagger (via Nginx) | `http://localhost/api/docs` | Requires `DEBUG=true` and `ROOT_PATH=/api` |
| Swagger (direct) | `http://localhost:8000/docs` | Requires `DEBUG=true` |

## Required Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql+psycopg://events_user:events_pass@db:5432/events_admin` |
| `JWT_SECRET` | JWT signing key | `change-me-in-production` |
| `JWT_ISSUER` | JWT issuer claim | `events-administrator` |
| `JWT_STAFF_AUDIENCE` | Staff token audience | `staff` |
| `JWT_BUYER_AUDIENCE` | Buyer token audience | `buyer` |
| `DEBUG` | Enable Swagger and debug endpoints | `true` |
| `CORS_ORIGINS` | Allowed CORS origins | `*` |
| `LOG_LEVEL` | Logging level | `INFO` |
| `ROOT_PATH` | API path prefix (for Nginx proxy) | `/api` |
| `POSTGRES_DB` | Database name | `events_admin` |
| `POSTGRES_USER` | Database user | `events_user` |
| `POSTGRES_PASSWORD` | Database password | `events_pass` |
| `POSTGRES_PORT` | Database port | `5432` |
| `BACKEND_PORT` | Backend port | `8000` |
| `NGINX_PORT` | Nginx port | `80` |

## Backend-Only Development

```bash
# Start DB + API + Nginx (no frontend)
docker compose -f backend-api/docker/compose.backend.yml --env-file .env up --build

# Or run locally without Docker
cd backend-api
python -m venv .venv
source .venv/bin/activate  # or .venv\Scripts\activate on Windows
pip install -r requirements/dev.txt
uvicorn app.main:app --reload --port 8000
```

## Database Management

The database schema is defined in `data-model/scripts/` and applied in lexicographic order:
1. `01_schema/` — Schema creation
2. `02_tables/` — Table definitions
3. `03_constraints/` — Foreign keys, unique constraints, check constraints
4. `04_indexes/` — Performance indexes
5. `05_seed/` — Development seed data
6. `06_views/` — Reporting views
7. `07_functions/` — Functions and triggers

To reset the database: `docker compose -f docker/compose.local.yml down -v` then restart.

## Running Tests

```bash
cd backend-api
pip install -r requirements/dev.txt
pytest -q
```
