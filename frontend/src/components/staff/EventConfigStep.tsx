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
  const [formError, setFormError] = useState<string | null>(null);
  
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

  const toIsoOrNull = (value: string): string | null => {
    if (!value || !value.trim()) return null;
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return null;
    return parsed.toISOString();
  };

  const handleFinish = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setLoading(true);
    
    try {
      const eventDateIso = toIsoOrNull(formData.eventDate);
      const presaleStartIso = toIsoOrNull(formData.presaleStart);
      const presaleEndIso = toIsoOrNull(formData.presaleEnd);
      const saleStartIso = toIsoOrNull(formData.saleStart);
      const saleEndIso = toIsoOrNull(formData.saleEnd);

      if (!eventDateIso || !presaleStartIso || !presaleEndIso || !saleStartIso || !saleEndIso) {
        throw new Error('Hay fechas inválidas en el formulario. Revisa el cronograma e intenta de nuevo.');
      }

      // 1. Create Event linking Venue
       const resEvent = await apiClient.post<any>('/events', {
           tenantId: wizardData.tenantId,
           venueId: wizardData.venueId,
           name: formData.eventName,
           eventDate: eventDateIso,
           startsAt: presaleStartIso,
           endsAt: saleEndIso,
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
          presaleStartDate: presaleStartIso,
          presaleEndDate: presaleEndIso,
          saleStartDate: saleStartIso,
          saleEndDate: saleEndIso,
          maxPresaleTickets: formData.maxPresale,
          maxSaleTickets: formData.maxSale,
          timezone: "America/Bogota",
          mapVisibilityPolicy: "AFTER_PAYMENT_APPROVED",
          eventDate: eventDateIso,
          venueName: wizardData.venueName || undefined,
       }, { token: sessionToken, isBearer: true });

       // Remove the alert and navigation, we'll handle this in the UI
       setSuccessEventId(newEventId);
    } catch (err: any) {
       console.error("Event creation error:", err);
       setFormError(err?.message || 'No fue posible crear el evento.');
    } finally {
      setLoading(false);
    }
  };

  const [successEventId, setSuccessEventId] = useState<string | null>(null);

  if (successEventId) {
    return (
      <div className="animate-slide-up" style={{ textAlign: 'center', padding: '40px 20px' }}>
         <Rocket size={48} color="var(--success)" style={{ margin: '0 auto 20px' }} />
         <h2>¡Evento Creado y Publicado!</h2>
         <p style={{ color: 'var(--text-secondary)', marginBottom: '32px' }}>
           El salón fue enlazado exitosamente con mesas base autogeneradas.
           Ahora puedes proceder a personalizar la distribución de mesas, añadir tarimas, pistas de baile y más.
         </p>
         <div style={{ display: 'flex', gap: '16px', justifyContent: 'center' }}>
           <Button variant="outline" onClick={() => navigate('/staff/dashboard')}>Ir al Dashboard</Button>
           <Button onClick={() => navigate(`/staff/events/${successEventId}/map`)}>Distribuir Mesas Ahora →</Button>
         </div>
      </div>
    );
  }

  return (
    <div className="animate-slide-up">
      <h3 style={{ marginBottom: '8px' }}>Paso 3: Comerciales y Publicación</h3>
      <p style={{ color: 'var(--text-secondary)', marginBottom: '24px' }}>
         Establece las fechas de las etapas de venta. Has escogido el salón <strong>{wizardData.venueName}</strong> y Layout <strong>{wizardData.layoutName}</strong>.
      </p>
      {formError && (
        <div className="glass-panel" style={{ marginBottom: '16px', border: '1px solid var(--error)', color: 'var(--error)', padding: '12px 16px' }}>
          {formError}
        </div>
      )}

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
