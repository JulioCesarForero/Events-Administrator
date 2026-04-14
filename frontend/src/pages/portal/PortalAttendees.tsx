import { useState, useEffect } from 'react';
import { useAuthPortal } from '../../contexts/AuthContext';
import { GlassCard } from '../../components/ui/GlassCard';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { apiClient } from '../../api/client';
import { UserPlus, Trash2, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export const PortalAttendees = () => {
  const { session } = useAuthPortal();
  const navigate = useNavigate();
  const [attendees, setAttendees] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    documentType: 'CC',
    documentId: '',
    isVegetarian: false,
    allergies: '',
    mobilePhone: '',
    emergencyContactName: '',
    emergencyContactPhone: '',
    hasReducedMobility: false
  });

  const loadAttendees = async () => {
    if (!session) return;
    try {
      const res = await apiClient.get<any[]>(`/groups/${session.groupId}/participants`, { token: session.sessionToken, isBearer: true });
      setAttendees(res || []);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    loadAttendees();
  }, [session]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await apiClient.post(`/groups/${session?.groupId}/participants`, formData, { token: session?.sessionToken, isBearer: true });
      setShowForm(false);
      loadAttendees();
    } catch (err) {
      alert('Error guardando participante');
    } finally {
      setLoading(false);
    }
  };

  if (!session) return null;

  return (
    <div className="animate-slide-up" style={{ maxWidth: '800px', margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px' }}>
        <button onClick={() => navigate(`/portal/${session.eventId}/dashboard`)} style={{ background: 'transparent', border: 'none', color: 'var(--text-primary)', cursor: 'pointer' }}>
          <ArrowLeft size={24} />
        </button>
        <h2 style={{ margin: 0 }}>Gestión de Asistentes</h2>
      </div>

      {!showForm ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {attendees.map((att, idx) => (
            <GlassCard key={att.id || idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h4 style={{ margin: 0 }}>{att.firstName} {att.lastName}</h4>
                <p style={{ margin: '4px 0 0', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                  {att.documentType} {att.documentId}
                </p>
              </div>
              <Button variant="ghost" size="sm" icon={Trash2} />
            </GlassCard>
          ))}

          <Button icon={UserPlus} onClick={() => setShowForm(true)} style={{ marginTop: '16px' }}>
            Añadir Asistente
          </Button>
        </div>
      ) : (
        <GlassCard>
          <h3>Nuevo Asistente</h3>
          <form style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '20px' }} onSubmit={handleAdd}>
            <div style={{ display: 'flex', gap: '16px' }}>
              <Input label="Nombres" required value={formData.firstName} onChange={e => setFormData({...formData, firstName: e.target.value})} />
              <Input label="Apellidos" required value={formData.lastName} onChange={e => setFormData({...formData, lastName: e.target.value})} />
            </div>
            <div style={{ display: 'flex', gap: '16px' }}>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <label style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-secondary)' }}>Tipo Doc.</label>
                <select className="glass-input" value={formData.documentType} onChange={e => setFormData({...formData, documentType: e.target.value})}>
                  <option value="CC">Cédula (CC)</option>
                  <option value="TI">Tarjeta Identidad (TI)</option>
                  <option value="CE">Cédula Extranjería (CE)</option>
                </select>
              </div>
              <Input label="Documento" required type="number" value={formData.documentId} onChange={e => setFormData({...formData, documentId: e.target.value})} />
            </div>
            
            <Input label="Celular" required type="tel" value={formData.mobilePhone} onChange={e => setFormData({...formData, mobilePhone: e.target.value})} />
            
            <div style={{ display: 'flex', gap: '16px' }}>
               <Input label="Contacto Emergencia" required value={formData.emergencyContactName} onChange={e => setFormData({...formData, emergencyContactName: e.target.value})} />
               <Input label="Teléfono Emergencia" required type="tel" value={formData.emergencyContactPhone} onChange={e => setFormData({...formData, emergencyContactPhone: e.target.value})} />
            </div>

            <div style={{ display: 'flex', gap: '20px', margin: '16px 0' }}>
               <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                  <input type="checkbox" checked={formData.isVegetarian} onChange={e => setFormData({...formData, isVegetarian: e.target.checked})} />
                  Vegetariano
               </label>
               <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                  <input type="checkbox" checked={formData.hasReducedMobility} onChange={e => setFormData({...formData, hasReducedMobility: e.target.checked})} />
                  Movilidad Reducida
               </label>
            </div>

            {formData.isVegetarian && (
               <Input label="Alergias Alimentarias" value={formData.allergies} onChange={e => setFormData({...formData, allergies: e.target.value})} />
            )}

            <div style={{ display: 'flex', gap: '16px', marginTop: '16px' }}>
              <Button type="button" variant="secondary" onClick={() => setShowForm(false)}>Cancelar</Button>
              <Button type="submit" isLoading={loading}>Guardar Asistente</Button>
            </div>
          </form>
        </GlassCard>
      )}
    </div>
  );
};
