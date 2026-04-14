import { useState, useEffect } from 'react';
import { useAuthPortal } from '../../contexts/AuthContext';
import { GlassCard } from '../../components/ui/GlassCard';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { apiClient } from '../../api/client';
import { ArrowLeft, CheckCircle2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export const PortalMap = () => {
  const { session } = useAuthPortal();
  const navigate = useNavigate();
  const [mapData, setMapData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  
  // Selection state
  const [selectedTables, setSelectedTables] = useState<Record<string, number>>({});
  
  // Modal states
  const [showLegal, setShowLegal] = useState(false);
  const [legalAccepted, setLegalAccepted] = useState(false);
  const [reservationSuccess, setReservationSuccess] = useState(false);

  useEffect(() => {
    if (session) {
      loadMap();
    }
  }, [session]);

  const loadMap = async () => {
    try {
      const res = await apiClient.get<any>(`/events/${session?.eventId}/map`, { token: session?.sessionToken, isBearer: true });
      setMapData(res);
    } catch (err) {
      console.error(err);
    }
  };

  const handleTableToggle = (tableId: string) => {
    setSelectedTables(prev => {
      const copy = { ...prev };
      if (copy[tableId]) {
        delete copy[tableId];
      } else {
        // Just pre-allocating 1 spot for simplicity, they could choose via a stepper.
        copy[tableId] = 1;
      }
      return copy;
    });
  };

  const confirmReservation = async () => {
    setLoading(true);
    try {
      const allocations = Object.entries(selectedTables).map(([tableId, spots]) => ({
        layoutTableId: tableId,
        spotsReserved: spots
      }));

      await apiClient.post(`/events/${session?.eventId}/reservations`, {
        groupId: session?.groupId,
        paymentId: 'MOCK_PAY_ID', // Reemplazar con el pago real
        legalAcceptance: {
          accepted: true,
          policyDocumentId: 'leg_data',
          termsDocumentId: 'leg_terms'
        },
        allocations
      }, { token: session?.sessionToken, isBearer: true });
      
      setReservationSuccess(true);
      setShowLegal(false);
    } catch (err) {
      alert('Error confirmando reserva');
    } finally {
      setLoading(false);
    }
  };

  if (!session) return null;

  return (
    <div className="animate-slide-up" style={{ maxWidth: '1000px', margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px' }}>
        <button onClick={() => navigate(`/portal/${session.eventId}/dashboard`)} style={{ background: 'transparent', border: 'none', color: 'var(--text-primary)', cursor: 'pointer' }}>
          <ArrowLeft size={24} />
        </button>
        <h2 style={{ margin: 0 }}>Selección de Mesa</h2>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '24px' }}>
        {/* Render Map */}
        <GlassCard style={{ minHeight: '500px', position: 'relative', overflow: 'hidden' }}>
          <h3 style={{ marginBottom: '20px' }}>Layout del Salón</h3>
          
          <div style={{ position: 'relative', width: '100%', height: '400px', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-md)' }}>
            {mapData?.tables?.map((t: any) => (
              <div 
                key={t.id}
                onClick={() => t.availableSpots > 0 && handleTableToggle(t.id)}
                style={{
                  position: 'absolute',
                  left: `${t.position?.x || 0}px`,
                  top: `${t.position?.y || 0}px`,
                  width: '60px', height: '60px',
                  borderRadius: '50%',
                  background: selectedTables[t.id] ? 'var(--accent-primary)' : (t.availableSpots > 0 ? 'rgba(255,255,255,0.1)' : 'rgba(255,0,0,0.2)'),
                  border: `2px solid ${t.availableSpots > 0 ? 'var(--border-focus)' : 'var(--error)'}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: t.availableSpots > 0 ? 'pointer' : 'not-allowed',
                  transition: 'all 0.2s',
                  color: selectedTables[t.id] ? '#000' : 'var(--text-primary)'
                }}
              >
                <span>{t.code}</span>
              </div>
            ))}
          </div>
        </GlassCard>

        {/* Resumen */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <GlassCard>
            <h3 style={{ marginBottom: '16px' }}>Tu Selección</h3>
            {Object.keys(selectedTables).length === 0 ? (
              <p style={{ color: 'var(--text-secondary)' }}>No has seleccionado ninguna mesa.</p>
            ) : (
              <ul style={{ listStyle: 'none', padding: 0 }}>
                {Object.entries(selectedTables).map(([tableId, spots]) => {
                  const table = mapData?.tables?.find((t:any) => t.id === tableId);
                  return (
                    <li key={tableId} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border-light)' }}>
                      <span>Mesa {table?.code || tableId}</span>
                      <strong>{spots} cupo(s)</strong>
                    </li>
                  )
                })}
              </ul>
            )}

            <Button 
              style={{ width: '100%', marginTop: '24px' }} 
              disabled={Object.keys(selectedTables).length === 0}
              onClick={() => setShowLegal(true)}
            >
              Reservar Mesas
            </Button>
          </GlassCard>
          
          <GlassCard>
            <h4>Estado del Invientario</h4>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '12px' }}>
              <div style={{ width: 16, height: 16, borderRadius: '50%', background: 'rgba(255,255,255,0.1)' }} />
              <span style={{ fontSize: '0.875rem' }}>Disponible</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '8px' }}>
              <div style={{ width: 16, height: 16, borderRadius: '50%', background: 'rgba(255,0,0,0.2)' }} />
              <span style={{ fontSize: '0.875rem' }}>Agotada</span>
            </div>
          </GlassCard>
        </div>
      </div>

      <Modal isOpen={showLegal} onClose={() => setShowLegal(false)} title="Términos y Condiciones">
        <p style={{ color: 'var(--text-secondary)', marginBottom: '20px' }}>
          Para continuar con la reserva, debes aceptar la política de tratamiento de datos y los términos del evento.
        </p>
        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', marginBottom: '24px' }}>
          <input type="checkbox" checked={legalAccepted} onChange={e => setLegalAccepted(e.target.checked)} />
          He leído y acepto los términos legales.
        </label>
        
        <div style={{ display: 'flex', gap: '16px', justifyContent: 'flex-end' }}>
          <Button variant="secondary" onClick={() => setShowLegal(false)}>Cancelar</Button>
          <Button onClick={confirmReservation} disabled={!legalAccepted} isLoading={loading}>Confirmar Reserva Fija</Button>
        </div>
      </Modal>

      <Modal isOpen={reservationSuccess} onClose={() => { setReservationSuccess(false); navigate(`/portal/${session.eventId}/dashboard`); }} title="¡Reserva Exitosa!">
        <div style={{ textAlign: 'center', padding: '20px 0' }}>
          <CheckCircle2 size={64} style={{ color: 'var(--success)', margin: '0 auto 20px' }} />
          <h3>Tus ubicaciones han sido confirmadas</h3>
          <p style={{ color: 'var(--text-secondary)', marginTop: '12px' }}>Tus códigos secuenciales han sido asignados y la reserva es definitiva.</p>
          <Button onClick={() => navigate(`/portal/${session.eventId}/dashboard`)} style={{ marginTop: '24px' }}>
            Ir al Dashboard
          </Button>
        </div>
      </Modal>
    </div>
  );
};
