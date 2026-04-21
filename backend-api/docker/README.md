# Docker — solo backend (`compose.backend.yml`)

Compose focalizado en la API + PostgreSQL, útil para desarrollo backend puro y pruebas de contrato (Postman, cURL) sin levantar el frontend.

## 1. Qué incluye

- **PostgreSQL 16** (`postgres:16-alpine`; DDL se aplica aparte desde `data-model/scripts`).
- **FastAPI** (imagen [`../../docker/backend.Dockerfile`](../../docker/backend.Dockerfile); contexto de build = raíz del monorepo).
- **Nginx** en el puerto `NGINX_PORT` (por defecto 80), reutilizando el mismo [`nginx.conf`](../../nginx/nginx.conf) del stack completo.

> El `nginx.conf` usa DNS embebido de Docker con resolución en tiempo de request, por lo que levantar solo este compose no rompe el arranque: las rutas `/api/*` funcionan y cualquier otra ruta responde `503` con un mensaje explicativo.

## 2. Arranque (desde la raíz del repositorio)

```bash
docker compose -f backend-api/docker/compose.backend.yml --env-file .env up --build
```

El archivo **`.env` debe estar en la raíz del monorepo**; el compose usa rutas `../../.env` relativas a esta carpeta.

## 3. Variables imprescindibles

| Variable | Ejemplo | Nota |
|---|---|---|
| `DATABASE_URL` | `postgresql+psycopg://events_user:events_pass@db:5432/events_admin` | Usa el hostname del servicio `db`. |
| `POSTGRES_*` | — | Mismo usuario/clave/DB que en `DATABASE_URL`. |
| `JWT_SECRET` | cadena larga | Obligatorio para firmar tokens. |
| `DEBUG` | `true` | Habilita Swagger (`/docs`) y `staff-register`. |
| `ROOT_PATH` | `/api` | Con Nginx. Vacío solo si vas directo al `:8000`. |
| `REDIS_URL` | vacío | In-memory por defecto. Completar para store compartido. |
| `IDEMPOTENCY_TTL_SECONDS` | `3600` | TTL del cache `Idempotency-Key`. |

## 4. URLs

### 4.1 Con Nginx

| URL | Uso |
|---|---|
| `http://localhost/api/v1/...` | Endpoints funcionales |
| `http://localhost/api/docs` | Swagger (requiere `DEBUG=true` + `ROOT_PATH=/api`) |
| `http://localhost/api/openapi.json` | OpenAPI JSON |
| `http://localhost/api/health/live` | Probe de liveness |
| `http://localhost/api/health/ready` | Probe de readiness |
| `http://localhost/*` (no `/api`) | `503` + mensaje "Frontend service is not running..." |

### 4.2 Directo al contenedor del backend

| URL | Uso |
|---|---|
| `http://localhost:${BACKEND_PORT:-8000}/v1/...` | Endpoints (sin prefijo `/api`) |
| `http://localhost:${BACKEND_PORT:-8000}/docs` | Swagger (solo si `ROOT_PATH=` vacío) |
| `http://localhost:${BACKEND_PORT:-8000}/openapi.json` | OpenAPI JSON |

> Si `ROOT_PATH=/api` (default del compose) y abres Swagger en `:8000/docs`, el "Try it out" intentará URLs con prefijo `/api` que no existen en ese puerto. Usa `http://localhost/api/docs` o cambia `ROOT_PATH=` vacío.

## 5. Postman

- **Recomendado (con Nginx)**: `baseUrl = http://localhost/api`, rutas `/v1/...` y `/health/...`. Coherente con `API_BASE_URL=http://localhost/api` del `.env.example`.
- **Directo al contenedor**: `baseUrl = http://localhost:8000`, rutas `/v1/...` y `/health/...` (sin `/api`).

Colección y criterios P90/P95: [`../docs/postman.md`](../docs/postman.md).

## 6. Aplicar el esquema `events`

La imagen de la API **no** crea tablas. Ejecuta los scripts de `../../data-model/scripts/` en orden:

```bash
# PowerShell o bash
docker exec -i events_db psql -U events_user -d events_admin < ../../data-model/scripts/00_bootstrap.sql
# ... y así con el resto de scripts del directorio
```

Alternativa: usar el compose de [`../../data-model/docker/docker-compose.yml`](../../data-model/docker/docker-compose.yml) que aplica el DDL al arrancar.

## 7. Pruebas rápidas

```bash
# Liveness
curl -s http://localhost/api/health/live

# Readiness (valida Postgres)
curl -s http://localhost/api/health/ready

# Alta inicial de staff (solo DEBUG=true)
curl -s -X POST http://localhost/api/v1/auth/staff-register \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@events.local","password":"admin123","displayName":"Admin","tenantName":"Demo"}'
```

Ver el flujo completo (venue → layout → evento → padrón → pago → reserva) en [`../README.md`](../README.md) §9.

## 8. Scripts de espera (opcional)

- [`../scripts/wait-for-db.sh`](../scripts/wait-for-db.sh) (Linux/macOS)
- [`../scripts/wait-for-db.ps1`](../scripts/wait-for-db.ps1) (Windows)

## 9. Stack completo

Para levantar también el frontend estático detrás de Nginx ver [`../../docker/README.md`](../../docker/README.md).
