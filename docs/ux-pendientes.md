# Pendientes de UX/UI (por definir en versiones futuras)

Backlog de mejoras de diseño identificadas en la crítica de diseño del 2026-10-30 que **no** se aplicaron en esta versión. Cada ítem queda abierto hasta que se defina su alcance.

## UX-01 · Personalización de tema: de preferencia de usuario a marca del tenant

**Estado actual (se mantiene):** cualquier usuario (staff o estudiante) puede cambiar el color de acento desde el botón flotante de paleta (abajo a la derecha). La elección se guarda en `localStorage` (`app_theme`) y aplica uno de cuatro temas: Verde Neón, Naranja Neón, Azul Vibrante y Púrpura (`frontend/src/styles/variables.css`).

**Problema:**
- El color de acento funciona como identidad visual, pero lo decide cada usuario y no la organización. Dos estudiantes del mismo colegio ven el portal con colores distintos.
- El botón flotante aparece en todas las pantallas y puede tapar acciones en celular (por ejemplo, el `BottomSheet` del mapa o los botones al final de los formularios).
- La preferencia vive solo en el navegador: se pierde al cambiar de dispositivo.

**Propuesta a definir:**
1. El administrador del tenant elige el tema (y en el futuro un color o logo propio) desde la configuración del tenant o del evento. El backend lo entrega en la sesión del portal y del staff.
2. El portal del estudiante aplica el tema del tenant/evento sin mostrar selector.
3. Opcional: conservar el selector solo para el staff, como preferencia personal guardada en su perfil (no en `localStorage`), o moverlo a un menú de usuario en vez de un botón flotante.
4. Si se permiten colores personalizados, validar en el backend que el acento cumpla contraste AA: al menos 3:1 contra `--bg-dark` para componentes y 4.5:1 para `--accent-text`; calcular `--on-accent` (negro o blanco) automáticamente.

**Dependencias:** modelo de datos del tenant/evento (campo de tema), endpoint de configuración, contrato de sesión del portal.

**Criterio de aceptación sugerido:** todos los usuarios de un mismo tenant/evento ven el mismo tema; ningún control flotante tapa acciones primarias en anchos de 360 px.

## UX-02 · Navegación de la consola de staff — ✅ resuelto (2026-10-30)

`StaffShell` (`frontend/src/components/staff/StaffShell.tsx`) reemplazó la barra lateral vacía. Muestra navegación general y del evento actual filtrada por rol (`utils/staffPermissions.ts`); en celular se abre en un `Drawer`, y en el login y la pantalla sin tenant no aparece.

Queda por definir:
- El nombre del evento en el menú sale de `eventAssignments` o, para administradores del tenant, de la lista que cargó el dashboard (`sessionStorage`). Si alguien abre un enlace directo a un evento, ve "Evento actual". Un endpoint o un campo con el nombre del evento lo resolvería.
- Los botones "← volver" de cada pantalla ya no son necesarios con el menú; se pueden retirar.

## UX-03 · Diálogos nativos restantes

Quedan pendientes de migrar a `Modal` / `useConfirm` / `useToast`:
- `window.prompt` para renombrar o eliminar objetos del plano (`StaffMap.tsx`) y para la nueva contraseña (`AdminStaffUsers.tsx`).
- `alert` en los pasos del asistente de creación de eventos (`components/staff/*Step.tsx`), cuyos tests verifican hoy `window.alert`.

## UX-04 · Estilos inline

Gran parte de las pantallas usa estilos inline (más de 800 `style={{…}}`). Los colores y tamaños de letra ya usan tokens, pero el espaciado y los layouts deberían migrar a clases o componentes reutilizables a medida que se toque cada pantalla.

## UX-05 · Colores del plano (Konva)

`EventMap.tsx` dibuja en canvas: allí `var(--accent-primary)` no se resuelve y los colores verdes están fijos. Hay que leer los tokens con `getComputedStyle` para que el plano siga el tema activo.

## UX-06 · Títulos y jerarquía de encabezados

Ya usan `h1` el login del staff, el login del portal, "Mis eventos", "Resumen de tu proceso" y la pantalla sin tenant. El resto de pantallas sigue usando `h2` como título principal; pasarlas a `h1` al tocarlas.

## UX-07 · Mensajes de error de la API

Algunos errores llegan en inglés y técnicos desde el backend (p. ej. "Invalid token" con un token vencido). Conviene mapear los códigos de error de la API a mensajes en español y, ante un 401, redirigir al login con un aviso de sesión vencida.
