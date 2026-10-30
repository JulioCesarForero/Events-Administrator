import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Search, RefreshCw, Download } from 'lucide-react';
import { useAuthStaff } from '../../contexts/AuthContext';
import { GlassCard } from '../../components/ui/GlassCard';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { StatusBadge, type BadgeTone } from '../../components/ui/StatusBadge';
import { API_BASE_URL, apiClient } from '../../api/client';

type DetailTab = 'asistentes' | 'reservas' | 'acciones' | 'auditoria';

const statusTone = (status: string): BadgeTone => {
  if (status === 'CONFIRMED' || status === 'ACTIVE' || status === 'APPROVED') return 'success';
  if (status === 'RELEASED' || status === 'CANCELLED' || status === 'REJECTED') return 'error';
  if (status === 'PENDING') return 'warn';
  return 'neutral';
};

const cellStyle: React.CSSProperties = { padding: '8px 6px', verticalAlign: 'middle' };
const sectionStyle: React.CSSProperties = {
  border: '1px solid var(--border-light)',
  borderRadius: 'var(--radius-sm)',
  padding: '10px 12px',
};
const summaryStyle: React.CSSProperties = { cursor: 'pointer', fontWeight: 600, fontSize: 'var(--text-sm)' };

const SummaryStat = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div style={{ padding: '8px 10px', borderRadius: 'var(--radius-sm)', background: 'rgba(255,255,255,0.04)' }}>
    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>{label}</div>
    <div style={{ fontSize: 'var(--text-lg)', fontWeight: 600, marginTop: '2px' }}>{children}</div>
  </div>
);

type SearchRow = {
  groupId: string;
  eventId: string;
  studentCodeSnapshot: string;
  displayName: string | null;
  reservationStatus: string;
  approvedTicketCount: number;
  activeSpotsReserved: number;
  availableReservationBalance: number;
  currentPaymentStatus: string | null;
};

type ParticipantRow = {
  id: string;
  attendeeGroupId: string;
  firstName: string;
  lastName: string;
  documentType: string;
  documentId: string;
  isVegetarian: boolean;
  allergies: string;
  mobilePhone: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
  hasReducedMobility: boolean;
};

type GroupDetail = {
  summary: Record<string, unknown>;
  participants: ParticipantRow[];
  payments: Array<{ id: string; status: string; ticketQuantity: number; paymentType: string }>;
  reservations: Array<{
    reservationId: string;
    status: string;
    totalSpotsReserved: number;
    paymentId: string;
    lines: Array<{
      id: string;
      layoutTableId: string;
      tableCode: string | null;
      spotsReserved: number;
      status: string;
    }>;
  }>;
  reservationCodes: Array<{
    // null = vacant code (participant removed); goes to the next participant added.
    participantId: string | null;
    reservationId: string;
    reservationCode: string;
    codeSequenceNumber: number;
  }>;
};

type AuditRow = {
  id: string;
  occurredAt: string;
  actorType: string;
  entityType: string;
  entityId: string | null;
  action: string;
  payloadJson: Record<string, unknown> | null;
};

export const StaffStudentReservations = () => {
  const { session } = useAuthStaff();
  const { eventId } = useParams();
  const navigate = useNavigate();
  const isSuperAdmin = session?.role === 'SUPER_ADMIN';

  const [studentCode, setStudentCode] = useState('');
  const [name, setName] = useState('');
  const [documentId, setDocumentId] = useState('');
  const [paymentStatus, setPaymentStatus] = useState('');
  const [reservationStatus, setReservationStatus] = useState('');
  const [layoutTableId, setLayoutTableId] = useState('');
  const [rows, setRows] = useState<SearchRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [detail, setDetail] = useState<GroupDetail | null>(null);
  const [audit, setAudit] = useState<AuditRow[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailTab, setDetailTab] = useState<DetailTab>('asistentes');

  const [editReason, setEditReason] = useState('');
  const [editParticipant, setEditParticipant] = useState<ParticipantRow | null>(null);
  const [editForm, setEditForm] = useState<Partial<ParticipantRow>>({});
  // 'replace' swaps the person: blank form, all fields required, keeps code and spot.
  const [editMode, setEditMode] = useState<'edit' | 'replace'>('edit');

  const [deleteParticipant, setDeleteParticipant] = useState<ParticipantRow | null>(null);
  const [deleteReason, setDeleteReason] = useState('');
  const [deleting, setDeleting] = useState(false);

  const [addReason, setAddReason] = useState('');
  const [addForm, setAddForm] = useState({
    firstName: '',
    lastName: '',
    documentType: 'CC',
    documentId: '',
    mobilePhone: '',
    emergencyContactName: '',
    emergencyContactPhone: '',
    isVegetarian: false,
    allergies: '',
    hasReducedMobility: false,
  });

  const [releaseReservationId, setReleaseReservationId] = useState('');
  const [releaseReason, setReleaseReason] = useState('');

  const [moveReservationId, setMoveReservationId] = useState('');
  const [moveReason, setMoveReason] = useState('');
  const [moveJson, setMoveJson] = useState('[\n  { "layoutTableId": "", "spots": 1 }\n]');
  const [venueDownloading, setVenueDownloading] = useState(false);
  const [paymentReportDownloading, setPaymentReportDownloading] = useState(false);

  const runSearch = useCallback(async () => {
    if (!session?.accessToken || !eventId) return;
    setError('');
    setLoading(true);
    try {
      const q = new URLSearchParams();
      if (studentCode.trim()) q.set('student_code', studentCode.trim());
      if (name.trim()) q.set('name', name.trim());
      if (documentId.trim()) q.set('document_id', documentId.trim());
      if (paymentStatus.trim()) q.set('payment_status', paymentStatus.trim());
      if (reservationStatus.trim()) q.set('reservation_status', reservationStatus.trim());
      if (layoutTableId.trim()) q.set('layout_table_id', layoutTableId.trim());
      const res = await apiClient.get<SearchRow[]>(
        `/events/${eventId}/staff/groups/search?${q.toString()}`,
        { token: session.accessToken, isBearer: true },
      );
      setRows(Array.isArray(res) ? res : []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error en búsqueda');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [
    session?.accessToken,
    eventId,
    studentCode,
    name,
    documentId,
    paymentStatus,
    reservationStatus,
    layoutTableId,
  ]);

  useEffect(() => {
    if (session?.accessToken && eventId) {
      void runSearch();
    }
    // Intentional: only load default list when session/event mount; filters use the Buscar button.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.accessToken, eventId]);

  const loadDetail = async (groupId: string) => {
    if (!session?.accessToken || !eventId) return;
    setSelectedGroupId(groupId);
    setDetailLoading(true);
    setError('');
    try {
      const [d, a] = await Promise.all([
        apiClient.get<GroupDetail>(`/events/${eventId}/staff/groups/${groupId}`, {
          token: session.accessToken,
          isBearer: true,
        }),
        apiClient.get<AuditRow[]>(`/events/${eventId}/staff/groups/${groupId}/audit-log`, {
          token: session.accessToken,
          isBearer: true,
        }),
      ]);
      setDetail(d);
      setAudit(Array.isArray(a) ? a : []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error cargando detalle');
      setDetail(null);
      setAudit([]);
    } finally {
      setDetailLoading(false);
    }
  };

  const openEdit = (p: ParticipantRow) => {
    setError('');
    setEditMode('edit');
    setEditParticipant(p);
    setEditForm({ ...p });
    setEditReason('');
  };

  const openReplace = (p: ParticipantRow) => {
    setError('');
    setEditMode('replace');
    setEditParticipant(p);
    setEditForm({
      firstName: '',
      lastName: '',
      documentType: 'CC',
      documentId: '',
      mobilePhone: '',
      emergencyContactName: '',
      emergencyContactPhone: '',
      isVegetarian: false,
      allergies: '',
      hasReducedMobility: false,
    });
    setEditReason('');
  };

  const codeByParticipant = new Map(
    (detail?.reservationCodes ?? [])
      .filter((c) => c.participantId)
      .map((c) => [c.participantId as string, c.reservationCode]),
  );
  const participantNameById = new Map(
    (detail?.participants ?? []).map((p) => [p.id, `${p.firstName} ${p.lastName}`]),
  );
  const vacantCodes = (detail?.reservationCodes ?? [])
    .filter((c) => !c.participantId)
    .sort((a, b) => a.codeSequenceNumber - b.codeSequenceNumber);
  const detailTabs: Array<{ id: DetailTab; label: string }> = [
    { id: 'asistentes', label: `Asistentes (${detail?.participants.length ?? 0})` },
    { id: 'reservas', label: `Reservas (${detail?.reservations.length ?? 0})` },
    ...(isSuperAdmin ? [{ id: 'acciones' as const, label: 'Acciones' }] : []),
    { id: 'auditoria', label: `Auditoría (${audit.length})` },
  ];

  // Prefill the release / move forms from a reservation card and jump to the Acciones tab.
  const prepareRelease = (reservationId: string) => {
    setReleaseReservationId(reservationId);
    setDetailTab('acciones');
  };
  const prepareMove = (rv: GroupDetail['reservations'][number]) => {
    setMoveReservationId(rv.reservationId);
    setMoveJson(
      JSON.stringify(
        rv.lines
          .filter((ln) => ln.status === 'ACTIVE')
          .map((ln) => ({ layoutTableId: ln.layoutTableId, spots: ln.spotsReserved })),
        null,
        2,
      ),
    );
    setDetailTab('acciones');
  };

  const submitReplace = async () => {
    if (!session?.accessToken || !eventId || !editParticipant) return;
    if (editReason.trim().length < 3) {
      setError('Indica un motivo (mín. 3 caracteres).');
      return;
    }
    const required: (keyof ParticipantRow)[] = [
      'firstName',
      'lastName',
      'documentType',
      'documentId',
      'mobilePhone',
      'emergencyContactName',
      'emergencyContactPhone',
    ];
    if (required.some((k) => !String(editForm[k] ?? '').trim())) {
      setError('Completa todos los datos de la nueva persona.');
      return;
    }
    setError('');
    try {
      await apiClient.patch(
        `/events/${eventId}/staff/participants/${editParticipant.id}`,
        { reason: editReason, fields: editForm, replace: true },
        { token: session.accessToken, isBearer: true },
      );
      setEditParticipant(null);
      if (selectedGroupId) await loadDetail(selectedGroupId);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error reemplazando asistente');
    }
  };

  const openDelete = (p: ParticipantRow) => {
    setError('');
    setDeleteParticipant(p);
    setDeleteReason('');
  };

  const submitDelete = async () => {
    if (!session?.accessToken || !eventId || !deleteParticipant) return;
    if (deleteReason.trim().length < 3) {
      setError('Indica un motivo (mín. 3 caracteres).');
      return;
    }
    setError('');
    setDeleting(true);
    try {
      await apiClient.delete(
        `/events/${eventId}/staff/participants/${deleteParticipant.id}`,
        { token: session.accessToken, isBearer: true },
        { reason: deleteReason },
      );
      setDeleteParticipant(null);
      if (selectedGroupId) await loadDetail(selectedGroupId);
      void runSearch();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error eliminando asistente');
    } finally {
      setDeleting(false);
    }
  };

  const submitEdit = async () => {
    if (!session?.accessToken || !eventId || !editParticipant) return;
    if (editMode === 'replace') {
      await submitReplace();
      return;
    }
    if (editReason.trim().length < 3) {
      setError('Indica un motivo (mín. 3 caracteres).');
      return;
    }
    const fields: Record<string, unknown> = {};
    (Object.keys(editForm) as (keyof ParticipantRow)[]).forEach((k) => {
      if (editForm[k] !== undefined && editForm[k] !== editParticipant[k]) {
        const key =
          k === 'firstName'
            ? 'firstName'
            : k === 'lastName'
              ? 'lastName'
              : k === 'documentType'
                ? 'documentType'
                : k === 'documentId'
                  ? 'documentId'
                  : k === 'isVegetarian'
                    ? 'isVegetarian'
                    : k === 'allergies'
                      ? 'allergies'
                      : k === 'mobilePhone'
                        ? 'mobilePhone'
                        : k === 'emergencyContactName'
                          ? 'emergencyContactName'
                          : k === 'emergencyContactPhone'
                            ? 'emergencyContactPhone'
                            : k === 'hasReducedMobility'
                              ? 'hasReducedMobility'
                              : k;
        fields[key] = editForm[k];
      }
    });
    if (Object.keys(fields).length === 0) {
      setError('No hay cambios respecto al registro original.');
      return;
    }
    setError('');
    try {
      await apiClient.patch(
        `/events/${eventId}/staff/participants/${editParticipant.id}`,
        { reason: editReason, fields },
        { token: session.accessToken, isBearer: true },
      );
      setEditParticipant(null);
      if (selectedGroupId) await loadDetail(selectedGroupId);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error guardando');
    }
  };

  const submitAddParticipant = async () => {
    if (!session?.accessToken || !eventId || !selectedGroupId) return;
    if (addReason.trim().length < 3) {
      setError('Indica un motivo (mín. 3 caracteres).');
      return;
    }
    setError('');
    try {
      await apiClient.post(
        `/events/${eventId}/staff/groups/${selectedGroupId}/participants`,
        { reason: addReason, participant: addForm },
        { token: session.accessToken, isBearer: true },
      );
      setAddReason('');
      await loadDetail(selectedGroupId);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error creando asistente');
    }
  };

  const submitRelease = async () => {
    if (!session?.accessToken || !eventId) return;
    if (!releaseReservationId.trim() || releaseReason.trim().length < 3) {
      setError('ID de reserva y motivo son obligatorios.');
      return;
    }
    setError('');
    try {
      await apiClient.post(
        `/events/${eventId}/staff/reservations/${releaseReservationId.trim()}/release`,
        { reason: releaseReason },
        { token: session.accessToken, isBearer: true },
      );
      setReleaseReservationId('');
      setReleaseReason('');
      if (selectedGroupId) await loadDetail(selectedGroupId);
      void runSearch();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error liberando');
    }
  };

  const downloadVenueReport = async () => {
    if (!session?.accessToken || !eventId) return;
    setVenueDownloading(true);
    setError('');
    try {
      const url = `${API_BASE_URL}/events/${eventId}/staff/reports/venue-attendees?format=csv`;
      const res = await fetch(url, { headers: { Authorization: `Bearer ${session.accessToken}` } });
      if (!res.ok) {
        let msg = `Error ${res.status}`;
        try {
          const j = (await res.json()) as { detail?: unknown; title?: string };
          const d = j.detail;
          msg =
            typeof d === 'string'
              ? d
              : Array.isArray(d) && d[0] && typeof d[0] === 'object' && 'msg' in d[0]
                ? String((d[0] as { msg?: string }).msg)
                : j.title || msg;
        } catch {
          /* use status */
        }
        setError(msg);
        return;
      }
      const blob = await res.blob();
      const href = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = href;
      a.download = `venue-attendees-${eventId}.csv`;
      a.click();
      URL.revokeObjectURL(href);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error descargando reporte');
    } finally {
      setVenueDownloading(false);
    }
  };

  const downloadPaymentApprovalsReport = async () => {
    if (!session?.accessToken || !eventId) return;
    setPaymentReportDownloading(true);
    setError('');
    try {
      const url = `${API_BASE_URL}/events/${eventId}/staff/reports/payment-approvals?format=csv`;
      const res = await fetch(url, { headers: { Authorization: `Bearer ${session.accessToken}` } });
      if (!res.ok) {
        let msg = `Error ${res.status}`;
        try {
          const j = (await res.json()) as { detail?: unknown; title?: string };
          const d = j.detail;
          msg =
            typeof d === 'string'
              ? d
              : Array.isArray(d) && d[0] && typeof d[0] === 'object' && 'msg' in d[0]
                ? String((d[0] as { msg?: string }).msg)
                : j.title || msg;
        } catch {
          /* use status */
        }
        setError(msg);
        return;
      }
      const blob = await res.blob();
      const href = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = href;
      a.download = `payment-approvals-${eventId}.csv`;
      a.click();
      URL.revokeObjectURL(href);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error descargando reporte de pagos');
    } finally {
      setPaymentReportDownloading(false);
    }
  };

  const submitMove = async () => {
    if (!session?.accessToken || !eventId) return;
    if (!moveReservationId.trim() || moveReason.trim().length < 3) {
      setError('ID de reserva y motivo son obligatorios.');
      return;
    }
    let allocations: Array<{ layoutTableId: string; spots: number }>;
    try {
      allocations = JSON.parse(moveJson) as Array<{ layoutTableId: string; spots: number }>;
    } catch {
      setError('JSON de allocations inválido.');
      return;
    }
    setError('');
    try {
      await apiClient.post(
        `/events/${eventId}/staff/reservations/${moveReservationId.trim()}/move`,
        { reason: moveReason, allocations },
        { token: session.accessToken, isBearer: true },
      );
      setMoveReservationId('');
      setMoveReason('');
      if (selectedGroupId) await loadDetail(selectedGroupId);
      void runSearch();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error moviendo');
    }
  };

  if (!session) return null;

  return (
    <div className="animate-fade-in" style={{ maxWidth: '1100px', margin: '0 auto' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '16px',
          marginBottom: '24px',
          flexWrap: 'wrap',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <button
            type="button"
            onClick={() => navigate('/staff/dashboard')}
            style={{ background: 'transparent', border: 'none', color: 'var(--text-primary)', cursor: 'pointer' }}
          >
            <ArrowLeft size={24} />
          </button>
          <div>
            <h2 style={{ margin: 0 }}>Reservas por estudiante</h2>
            {isSuperAdmin ? (
              <p style={{ margin: '4px 0 0', fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
                Reporte venue (CSV): asistentes por estudiante, código de reserva y mesas para restaurante / sede.
              </p>
            ) : null}
            {isSuperAdmin ? (
              <p style={{ margin: '4px 0 0', fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
                Reporte pagos aprobados (CSV): responsable, estudiante, monto aprobado y totales de recaudo.
              </p>
            ) : null}
          </div>
        </div>
        {isSuperAdmin ? (
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <Button
              variant="secondary"
              icon={Download}
              disabled={venueDownloading || !eventId}
              onClick={() => void downloadVenueReport()}
            >
              {venueDownloading ? 'Generando…' : 'Descargar reporte venue (CSV)'}
            </Button>
            <Button
              variant="secondary"
              icon={Download}
              disabled={paymentReportDownloading || !eventId}
              onClick={() => void downloadPaymentApprovalsReport()}
            >
              {paymentReportDownloading ? 'Generando…' : 'Descargar reporte pagos aprobados (CSV)'}
            </Button>
          </div>
        ) : null}
      </div>

      {error ? (
        <p style={{ color: 'salmon', marginBottom: '12px' }}>{error}</p>
      ) : null}

      <GlassCard style={{ marginBottom: '16px' }}>
        <h3 style={{ marginTop: 0 }}>Búsqueda</h3>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
            gap: '10px',
            marginBottom: '12px',
          }}
        >
          <Input label="Código" value={studentCode} onChange={(e) => setStudentCode(e.target.value)} />
          <Input label="Nombre" value={name} onChange={(e) => setName(e.target.value)} />
          <Input label="Documento" value={documentId} onChange={(e) => setDocumentId(e.target.value)} />
          <Input label="Estado pago" value={paymentStatus} onChange={(e) => setPaymentStatus(e.target.value)} placeholder="APPROVED" />
          <Input
            label="Estado reserva (grupo)"
            value={reservationStatus}
            onChange={(e) => setReservationStatus(e.target.value)}
            placeholder="CONFIRMED"
          />
          <Input label="Mesa (UUID)" value={layoutTableId} onChange={(e) => setLayoutTableId(e.target.value)} />
        </div>
        <Button onClick={() => void runSearch()} disabled={loading} icon={Search}>
          {loading ? 'Buscando…' : 'Buscar'}
        </Button>
      </GlassCard>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'flex-start' }}>
        <GlassCard style={{ flex: '1 1 260px', maxWidth: '340px', minWidth: 0, padding: '16px' }}>
          <h3 style={{ marginTop: 0, fontSize: 'var(--text-base)' }}>
            Resultados {rows.length ? <span style={{ color: 'var(--text-muted)' }}>({rows.length})</span> : null}
          </h3>
          {rows.length === 0 && !loading ? <p style={{ color: 'var(--text-secondary)' }}>Sin resultados.</p> : null}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '70vh', overflowY: 'auto' }}>
            {rows.map((r) => {
              const selected = selectedGroupId === r.groupId;
              return (
                <button
                  key={r.groupId}
                  type="button"
                  onClick={() => void loadDetail(r.groupId)}
                  aria-pressed={selected}
                  style={{
                    textAlign: 'left',
                    padding: '8px 10px',
                    borderRadius: 'var(--radius-sm)',
                    border: selected ? '1px solid var(--accent-primary)' : '1px solid var(--border-light)',
                    background: selected ? 'rgba(255,255,255,0.06)' : 'transparent',
                    color: 'var(--text-primary)',
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ fontSize: 'var(--text-sm)', fontWeight: 600 }}>{r.studentCodeSnapshot}</div>
                  {r.displayName ? (
                    <div
                      style={{ fontSize: 'var(--text-sm)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                      title={r.displayName}
                    >
                      {r.displayName}
                    </div>
                  ) : null}
                  <div style={{ display: 'flex', gap: '6px', alignItems: 'center', marginTop: '4px', flexWrap: 'wrap' }}>
                    <StatusBadge tone={statusTone(r.reservationStatus)}>{r.reservationStatus}</StatusBadge>
                    <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>
                      {r.activeSpotsReserved}/{r.approvedTicketCount} cupos
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </GlassCard>

        <GlassCard style={{ flex: '999 1 480px', minWidth: 0, padding: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
            <h3 style={{ margin: 0, fontSize: 'var(--text-base)' }}>Detalle del grupo</h3>
            {selectedGroupId ? (
              <Button size="sm" variant="outline" onClick={() => void loadDetail(selectedGroupId)} icon={RefreshCw}>
                Actualizar
              </Button>
            ) : null}
          </div>
          {detailLoading ? <p>Cargando…</p> : null}
          {!detail && !detailLoading ? (
            <p style={{ color: 'var(--text-secondary)' }}>Selecciona un grupo de la lista.</p>
          ) : null}
          {detail ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '12px' }}>
              <div>
                <div style={{ fontWeight: 600 }}>
                  {String(detail.summary.studentCodeSnapshot ?? '')}
                  {detail.summary.displayName ? ` · ${String(detail.summary.displayName)}` : ''}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: '8px', marginTop: '8px' }}>
                  <SummaryStat label="Estado reserva">
                    <StatusBadge tone={statusTone(String(detail.summary.reservationStatus ?? ''))}>
                      {String(detail.summary.reservationStatus ?? '—')}
                    </StatusBadge>
                  </SummaryStat>
                  <SummaryStat label="Boletas aprobadas">{String(detail.summary.approvedTicketCount ?? '—')}</SummaryStat>
                  <SummaryStat label="Cupos activos">{String(detail.summary.activeSpotsReserved ?? '—')}</SummaryStat>
                  <SummaryStat label="Saldo por reservar">
                    {String(detail.summary.availableReservationBalance ?? '—')}
                  </SummaryStat>
                  <SummaryStat label="Asistentes">{detail.participants.length}</SummaryStat>
                </div>
              </div>

              <div role="tablist" aria-label="Secciones del grupo" style={{ display: 'flex', gap: '4px', borderBottom: '1px solid var(--border-light)', overflowX: 'auto' }}>
                {detailTabs.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    role="tab"
                    aria-selected={detailTab === t.id}
                    onClick={() => setDetailTab(t.id)}
                    style={{
                      padding: '8px 12px',
                      background: 'transparent',
                      border: 'none',
                      borderBottom: detailTab === t.id ? '2px solid var(--accent-primary)' : '2px solid transparent',
                      color: detailTab === t.id ? 'var(--text-primary)' : 'var(--text-secondary)',
                      fontWeight: detailTab === t.id ? 600 : 400,
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                      fontSize: 'var(--text-sm)',
                    }}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              {detailTab === 'asistentes' ? (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--text-sm)' }}>
                    <thead>
                      <tr style={{ color: 'var(--text-secondary)', textAlign: 'left' }}>
                        <th style={cellStyle}>Nombre</th>
                        <th style={cellStyle}>Documento</th>
                        <th style={cellStyle}>Código</th>
                        <th style={{ ...cellStyle, textAlign: 'right' }}>Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detail.participants.map((p) => (
                        <tr key={p.id} style={{ borderTop: '1px solid var(--border-light)' }}>
                          <td style={cellStyle}>
                            {p.firstName} {p.lastName}
                          </td>
                          <td style={{ ...cellStyle, whiteSpace: 'nowrap' }}>
                            {p.documentType} {p.documentId}
                          </td>
                          <td style={cellStyle}>
                            {codeByParticipant.get(p.id) ? (
                              <code>{codeByParticipant.get(p.id)}</code>
                            ) : (
                              <span style={{ color: 'var(--text-muted)' }}>—</span>
                            )}
                          </td>
                          <td style={cellStyle}>
                            <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                              <Button size="sm" variant="outline" onClick={() => openEdit(p)}>
                                Editar
                              </Button>
                              {isSuperAdmin ? (
                                <>
                                  <Button size="sm" variant="outline" onClick={() => openReplace(p)}>
                                    Reemplazar
                                  </Button>
                                  <Button size="sm" variant="outline" onClick={() => openDelete(p)}>
                                    Eliminar
                                  </Button>
                                </>
                              ) : null}
                            </div>
                          </td>
                        </tr>
                      ))}
                      {vacantCodes.map((c) => (
                        <tr key={`vacant-${c.reservationCode}`} style={{ borderTop: '1px solid var(--border-light)' }}>
                          <td style={{ ...cellStyle, color: 'var(--text-secondary)' }} colSpan={2}>
                            Vacante: se asigna al próximo asistente que agregues
                          </td>
                          <td style={cellStyle}>
                            <code>{c.reservationCode}</code>
                          </td>
                          <td style={{ ...cellStyle, textAlign: 'right' }}>
                            <StatusBadge tone="warn">Vacante</StatusBadge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {detail.participants.length === 0 && vacantCodes.length === 0 ? (
                    <p style={{ color: 'var(--text-secondary)' }}>Este grupo no tiene asistentes.</p>
                  ) : null}
                </div>
              ) : null}

              {detailTab === 'reservas' ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {detail.reservations.length === 0 ? (
                    <p style={{ color: 'var(--text-secondary)' }}>Sin reservas.</p>
                  ) : null}
                  {detail.reservations.map((rv) => (
                    <div
                      key={rv.reservationId}
                      style={{ border: '1px solid var(--border-light)', borderRadius: 'var(--radius-sm)', padding: '10px' }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', minWidth: 0 }}>
                          <StatusBadge tone={statusTone(rv.status)}>{rv.status}</StatusBadge>
                          <span style={{ fontSize: 'var(--text-sm)' }}>{rv.totalSpotsReserved} cupos</span>
                          <code
                            title={rv.reservationId}
                            style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}
                          >
                            {rv.reservationId.slice(0, 8)}…
                          </code>
                        </div>
                        {isSuperAdmin && rv.status === 'CONFIRMED' ? (
                          <div style={{ display: 'flex', gap: '6px' }}>
                            <Button size="sm" variant="outline" onClick={() => prepareMove(rv)}>
                              Mover
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => prepareRelease(rv.reservationId)}>
                              Liberar
                            </Button>
                          </div>
                        ) : null}
                      </div>
                      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '8px', fontSize: 'var(--text-sm)' }}>
                        {rv.lines.map((ln) => (
                          <span
                            key={ln.id}
                            style={{ padding: '2px 8px', borderRadius: 'var(--radius-sm)', background: 'rgba(255,255,255,0.06)' }}
                          >
                            Mesa {ln.tableCode ?? ln.layoutTableId.slice(0, 8)} · {ln.spotsReserved} ({ln.status})
                          </span>
                        ))}
                      </div>
                      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '8px', fontSize: 'var(--text-sm)' }}>
                        {detail.reservationCodes
                          .filter((c) => c.reservationId === rv.reservationId)
                          .map((c) => (
                            <span key={c.reservationCode} style={{ color: 'var(--text-secondary)' }}>
                              <code>{c.reservationCode}</code>{' '}
                              {c.participantId ? (
                                participantNameById.get(c.participantId) ?? `${c.participantId.slice(0, 8)}…`
                              ) : (
                                <strong style={{ color: 'var(--warning)' }}>Vacante</strong>
                              )}
                            </span>
                          ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}

              {detailTab === 'acciones' && isSuperAdmin ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <details open style={sectionStyle}>
                    <summary style={summaryStyle}>Agregar asistente</summary>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '8px', marginTop: '8px' }}>
                      <Input label="Nombre" value={addForm.firstName} onChange={(e) => setAddForm({ ...addForm, firstName: e.target.value })} />
                      <Input label="Apellido" value={addForm.lastName} onChange={(e) => setAddForm({ ...addForm, lastName: e.target.value })} />
                      <Input
                        label="Tipo doc"
                        value={addForm.documentType}
                        onChange={(e) => setAddForm({ ...addForm, documentType: e.target.value })}
                      />
                      <Input
                        label="Documento"
                        value={addForm.documentId}
                        onChange={(e) => setAddForm({ ...addForm, documentId: e.target.value })}
                      />
                      <Input
                        label="Celular"
                        value={addForm.mobilePhone}
                        onChange={(e) => setAddForm({ ...addForm, mobilePhone: e.target.value })}
                      />
                      <Input
                        label="Contacto emergencia"
                        value={addForm.emergencyContactName}
                        onChange={(e) => setAddForm({ ...addForm, emergencyContactName: e.target.value })}
                      />
                      <Input
                        label="Tel. emergencia"
                        value={addForm.emergencyContactPhone}
                        onChange={(e) => setAddForm({ ...addForm, emergencyContactPhone: e.target.value })}
                      />
                    </div>
                    <Input label="Motivo" value={addReason} onChange={(e) => setAddReason(e.target.value)} />
                    {vacantCodes.length ? (
                      <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', margin: '0 0 8px' }}>
                        Recibirá el código vacante {vacantCodes[0].reservationCode}.
                      </p>
                    ) : null}
                    <Button size="sm" onClick={() => void submitAddParticipant()}>
                      Agregar asistente
                    </Button>
                  </details>

                  <details open={Boolean(releaseReservationId)} style={sectionStyle}>
                    <summary style={summaryStyle}>Liberar reserva</summary>
                    <div style={{ marginTop: '8px' }}>
                      <Input
                        label="Reservation ID"
                        value={releaseReservationId}
                        onChange={(e) => setReleaseReservationId(e.target.value)}
                      />
                      <Input label="Motivo" value={releaseReason} onChange={(e) => setReleaseReason(e.target.value)} />
                      <Button size="sm" variant="outline" onClick={() => void submitRelease()}>
                        Liberar
                      </Button>
                    </div>
                  </details>

                  <details open={Boolean(moveReservationId)} style={sectionStyle}>
                    <summary style={summaryStyle}>Mover reserva</summary>
                    <div style={{ marginTop: '8px' }}>
                      <Input
                        label="Reservation ID"
                        value={moveReservationId}
                        onChange={(e) => setMoveReservationId(e.target.value)}
                      />
                      <Input label="Motivo" value={moveReason} onChange={(e) => setMoveReason(e.target.value)} />
                      <label style={{ display: 'block', fontSize: 'var(--text-sm)', marginBottom: '4px' }}>Allocations (JSON)</label>
                      <textarea
                        value={moveJson}
                        onChange={(e) => setMoveJson(e.target.value)}
                        rows={5}
                        style={{ width: '100%', fontFamily: 'monospace', fontSize: 'var(--text-sm)', marginBottom: '8px' }}
                      />
                      <Button size="sm" variant="outline" onClick={() => void submitMove()}>
                        Mover
                      </Button>
                    </div>
                  </details>
                </div>
              ) : null}

              {detailTab === 'auditoria' ? (
                <div style={{ maxHeight: '50vh', overflowY: 'auto', fontSize: 'var(--text-sm)' }}>
                  {audit.length === 0 ? <p style={{ color: 'var(--text-secondary)' }}>Sin eventos.</p> : null}
                  {audit.map((log) => (
                    <details key={log.id} style={{ borderBottom: '1px solid var(--border-light)', padding: '6px 0' }}>
                      <summary style={{ cursor: 'pointer' }}>
                        <strong>{log.action}</strong>{' '}
                        <span style={{ color: 'var(--text-secondary)' }}>
                          · {new Date(log.occurredAt).toLocaleString()}
                          {typeof log.payloadJson?.reason === 'string' ? ` · ${log.payloadJson.reason}` : ''}
                        </span>
                      </summary>
                      <pre
                        style={{
                          margin: '6px 0 0',
                          padding: '8px',
                          borderRadius: 'var(--radius-sm)',
                          background: 'rgba(0,0,0,0.25)',
                          whiteSpace: 'pre-wrap',
                          overflowWrap: 'anywhere',
                        }}
                      >
                        {log.entityType} {log.entityId ?? ''}
                        {log.payloadJson ? `\n${JSON.stringify(log.payloadJson, null, 2)}` : ''}
                      </pre>
                    </details>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}
        </GlassCard>
      </div>

      {editParticipant ? (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 50,
            padding: '16px',
          }}
        >
          <GlassCard style={{ maxWidth: '480px', width: '100%' }}>
            <h3>{editMode === 'replace' ? 'Reemplazar asistente' : 'Editar asistente'}</h3>
            {editMode === 'replace' ? (
              <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
                Reemplaza a {editParticipant.firstName} {editParticipant.lastName}.{' '}
                {codeByParticipant.get(editParticipant.id)
                  ? `La nueva persona conservará el código ${codeByParticipant.get(editParticipant.id)} y su puesto en la mesa.`
                  : 'La nueva persona ocupará su lugar en el grupo.'}
              </p>
            ) : null}
            <Input label="Motivo" value={editReason} onChange={(e) => setEditReason(e.target.value)} />
            <Input
              label="Nombre"
              value={editForm.firstName ?? ''}
              onChange={(e) => setEditForm({ ...editForm, firstName: e.target.value })}
            />
            <Input
              label="Apellido"
              value={editForm.lastName ?? ''}
              onChange={(e) => setEditForm({ ...editForm, lastName: e.target.value })}
            />
            {editMode === 'replace' ? (
              <>
                <Input
                  label="Tipo doc"
                  value={editForm.documentType ?? ''}
                  onChange={(e) => setEditForm({ ...editForm, documentType: e.target.value })}
                />
                <Input
                  label="Documento"
                  value={editForm.documentId ?? ''}
                  onChange={(e) => setEditForm({ ...editForm, documentId: e.target.value })}
                />
                <Input
                  label="Celular"
                  value={editForm.mobilePhone ?? ''}
                  onChange={(e) => setEditForm({ ...editForm, mobilePhone: e.target.value })}
                />
                <Input
                  label="Contacto emergencia"
                  value={editForm.emergencyContactName ?? ''}
                  onChange={(e) => setEditForm({ ...editForm, emergencyContactName: e.target.value })}
                />
              </>
            ) : null}
            <Input
              label="Tel. emergencia"
              value={editForm.emergencyContactPhone ?? ''}
              onChange={(e) => setEditForm({ ...editForm, emergencyContactPhone: e.target.value })}
            />
            {error ? <p style={{ color: 'salmon', margin: '8px 0 0' }}>{error}</p> : null}
            <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
              <Button onClick={() => void submitEdit()}>
                {editMode === 'replace' ? 'Reemplazar' : 'Guardar'}
              </Button>
              <Button variant="outline" onClick={() => setEditParticipant(null)}>
                Cancelar
              </Button>
            </div>
          </GlassCard>
        </div>
      ) : null}

      {deleteParticipant ? (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 50,
            padding: '16px',
          }}
        >
          <GlassCard style={{ maxWidth: '480px', width: '100%' }}>
            <h3>Eliminar asistente</h3>
            <p style={{ fontSize: 'var(--text-sm)' }}>
              Se eliminará el registro de {deleteParticipant.firstName} {deleteParticipant.lastName}.
            </p>
            {codeByParticipant.get(deleteParticipant.id) ? (
              <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
                El código {codeByParticipant.get(deleteParticipant.id)} y su puesto en la mesa quedarán
                vacantes y se asignarán al próximo asistente que agregues a este grupo.
              </p>
            ) : null}
            <Input label="Motivo" value={deleteReason} onChange={(e) => setDeleteReason(e.target.value)} />
            {error ? <p style={{ color: 'salmon', margin: '8px 0 0' }}>{error}</p> : null}
            <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
              <Button onClick={() => void submitDelete()} disabled={deleting}>
                {deleting ? 'Eliminando…' : 'Eliminar'}
              </Button>
              <Button variant="outline" onClick={() => setDeleteParticipant(null)} disabled={deleting}>
                Cancelar
              </Button>
            </div>
          </GlassCard>
        </div>
      ) : null}
    </div>
  );
};
