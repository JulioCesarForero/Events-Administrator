import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { GlassCard } from '../../components/ui/GlassCard';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { Key } from 'lucide-react';
import { apiClient } from '../../api/client';
import { useAuthPortal } from '../../contexts/AuthContext';

export const PortalCodeLogin = () => {
  const { eventId } = useParams();
  const navigate = useNavigate();
  const { setSession } = useAuthPortal();
  
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code) {
      setError('Por favor ingresa tu código de estudiante');
      return;
    }

    try {
      setLoading(true);
      setError('');
      // In a real scenario, the user will reach a URL like /portal/:eventId
      // but if eventId is missing (e.g. from /portal), we might need an event selector.
      // Assuming eventId is present or we hardcode a demo one if missing.
      const targetEventId = eventId || '00000000-0000-0000-0000-000000000000'; // Fallback for UI testing
      
      const res = await apiClient.post<any>('/auth/code-login', {
        eventId: targetEventId,
        studentCode: code
      });

      setSession({
        sessionToken: res.sessionToken,
        eventId: res.eventId,
        groupId: res.groupId,
        studentCode: res.studentCode,
      });

      navigate(`/portal/${res.eventId}/dashboard`);
    } catch (err: any) {
      setError(err.message || 'Código inválido o error de conexión');
    } finally {
      setLoading(false);
    }
  };

  return (
    <GlassCard className="animate-slide-up" style={{ maxWidth: '400px', margin: '40px auto' }}>
      <div style={{ textAlign: 'center', marginBottom: '32px' }}>
        <h2 style={{ marginBottom: '8px' }}>Acceso al Evento</h2>
        <p style={{ color: 'var(--text-secondary)' }}>
          Ingresa con tu código único de estudiante para acceder a tu reserva.
        </p>
      </div>

      <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <Input
          label="Código de Estudiante"
          placeholder="Ej: EST-2026-0042"
          icon={Key}
          value={code}
          onChange={(e) => setCode(e.target.value)}
          error={error}
        />
        
        <Button 
          type="submit" 
          isLoading={loading}
          style={{ width: '100%', marginTop: '8px' }}
        >
          Verificar e Ingresar
        </Button>
      </form>
    </GlassCard>
  );
};
