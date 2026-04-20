import { useState } from 'react';
import { GlassCard } from '../ui/GlassCard';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { apiClient } from '../../api/client';
import type { WizardState } from '../../pages/staff/StaffEventWizard';
import { Calendar, Rocket } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface Props {
  wizardData: WizardState;
  onPrev: () => void;
  sessionToken: string;
}

export const EventConfigStep = ({ wizardData, onPrev, sessionToken }: Props) => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  
  // Event & Configuration state unified
  const [formData, setFormData] = useState({
      eventName: '',
      presaleStart: '',
      presaleEnd: '',
      saleStart: '',
      saleEnd: '',
      eventDate: '',
      maxPresale: 4,
      maxSale: 3
  });

  const handleFinish = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      // 1. Create Event linking Venue
       const resEvent = await apiClient.post<any>('/events', {
           tenantId: wizardData.tenantId,
           venueId: wizardData.venueId,
           name: formData.eventName,
           eventDate: new Date(formData.eventDate || new Date()).toISOString(),
           startsAt: formData.presaleStart ? new Date(formData.presaleStart).toISOString() : undefined,
           endsAt: formData.saleEnd ? new Date(formData.saleEnd).toISOString() : undefined,
           venueNameSnapshot: wizardData.venueName
       }, { token: sessionToken, isBearer: true });
       
       const newEventId = resEvent.id || 'new-event-mock';

      // 2. Bind Layout
       await apiClient.post(`/events/${newEventId}/layout-binding`, {
           layoutId: wizardData.layoutId,
           layoutVersion: 1
       }, { token: sessionToken, isBearer: true });

      // 3. Put configurations (§4.2.1 uses PUT, includes venue/event date fields)
       await apiClient.put(`/events/${newEventId}/configuration`, {
          presaleStartDate: formData.presaleStart ? new Date(formData.presaleStart).toISOString() : new Date().toISOString(),
          presaleEndDate: formData.presaleEnd ? new Date(formData.presaleEnd).toISOString() : new Date().toISOString(),
          saleStartDate: formData.saleStart ? new Date(formData.saleStart).toISOString() : new Date().toISOString(),
          saleEndDate: formData.saleEnd ? new Date(formData.saleEnd).toISOString() : new Date().toISOString(),
          maxPresaleTickets: formData.maxPresale,
          maxSaleTickets: formData.maxSale,
          timezone: "America/Bogota",
          mapVisibilityPolicy: "AFTER_PAYMENT_APPROVED",
          eventDate: formData.eventDate ? new Date(formData.eventDate).toISOString() : undefined,
          venueName: wizardData.venueName || undefined,
       }, { token: sessionToken, isBearer: true });

       alert('¡Evento creado, publicado y configurado exitosamente!');
       navigate('/staff/dashboard');

    } catch (err: any) {
       console.error("Event creation error:", err);
       alert(`Error creando el Evento: ${err?.message || JSON.stringify(err)}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="animate-slide-up">
      <h3 style={{ marginBottom: '8px' }}>Paso 3: Comerciales y Publicación</h3>
      <p style={{ color: 'var(--text-secondary)', marginBottom: '24px' }}>
         Establece las fechas de las etapas de venta. Has escogido el salón <strong>{wizardData.venueName}</strong> y Layout <strong>{wizardData.layoutName}</strong>.
      </p>

      <form onSubmit={handleFinish}>
        <GlassCard style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Calendar color="var(--accent-primary)"/> <h4>Datos del Evento</h4>
            </div>

            <Input required label="Nombre del Evento a Publicar" placeholder="Ej. Grado Promoción 11° - 2026" value={formData.eventName} onChange={e=>setFormData({...formData, eventName: e.target.value})} />

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
                
                {/* Fechas */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <h5 style={{ color: 'var(--text-secondary)', margin: '0' }}>Cronograma</h5>
                    <Input required type="datetime-local" label="Apertura Preventa" value={formData.presaleStart} onChange={e=>setFormData({...formData, presaleStart: e.target.value})} />
                    <Input required type="datetime-local" label="Cierre Preventa" value={formData.presaleEnd} onChange={e=>setFormData({...formData, presaleEnd: e.target.value})} />
                    <Input required type="datetime-local" label="Apertura Venta Libre" value={formData.saleStart} onChange={e=>setFormData({...formData, saleStart: e.target.value})} />
                    <Input required type="datetime-local" label="Cierre Venta Libre" value={formData.saleEnd} onChange={e=>setFormData({...formData, saleEnd: e.target.value})} />
                    <Input required type="datetime-local" label="Fecha del Evento en Físico" value={formData.eventDate} onChange={e=>setFormData({...formData, eventDate: e.target.value})} />
                </div>

                {/* Topes Comerciales */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <h5 style={{ color: 'var(--text-secondary)', margin: '0' }}>Restricciones Comerciales</h5>
                    <Input required type="number" min="1" max="10" label="Boletas permitidas por estudiante en Preventa" value={formData.maxPresale} onChange={e=>setFormData({...formData, maxPresale: parseInt(e.target.value)||4})} />
                    <Input required type="number" min="1" max="10" label="Boletas permitidas por estudiante en Venta Normal" value={formData.maxSale} onChange={e=>setFormData({...formData, maxSale: parseInt(e.target.value)||3})} />
                    
                    <div className="glass-panel" style={{ padding: '16px', marginTop: 'auto', background: 'rgba(var(--accent-primary-rgb), 0.1)' }}>
                        <p style={{ margin: 0, fontSize: '0.85rem' }}>Al dar click en crear, la aplicación emitirá las instrucciones necesarias al Backend. El evento aparecerá inmediatamente en tu panel de Staff.</p>
                    </div>
                </div>

            </div>

        </GlassCard>

        <div style={{ marginTop: '24px', display: 'flex', justifyContent: 'space-between' }}>
            <Button type="button" variant="outline" onClick={onPrev}>Volver</Button>
            <Button type="submit" isLoading={loading} icon={Rocket}>Crear Evento Oficial</Button>
        </div>
      </form>
    </div>
  );
};
