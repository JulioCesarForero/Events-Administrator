import { useState, useEffect } from 'react';
import { GlassCard } from '../ui/GlassCard';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { apiClient } from '../../api/client';
import type { WizardState } from '../../pages/staff/StaffEventWizard';
import { LayoutGrid, Plus } from 'lucide-react';

interface Props {
  wizardData: WizardState;
  setWizardData: (data: WizardState) => void;
  onNext: () => void;
  onPrev: () => void;
  sessionToken: string;
}

export const LayoutStep = ({ wizardData, setWizardData, onNext, onPrev, sessionToken }: Props) => {
  const [layouts, setLayouts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<'list' | 'create'>('list');
  
  // Create properties
  const [newName, setNewName] = useState('');
  const [tableCount, setTableCount] = useState(15);
  const [cupsPerTable, setCupsPerTable] = useState(10);

  useEffect(() => {
    if(wizardData.venueId) {
      loadLayouts();
    }
  }, [wizardData.venueId]);

  const loadLayouts = async () => {
    try {
      const res = await apiClient.get<any>(`/venues/${wizardData.venueId}/layouts`, { token: sessionToken, isBearer: true });
      setLayouts(Array.isArray(res) ? res : (res as any)?.items || []);
    } catch {
      setLayouts([]); // No hay layouts mock, incitando a crear
    }
  };

  const handleSelect = (l: any) => {
    setWizardData({ ...wizardData, layoutId: l.id, layoutName: l.name });
    onNext();
  };

  const handleCreateAndGenerate = async () => {
    if(!newName) return;
    setLoading(true);
    try {
      // 1. Create Layout
      const layoutRes = await apiClient.post<any>(`/venues/${wizardData.venueId}/layouts`, { name: newName, status: "DRAFT" }, { token: sessionToken, isBearer: true });
      const createdLayoutId = layoutRes.id || 'lay_mock';

      // 2. Utilidad background gen para "n" mesas (El api real exige enviarlas una a una, lo simulamos para no romper el backend)
      // En un endpoint masivo óptimo tendríamos un /bulk, pero usamos loop controlado
      const tablePromises = [];
      for(let i = 1; i <= tableCount; i++){
         tablePromises.push(
            apiClient.post(`/layouts/${createdLayoutId}/tables`, {
                code: `M${i}`,
                capacity: cupsPerTable,
                position: { x: (i%5)*80, y: Math.floor(i/5)*80, rotationDeg: 0 }
            }, { token: sessionToken, isBearer: true }).catch(() => null)
         );
      }
      
      await Promise.all(tablePromises);

      setWizardData({ ...wizardData, layoutId: createdLayoutId, layoutName: newName });
      onNext();
    } catch (err: any) {
      alert(`Error creando Layout/Mesas: ${err?.message || 'Revisa consola'}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="animate-slide-up">
      <h3 style={{ marginBottom: '8px' }}>Paso 2: Plano del Salón (Layout)</h3>
      <p style={{ color: 'var(--text-secondary)', marginBottom: '24px' }}>
         Salón seleccionado: <strong>{wizardData.venueName}</strong>. Especifica el plano o genera uno autocalculado.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(300px, 1fr) 2fr', gap: '24px', alignItems: 'start' }}>
        
        {/* Lado A: Selección Existente */}
        <GlassCard style={{ opacity: mode === 'list' ? 1 : 0.6, transition: '0.3s' }} onClick={() => setMode('list')}>
          <h4>Planos Anteriores</h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '16px' }}>
            {layouts.length === 0 ? <p style={{color: 'var(--text-secondary)', fontSize: '0.9rem'}}>No hay Planos definidos para este salón.</p> : null}
            {layouts.map(l => (
              <div 
                 key={l.id} 
                 className="glass-panel glass-panel-hover"
                 onClick={() => mode === 'list' && handleSelect(l)}
                 style={{ padding: '16px', display: 'flex', alignItems: 'center', gap: '16px', cursor: mode === 'list' ? 'pointer' : 'default'  }}
              >
                 <LayoutGrid color="var(--accent-primary)"/>
                 <strong>{l.name}</strong>
              </div>
            ))}
          </div>
        </GlassCard>

        {/* Lado B: Creación */}
        <GlassCard style={{ opacity: mode === 'create' ? 1 : 0.6, transition: '0.3s' }} onClick={() => mode !== 'create' && setMode('create')}>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '16px' }}>
            <Plus color="var(--accent-primary)"/> <h4>Nuevo Layout (Auto-Mesas)</h4>
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', pointerEvents: mode === 'create' ? 'auto' : 'none' }}>
             <Input label="Nombre del Layout" placeholder="Ej. Acomodación Gala" value={newName} onChange={e=>setNewName(e.target.value)} />
             
             <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
               <Input label="Cantidad de Mesas Total" type="number" min="1" max="100" value={tableCount} onChange={e=>setTableCount(parseInt(e.target.value)||1)} />
               <Input label="Cupos x Mesa (Capacidad)" type="number" min="2" max="25" value={cupsPerTable} onChange={e=>setCupsPerTable(parseInt(e.target.value)||2)} />
             </div>
             
             <div className="glass-panel" style={{ padding: '16px', fontSize: '0.85rem' }}>
                Tu Evento tendrá <strong>{tableCount * cupsPerTable} cupos</strong> reservables distribuidos uniformemente.
             </div>

             {mode === 'create' && (
               <Button onClick={handleCreateAndGenerate} isLoading={loading} style={{ marginTop: '8px' }}>Crear y Generar Distribución</Button>
             )}
          </div>
        </GlassCard>

      </div>
      
      <div style={{ marginTop: '24px' }}>
        <Button variant="outline" onClick={onPrev}>Volver</Button>
      </div>
    </div>
  );
};
