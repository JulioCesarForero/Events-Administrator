
import { useAuthPortal } from '../../contexts/AuthContext';
import { GlassCard } from '../../components/ui/GlassCard';
import { Button } from '../../components/ui/Button';
import { useNavigate } from 'react-router-dom';

export const PortalDashboard = () => {
  const { session, logout } = useAuthPortal();
  const navigate = useNavigate();

  if (!session) {
    return (
      <GlassCard className="animate-fade-in" style={{ textAlign: 'center' }}>
        <h3>No hay sesión activa</h3>
        <Button onClick={() => navigate('/portal/login')} style={{ marginTop: '20px' }}>Ir a Login</Button>
      </GlassCard>
    );
  }

  return (
    <div className="animate-fade-in" style={{ maxWidth: '800px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2>Resumen de tu Reserva</h2>
        <Button variant="outline" onClick={logout}>Cerrar Sesión</Button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '20px' }}>
        {/* Step 1: Asistentes */}
        <GlassCard hoverEffect>
          <h3>1. Asistentes</h3>
          <p style={{ color: 'var(--text-secondary)', margin: '10px 0' }}>Registra la información de los acompañantes.</p>
          <Button variant="secondary" onClick={() => navigate(`/portal/${session.eventId}/attendees`)} style={{ width: '100%' }}>Gestionar</Button>
        </GlassCard>

        {/* Step 2: Pago */}
        <GlassCard hoverEffect>
          <h3>2. Pago</h3>
          <p style={{ color: 'var(--text-secondary)', margin: '10px 0' }}>Registra el pago para habilitar la selección de mesa.</p>
          <Button variant="secondary" onClick={() => navigate(`/portal/${session.eventId}/payment`)} style={{ width: '100%' }}>Registrar Pago</Button>
        </GlassCard>

        {/* Step 3: Reserva */}
        <GlassCard hoverEffect style={{ opacity: 0.5 }}>
          <h3>3. Selección de Ubicación</h3>
          <p style={{ color: 'var(--text-secondary)', margin: '10px 0' }}>Elige tu mesa una vez el pago esté aprobado.</p>
          <Button variant="secondary" disabled style={{ width: '100%' }}>Seleccionar Mesa</Button>
        </GlassCard>
      </div>
    </div>
  );
};
