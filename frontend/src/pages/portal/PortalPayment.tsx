import { useState, useRef } from 'react';
import { useAuthPortal } from '../../contexts/AuthContext';
import { GlassCard } from '../../components/ui/GlassCard';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { apiClient } from '../../api/client';
import { uploadPaymentEvidence } from '../../api/storage';
import { isFirebaseConfigured } from '../../firebase';
import {
  ArrowLeft,
  Upload,
  FileCheck2,
  CheckCircle,
  Banknote,
  CreditCard,
  Info,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

type PaymentType = 'DIGITAL' | 'CASH';

const EVIDENCE_STORAGE = (
  (import.meta as unknown as { env?: Record<string, string> })?.env
    ?.VITE_EVIDENCE_STORAGE || 'firebase'
).toLowerCase();

const EVIDENCE_MAX_MB = Number(
  (import.meta as unknown as { env?: Record<string, string> })?.env
    ?.VITE_EVIDENCE_MAX_MB || '5',
);

interface UploadResult {
  fileUrl: string;
  storagePath?: string;
  fileName?: string;
  sizeBytes?: number;
  mimeType: string;
}

export const PortalPayment = () => {
  const { session } = useAuthPortal();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [step, setStep] = useState(1);
  const [paymentType, setPaymentType] = useState<PaymentType>('DIGITAL');
  const [ticketQuantity, setTicketQuantity] = useState(1);
  const [paymentId, setPaymentId] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const TICKET_PRICE = 50_000; // COP

  const handleCreatePayment = async () => {
    if (!session) return;
    setLoading(true);
    setError('');
    try {
      const res = await apiClient.post<{ id: string; status: string }>(
        `/groups/${session.groupId}/payments`,
        {
          paymentType,
          ticketQuantity,
          amountCents: ticketQuantity * TICKET_PRICE * 100,
          currency: 'COP',
        },
        { token: session.sessionToken, isBearer: true },
      );
      setPaymentId(res.id);

      if (paymentType === 'CASH') {
        setStep(3); // cash flows skip the upload step
      } else {
        setStep(2);
      }
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : 'No se pudo crear el pago. Verifica que hayas registrado asistentes.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > EVIDENCE_MAX_MB * 1024 * 1024) {
      setError(`El archivo supera el máximo permitido (${EVIDENCE_MAX_MB} MB).`);
      return;
    }
    setError('');
    setSelectedFile(file);
    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (ev) => setFilePreview(ev.target?.result as string);
      reader.readAsDataURL(file);
    } else {
      setFilePreview(null);
    }
  };

  const uploadEvidence = async (file: File): Promise<UploadResult> => {
    if (!session) throw new Error('Sin sesión');
    const mimeType = file.type || 'application/octet-stream';

    if (EVIDENCE_STORAGE === 'firebase') {
      if (!isFirebaseConfigured) {
        throw new Error(
          'Firebase Storage no está configurado. Contacta al comité para habilitarlo.',
        );
      }
      const up = await uploadPaymentEvidence({
        file,
        eventId: session.eventId,
        groupId: session.groupId,
        paymentId,
      });
      return {
        fileUrl: up.downloadURL,
        storagePath: up.storagePath,
        fileName: up.fileName,
        sizeBytes: up.sizeBytes,
        mimeType: up.contentType,
      };
    }

    if (EVIDENCE_STORAGE === 'signed') {
      const res = await apiClient.post<{ uploadUrl: string }>(
        `/payments/${paymentId}/evidence-upload-url`,
        {},
        { token: session.sessionToken, isBearer: true },
      );
      const putRes = await fetch(res.uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': mimeType },
        body: file,
      });
      if (!putRes.ok) {
        throw new Error(`Subida fallida (status ${putRes.status})`);
      }
      return {
        fileUrl: res.uploadUrl.split('?')[0] || res.uploadUrl,
        fileName: file.name,
        sizeBytes: file.size,
        mimeType,
      };
    }

    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (ev) => resolve(ev.target?.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
    return {
      fileUrl: dataUrl,
      fileName: file.name,
      sizeBytes: file.size,
      mimeType,
    };
  };

  const handleSubmitEvidence = async () => {
    if (!session) return;
    if (!selectedFile) {
      setError('Debes seleccionar un archivo antes de continuar.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const uploaded = await uploadEvidence(selectedFile);

      await apiClient.post(
        `/payments/${paymentId}/evidence`,
        {
          fileUrl: uploaded.fileUrl,
          mimeType: uploaded.mimeType,
          evidenceType: 'RECEIPT',
          storagePath: uploaded.storagePath,
          fileName: uploaded.fileName,
          sizeBytes: uploaded.sizeBytes,
        },
        { token: session.sessionToken, isBearer: true },
      );

      await apiClient.post(
        `/payments/${paymentId}/submit`,
        {},
        { token: session.sessionToken, isBearer: true },
      );

      setStep(3);
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : 'Error enviando pago a revisión';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  if (!session) return null;

  return (
    <div className="animate-slide-up" style={{ maxWidth: '600px', margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px' }}>
        <button
          onClick={() => navigate(`/portal/${session.eventId}/dashboard`)}
          style={{ background: 'transparent', border: 'none', color: 'var(--text-primary)', cursor: 'pointer' }}
        >
          <ArrowLeft size={24} />
        </button>
        <h2 style={{ margin: 0 }}>Registro de Pago</h2>
      </div>

      <div style={{ display: 'flex', gap: '8px', marginBottom: '28px', alignItems: 'center' }}>
        {[1, 2, 3].map((n) => (
          <div key={n} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 'bold',
                fontSize: '0.875rem',
                background:
                  step > n ? 'var(--success)' : step === n ? 'var(--accent-primary)' : 'var(--border-light)',
                color: step >= n ? '#000' : 'var(--text-muted)',
              }}
            >
              {step > n ? <CheckCircle size={18} /> : n}
            </div>
            {n < 3 && (
              <div
                style={{
                  flex: 1,
                  height: '2px',
                  width: '48px',
                  background: step > n ? 'var(--accent-primary)' : 'var(--border-light)',
                }}
              />
            )}
          </div>
        ))}
        <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginLeft: '8px' }}>
          {step === 1
            ? 'Datos del pago'
            : step === 2
              ? 'Comprobante'
              : paymentType === 'CASH'
                ? 'Pago en efectivo'
                : 'Enviado'}
        </span>
      </div>

      {error && (
        <GlassCard style={{ marginBottom: '16px', borderLeft: '3px solid var(--error)', padding: '12px 16px' }}>
          <span style={{ color: 'var(--error)' }}>{error}</span>
        </GlassCard>
      )}

      {step === 1 && (
        <GlassCard>
          <h3 style={{ marginTop: 0 }}>Paso 1: ¿Cómo quieres pagar?</h3>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', margin: '16px 0 24px' }}>
            <button
              type="button"
              onClick={() => setPaymentType('DIGITAL')}
              style={{
                padding: '16px',
                borderRadius: 'var(--radius-md)',
                border: `2px solid ${paymentType === 'DIGITAL' ? 'var(--accent-primary)' : 'var(--border-light)'}`,
                background: paymentType === 'DIGITAL' ? 'rgba(57,255,20,0.1)' : 'transparent',
                color: 'var(--text-primary)',
                cursor: 'pointer',
                textAlign: 'left',
              }}
            >
              <CreditCard size={20} style={{ marginBottom: '6px' }} />
              <div style={{ fontWeight: 600 }}>Transferencia</div>
              <small style={{ color: 'var(--text-secondary)' }}>Sube comprobante digital</small>
            </button>

            <button
              type="button"
              onClick={() => setPaymentType('CASH')}
              style={{
                padding: '16px',
                borderRadius: 'var(--radius-md)',
                border: `2px solid ${paymentType === 'CASH' ? 'var(--accent-primary)' : 'var(--border-light)'}`,
                background: paymentType === 'CASH' ? 'rgba(57,255,20,0.1)' : 'transparent',
                color: 'var(--text-primary)',
                cursor: 'pointer',
                textAlign: 'left',
              }}
            >
              <Banknote size={20} style={{ marginBottom: '6px' }} />
              <div style={{ fontWeight: 600 }}>Efectivo</div>
              <small style={{ color: 'var(--text-secondary)' }}>Paga en caja; el comité registra el recibo</small>
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <Input
              label="Cantidad de boletas"
              type="number"
              min="1"
              max="10"
              value={ticketQuantity}
              onChange={(e) => setTicketQuantity(parseInt(e.target.value) || 1)}
            />

            <div
              className="glass-panel"
              style={{
                padding: '16px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <span>Total a pagar:</span>
              <strong style={{ fontSize: '1.25rem', color: 'var(--accent-primary)' }}>
                ${(ticketQuantity * TICKET_PRICE).toLocaleString('es-CO')} COP
              </strong>
            </div>

            {paymentType === 'DIGITAL' ? (
              <div
                className="glass-panel"
                style={{ padding: '16px', fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}
              >
                <strong style={{ color: 'var(--text-primary)' }}>Datos bancarios:</strong>
                <br />
                Banco: Bancolombia — Cuenta Ahorros 123-456789-00
                <br />
                Titular: Comité de Grado 2026
                <br />
                Referencia: Tu código de estudiante
              </div>
            ) : (
              <div
                className="glass-panel"
                style={{
                  padding: '16px',
                  fontSize: '0.9rem',
                  color: 'var(--text-secondary)',
                  lineHeight: 1.6,
                  display: 'flex',
                  gap: '12px',
                  alignItems: 'flex-start',
                }}
              >
                <Info size={20} color="var(--accent-primary)" style={{ flexShrink: 0, marginTop: '2px' }} />
                <div>
                  Al elegir efectivo, dirígete a la ventanilla del comité. La foto del recibo de caja será
                  registrada por el comité; tu pago pasa directamente a revisión.
                </div>
              </div>
            )}

            <Button onClick={handleCreatePayment} isLoading={loading}>
              {paymentType === 'CASH' ? 'Registrar intención y continuar' : 'Continuar al comprobante →'}
            </Button>
          </div>
        </GlassCard>
      )}

      {step === 2 && paymentType === 'DIGITAL' && (
        <GlassCard className="animate-slide-up">
          <h3 style={{ marginTop: 0 }}>Paso 2: Sube tu comprobante</h3>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '24px' }}>
            Adjunta el pantallazo o PDF de la transferencia (máx. {EVIDENCE_MAX_MB} MB).
          </p>

          <div
            onClick={() => fileInputRef.current?.click()}
            style={{
              border: `2px dashed ${selectedFile ? 'var(--accent-primary)' : 'var(--border-light)'}`,
              borderRadius: 'var(--radius-md)',
              padding: '40px',
              textAlign: 'center',
              marginBottom: '24px',
              cursor: 'pointer',
            }}
          >
            {filePreview ? (
              <img
                src={filePreview}
                alt="Preview"
                style={{ maxHeight: '200px', borderRadius: '8px', objectFit: 'contain' }}
              />
            ) : (
              <>
                <Upload
                  size={48}
                  style={{
                    color: selectedFile ? 'var(--accent-primary)' : 'var(--text-muted)',
                    marginBottom: '16px',
                  }}
                />
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
              {selectedFile.name} ({(selectedFile.size / 1024).toFixed(0)} KB)
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
              Enviar pago a revisión
            </Button>
          </div>
        </GlassCard>
      )}

      {step === 3 && (
        <GlassCard
          className="animate-slide-up"
          style={{ textAlign: 'center', padding: '48px 20px' }}
        >
          <FileCheck2 size={72} style={{ color: 'var(--success)', margin: '0 auto 24px' }} />
          <h3 style={{ margin: '0 0 12px' }}>
            {paymentType === 'CASH' ? 'Pago en efectivo registrado' : '¡Pago enviado!'}
          </h3>
          <p
            style={{
              color: 'var(--text-secondary)',
              maxWidth: '360px',
              margin: '0 auto 32px',
              lineHeight: 1.6,
            }}
          >
            {paymentType === 'CASH'
              ? 'Dirígete a la ventanilla del comité para completar el pago. Una vez registrada la evidencia en caja y aprobada, podrás seleccionar tu mesa.'
              : 'Tu comprobante fue enviado al comité. Una vez aprobado, recibirás acceso para elegir tu mesa.'}
          </p>
          <Button variant="secondary" onClick={() => navigate(`/portal/${session.eventId}/dashboard`)}>
            Volver al resumen
          </Button>
        </GlassCard>
      )}
    </div>
  );
};
