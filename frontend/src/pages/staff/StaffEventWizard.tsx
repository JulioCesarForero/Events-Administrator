import { useState, useEffect } from 'react';
import { useAuthStaff } from '../../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { apiClient } from '../../api/client';
import { VenueStep } from '../../components/staff/VenueStep';
import { LayoutStep } from '../../components/staff/LayoutStep';
import { EventConfigStep } from '../../components/staff/EventConfigStep';

export interface WizardState {
  venueId: string;
  venueName: string;
  layoutId: string;
  layoutName: string;
  tenantId?: string;
}

export const StaffEventWizard = () => {
  const { session, setSession } = useAuthStaff();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [wizardData, setWizardData] = useState<WizardState>({
    venueId: '',
    venueName: '',
    layoutId: '',
    layoutName: '',
    tenantId: session?.tenantId || ''
  });

  useEffect(() => {
    if (session && !session.tenantId) {
      apiClient.get<any>('/auth/me', { token: session.accessToken, isBearer: true })
        .then(res => {
          const tId = res.memberships?.[0]?.tenantId || '';
          setSession({ ...session, tenantId: tId });
          setWizardData(prev => ({ ...prev, tenantId: tId }));
        }).catch(console.error);
    }
  }, [session, setSession]);

  const nextStep = () => setStep(s => s + 1);
  const prevStep = () => setStep(s => Math.max(1, s - 1));

  if (!session) return null;

  return (
    <div className="animate-fade-in" style={{ maxWidth: '900px', margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px' }}>
        <button onClick={() => navigate('/staff/dashboard')} style={{ background: 'transparent', border: 'none', color: 'var(--text-primary)', cursor: 'pointer' }}>
          <ArrowLeft size={24} />
        </button>
        <h2 style={{ margin: 0 }}>Crear Nuevo Evento</h2>
      </div>

      <div style={{ display: 'flex', gap: '8px', marginBottom: '24px' }}>
        {[1, 2, 3].map(st => (
          <div key={st} style={{ flex: 1, height: '6px', borderRadius: '3px', background: step >= st ? 'var(--accent-primary)' : 'var(--border-light)' }} />
        ))}
      </div>

      {step === 1 && <VenueStep wizardData={wizardData} setWizardData={setWizardData} onNext={nextStep} sessionToken={session.accessToken} />}
      {step === 2 && <LayoutStep wizardData={wizardData} setWizardData={setWizardData} onNext={nextStep} onPrev={prevStep} sessionToken={session.accessToken} />}
      {step === 3 && <EventConfigStep wizardData={wizardData} onPrev={prevStep} sessionToken={session.accessToken} />}
    </div>
  );
};
