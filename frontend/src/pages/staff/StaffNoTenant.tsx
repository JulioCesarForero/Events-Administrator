import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { Building2, LogOut, RefreshCw } from 'lucide-react';
import { GlassCard } from '../../components/ui/GlassCard';
import { Button } from '../../components/ui/Button';
import { InlineAlert } from '../../components/ui/InlineAlert';
import { apiClient } from '../../api/client';
import { useAuthStaff } from '../../contexts/AuthContext';

/**
 * Pantalla de bloqueo para cuentas staff sin tenant asociado.
 * Sin tenant no hay permisos sobre ningún evento, así que la única acción
 * posible es pedir la asociación, volver a verificarla o cerrar sesión.
 */
export const StaffNoTenant = () => {
  const navigate = useNavigate();
  const { session, setSession, logout } = useAuthStaff();
  const [checking, setChecking] = useState(false);
  const [stillMissing, setStillMissing] = useState(false);

  if (!session) return <Navigate to="/staff/login" replace />;
  if (session.tenantId) return <Navigate to="/staff/dashboard" replace />;

  const assignments = session.eventAssignments || [];
  const hasEventAssignments = assignments.length > 0;

  const handleRecheck = async () => {
    setChecking(true);
    setStillMissing(false);
    try {
      const me = await apiClient.get<{ memberships?: Array<{ tenantId?: string; role?: string }>; eventAssignments?: Array<{ eventId: string; eventName: string; role: string }> }>('/auth/me', {
        token: session.accessToken,
        isBearer: true,
      });
      const membership = me.memberships?.[0];
      if (membership?.tenantId) {
        setSession({
          ...session,
          tenantId: membership.tenantId,
          role: membership.role || '',
          eventAssignments: me.eventAssignments || [],
        });
        navigate('/staff/dashboard', { replace: true });
        return;
      }
      setStillMissing(true);
    } catch {
      setStillMissing(true);
    } finally {
      setChecking(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/staff/login', { replace: true });
  };

  return (
    <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 'var(--space-8)' }}>
      <GlassCard
        className="animate-slide-up"
        style={{ width: '100%', maxWidth: '560px', display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
          <Building2 size={28} color="var(--warning)" aria-hidden="true" />
          <h1 style={{ margin: 0, fontSize: 'var(--text-2xl)' }}>Cuenta sin organización asociada</h1>
        </div>

        <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6 }}>
          Iniciaste sesión como <strong style={{ color: 'var(--text-primary)' }}>{session.email}</strong>,
          pero tu cuenta no pertenece a ninguna organización (tenant). Sin esa asociación no tienes
          acceso a eventos, pagos ni reportes.
        </p>

        <InlineAlert tone="warn" title="¿A quién debo contactar?">
          {hasEventAssignments ? (
            <>
              Tienes asignación en{' '}
              {assignments.map((a) => a.eventName).join(', ')}. Pide al{' '}
              <strong>administrador del tenant</strong> que organiza ese evento que asocie tu
              cuenta a la organización.
            </>
          ) : (
            <>
              Si sabes qué organización te invitó, contacta a su <strong>administrador del tenant</strong>.
              Si no, comunícate con el <strong>administrador de la plataforma</strong> para que te
              asigne a la organización correspondiente.
            </>
          )}
        </InlineAlert>

        {stillMissing && (
          <p role="status" style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-sm)' }}>
            Tu cuenta sigue sin organización asociada. Inténtalo de nuevo cuando el administrador
            confirme el cambio.
          </p>
        )}

        <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
          <Button icon={RefreshCw} isLoading={checking} onClick={handleRecheck}>
            Volver a verificar
          </Button>
          <Button variant="outline" icon={LogOut} onClick={handleLogout}>
            Cerrar sesión
          </Button>
        </div>
      </GlassCard>
    </div>
  );
};
