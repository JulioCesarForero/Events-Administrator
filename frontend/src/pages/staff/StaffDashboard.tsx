import { useState, useEffect } from 'react';
import { useAuthStaff } from '../../contexts/AuthContext';
import { GlassCard } from '../../components/ui/GlassCard';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { apiClient } from '../../api/client';
import { useNavigate } from 'react-router-dom';
import { QrCode, Download } from 'lucide-react';

export const StaffDashboard = () => {
  const { session, setSession, logout } = useAuthStaff();
  const navigate = useNavigate();
  const [events, setEvents] = useState<any[]>([]);
  
  const [qrModalOpen, setQrModalOpen] = useState(false);
  const [qrEventId, setQrEventId] = useState<string | null>(null);
  const [qrImage, setQrImage] = useState<string | null>(null);
  const [isLoadingQr, setIsLoadingQr] = useState(false);

  const handleGenerateQR = async (eventId: string) => {
    setQrEventId(eventId);
    setQrModalOpen(true);
    setQrImage(null);
    setIsLoadingQr(true);
    try {
      const url = `${window.location.origin}/portal/${eventId}/login`;
      const res = await apiClient.get<{ qrCode: string }>(`/events/${eventId}/qr?frontend_url=${encodeURIComponent(url)}`, { 
        token: session?.accessToken, 
        isBearer: true 
      });
      setQrImage(res.qrCode);
    } catch (err) {
      console.error('Error fetching QR:', err);
      setQrImage('error');
    } finally {
      setIsLoadingQr(false);
    }
  };

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
  const isSuperAdmin = session.role === 'SUPER_ADMIN';

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
          {isSuperAdmin && (
            <Button
              variant="secondary"
              onClick={() => navigate('/staff/admin/system-users')}
            >
              Gestión de Sistema
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
          const isPaymentStaff = ['CASHIER', 'ORGANIZER', 'COORDINATOR'].includes(eventRole || '');
          const isViewer = ['REVIEWER', 'ORGANIZER', 'COORDINATOR', 'CASHIER'].includes(eventRole || '');
          const isOrganizer = ['ORGANIZER', 'COORDINATOR'].includes(eventRole || '');
          
          return (
          <GlassCard key={ev.id} hoverEffect style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <h4 style={{ fontSize: '1.2rem', margin: 0 }}>{ev.name}</h4>
            <p style={{ color: 'var(--text-secondary)' }}>Fecha: {ev.date}</p>
             <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
               {isSuperAdmin && (
                 <Button size="sm" variant="outline" onClick={() => handleGenerateQR(ev.id)} icon={QrCode}>
                   QR Portal
                 </Button>
               )}
               {(isAdmin || isPaymentStaff || isViewer) && (
                 <Button size="sm" onClick={() => navigate(`/staff/events/${ev.id}/payments`)}>Revisión Pagos</Button>
               )}
               {(isAdmin || isPaymentStaff || isViewer) && (
                 <Button size="sm" variant="secondary" onClick={() => navigate(`/staff/events/${ev.id}/students`)}>Estudiantes</Button>
               )}
               {(isAdmin || isPaymentStaff || isViewer) && (
                 <Button
                   size="sm"
                   variant="outline"
                   onClick={() => navigate(`/staff/events/${ev.id}/student-reservations`)}
                 >
                   Reservas
                 </Button>
               )}
               
               {(isAdmin || isOrganizer) && (
                 <Button size="sm" variant="outline" onClick={() => navigate(`/staff/events/${ev.id}/map`)}>Diseño de Plano</Button>
               )}
               
               {isAdmin && (
                 <>
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

      <Modal
        isOpen={qrModalOpen}
        onClose={() => setQrModalOpen(false)}
        title="Código QR del Evento"
      >
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px', padding: '10px' }}>
          <p style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>
            Escanea este código para acceder al portal de estudiantes de este evento.
          </p>
          
          {isLoadingQr && (
            <div style={{ height: '200px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div className="spinner"></div>
            </div>
          )}
          
          {!isLoadingQr && qrImage === 'error' && (
            <div style={{ padding: '20px', color: 'var(--accent-primary)', backgroundColor: 'rgba(255,59,48,0.1)', borderRadius: '8px' }}>
              Error al generar el código QR
            </div>
          )}
          
          {!isLoadingQr && qrImage && qrImage !== 'error' && (
            <>
              <div style={{ padding: '20px', background: 'white', borderRadius: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
                <img src={qrImage} alt="QR Code" style={{ width: '250px', height: '250px', display: 'block' }} />
              </div>
              
              <Button 
                icon={Download} 
                onClick={() => {
                  const link = document.createElement('a');
                  link.href = qrImage;
                  link.download = `QR_Evento_${qrEventId}.png`;
                  document.body.appendChild(link);
                  link.click();
                  document.body.removeChild(link);
                }}
              >
                Descargar QR
              </Button>
            </>
          )}
        </div>
      </Modal>
    </div>
  );
};
