import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Search, RefreshCw, Download } from 'lucide-react';
import { useAuthStaff } from '../../contexts/AuthContext';
import { GlassCard } from '../../components/ui/GlassCard';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { API_BASE_URL, apiClient } from '../../api/client';

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
    participantId: string;
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

  const [editReason, setEditReason] = useState('');
  const [editParticipant, setEditParticipant] = useState<ParticipantRow | null>(null);
  const [editForm, setEditForm] = useState<Partial<ParticipantRow>>({});

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
    setEditParticipant(p);
    setEditForm({ ...p });
    setEditReason('');
  };

  const submitEdit = async () => {
    if (!session?.accessToken || !eventId || !editParticipant) return;
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
              <p style={{ margin: '4px 0 0', fontSize: '13px', color: 'var(--text-secondary)' }}>
                Reporte venue (CSV): asistentes por estudiante, código de reserva y mesas para restaurante / sede.
              </p>
            ) : null}
            {isSuperAdmin ? (
              <p style={{ margin: '4px 0 0', fontSize: '13px', color: 'var(--text-secondary)' }}>
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

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: '16px', alignItems: 'start' }}>
        <GlassCard>
          <h3 style={{ marginTop: 0 }}>Resultados</h3>
          {rows.length === 0 && !loading ? <p style={{ color: 'var(--text-secondary)' }}>Sin resultados.</p> : null}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '420px', overflowY: 'auto' }}>
            {rows.map((r) => (
              <button
                key={r.groupId}
                type="button"
                onClick={() => void loadDetail(r.groupId)}
                style={{
                  textAlign: 'left',
                  padding: '10px',
                  borderRadius: '8px',
                  border:
                    selectedGroupId === r.groupId
                      ? '1px solid var(--accent-primary)'
                      : '1px solid var(--border-subtle)',
                  background: selectedGroupId === r.groupId ? 'rgba(255,255,255,0.06)' : 'transparent',
                  color: 'var(--text-primary)',
                  cursor: 'pointer',
                }}
              >
                <strong>{r.studentCodeSnapshot}</strong>
                {r.displayName ? ` · ${r.displayName}` : ''}
                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                  Reserva: {r.reservationStatus} · Boletas aprobadas: {r.approvedTicketCount} · Cupos activos:{' '}
                  {r.activeSpotsReserved}
                </div>
              </button>
            ))}
          </div>
        </GlassCard>

        <GlassCard>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ marginTop: 0 }}>Detalle del grupo</h3>
            {selectedGroupId ? (
              <Button size="sm" variant="outline" onClick={() => void loadDetail(selectedGroupId)} icon={RefreshCw}>
                Actualizar
              </Button>
            ) : null}
          </div>
          {detailLoading ? <p>Cargando…</p> : null}
          {!detail && !detailLoading ? (
            <p style={{ color: 'var(--text-secondary)' }}>Selecciona un grupo.</p>
          ) : null}
          {detail ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <pre
                style={{
                  fontSize: '0.8rem',
                  overflow: 'auto',
                  maxHeight: '160px',
                  background: 'rgba(0,0,0,0.25)',
                  padding: '8px',
                  borderRadius: '6px',
                }}
              >
                {JSON.stringify(detail.summary, null, 2)}
              </pre>

              <h4>Asistentes</h4>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                  <thead>
                    <tr>
                      <th style={{ textAlign: 'left' }}>Nombre</th>
                      <th>Documento</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {detail.participants.map((p) => (
                      <tr key={p.id}>
                        <td>
                          {p.firstName} {p.lastName}
                        </td>
                        <td>
                          {p.documentType} {p.documentId}
                        </td>
                        <td>
                          <Button size="sm" variant="outline" onClick={() => openEdit(p)}>
                            Editar
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <h4>Reservas</h4>
              <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '0.9rem' }}>
                {detail.reservations.map((rv) => (
                  <li key={rv.reservationId}>
                    <code>{rv.reservationId}</code> · {rv.status} · {rv.totalSpotsReserved} cupos
                    <ul>
                      {rv.lines.map((ln) => (
                        <li key={ln.id}>
                          Mesa {ln.tableCode ?? ln.layoutTableId}: {ln.spotsReserved} ({ln.status})
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ul>

              <h4>Códigos</h4>
              <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '0.85rem' }}>
                {detail.reservationCodes.map((c) => (
                  <li key={`${c.reservationId}-${c.participantId}`}>
                    Participante {c.participantId.slice(0, 8)}… → {c.reservationCode}
                  </li>
                ))}
              </ul>

              {isSuperAdmin ? (
                <>
                  <h4>Alta asistente (superadmin)</h4>
                  <Input label="Motivo" value={addReason} onChange={(e) => setAddReason(e.target.value)} />
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
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
                  <Button size="sm" onClick={() => void submitAddParticipant()}>
                    Agregar asistente
                  </Button>

                  <h4>Liberar reserva (superadmin)</h4>
                  <Input
                    label="Reservation ID"
                    value={releaseReservationId}
                    onChange={(e) => setReleaseReservationId(e.target.value)}
                  />
                  <Input label="Motivo" value={releaseReason} onChange={(e) => setReleaseReason(e.target.value)} />
                  <Button size="sm" variant="outline" onClick={() => void submitRelease()}>
                    Liberar
                  </Button>

                  <h4>Mover reserva (superadmin)</h4>
                  <Input
                    label="Reservation ID"
                    value={moveReservationId}
                    onChange={(e) => setMoveReservationId(e.target.value)}
                  />
                  <Input label="Motivo" value={moveReason} onChange={(e) => setMoveReason(e.target.value)} />
                  <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '4px' }}>Allocations (JSON)</label>
                  <textarea
                    value={moveJson}
                    onChange={(e) => setMoveJson(e.target.value)}
                    rows={5}
                    style={{ width: '100%', fontFamily: 'monospace', fontSize: '0.8rem' }}
                  />
                  <Button size="sm" variant="outline" onClick={() => void submitMove()}>
                    Mover
                  </Button>
                </>
              ) : null}

              <h4>Auditoría del grupo</h4>
              <div style={{ maxHeight: '220px', overflowY: 'auto', fontSize: '0.8rem' }}>
                {audit.map((log) => (
                  <div
                    key={log.id}
                    style={{
                      borderBottom: '1px solid var(--border-subtle)',
                      padding: '6px 0',
                    }}
                  >
                    <div>
                      <strong>{log.action}</strong> · {new Date(log.occurredAt).toLocaleString()}
                    </div>
                    <div style={{ color: 'var(--text-secondary)' }}>
                      {log.entityType} {log.entityId ?? ''}
                    </div>
                    {log.payloadJson ? (
                      <pre style={{ margin: '4px 0 0', whiteSpace: 'pre-wrap' }}>{JSON.stringify(log.payloadJson)}</pre>
                    ) : null}
                  </div>
                ))}
              </div>
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
            <h3>Editar asistente</h3>
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
            <Input
              label="Tel. emergencia"
              value={editForm.emergencyContactPhone ?? ''}
              onChange={(e) => setEditForm({ ...editForm, emergencyContactPhone: e.target.value })}
            />
            <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
              <Button onClick={() => void submitEdit()}>Guardar</Button>
              <Button variant="outline" onClick={() => setEditParticipant(null)}>
                Cancelar
              </Button>
            </div>
          </GlassCard>
        </div>
      ) : null}
    </div>
  );
};
