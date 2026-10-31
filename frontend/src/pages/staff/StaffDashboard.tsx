import { useState, useEffect } from 'react';
import { useAuthStaff } from '../../contexts/AuthContext';
import { GlassCard } from '../../components/ui/GlassCard';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { apiClient } from '../../api/client';
import { useNavigate } from 'react-router-dom';
import { QrCode, Download, ArrowRight, Plus, RefreshCw } from 'lucide-react';
import { InlineAlert } from '../../components/ui/InlineAlert';
import { getEventPermissions } from '../../utils/staffPermissions';
import { rememberEventNames } from '../../utils/eventNames';

export const StaffDashboard = () => {
  const { session } = useAuthStaff();
  const navigate = useNavigate();
  const [events, setEvents] = useState<any[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  
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
    // RequireStaffAuth ya garantiza un tenant; sin él se muestra /staff/no-tenant.
    if (session?.tenantId) loadEvents();
  }, [session]);

  const loadEvents = async () => {
    setLoadError(null);
    try {
      if (session?.tenantId) {
        const res = await apiClient.get<any>(`/events?tenant_id=${session?.tenantId}`, { token: session?.accessToken, isBearer: true });
        const items = Array.isArray(res) ? res : (res as any)?.items || [];
        const mapped = items.map((ev: any) => ({
          id: ev.id,
          name: ev.name,
          date: ev.eventDate ? new Date(ev.eventDate).toLocaleDateString('es-CO') : (ev.date || 'Sin fecha'),
        }));
        setEvents(mapped);
        rememberEventNames(mapped);
      }
    } catch (err) {
      setEvents([]);
      setLoadError(err instanceof Error && err.message ? err.message : 'Revisa tu conexión e inténtalo de nuevo.');
    } finally {
      setLoaded(true);
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

  const { isAdmin, isSuperAdmin } = getEventPermissions(session);

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      <div>
        <h1 style={{ margin: 0, fontSize: 'var(--text-2xl)' }}>Mis eventos</h1>
        <p style={{ color: 'var(--text-secondary)', marginTop: 'var(--space-1)' }}>
          Elige un evento para revisar pagos, estudiantes y reservas.
        </p>
      </div>

      {loadError && (
        <InlineAlert
          tone="error"
          title="No se pudieron cargar tus eventos"
          actions={
            <Button size="sm" variant="outline" icon={RefreshCw} onClick={loadEvents}>
              Reintentar
            </Button>
          }
        >
          {loadError}
        </InlineAlert>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 300px), 1fr))', gap: 'var(--space-5)' }}>
        {loaded && !loadError && events.length === 0 && (
          <GlassCard style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', justifyContent: 'center' }}>
            <p style={{ color: 'var(--text-secondary)', margin: 0 }}>No tienes eventos activos.</p>
          </GlassCard>
        )}
        {events.map(ev => {
          const perms = getEventPermissions(session, ev.id);
          const primaryPath = perms.canViewOperations
            ? `/staff/events/${ev.id}/payments`
            : perms.canEditMap
              ? `/staff/events/${ev.id}/map`
              : null;

          return (
            <GlassCard key={ev.id} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
              <div>
                <h2 style={{ fontSize: 'var(--text-xl)', margin: 0 }}>{ev.name}</h2>
                <p style={{ color: 'var(--text-secondary)', marginTop: 'var(--space-1)' }}>Fecha: {ev.date}</p>
              </div>
              <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap', marginTop: 'auto' }}>
                {primaryPath && (
                  <Button onClick={() => navigate(primaryPath)} icon={ArrowRight} style={{ flex: 1 }}>
                    Abrir evento
                  </Button>
                )}
                {isSuperAdmin && (
                  <Button variant="outline" onClick={() => handleGenerateQR(ev.id)} icon={QrCode}>
                    QR del portal
                  </Button>
                )}
              </div>
            </GlassCard>
          );
        })}
        {isAdmin && (
          <button
            type="button"
            onClick={() => navigate('/staff/events/new')}
            className="glass-panel glass-panel-hover"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 'var(--space-2)',
              minHeight: '140px',
              cursor: 'pointer',
              borderStyle: 'dashed',
              color: 'var(--accent-text)',
              fontFamily: 'inherit',
              fontSize: 'var(--text-base)',
              fontWeight: 700,
            }}
          >
            <Plus size={20} aria-hidden="true" />
            Crear nuevo evento
          </button>
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
            <div style={{ padding: '20px', color: 'var(--error)', backgroundColor: 'var(--error-dim)', borderRadius: '8px' }}>
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
