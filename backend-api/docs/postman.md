# Postman / Newman — colección y pruebas

## Variables de entorno sugeridas

| Variable | Ejemplo | Uso |
|----------|---------|-----|
| `baseUrl` | `http://localhost:8000` | API directa al contenedor o uvicorn local |
| `baseUrlNginx` | `http://localhost` | Si usas nginx, prefijo `/api` → rutas sin `/api` en path del request (ver nota abajo) |
| `staffToken` | *(Bearer sin prefijo)* | Tras `POST /v1/auth/staff-login` |
| `buyerToken` | *(Bearer sin prefijo)* | Tras `POST /v1/auth/code-login` → campo `session_token` |
| `tenantId` | UUID | Tenant demo u organización |
| `eventId` | UUID | Evento de prueba |
| `groupId` | UUID | Grupo comprador |
| `venueId` | UUID | Salón |
| `layoutId` | UUID | Layout |
| `policyDocId` | UUID | `DATA_POLICY` publicado |
| `termsDocId` | UUID | `EVENT_TERMS` publicado |
| `paymentId` | UUID | Pago aprobado |
| `reservationId` | UUID | Reserva creada |

**Nginx:** las peticiones van a `{{baseUrlNginx}}/api/v1/...` (el proxy quita `/api` y reenvía a `/v1/...`).

## Estructura de carpetas en Postman

1. **Health** — `GET /health/live`, `GET /health/ready`
2. **Auth** — `staff-login`, `code-login`, (opcional) `staff-register` con `DEBUG=true`
3. **Venues** — list/create venues; layouts por venue; tables por layout
4. **Events** — list/create; `PUT .../configuration`; `POST .../layout-binding`
5. **Legal** — CRUD + publish; portal accepted docs (buyer)
6. **Import** — crear batch (+ `rows` en JSON para prueba rápida); estado del batch
7. **Portal / Attendees** — `my-group`; participantes (buyer); listado participantes (staff)
8. **Payments** — crear, patch, submit; inbox (staff); approve/reject; cash; evidencia
9. **Map** — `GET .../map` (Authorization staff o buyer)
10. **Reservations** — crear, `release`, `move`
11. **Audit** — `audit-log`
12. **Operations** — `manual-adjustments`

## Flujo funcional mínimo (happy path)

1. `staff-login` → guardar `staffToken`.
2. Crear o reutilizar `tenantId` (datos semilla en `data-model/scripts/05_seed`).
3. `GET /v1/venues?tenant_id=...` o `POST /v1/venues`.
4. `POST /v1/events` → `eventId`; `PUT /v1/events/{{eventId}}/configuration`.
5. `POST /v1/events/{{eventId}}/layout-binding` con `layoutId` + `layout_version`.
6. `POST /v1/events/{{eventId}}/student-imports` con `rows: [...]` para cargar códigos.
7. `POST /v1/auth/code-login` → `buyerToken`, `groupId`.
8. `POST /v1/groups/{{groupId}}/participants` (N veces según reglas de negocio).
9. `POST .../payments` → submit → `approve` (staff).
10. Publicar legales si hace falta; anotar `policyDocId` y `termsDocId`.
11. `GET /v1/events/{{eventId}}/map` con token buyer o staff.
12. `POST /v1/events/{{eventId}}/reservations` con `allocations`, `payment_id`, ids legales.
13. Opcional: `POST /v1/reservations/{{reservationId}}/move` con nuevas `allocations` (mismo total de cupos).

## Ejemplos rápidos

**Staff login**

```json
POST {{baseUrl}}/v1/auth/staff-login
{ "email": "admin@demo.local", "password": "..." }
```

**Code login**

```json
POST {{baseUrl}}/v1/auth/code-login
{ "eventId": "{{eventId}}", "studentCode": "EST-001" }
```

**Reserva**

```json
POST {{baseUrl}}/v1/events/{{eventId}}/reservations
Authorization: Bearer {{buyerToken}}
{
  "payment_id": "{{paymentId}}",
  "policy_document_id": "{{policyDocId}}",
  "terms_document_id": "{{termsDocId}}",
  "allocations": [
    { "layout_table_id": "{{tableUuid}}", "spots": 2 }
  ]
}
```

## Criterios P90 / P95 (disponibilidad y consistencia)

Orientados a Newman o k6 contra un entorno con datos semilla:

| Escenario | Objetivo sugerido | Criterio |
|-----------|-------------------|----------|
| `GET /health/live` | P95 < 50 ms | Siempre 200 |
| `GET /v1/events/{id}/map` (auth) | P95 < 300 ms | 200 y cuerpo lista mesas |
| `POST /v1/events/{id}/reservations` | P95 < 2 s | 200 y `status` CONFIRMED; sin 5xx bajo carga moderada |
| Concurrencia 2 reservas misma mesa | — | Una obtiene 409/422 por cupos; BD consistente (`current_occupied_spots`) |

Ejecutar varias iteraciones con Newman (`delayRequest` bajo) y revisar que no haya fugas de conexión (pool SQLAlchemy).

## Exportar colección

Cuando estabilices la API, exporta la colección Postman v2.1 al repo (por ejemplo `docs/postman/Events-Administrator.postman_collection.json`) y referencia este documento en el README.
