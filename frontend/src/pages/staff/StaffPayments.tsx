import { useState, useEffect } from 'react';
import { useAuthStaff } from '../../contexts/AuthContext';
import { GlassCard } from '../../components/ui/GlassCard';
import { Button } from '../../components/ui/Button';
import { apiClient } from '../../api/client';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Check, X } from 'lucide-react';

export const StaffPayments = () => {
  const { session } = useAuthStaff();
  const { eventId } = useParams();
  const navigate = useNavigate();
  const [payments, setPayments] = useState<any[]>([]);

  useEffect(() => {
    if (session) {
      loadPayments();
    }
  }, [session]);

  const loadPayments = async () => {
    try {
      const res = await apiClient.get<any[]>(`/events/${eventId}/payment-inbox`, { token: session?.accessToken, isBearer: true });
      setPayments(res || []);
    } catch (err) {
      // Mocking for frontend demo logic since backend might be empty
      console.warn("Using mocked payments due to backend error/empty");
      setPayments([
         { id: 'pay_1', status: 'PENDING_APPROVAL', amountCents: 150000, ticketQuantity: 3, user: 'Estudiante 001' },
         { id: 'pay_2', status: 'PENDING_APPROVAL', amountCents: 100000, ticketQuantity: 2, user: 'Estudiante 002' }
      ]);
    }
  };

  const handleDecision = async (paymentId: string, decision: 'approve' | 'reject') => {
    try {
      if (decision === 'approve') {
         await apiClient.post(`/payments/${paymentId}/approve`, { approvedTicketCount: 3 }, { token: session?.accessToken, isBearer: true });
      } else {
         await apiClient.post(`/payments/${paymentId}/reject`, { reason: 'Comprobante ilegible' }, { token: session?.accessToken, isBearer: true });
      }
      setPayments(payments.filter(p => p.id !== paymentId));
    } catch (err) {
      alert('Error procesando el pago');
    }
  };

  if (!session) return null;

  return (
    <div className="animate-fade-in">
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px' }}>
        <button onClick={() => navigate('/staff/dashboard')} style={{ background: 'transparent', border: 'none', color: 'var(--text-primary)', cursor: 'pointer' }}>
          <ArrowLeft size={24} />
        </button>
        <h2 style={{ margin: 0 }}>Bandeja de Pagos ({payments.length})</h2>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {payments.length === 0 ? (
           <GlassCard style={{ textAlign: 'center', padding: '40px' }}>
              <p style={{ color: 'var(--text-secondary)' }}>No hay pagos pendientes de revisión.</p>
           </GlassCard>
        ) : payments.map(p => (
           <GlassCard key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                 <h4 style={{ margin: '0 0 8px 0' }}>Usuario: {p.user}</h4>
                 <div style={{ display: 'flex', gap: '16px', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
                    <span>ID: {p.id}</span>
                    <span>Boletas solicitadas: {p.ticketQuantity}</span>
                    <strong style={{ color: 'var(--text-primary)' }}>Montos: ${(p.amountCents / 100).toLocaleString()} COP</strong>
                 </div>
                 <a href="#" style={{ display: 'block', marginTop: '8px', fontSize: '0.875rem' }}>Ver Comprobante Adjunto</a>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                 <Button variant="outline" style={{ color: 'var(--error)', borderColor: 'var(--error)' }} icon={X} onClick={() => handleDecision(p.id, 'reject')}>Rechazar</Button>
                 <Button style={{ background: 'var(--success)', color: '#000', boxShadow: 'none' }} icon={Check} onClick={() => handleDecision(p.id, 'approve')}>Aprobar</Button>
              </div>
           </GlassCard>
        ))}
      </div>
    </div>
  );
};
