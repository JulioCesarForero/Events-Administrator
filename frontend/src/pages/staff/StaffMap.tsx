import { useState, useEffect } from 'react';
import { useAuthStaff } from '../../contexts/AuthContext';
import { GlassCard } from '../../components/ui/GlassCard';
import { apiClient } from '../../api/client';
import { ArrowLeft, Users, Info, LayoutTemplate } from 'lucide-react';
import { useParams, useNavigate } from 'react-router-dom';
import { EventMap } from '../../components/ui/EventMap';
import type { MapTable } from '../../api/types';

export const StaffMap = () => {
  const { session } = useAuthStaff();
  const navigate = useNavigate();
  const { eventId } = useParams();
  
  const [layoutId, setLayoutId] = useState<string | null>(null);
  const [tables, setTables] = useState<MapTable[]>([]);
  const [loading, setLoading] = useState(true);
  const [previewMode, setPreviewMode] = useState(false);

  useEffect(() => {
    if (session) {
      loadMap();
    }
  }, [session]);

  const loadMap = async () => {
    setLoading(true);
    try {
      const res = await apiClient.get<{ layoutId: string, tables: MapTable[] }>(
        `/events/${eventId}/map`, 
        { token: session?.accessToken, isBearer: true }
      );
      setLayoutId(res.layoutId);
      setTables(res.tables || []);
    } catch (err) {
      console.error("No se pudo cargar el mapa", err);
    } finally {
      setLoading(false);
    }
  };

  const addLayoutObject = async (category: string) => {
    if (!layoutId || !session) return;
    
    let config: any = {
      code: 'NUEVA',
      tableCapacityLimit: 10,
      positionJson: { x: 100, y: 100, rotationDeg: 0 },
      isPublicSelectable: true
    };

    if (category === 'table') {
      const count = tables.filter(t => !['TARIMA', 'PISTA', 'ENTRADA', 'SALIDA'].includes((t.code || '').toUpperCase())).length;
      config.code = (count + 1).toString();
    } else if (category === 'stage') {
      config = { ...config, tableCapacityLimit: 0, code: 'TARIMA', isPublicSelectable: false };
    } else if (category === 'dancefloor') {
      config = { ...config, tableCapacityLimit: 0, code: 'PISTA', isPublicSelectable: false };
    } else if (category === 'entrance') {
      config = { ...config, tableCapacityLimit: 0, code: 'ENTRADA', isPublicSelectable: false };
    } else if (category === 'exit') {
      config = { ...config, tableCapacityLimit: 0, code: 'SALIDA', isPublicSelectable: false };
    }

    try {
      const created = await apiClient.post<any>(
        `/layouts/${layoutId}/tables`,
        config,
        { token: session.accessToken, isBearer: true }
      );
      setTables(prev => [...prev, {
        id: created.id,
        layoutTableId: created.id,
        code: created.code,
        capacity: created.tableCapacityLimit,
        occupiedSpots: 0,
        availableSpots: created.tableCapacityLimit,
        positionJson: created.positionJson,
        status: 'AVAILABLE'
      } as MapTable]);
    } catch (err) {
      console.error("Error creando objeto", err);
      alert("Error al crear el objeto");
    }
  };

  const handleTableMove = async (table: MapTable, x: number, y: number) => {
    if (!layoutId || !session) return;
    
    // Update local immediately for responsiveness
    const tId = table.id || table.layoutTableId;
    setTables(prev => prev.map(t => {
      const id = t.id || t.layoutTableId;
      if (id === tId) {
        return { ...t, positionJson: { ...((t.positionJson as any) || {}), x, y } };
      }
      return t;
    }));

    try {
      await apiClient.patch(
        `/layouts/${layoutId}/tables/${tId}`,
        { positionJson: { x, y } },
        { token: session.accessToken, isBearer: true }
      );
    } catch (err) {
      console.error("Error guardando posición", err);
    }
  };

  const handleBulkUpdate = async (updates: { table: MapTable; x: number; y: number }[]) => {
    if (!layoutId || !session) return;
    
    // Update local immediately
    setTables(prev => {
      const newTables = [...prev];
      updates.forEach(upd => {
        const uId = upd.table.id || upd.table.layoutTableId;
        const idx = newTables.findIndex(t => (t.id || t.layoutTableId) === uId);
        if (idx !== -1) {
          newTables[idx] = { ...newTables[idx], positionJson: { ...((newTables[idx].positionJson as any) || {}), x: upd.x, y: upd.y } };
        }
      });
      return newTables;
    });

    for (const upd of updates) {
      const uId = upd.table.id || upd.table.layoutTableId;
      try {
        await apiClient.patch(
          `/layouts/${layoutId}/tables/${uId}`,
          { positionJson: { x: upd.x, y: upd.y } },
          { token: session.accessToken, isBearer: true }
        );
      } catch (err) {
        console.error("Error actualizando en BD", err);
      }
    }
  };

  const deleteSelectedTable = async (table: MapTable) => {
    if (!layoutId || !session) return;
    const tId = table.id || table.layoutTableId;
    
    if (!window.confirm(`¿Estás seguro de que deseas eliminar ${table.code}?`)) return;

    try {
      await apiClient.delete(
        `/layouts/${layoutId}/tables/${tId}`,
        { token: session.accessToken, isBearer: true }
      );
      setTables(prev => prev.filter(t => (t.id || t.layoutTableId) !== tId));
    } catch (err) {
      console.error("Error eliminando objeto", err);
      alert("Error eliminando el objeto");
    }
  };

  const handleTableClick = (table: MapTable) => {
    if (!previewMode) {
      const action = window.prompt(`Mesa/Objeto: ${table.code}\nOpciones:\nEscribe 'D' para eliminar.\nEscribe un nuevo nombre para cambiarlo.`);
      if (action === 'D' || action === 'd') {
        deleteSelectedTable(table);
      } else if (action && action.trim().length > 0) {
        renameTable(table, action.trim());
      }
    }
  };

  const renameTable = async (table: MapTable, newCode: string) => {
    if (!layoutId || !session) return;
    const tId = table.id || table.layoutTableId;
    try {
      await apiClient.patch(
        `/layouts/${layoutId}/tables/${tId}`,
        { code: newCode },
        { token: session.accessToken, isBearer: true }
      );
      setTables(prev => prev.map(t => {
        if ((t.id || t.layoutTableId) === tId) return { ...t, code: newCode };
        return t;
      }));
    } catch (err) {
      console.error("Error renombrando objeto", err);
    }
  };

  if (!session) return null;

  return (
    <div className="animate-slide-up" style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 1rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px' }}>
        <button onClick={() => navigate(`/staff/dashboard`)} style={{ background: 'transparent', border: 'none', color: 'var(--text-primary)', cursor: 'pointer' }}>
          <ArrowLeft size={24} />
        </button>
        <div style={{ flex: 1 }}>
          <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
            <LayoutTemplate size={28} />
            Editor de Distrución de Mesas
          </h2>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', alignItems: 'flex-start' }}>
        <div style={{ flex: '1 1 700px' }}>
          <GlassCard style={{ padding: '0', overflow: 'hidden', minHeight: '600px', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '16px', borderBottom: '1px solid var(--border-light)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(0,0,0,0.1)' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.2rem' }}>Plano y Distribución</h3>
                <p style={{ margin: '4px 0 0', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                  {previewMode ? 'Modo de visualización de usuario final.' : 'Arrastra mesas, alinea, renombra dando click e invéntate la mejor experiencia.'}
                </p>
              </div>
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                <button 
                  onClick={() => setPreviewMode(!previewMode)}
                  style={{
                    padding: '8px 12px',
                    borderRadius: 'var(--radius-md)',
                    border: `1px solid ${previewMode ? 'var(--accent-primary)' : 'var(--border-focus)'}`,
                    background: previewMode ? 'rgba(57,255,20,0.1)' : 'transparent',
                    color: previewMode ? 'var(--accent-primary)' : 'var(--text-primary)',
                    fontSize: '0.85rem',
                    fontWeight: 'bold',
                    cursor: 'pointer'
                  }}
                >
                  {previewMode ? 'VISTA COMPRADOR' : 'PROBAR VISTA COMPRADOR'}
                </button>
              </div>
            </div>

            <div style={{ flex: 1, padding: '16px', position: 'relative' }}>
              {loading ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)' }}>Cargando Plano...</div>
              ) : !layoutId ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)' }}>No hay layout configurado para el evento.</div>
              ) : (
                <EventMap 
                  tables={tables}
                  isAdmin={!previewMode}
                  onTableMove={handleTableMove}
                  onBulkUpdate={handleBulkUpdate}
                  onTableClick={handleTableClick}
                />
              )}
            </div>
          </GlassCard>
        </div>

        <div style={{ flex: '0 0 320px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {!previewMode && (
            <GlassCard>
              <h3 style={{ marginTop: 0, marginBottom: '16px' }}>Herramientas de Edición</h3>
              
              <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Da click aquí para añadir un objeto:</label>
              <select 
                onChange={(e) => { addLayoutObject(e.target.value); e.target.value = ''; }}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: 'var(--radius-md)',
                  background: 'rgba(0,0,0,0.2)',
                  border: '1px solid var(--border-light)',
                  color: 'white',
                  outline: 'none',
                  cursor: 'pointer',
                  marginBottom: '10px'
                }}
                defaultValue=""
              >
                <option value="" disabled>+ Añadir Objeto al Plano</option>
                <option value="table">Mesa Reservable (10 cupos)</option>
                <option value="stage">Tarima / Escenario</option>
                <option value="dancefloor">Pista de Baile</option>
                <option value="entrance">Puerta de Entrada</option>
                <option value="exit">Salida de Emergencia</option>
              </select>

              <div style={{ background: 'rgba(59, 130, 246, 0.1)', padding: '12px', borderRadius: 'var(--radius-md)', fontSize: '0.85rem', border: '1px solid rgba(59, 130, 246, 0.3)', marginTop: '20px', color: '#93C5FD' }}>
                <strong style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><Info size={16} /> Instucciones de Edición</strong>
                <p style={{ margin: '8px 0 0' }}>Puedes hacer click en una mesa para <strong>eliminarla</strong> o <strong>renombrarla</strong>. Para mover o distribuir múltiples mesas, arrastra tu mouse sobre un área vacía y sombreadlo para seleccionar todas, luego presiona los botones de las herramientas arriba.</p>
              </div>
            </GlassCard>
          )}

          <GlassCard>
             <h3 style={{ marginTop: 0, marginBottom: '20px' }}>Resumen del Plano</h3>
             <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '12px' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)' }}><Users size={16}/> Capacidad Total</span>
                <span style={{ fontWeight: 'bold' }}>{tables.filter(t => !['TARIMA', 'PISTA', 'ENTRADA', 'SALIDA'].includes((t.code || '').toUpperCase())).reduce((s, t) => s + (t.capacity || 0), 0)}</span>
             </div>
             
             <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                  <div style={{ width: 14, height: 14, borderRadius: '50%', background: 'rgba(34, 197, 94, 0.35)', border: '2px solid rgba(34, 197, 94, 1)' }}></div>
                  Mesa Disponible
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                  <div style={{ width: 14, height: 14, borderRadius: '50%', background: 'rgba(234, 179, 8, 0.35)', border: '2px solid rgba(234, 179, 8, 1)' }}></div>
                  Mesa Parcialmente Ocupada
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                  <div style={{ width: 14, height: 14, borderRadius: '50%', background: 'rgba(239, 68, 68, 0.35)', border: '2px solid rgba(239, 68, 68, 1)' }}></div>
                  Mesa Llena / Ocupada
                </div>
             </div>
          </GlassCard>
        </div>
      </div>
    </div>
  );
};
