import { useState, useEffect } from 'react';
import { useAuthStaff } from '../../contexts/AuthContext';
import { GlassCard } from '../../components/ui/GlassCard';
import { Button } from '../../components/ui/Button';
import { apiClient } from '../../api/client';
import { useNavigate } from 'react-router-dom';

export const StaffDashboard = () => {
  const { session, setSession, logout } = useAuthStaff();
  const navigate = useNavigate();
  const [events, setEvents] = useState<any[]>([]);

  useEffect(() => {
    if (session) {
      if (!session.tenantId && (!session.eventAssignments || session.eventAssignments.length === 0)) {
        apiClient.get<any>('/auth/me', { token: session.accessToken, isBearer: true })
          .then(res => {
             const m = res.memberships?.[0];
             setSession({
               ...session,
               tenantId: m?.tenantId || '',
               role: m?.role || '',
               eventAssignments: res.eventAssignments || [],
             });
          }).catch(console.error);
      } else {
        loadEvents();
      }
    }
  }, [session, setSession]);

  const loadEvents = async () => {
    try {
      if (session?.tenantId) {
        const res = await apiClient.get<any>(`/events?tenant_id=${session?.tenantId}`, { token: session?.accessToken, isBearer: true });
        const items = Array.isArray(res) ? res : (res as any)?.items || [];
        
        if (items.length > 0) {
          setEvents(items.map((ev: any) => ({
            id: ev.id,
            name: ev.name,
            date: ev.eventDate ? new Date(ev.eventDate).toLocaleDateString() : (ev.date || 'Sin Fecha')
          })));
        } else {
          setEvents([]); // Dejarlo vacío para incitar a crear uno nuevo
        }
      } else if (session?.eventAssignments && session.eventAssignments.length > 0) {
        // Use eventAssignments instead
        setEvents(session.eventAssignments.map((a: any) => ({
          id: a.eventId,
          name: a.eventName,
          date: 'Asignado'
        })));
      }
    } catch (err) {
      setEvents([{ id: 'demo-event', name: 'Evento Demo Graduación 2026 (Sin Conexión)', date: '2026-11-20' }]);
    }
  };

  if (!session) {
    return (
      <GlassCard className="animate-fade-in" style={{ textAlign: 'center' }}>
        <h3>Sin acceso</h3>
        <Button onClick={() => navigate('/staff/login')} style={{ marginTop: '20px' }}>Ir a Login</Button>
      </GlassCard>
    );
  }

  const isAdmin = ['ADMIN', 'OWNER', 'TENANT_ADMIN', 'SUPER_ADMIN'].includes(session.role || '');

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ margin: 0 }}>Panel General</h2>
          <p style={{ color: 'var(--text-secondary)' }}>
            Bienvenido, {session.email}
            {session.role ? ` · Rol ${session.role}` : ''}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          {isAdmin && (
            <Button
              variant="secondary"
              onClick={() => navigate('/staff/admin/staff-users')}
            >
              Gestión de Staff
            </Button>
          )}
          <Button variant="outline" onClick={logout}>Cerrar Sesión</Button>
        </div>
      </div>

      <h3 style={{ marginTop: '20px' }}>Mis Eventos</h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px' }}>
        {events.length === 0 && (
          <GlassCard style={{ display: 'flex', flexDirection: 'column', gap: '8px', justifyContent: 'center' }}>
            <p style={{ color: 'var(--text-secondary)', margin: 0 }}>No tienes eventos activos.</p>
          </GlassCard>
        )}
        {events.map(ev => {
          const userAssignment = session.eventAssignments?.find(a => a.eventId === ev.id);
          const eventRole = userAssignment?.role || session.role;
          const isPaymentStaff = eventRole === 'EVENT_PAYMENT_STAFF' || eventRole === 'EVENT_SUPPORT_STAFF';
          const isViewer = eventRole === 'EVENT_STUDENT_VIEWER' || eventRole === 'EVENT_SUPPORT_STAFF';
          const isSupport = eventRole === 'EVENT_SUPPORT_STAFF';
          
          return (
          <GlassCard key={ev.id} hoverEffect style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <h4 style={{ fontSize: '1.2rem', margin: 0 }}>{ev.name}</h4>
            <p style={{ color: 'var(--text-secondary)' }}>Fecha: {ev.date}</p>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
               {(isAdmin || isPaymentStaff || isViewer || isSupport) && (
                 <Button size="sm" onClick={() => navigate(`/staff/events/${ev.id}/payments`)}>Revisión Pagos</Button>
               )}
               {(isAdmin || isPaymentStaff || isViewer || isSupport) && (
                 <Button size="sm" variant="secondary" onClick={() => navigate(`/staff/events/${ev.id}/students`)}>Estudiantes</Button>
               )}
               
               {isAdmin && (
                 <>
                   <Button size="sm" variant="outline" onClick={() => navigate(`/staff/events/${ev.id}/map`)}>Diseño de Plano</Button>
                   <Button size="sm" variant="secondary" onClick={() => navigate(`/staff/events/${ev.id}/policies`)}>Políticas</Button>
                   <Button size="sm" variant="outline" onClick={() => navigate(`/staff/events/${ev.id}/manual-adjustments`)}>Ajustes</Button>
                   <Button size="sm" variant="outline" onClick={() => navigate(`/staff/events/${ev.id}/audit`)}>Auditoría</Button>
                   <Button
                     size="sm"
                     variant="secondary"
                     onClick={() => navigate(`/staff/events/${ev.id}/staff`)}
                   >
                     Staff del evento
                   </Button>
                 </>
               )}
            </div>
          </GlassCard>
        )})}
        {isAdmin && (
          <GlassCard 
            onClick={() => navigate('/staff/events/new')} 
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', borderStyle: 'dashed' }} 
            className="glass-panel-hover"
          >
            <span style={{ color: 'var(--accent-primary)', fontWeight: 'bold' }}>+ Crear Nuevo Evento</span>
          </GlassCard>
        )}
      </div>
    </div>
  );
};
