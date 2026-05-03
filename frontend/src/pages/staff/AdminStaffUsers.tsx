import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, UserPlus, Power, RefreshCw } from 'lucide-react';
import { useAuthStaff } from '../../contexts/AuthContext';
import { GlassCard } from '../../components/ui/GlassCard';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { apiClient } from '../../api/client';

interface StaffUserRow {
  id: string;
  email: string;
  displayName: string;
  status: string;
  createdAt: string;
  role?: string | null;
  eventAssignmentsCount: number;
}

interface CreateForm {
  email: string;
  displayName: string;
  password: string;
  role: string;
}

const DEFAULT_FORM: CreateForm = {
  email: '',
  displayName: '',
  password: '',
  role: 'STAFF',
};

const TENANT_ROLES = ['TENANT_ADMIN', 'STAFF'];

export const AdminStaffUsers = () => {
  const { session } = useAuthStaff();
  const navigate = useNavigate();

  const [users, setUsers] = useState<StaffUserRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState('');

  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState<CreateForm>(DEFAULT_FORM);
  const [createError, setCreateError] = useState('');
  const [creating, setCreating] = useState(false);

  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  const tenantId = session?.tenantId;

  const loadUsers = useCallback(async () => {
    if (!session || !tenantId) return;
    setLoading(true);
    setLoadError('');
    try {
      const rows = await apiClient.get<StaffUserRow[]>(
        `/tenants/${tenantId}/staff-users`,
        { token: session.accessToken, isBearer: true },
      );
      setUsers(rows || []);
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : 'No se pudo cargar el listado';
      setLoadError(msg);
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }, [session, tenantId]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const submitCreate = async () => {
    if (!session || !tenantId) return;
    if (!form.email || !form.displayName || form.password.length < 8) {
      setCreateError('Email, nombre y contraseña (mín. 8) son obligatorios.');
      return;
    }
    setCreating(true);
    setCreateError('');
    try {
      await apiClient.post(
        `/tenants/${tenantId}/staff-users`,
        form,
        { token: session.accessToken, isBearer: true },
      );
      setCreateOpen(false);
      setForm(DEFAULT_FORM);
      await loadUsers();
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : 'No se pudo crear el usuario';
      setCreateError(msg);
    } finally {
      setCreating(false);
    }
  };

  const toggleStatus = async (u: StaffUserRow) => {
    if (!session) return;
    const next = u.status === 'ACTIVE' ? 'DISABLED' : 'ACTIVE';
    setActionLoadingId(u.id);
    try {
      await apiClient.patch(
        `/staff-users/${u.id}`,
        { status: next },
        { token: session.accessToken, isBearer: true },
      );
      await loadUsers();
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : 'No se pudo actualizar el estado';
      setLoadError(msg);
    } finally {
      setActionLoadingId(null);
    }
  };

  const resetPassword = async (u: StaffUserRow) => {
    if (!session) return;
    const newPassword = window.prompt(
      `Nueva contraseña temporal para ${u.email} (mínimo 8 caracteres):`,
    );
    if (!newPassword) return;
    if (newPassword.length < 8) {
      setLoadError('La contraseña debe tener al menos 8 caracteres.');
      return;
    }
    setActionLoadingId(u.id);
    try {
      await apiClient.patch(
        `/staff-users/${u.id}`,
        { password: newPassword },
        { token: session.accessToken, isBearer: true },
      );
      alert('Contraseña actualizada. Compártela por un canal seguro.');
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : 'No se pudo cambiar la contraseña';
      setLoadError(msg);
    } finally {
      setActionLoadingId(null);
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
          marginBottom: '24px',
          justifyContent: 'space-between',
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
          <h2 style={{ margin: 0 }}>Gestión de Staff</h2>
        </div>
        <Button
          icon={UserPlus}
          onClick={() => {
            setForm(DEFAULT_FORM);
            setCreateError('');
            setCreateOpen(true);
          }}
        >
          Nuevo Staff
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
        {loading && users.length === 0 && (
          <p style={{ color: 'var(--text-secondary)', margin: 0 }}>
            Cargando usuarios…
          </p>
        )}
        {!loading && users.length === 0 && (
          <p style={{ color: 'var(--text-secondary)', margin: 0 }}>
            Aún no has registrado personal del Staff.
          </p>
        )}
        {users.length > 0 && (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ textAlign: 'left', color: 'var(--text-secondary)' }}>
                  <th style={{ padding: '8px 12px' }}>Nombre</th>
                  <th style={{ padding: '8px 12px' }}>Email</th>
                  <th style={{ padding: '8px 12px' }}>Rol</th>
                  <th style={{ padding: '8px 12px' }}>Estado</th>
                  <th style={{ padding: '8px 12px' }}>Eventos</th>
                  <th style={{ padding: '8px 12px' }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr
                    key={u.id}
                    style={{ borderTop: '1px solid var(--border-light)' }}
                  >
                    <td style={{ padding: '10px 12px' }}>{u.displayName}</td>
                    <td style={{ padding: '10px 12px' }}>{u.email}</td>
                    <td style={{ padding: '10px 12px' }}>{u.role || '—'}</td>
                    <td style={{ padding: '10px 12px' }}>
                      <span
                        style={{
                          color:
                            u.status === 'ACTIVE'
                              ? 'var(--success)'
                              : 'var(--text-muted)',
                        }}
                      >
                        {u.status}
                      </span>
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      {u.eventAssignmentsCount}
                    </td>
                    <td style={{ padding: '10px 12px', display: 'flex', gap: '6px' }}>
                      <Button
                        size="sm"
                        variant="outline"
                        icon={RefreshCw}
                        isLoading={actionLoadingId === u.id}
                        onClick={() => resetPassword(u)}
                      >
                        Reset
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        icon={Power}
                        isLoading={actionLoadingId === u.id}
                        onClick={() => toggleStatus(u)}
                        style={{
                          color:
                            u.status === 'ACTIVE'
                              ? 'var(--error)'
                              : 'var(--success)',
                          borderColor:
                            u.status === 'ACTIVE'
                              ? 'var(--error)'
                              : 'var(--success)',
                        }}
                      >
                        {u.status === 'ACTIVE' ? 'Desactivar' : 'Activar'}
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
        isOpen={createOpen}
        onClose={() => !creating && setCreateOpen(false)}
        title="Registrar personal de Staff"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <Input
            label="Nombre para mostrar"
            value={form.displayName}
            onChange={(e) =>
              setForm((f) => ({ ...f, displayName: e.target.value }))
            }
          />
          <Input
            label="Email"
            type="email"
            value={form.email}
            onChange={(e) =>
              setForm((f) => ({ ...f, email: e.target.value.toLowerCase() }))
            }
          />
          <Input
            label="Contraseña temporal"
            type="password"
            value={form.password}
            onChange={(e) =>
              setForm((f) => ({ ...f, password: e.target.value }))
            }
          />
          <label
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '6px',
              fontSize: '0.9rem',
            }}
          >
            Rol en el tenant
            <select
              className="glass-input"
              value={form.role}
              onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}
            >
              {TENANT_ROLES.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </label>
          {createError && (
            <p style={{ color: 'var(--error)', margin: 0, fontSize: '0.9rem' }}>
              {createError}
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
              onClick={() => setCreateOpen(false)}
              disabled={creating}
            >
              Cancelar
            </Button>
            <Button onClick={submitCreate} isLoading={creating}>
              Registrar
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
