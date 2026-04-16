import { useState, useRef } from 'react';
import { useAuthPortal } from '../../contexts/AuthContext';
import { GlassCard } from '../../components/ui/GlassCard';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { apiClient } from '../../api/client';
import { ArrowLeft, Upload, FileCheck2, CheckCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export const PortalPayment = () => {
  const { session } = useAuthPortal();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(1);
  const [ticketQuantity, setTicketQuantity] = useState(1);
  const [paymentId, setPaymentId] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const TICKET_PRICE = 50_000; // COP

  // ── PASO 1: Crear pago (DRAFT) ──────────────────────────────────────────────
  const handleCreatePayment = async () => {
    setLoading(true);
    try {
      const res = await apiClient.post<any>(`/groups/${session?.groupId}/payments`, {
        paymentType: 'DIGITAL',
        ticketQuantity,
        amountCents: ticketQuantity * TICKET_PRICE * 100,
        currency: 'COP'
      }, { token: session?.sessionToken, isBearer: true });

      setPaymentId(res.id);
      setStep(2);
    } catch (err: any) {
      alert(`Error creando pago:\n${err?.message || 'Verifica que hayas registrado participantes y que la taquilla esté abierta.'}`);
    } finally {
      setLoading(false);
    }
  };

  // ── Selección de archivo ────────────────────────────────────────────────────
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSelectedFile(file);

    // Preview image
    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = ev => setFilePreview(ev.target?.result as string);
      reader.readAsDataURL(file);
    } else {
      setFilePreview(null);
    }
  };

  // ── PASO 2: Registrar evidencia y enviar a revisión ─────────────────────────
  const handleSubmitEvidence = async () => {
    if (!selectedFile) {
      alert('Debes seleccionar un archivo antes de continuar.');
      return;
    }
    setLoading(true);
    try {
      // Convertir archivo a base64 data-URL para entornos sin CDN
      const fileUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = ev => resolve(ev.target?.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(selectedFile);
      });

      // 1. Registrar la evidencia en el backend
      await apiClient.post(`/payments/${paymentId}/evidence`, {
        fileUrl,
        mimeType: selectedFile.type,
        evidenceType: 'RECEIPT'
      }, { token: session?.sessionToken, isBearer: true });

      // 2. Enviar el pago a revisión del comité
      await apiClient.post(`/payments/${paymentId}/submit`, {}, { token: session?.sessionToken, isBearer: true });

      setStep(3);
    } catch (err: any) {
      alert(`Error enviando pago:\n${err?.message || 'Desconocido'}`);
    } finally {
      setLoading(false);
    }
  };

  if (!session) return null;

  return (
    <div className="animate-slide-up" style={{ maxWidth: '600px', margin: '0 auto' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px' }}>
        <button onClick={() => navigate(`/portal/${session.eventId}/dashboard`)} style={{ background: 'transparent', border: 'none', color: 'var(--text-primary)', cursor: 'pointer' }}>
          <ArrowLeft size={24} />
        </button>
        <h2 style={{ margin: 0 }}>Registro de Pago</h2>
      </div>

      {/* Indicador pasos */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '28px', alignItems: 'center' }}>
        {[1, 2, 3].map(n => (
          <div key={n} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{
              width: '32px', height: '32px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontWeight: 'bold', fontSize: '0.875rem',
              background: step > n ? 'var(--success)' : step === n ? 'var(--accent-primary)' : 'var(--border-light)',
              color: step >= n ? '#000' : 'var(--text-muted)',
              transition: 'all 0.3s'
            }}>{step > n ? <CheckCircle size={18} /> : n}</div>
            {n < 3 && <div style={{ flex: 1, height: '2px', width: '48px', background: step > n ? 'var(--accent-primary)' : 'var(--border-light)', transition: 'background 0.3s' }} />}
          </div>
        ))}
        <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginLeft: '8px' }}>
          {step === 1 ? 'Datos del Pago' : step === 2 ? 'Comprobante' : 'Enviado'}
        </span>
      </div>

      {/* PASO 1 */}
      {step === 1 && (
        <GlassCard>
          <h3 style={{ marginTop: 0 }}>Paso 1: Datos de la Transferencia</h3>
          <p style={{ color: 'var(--text-secondary)' }}>Selecciona cuántos cupos vas a pagar.</p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', marginTop: '24px' }}>
            <Input
              label="Cantidad de boletas"
              type="number"
              min="1" max="10"
              value={ticketQuantity}
              onChange={e => setTicketQuantity(parseInt(e.target.value) || 1)}
            />

            <div className="glass-panel" style={{ padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Total a transferir:</span>
              <strong style={{ fontSize: '1.25rem', color: 'var(--accent-primary)' }}>
                ${(ticketQuantity * TICKET_PRICE).toLocaleString('es-CO')} COP
              </strong>
            </div>

            <div className="glass-panel" style={{ padding: '16px', borderRadius: 'var(--radius-md)', fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              <strong style={{ color: 'var(--text-primary)' }}>Datos bancarios para transferencia:</strong><br />
              Banco: Bancolombia — Cuenta Ahorros 123-456789-00<br />
              Titular: Comité de Grado 2026<br />
              Referencia: Tu código de estudiante
            </div>

            <Button onClick={handleCreatePayment} isLoading={loading}>
              Continuar al Comprobante →
            </Button>
          </div>
        </GlassCard>
      )}

      {/* PASO 2 */}
      {step === 2 && (
        <GlassCard className="animate-slide-up">
          <h3 style={{ marginTop: 0 }}>Paso 2: Subir Comprobante</h3>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '24px' }}>
            Sube el pantallazo o PDF de tu transferencia bancaria.
          </p>

          <div
            onClick={() => fileInputRef.current?.click()}
            style={{
              border: `2px dashed ${selectedFile ? 'var(--accent-primary)' : 'var(--border-light)'}`,
              borderRadius: 'var(--radius-md)', padding: '40px', textAlign: 'center',
              marginBottom: '24px', cursor: 'pointer', transition: 'border-color 0.2s'
            }}
          >
            {filePreview ? (
              <img src={filePreview} alt="Preview" style={{ maxHeight: '200px', borderRadius: '8px', objectFit: 'contain' }} />
            ) : (
              <>
                <Upload size={48} style={{ color: selectedFile ? 'var(--accent-primary)' : 'var(--text-muted)', marginBottom: '16px' }} />
                <p style={{ margin: 0, color: 'var(--text-secondary)' }}>
                  {selectedFile ? selectedFile.name : 'Haz clic para elegir imagen o PDF'}
                </p>
              </>
            )}
          </div>

          <input
            type="file"
            accept="image/*,.pdf"
            ref={fileInputRef}
            onChange={handleFileSelect}
            style={{ display: 'none' }}
          />

          {selectedFile && !filePreview && (
            <p style={{ color: 'var(--accent-primary)', marginBottom: '16px', fontSize: '0.9rem' }}>
              📎 {selectedFile.name} ({(selectedFile.size / 1024).toFixed(0)} KB)
            </p>
          )}

          <div style={{ display: 'flex', gap: '12px' }}>
            <Button variant="secondary" onClick={() => setStep(1)} style={{ flex: 1 }}>
              ← Volver
            </Button>
            <Button
              onClick={handleSubmitEvidence}
              isLoading={loading}
              disabled={!selectedFile}
              style={{ flex: 2 }}
            >
              Enviar Pago a Revisión
            </Button>
          </div>
        </GlassCard>
      )}

      {/* PASO 3 */}
      {step === 3 && (
        <GlassCard className="animate-slide-up" style={{ textAlign: 'center', padding: '48px 20px' }}>
          <FileCheck2 size={72} style={{ color: 'var(--success)', margin: '0 auto 24px' }} />
          <h3 style={{ margin: '0 0 12px' }}>¡Pago Enviado!</h3>
          <p style={{ color: 'var(--text-secondary)', maxWidth: '360px', margin: '0 auto 32px', lineHeight: 1.6 }}>
            Tu comprobante fue enviado al comité. Una vez aprobado recibirás acceso para elegir tu mesa.
          </p>
          <Button variant="secondary" onClick={() => navigate(`/portal/${session.eventId}/dashboard`)}>
            Volver al Resumen
          </Button>
        </GlassCard>
      )}

    </div>
  );
};
