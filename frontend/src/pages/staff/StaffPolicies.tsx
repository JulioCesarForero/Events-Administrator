import { useState } from 'react';
import { useAuthStaff } from '../../contexts/AuthContext';
import { GlassCard } from '../../components/ui/GlassCard';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { apiClient } from '../../api/client';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Save } from 'lucide-react';

export const StaffPolicies = () => {
  const { session } = useAuthStaff();
  const { eventId } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [policyData, setPolicyData] = useState({
    title: 'Política de Tratamiento de Datos',
    versionLabel: 'v1.0',
    contentMarkdown: ''
  });

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      // 1. Create document draft
      const res = await apiClient.post<any>(`/events/${eventId}/legal-documents`, {
        documentType: 'DATA_POLICY',
        title: policyData.title,
        versionLabel: policyData.versionLabel,
        contentMarkdown: policyData.contentMarkdown
      }, { token: session?.accessToken, isBearer: true });
      
      // 2. Publish it
      await apiClient.post(`/legal-documents/${res.id}/publish`, {}, { token: session?.accessToken, isBearer: true });
      
      alert('Política publicada correctamente');
      navigate('/staff/dashboard');
    } catch (err) {
      alert('Error publicando política (o endpoint mock no disponible)');
    } finally {
      setLoading(false);
    }
  };

  if (!session) return null;

  return (
    <div className="animate-fade-in" style={{ maxWidth: '800px', margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px' }}>
        <button onClick={() => navigate('/staff/dashboard')} style={{ background: 'transparent', border: 'none', color: 'var(--text-primary)', cursor: 'pointer' }}>
          <ArrowLeft size={24} />
        </button>
        <h2 style={{ margin: 0 }}>Políticas Legales del Evento</h2>
      </div>

      <GlassCard>
        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ display: 'flex', gap: '16px' }}>
             <div style={{ flex: 2 }}>
                <Input label="Título" required value={policyData.title} onChange={e => setPolicyData({...policyData, title: e.target.value})} />
             </div>
             <div style={{ flex: 1 }}>
                <Input label="Versión" required value={policyData.versionLabel} onChange={e => setPolicyData({...policyData, versionLabel: e.target.value})} />
             </div>
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <label style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-secondary)' }}>Contenido (Markdown)</label>
            <textarea 
              className="glass-input" 
              style={{ minHeight: '200px', resize: 'vertical' }}
              value={policyData.contentMarkdown} 
              onChange={e => setPolicyData({...policyData, contentMarkdown: e.target.value})}
              placeholder="Escribe los términos y condiciones aquí..."
              required
            />
          </div>

          <Button type="submit" isLoading={loading} icon={Save} style={{ alignSelf: 'flex-end', marginTop: '16px' }}>
            Publicar Política
          </Button>
        </form>
      </GlassCard>
    </div>
  );
};
