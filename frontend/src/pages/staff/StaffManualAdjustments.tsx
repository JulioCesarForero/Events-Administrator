import { useState } from 'react';
import { useAuthStaff } from '../../contexts/AuthContext';
import { useNavigate, useParams } from 'react-router-dom';
import { GlassCard } from '../../components/ui/GlassCard';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { apiClient } from '../../api/client';
import { ArrowLeft, CheckCircle2, AlertTriangle, Settings2 } from 'lucide-react';

type ActionKey =
  | 'RELEASE_RESERVATION'
  | 'UPDATE_TABLE_CAPACITY'
  | 'UPDATE_ATTENDEE_GROUP'
  | 'CUSTOM';

const ACTION_CATALOG: Array<{ key: ActionKey; label: string; description: string }> = [
  {
    key: 'RELEASE_RESERVATION',
    label: 'Liberar reserva',
    description:
      'Solo SUPER_ADMIN. Libera una reserva existente y sus cupos en mesa. Preferible usar la pantalla Reservas por estudiante (POST /events/.../staff/reservations/.../release).',
  },
  {
    key: 'UPDATE_TABLE_CAPACITY',
    label: 'Corregir capacidad de mesa',
    description: 'Ajusta el límite de una mesa; no puede quedar bajo los cupos ocupados actuales.',
  },
  {
    key: 'UPDATE_ATTENDEE_GROUP',
    label: 'Ajustar grupo',
    description: 'Corrige metadatos del grupo del comprador.',
  },
  {
    key: 'CUSTOM',
    label: 'Acción personalizada',
    description: 'Registra una acción libre con un payload JSON explícito.',
  },
];

export const StaffManualAdjustments = () => {
  const { session } = useAuthStaff();
  const { eventId } = useParams();
  const navigate = useNavigate();

  const [action, setAction] = useState<ActionKey>('RELEASE_RESERVATION');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  const [reservationId, setReservationId] = useState('');
  const [tableId, setTableId] = useState('');
  const [newCapacity, setNewCapacity] = useState('');
  const [customPayload, setCustomPayload] = useState('{\n  "note": "Motivo del ajuste"\n}');

  const runAction = async () => {
    if (!session || !eventId) return;
    setError('');
    setSuccess('');
    let payload: Record<string, unknown> = {};
    try {
      if (action === 'RELEASE_RESERVATION') {
        if (!reservationId.trim()) throw new Error('Indica el ID de la reserva.');
        payload = { reservation_id: reservationId.trim() };
      } else if (action === 'UPDATE_TABLE_CAPACITY') {
        if (!tableId.trim() || !newCapacity.trim())
          throw new Error('Indica mesa y nueva capacidad.');
        payload = {
          layout_table_id: tableId.trim(),
          table_capacity_limit: Number(newCapacity),
        };
      } else if (action === 'CUSTOM') {
        payload = JSON.parse(customPayload);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Payload inválido';
      setError(msg);
      return;
    }

    setLoading(true);
    try {
      await apiClient.post(
        `/events/${eventId}/manual-adjustments`,
        { action, payload },
        { token: session.accessToken, isBearer: true },
      );
      setSuccess(`Acción ${action} ejecutada y registrada en auditoría.`);
      setReservationId('');
      setTableId('');
      setNewCapacity('');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'No se pudo aplicar el ajuste';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  if (!session) return null;

  return (
    <div className="animate-fade-in" style={{ maxWidth: '760px', margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px' }}>
        <button
          onClick={() => navigate('/staff/dashboard')}
          style={{ background: 'transparent', border: 'none', color: 'var(--text-primary)', cursor: 'pointer' }}
        >
          <ArrowLeft size={24} />
        </button>
        <h2 style={{ margin: 0 }}>Ajustes manuales</h2>
      </div>

      <GlassCard style={{ marginBottom: '16px' }}>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '8px' }}>
          <Settings2 color="var(--accent-primary)" />
          <h3 style={{ margin: 0 }}>Selecciona la acción</h3>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
          {ACTION_CATALOG.map((opt) => (
            <button
              key={opt.key}
              type="button"
              onClick={() => setAction(opt.key)}
              style={{
                padding: '14px',
                borderRadius: 'var(--radius-md)',
                border: `2px solid ${action === opt.key ? 'var(--accent-primary)' : 'var(--border-light)'}`,
                background: action === opt.key ? 'rgba(57,255,20,0.1)' : 'transparent',
                color: 'var(--text-primary)',
                textAlign: 'left',
                cursor: 'pointer',
              }}
            >
              <strong style={{ fontSize: '0.95rem' }}>{opt.label}</strong>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', margin: '6px 0 0' }}>
                {opt.description}
              </p>
            </button>
          ))}
        </div>
      </GlassCard>

      <GlassCard>
        <h3 style={{ marginTop: 0 }}>Detalle</h3>

        {action === 'RELEASE_RESERVATION' && (
          <Input
            label="ID de reserva"
            placeholder="res_xxxxxxxx"
            value={reservationId}
            onChange={(e) => setReservationId(e.target.value)}
          />
        )}

        {action === 'UPDATE_TABLE_CAPACITY' && (
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            <div style={{ flex: 2, minWidth: '220px' }}>
              <Input
                label="ID de la mesa"
                placeholder="tbl_xxxxxxxx"
                value={tableId}
                onChange={(e) => setTableId(e.target.value)}
              />
            </div>
            <div style={{ flex: 1, minWidth: '140px' }}>
              <Input
                label="Nueva capacidad"
                type="number"
                min="1"
                max="25"
                value={newCapacity}
                onChange={(e) => setNewCapacity(e.target.value)}
              />
            </div>
          </div>
        )}

        {action === 'UPDATE_ATTENDEE_GROUP' && (
          <p style={{ color: 'var(--text-secondary)', margin: 0 }}>
            Este ajuste queda registrado sin payload adicional por ahora. Expande la lógica según
            tus necesidades operativas.
          </p>
        )}

        {action === 'CUSTOM' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <label style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-secondary)' }}>
              Payload (JSON)
            </label>
            <textarea
              className="glass-input"
              style={{ minHeight: '160px', resize: 'vertical', fontFamily: 'monospace' }}
              value={customPayload}
              onChange={(e) => setCustomPayload(e.target.value)}
            />
          </div>
        )}

        {error && (
          <div
            style={{
              display: 'flex',
              gap: '8px',
              alignItems: 'center',
              marginTop: '12px',
              color: 'var(--error)',
              fontSize: '0.875rem',
            }}
          >
            <AlertTriangle size={16} /> {error}
          </div>
        )}
        {success && (
          <div
            style={{
              display: 'flex',
              gap: '8px',
              alignItems: 'center',
              marginTop: '12px',
              color: 'var(--accent-primary)',
              fontSize: '0.875rem',
            }}
          >
            <CheckCircle2 size={16} /> {success}
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '20px', gap: '12px' }}>
          <Button variant="secondary" onClick={() => navigate(`/staff/events/${eventId}/payments`)}>
            Cancelar
          </Button>
          <Button onClick={runAction} isLoading={loading}>
            Aplicar ajuste
          </Button>
        </div>
      </GlassCard>
    </div>
  );
};
