import { useState, useEffect } from 'react';
import { GlassCard } from '../ui/GlassCard';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { apiClient } from '../../api/client';
import type { WizardState } from '../../pages/staff/StaffEventWizard';
import { MapPin, Plus } from 'lucide-react';

interface Props {
  wizardData: WizardState;
  setWizardData: (data: WizardState) => void;
  onNext: () => void;
  sessionToken: string;
}

export const VenueStep = ({ wizardData, setWizardData, onNext, sessionToken }: Props) => {
  const [venues, setVenues] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<'list' | 'create'>('list');
  
  // Create state
  const [newVenue, setNewVenue] = useState({ name: '', address: '', lat: '', lon: '' });

  useEffect(() => {
    if (wizardData.tenantId) {
      loadVenues();
    }
  }, [wizardData.tenantId]);

  const loadVenues = async () => {
    try {
      const res = await apiClient.get<any>(`/venues?tenant_id=${wizardData.tenantId}`, { token: sessionToken, isBearer: true });
      setVenues(Array.isArray(res) ? res : res?.items || []);
    } catch {
      setVenues([]);
    }
  };

  const handleSelect = (v: any) => {
    setWizardData({ ...wizardData, venueId: v.id, venueName: v.name });
    onNext();
  };

  const handleCreate = async () => {
    if(!newVenue.name || !newVenue.address) return;
    setLoading(true);
    try {
      const payload = {
        tenantId: wizardData.tenantId,
        name: newVenue.name,
        address: newVenue.address,
        defaultTimezone: "America/Bogota"
      };
      const res = await apiClient.post<any>('/venues', payload, { token: sessionToken, isBearer: true });
      setWizardData({ ...wizardData, venueId: res.id, venueName: res.name || newVenue.name });
      onNext();
    } catch (err: any) {
      alert(`Error creando Salón: ${err?.message || 'Revisa consola'}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="animate-slide-up">
      <h3 style={{ marginBottom: '8px' }}>Paso 1: Salón del Evento</h3>
      <p style={{ color: 'var(--text-secondary)', marginBottom: '24px' }}>El evento debe estar alojado en un salón. Selecciona uno existente o crea uno nuevo.</p>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', alignItems: 'start' }}>
        
        {/* Lado A: Selección Existente */}
        <GlassCard style={{ opacity: mode === 'list' ? 1 : 0.6, transition: '0.3s' }} onClick={() => setMode('list')}>
          <h4>Salones Existentes</h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '16px' }}>
            {venues.length === 0 ? <p style={{color: 'var(--text-secondary)'}}>No hay salones.</p> : null}
            {venues.map(v => (
              <div 
                 key={v.id} 
                 className="glass-panel glass-panel-hover"
                 onClick={() => mode === 'list' && handleSelect(v)}
                 style={{ padding: '16px', display: 'flex', alignItems: 'center', gap: '16px', cursor: mode === 'list' ? 'pointer' : 'default' , border: wizardData.venueId === v.id ? '1px solid var(--accent-primary)' : ''}}
              >
                 <MapPin color="var(--accent-primary)"/>
                 <div>
                    <strong>{v.name}</strong>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{v.address}</div>
                 </div>
              </div>
            ))}
          </div>
        </GlassCard>

        {/* Lado B: Creación */}
        <GlassCard style={{ opacity: mode === 'create' ? 1 : 0.6, transition: '0.3s' }} onClick={() => mode !== 'create' && setMode('create')}>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '16px' }}>
            <Plus color="var(--accent-primary)"/> <h4>Crear Nuevo Salón</h4>
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', pointerEvents: mode === 'create' ? 'auto' : 'none' }}>
             <Input label="Nombre del Establecimiento" value={newVenue.name} onChange={e=>setNewVenue({...newVenue, name: e.target.value})} placeholder="Ej. Hotel Tequendama"/>
             <Input label="Dirección / Localidad" value={newVenue.address} onChange={e=>setNewVenue({...newVenue, address: e.target.value})} />
             <div style={{ display: 'flex', gap: '16px' }}>
               <Input label="Latitud" type="number" step="0.0001" value={newVenue.lat} onChange={e=>setNewVenue({...newVenue, lat: e.target.value})} />
               <Input label="Longitud" type="number" step="0.0001" value={newVenue.lon} onChange={e=>setNewVenue({...newVenue, lon: e.target.value})} />
             </div>
             
             {mode === 'create' && (
               <Button onClick={handleCreate} isLoading={loading} style={{ marginTop: '8px' }}>Guardar y Continuar</Button>
             )}
          </div>
        </GlassCard>

      </div>
    </div>
  );
};
