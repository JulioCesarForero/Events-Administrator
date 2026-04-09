# Docker

Archivos de contenedorizacion para entorno local y CI.

## Levantar entorno local

```bash
docker compose -f compose.local.yml up --build
```

## Servicios

- `frontend`: build React
- `backend`: FastAPI
- `db`: PostgreSQL
- `nginx`: reverse proxy
