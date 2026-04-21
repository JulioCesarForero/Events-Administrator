# Backend API — Events Administrator

API transaccional en **FastAPI** para el MVP de reserva de cupos en mesas: eventos, layout, importación de estudiantes, pagos, reservas multi-mesa, documentos legales y auditoría.

## 1. Propósito

Expone los casos de uso del dominio sobre el modelo relacional definido en **`data-model/`** (esquema PostgreSQL `events`). Este proyecto **integra** ese modelo; no es la fuente del DDL.

## 2. Arquitectura

- **Monolito modular**: cada contexto en `modules/<nombre>/` con capas `domain/`, `application/`, `infrastructure/`, `api/`.
- **Composición**: [`app/main.py`](app/main.py) crea la app, registra middlewares y monta los routers bajo `/v1`.
- **Persistencia compartida**: `infrastructure/persistence/` (motor, sesión, modelos ORM que mapean `events.*`).
- **Transversal**: `shared/` (respuestas tipo problema, deps HTTP, logging JSON, esquemas camelCase).

Detalle: [docs/architecture.md](docs/architecture.md).

## 3. Principios

- **DDD**: reglas e invariantes en dominio/aplicación; HTTP solo adapta entrada/salida.
- **Clean Architecture**: dependencias hacia el dominio; SQLAlchemy queda en infraestructura.
- **Twelve-Factor**: configuración por entorno, logs a stdout, backing service PostgreSQL vía URL.
- **Contrato estable**: todas las respuestas emiten simultáneamente los nombres canónicos del [doc 8](../PromptsDiseñoApp/8.APIs_y_contratos_gestion_ubicaciones_eventos.md) y sus aliases legacy para compatibilidad.

## 4. Estructura de carpetas

```text
backend-api/
  app/
    main.py                          # create_app(), handlers de errores, montaje /v1
    lifespan.py                      # startup/shutdown (settings, logging JSON)
    health.py                        # /health/live, /health/ready
    middleware/
      request_id.py                  # X-Request-ID propagado
      logging_context.py             # contexto JSON por request
      idempotency.py                 # store pluggable (in-memory / Redis) + body-key
      rate_limit.py                  # sliding window para /auth/*-login
  config/settings.py                 # pydantic-settings (.env)
  domain/
    error_codes.py                   # constantes alineadas al doc 8 §5
    exceptions.py                    # NotFoundError, ConflictError, ValidationError, ...
  infrastructure/
    persistence/                     # engine, session, ORM models, audit helpers
    security/                        # password hashing, JWT, signed URLs
    storage/                         # signed URL generator
  modules/                           # auth, venues, events, legal, import_students,
                                     # attendees, payments, map, reservations, audit,
                                     # operations, students
  shared/
    api/                             # deps (DbSession, StaffUserDep, BuyerClaimsDep),
                                     # responses.py (envelope + RFC 7807), schemas.py
    exceptions/                      # http_map.py (DomainError → HTTP status)
    logging/                         # setup + context
  tests/                             # unit + integration
  docs/                              # architecture.md, postman.md
  scripts/                           # wait-for-db helpers
  docker/                            # compose solo API+DB
  requirements/
```

## 5. Matriz de endpoints (post plan maestro)

Todos los endpoints cuelgan del prefijo `/v1` (ver [`app/main.py`](app/main.py)). Las rutas `/health/*` viven fuera del prefijo.

### 5.1 Auth

| Método | Ruta | Rol | Descripción |
|---|---|---|---|
| `POST` | `/v1/auth/staff-login` | Público | Login staff (rate-limit 10/15min) |
| `POST` | `/v1/auth/staff-register` | Solo `DEBUG=true` | Alta inicial de staff + tenant |
| `GET` | `/v1/auth/me` | Staff | Sesión y memberships del staff actual |
| `POST` | `/v1/auth/code-login` | Público | Login comprador por código (idempotente por `studentCode+eventId`, rate-limit 10/15min) |

### 5.2 Venues, layouts y mesas (staff)

| Método | Ruta | Descripción |
|---|---|---|
| `GET` / `POST` | `/v1/venues` | Listar / crear salones del tenant |
| `GET` / `POST` | `/v1/venues/{venueId}/layouts` | Listar / crear layouts de un salón |
| `GET` / `POST` | `/v1/layouts/{layoutId}/tables` | Listar / crear mesas del layout |

### 5.3 Eventos y configuración (staff)

| Método | Ruta | Descripción |
|---|---|---|
| `GET` / `POST` | `/v1/events` | Listar / crear eventos (query `tenantId`) |
| `PUT` | `/v1/events/{eventId}/configuration` | Etapas, topes y datos del lugar (§4.2.1) |
| `POST` | `/v1/events/{eventId}/layout-binding` | Asociar layout al evento |
| `GET` / `PATCH` / `DELETE` | `/v1/events/{eventId}/students[/{id}]` | Administración del padrón importado |

### 5.4 Documentos legales

| Método | Ruta | Rol |
|---|---|---|
| `GET` / `POST` | `/v1/events/{eventId}/legal-documents` | Staff |
| `PATCH` | `/v1/legal-documents/{documentId}` | Staff (solo borradores) |
| `POST` | `/v1/legal-documents/{documentId}/publish` | Staff |
| `GET` | `/v1/portal/events/{eventId}/accepted-legal-documents` | Comprador |

### 5.5 Importación de estudiantes (staff)

| Método | Ruta | Descripción |
|---|---|---|
| `POST` | `/v1/events/{eventId}/student-imports` | Crear batch (idempotente por hash del archivo/filas) |
| `GET` | `/v1/events/{eventId}/student-imports/{batchId}` | Estado del batch |

### 5.6 Asistentes (portal)

| Método | Ruta | Rol |
|---|---|---|
| `GET` | `/v1/portal/events/{eventId}/my-group` | Comprador (incluye `currentPayment`, `eventDate`, `timezone`) |
| `GET` | `/v1/groups/{groupId}/participants` | Comprador **o** staff |
| `POST` | `/v1/groups/{groupId}/participants` | Comprador (valida ventana de 20 días) |
| `PATCH` | `/v1/participants/{participantId}` | Comprador (valida ventana de 20 días) |

### 5.7 Pagos

| Método | Ruta | Rol |
|---|---|---|
| `POST` | `/v1/groups/{groupId}/payments` | Comprador |
| `PATCH` | `/v1/payments/{paymentId}` | Comprador (re-aplica stage limit) |
| `POST` | `/v1/payments/{paymentId}/submit` | Comprador |
| `POST` | `/v1/payments/{paymentId}/evidence-upload-url` | Comprador (rechaza APPROVED/REJECTED) |
| `POST` | `/v1/payments/{paymentId}/evidence` | Comprador |
| `GET` | `/v1/events/{eventId}/payment-inbox` | Staff |
| `POST` | `/v1/payments/{paymentId}/approve` | Staff (idempotente con `Idempotency-Key` opcional) |
| `POST` | `/v1/payments/{paymentId}/reject` | Staff |
| `POST` | `/v1/events/{eventId}/cash-payments` | Staff (exige `receiptFileUrl`, idempotente por hash) |

### 5.8 Mapa y reservas

| Método | Ruta | Rol |
|---|---|---|
| `GET` | `/v1/events/{eventId}/map` | Comprador o staff |
| `POST` | `/v1/events/{eventId}/reservations` | Comprador (idempotente con `Idempotency-Key`) |
| `POST` | `/v1/reservations/{reservationId}/release` | Comprador |
| `POST` | `/v1/reservations/{reservationId}/move` | Comprador |

### 5.9 Operación y auditoría (staff)

| Método | Ruta | Descripción |
|---|---|---|
| `POST` | `/v1/events/{eventId}/manual-adjustments` | `RELEASE_RESERVATION`, `UPDATE_TABLE_CAPACITY`, `UPDATE_ATTENDEE_GROUP`, `CUSTOM` |
| `GET` | `/v1/events/{eventId}/audit-log` | Trazabilidad filtrable |

### 5.10 Salud

| Método | Ruta | Uso |
|---|---|---|
| `GET` | `/health/live` | Liveness (sin dependencias) |
| `GET` | `/health/ready` | Readiness (chequea Postgres) |

## 6. Envelope de error (doc 8 §5)

Todos los errores emiten simultáneamente el envelope canónico y los campos planos RFC 7807, de forma aditiva para no romper clientes existentes:

```json
{
  "error": {
    "code": "TABLE_CAPACITY_CONFLICT",
    "message": "La mesa ya no tiene cupos suficientes para completar la reserva.",
    "correlationId": "req-123"
  },
  "type": "about:blank",
  "title": "TABLE_CAPACITY_CONFLICT",
  "status": 409,
  "detail": "La mesa ya no tiene cupos suficientes...",
  "code": "TABLE_CAPACITY_CONFLICT",
  "correlationId": "req-123"
}
```

Códigos definidos en [`domain/error_codes.py`](domain/error_codes.py); mapeo HTTP en [`shared/exceptions/http_map.py`](shared/exceptions/http_map.py). `INVALID_PAYLOAD` se fuerza a 400 por override explícito; `LEGAL_DOCUMENTS_NOT_PUBLISHED` y `PAYMENT_NOT_APPROVED` son `ValidationError` y mapean a 422 al crear reserva.

## 7. Prerrequisitos y ejecución

### 7.1 Requisitos

- Python **3.12+**
- PostgreSQL **16** con el esquema `events` aplicado desde `../data-model/scripts/`
- (Opcional) Docker

### 7.2 Instalación local

```bash
cd backend-api
python -m venv .venv
.venv\Scripts\activate         # Windows
# source .venv/bin/activate    # Linux/macOS
pip install -r requirements/dev.txt
```

### 7.3 Ejecución sin Docker

```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

- Swagger directo: `http://localhost:8000/docs` (requiere `DEBUG=true` y `ROOT_PATH=` vacío)
- OpenAPI JSON: `http://localhost:8000/openapi.json`

### 7.4 Ejecución con Docker

- Stack completo: [`../docker/README.md`](../docker/README.md)
- Solo API + Postgres: [`docker/README.md`](docker/README.md)

Dentro de Compose, `DATABASE_URL` debe usar el hostname del servicio (`db`).

## 8. Variables de entorno

| Variable | Descripción | Default |
|---|---|---|
| `DATABASE_URL` | `postgresql+psycopg://user:pass@host:5432/dbname` | — |
| `JWT_SECRET` | HMAC para JWT (obligatorio en producción) | `change-me-in-production` |
| `JWT_ISSUER` | Emisor | `events-administrator` |
| `JWT_STAFF_AUDIENCE` / `JWT_BUYER_AUDIENCE` | Audiencias | `staff` / `buyer` |
| `JWT_ACCESS_TTL_MINUTES` | TTL del access token | `60` |
| `DEBUG` | Habilita `/docs`, `/openapi.json`, `/redoc`, `staff-register` | `false` |
| `CORS_ORIGINS` | `*` o lista separada por comas | `*` |
| `LOG_LEVEL` | `INFO`, `DEBUG`, etc. | `INFO` |
| `ROOT_PATH` | Prefijo montado por Nginx (`/api` en el compose) | `""` |
| `REDIS_URL` | Store compartido de idempotencia; vacío = in-memory | `""` |
| `IDEMPOTENCY_TTL_SECONDS` | TTL del cache de `Idempotency-Key` | `3600` |

Ejemplo canónico en la raíz: [`../.env.example`](../.env.example).

## 9. Validación manual de endpoints (desarrollo)

URLs asumiendo el stack completo levantado (`http://localhost/api/*`). Para llamar directo al contenedor, usa `http://localhost:8000/*` y quita el `/api` del path.

### 9.1 Health

```bash
curl -s http://localhost/api/health/live
curl -s http://localhost/api/health/ready
```

### 9.2 Registro y login staff

```bash
# Solo si DEBUG=true
curl -s -X POST http://localhost/api/v1/auth/staff-register \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@events.local","password":"admin123","displayName":"Admin","tenantName":"Mi Colegio"}'

TOKEN=$(curl -s -X POST http://localhost/api/v1/auth/staff-login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@events.local","password":"admin123"}' | jq -r .accessToken)

curl -s http://localhost/api/v1/auth/me -H "Authorization: Bearer $TOKEN"
```

### 9.3 Crear venue + layout + mesas

```bash
TENANT=$(curl -s http://localhost/api/v1/auth/me -H "Authorization: Bearer $TOKEN" | jq -r '.memberships[0].tenantId')

VENUE=$(curl -s -X POST http://localhost/api/v1/venues \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d "{\"tenantId\":\"$TENANT\",\"name\":\"Salón Demo\",\"defaultTimezone\":\"America/Bogota\"}" | jq -r .id)

LAYOUT=$(curl -s -X POST "http://localhost/api/v1/venues/$VENUE/layouts" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"name":"Gala","status":"DRAFT"}' | jq -r .id)

for i in 1 2 3; do
  curl -s -X POST "http://localhost/api/v1/layouts/$LAYOUT/tables" \
    -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
    -d "{\"code\":\"M0$i\",\"tableCapacityLimit\":10,\"positionJson\":{\"x\":$((i*90)),\"y\":60,\"rotationDeg\":0}}"
done
```

### 9.4 Crear evento, configurarlo y publicar legales

```bash
EVENT=$(curl -s -X POST http://localhost/api/v1/events \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d "{\"tenantId\":\"$TENANT\",\"venueId\":\"$VENUE\",\"name\":\"Grado 2026\",\"eventDate\":\"2026-06-30T19:00:00Z\"}" | jq -r .id)

curl -s -X POST "http://localhost/api/v1/events/$EVENT/layout-binding" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d "{\"layoutId\":\"$LAYOUT\",\"layoutVersion\":1}"

curl -s -X PUT "http://localhost/api/v1/events/$EVENT/configuration" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{
    "presaleStartDate":"2026-04-01T00:00:00Z",
    "presaleEndDate":"2026-04-30T23:59:59Z",
    "saleStartDate":"2026-05-01T00:00:00Z",
    "saleEndDate":"2026-06-15T23:59:59Z",
    "maxPresaleTickets":4,
    "maxSaleTickets":3
  }'

DATA_DOC=$(curl -s -X POST "http://localhost/api/v1/events/$EVENT/legal-documents" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"documentType":"DATA_POLICY","versionLabel":"v1.0","title":"Política","contentMarkdown":"..."}' | jq -r .id)
curl -s -X POST "http://localhost/api/v1/legal-documents/$DATA_DOC/publish" -H "Authorization: Bearer $TOKEN"

TERMS_DOC=$(curl -s -X POST "http://localhost/api/v1/events/$EVENT/legal-documents" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"documentType":"EVENT_TERMS","versionLabel":"v1.0","title":"Términos","contentMarkdown":"..."}' | jq -r .id)
curl -s -X POST "http://localhost/api/v1/legal-documents/$TERMS_DOC/publish" -H "Authorization: Bearer $TOKEN"
```

### 9.5 Padrón y login comprador

```bash
curl -s -X POST "http://localhost/api/v1/events/$EVENT/student-imports" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{
    "fileName":"demo.csv",
    "expectedColumns":["codigo_unico","apellidos","nombres"],
    "rows":[{"studentCode":"EST-2026-0001","firstName":"Ana","lastName":"Perez"}]
  }'

BUYER=$(curl -s -X POST http://localhost/api/v1/auth/code-login \
  -H "Content-Type: application/json" \
  -d "{\"eventId\":\"$EVENT\",\"studentCode\":\"EST-2026-0001\"}")

BUYER_TOKEN=$(echo "$BUYER" | jq -r .sessionToken)
GROUP_ID=$(echo "$BUYER" | jq -r .groupId)
```

### 9.6 Asistentes, pago y aprobación

```bash
curl -s -X POST "http://localhost/api/v1/groups/$GROUP_ID/participants" \
  -H "Authorization: Bearer $BUYER_TOKEN" -H "Content-Type: application/json" \
  -d '{"firstName":"Ana","lastName":"Perez","documentType":"CC","documentId":"123","isVegetarian":false,"allergies":"","mobilePhone":"3001234567","emergencyContactName":"Maria","emergencyContactPhone":"3009876543","hasReducedMobility":false}'

PAYMENT=$(curl -s -X POST "http://localhost/api/v1/groups/$GROUP_ID/payments" \
  -H "Authorization: Bearer $BUYER_TOKEN" -H "Content-Type: application/json" \
  -d '{"paymentType":"DIGITAL","ticketQuantity":1,"amountCents":50000,"currency":"COP"}' | jq -r .id)

curl -s -X POST "http://localhost/api/v1/payments/$PAYMENT/evidence" \
  -H "Authorization: Bearer $BUYER_TOKEN" -H "Content-Type: application/json" \
  -d '{"fileUrl":"http://test/receipt.png","mimeType":"image/png","evidenceType":"RECEIPT"}'

curl -s -X POST "http://localhost/api/v1/payments/$PAYMENT/submit" -H "Authorization: Bearer $BUYER_TOKEN"

# Comité aprueba
curl -s -X POST "http://localhost/api/v1/payments/$PAYMENT/approve" \
  -H "Authorization: Bearer $TOKEN" -H "Idempotency-Key: approve-$PAYMENT-1" \
  -H "Content-Type: application/json" -d '{"approvedTicketCount":1}'
```

### 9.7 Mapa y reserva

```bash
curl -s "http://localhost/api/v1/events/$EVENT/map" -H "Authorization: Bearer $BUYER_TOKEN"

# Tomar un layoutTableId del map y crear la reserva
TABLE=$(curl -s "http://localhost/api/v1/events/$EVENT/map" -H "Authorization: Bearer $BUYER_TOKEN" | jq -r '.tables[0].id')

curl -s -X POST "http://localhost/api/v1/events/$EVENT/reservations" \
  -H "Authorization: Bearer $BUYER_TOKEN" -H "Idempotency-Key: res-$GROUP_ID-1" \
  -H "Content-Type: application/json" \
  -d "{
    \"paymentId\":\"$PAYMENT\",
    \"legalAcceptance\":{\"accepted\":true,\"policyDocumentId\":\"$DATA_DOC\",\"termsDocumentId\":\"$TERMS_DOC\"},
    \"allocations\":[{\"layoutTableId\":\"$TABLE\",\"spotsReserved\":1}]
  }"
```

Con la respuesta verás `reservationId`, `reservationCodes[]` con los `code` por asistente, y `allocations[]` por mesa.

### 9.8 Auditoría

```bash
curl -s "http://localhost/api/v1/events/$EVENT/audit-log" -H "Authorization: Bearer $TOKEN"
```

## 10. Postman

Colección, variables y criterios de desempeño P90/P95: [`docs/postman.md`](docs/postman.md).

Configuración base sugerida:

- `baseUrl = http://localhost/api` (con Nginx).
- Variables: `{{staffToken}}`, `{{buyerToken}}`, `{{tenantId}}`, `{{eventId}}`, `{{groupId}}`, `{{paymentId}}`.
- Los requests POST idempotentes deben setear el header `Idempotency-Key`.

## 11. Tests

```bash
cd backend-api
pytest -q
```

El suite actual incluye unitarios de reglas (participante/ventana, pago/etapa, reserva/capacidad, camelCase, error model, auth) e integration ligera para health. Para tests contra una BD real define `DATABASE_URL` válida antes de correr.

## 12. Linters / formato

Configuración en [`pyproject.toml`](pyproject.toml): **ruff** (lint + format), **mypy** opcional.

```bash
ruff check .
ruff format .
mypy .              # opcional
```

## 13. Base de datos y migraciones

- **Fuente de verdad del esquema**: scripts en `../data-model/scripts/` (schema `events`, FKs, funciones como `fn_next_reservation_sequence_number`).
- **Alembic**: no sustituye esos scripts en el MVP. Si se adopta baseline Alembic en el futuro, debe reflejar exactamente el estado de `data-model`.

## 14. Troubleshooting

| Síntoma | Causa probable |
|---|---|
| `relation "events.xxx" does not exist` | DDL no aplicado; ejecutar scripts de `data-model`. |
| `ready` → 503 | `DATABASE_URL` incorrecto o Postgres no levantado. |
| `Invalid token` | `JWT_SECRET` distinto entre emisión y validación; audiencia incorrecta. |
| `Not allowed for this event` | Staff sin fila en `event_organizer_assignment` ni membresía de tenant. |
| Swagger no visible | `DEBUG=false`; poner `DEBUG=true` solo en dev. |
| Tras Nginx, `404` en rutas | Usar prefijo `/api`: `/api/v1/...` (ver `nginx/nginx.conf`). |
| Swagger "Try it out" falla | Con Nginx usa `http://localhost/api/docs` y `ROOT_PATH=/api`. Solo `:8000`: `ROOT_PATH=` vacío. |
| `LEGAL_ACCEPTANCE_REQUIRED` al reservar | El request no incluye `legalAcceptance` o `accepted != true`. |
| `PAYMENT_ALREADY_REVIEWED` al subir evidencia | El pago ya está APPROVED o REJECTED; el endpoint ahora rechaza este caso. |
| `429` en login | Rate-limit (10 intentos en 15 min por IP). Revisar header `Retry-After`. |

## 15. Enlaces

- Docker backend-only: [`docker/README.md`](docker/README.md)
- Arquitectura técnica: [`docs/architecture.md`](docs/architecture.md)
- Postman: [`docs/postman.md`](docs/postman.md)
- Contrato REST completo: [`../PromptsDiseñoApp/8.APIs_y_contratos_gestion_ubicaciones_eventos.md`](../PromptsDiseñoApp/8.APIs_y_contratos_gestion_ubicaciones_eventos.md)
- Data model: [`../data-model/README.md`](../data-model/README.md)
