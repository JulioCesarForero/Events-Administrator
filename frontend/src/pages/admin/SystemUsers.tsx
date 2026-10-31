import { useState, useEffect } from 'react';
import { useConfirm } from '../../components/ui/ConfirmDialog';
import { GlassCard } from '../../components/ui/GlassCard';
import { Button } from '../../components/ui/Button';
import { Select } from '../../components/ui/Select';
import { Input } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { apiClient } from '../../api/client';
import { useAuthStaff } from '../../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { statusLabel } from '../../utils/status';

export const SystemUsers = () => {
  const { session } = useAuthStaff();
  const confirm = useConfirm();
  const navigate = useNavigate();
  const [users, setUsers] = useState<any[]>([]);
  const [tenantId, setTenantId] = useState<string>(session?.tenantId || '');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'error' | 'success', text: string } | null>(null);

  // Modals
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newUser, setNewUser] = useState({ email: '', displayName: '', password: '', role: 'TENANT_ADMIN' });
  const [isResetOpen, setIsResetOpen] = useState(false);
  const [tempPassword, setTempPassword] = useState('');
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editUser, setEditUser] = useState({ id: '', displayName: '', role: '' });

  useEffect(() => {
    if (!session || session.role !== 'SUPER_ADMIN') {
      navigate('/staff/dashboard');
      return;
    }
    if (tenantId) {
      loadUsers();
    }
  }, [tenantId, session, navigate]);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const data = await apiClient.get<any[]>(`/admin/tenants/${tenantId}/users`, { token: session?.accessToken, isBearer: true });
      setUsers(data);
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Error loading users' });
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    try {
      await apiClient.post('/admin/users', {
        email: newUser.email,
        displayName: newUser.displayName,
        password: newUser.password,
        memberships: [{ tenantId, role: newUser.role }]
      }, { token: session?.accessToken, isBearer: true });
      setMessage({ type: 'success', text: 'Usuario creado exitosamente' });
      setIsCreateOpen(false);
      setNewUser({ email: '', displayName: '', password: '', role: 'TENANT_ADMIN' });
      loadUsers();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Error creando usuario' });
    }
  };

  const handleToggleStatus = async (user: any) => {
    try {
      const newStatus = user.status === 'ACTIVE' ? 'DISABLED' : 'ACTIVE';
      await apiClient.patch(`/admin/users/${user.id}`, { status: newStatus }, { token: session?.accessToken, isBearer: true });
      loadUsers();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Error cambiando estado' });
    }
  };

  const handleResetPassword = async (user: any) => {
    try {
      const res = await apiClient.post<any>(`/admin/users/${user.id}/reset-password`, {}, { token: session?.accessToken, isBearer: true });
      setTempPassword(res.newPassword);
      setSelectedUser(user);
      setIsResetOpen(true);
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Error reseteando password' });
    }
  };

  const handleEditSubmit = async () => {
    try {
      await apiClient.patch(`/admin/users/${editUser.id}`, {
        displayName: editUser.displayName,
        tenantId,
        role: editUser.role
      }, { token: session?.accessToken, isBearer: true });
      setMessage({ type: 'success', text: 'Usuario actualizado exitosamente' });
      setIsEditOpen(false);
      loadUsers();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Error actualizando usuario' });
    }
  };

  const handleDelete = async (user: any) => {
    const ok = await confirm({
      title: 'Desactivar usuario',
      message: `El usuario ${user.email} quedará desactivado y no podrá iniciar sesión.`,
      confirmLabel: 'Desactivar',
      tone: 'danger',
    });
    if (!ok) return;
    try {
      await apiClient.delete(`/admin/users/${user.id}`, { token: session?.accessToken, isBearer: true });
      setMessage({ type: 'success', text: 'Usuario eliminado exitosamente' });
      loadUsers();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Error eliminando usuario' });
    }
  };

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ margin: 0, color: 'var(--accent-text)' }}>Administración Global de Usuarios</h2>
          <p style={{ color: 'var(--text-secondary)' }}>Módulo exclusivo para SUPER_ADMIN</p>
        </div>
        <Button variant="outline" onClick={() => navigate('/staff/dashboard')}>Volver</Button>
      </div>

      {message && (
        <div style={{ padding: '12px', borderRadius: '4px', background: message.type === 'error' ? 'var(--error-dim)' : 'var(--success-dim)', color: message.type === 'error' ? 'var(--error)' : 'var(--success)' }}>
          {message.text}
        </div>
      )}

      <GlassCard>
        <div style={{ display: 'flex', gap: '16px', alignItems: 'center', marginBottom: '20px' }}>
          <label>
            ID de Tenant:
            <input 
              type="text" 
              className="glass-input" 
              style={{ marginLeft: '8px', minWidth: 'min(300px, 100%)' }}
              value={tenantId}
              onChange={e => setTenantId(e.target.value)}
              placeholder="UUID del Tenant"
            />
          </label>
          <Button onClick={loadUsers} disabled={!tenantId || loading}>Buscar</Button>
          <Button variant="secondary" onClick={() => setIsCreateOpen(true)} disabled={!tenantId}>
            + Nuevo Usuario
          </Button>
        </div>

        {loading ? (
          <p>Cargando...</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '16px' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-light)', textAlign: 'left' }}>
                <th style={{ padding: '12px' }}>Nombre</th>
                <th style={{ padding: '12px' }}>Email</th>
                <th style={{ padding: '12px' }}>Rol</th>
                <th style={{ padding: '12px' }}>Estado</th>
                <th style={{ padding: '12px' }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id} style={{ borderBottom: '1px solid var(--border-light)' }}>
                  <td style={{ padding: '12px' }}>{u.displayName}</td>
                  <td style={{ padding: '12px' }}>{u.email}</td>
                  <td style={{ padding: '12px' }}>{u.role}</td>
                  <td style={{ padding: '12px' }}>
                    <span style={{ 
                      padding: '4px 8px', 
                      borderRadius: '12px', 
                      fontSize: 'var(--text-sm)',
                      background: u.status === 'ACTIVE' ? 'var(--success-dim)' : 'var(--error-dim)',
                      color: u.status === 'ACTIVE' ? 'var(--success)' : 'var(--error)'
                    }}>
                      {statusLabel(u.status)}
                    </span>
                  </td>
                  <td style={{ padding: '12px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    <Button size="sm" variant="outline" onClick={() => { setEditUser({ id: u.id, displayName: u.displayName, role: u.role }); setIsEditOpen(true); }}>Editar</Button>
                    <Button size="sm" variant="outline" onClick={() => handleToggleStatus(u)}>
                      {u.status === 'ACTIVE' ? 'Desactivar' : 'Activar'}
                    </Button>
                    <Button size="sm" variant="secondary" onClick={() => handleResetPassword(u)}>Reset Pwd</Button>
                    <Button size="sm" variant="outline" style={{ color: 'var(--error)', borderColor: 'var(--error)' }} onClick={() => handleDelete(u)}>Eliminar</Button>
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr>
                  <td colSpan={5} style={{ padding: '12px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                    No se encontraron usuarios para este tenant.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </GlassCard>

      <Modal isOpen={isCreateOpen} onClose={() => setIsCreateOpen(false)} title="Crear usuario global">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          <Input
            label="Nombre completo"
            autoComplete="off"
            value={newUser.displayName}
            onChange={e => setNewUser({...newUser, displayName: e.target.value})}
          />
          <Input
            label="Correo electrónico"
            type="email"
            autoComplete="off"
            value={newUser.email}
            onChange={e => setNewUser({...newUser, email: e.target.value})}
          />
          <Input
            label="Contraseña temporal"
            type="password"
            autoComplete="new-password"
            value={newUser.password}
            onChange={e => setNewUser({...newUser, password: e.target.value})}
          />
          <Select label="Rol" value={newUser.role} onChange={e => setNewUser({...newUser, role: e.target.value})}>
            <option value="TENANT_ADMIN">Administrador de tenant</option>
            <option value="SUPER_ADMIN">Administrador de plataforma</option>
            <option value="STAFF">Staff</option>
          </Select>
          <div style={{ display: 'flex', gap: 'var(--space-2)', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
            <Button variant="ghost" onClick={() => setIsCreateOpen(false)}>Cancelar</Button>
            <Button onClick={handleCreate} disabled={!newUser.email || !newUser.password || !newUser.displayName}>Guardar</Button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={isResetOpen} onClose={() => setIsResetOpen(false)} title="Contraseña reseteada">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', textAlign: 'center' }}>
          <p>Se generó una nueva contraseña para {selectedUser?.email}</p>
          <div style={{ padding: 'var(--space-4)', background: 'rgba(255,255,255,0.1)', borderRadius: 'var(--radius-sm)', fontFamily: 'monospace', fontSize: 'var(--text-xl)', wordBreak: 'break-all' }}>
            {tempPassword}
          </div>
          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
            Copia esta contraseña y compártela por un canal seguro. No se volverá a mostrar.
          </p>
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <Button onClick={() => setIsResetOpen(false)}>Cerrar</Button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={isEditOpen} onClose={() => setIsEditOpen(false)} title="Editar usuario">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          <Input
            label="Nombre completo"
            value={editUser.displayName}
            onChange={e => setEditUser({...editUser, displayName: e.target.value})}
          />
          <Select label="Rol" value={editUser.role} onChange={e => setEditUser({...editUser, role: e.target.value})}>
            <option value="TENANT_ADMIN">Administrador de tenant</option>
            <option value="SUPER_ADMIN">Administrador de plataforma</option>
            <option value="STAFF">Staff</option>
          </Select>
          <div style={{ display: 'flex', gap: 'var(--space-2)', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
            <Button variant="ghost" onClick={() => setIsEditOpen(false)}>Cancelar</Button>
            <Button onClick={handleEditSubmit} disabled={!editUser.displayName}>Guardar</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
