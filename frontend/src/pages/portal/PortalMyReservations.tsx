import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useAuthPortal } from '../../contexts/AuthContext';
import { GlassCard } from '../../components/ui/GlassCard';
import { Button } from '../../components/ui/Button';
import { apiClient } from '../../api/client';
import { EventMap } from '../../components/ui/EventMap';
import type { MapTable, MyReservationSummary } from '../../api/types';

function tableId(t: MapTable): string {
  return t.id || t.layoutTableId || '';
}

export const PortalMyReservations = () => {
  const { eventId } = useParams<{ eventId: string }>();
  const { session } = useAuthPortal();
  const navigate = useNavigate();

  const [reservations, setReservations] = useState<MyReservationSummary[]>([]);
  const [mapData, setMapData] = useState<{
    tables: MapTable[];
    backgroundImageUrl?: string | null;
  } | null>(null);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    if (!session || !eventId) return;
    const ctrl = new AbortController();
    const token = { token: session.sessionToken, isBearer: true, signal: ctrl.signal };

    const run = async () => {
      try {
        const [listRes, mapRes] = await Promise.all([
          apiClient.get<MyReservationSummary[]>(
            `/portal/events/${eventId}/my-reservations`,
            token,
          ),
          apiClient.get<{ tables: MapTable[]; backgroundImageUrl?: string | null }>(
            `/events/${eventId}/map`,
            token,
          ),
        ]);
        setReservations(Array.isArray(listRes) ? listRes : []);
        setMapData(mapRes);
      } catch (e: unknown) {
        setLoadError(e instanceof Error ? e.message : 'No se pudo cargar la información');
      }
    };
    run();
    return () => ctrl.abort();
  }, [session, eventId]);

  const reservedByTable = useMemo(() => {
    const acc: Record<string, number> = {};
    for (const r of reservations) {
      for (const a of r.allocations || []) {
        const tid = a.layoutTableId;
        acc[tid] = (acc[tid] || 0) + (a.spotsReserved || 0);
      }
    }
    return acc;
  }, [reservations]);

  const tables = mapData?.tables || [];
  const totalReserved = useMemo(
    () => reservations.reduce((s, r) => s + (r.totalSpotsReserved || 0), 0),
    [reservations],
  );

  if (!session || !eventId) return null;

  return (
    <div className="animate-slide-up" style={{ maxWidth: '1000px', margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '20px' }}>
        <button
          type="button"
          onClick={() => navigate(`/portal/${eventId}/dashboard`)}
          style={{
            background: 'transparent',
            border: 'none',
            color: 'var(--text-primary)',
            cursor: 'pointer',
          }}
        >
          <ArrowLeft size={24} />
        </button>
        <div>
          <h2 style={{ margin: 0 }}>Mis mesas</h2>
          <p style={{ margin: '4px 0 0', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
            Vista de solo lectura. Las mesas con número en círculo azul son tus cupos reservados.
          </p>
        </div>
      </div>

      {loadError && (
        <GlassCard style={{ marginBottom: '16px', borderLeft: '3px solid var(--error)' }}>
          <strong>{loadError}</strong>
        </GlassCard>
      )}

      {reservations.length === 0 && !loadError ? (
        <GlassCard style={{ textAlign: 'center', padding: '32px' }}>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '20px' }}>
            Aún no tienes mesas reservadas en este evento.
          </p>
          <Button onClick={() => navigate(`/portal/${eventId}/map`)}>Ir a seleccionar mesa</Button>
        </GlassCard>
      ) : (
        <>
          <GlassCard style={{ marginBottom: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
              <div>
                <small style={{ color: 'var(--text-secondary)' }}>Reservas confirmadas</small>
                <div style={{ fontSize: '1.25rem', fontWeight: 700 }}>{reservations.length}</div>
              </div>
              <div>
                <small style={{ color: 'var(--text-secondary)' }}>Cupos en mesa</small>
                <div style={{ fontSize: '1.25rem', fontWeight: 700 }}>{totalReserved}</div>
              </div>
            </div>
          </GlassCard>

          <GlassCard style={{ marginBottom: '20px' }}>
            <h3 style={{ marginTop: 0, marginBottom: '12px' }}>Por operación</h3>
            <ol style={{ margin: 0, paddingLeft: '20px', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
              {reservations.map((r, idx) => (
                <li key={r.reservationId} style={{ marginBottom: '14px' }}>
                  <div style={{ color: 'var(--text-primary)', fontWeight: 600 }}>
                    Reserva {idx + 1} · {r.totalSpotsReserved} cupo{r.totalSpotsReserved !== 1 ? 's' : ''}
                  </div>
                  {r.createdAt ? (
                    <div style={{ fontSize: '0.8rem', marginTop: '2px' }}>
                      {new Date(r.createdAt).toLocaleString()}
                    </div>
                  ) : null}
                  <ul style={{ margin: '6px 0 0', paddingLeft: '18px' }}>
                    {(r.allocations || []).map((a) => {
                      const t = tables.find((x) => tableId(x) === a.layoutTableId);
                      return (
                        <li key={`${r.reservationId}-${a.layoutTableId}`}>
                          Mesa <strong>{t?.code || a.layoutTableId.slice(0, 8)}</strong> — {a.spotsReserved} cupo
                          {a.spotsReserved !== 1 ? 's' : ''}
                        </li>
                      );
                    })}
                  </ul>
                </li>
              ))}
            </ol>
          </GlassCard>

          <GlassCard style={{ marginBottom: '20px', minHeight: '480px' }}>
            <h3 style={{ marginTop: 0, marginBottom: '12px' }}>Plano del salón</h3>
            {tables.length > 0 ? (
              <EventMap
                tables={tables}
                isAdmin={false}
                readOnlyViewer
                reservedSpotsDisplay={reservedByTable}
                backgroundImageUrl={mapData?.backgroundImageUrl || ''}
              />
            ) : (
              <p style={{ color: 'var(--text-muted)' }}>Cargando plano…</p>
            )}
          </GlassCard>

          <GlassCard>
            <h3 style={{ marginTop: 0, marginBottom: '16px' }}>Detalle por mesa</h3>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {Object.entries(reservedByTable).map(([tid, spots]) => {
                const t = tables.find((x) => tableId(x) === tid);
                return (
                  <li
                    key={tid}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      padding: '14px 0',
                      borderBottom: '1px solid var(--border-light)',
                      fontSize: '0.95rem',
                    }}
                  >
                    <span>
                      Mesa <strong>{t?.code || tid.slice(0, 8)}</strong>
                    </span>
                    <span style={{ color: 'var(--text-secondary)' }}>
                      <strong style={{ color: 'var(--text-primary)' }}>{spots}</strong> cupo
                      {spots !== 1 ? 's' : ''}
                    </span>
                  </li>
                );
              })}
            </ul>
          </GlassCard>

          <div style={{ marginTop: '20px' }}>
            <Button variant="secondary" onClick={() => navigate(`/portal/${eventId}/dashboard`)}>
              Volver al resumen
            </Button>
          </div>
        </>
      )}
    </div>
  );
};
