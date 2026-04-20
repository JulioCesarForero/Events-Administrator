# Docker

Contenedores para entorno local (y base para CI). El **backend FastAPI** se construye con [backend.Dockerfile](backend.Dockerfile) y el **SPA React** con [frontend.Dockerfile](frontend.Dockerfile); ambos usan la raíz del repositorio como contexto.

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
| `frontend` | SPA React servida por Nginx interno en `:80` |
| `nginx`    | Reverse proxy: `/api/*` → backend, resto → frontend |
| `redis`    | Opcional (comentado). Habilitar para `IdempotencyStore` compartido en multi-réplica |

## URLs útiles

- Nginx (SPA + API bajo `/api`): `http://localhost` (puerto `NGINX_PORT`, por defecto 80)
- API directa al contenedor: `http://localhost:${BACKEND_PORT}` (rutas `/v1/...`, sin `/api`)
- Swagger detrás de Nginx: `http://localhost/api/docs` (con `DEBUG=true` y `ROOT_PATH=/api`, por defecto)
- Swagger solo en puerto 8000: `http://localhost:8000/docs` (si necesitas "Try it out" ahí, usa `ROOT_PATH=` vacío en `.env`)

`DATABASE_URL` en `.env` debe apuntar al host `db` dentro de la red Compose, por ejemplo:

`postgresql+psycopg://events_user:events_pass@db:5432/events_admin`

## Variables de entorno nuevas (post-plan maestro)

| Variable | Uso |
|---|---|
| `REDIS_URL` | Si está vacía, el backend usa el `IdempotencyStore` in-memory. Apuntar a `redis://redis:6379/0` para compartir entre réplicas (descomenta el servicio `redis` en `compose.local.yml`). |
| `IDEMPOTENCY_TTL_SECONDS` | TTL de las entradas cacheadas por `Idempotency-Key` (default 3600). |
| `VITE_API_BASE_URL` | Build-time del SPA. Default `/api/v1`. |
| `VITE_API_TIMEOUT_MS` | Timeout por defecto del cliente HTTP del frontend. |
| `VITE_EVIDENCE_STORAGE` | `signed` (URL firmada) o `inline` (data-URL base64). |
| `VITE_EVIDENCE_MAX_MB` | Límite de tamaño de evidencia en el uploader. |

Las cuatro variables `VITE_*` se inyectan como `args` en el build del `frontend.Dockerfile`, por lo que quedan **horneadas** en el bundle estático final.

## Solo backend + base de datos

Ver [backend-api/docker/README.md](../backend-api/docker/README.md). Esa compose comparte `nginx.conf`; si la usas, la ruta `/` responderá `503` con un mensaje explicativo, pero `/api/*` sigue siendo totalmente funcional.

## Base de datos

Crear el esquema `events` con los scripts en `data-model/scripts` antes de usar la API en serio (o usar el compose de `data-model/docker` y apuntar `DATABASE_URL` al host/puerto expuestos).

## Redis opcional

Para habilitar idempotencia compartida en producción/multi-réplica:

1. Descomenta el servicio `redis` en [compose.local.yml](compose.local.yml).
2. Añade `redis==5.*` al [backend-api/requirements/base.txt](../backend-api/requirements/base.txt) para que la imagen incluya el driver Python.
3. Exporta `REDIS_URL=redis://redis:6379/0` en `.env`.

Sin esos pasos, el backend detecta que el import de `redis` falla y cae automáticamente al store in-memory sin errores (ver `RedisIdempotencyStore` en [backend-api/app/middleware/idempotency.py](../backend-api/app/middleware/idempotency.py)).
