# Docker — backend (compose de esta carpeta)

## Qué incluye `compose.backend.yml`

- **PostgreSQL 16** (DDL: aplicar scripts de `data-model/scripts` antes de usar la API).
- **FastAPI** (imagen [docker/backend.Dockerfile](../../docker/backend.Dockerfile); contexto de build = **raíz del monorepo**).
- **Nginx** en el puerto `NGINX_PORT` (por defecto 80), mismo patrón que el stack principal: API bajo **`/api/`**.

## Arranque (desde la raíz del repositorio)

```bash
docker compose -f backend-api/docker/compose.backend.yml --env-file .env up --build
```

El archivo **`.env` debe estar en la raíz del monorepo** (no en `backend-api/docker/`). El compose usa rutas `../../.env` relativas a esta carpeta.

### Variables imprescindibles en `.env`

| Variable | Ejemplo (Compose) |
|----------|-------------------|
| `DATABASE_URL` | `postgresql+psycopg://events_user:events_pass@db:5432/events_admin` |
| `POSTGRES_*` | Mismos usuario/clave/base que en `DATABASE_URL` |
| `JWT_SECRET` | Cadena larga y aleatoria |
| `DEBUG` | `true` para habilitar **Swagger** (`/docs`) y OpenAPI |
| `ROOT_PATH` | Con Nginx: **`/api`** (valor por defecto en el compose). Vacío solo si **no** usas proxy y llamas solo a `:8000`. |

## Postman

- **Recomendado (con Nginx):** `baseUrl = http://localhost` (o el host que uses) y rutas **`/api/v1/...`**, **`/api/health/...`**.
  - Coherente con [`.env.example`](../../.env.example) → `API_BASE_URL=http://localhost/api`.
- **Directo al contenedor del API (puerto 8000):** `baseUrl = http://localhost:8000` y rutas **`/v1/...`**, **`/health/...`** (sin prefijo `/api`).

Si en el compose tienes `ROOT_PATH=/api` y abres Swagger en **`http://localhost:8000/docs`**, el “Try it out” puede apuntar a URLs con prefijo `/api` que **no existen** en ese puerto. Usa Swagger en:

- **`http://localhost/api/docs`** (con `DEBUG=true`),

o define `ROOT_PATH=` vacío en `.env` si solo trabajas contra el puerto 8000.

## Swagger / OpenAPI

| Entrada | URL |
|---------|-----|
| Vía Nginx | `http://localhost/api/docs` |
| Directo al backend | `http://localhost:8000/docs` |

OpenAPI JSON:

- `http://localhost/api/openapi.json` (Nginx)
- `http://localhost:8000/openapi.json` (directo)

## Opción A: Stack completo en `docker/compose.local.yml`

Ver [docker/README.md](../../docker/README.md).

## Esquema de base de datos

El DDL vive en `data-model/scripts`. La imagen del API **no** crea tablas.

## Scripts de espera (opcional)

- [scripts/wait-for-db.sh](../scripts/wait-for-db.sh)
- [scripts/wait-for-db.ps1](../scripts/wait-for-db.ps1)

## Desarrollo con hot reload

Ver sección al final del README anterior o monta el código y `uvicorn --reload` (usuario root en contenedor si hace falta).
