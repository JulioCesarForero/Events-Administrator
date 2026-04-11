# Docker

Contenedores para entorno local (y base para CI). El **backend FastAPI** se construye con [backend.Dockerfile](backend.Dockerfile) (contexto: raíz del repo).

## Requisitos

- Docker Engine + Docker Compose v2
- Archivo `.env` en la raíz del repositorio (copia desde [`.env.example`](../.env.example))

## Levantar entorno local completo

Desde esta carpeta `docker/`:

```bash
docker compose -f compose.local.yml --env-file ../.env up --build
```

## Servicios

| Servicio   | Descripción |
|------------|-------------|
| `db`       | PostgreSQL 16; healthcheck con `pg_isready` |
| `backend`  | FastAPI (imagen slim, usuario no root, `HEALTHCHECK` en `/health/live`) |
| `frontend` | SPA React |
| `nginx`    | Reverse proxy: `/api/*` → backend `:8000` |

## URLs útiles

- Nginx (API bajo `/api`): `http://localhost` (puerto `NGINX_PORT`, por defecto 80)
- API directa al contenedor: `http://localhost:${BACKEND_PORT}` (rutas `/v1/...`, sin `/api`)
- Swagger detrás de Nginx: `http://localhost/api/docs` (con `DEBUG=true` y `ROOT_PATH=/api`, por defecto en `compose.local.yml`)
- Swagger solo en puerto 8000: `http://localhost:8000/docs` (si necesitas “Try it out” ahí, usa `ROOT_PATH=` vacío en `.env`)

`DATABASE_URL` en `.env` debe apuntar al host `db` dentro de la red Compose, por ejemplo:

`postgresql+psycopg://events_user:events_pass@db:5432/events_admin`

## Solo backend + base de datos

Ver [backend-api/docker/README.md](../backend-api/docker/README.md).

## Base de datos

Crear el esquema `events` con los scripts en `data-model/scripts` antes de usar la API en serio (o usar el compose de `data-model/docker` y apuntar `DATABASE_URL` al host/puerto expuestos).
