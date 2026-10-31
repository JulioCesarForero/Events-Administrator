import type { StaffSession } from '../contexts/AuthContext';

const TENANT_ADMIN_ROLES = ['ADMIN', 'OWNER', 'TENANT_ADMIN', 'SUPER_ADMIN'];
const PAYMENT_ROLES = ['CASHIER', 'ORGANIZER', 'COORDINATOR'];
const VIEWER_ROLES = ['REVIEWER', 'ORGANIZER', 'COORDINATOR', 'CASHIER'];
const ORGANIZER_ROLES = ['ORGANIZER', 'COORDINATOR'];

export interface EventPermissions {
  isAdmin: boolean;
  isSuperAdmin: boolean;
  /** Pagos, estudiantes y reservas. */
  canViewOperations: boolean;
  /** Diseño del plano. */
  canEditMap: boolean;
  /** Políticas, ajustes, auditoría y staff del evento. */
  canManageEvent: boolean;
}

/**
 * Permisos del staff sobre un evento: rol del tenant + rol asignado en el evento.
 * Fuente única para el dashboard y la navegación lateral.
 */
export function getEventPermissions(session: StaffSession | null, eventId?: string): EventPermissions {
  const tenantRole = session?.role || '';
  const eventRole =
    (eventId && session?.eventAssignments?.find((a) => a.eventId === eventId)?.role) || tenantRole;
  const isAdmin = TENANT_ADMIN_ROLES.includes(tenantRole);
  return {
    isAdmin,
    isSuperAdmin: tenantRole === 'SUPER_ADMIN',
    canViewOperations:
      isAdmin || PAYMENT_ROLES.includes(eventRole) || VIEWER_ROLES.includes(eventRole),
    canEditMap: isAdmin || ORGANIZER_ROLES.includes(eventRole),
    canManageEvent: isAdmin,
  };
}
