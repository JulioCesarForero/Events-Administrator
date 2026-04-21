# Frontend — Events Administrator

SPA React + TypeScript + Vite. Implementa **dos experiencias bajo una sola aplicación**:

- **Portal comprador** bajo `/portal/:eventId/*` (login por código, asistentes, pago, mapa, reserva).
- **Panel staff** bajo `/staff/*` (importación, pagos, políticas, mapa, ajustes, auditoría).

Consume el backend a través de un reverse proxy (`/api/*`) o directamente si se configura `VITE_API_BASE_URL`.

## 1. Stack

| Capa | Tecnología |
|---|---|
| UI | React 19 + TypeScript |
| Build | Vite 8 + React Compiler (`babel-plugin-react-compiler`) |
| Router | `react-router-dom` 7 |
| Data fetch | `fetch` en [`src/api/client.ts`](src/api/client.ts) + hooks opt-in con `@tanstack/react-query` en [`src/api/queries.ts`](src/api/queries.ts) |
| Iconos | `lucide-react` |
| Tests | Vitest + Testing Library |
| Lint | ESLint (config en `eslint.config.js`) |

## 2. Estructura relevante

```text
frontend/
├── package.json
├── vite.config.ts              # proxy /api a VITE_API_PROXY_TARGET + React Compiler
├── .env.example                # plantilla de variables Vite
├── src/
│   ├── main.tsx                # providers: QueryClient → Toast → AuthStaff → AuthPortal
│   ├── App.tsx                 # Rutas portal/staff, guards, theme picker
│   ├── api/
│   │   ├── client.ts           # fetch con Authorization, Idempotency-Key, parser dual
│   │   ├── types.ts            # tipos del doc 8 (manualmente curados)
│   │   ├── queries.ts          # hooks opt-in TanStack Query
│   │   └── openapi.d.ts        # generado por `npm run types:gen` (opcional)
│   ├── contexts/AuthContext.tsx
│   ├── hooks/useMediaQuery.ts
│   ├── router/guards.tsx       # RequireBuyerAuth / RequireStaffAuth (JWT + eventId)
│   ├── components/
│   │   ├── ui/                 # Button, Input, GlassCard, Modal, StatusBadge,
│   │   │                       # InlineAlert, Stepper, DataTable, Drawer, BottomSheet,
│   │   │                       # FileUploader, Toast
│   │   └── staff/              # VenueStep, LayoutStep, EventConfigStep
│   ├── pages/
│   │   ├── portal/             # PortalLanding, PortalCodeLogin, PortalDashboard,
│   │   │                       # PortalAttendees, PortalPayment, PortalPaymentStatus,
│   │   │                       # PortalMap
│   │   └── staff/              # StaffLogin, StaffDashboard, StaffEventWizard,
│   │                           # StaffStudents, StaffPayments, StaffPolicies,
│   │                           # StaffMap, StaffManualAdjustments, StaffAudit
│   └── styles/                 # variables, animations, glassmorphism
└── coverage/                   # reporte vitest
```

## 3. Cómo compilar y correr

### 3.1 Desarrollo local con Vite (hot reload)

```bash
cd frontend
npm install
npm run dev         # http://localhost:5173
```

- Vite proxy-a `/api/*` hacia `VITE_API_PROXY_TARGET` (default `http://localhost`). Con el stack completo levantado por Docker, eso apunta a Nginx en `:80`.
- Se puede trabajar con el backend en modo local (`uvicorn` en `:8000`) poniendo `VITE_API_PROXY_TARGET=http://localhost:8000` y `VITE_API_BASE_URL=/v1` en `.env.local`.

### 3.2 Build de producción (estático)

```bash
npm run build       # ejecuta tsc -b && vite build
npm run preview     # sirve dist/ en http://localhost:4173
```

La salida queda en `dist/` y es lo que copia el `frontend.Dockerfile` dentro de la imagen nginx que usa el reverse proxy.

### 3.3 Build dentro de Docker

```bash
# desde la raíz del repo
docker build -f docker/frontend.Dockerfile \
  --build-arg VITE_API_BASE_URL=/api/v1 \
  --build-arg VITE_API_TIMEOUT_MS=20000 \
  --build-arg VITE_EVIDENCE_STORAGE=signed \
  --build-arg VITE_EVIDENCE_MAX_MB=5 \
  -t events-frontend:local .
```

O simplemente `docker compose -f docker/compose.local.yml up --build`, que toma los args desde `.env`.

## 4. Variables de entorno (Vite)

Las variables `VITE_*` se leen en **tiempo de build** y quedan horneadas en el bundle.

| Variable | Default | Uso |
|---|---|---|
| `VITE_API_BASE_URL` | `/api/v1` | Prefijo de todas las llamadas del `apiClient`. |
| `VITE_API_PROXY_TARGET` | `http://localhost` | Upstream del proxy de Vite en dev. |
| `VITE_API_TIMEOUT_MS` | `20000` | Timeout de cada request HTTP. |
| `VITE_EVIDENCE_STORAGE` | `signed` | `signed` = usa URL firmada (`/payments/{id}/evidence-upload-url`). `inline` = base64 data URL (fallback MVP). |
| `VITE_EVIDENCE_MAX_MB` | `5` | Límite de tamaño en el `FileUploader`. |

Copia [`.env.example`](.env.example) a `.env.local` y edita según tu entorno de dev.

## 5. URLs de desarrollo y navegación

Asumiendo que el stack completo corre en `http://localhost` (ver README raíz). Si trabajas con `npm run dev`, reemplaza por `http://localhost:5173`.

### 5.1 Portal comprador

| Ruta | Estado | Función |
|---|---|---|
| `/portal` | Pública | Landing amigable. Si tienes un enlace directo del comité, lo abres desde ahí. |
| `/portal/:eventId/login` | Pública (por evento) | Login por código de estudiante. |
| `/portal/:eventId/dashboard` | Protegida (`RequireBuyerAuth`) | Resumen del proceso con stepper global (asistentes → pago → reserva). Consume `/portal/events/{eventId}/my-group`. |
| `/portal/:eventId/attendees` | Protegida | CRUD de asistentes. Banner de bloqueo cuando faltan ≤20 días. |
| `/portal/:eventId/payment` | Protegida | Registro de pago (DIGITAL o CASH). Sube evidencia con URL firmada. |
| `/portal/:eventId/payment-status` | Protegida | Estado del pago. Si está REJECTED muestra el motivo y CTA "Corregir y reenviar". |
| `/portal/:eventId/map` | Protegida | Mapa con semáforo, stepper +/- de cupos, total asignado/aprobado, modal de consentimiento con documentos reales y modal de confirmación con `reservationCodes`. |

### 5.2 Panel staff

| Ruta | Estado | Función |
|---|---|---|
| `/staff/login` | Pública | Login staff. |
| `/staff/dashboard` | Protegida (`RequireStaffAuth`) | Lista eventos del tenant con accesos rápidos. |
| `/staff/events/new` | Protegida | Wizard de 3 pasos (venue → layout → configuración). |
| `/staff/events/:eventId/students` | Protegida | Importación CSV + CRUD del padrón. |
| `/staff/events/:eventId/payments` | Protegida | Bandeja con drawer de detalle, modales de aprobar (cantidad editable) y rechazar (razón obligatoria). |
| `/staff/events/:eventId/policies` | Protegida | Gestión de `DATA_POLICY` y `EVENT_TERMS` (crear, editar borrador, publicar). |
| `/staff/events/:eventId/map` | Protegida | Vista operativa. |
| `/staff/events/:eventId/manual-adjustments` | Protegida | Acciones del backend (`RELEASE_RESERVATION`, `UPDATE_TABLE_CAPACITY`, etc.). |
| `/staff/events/:eventId/audit` | Protegida | Auditoría con búsqueda y filtro por actor. |

### 5.3 Guards

- [`RequireBuyerAuth`](src/router/guards.tsx) verifica sesión, expiración del token y que el `event_id` del JWT coincida con la ruta.
- [`RequireStaffAuth`](src/router/guards.tsx) verifica sesión y expiración. Si el token venció redirige a login correspondiente.

## 6. Cómo validar el frontend en dev

### 6.1 Smoke test manual (sin datos reales)

1. Levanta el stack: `docker compose -f docker/compose.local.yml up --build`.
2. Abre `http://localhost/`.
3. Debe aparecer la landing `/portal`.
4. Cambia a `http://localhost/staff/login`, crea un staff desde cURL (ver README raíz §5.2) y entra.
5. Desde el dashboard crea un evento con el wizard.
6. Importa un CSV mínimo (`codigo_unico,apellidos,nombres`) con una fila.
7. Publica política y términos desde `/staff/events/:eventId/policies`.
8. En pestaña incógnita, abre `http://localhost/portal/:eventId/login` con el código de estudiante importado.
9. Registra asistentes, crea y envía un pago digital.
10. Vuelve al panel staff, aprueba el pago, vuelve al portal y reserva una mesa.

### 6.2 Validación del cliente HTTP

Abre DevTools → Network y verifica:

- Todas las llamadas POST a `/v1/events/{id}/reservations`, `/v1/payments/{id}/approve`, `/v1/events/{id}/cash-payments` y `/v1/events/{id}/student-imports` incluyen el header `Idempotency-Key` (generado automáticamente por `apiClient`).
- Las llamadas incluyen `Authorization: Bearer <token>` cuando se pasa `{ token, isBearer: true }`.
- Los errores 4xx renderizan mensajes legibles extraídos de `error.message` o `detail`.

### 6.3 Pruebas automatizadas

```bash
npm test             # vitest run
npm run coverage     # vitest con cobertura
npm run lint
```

Los tests actuales cubren los tres componentes del wizard de eventos. Para cualquier cambio futuro, mantener coverage y añadir tests de página cuando sea razonable.

### 6.4 Generar tipos desde OpenAPI

Con el backend corriendo con `DEBUG=true` (para exponer `/openapi.json`):

```bash
npm run types:gen
# genera src/api/openapi.d.ts contra http://localhost/openapi.json
```

Esos tipos son opt-in y conviven con los tipos curados manualmente en [`src/api/types.ts`](src/api/types.ts).

## 7. Contrato con el backend

Estos contratos están alineados al [documento 8](../PromptsDiseñoApp/8.APIs_y_contratos_gestion_ubicaciones_eventos.md) y el backend emite nombres canónicos + legacy al mismo tiempo:

- `Reservation.reservationId` (canónico) / `id` (legacy)
- `ReservationCode.code` (canónico) / `reservationCode` (legacy)
- `Allocation.spotsReserved` (canónico) / `spots` (legacy)
- `Map.tables[].id` + `occupiedSpots` + `availableSpots` + `position.{x,y,rotationDeg}` (canónico); los nombres viejos (`layoutTableId`, `occupied`, `available`, `positionJson`) siguen disponibles.
- `Payment.reason` (canónico) / `rejectionReason` (legacy)
- Error envelope: `{ "error": { "code", "message", "correlationId" } }` **más** los campos planos RFC 7807.

## 8. Idempotencia desde el frontend

El `apiClient` inyecta `Idempotency-Key` automáticamente en rutas idempotentes (`/events/{id}/reservations`, `/payments/{id}/approve`, `/events/{id}/cash-payments`, `/events/{id}/student-imports`). Si quieres pasar una clave explícita (p. ej. proveniente del request original):

```ts
await apiClient.post(`/events/${eventId}/reservations`, body, {
  token: session.sessionToken,
  isBearer: true,
  idempotency: 'reservation-' + groupId + '-v1',
});
```

## 9. Accesibilidad y UX

- `Input` usa `useId()` y expone `aria-invalid` / `aria-describedby`.
- `Button` con `isLoading` muestra spinner animado vía clase CSS (no estilos inline en cada render).
- `Toast` y `InlineAlert` reemplazan `window.alert` en los flujos críticos.
- Responsive: hook `useIsMobile` y breakpoints en `PortalMap`; StaffMap con scroll horizontal en layouts grandes.

## 10. Troubleshooting

| Síntoma | Causa probable |
|---|---|
| `/portal` muestra "redirigido a login" | Token caducado o ausente; `RequireBuyerAuth` se activa. |
| `503` en cualquier ruta | Stack levantado sin el servicio `frontend`. Usa `docker compose ps`. |
| "No se pudo cargar el mapa" | Pago no aprobado (backend responde `PAYMENT_NOT_APPROVED` 422). Revisar estado en `/payment-status`. |
| Modal legal sin contenido | Falta publicar `DATA_POLICY` o `EVENT_TERMS` en `/staff/.../policies`. |
| Subida de evidencia falla con 409 | El pago ya fue aprobado/rechazado; `evidence-upload-url` rechaza estos casos. |
| Tests fallan tras cambiar API | Revisar que `apiClient` incluya los métodos mockeados (p.ej. `put` en `EventConfigStep.test.tsx`). |

## 11. Enlaces

- Contrato REST completo: [`../PromptsDiseñoApp/8.APIs_y_contratos_gestion_ubicaciones_eventos.md`](../PromptsDiseñoApp/8.APIs_y_contratos_gestion_ubicaciones_eventos.md)
- UX y flujos: [`../PromptsDiseñoApp/5.UX_UI_y_flujos_gestion_ubicaciones_eventos.md`](../PromptsDiseñoApp/5.UX_UI_y_flujos_gestion_ubicaciones_eventos.md)
- Backend API: [`../backend-api/README.md`](../backend-api/README.md)
- Docker stack: [`../docker/README.md`](../docker/README.md)
