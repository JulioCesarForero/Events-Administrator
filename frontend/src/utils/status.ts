import type { BadgeTone } from '../components/ui/StatusBadge';

/**
 * Etiquetas en español para los estados que devuelve la API.
 * Fuente única: pagos, reservas, documentos legales, usuarios y mesas.
 */
const STATUS_LABELS: Record<string, string> = {
  // Pagos
  PENDING_APPROVAL: 'Pendiente de aprobación',
  APPROVED: 'Aprobado',
  REJECTED: 'Rechazado',
  PROCESSING: 'En proceso',
  // Reservas
  NONE: 'Sin reserva',
  PENDING: 'Pendiente',
  CONFIRMED: 'Confirmada',
  RELEASED: 'Liberada',
  CANCELLED: 'Cancelada',
  EXPIRED: 'Vencida',
  // Documentos legales
  DRAFT: 'Borrador',
  PUBLISHED: 'Publicado',
  ARCHIVED: 'Archivado',
  // Usuarios
  ACTIVE: 'Activo',
  INACTIVE: 'Inactivo',
  DISABLED: 'Deshabilitado',
  // Mesas
  AVAILABLE: 'Disponible',
};

const STATUS_TONES: Record<string, BadgeTone> = {
  APPROVED: 'success',
  CONFIRMED: 'success',
  ACTIVE: 'success',
  PUBLISHED: 'success',
  AVAILABLE: 'success',
  PENDING_APPROVAL: 'warn',
  PENDING: 'warn',
  PROCESSING: 'warn',
  DRAFT: 'warn',
  REJECTED: 'error',
  RELEASED: 'error',
  CANCELLED: 'error',
  EXPIRED: 'error',
  DISABLED: 'error',
  INACTIVE: 'neutral',
  ARCHIVED: 'neutral',
  NONE: 'neutral',
};

/** Etiqueta legible; si el estado no está mapeado se muestra tal cual. */
export function statusLabel(status: string | null | undefined): string {
  if (!status) return STATUS_LABELS.NONE;
  return STATUS_LABELS[status] ?? status;
}

export function statusTone(status: string | null | undefined): BadgeTone {
  return (status && STATUS_TONES[status]) || 'neutral';
}
