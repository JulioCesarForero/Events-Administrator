import { useEffect, useState, useMemo } from 'react';
import { useAuthPortal } from '../../contexts/AuthContext';
import { GlassCard } from '../../components/ui/GlassCard';
import { Button } from '../../components/ui/Button';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '../../api/client';
import { CheckCircle2, Circle, Clock } from 'lucide-react';

interface Payment {
  id: string;
  status: 'DRAFT' | 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED' | string;
  ticketQuantity: number;
  rejectionReason?: string | null;
  reason?: string | null;
}

interface MyGroup {
  groupId: string;
  eventId: string;
  studentCodeSnapshot: string;
  displayName: string | null;
  reservationStatus: string;
  approvedTicketCount: number;
  currentPaymentId?: string | null;
  latestApprovedPaymentId?: string | null;
  currentPayment?: Payment | null;
  eventDate?: string | null;
}

type StepStatus = 'done' | 'active' | 'pending';

interface StepDef {
  key: string;
  label: string;
  description: string;
  status: StepStatus;
  cta?: { label: string; href: string; variant?: 'primary' | 'secondary' | 'outline' };
  badge?: { label: string; tone: 'success' | 'warn' | 'error' | 'neutral' };
  hint?: string;
}

function paymentStepDetails(
  p: Payment | null,
  attendeesReady: boolean,
): Pick<StepDef, 'status' | 'badge' | 'hint'> {
  if (!p) {
    // Sin pago todavía: el paso está listo para crearse (active) en cuanto
    // el usuario haya registrado al menos un asistente. Antes devolvía
    // 'pending' incondicionalmente y eso dejaba el botón "Registrar pago"
    // siempre deshabilitado para usuarios nuevos (chicken-and-egg).
    return {
      status: attendeesReady ? 'active' : 'pending',
      badge: undefined,
      hint: attendeesReady
        ? 'Aún no registras ningún pago. Haz clic para comenzar.'
        : 'Primero registra a los asistentes para poder calcular las boletas.',
    };
  }
  switch (p.status) {
    case 'DRAFT':
      return {
        status: 'active',
        badge: { label: 'Borrador', tone: 'warn' },
        hint: 'Termina el comprobante y envíalo a revisión.',
      };
    case 'PENDING_APPROVAL':
      return {
        status: 'active',
        badge: { label: 'En revisión', tone: 'neutral' },
        hint: 'El comité está validando tu pago.',
      };
    case 'APPROVED':
      return {
        status: 'done',
        badge: { label: 'Aprobado', tone: 'success' },
      };
    case 'REJECTED':
      return {
        status: 'active',
        badge: { label: 'Rechazado', tone: 'error' },
        hint: p.rejectionReason || p.reason || 'Corrige el pago y envíalo de nuevo.',
      };
    default:
      return { status: 'pending' };
  }
}

function badgeColor(tone: StepDef['badge'] extends infer B ? (B extends { tone: infer T } ? T : never) : never) {
  switch (tone) {
    case 'success':
      return { bg: 'rgba(57,255,20,0.18)', fg: 'var(--accent-primary)' };
    case 'warn':
      return { bg: 'rgba(255,193,7,0.18)', fg: '#FFC107' };
    case 'error':
      return { bg: 'rgba(255,0,0,0.18)', fg: 'var(--error)' };
    default:
      return { bg: 'rgba(255,255,255,0.08)', fg: 'var(--text-secondary)' };
  }
}

export const PortalDashboard = () => {
  const { session, logout } = useAuthPortal();
  const navigate = useNavigate();

  const [group, setGroup] = useState<MyGroup | null>(null);
  const [payment, setPayment] = useState<Payment | null>(null);
  const [participantCount, setParticipantCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    const run = async () => {
      setLoading(true);
      try {
        const [g, participants] = await Promise.all([
          apiClient.get<MyGroup>(`/portal/events/${session.eventId}/my-group`, {
            token: session.sessionToken,
            isBearer: true,
          }),
          apiClient
            .get<unknown[]>(`/groups/${session.groupId}/participants`, {
              token: session.sessionToken,
              isBearer: true,
            })
            .catch(() => [] as unknown[]),
        ]);
        if (cancelled) return;
        setGroup(g);
        setParticipantCount((participants as unknown[]).length);

        setPayment(g?.currentPayment ?? null);
      } catch (err) {
        console.error(err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [session]);

  const steps: StepDef[] = useMemo(() => {
    if (!session) return [];
    const attendeesStatus: StepStatus =
      participantCount !== null && participantCount > 0 ? 'done' : 'active';
    const payDetails = paymentStepDetails(payment, attendeesStatus === 'done');
    const reserved = (group?.reservationStatus || 'NONE') === 'CONFIRMED';
    const approvedCnt = group?.approvedTicketCount ?? 0;
    const mapActive = approvedCnt > 0 && !reserved;
    return [
      {
        key: 'attendees',
        label: '1. Asistentes',
        description: 'Registra a quienes asistirán contigo.',
        status: attendeesStatus,
        cta: {
          label: participantCount && participantCount > 0 ? 'Gestionar' : 'Registrar asistentes',
          href: `/portal/${session.eventId}/attendees`,
          variant: 'secondary',
        },
        hint:
          participantCount !== null
            ? `${participantCount} asistente(s) registrado(s)`
            : 'Cargando…',
      },
      {
        key: 'payment',
        label: '2. Pago',
        description: 'Registra el pago para habilitar el mapa.',
        status: payDetails.status,
        badge: payDetails.badge,
        hint: payDetails.hint,
        cta: {
          label: 'Mis pagos',
          href: `/portal/${session.eventId}/payment-status`,
          variant: 'secondary',
        },
      },
      {
        key: 'reservation',
        label: '3. Reserva',
        description: 'Selecciona tu mesa cuando el pago esté aprobado.',
        status: reserved ? 'done' : mapActive ? 'active' : 'pending',
        badge: reserved
          ? { label: 'Reservado', tone: 'success' }
          : mapActive
            ? { label: 'Disponible', tone: 'success' }
            : undefined,
        cta: {
          label: reserved ? 'Ver mi reserva' : 'Seleccionar mesa',
          href: `/portal/${session.eventId}/map`,
        },
      },
    ];
  }, [session, participantCount, payment, group]);

  if (!session) {
    return (
      <GlassCard className="animate-fade-in" style={{ textAlign: 'center' }}>
        <h3>No hay sesión activa</h3>
        <Button onClick={() => navigate('/portal')} style={{ marginTop: '20px' }}>
          Ir al portal
        </Button>
      </GlassCard>
    );
  }

  return (
    <div
      className="animate-fade-in"
      style={{ maxWidth: '860px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '24px' }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 style={{ margin: 0 }}>Resumen de tu proceso</h2>
          <p style={{ color: 'var(--text-secondary)', marginTop: '6px' }}>
            Hola {group?.displayName || session.studentCode}. Este es el estado actual de tu
            reserva en el evento.
          </p>
        </div>
        <Button variant="outline" onClick={logout}>
          Cerrar sesión
        </Button>
      </div>

      <GlassCard>
        <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <small style={{ color: 'var(--text-secondary)' }}>Código</small>
            <div style={{ fontSize: '1.1rem' }}>
              <strong>{session.studentCode}</strong>
            </div>
          </div>
          <div>
            <small style={{ color: 'var(--text-secondary)' }}>Boletas aprobadas</small>
            <div style={{ fontSize: '1.1rem' }}>
              <strong>{group?.approvedTicketCount ?? 0}</strong>
            </div>
          </div>
          <div>
            <small style={{ color: 'var(--text-secondary)' }}>Estado de la reserva</small>
            <div style={{ fontSize: '1.1rem' }}>
              <strong>{group?.reservationStatus || 'NONE'}</strong>
            </div>
          </div>
        </div>
      </GlassCard>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }}>
        {loading && !group ? (
          <GlassCard style={{ textAlign: 'center' }}>
            <p style={{ color: 'var(--text-secondary)' }}>Cargando tu proceso…</p>
          </GlassCard>
        ) : (
          steps.map((s) => {
            const Icon = s.status === 'done' ? CheckCircle2 : s.status === 'active' ? Clock : Circle;
            const iconColor =
              s.status === 'done'
                ? 'var(--accent-primary)'
                : s.status === 'active'
                  ? '#FFC107'
                  : 'var(--text-muted)';
            return (
              <GlassCard key={s.key} hoverEffect style={{ opacity: s.status === 'pending' ? 0.65 : 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <Icon size={22} color={iconColor} />
                  <h3 style={{ margin: 0, fontSize: '1.05rem' }}>{s.label}</h3>
                </div>
                {s.badge && (
                  <span
                    style={{
                      display: 'inline-block',
                      marginTop: '8px',
                      padding: '3px 10px',
                      borderRadius: '999px',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      background: badgeColor(s.badge.tone).bg,
                      color: badgeColor(s.badge.tone).fg,
                    }}
                  >
                    {s.badge.label}
                  </span>
                )}
                <p style={{ color: 'var(--text-secondary)', margin: '10px 0' }}>{s.description}</p>
                {s.hint && (
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: '6px 0 10px' }}>
                    {s.hint}
                  </p>
                )}
                {s.cta && (
                  <Button
                    variant={s.cta.variant || 'primary'}
                    disabled={s.status === 'pending'}
                    onClick={() => navigate(s.cta!.href)}
                    style={{ width: '100%' }}
                  >
                    {s.cta.label}
                  </Button>
                )}
              </GlassCard>
            );
          })
        )}
      </div>
    </div>
  );
};
