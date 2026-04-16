import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { GlassCard } from '../../components/ui/GlassCard';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';

export const PortalLanding = () => {
  const [eventId, setEventId] = useState('');
  const navigate = useNavigate();

  const handleEnter = () => {
    if (eventId.trim().length > 10) {
      navigate(`/portal/${eventId.trim()}/login`);
    } else {
      alert('Por favor, ingresa un ID de Evento válido.');
    }
  };

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '70vh' }}>
      <GlassCard style={{ width: '100%', maxWidth: '450px', textAlign: 'center', padding: '40px' }} className="animate-fade-in">
        <h2 style={{ margin: '0 0 16px 0', color: 'var(--accent-primary)', fontSize: '1.8rem' }}>Bienvenido al Portal</h2>
        
        <p style={{ color: 'var(--text-secondary)', marginBottom: '24px', lineHeight: '1.6' }}>
          Normalmente, el comité organizador de tu escuela te proporcionará un <strong>enlace directo</strong> para acceder a la taquilla de tu evento.
        </p>

        <div style={{ width: '100%', height: '1px', background: 'var(--border-light)', margin: '24px 0' }} />

        <p style={{ color: 'var(--text-muted)', marginBottom: '16px', fontSize: '0.9rem' }}>
          Si tienes un ID de evento en su lugar, colócalo aquí:
        </p>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <Input 
             placeholder="Ej: f95ab5ce-04c6-4c6d-a15e..." 
             value={eventId} 
             onChange={e => setEventId(e.target.value)} 
          />
          <Button onClick={handleEnter} disabled={!eventId}>
             Acceder al Evento
          </Button>
        </div>
      </GlassCard>
    </div>
  );
};
