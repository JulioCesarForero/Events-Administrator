import { useState, useEffect, useCallback } from 'react';
import { useAuthStaff } from '../../contexts/AuthContext';
import { GlassCard } from '../../components/ui/GlassCard';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { Input } from '../../components/ui/Input';
import { apiClient } from '../../api/client';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Check, X, Eye, AlertTriangle } from 'lucide-react';

interface PaymentRow {
  id: string;
  status: string;
  attendeeGroupId: string;
  ticketQuantity: number;
  paymentType: 'DIGITAL' | 'CASH' | string;
  amountCents?: number | null;
  currency?: string | null;
  submittedAt?: string | null;
  rejectionReason?: string | null;
  reason?: string | null;
}

export const StaffPayments = () => {
  const { session } = useAuthStaff();
  const { eventId } = useParams();
  const navigate = useNavigate();

  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string>('');

  const [active, setActive] = useState<PaymentRow | null>(null);
  const [approveOpen, setApproveOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [approvedTicketCount, setApprovedTicketCount] = useState<number>(0);
  const [rejectReason, setRejectReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState('');

  const loadPayments = useCallback(async () => {
    if (!session || !eventId) return;
    setLoading(true);
    setLoadError('');
    try {
      const res = await apiClient.get<PaymentRow[]>(
        `/events/${eventId}/payment-inbox`,
        { token: session.accessToken, isBearer: true },
      );
      setPayments(res || []);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'No se pudo cargar la bandeja';
      setLoadError(msg);
      setPayments([]);
    } finally {
      setLoading(false);
    }
  }, [session, eventId]);

  useEffect(() => {
    loadPayments();
  }, [loadPayments]);

  const openApprove = (p: PaymentRow) => {
    setActive(p);
    setApprovedTicketCount(p.ticketQuantity);
    setActionError('');
    setApproveOpen(true);
  };

  const openReject = (p: PaymentRow) => {
    setActive(p);
    setRejectReason('');
    setActionError('');
    setRejectOpen(true);
  };

  const closeDrawer = () => {
    if (!actionLoading) {
      setActive(null);
      setApproveOpen(false);
      setRejectOpen(false);
    }
  };

  const submitApprove = async () => {
    if (!session || !active) return;
    if (approvedTicketCount < 1) {
      setActionError('La cantidad aprobada debe ser al menos 1.');
      return;
    }
    setActionLoading(true);
    setActionError('');
    try {
      await apiClient.post(
        `/payments/${active.id}/approve`,
        { approvedTicketCount },
        { token: session.accessToken, isBearer: true },
      );
      setPayments((prev) => prev.filter((p) => p.id !== active.id));
      setApproveOpen(false);
      setActive(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error aprobando pago';
      setActionError(msg);
    } finally {
      setActionLoading(false);
    }
  };

  const submitReject = async () => {
    if (!session || !active) return;
    if (rejectReason.trim().length < 5) {
      setActionError('Describe la razón con al menos 5 caracteres.');
      return;
    }
    setActionLoading(true);
    setActionError('');
    try {
      await apiClient.post(
        `/payments/${active.id}/reject`,
        { reason: rejectReason.trim() },
        { token: session.accessToken, isBearer: true },
      );
      setPayments((prev) => prev.filter((p) => p.id !== active.id));
      setRejectOpen(false);
      setActive(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error rechazando pago';
      setActionError(msg);
    } finally {
      setActionLoading(false);
    }
  };

  if (!session) return null;

  return (
    <div className="animate-fade-in">
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px' }}>
        <button
          onClick={() => navigate('/staff/dashboard')}
          style={{ background: 'transparent', border: 'none', color: 'var(--text-primary)', cursor: 'pointer' }}
        >
          <ArrowLeft size={24} />
        </button>
        <h2 style={{ margin: 0 }}>Bandeja de Pagos ({payments.length})</h2>
      </div>

      {loadError && (
        <GlassCard style={{ marginBottom: '16px', borderLeft: '3px solid var(--error)' }}>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <AlertTriangle color="var(--error)" />
            <div>
              <strong>No se pudo cargar la bandeja</strong>
              <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>{loadError}</div>
            </div>
          </div>
        </GlassCard>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {loading && payments.length === 0 && (
          <GlassCard style={{ textAlign: 'center', padding: '32px' }}>
            <p style={{ color: 'var(--text-secondary)', margin: 0 }}>Cargando pagos…</p>
          </GlassCard>
        )}
        {!loading && payments.length === 0 && !loadError && (
          <GlassCard style={{ textAlign: 'center', padding: '40px' }}>
            <p style={{ color: 'var(--text-secondary)', margin: 0 }}>
              No hay pagos pendientes de revisión.
            </p>
          </GlassCard>
        )}
        {payments.map((p) => (
          <GlassCard key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
            <div style={{ minWidth: 0, flex: 1 }}>
              <h4 style={{ margin: '0 0 8px 0' }}>Grupo {p.attendeeGroupId.slice(0, 8)}…</h4>
              <div style={{ display: 'flex', gap: '16px', color: 'var(--text-secondary)', fontSize: '0.875rem', flexWrap: 'wrap' }}>
                <span>Tipo: <strong>{p.paymentType}</strong></span>
                <span>Boletas: <strong>{p.ticketQuantity}</strong></span>
                {typeof p.amountCents === 'number' && (
                  <span>
                    Monto:{' '}
                    <strong style={{ color: 'var(--text-primary)' }}>
                      ${(p.amountCents / 100).toLocaleString('es-CO')} {p.currency || 'COP'}
                    </strong>
                  </span>
                )}
                {p.submittedAt && (
                  <span>Enviado: {new Date(p.submittedAt).toLocaleString()}</span>
                )}
              </div>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <Button variant="secondary" icon={Eye} onClick={() => setActive(p)}>
                Detalle
              </Button>
              <Button
                variant="outline"
                style={{ color: 'var(--error)', borderColor: 'var(--error)' }}
                icon={X}
                onClick={() => openReject(p)}
              >
                Rechazar
              </Button>
              <Button
                style={{ background: 'var(--success)', color: '#000', boxShadow: 'none' }}
                icon={Check}
                onClick={() => openApprove(p)}
              >
                Aprobar
              </Button>
            </div>
          </GlassCard>
        ))}
      </div>

      {/* Detail drawer (plain modal for MVP) */}
      <Modal
        isOpen={active !== null && !approveOpen && !rejectOpen}
        onClose={closeDrawer}
        title="Detalle del pago"
      >
        {active && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div>
              <strong>Estado:</strong> {active.status}
            </div>
            <div>
              <strong>Grupo:</strong> {active.attendeeGroupId}
            </div>
            <div>
              <strong>Boletas:</strong> {active.ticketQuantity}
            </div>
            <div>
              <strong>Tipo:</strong> {active.paymentType}
            </div>
            {typeof active.amountCents === 'number' && (
              <div>
                <strong>Monto:</strong>{' '}
                ${(active.amountCents / 100).toLocaleString('es-CO')} {active.currency || 'COP'}
              </div>
            )}
            {active.submittedAt && (
              <div>
                <strong>Enviado:</strong> {new Date(active.submittedAt).toLocaleString()}
              </div>
            )}
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '8px' }}>
              La evidencia está registrada en el servidor. Si necesitas revisarla, pide al comprador
              su código único y cruza contra el recibo bancario.
            </p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '12px' }}>
              <Button variant="secondary" onClick={() => openReject(active)}>
                Rechazar
              </Button>
              <Button onClick={() => openApprove(active)}>Aprobar</Button>
            </div>
          </div>
        )}
      </Modal>

      <Modal isOpen={approveOpen} onClose={closeDrawer} title="Aprobar pago">
        {active && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <p style={{ color: 'var(--text-secondary)', margin: 0 }}>
              Confirma la cantidad aprobada. Si es menor, el comprador sólo podrá reservar esa cantidad
              de cupos.
            </p>
            <Input
              label="Boletas aprobadas"
              type="number"
              min="1"
              max={String(active.ticketQuantity)}
              value={approvedTicketCount}
              onChange={(e) => setApprovedTicketCount(parseInt(e.target.value) || 0)}
            />
            {actionError && (
              <p style={{ color: 'var(--error)', fontSize: '0.85rem' }}>{actionError}</p>
            )}
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <Button variant="secondary" onClick={closeDrawer} disabled={actionLoading}>
                Cancelar
              </Button>
              <Button onClick={submitApprove} isLoading={actionLoading}>
                Confirmar aprobación
              </Button>
            </div>
          </div>
        )}
      </Modal>

      <Modal isOpen={rejectOpen} onClose={closeDrawer} title="Rechazar pago">
        {active && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <p style={{ color: 'var(--text-secondary)', margin: 0 }}>
              Indica la razón para que el comprador pueda corregir y reenviar.
            </p>
            <textarea
              className="glass-input"
              style={{ minHeight: '120px', resize: 'vertical' }}
              placeholder="Ej. El comprobante no coincide con el valor esperado"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
            />
            {actionError && (
              <p style={{ color: 'var(--error)', fontSize: '0.85rem' }}>{actionError}</p>
            )}
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <Button variant="secondary" onClick={closeDrawer} disabled={actionLoading}>
                Cancelar
              </Button>
              <Button
                style={{ background: 'var(--error)' }}
                onClick={submitReject}
                isLoading={actionLoading}
              >
                Confirmar rechazo
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
