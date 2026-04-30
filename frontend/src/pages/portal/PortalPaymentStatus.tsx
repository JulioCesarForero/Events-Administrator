import { useEffect, useState } from 'react';
import { useAuthPortal } from '../../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { GlassCard } from '../../components/ui/GlassCard';
import { Button } from '../../components/ui/Button';
import { apiClient } from '../../api/client';
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  ExternalLink,
  RefreshCcw,
  Trash2,
  XCircle,
  Plus,
  AlertTriangle,
} from 'lucide-react';

type PaymentStatus = 'DRAFT' | 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED' | string;

interface PaymentRow {
  id: string;
  status: PaymentStatus;
  paymentType: string;
  ticketQuantity: number;
  rejectionReason?: string | null;
  reason?: string | null;
  submittedAt?: string | null;
  approvedAt?: string | null;
  rejectedAt?: string | null;
  createdAt?: string | null;
}

interface MyGroupLite {
  currentPaymentId?: string | null;
}

interface EvidenceRow {
  id: string;
  fileUrl: string;
  viewUrl?: string | null;
  mimeType?: string | null;
  fileName?: string | null;
  sizeBytes?: number | null;
  createdAt?: string | null;
  uploadedByActorType?: string;
}

function formatSize(bytes?: number | null): string {
  if (bytes === null || bytes === undefined) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function statusLabel(status: PaymentStatus): string {
  switch (status) {
    case 'DRAFT':
      return 'Borrador';
    case 'PENDING_APPROVAL':
      return 'En revisión';
    case 'APPROVED':
      return 'Aprobado';
    case 'REJECTED':
      return 'Rechazado';
    default:
      return status;
  }
}

function statusTone(
  status: PaymentStatus,
): { bg: string; fg: string; border?: string } {
  switch (status) {
    case 'APPROVED':
      return { bg: 'rgba(57,255,20,0.15)', fg: 'var(--accent-primary)' };
    case 'REJECTED':
      return { bg: 'rgba(255,0,0,0.12)', fg: 'var(--error)' };
    case 'PENDING_APPROVAL':
      return { bg: 'rgba(255,193,7,0.15)', fg: '#FFC107' };
    default:
      return { bg: 'rgba(255,255,255,0.06)', fg: 'var(--text-secondary)' };
  }
}

export const PortalPaymentStatus = () => {
  const { session } = useAuthPortal();
  const navigate = useNavigate();
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [currentPaymentId, setCurrentPaymentId] = useState<string | null>(null);
  const [evidenceByPayment, setEvidenceByPayment] = useState<Record<string, EvidenceRow[]>>({});
  const [loading, setLoading] = useState(true);
  const [actionError, setActionError] = useState('');
  const [busyPaymentId, setBusyPaymentId] = useState<string | null>(null);
  const [deletingEvidenceId, setDeletingEvidenceId] = useState<string | null>(null);

  useEffect(() => {
    if (!session) return;
    const ac = new AbortController();
    void (async () => {
      setLoading(true);
      setActionError('');
      try {
        const [plist, g] = await Promise.all([
          apiClient.get<PaymentRow[]>(`/portal/events/${session.eventId}/my-payments`, {
            token: session.sessionToken,
            isBearer: true,
            signal: ac.signal,
          }),
          apiClient
            .get<MyGroupLite>(`/portal/events/${session.eventId}/my-group`, {
              token: session.sessionToken,
              isBearer: true,
              signal: ac.signal,
            })
            .catch(() => ({} as MyGroupLite)),
        ]);
        if (ac.signal.aborted) return;
        const list = Array.isArray(plist) ? plist : [];
        setPayments(list);
        setCurrentPaymentId(g?.currentPaymentId ?? null);
        await Promise.all(
          list.map((p) =>
            apiClient
              .get<EvidenceRow[]>(`/portal/payments/${p.id}/evidences`, {
                token: session.sessionToken,
                isBearer: true,
                signal: ac.signal,
              })
              .then((rows) => {
                if (!ac.signal.aborted) {
                  setEvidenceByPayment((prev) => ({ ...prev, [p.id]: rows || [] }));
                }
              })
              .catch(() => {
                if (!ac.signal.aborted) {
                  setEvidenceByPayment((prev) => ({ ...prev, [p.id]: [] }));
                }
              }),
          ),
        );
      } catch (err: unknown) {
        if (ac.signal.aborted) return;
        const msg =
          err instanceof Error ? err.message : 'No se pudo cargar el historial de pagos';
        setActionError(msg);
        setPayments([]);
      } finally {
        if (!ac.signal.aborted) setLoading(false);
      }
    })();
    return () => ac.abort();
  }, [session]);

  const refreshAfterMutation = async () => {
    if (!session) return;
    try {
      const plist = await apiClient.get<PaymentRow[]>(
        `/portal/events/${session.eventId}/my-payments`,
        { token: session.sessionToken, isBearer: true },
      );
      const list = Array.isArray(plist) ? plist : [];
      setPayments(list);
      const g = await apiClient
        .get<MyGroupLite>(`/portal/events/${session.eventId}/my-group`, {
          token: session.sessionToken,
          isBearer: true,
        })
        .catch(() => ({} as MyGroupLite));
      setCurrentPaymentId(g?.currentPaymentId ?? null);
      await Promise.all(
        list.map((p) =>
          apiClient
            .get<EvidenceRow[]>(`/portal/payments/${p.id}/evidences`, {
              token: session.sessionToken,
              isBearer: true,
            })
            .then((rows) =>
              setEvidenceByPayment((prev) => ({ ...prev, [p.id]: rows || [] })),
            )
            .catch(() =>
              setEvidenceByPayment((prev) => ({ ...prev, [p.id]: [] })),
            ),
        ),
      );
    } catch {
      /* ignore */
    }
  };

  const deleteEvidence = async (paymentId: string, evidenceId: string) => {
    if (!session) return;
    setDeletingEvidenceId(evidenceId);
    setActionError('');
    try {
      await apiClient.delete(`/portal/payments/${paymentId}/evidences/${evidenceId}`, {
        token: session.sessionToken,
        isBearer: true,
      });
      await refreshAfterMutation();
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : 'No se pudo eliminar el archivo';
      setActionError(msg);
    } finally {
      setDeletingEvidenceId(null);
    }
  };

  const withdrawForCorrection = async (paymentId: string) => {
    if (!session) return;
    setBusyPaymentId(paymentId);
    setActionError('');
    try {
      await apiClient.post(
        `/payments/${paymentId}/withdraw`,
        {},
        { token: session.sessionToken, isBearer: true },
      );
      await refreshAfterMutation();
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : 'No se pudo retirar el envío';
      setActionError(msg);
    } finally {
      setBusyPaymentId(null);
    }
  };

  const prepareRejectedResubmit = async (paymentId: string) => {
    if (!session) return;
    setBusyPaymentId(paymentId);
    setActionError('');
    try {
      await apiClient.patch(`/payments/${paymentId}`, {}, {
        token: session.sessionToken,
        isBearer: true,
      });
      navigate(`/portal/${session.eventId}/payment?resume=${paymentId}`);
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : 'No se pudo preparar la corrección';
      setActionError(msg);
    } finally {
      setBusyPaymentId(null);
    }
  };

  if (!session) return null;

  return (
    <div className="animate-fade-in" style={{ maxWidth: '720px', margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px' }}>
        <button
          type="button"
          onClick={() => navigate(`/portal/${session.eventId}/dashboard`)}
          style={{ background: 'transparent', border: 'none', color: 'var(--text-primary)', cursor: 'pointer' }}
        >
          <ArrowLeft size={24} />
        </button>
        <div style={{ flex: 1 }}>
          <h2 style={{ margin: 0 }}>Mis pagos</h2>
          <p style={{ margin: '6px 0 0', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
            Solicitudes enviadas, en revisión, rechazadas o aprobadas. Puedes corregir comprobantes solo
            mientras la solicitud está en borrador.
          </p>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', flexWrap: 'wrap' }}>
        <Button icon={Plus} onClick={() => navigate(`/portal/${session.eventId}/payment`)}>
          Nueva solicitud de pago
        </Button>
      </div>

      {actionError && (
        <GlassCard style={{ marginBottom: '16px', borderLeft: '3px solid var(--error)' }}>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <AlertTriangle size={20} color="var(--error)" />
            <span style={{ color: 'var(--error)', fontSize: '0.9rem' }}>{actionError}</span>
          </div>
        </GlassCard>
      )}

      {loading && (
        <GlassCard style={{ textAlign: 'center' }}>
          <p style={{ color: 'var(--text-secondary)' }}>Cargando historial…</p>
        </GlassCard>
      )}

      {!loading && payments.length === 0 && (
        <GlassCard style={{ textAlign: 'center' }}>
          <Clock size={42} color="var(--text-muted)" style={{ margin: '0 auto 12px' }} />
          <h3 style={{ margin: 0 }}>Aún no registras un pago</h3>
          <p style={{ color: 'var(--text-secondary)', marginTop: '8px' }}>
            Cuando registres un pago, aparecerá aquí con su estado y comprobantes.
          </p>
          <Button onClick={() => navigate(`/portal/${session.eventId}/payment`)} style={{ marginTop: '16px' }}>
            Registrar pago
          </Button>
        </GlassCard>
      )}

      {!loading &&
        payments.map((p) => {
          const tone = statusTone(p.status);
          const evs = evidenceByPayment[p.id] || [];
          const isDraft = p.status === 'DRAFT';
          const isPending = p.status === 'PENDING_APPROVAL';
          const isRejected = p.status === 'REJECTED';
          const isApproved = p.status === 'APPROVED';
          const staffNote = p.rejectionReason || p.reason;
          const isCurrent = currentPaymentId === p.id;
          const showStaffNote = Boolean(staffNote) && (isRejected || (isDraft && staffNote));

          return (
            <GlassCard key={p.id} style={{ marginBottom: '16px' }}>
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  justifyContent: 'space-between',
                  gap: '12px',
                  alignItems: 'flex-start',
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                    <span
                      style={{
                        display: 'inline-block',
                        padding: '4px 12px',
                        borderRadius: '999px',
                        fontSize: '0.8rem',
                        fontWeight: 600,
                        background: tone.bg,
                        color: tone.fg,
                      }}
                    >
                      {statusLabel(p.status)}
                    </span>
                    {isCurrent && (
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        Solicitud actual
                      </span>
                    )}
                  </div>
                  <p style={{ margin: '10px 0 4px', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                    {p.paymentType === 'CASH' ? 'Efectivo' : 'Transferencia'} · {p.ticketQuantity} boleta(s)
                  </p>
                  <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    ID {p.id.slice(0, 8)}…
                    {p.createdAt && ` · Creada: ${new Date(p.createdAt).toLocaleString()}`}
                    {p.submittedAt && ` · Enviada: ${new Date(p.submittedAt).toLocaleString()}`}
                    {p.approvedAt && ` · Aprobada: ${new Date(p.approvedAt).toLocaleString()}`}
                    {p.rejectedAt && ` · Rechazada: ${new Date(p.rejectedAt).toLocaleString()}`}
                  </p>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'flex-end' }}>
                  {isApproved && (
                    <Button
                      size="sm"
                      onClick={() => navigate(`/portal/${session.eventId}/map`)}
                      icon={CheckCircle2}
                    >
                      Ir al mapa
                    </Button>
                  )}
                  {isPending && (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => withdrawForCorrection(p.id)}
                      isLoading={busyPaymentId === p.id}
                    >
                      Retirar envío para corregir
                    </Button>
                  )}
                  {isRejected && (
                    <Button
                      size="sm"
                      icon={RefreshCcw}
                      onClick={() => prepareRejectedResubmit(p.id)}
                      isLoading={busyPaymentId === p.id}
                    >
                      Corregir y volver a cargar
                    </Button>
                  )}
                  {isDraft && (
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() =>
                        navigate(`/portal/${session.eventId}/payment?resume=${p.id}`)
                      }
                    >
                      Gestionar comprobante
                    </Button>
                  )}
                </div>
              </div>

              {showStaffNote && (
                <div
                  className="glass-panel"
                  style={{
                    marginTop: '14px',
                    padding: '12px 14px',
                    borderRadius: 'var(--radius-md)',
                    background: isRejected ? 'rgba(255,0,0,0.08)' : 'rgba(255,193,7,0.1)',
                  }}
                >
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                    {isRejected ? (
                      <XCircle size={18} color="var(--error)" style={{ flexShrink: 0, marginTop: '2px' }} />
                    ) : (
                      <AlertTriangle size={18} color="#FFC107" style={{ flexShrink: 0, marginTop: '2px' }} />
                    )}
                    <div>
                      <strong
                        style={{
                          color: isRejected ? 'var(--error)' : '#FFC107',
                          fontSize: '0.85rem',
                        }}
                      >
                        {isRejected ? 'Nota del comité' : 'Nota del comité (último rechazo)'}
                      </strong>
                      <p style={{ margin: '6px 0 0', color: 'var(--text-primary)', fontSize: '0.9rem' }}>
                        {staffNote}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {isPending && (
                <p style={{ marginTop: '12px', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                  El comité está revisando tu comprobante. Si subiste el archivo equivocado, usa «Retirar envío
                  para corregir», elimina la evidencia y vuelve a enviar.
                </p>
              )}

              <div style={{ marginTop: '16px' }}>
                <strong style={{ fontSize: '0.9rem' }}>Comprobantes ({evs.length})</strong>
                {evs.length === 0 ? (
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', margin: '8px 0 0' }}>
                    Sin archivos adjuntos.
                  </p>
                ) : (
                  <ul style={{ listStyle: 'none', padding: 0, margin: '10px 0 0' }}>
                    {evs.map((ev) => {
                      const href = ev.viewUrl || ev.fileUrl;
                      const canDelete =
                        isDraft &&
                        (ev.uploadedByActorType === 'BUYER' || !ev.uploadedByActorType);
                      return (
                        <li
                          key={ev.id}
                          className="glass-panel"
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: '12px',
                            padding: '10px 12px',
                            marginBottom: '8px',
                            borderRadius: 'var(--radius-md)',
                          }}
                        >
                          <div style={{ minWidth: 0 }}>
                            <a
                              href={href}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{
                                fontWeight: 600,
                                color: 'var(--accent-primary)',
                                textDecoration: 'none',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '6px',
                              }}
                            >
                              {ev.fileName || 'Archivo'}
                              <ExternalLink size={14} />
                            </a>
                            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                              {ev.mimeType || 'archivo'}
                              {ev.sizeBytes != null ? ` · ${formatSize(ev.sizeBytes)}` : ''}
                              {ev.createdAt ? ` · ${new Date(ev.createdAt).toLocaleString()}` : ''}
                            </div>
                          </div>
                          {canDelete && (
                            <Button
                              variant="ghost"
                              size="sm"
                              icon={Trash2}
                              aria-label="Eliminar comprobante"
                              isLoading={deletingEvidenceId === ev.id}
                              onClick={() => deleteEvidence(p.id, ev.id)}
                            />
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
                {isDraft && (
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '10px' }}>
                    Solo puedes eliminar comprobantes que tú subiste, mientras la solicitud está en borrador.
                  </p>
                )}
              </div>
            </GlassCard>
          );
        })}
    </div>
  );
};
