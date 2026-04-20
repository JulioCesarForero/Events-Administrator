import { useEffect, useState } from 'react';
import { useAuthPortal } from '../../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { GlassCard } from '../../components/ui/GlassCard';
import { Button } from '../../components/ui/Button';
import { apiClient } from '../../api/client';
import { ArrowLeft, CheckCircle2, Clock, RefreshCcw, XCircle } from 'lucide-react';

type PaymentStatus = 'DRAFT' | 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED' | string;

interface MyGroupPayment {
  id: string;
  status: PaymentStatus;
  ticketQuantity: number;
  paymentType: string;
  rejectionReason?: string | null;
  reason?: string | null;
  submittedAt?: string | null;
  approvedAt?: string | null;
  rejectedAt?: string | null;
}

interface MyGroup {
  groupId: string;
  eventId: string;
  currentPaymentId?: string | null;
  currentPayment?: MyGroupPayment | null;
}

export const PortalPaymentStatus = () => {
  const { session } = useAuthPortal();
  const navigate = useNavigate();
  const [group, setGroup] = useState<MyGroup | null>(null);
  const [loading, setLoading] = useState(true);
  const [resubmitLoading, setResubmitLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!session) return;
    const controller = new AbortController();
    const load = async () => {
      setLoading(true);
      try {
        const res = await apiClient.get<MyGroup>(
          `/portal/events/${session.eventId}/my-group`,
          { token: session.sessionToken, isBearer: true, signal: controller.signal },
        );
        setGroup(res);
      } catch (err: unknown) {
        const msg =
          err instanceof Error ? err.message : 'No se pudo cargar el estado del pago';
        setError(msg);
      } finally {
        setLoading(false);
      }
    };
    load();
    return () => controller.abort();
  }, [session]);

  const payment = group?.currentPayment || null;

  const goResubmit = async () => {
    if (!payment || !session) return;
    setResubmitLoading(true);
    setError('');
    try {
      // Round-trip a no-op PATCH that flips REJECTED → DRAFT on the backend so
      // the buyer can edit and submit again via PortalPayment.
      await apiClient.patch(
        `/payments/${payment.id}`,
        {},
        { token: session.sessionToken, isBearer: true },
      );
      navigate(`/portal/${session.eventId}/payment`);
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : 'No se pudo preparar el reenvío';
      setError(msg);
    } finally {
      setResubmitLoading(false);
    }
  };

  if (!session) return null;

  return (
    <div className="animate-fade-in" style={{ maxWidth: '640px', margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px' }}>
        <button
          onClick={() => navigate(`/portal/${session.eventId}/dashboard`)}
          style={{ background: 'transparent', border: 'none', color: 'var(--text-primary)', cursor: 'pointer' }}
        >
          <ArrowLeft size={24} />
        </button>
        <h2 style={{ margin: 0 }}>Estado del pago</h2>
      </div>

      {loading && (
        <GlassCard style={{ textAlign: 'center' }}>
          <p style={{ color: 'var(--text-secondary)' }}>Cargando…</p>
        </GlassCard>
      )}

      {!loading && !payment && (
        <GlassCard style={{ textAlign: 'center' }}>
          <Clock size={42} color="var(--text-muted)" style={{ margin: '0 auto 12px' }} />
          <h3 style={{ margin: 0 }}>Aún no registras un pago</h3>
          <p style={{ color: 'var(--text-secondary)', marginTop: '8px' }}>
            Cuando registres el pago, podrás hacer seguimiento desde esta pantalla.
          </p>
          <Button onClick={() => navigate(`/portal/${session.eventId}/payment`)} style={{ marginTop: '16px' }}>
            Registrar pago
          </Button>
        </GlassCard>
      )}

      {!loading && payment && (
        <GlassCard>
          {payment.status === 'PENDING_APPROVAL' && (
            <>
              <Clock size={42} color="#FFC107" />
              <h3 style={{ marginTop: '8px' }}>En revisión</h3>
              <p style={{ color: 'var(--text-secondary)' }}>
                El comité está validando tu comprobante. Te avisaremos apenas se apruebe.
              </p>
              {payment.submittedAt && (
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                  Enviado: {new Date(payment.submittedAt).toLocaleString()}
                </p>
              )}
            </>
          )}

          {payment.status === 'APPROVED' && (
            <>
              <CheckCircle2 size={42} color="var(--accent-primary)" />
              <h3 style={{ marginTop: '8px' }}>Pago aprobado</h3>
              <p style={{ color: 'var(--text-secondary)' }}>
                Ya puedes seleccionar tu mesa en el mapa del evento.
              </p>
              <Button
                onClick={() => navigate(`/portal/${session.eventId}/map`)}
                style={{ marginTop: '12px' }}
              >
                Ir al mapa
              </Button>
            </>
          )}

          {payment.status === 'REJECTED' && (
            <>
              <XCircle size={42} color="var(--error)" />
              <h3 style={{ marginTop: '8px' }}>Pago rechazado</h3>
              <div
                className="glass-panel"
                style={{
                  padding: '12px',
                  marginTop: '12px',
                  borderRadius: 'var(--radius-md)',
                  background: 'rgba(255,0,0,0.08)',
                }}
              >
                <strong style={{ color: 'var(--error)' }}>Motivo:</strong>{' '}
                {payment.rejectionReason || payment.reason || 'Sin detalle.'}
              </div>
              <p style={{ color: 'var(--text-secondary)', marginTop: '12px' }}>
                Corrige los datos y reenvía tu pago a revisión.
              </p>
              {error && (
                <p style={{ color: 'var(--error)', fontSize: '0.85rem' }}>{error}</p>
              )}
              <Button
                icon={RefreshCcw}
                onClick={goResubmit}
                isLoading={resubmitLoading}
                style={{ marginTop: '12px' }}
              >
                Corregir y reenviar
              </Button>
            </>
          )}

          {payment.status === 'DRAFT' && (
            <>
              <Clock size={42} color="#FFC107" />
              <h3 style={{ marginTop: '8px' }}>Pago en borrador</h3>
              <p style={{ color: 'var(--text-secondary)' }}>
                Aún no has enviado tu pago. Completa el comprobante y envíalo a revisión.
              </p>
              <Button
                onClick={() => navigate(`/portal/${session.eventId}/payment`)}
                style={{ marginTop: '12px' }}
              >
                Continuar registro
              </Button>
            </>
          )}

          <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '18px' }}>
            Tipo: {payment.paymentType} · Boletas: {payment.ticketQuantity} · ID:{' '}
            {payment.id.slice(0, 8)}…
          </p>
        </GlassCard>
      )}
    </div>
  );
};
