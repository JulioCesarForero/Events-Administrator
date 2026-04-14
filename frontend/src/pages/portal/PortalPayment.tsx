import { useState } from 'react';
import { useAuthPortal } from '../../contexts/AuthContext';
import { GlassCard } from '../../components/ui/GlassCard';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { apiClient } from '../../api/client';
import { ArrowLeft, Upload, FileCheck2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export const PortalPayment = () => {
  const { session } = useAuthPortal();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(1);
  const [paymentData, setPaymentData] = useState({
    ticketQuantity: 1,
    amountCents: 0,
    paymentType: 'DIGITAL',
    currency: 'COP'
  });
  const [paymentId, setPaymentId] = useState('');

  const TICKET_PRICE = 50000;

  const handleCreatePayment = async () => {
    setLoading(true);
    try {
      const payload = {
        ...paymentData,
        amountCents: paymentData.ticketQuantity * TICKET_PRICE * 100 // Example
      };
      const res = await apiClient.post<any>(`/groups/${session?.groupId}/payments`, payload, { token: session?.sessionToken, isBearer: true });
      setPaymentId(res.id);
      setStep(2);
    } catch (err) {
      alert('Error creando pago');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitReview = async () => {
    setLoading(true);
    try {
      // Typically, wait for file upload, here we simulate and submit
      await apiClient.post(`/payments/${paymentId}/submit`, {}, { token: session?.sessionToken, isBearer: true });
      setStep(3);
    } catch (err) {
      alert('Error enviando a revisión');
    } finally {
      setLoading(false);
    }
  };

  if (!session) return null;

  return (
    <div className="animate-slide-up" style={{ maxWidth: '600px', margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px' }}>
        <button onClick={() => navigate(`/portal/${session.eventId}/dashboard`)} style={{ background: 'transparent', border: 'none', color: 'var(--text-primary)', cursor: 'pointer' }}>
          <ArrowLeft size={24} />
        </button>
        <h2 style={{ margin: 0 }}>Registro de Pago</h2>
      </div>

      {step === 1 && (
        <GlassCard>
          <h3>Paso 1: Datos de la Transferencia</h3>
          <p style={{ color: 'var(--text-secondary)' }}>Selecciona cuántos cupos vas a pagar</p>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', marginTop: '24px' }}>
            <Input 
              label="Cantidad de boletas" 
              type="number" 
              min="1" max="10"
              value={paymentData.ticketQuantity}
              onChange={e => setPaymentData({ ...paymentData, ticketQuantity: parseInt(e.target.value) || 1 })}
            />
            
            <div className="glass-panel" style={{ padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Total a transferir:</span>
              <strong style={{ fontSize: '1.25rem', color: 'var(--accent-primary)' }}>
                ${(paymentData.ticketQuantity * TICKET_PRICE).toLocaleString()} COP
              </strong>
            </div>

            <Button onClick={handleCreatePayment} isLoading={loading}>Continuar al Comprobante</Button>
          </div>
        </GlassCard>
      )}

      {step === 2 && (
        <GlassCard className="animate-slide-up">
          <h3>Paso 2: Subir Comprobante</h3>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '24px' }}>Sube el pantallazo de tu pago digital.</p>
          
          <div style={{ border: '2px dashed var(--border-light)', borderRadius: 'var(--radius-md)', padding: '40px', textAlign: 'center', marginBottom: '24px' }}>
            <Upload size={48} style={{ color: 'var(--text-muted)', marginBottom: '16px' }} />
            <p>Haz clic para subir tu imagen o PDF</p>
            <input type="file" style={{ display: 'none' }} id="file-upload" />
            <Button variant="secondary" style={{ marginTop: '16px' }} onClick={() => document.getElementById('file-upload')?.click()}>
              Seleccionar Archivo
            </Button>
          </div>

          <Button onClick={handleSubmitReview} isLoading={loading} style={{ width: '100%' }}>
            Enviar Pago a Revisión
          </Button>
        </GlassCard>
      )}

      {step === 3 && (
        <GlassCard className="animate-slide-up" style={{ textAlign: 'center', padding: '40px 20px' }}>
          <FileCheck2 size={64} style={{ color: 'var(--success)', margin: '0 auto 20px' }} />
          <h3>Pago en Revisión</h3>
          <p style={{ color: 'var(--text-secondary)' }}>
            El comité revisará tu pago pronto. Una vez aprobado, podrás elegir tu mesa.
          </p>
          <Button variant="secondary" onClick={() => navigate(`/portal/${session.eventId}/dashboard`)} style={{ marginTop: '24px' }}>
            Volver al Resumen
          </Button>
        </GlassCard>
      )}
    </div>
  );
};
