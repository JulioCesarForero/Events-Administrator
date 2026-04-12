# Authentication Flow

The API uses JWT tokens with two distinct audiences for staff and buyer sessions.

## Staff Authentication

1. **Login:** `POST /v1/auth/staff-login` with `{ "email": "...", "password": "..." }`
2. **Response:** `{ "accessToken": "...", "tokenType": "bearer", "userId": "...", "email": "..." }`
3. **Token claims:** `{ "sub": "<user-id>", "aud": "staff", "iss": "events-administrator" }`
4. **Usage:** Include `Authorization: Bearer <token>` on all staff endpoints.
5. **Access control:** Staff must have a `UserTenantMembership` for the tenant or an `EventOrganizerAssignment` for the event.

## Buyer Authentication (Student Code)

1. **Login:** `POST /v1/auth/code-login` with `{ "eventId": "...", "studentCode": "ABC123" }`
2. **Prerequisite:** Student code must exist in an imported roster for the event.
3. **Idempotent:** Re-login with the same code reopens the existing `AttendeeGroup` (returns `reusedExistingGroup: true`).
4. **Response:** `{ "sessionToken": "...", "eventId": "...", "groupId": "...", "studentCode": "...", "isFirstUse": true/false, "reusedExistingGroup": true/false }`
5. **Token claims:** `{ "sub": "<group-id>", "event_id": "<event-id>", "typ": "buyer", "aud": "buyer" }`
6. **Usage:** Include `Authorization: Bearer <token>` on buyer endpoints.
7. **Scope:** Token is scoped to one event and one group. Cannot access other events.

## Token Configuration

Environment variables:
- `JWT_SECRET` — signing key (required)
- `JWT_ISSUER` — token issuer claim (default: `events-administrator`)
- `JWT_STAFF_AUDIENCE` — staff token audience (default: `staff`)
- `JWT_BUYER_AUDIENCE` — buyer token audience (default: `buyer`)
- `JWT_ACCESS_TTL_MINUTES` — token lifetime (default: 60 minutes)

## Security Notes

- Staff and buyer tokens use different audiences and cannot be interchanged.
- The map endpoint (`GET /v1/events/{eventId}/map`) accepts both token types — staff see all tables, buyers must have approved payment.
- The `GET /v1/groups/{groupId}/participants` endpoint accepts both token types.
- Debug-only endpoint `POST /v1/auth/staff-register` exists when `DEBUG=true`.
