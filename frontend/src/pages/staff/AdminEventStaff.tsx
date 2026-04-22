import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Plus, Trash2 } from 'lucide-react';
import { useAuthStaff } from '../../contexts/AuthContext';
import { GlassCard } from '../../components/ui/GlassCard';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { apiClient } from '../../api/client';

interface StaffUserRow {
  id: string;
  email: string;
  displayName: string;
  status: string;
  role?: string | null;
}

interface AssignmentRow {
  userId: string;
  eventId: string;
  email: string;
  displayName: string;
  role: string;
  status: string;
}

const EVENT_ROLES = ['ORGANIZER', 'CASHIER', 'REVIEWER', 'COORDINATOR'];

export const AdminEventStaff = () => {
  const { session } = useAuthStaff();
  const { eventId } = useParams();
  const navigate = useNavigate();

  const [assignments, setAssignments] = useState<AssignmentRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState('');

  const [candidates, setCandidates] = useState<StaffUserRow[]>([]);
  const [assignOpen, setAssignOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [selectedRole, setSelectedRole] = useState(EVENT_ROLES[0]);
  const [assigning, setAssigning] = useState(false);
  const [assignError, setAssignError] = useState('');

  const [actionUserId, setActionUserId] = useState<string | null>(null);

  const tenantId = session?.tenantId;

  const loadAll = useCallback(async () => {
    if (!session || !eventId || !tenantId) return;
    setLoading(true);
    setLoadError('');
    try {
      const [rows, tenantUsers] = await Promise.all([
        apiClient.get<AssignmentRow[]>(
          `/events/${eventId}/staff-assignments`,
          { token: session.accessToken, isBearer: true },
        ),
        apiClient.get<StaffUserRow[]>(
          `/tenants/${tenantId}/staff-users`,
          { token: session.accessToken, isBearer: true },
        ),
      ]);
      setAssignments(rows || []);
      setCandidates(tenantUsers || []);
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : 'No se pudo cargar la información';
      setLoadError(msg);
    } finally {
      setLoading(false);
    }
  }, [session, eventId, tenantId]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const availableCandidates = candidates.filter(
    (c) =>
      c.status === 'ACTIVE' &&
      !assignments.some((a) => a.userId === c.id),
  );

  const openAssign = () => {
    setSelectedUserId(availableCandidates[0]?.id || '');
    setSelectedRole(EVENT_ROLES[0]);
    setAssignError('');
    setAssignOpen(true);
  };

  const submitAssign = async () => {
    if (!session || !eventId || !selectedUserId) return;
    setAssigning(true);
    setAssignError('');
    try {
      await apiClient.post(
        `/events/${eventId}/staff-assignments`,
        { userId: selectedUserId, role: selectedRole },
        { token: session.accessToken, isBearer: true },
      );
      setAssignOpen(false);
      await loadAll();
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : 'No se pudo asignar el usuario';
      setAssignError(msg);
    } finally {
      setAssigning(false);
    }
  };

  const removeAssignment = async (userId: string) => {
    if (!session || !eventId) return;
    if (!window.confirm('¿Quitar este usuario del staff del evento?')) return;
    setActionUserId(userId);
    try {
      await apiClient.delete(`/events/${eventId}/staff-assignments/${userId}`, {
        token: session.accessToken,
        isBearer: true,
      });
      await loadAll();
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : 'No se pudo remover la asignación';
      setLoadError(msg);
    } finally {
      setActionUserId(null);
    }
  };

  if (!session) return null;

  return (
    <div className="animate-fade-in">
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '16px',
          justifyContent: 'space-between',
          marginBottom: '24px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <button
            onClick={() => navigate('/staff/dashboard')}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-primary)',
              cursor: 'pointer',
            }}
          >
            <ArrowLeft size={24} />
          </button>
          <h2 style={{ margin: 0 }}>Staff del Evento</h2>
        </div>
        <Button icon={Plus} onClick={openAssign} disabled={availableCandidates.length === 0}>
          Asignar Staff
        </Button>
      </div>

      {loadError && (
        <GlassCard
          style={{ marginBottom: '16px', borderLeft: '3px solid var(--error)' }}
        >
          <span style={{ color: 'var(--error)' }}>{loadError}</span>
        </GlassCard>
      )}

      <GlassCard>
        {loading && assignments.length === 0 && (
          <p style={{ color: 'var(--text-secondary)', margin: 0 }}>
            Cargando asignaciones…
          </p>
        )}
        {!loading && assignments.length === 0 && (
          <p style={{ color: 'var(--text-secondary)', margin: 0 }}>
            Este evento todavía no tiene staff asignado. Crea usuarios desde
            "Gestión de Staff" y luego asígnalos aquí.
          </p>
        )}
        {assignments.length > 0 && (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ textAlign: 'left', color: 'var(--text-secondary)' }}>
                  <th style={{ padding: '8px 12px' }}>Nombre</th>
                  <th style={{ padding: '8px 12px' }}>Email</th>
                  <th style={{ padding: '8px 12px' }}>Rol en evento</th>
                  <th style={{ padding: '8px 12px' }}>Estado</th>
                  <th style={{ padding: '8px 12px' }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {assignments.map((a) => (
                  <tr
                    key={a.userId}
                    style={{ borderTop: '1px solid var(--border-light)' }}
                  >
                    <td style={{ padding: '10px 12px' }}>{a.displayName}</td>
                    <td style={{ padding: '10px 12px' }}>{a.email}</td>
                    <td style={{ padding: '10px 12px' }}>{a.role}</td>
                    <td style={{ padding: '10px 12px' }}>
                      <span
                        style={{
                          color:
                            a.status === 'ACTIVE'
                              ? 'var(--success)'
                              : 'var(--text-muted)',
                        }}
                      >
                        {a.status}
                      </span>
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      <Button
                        size="sm"
                        variant="outline"
                        icon={Trash2}
                        isLoading={actionUserId === a.userId}
                        onClick={() => removeAssignment(a.userId)}
                        style={{
                          color: 'var(--error)',
                          borderColor: 'var(--error)',
                        }}
                      >
                        Quitar
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </GlassCard>

      <Modal
        isOpen={assignOpen}
        onClose={() => !assigning && setAssignOpen(false)}
        title="Asignar Staff al evento"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {availableCandidates.length === 0 ? (
            <p style={{ color: 'var(--text-secondary)', margin: 0 }}>
              No hay usuarios activos del tenant disponibles. Registra uno nuevo
              desde "Gestión de Staff".
            </p>
          ) : (
            <>
              <label
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px',
                  fontSize: '0.9rem',
                }}
              >
                Usuario
                <select
                  className="glass-input"
                  value={selectedUserId}
                  onChange={(e) => setSelectedUserId(e.target.value)}
                >
                  {availableCandidates.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.displayName} — {u.email}
                    </option>
                  ))}
                </select>
              </label>
              <label
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px',
                  fontSize: '0.9rem',
                }}
              >
                Rol en el evento
                <select
                  className="glass-input"
                  value={selectedRole}
                  onChange={(e) => setSelectedRole(e.target.value)}
                >
                  {EVENT_ROLES.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </label>
            </>
          )}
          {assignError && (
            <p style={{ color: 'var(--error)', margin: 0, fontSize: '0.9rem' }}>
              {assignError}
            </p>
          )}
          <div
            style={{
              display: 'flex',
              gap: '12px',
              justifyContent: 'flex-end',
              marginTop: '8px',
            }}
          >
            <Button
              variant="secondary"
              onClick={() => setAssignOpen(false)}
              disabled={assigning}
            >
              Cancelar
            </Button>
            <Button
              onClick={submitAssign}
              isLoading={assigning}
              disabled={!selectedUserId || availableCandidates.length === 0}
            >
              Asignar
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
