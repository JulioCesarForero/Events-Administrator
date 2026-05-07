# API Contract Summary

All endpoints are versioned under `/v1`. When using Nginx, the full path is `/api/v1/...`.
With `DEBUG=true`, interactive Swagger documentation is available at `/docs` (or `/api/docs` via Nginx).

## Authentication

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/v1/auth/staff-login` | POST | None | Staff email/password login. Returns JWT with `aud=staff`. |
| `/v1/auth/code-login` | POST | None | Student code login. Returns JWT with `aud=buyer`, scoped to `eventId` + `groupId`. Idempotent: re-entry reopens same group. |

## Venues and Layouts

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/v1/venues` | GET | Staff | List venues for a tenant (`tenantId` query param). |
| `/v1/venues` | POST | Staff | Create a venue. |
| `/v1/venues/{venueId}/layouts` | GET | Staff | List layouts for a venue. |
| `/v1/venues/{venueId}/layouts` | POST | Staff | Create a layout. |
| `/v1/layouts/{layoutId}/tables` | GET | Staff | List tables in a layout. |
| `/v1/layouts/{layoutId}/tables` | POST | Staff | Create a table in a layout. |

## Events

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/v1/events` | GET | Staff | List events for a tenant. |
| `/v1/events` | POST | Staff | Create an event. |
| `/v1/events/{eventId}/configuration` | PUT | Staff | Create or update event configuration (stages, dates, ticket limits). |
| `/v1/events/{eventId}/layout-binding` | POST | Staff | Bind a layout version to an event. |

## Legal Documents

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/v1/events/{eventId}/legal-documents` | GET | Staff | List legal documents for an event. |
| `/v1/events/{eventId}/legal-documents` | POST | Staff | Create a legal document (DATA_POLICY or EVENT_TERMS). |
| `/v1/legal-documents/{documentId}` | PATCH | Staff | Edit a draft legal document. |
| `/v1/legal-documents/{documentId}/publish` | POST | Staff | Publish a legal document. |
| `/v1/portal/events/{eventId}/accepted-legal-documents` | GET | Buyer | Get the buyer's accepted legal document versions. |

## Student Import

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/v1/events/{eventId}/student-imports` | POST | Staff | Import student records (inline `rows` or file reference). |
| `/v1/events/{eventId}/student-imports/{batchId}` | GET | Staff | Check import batch status. |

## Attendees

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/v1/portal/events/{eventId}/my-group` | GET | Buyer | Get buyer's group info (status, approved tickets). |
| `/v1/groups/{groupId}/participants` | GET | Staff or Buyer | List participants in a group. |
| `/v1/groups/{groupId}/participants` | POST | Buyer | Add a participant (within 20-day edit window). |
| `/v1/participants/{participantId}` | PATCH | Buyer | Update a participant (within 20-day edit window). |

## Payments

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/v1/groups/{groupId}/payments` | POST | Buyer | Create a payment (enforces stage ticket limits). |
| `/v1/payments/{paymentId}` | PATCH | Buyer | Edit payment (only in DRAFT or REJECTED status). |
| `/v1/payments/{paymentId}/submit` | POST | Buyer | Submit payment for approval (requires evidence for DIGITAL, requires all participants registered). |
| `/v1/payments/{paymentId}/evidence-upload-url` | POST | Buyer | Get a signed upload URL for evidence. |
| `/v1/payments/{paymentId}/evidence` | POST | Buyer | Register uploaded evidence metadata. |
| `/v1/events/{eventId}/payment-inbox` | GET | Staff | List payments pending approval. |
| `/v1/payments/{paymentId}/approve` | POST | Staff | Approve a payment (optional `approvedTicketCount` in body). |
| `/v1/payments/{paymentId}/reject` | POST | Staff | Reject a payment (optional `reason`). |
| `/v1/events/{eventId}/cash-payments` | POST | Staff | Register a cash payment (goes to PENDING_APPROVAL). |

## Map

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/v1/events/{eventId}/map` | GET | Staff or Buyer | Get event map. Returns `{ eventId, layoutId, tables[] }`. Buyers must have approved payment. Each table includes `status` (AVAILABLE/LIMITED/FULL). |

## Reservations

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/v1/events/{eventId}/reservations` | POST | Buyer | Create a reservation. Requires approved payment, published legal docs, valid allocations. Returns per-participant reservation codes. Supports `Idempotency-Key` header. |
| `/v1/reservations/{reservationId}/release` | POST | Buyer | Release a reservation (frees table spots). |
| `/v1/reservations/{reservationId}/move` | POST | Buyer | Move reservation to different tables (same total spots). |

## Staff: grupos, asistentes y reservas (panel operativo)

Consolidated search and admin actions for buyer groups (`AttendeeGroup`), aligned with table-based reservations and audit.

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/v1/events/{eventId}/staff/groups/search` | GET | Staff (`VIEW_STUDENTS`) | Query params: `student_code`, `name`, `document_id`, `payment_status`, `reservation_status`, `layout_table_id`, `limit`. Returns lightweight group rows. |
| `/v1/events/{eventId}/staff/groups/{groupId}` | GET | Staff (`VIEW_STUDENTS`) | Consolidated detail: portal-style summary, full participants, payments, reservations with table lines and codes. |
| `/v1/events/{eventId}/staff/groups/{groupId}/audit-log` | GET | Staff (`VIEW_STUDENTS`) | Audit entries for the group (entity ids, payloads with `attendeeGroupId`, legacy `reservation_id` in manual adjustments). |
| `/v1/events/{eventId}/staff/participants/{participantId}` | PATCH | Staff (`MANAGE_STUDENTS`) | Body: `{ "reason", "fields": { ... } }`. Admin edit without buyer edit window; writes `STAFF_UPDATE_PARTICIPANT` audit. |
| `/v1/events/{eventId}/staff/groups/{groupId}/participants` | POST | **SUPER_ADMIN** + staff event access | Body: `{ "reason", "participant": { ... } }`. Insert after approved payment; enforces approved ticket count and stage participant cap. |
| `/v1/events/{eventId}/staff/reservations/{reservationId}/release` | POST | **SUPER_ADMIN** + staff event access | Body: `{ "reason" }`. Frees table spots via reservation service; audit `STAFF_RELEASE_RESERVATION`. |
| `/v1/events/{eventId}/staff/reservations/{reservationId}/move` | POST | **SUPER_ADMIN** + staff event access | Body: `{ "reason", "allocations": [{ "layoutTableId", "spots" }] }`. Same semantics as buyer move; preserves reservation codes. |
| `/v1/events/{eventId}/staff/reports/venue-attendees` | GET | **SUPER_ADMIN** + staff event access | Report for venue/restaurant: participants grouped by student, reservation code, table code(s), full participant fields, totals. Query: `format=json` (default) or `format=csv`, `include_non_active` (default `false` excludes rows that only reflect released/non-active seating; keeps participants without a reservation code). |
| `/v1/events/{eventId}/staff/reports/payment-approvals` | GET | **SUPER_ADMIN** + staff event access | Financial approval report: who approved each payment, which student/group it belongs to, approved amounts/tickets and event totals. Query: `format=json` (default) or `format=csv`. |

`RELEASE_RESERVATION` via `/v1/events/{eventId}/manual-adjustments` also requires **SUPER_ADMIN** (legacy path; prefer staff reservation release above).

## Operations

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/v1/events/{eventId}/manual-adjustments` | POST | Staff | Manual operational adjustment (`RELEASE_RESERVATION` **SUPER_ADMIN only**, `UPDATE_TABLE_CAPACITY`, etc.). |
| `/v1/events/{eventId}/audit-log` | GET | Staff | View audit log for an event. |

## Error Model

All errors follow RFC 7807 with additional fields:

```json
{
  "type": "about:blank",
  "title": "TABLE_CAPACITY_CONFLICT",
  "detail": "Not enough capacity on table M-01",
  "status": 409,
  "code": "TABLE_CAPACITY_CONFLICT",
  "correlationId": "abc-123-request-id"
}
```

Machine-readable `code` values: `UNAUTHENTICATED`, `TABLE_CAPACITY_CONFLICT`, `PAYMENT_ALREADY_REVIEWED`, `STAGE_LIMIT_EXCEEDED`, `PAYMENT_NOT_APPROVED`, `MISSING_PAYMENT_EVIDENCE`, `LEGAL_DOCUMENTS_NOT_PUBLISHED`, `PARTICIPANT_EDIT_WINDOW_CLOSED`, `PARTICIPANTS_INCOMPLETE`, `RESERVATION_EXCEEDS_APPROVED_TICKETS`, `PAYMENT_INVALID_STATE`.

## Serialization

All request and response bodies use **camelCase** field names (e.g., `eventId`, `studentCode`, `ticketQuantity`).
