import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuthPortal } from '../../contexts/AuthContext';
import { GlassCard } from '../../components/ui/GlassCard';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { apiClient } from '../../api/client';
import { UserPlus, Trash2, ArrowLeft, CalendarClock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface Attendee {
  id?: string;
  firstName: string;
  lastName: string;
  documentType: string;
  documentId: string;
}

interface MyGroup {
  groupId: string;
  eventId: string;
  eventDate?: string | null;
  timezone?: string | null;
  approvedTicketCount: number;
}

const EDIT_WINDOW_DAYS = 20;

function daysUntil(eventDateIso: string | null | undefined): number | null {
  if (!eventDateIso) return null;
  const eventMs = new Date(eventDateIso).getTime();
  if (!Number.isFinite(eventMs)) return null;
  const now = Date.now();
  return (eventMs - now) / (1000 * 60 * 60 * 24);
}

export const PortalAttendees = () => {
  const { session } = useAuthPortal();
  const navigate = useNavigate();
  const [attendees, setAttendees] = useState<Attendee[]>([]);
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState('');
  const [deleteError, setDeleteError] = useState('');
  const [deleteSuccess, setDeleteSuccess] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [attendeeToDelete, setAttendeeToDelete] = useState<Attendee | null>(null);
  const [group, setGroup] = useState<MyGroup | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    documentType: 'CC',
    documentId: '',
    isVegetarian: false,
    allergies: '',
    mobilePhone: '',
    emergencyContactName: '',
    emergencyContactPhone: '',
    hasReducedMobility: false,
    hasAllergies: false,
  });

  const loadData = useCallback(async () => {
    if (!session) return;
    try {
      const [att, g] = await Promise.all([
        apiClient.get<Attendee[]>(`/groups/${session.groupId}/participants`, {
          token: session.sessionToken,
          isBearer: true,
        }),
        apiClient
          .get<MyGroup>(`/portal/events/${session.eventId}/my-group`, {
            token: session.sessionToken,
            isBearer: true,
          })
          .catch(() => null),
      ]);
      setAttendees(att || []);
      setGroup(g);
    } catch (err) {
      console.error(err);
    }
  }, [session]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const days = useMemo(() => daysUntil(group?.eventDate), [group?.eventDate]);
  const editWindowClosed = typeof days === 'number' && days <= EDIT_WINDOW_DAYS;

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    setLoading(true);
    try {
      const { hasAllergies, ...payload } = formData;
      if (!hasAllergies) payload.allergies = '';
      await apiClient.post(`/groups/${session?.groupId}/participants`, payload, {
        token: session?.sessionToken,
        isBearer: true,
      });
      setShowForm(false);
      setFormData({ ...formData, firstName: '', lastName: '', documentId: '', mobilePhone: '' });
      loadData();
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : 'Error guardando participante';
      setFormError(msg);
    } finally {
      setLoading(false);
    }
  };

  const openDeleteModal = (attendee: Attendee) => {
    setDeleteError('');
    setDeleteSuccess('');
    setAttendeeToDelete(attendee);
  };

  const closeDeleteModal = () => {
    if (deleting) return;
    setAttendeeToDelete(null);
    setDeleteError('');
  };

  const handleConfirmDelete = async () => {
    if (!session || !attendeeToDelete?.id) return;
    setDeleteError('');
    setDeleting(true);
    try {
      await apiClient.delete(
        `/groups/${session.groupId}/participants/${attendeeToDelete.id}`,
        {
          token: session.sessionToken,
          isBearer: true,
        },
      );
      setAttendees((prev) => prev.filter((att) => att.id !== attendeeToDelete.id));
      setAttendeeToDelete(null);
      setDeleteSuccess('Asistente eliminado correctamente.');
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : 'No fue posible eliminar el asistente en este momento.';
      setDeleteError(msg);
    } finally {
      setDeleting(false);
    }
  };

  if (!session) return null;

  return (
    <div className="animate-slide-up" style={{ maxWidth: '800px', margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px' }}>
        <button
          onClick={() => navigate(`/portal/${session.eventId}/dashboard`)}
          style={{ background: 'transparent', border: 'none', color: 'var(--text-primary)', cursor: 'pointer' }}
        >
          <ArrowLeft size={24} />
        </button>
        <h2 style={{ margin: 0 }}>Gestión de Asistentes</h2>
      </div>

      {editWindowClosed && (
        <GlassCard
          style={{
            marginBottom: '16px',
            borderLeft: '3px solid #FFC107',
            padding: '16px',
            display: 'flex',
            gap: '12px',
            alignItems: 'flex-start',
          }}
        >
          <CalendarClock color="#FFC107" />
          <div>
            <strong>Edición de asistentes bloqueada</strong>
            <p style={{ margin: '6px 0 0', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
              Faltan {Math.max(0, Math.floor(days as number))} día(s) para el evento. Las
              modificaciones a los asistentes se cierran {EDIT_WINDOW_DAYS} días antes. Si necesitas
              un cambio, contacta al comité.
            </p>
          </div>
        </GlassCard>
      )}

      {deleteSuccess && (
        <GlassCard style={{ marginBottom: '16px', padding: '12px 16px' }}>
          <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--success)' }}>{deleteSuccess}</p>
        </GlassCard>
      )}

      {!showForm ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {attendees.map((att, idx) => (
            <GlassCard
              key={att.id || idx}
              style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
            >
              <div>
                <h4 style={{ margin: 0 }}>
                  {att.firstName} {att.lastName}
                </h4>
                <p style={{ margin: '4px 0 0', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                  {att.documentType} {att.documentId}
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                icon={Trash2}
                disabled={editWindowClosed || !att.id}
                onClick={() => openDeleteModal(att)}
                aria-label={`Eliminar asistente ${att.firstName} ${att.lastName}`}
              />
            </GlassCard>
          ))}

          <Button
            icon={UserPlus}
            onClick={() => setShowForm(true)}
            disabled={editWindowClosed}
            style={{ marginTop: '16px' }}
          >
            Añadir Asistente
          </Button>
        </div>
      ) : (
        <GlassCard>
          <h3>Nuevo Asistente</h3>
          <form
            style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '20px' }}
            onSubmit={handleAdd}
          >
            <div style={{ display: 'flex', gap: '16px' }}>
              <Input
                label="Nombres"
                required
                value={formData.firstName}
                onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
              />
              <Input
                label="Apellidos"
                required
                value={formData.lastName}
                onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
              />
            </div>
            <div style={{ display: 'flex', gap: '16px' }}>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <label style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-secondary)' }}>
                  Tipo Doc.
                </label>
                <select
                  className="glass-input"
                  value={formData.documentType}
                  onChange={(e) => setFormData({ ...formData, documentType: e.target.value })}
                >
                  <option value="CC">Cédula (CC)</option>
                  <option value="TI">Tarjeta Identidad (TI)</option>
                  <option value="CE">Cédula Extranjería (CE)</option>
                </select>
              </div>
              <div style={{ flex: 1 }}>
                <Input
                  label="Documento"
                  required
                  type="number"
                  value={formData.documentId}
                  onChange={(e) => setFormData({ ...formData, documentId: e.target.value })}
                />
              </div>
            </div>

            <Input
              label="Celular"
              required
              type="tel"
              value={formData.mobilePhone}
              onChange={(e) => setFormData({ ...formData, mobilePhone: e.target.value })}
            />

            <div style={{ display: 'flex', gap: '16px' }}>
              <Input
                label="Contacto Emergencia"
                required
                value={formData.emergencyContactName}
                onChange={(e) => setFormData({ ...formData, emergencyContactName: e.target.value })}
              />
              <Input
                label="Teléfono Emergencia"
                required
                type="tel"
                value={formData.emergencyContactPhone}
                onChange={(e) => setFormData({ ...formData, emergencyContactPhone: e.target.value })}
              />
            </div>

            <div style={{ display: 'flex', gap: '20px', margin: '16px 0', flexWrap: 'wrap' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={formData.isVegetarian}
                  onChange={(e) => setFormData({ ...formData, isVegetarian: e.target.checked })}
                />
                Vegetariano
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={formData.hasReducedMobility}
                  onChange={(e) => setFormData({ ...formData, hasReducedMobility: e.target.checked })}
                />
                Movilidad Reducida
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={formData.hasAllergies}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      hasAllergies: e.target.checked,
                      allergies: e.target.checked ? formData.allergies : '',
                    })
                  }
                />
                Alergias Alimentarias
              </label>
            </div>

            {formData.hasAllergies && (
              <Input
                label="¿A qué alimentos es alérgico?"
                required
                value={formData.allergies}
                onChange={(e) => setFormData({ ...formData, allergies: e.target.value })}
              />
            )}

            {formError && (
              <p style={{ color: 'var(--error)', fontSize: '0.85rem' }}>{formError}</p>
            )}

            <div style={{ display: 'flex', gap: '16px', marginTop: '16px' }}>
              <Button type="button" variant="secondary" onClick={() => setShowForm(false)}>
                Cancelar
              </Button>
              <Button type="submit" isLoading={loading}>
                Guardar Asistente
              </Button>
            </div>
          </form>
        </GlassCard>
      )}

      <Modal
        isOpen={Boolean(attendeeToDelete)}
        onClose={closeDeleteModal}
        title="Eliminar asistente"
      >
        <p style={{ marginTop: 0, marginBottom: '16px', color: 'var(--text-secondary)' }}>
          Esta acción eliminará el registro de{' '}
          <strong style={{ color: 'var(--text-primary)' }}>
            {attendeeToDelete?.firstName} {attendeeToDelete?.lastName}
          </strong>
          . ¿Deseas continuar?
        </p>

        {deleteError && (
          <p style={{ marginTop: 0, marginBottom: '12px', color: 'var(--error)', fontSize: '0.9rem' }}>
            {deleteError}
          </p>
        )}

        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
          <Button type="button" variant="secondary" onClick={closeDeleteModal} disabled={deleting}>
            Cancelar
          </Button>
          <Button type="button" onClick={handleConfirmDelete} isLoading={deleting}>
            Aceptar
          </Button>
        </div>
      </Modal>
    </div>
  );
};
