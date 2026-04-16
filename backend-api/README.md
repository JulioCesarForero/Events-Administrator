# Backend API — Events Administrator

API transaccional en **FastAPI** para el MVP de reserva de cupos en mesas: eventos, layout, importación de estudiantes, pagos, reservas multi-mesa, documentos legales y auditoría.

## Propósito

Exponer casos de uso del dominio sobre el modelo relacional ya definido en **`data-model/`** (esquema PostgreSQL `events`). Este proyecto **integra** ese modelo; no es la fuente del DDL.

## Arquitectura general

- **Monolito modular:** cada contexto en `modules/<nombre>/` con capas `domain/`, `application/`, `infrastructure/`, `api/`.
- **Composición:** `app/main.py` crea la aplicación, registra middlewares, `/v1` y manejadores de error.
- **Persistencia compartida:** `infrastructure/persistence/` (motor, sesión, modelos ORM que mapean `events.*`).
- **Transversal:** `shared/` (respuestas tipo problema, deps HTTP, logging JSON).

Detalle: [docs/architecture.md](docs/architecture.md).

## Principios

- **DDD:** reglas e invariantes en dominio/aplicación; HTTP solo adapta entrada/salida.
- **Clean Architecture:** dependencias hacia el dominio; SQLAlchemy queda en infraestructura (MVP con `Session` directo; evolución: repositorios explícitos).
- **Twelve-Factor:** configuración por entorno, logs a stdout, backing service PostgreSQL vía URL.

## Estructura de carpetas (resumen)

```text
backend-api/
  app/                 # main, lifespan, health, middleware
  config/              # pydantic-settings
  domain/              # excepciones de dominio compartidas
  application/         # (reservado / transversal)
  infrastructure/      # persistence, security
  modules/             # auth, venues, events, legal, import_students, attendees,
                       # payments, map, reservations, audit, operations
  shared/
  interfaces/          # contratos compartidos (opcional)
  tests/               # unit + integration
  docs/                # architecture.md, postman.md
  scripts/             # wait-for-db.sh / .ps1
  docker/              # README + compose solo API+DB
  requirements/
```

## Módulos

| Módulo | Endpoints base (prefijo `/v1`) |
|--------|--------------------------------|
| auth | `/auth/staff-login`, `/auth/code-login`, `/auth/staff-register` (solo `DEBUG`) |
| venues | `/venues`, `/venues/{id}/layouts`, `/layouts/{id}/tables` |
| events | `/events`, `/events/{id}/configuration`, `/events/{id}/layout-binding` |
| legal | `/events/{id}/legal-documents`, `/legal-documents/...`, `/portal/...` |
| import_students | `/events/{id}/student-imports` |
| attendees | `/portal/events/{id}/my-group`, `/groups/{id}/participants`, `/participants/{id}` |
| payments | `/groups/{id}/payments`, `/payments/...`, `/events/{id}/payment-inbox`, `/events/{id}/cash-payments` |
| map | `/events/{id}/map` |
| reservations | `/events/{id}/reservations`, `/reservations/{id}/release`, `/reservations/{id}/move` |
| audit | `/events/{id}/audit-log` |
| operations | `/events/{id}/manual-adjustments` |

Salud (sin versión): `/health/live`, `/health/ready`.

## Prerrequisitos

- Python **3.12+**
- PostgreSQL **16** con esquema `events` aplicado desde `data-model/scripts`
- (Opcional) Docker — ver más abajo

## Instalación local

```bash
cd backend-api
python -m venv .venv
.venv\Scripts\activate   # Windows
# source .venv/bin/activate  # Linux/macOS
pip install -r requirements/dev.txt
```

## Variables de entorno

| Variable | Descripción |
|----------|-------------|
| `DATABASE_URL` | `postgresql+psycopg://user:pass@host:5432/dbname` |
| `JWT_SECRET` | Clave HMAC para JWT (obligatoria en producción) |
| `JWT_ISSUER` | Emisor (default `events-administrator`) |
| `JWT_STAFF_AUDIENCE` / `JWT_BUYER_AUDIENCE` | Audiencias JWT |
| `JWT_ACCESS_TTL_MINUTES` | TTL del access token |
| `DEBUG` | `true` habilita `/docs`, `/openapi.json`, `/redoc` |
| `CORS_ORIGINS` | `*` o lista separada por comas |
| `LOG_LEVEL` | `INFO`, `DEBUG`, etc. |

Ejemplo en la raíz del monorepo: [`.env.example`](../.env.example).

## Ejecución sin Docker

```bash
cd backend-api
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

- Swagger: `http://localhost:8000/docs` (si `DEBUG=true`)
- OpenAPI JSON: `http://localhost:8000/openapi.json`

## Ejecución con Docker

- Imagen: [docker/backend.Dockerfile](../docker/backend.Dockerfile) (contexto = raíz del repo).
- Stack completo: [docker/README.md](../docker/README.md)
- Solo API + Postgres: [docker/README.md](docker/README.md)

Dentro de Compose, `DATABASE_URL` debe usar el hostname del servicio (`db`).

### Esperar a la base de datos

- Linux/macOS (requiere cliente `pg_isready` en el contenedor host o imagen con postgres client): [scripts/wait-for-db.sh](scripts/wait-for-db.sh)
- Windows (solo puerto TCP): `powershell -File scripts/wait-for-db.ps1 -DbHost localhost -Port 5432`

Puedes encadenar el script en un `entrypoint` personalizado si no usas `depends_on: service_healthy`.

## Comandos útiles

```bash
ruff check .
ruff format .
mypy .              # opcional; proyecto no está en strict mode completo
pytest -q
```

## Pruebas

- **Unitarias:** `tests/unit/` (ej. reglas de edición de participantes).
- **Integración ligera:** `tests/integration/` (health sin depender de una BD real para `live`; `ready` puede responder 503 si no hay Postgres).

```bash
pytest -q
```

Para pruebas contra una BD real, define `DATABASE_URL` válido y amplía `conftest` / marca `pytest.mark.integration`.

## Linters / formato

Configuración en [pyproject.toml](pyproject.toml): **ruff** (lint + format sugerido), **mypy** opcional.

## Documentación OpenAPI

Automática con FastAPI. En producción desactiva documentación poniendo `DEBUG=false`.

## Base de datos y migraciones

- **Fuente de verdad del esquema:** scripts en `../data-model/scripts/` (incl. `events` schema, FKs, funciones como `fn_next_reservation_sequence_number`).
- **Alembic:** no sustituye esos scripts en el MVP. Si más adelante se adopta una revisión baseline de Alembic, debe reflejar exactamente el estado ya desplegado por `data-model`, no regenerar tablas al azar.

## Postman / pruebas de carga

Guía de colección, variables y criterios P90/P95: [docs/postman.md](docs/postman.md).

## Troubleshooting

| Síntoma | Causa probable |
|---------|----------------|
| `relation "events.xxx" does not exist` | DDL no aplicado; ejecutar scripts de `data-model`. |
| `ready` → 503 | `DATABASE_URL` incorrecto o Postgres no levantado. |
| `Invalid token` | `JWT_SECRET` distinto entre emisión y validación; audiencia incorrecta. |
| `Not allowed for this event` | Staff sin fila en `event_organizer_assignment` ni membresía de tenant. |
| Swagger no visible | `DEBUG=false`; poner `DEBUG=true` solo en dev. |
| Tras nginx, 404 en rutas | Usar prefijo `/api` delante: `/api/v1/...` (ver `nginx/nginx.conf`). |
| Swagger “Try it out” falla o apunta mal | Con Nginx usa `http://localhost/api/docs` y `ROOT_PATH=/api` (compose por defecto). Solo puerto 8000: `ROOT_PATH=` vacío en `.env`. |

## Enlaces

- Docker backend-only: [docker/README.md](docker/README.md)
- Arquitectura: [docs/architecture.md](docs/architecture.md)



---


PS C:\ProyectosIA\Events-Administrator\docker> docker compose -f compose.local.yml --env-file ../.env up --build