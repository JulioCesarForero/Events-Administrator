import { useState, useEffect } from 'react';
import { useAuthStaff } from '../../contexts/AuthContext';
import { GlassCard } from '../../components/ui/GlassCard';
import { apiClient } from '../../api/client';
import { ArrowLeft } from 'lucide-react';
import { useParams, useNavigate } from 'react-router-dom';

export const StaffMap = () => {
  const { session } = useAuthStaff();
  const navigate = useNavigate();
  const { eventId } = useParams();
  const [mapData, setMapData] = useState<any>(null);

  useEffect(() => {
    if (session) {
      loadMap();
    }
  }, [session]);

  const loadMap = async () => {
    try {
      const res = await apiClient.get<any>(`/events/${eventId}/map`, { token: session?.accessToken, isBearer: true });
      setMapData(res);
    } catch (err) {
      // Mock for UI demonstration
      setMapData({
        tables: [
          { id: 't1', code: 'A1', availableSpots: 10, position: { x: 50, y: 50 } },
          { id: 't2', code: 'A2', availableSpots: 0, position: { x: 150, y: 50 } },
          { id: 't3', code: 'B1', availableSpots: 5, position: { x: 50, y: 150 } },
        ]
      });
    }
  };

  if (!session) return null;

  return (
    <div className="animate-slide-up" style={{ maxWidth: '1000px', margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px' }}>
        <button onClick={() => navigate('/staff/dashboard')} style={{ background: 'transparent', border: 'none', color: 'var(--text-primary)', cursor: 'pointer' }}>
          <ArrowLeft size={24} />
        </button>
        <h2 style={{ margin: 0 }}>Mapa del Evento (Visualización)</h2>
      </div>

      <GlassCard style={{ minHeight: '500px', position: 'relative', overflow: 'hidden' }}>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '20px' }}>Vista operativa de las mesas y su disponibilidad según backend.</p>
        
        <div style={{ position: 'relative', width: '100%', minHeight: '400px', overflow: 'auto', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-md)' }}>
          {mapData?.tables?.map((t: any) => {
            const isFull = t.availableSpots === 0;
            return (
              <div 
                key={t.id}
                style={{
                  position: 'absolute',
                  left: `${t.position?.x || 0}px`,
                  top: `${t.position?.y || 0}px`,
                  width: '60px', height: '60px',
                  borderRadius: '50%',
                  background: isFull ? 'rgba(255,0,0,0.2)' : 'rgba(255,255,255,0.1)',
                  border: `2px solid ${isFull ? 'var(--error)' : 'var(--border-focus)'}`,
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                  color: 'var(--text-primary)'
                }}
              >
                <span style={{ fontWeight: 'bold' }}>{t.code}</span>
                <span style={{ fontSize: '0.7rem', color: isFull ? 'var(--error)' : 'var(--text-secondary)' }}>
                  {isFull ? 'Llena' : `${t.availableSpots} libres`}
                </span>
              </div>
            );
          })}
        </div>
      </GlassCard>
    </div>
  );
};
