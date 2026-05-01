import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { GlassCard } from '../../components/ui/GlassCard';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { Mail, Lock } from 'lucide-react';
import { apiClient } from '../../api/client';
import { useAuthStaff } from '../../contexts/AuthContext';

export const StaffLogin = () => {
  const navigate = useNavigate();
  const { setSession } = useAuthStaff();
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Por favor ingresa correo y contraseña');
      return;
    }

    try {
      setLoading(true);
      setError('');
      
      const res = await apiClient.post<any>('/auth/staff-login', { email, password });

      const meRes = await apiClient.get<any>('/auth/me', { token: res.accessToken, isBearer: true });
      const role = meRes.memberships?.[0]?.role || '';
      const eventAssignments = meRes.eventAssignments || [];
      const tenantId = meRes.memberships?.[0]?.tenantId || '';

      setSession({
        accessToken: res.accessToken,
        userId: res.userId,
        email: res.email,
        tenantId,
        role,
        eventAssignments
      });

      if (!tenantId && eventAssignments.length > 0) {
        navigate(`/staff/events/${eventAssignments[0].eventId}/dashboard`);
      } else {
        navigate(`/staff/dashboard`);
      }
    } catch (err: any) {
      setError(err.message || 'Credenciales inválidas');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
      <GlassCard className="animate-slide-up" style={{ width: '100%', maxWidth: '400px' }}>
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <h2 style={{ marginBottom: '8px' }}>Acceso Staff</h2>
          <p style={{ color: 'var(--text-secondary)' }}>Ingresa al panel administrativo</p>
        </div>

        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <Input
            label="Correo Electrónico"
            type="email"
            placeholder="admin@events.com"
            icon={Mail}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <Input
            label="Contraseña"
            type="password"
            placeholder="••••••••"
            icon={Lock}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            error={error}
          />
          
          <Button 
            type="submit" 
            isLoading={loading}
            style={{ width: '100%', marginTop: '8px' }}
          >
            Ingresar al Panel
          </Button>
        </form>
      </GlassCard>
    </div>
  );
};
