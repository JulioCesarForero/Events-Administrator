import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { GlassCard } from '../../components/ui/GlassCard';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Link, QrCode, Ticket } from 'lucide-react';

export const PortalLanding = () => {
  const [eventId, setEventId] = useState('');
  const [showManual, setShowManual] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleEnter = () => {
    const id = eventId.trim();
    if (!id) {
      setError('Ingresa un identificador válido.');
      return;
    }
    if (id.length < 8) {
      setError('El identificador del evento parece incompleto.');
      return;
    }
    setError('');
    navigate(`/portal/${id}/login`);
  };

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '70vh' }}>
      <GlassCard
        className="animate-fade-in"
        style={{ width: '100%', maxWidth: '480px', padding: '36px' }}
      >
        <div style={{ display: 'flex', gap: '14px', alignItems: 'center', marginBottom: '16px' }}>
          <div
            style={{
              width: '48px',
              height: '48px',
              borderRadius: 'var(--radius-md)',
              background: 'rgba(57,255,20,0.14)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Ticket color="var(--accent-primary)" />
          </div>
          <div>
            <h2 style={{ margin: 0 }}>Bienvenido al Portal</h2>
            <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
              Aquí gestionas tu reserva del evento.
            </p>
          </div>
        </div>

        <GlassCard
          style={{
            padding: '14px 16px',
            marginBottom: '20px',
            display: 'flex',
            gap: '10px',
            alignItems: 'flex-start',
          }}
        >
          <Link color="var(--accent-primary)" style={{ flexShrink: 0, marginTop: '2px' }} />
          <div style={{ fontSize: '0.9rem', lineHeight: 1.5 }}>
            El comité organizador te enviará un <strong>enlace directo</strong> o un{' '}
            <strong>código QR</strong> al evento. Ábrelo desde tu correo o WhatsApp para entrar
            sin escribir nada.
          </div>
        </GlassCard>

        {!showManual ? (
          <Button variant="secondary" style={{ width: '100%' }} onClick={() => setShowManual(true)} icon={QrCode}>
            ¿Tienes un código QR o ID? Ingresar manualmente
          </Button>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <Input
              label="Identificador del evento"
              placeholder="Ej. f95ab5ce-04c6-4c6d-a15e…"
              value={eventId}
              onChange={(e) => setEventId(e.target.value)}
              error={error}
            />
            <div style={{ display: 'flex', gap: '12px' }}>
              <Button variant="secondary" onClick={() => setShowManual(false)}>
                Cancelar
              </Button>
              <Button onClick={handleEnter} style={{ flex: 1 }}>
                Acceder al evento
              </Button>
            </div>
          </div>
        )}
      </GlassCard>
    </div>
  );
};
