import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuthStaff } from '../../contexts/AuthContext';
import { GlassCard } from '../../components/ui/GlassCard';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { Input } from '../../components/ui/Input';
import { apiClient } from '../../api/client';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Check, X, Eye, AlertTriangle, ExternalLink, FileText, Filter } from 'lucide-react';

interface PaymentRow {
  id: string;
  status: string;
  attendeeGroupId: string;
  studentCodeSnapshot?: string | null;
  displayName?: string | null;
  ticketQuantity: number;
  paymentType: 'DIGITAL' | 'CASH' | string;
  amountCents?: number | null;
  currency?: string | null;
  submittedAt?: string | null;
  rejectionReason?: string | null;
  reason?: string | null;
}

interface EvidenceRow {
  id: string;
  paymentId: string;
  fileUrl: string;
  mimeType?: string | null;
  evidenceType: string;
  uploadedByActorType: string;
  storagePath?: string | null;
  viewUrl?: string | null;
  fileName?: string | null;
  sizeBytes?: number | null;
  createdAt: string;
}

function formatSize(bytes?: number | null): string {
  if (!bytes && bytes !== 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export const StaffPayments = () => {
  const { session } = useAuthStaff();
  const { eventId } = useParams();
  const navigate = useNavigate();

  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [statusFilter, setStatusFilter] = useState<'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED' | 'ALL'>('PENDING_APPROVAL');
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'DIGITAL' | 'CASH'>('ALL');
  const [searchFilter, setSearchFilter] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string>('');

  const [active, setActive] = useState<PaymentRow | null>(null);
  const [approveOpen, setApproveOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [approvedTicketCount, setApprovedTicketCount] = useState<number>(0);
  const [rejectReason, setRejectReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState('');

  const [evidences, setEvidences] = useState<EvidenceRow[]>([]);
  const [evidencesLoading, setEvidencesLoading] = useState(false);
  const [evidencesError, setEvidencesError] = useState('');

  const loadPayments = useCallback(async () => {
    if (!session || !eventId) return;
    setLoading(true);
    setLoadError('');
    try {
      const params = new URLSearchParams();
      params.set('status', statusFilter);
      if (searchFilter.trim()) params.set('q', searchFilter.trim());
      const res = await apiClient.get<PaymentRow[]>(
        `/events/${eventId}/payment-inbox?${params.toString()}`,
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
  }, [session, eventId, statusFilter, searchFilter]);

  useEffect(() => {
    loadPayments();
  }, [loadPayments]);

  const visiblePayments = useMemo(() => {
    if (typeFilter === 'ALL') return payments;
    return payments.filter((p) => p.paymentType === typeFilter);
  }, [payments, typeFilter]);

  useEffect(() => {
    if (!session || !active) {
      setEvidences([]);
      setEvidencesError('');
      return;
    }
    const controller = new AbortController();
    setEvidencesLoading(true);
    setEvidencesError('');
    apiClient
      .get<EvidenceRow[]>(`/payments/${active.id}/evidences`, {
        token: session.accessToken,
        isBearer: true,
        signal: controller.signal,
      })
      .then((rows) => setEvidences(rows || []))
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        const msg =
          err instanceof Error ? err.message : 'No se pudo cargar la evidencia';
        setEvidencesError(msg);
        setEvidences([]);
      })
      .finally(() => {
        if (!controller.signal.aborted) setEvidencesLoading(false);
      });
    return () => controller.abort();
  }, [session, active]);

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
      await loadPayments();
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
      await loadPayments();
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
        <h2 style={{ margin: 0 }}>Bandeja de Pagos ({visiblePayments.length})</h2>
      </div>

      <GlassCard style={{ marginBottom: '16px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '12px', alignItems: 'end' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              Buscar estudiante o grupo
            </label>
            <input
              className="glass-input"
              placeholder="Código estudiante, nombre, grupo o tipo de pago"
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
            />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Estado</label>
            <select
              className="glass-input"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED' | 'ALL')}
            >
              <option value="PENDING_APPROVAL">Pendiente</option>
              <option value="APPROVED">Aprobado</option>
              <option value="REJECTED">Rechazado</option>
              <option value="ALL">Todos</option>
            </select>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Tipo de pago</label>
            <select
              className="glass-input"
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as 'ALL' | 'DIGITAL' | 'CASH')}
            >
              <option value="ALL">Todos</option>
              <option value="DIGITAL">Digital</option>
              <option value="CASH">Efectivo</option>
            </select>
          </div>
        </div>
        <div style={{ marginTop: '10px', color: 'var(--text-secondary)', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Filter size={14} />
          Mostrando {visiblePayments.length} resultado(s)
        </div>
      </GlassCard>

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
        {!loading && visiblePayments.length === 0 && !loadError && (
          <GlassCard style={{ textAlign: 'center', padding: '40px' }}>
            <p style={{ color: 'var(--text-secondary)', margin: 0 }}>
              No se encontraron pagos para los filtros seleccionados.
            </p>
          </GlassCard>
        )}
        {visiblePayments.map((p) => (
          <GlassCard key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
            <div style={{ minWidth: 0, flex: 1 }}>
              <h4 style={{ margin: '0 0 8px 0' }}>
                {p.displayName || p.studentCodeSnapshot || `Grupo ${p.attendeeGroupId.slice(0, 8)}…`}
              </h4>
              <div style={{ display: 'flex', gap: '16px', color: 'var(--text-secondary)', fontSize: '0.875rem', flexWrap: 'wrap' }}>
                {p.studentCodeSnapshot && <span>Código: <strong>{p.studentCodeSnapshot}</strong></span>}
                <span>Estado: <strong>{p.status}</strong></span>
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
              {p.status === 'PENDING_APPROVAL' && (
                <>
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
                </>
              )}
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
            <div style={{ marginTop: '12px' }}>
              <strong style={{ display: 'block', marginBottom: '8px' }}>
                Evidencias ({evidences.length})
              </strong>
              {evidencesLoading && (
                <p style={{ color: 'var(--text-secondary)', margin: 0 }}>
                  Cargando evidencias…
                </p>
              )}
              {!evidencesLoading && evidencesError && (
                <p style={{ color: 'var(--error)', margin: 0 }}>{evidencesError}</p>
              )}
              {!evidencesLoading && !evidencesError && evidences.length === 0 && (
                <p style={{ color: 'var(--text-secondary)', margin: 0 }}>
                  No hay archivos adjuntos registrados para este pago.
                </p>
              )}
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                  marginTop: '8px',
                }}
              >
                {evidences.map((ev) => {
                  const displayUrl = ev.viewUrl || ev.fileUrl;
                  const isImage = (ev.mimeType || '').startsWith('image/');
                  const isPdf = ev.mimeType === 'application/pdf';
                  return (
                    <div
                      key={ev.id}
                      className="glass-panel"
                      style={{
                        padding: '12px',
                        borderRadius: 'var(--radius-md)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '8px',
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          gap: '8px',
                          flexWrap: 'wrap',
                        }}
                      >
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                          }}
                        >
                          <FileText size={16} />
                          <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>
                            {ev.fileName || ev.evidenceType}
                          </span>
                        </div>
                        <span
                          style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}
                        >
                          {ev.mimeType || 'desconocido'}
                          {ev.sizeBytes ? ` · ${formatSize(ev.sizeBytes)}` : ''}
                          {ev.createdAt
                            ? ` · ${new Date(ev.createdAt).toLocaleString()}`
                            : ''}
                        </span>
                      </div>
                      {isImage && (
                        <a
                          href={displayUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <img
                            src={displayUrl}
                            alt={ev.fileName || 'Evidencia'}
                            style={{
                              width: '100%',
                              maxHeight: '320px',
                              objectFit: 'contain',
                              borderRadius: 'var(--radius-sm)',
                              background: '#000',
                            }}
                          />
                        </a>
                      )}
                      {isPdf && (
                        <iframe
                          src={displayUrl}
                          title={ev.fileName || 'Evidencia PDF'}
                          style={{
                            width: '100%',
                            height: '360px',
                            border: '1px solid var(--border-light)',
                            borderRadius: 'var(--radius-sm)',
                            background: '#000',
                          }}
                        />
                      )}
                      <div
                        style={{
                          display: 'flex',
                          gap: '12px',
                          alignItems: 'center',
                          fontSize: '0.8rem',
                        }}
                      >
                        <a
                          href={displayUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            display: 'inline-flex',
                            gap: '6px',
                            alignItems: 'center',
                            color: 'var(--accent-primary)',
                          }}
                        >
                          <ExternalLink size={14} /> Abrir / descargar
                        </a>
                        {ev.storagePath && (
                          <code
                            style={{
                              color: 'var(--text-muted)',
                              fontSize: '0.75rem',
                              wordBreak: 'break-all',
                            }}
                            title="Ruta canónica del objeto en storage"
                          >
                            {ev.storagePath}
                          </code>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
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
            <p
              style={{
                color: 'var(--text-muted)',
                margin: 0,
                fontSize: '0.85rem',
                lineHeight: 1.45,
              }}
            >
              El servidor valida el tope acumulado por estudiante según la etapa comercial (preventa /
              venta general) e incluye otros pagos pendientes o ya aprobados del mismo grupo. Si dos
              revisores intentan aprobar en paralelo, uno puede recibir error: es la protección contra
              sobre-cupo.
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
