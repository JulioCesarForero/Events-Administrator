# Events Administrator

Plantilla base empresarial para el MVP de **gestión de ubicaciones y reservas de cupos en mesas para eventos**. Stack full-stack con backend FastAPI, frontend React, PostgreSQL, Nginx y Docker Compose.

> Contrato vigente: importación manual de estudiantes, aprobación de pagos por comité y reserva multi-mesa con códigos secuenciales. Ver [`PromptsDiseñoApp/8.APIs_y_contratos_gestion_ubicaciones_eventos.md`](PromptsDiseñoApp/8.APIs_y_contratos_gestion_ubicaciones_eventos.md).

---

## 1. Stack

| Capa | Tecnología |
|---|---|
| Frontend | React 19 + TypeScript + Vite · `@tanstack/react-query` · guards de ruta |
| Backend | FastAPI · SQLAlchemy 2 · Pydantic 2 · middlewares (request-id, logging, rate-limit, idempotencia) |
| Base de datos | PostgreSQL 16 (esquema `events` provisto por `data-model/`) |
| Reverse proxy | Nginx 1.27 (API bajo `/api/`, SPA en `/`) |
| Orquestación | Docker Compose v2 |
| Caché opcional | Redis (store compartido de `Idempotency-Key`) |
| CI/CD | GitHub Actions |

## 2. Estructura del repositorio

```text
Events-Administrator/
├── README.md                       ← este archivo
├── .env.example                    ← configuración por entorno (12-Factor)
├── data-model/                     ← DDL PostgreSQL (fuente de verdad del esquema)
├── backend-api/                    ← FastAPI modular (capas domain/application/infrastructure/api)
├── frontend/                       ← SPA React (portal comprador + panel staff)
├── nginx/                          ← reverse proxy (/api → backend, / → frontend)
├── docker/                         ← compose y Dockerfiles del stack completo
├── cicd/                           ← plantillas de CI (ref.)
├── docs/                           ← contratos, flujos de auth, setup de entorno
└── PromptsDiseñoApp/               ← documentos del producto (casos de uso, contratos, UX)
```

## 3. Quick start local con Docker (recomendado)

Requisitos: Docker Engine + Docker Compose v2.

```bash
# 1. Clonar y entrar al repo
cd Events-Administrator

# 2. Copiar variables de entorno (editar JWT_SECRET para uso real)
cp .env.example .env       # Windows: copy .env.example .env

# 3. Levantar db + backend + frontend + nginx
docker compose -f docker/compose.local.yml --env-file .env up --build

# 4. Aplicar el DDL de events (una sola vez por volumen nuevo)
docker exec -i events_db psql -U events_user -d events_admin < data-model/scripts/00_bootstrap.sql
# repetir con cada script bajo data-model/scripts/ en orden si tu setup lo requiere
```

El compose levanta 4 servicios:

| Servicio | Imagen | Puerto host | Responsabilidad |
|---|---|---|---|
| `events_db` | `postgres:16-alpine` (build propio) | `${POSTGRES_PORT:-5432}` | Base de datos |
| `events_backend` | `backend.Dockerfile` | `${BACKEND_PORT:-8000}` | FastAPI |
| `events_frontend` | `frontend.Dockerfile` | — (interno `:80`) | SPA estático |
| `events_nginx` | `nginx:1.27-alpine` | `${NGINX_PORT:-80}` | Reverse proxy |

## 4. URLs de desarrollo

Una vez levantado el stack, estos son los puntos de entrada:

### 4.1 Interfaz de usuario

| URL | Actor | Propósito |
|---|---|---|
| `http://localhost/` | Cualquiera | SPA: landing del portal |
| `http://localhost/portal` | Comprador | Landing amigable (ingreso por enlace/QR) |
| `http://localhost/portal/{eventId}/login` | Comprador | Login por código de estudiante |
| `http://localhost/portal/{eventId}/dashboard` | Comprador | Estado del proceso, stepper global |
| `http://localhost/portal/{eventId}/attendees` | Comprador | Alta y edición de asistentes |
| `http://localhost/portal/{eventId}/payment` | Comprador | Registro de pago (digital/efectivo) |
| `http://localhost/portal/{eventId}/payment-status` | Comprador | Estado del pago + CTA reenviar si rechazado |
| `http://localhost/portal/{eventId}/map` | Comprador | Mapa de mesas + aceptación legal + reserva |
| `http://localhost/staff/login` | Comité | Login email + contraseña |
| `http://localhost/staff/dashboard` | Comité | Lista de eventos del tenant |
| `http://localhost/staff/events/new` | Comité | Wizard venue → layout → configuración |
| `http://localhost/staff/events/{eventId}/students` | Comité | Importación CSV y edición del padrón |
| `http://localhost/staff/events/{eventId}/payments` | Comité | Bandeja de pagos pendientes |
| `http://localhost/staff/events/{eventId}/policies` | Comité | Política y términos (DATA_POLICY + EVENT_TERMS) |
| `http://localhost/staff/events/{eventId}/map` | Comité | Vista operativa del layout |
| `http://localhost/staff/events/{eventId}/manual-adjustments` | Comité | Release/capacity/custom adjustments |
| `http://localhost/staff/events/{eventId}/audit` | Comité | Auditoría filtrable |

### 4.2 API

| URL | Uso |
|---|---|
| `http://localhost/api/v1/...` | Endpoints funcionales detrás de Nginx (recomendado para Postman y el frontend en dev) |
| `http://localhost:8000/v1/...` | Llamada directa al contenedor del backend (sin proxy) |
| `http://localhost/api/docs` | Swagger (requiere `DEBUG=true` y `ROOT_PATH=/api`) |
| `http://localhost/api/openapi.json` | OpenAPI JSON |
| `http://localhost:8000/docs` | Swagger directo (usar solo si `ROOT_PATH=` vacío en `.env`) |
| `http://localhost/api/health/live` | Probe de liveness |
| `http://localhost/api/health/ready` | Probe de readiness (chequea Postgres) |

> El frontend, por defecto, apunta a `/api/v1` (`VITE_API_BASE_URL=/api/v1`) y depende de Nginx. Si trabajas con `npm run dev` en lugar del frontend dockerizado, el Vite dev server proxy ya está configurado en [`frontend/vite.config.ts`](frontend/vite.config.ts) hacia `VITE_API_PROXY_TARGET`.

## 5. Validación de endpoints (smoke test)

### 5.1 Health

```bash
curl -s http://localhost/api/health/live | jq
# → {"status": "ok"}

curl -s http://localhost/api/health/ready | jq
# → {"status": "ready", "db": "ok"} (o 503 si Postgres no responde)
```

### 5.2 Crear un staff user inicial (solo con `DEBUG=true`)

```bash
curl -s -X POST http://localhost/api/v1/auth/staff-register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@events.local",
    "password": "admin123",
    "displayName": "Admin",
    "tenantName": "Mi Colegio"
  }' | jq
```

### 5.3 Login staff y exploración

```bash
TOKEN=$(curl -s -X POST http://localhost/api/v1/auth/staff-login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@events.local","password":"admin123"}' \
  | jq -r .accessToken)

curl -s http://localhost/api/v1/auth/me \
  -H "Authorization: Bearer $TOKEN" | jq

TENANT_ID=$(curl -s http://localhost/api/v1/auth/me \
  -H "Authorization: Bearer $TOKEN" | jq -r '.memberships[0].tenantId')

curl -s "http://localhost/api/v1/events?tenantId=$TENANT_ID" \
  -H "Authorization: Bearer $TOKEN" | jq
```

### 5.4 Envelope de error

Todos los errores 4xx/5xx cumplen simultáneamente:

- el envelope del contrato `{ "error": { "code", "message", "correlationId" } }`,
- los campos planos RFC 7807 (`type`, `title`, `status`, `detail`, `code`, `correlationId`).

```bash
curl -s -o /dev/null -w "%{http_code}\n" \
  -X POST http://localhost/api/v1/auth/code-login \
  -H "Content-Type: application/json" \
  -d '{"eventId":"00000000-0000-0000-0000-000000000000","studentCode":"INVALID"}'
# → 404 con body { "error": { "code": "NOT_FOUND", ... }, "code": "NOT_FOUND", ... }
```

### 5.5 Flujo E2E sugerido para QA manual

1. **Staff** crea tenant (auto en `staff-register`), venue, layout, mesas y evento (usa el wizard UI o cURL).
2. **Staff** configura etapas (`PUT /v1/events/{id}/configuration`), importa un CSV de estudiantes y publica `DATA_POLICY` + `EVENT_TERMS`.
3. **Comprador** entra con su código (`POST /v1/auth/code-login`), registra asistentes y crea un pago.
4. **Comprador** sube evidencia (flujo signed URL) y envía a revisión.
5. **Staff** abre la bandeja de pagos y aprueba.
6. **Comprador** ve el mapa, selecciona mesas, acepta políticas y reserva.
7. **Comprador** consulta sus códigos por asistente y la versión legal aceptada.
8. **Staff** revisa la auditoría para ver la traza completa.

Colección Postman y variables: [`backend-api/docs/postman.md`](backend-api/docs/postman.md).

## 6. Desarrollo sin Docker

### 6.1 Backend

```bash
cd backend-api
python -m venv .venv
.venv\Scripts\activate        # Windows
pip install -r requirements/dev.txt

# Apunta DATABASE_URL a una Postgres accesible (p.ej. la del compose: host=localhost, port=5432)
# Ajusta ROOT_PATH= vacío si solo vas a usar :8000 directamente
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Swagger directo: `http://localhost:8000/docs`.

### 6.2 Frontend

```bash
cd frontend
npm install
npm run dev       # http://localhost:5173
```

Vite proxy-a `/api/*` al backend siguiendo `VITE_API_PROXY_TARGET` (default `http://localhost`).

Comandos:

```bash
npm run build      # compila con tsc + vite build (dist/)
npm test           # vitest
npm run lint       # eslint
npm run types:gen  # genera src/api/openapi.d.ts contra OpenAPI live (requiere backend DEBUG=true)
```

## 7. Variables de entorno (resumen)

Archivo canónico: [`.env.example`](.env.example). Cargado por docker compose y por el backend.

| Grupo | Variables clave |
|---|---|
| Postgres | `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_PORT`, `DATABASE_URL` |
| Puertos | `BACKEND_PORT`, `FRONTEND_PORT`, `NGINX_PORT` |
| Prefijo | `ROOT_PATH` (`/api` si usas Nginx, vacío si solo `:8000`) |
| Auth JWT | `JWT_SECRET`, `JWT_ISSUER`, `JWT_STAFF_AUDIENCE`, `JWT_BUYER_AUDIENCE`, `JWT_ACCESS_TTL_MINUTES` |
| Observabilidad | `DEBUG`, `LOG_LEVEL`, `CORS_ORIGINS` |
| Idempotencia | `REDIS_URL` (vacío = in-memory), `IDEMPOTENCY_TTL_SECONDS` |
| Frontend build-time | `VITE_API_BASE_URL`, `VITE_API_PROXY_TARGET`, `VITE_API_TIMEOUT_MS`, `VITE_EVIDENCE_STORAGE`, `VITE_EVIDENCE_MAX_MB` |

Las variables `VITE_*` se inyectan al `frontend.Dockerfile` como `ARG` y quedan **horneadas** en el bundle estático. Para cambiarlas, rebuilda la imagen del frontend.

## 8. Troubleshooting

| Síntoma | Causa probable | Acción |
|---|---|---|
| `404` al entrar a `/` | Servicio `frontend` no levantado | `docker compose ps` y revisa que `events_frontend` esté healthy |
| `503` en rutas no-API desde Nginx | Igual que arriba; nginx.conf muestra mensaje explícito | Levanta el servicio `frontend` |
| Swagger 404 en `/api/docs` | `DEBUG=false` o `ROOT_PATH` mal | `DEBUG=true` y `ROOT_PATH=/api` en `.env`, rebuild backend |
| `ready` → 503 | Postgres no levantado o `DATABASE_URL` mal | `docker compose logs db`, verifica `DATABASE_URL` |
| `Invalid token` en llamadas | `JWT_SECRET` distinto a emisión, o audiencia incorrecta | Revisa que el `.env` no cambió entre emitir y validar |
| `NOT_FOUND` al `code-login` | Padrón sin estudiantes | Importa CSV desde `/staff/events/{id}/students` |
| `LEGAL_DOCUMENTS_NOT_PUBLISHED` al reservar | Falta publicar política o términos | Desde `/staff/events/{id}/policies`, publica ambos documentos |
| `PAYMENT_NOT_APPROVED` al reservar | Pago no aprobado por comité | Aprueba desde `/staff/events/{id}/payments` |
| `STAGE_LIMIT_EXCEEDED` | Pides más boletas que el tope de etapa | Ajusta `maxPresaleTickets` / `maxSaleTickets` o reduce cantidad |
| Rate limit en `code-login`/`staff-login` | 10 intentos en 15 min | Espera `Retry-After` segundos o cambia IP |
| Subida de evidencia falla | `VITE_EVIDENCE_STORAGE=signed` sin backing store real | Cambia a `inline` para MVP y rebuilda frontend |

## 9. Documentación adicional

- **Producto**: [`PromptsDiseñoApp/`](PromptsDiseñoApp/) — casos de uso, contratos REST, UX, reglas, motor de asignación.
- **Arquitectura técnica**: [`backend-api/docs/architecture.md`](backend-api/docs/architecture.md).
- **Postman**: [`backend-api/docs/postman.md`](backend-api/docs/postman.md) con colección y criterios P90/P95.
- **Auth flow**: [`docs/auth-flow.md`](docs/auth-flow.md).
- **Environment setup**: [`docs/environment-setup.md`](docs/environment-setup.md).
- **API contract resumen**: [`docs/api-contract.md`](docs/api-contract.md).
- **Data model**: [`data-model/README.md`](data-model/README.md).

## 10. Flujo de ramas

- `main`: producción (protegida)
- `develop`: integración
- `feature/*`: trabajo funcional
- `hotfix/*`: correcciones urgentes

---

Para levantar solo backend + Postgres: ver [`backend-api/docker/README.md`](backend-api/docker/README.md). Para detalles del reverse proxy: ver [`nginx/README.md`](nginx/README.md).
