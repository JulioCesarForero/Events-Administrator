import { useState, useEffect, useRef } from 'react';
import { useAuthStaff } from '../../contexts/AuthContext';
import { GlassCard } from '../../components/ui/GlassCard';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { apiClient } from '../../api/client';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, UploadCloud, Edit2, Trash2, Plus, Search } from 'lucide-react';

type StudentOut = {
  id: string;
  studentCode: string;
  firstName: string;
  lastName: string;
  isActive: boolean;
};

export const StaffStudents = () => {
  const { session } = useAuthStaff();
  const { eventId } = useParams();
  const navigate = useNavigate();

  // Data State
  const [students, setStudents] = useState<StudentOut[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');

  // Modal States
  const [showImportModal, setShowImportModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<StudentOut | null>(null);

  // Edit / Form State
  const [formData, setFormData] = useState({ studentCode: '', firstName: '', lastName: '' });

  // Import State
  const [fileToUpload, setFileToUpload] = useState<File | null>(null);
  const [parsedRows, setParsedRows] = useState<any[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (session && eventId) {
      loadStudents();
    }
  }, [session, eventId, search]);

  const loadStudents = async () => {
    setLoading(true);
    try {
      // Usamos el endpoint backend descubierto
      const res = await apiClient.get<any>(`/events/${eventId}/students?limit=200&search=${encodeURIComponent(search)}`, { 
        token: session?.accessToken, 
        isBearer: true 
      });
      setStudents(res.items || []);
    } catch (err) {
      console.error('Error fetching students:', err);
      // Fallback vacio en caso de falla momentanea
      setStudents([]);
    } finally {
      setLoading(false);
    }
  };

  // --- CRUD Actions ---

  const handleDelete = async (id: string) => {
    if (!window.confirm('¿Seguro que deseas eliminar este estudiante? Es una acción irreversible.')) return;
    try {
      await apiClient.delete(`/events/${eventId}/students/${id}`, { token: session?.accessToken, isBearer: true });
      setStudents(prev => prev.filter(s => s.id !== id));
    } catch (err: any) {
      alert(`Error eliminando registro: ${err?.message || 'Desconocido'}`);
    }
  };

  const handleOpenCreate = () => {
    setSelectedStudent(null);
    setFormData({ studentCode: '', firstName: '', lastName: '' });
    setShowEditModal(true);
  };

  const handleOpenEdit = (student: StudentOut) => {
    setSelectedStudent(student);
    setFormData({ studentCode: student.studentCode, firstName: student.firstName, lastName: student.lastName });
    setShowEditModal(true);
  };

  const handleSaveStudent = async () => {
    try {
      if (selectedStudent) {
        // Edit Existing (PATCH)
        const updated = await apiClient.patch<StudentOut>(`/events/${eventId}/students/${selectedStudent.id}`, {
          studentCode: formData.studentCode,
          firstName: formData.firstName,
          lastName: formData.lastName
        }, { token: session?.accessToken, isBearer: true });
        
        setStudents(prev => prev.map(s => s.id === updated.id ? updated : s));
      } else {
        // Create New (via bulk api endpoint with 1 row)
        await apiClient.post(`/events/${eventId}/student-imports`, {
          fileName: 'manual_entry.csv',
          expectedColumns: ['codigo_unico', 'apellidos', 'nombres'],
          rows: [{ studentCode: formData.studentCode, firstName: formData.firstName, lastName: formData.lastName }]
        }, { token: session?.accessToken, isBearer: true });
        
        // Reload list to get the new id
        loadStudents();
      }
      setShowEditModal(false);
    } catch (err: any) {
      alert(`Error guardando estudiante: ${err?.message || 'Revisa conexión'}`);
    }
  };

  // --- Mass Import Logic ---
  
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileToUpload(file);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const cleanText = text.replace(/\r/g, ''); 
      const lines = cleanText.split('\n').filter(l => l.trim().length > 0);
      if (lines.length === 0) return;
      const delimiter = lines[0].includes(';') ? ';' : ',';
      const headers = lines[0].toLowerCase().split(delimiter).map(h => h.trim());
      
      const rows = lines.slice(1).map(line => {
        const cols = line.split(delimiter).map(c => c.trim());
        const rowData: any = {};
        headers.forEach((h, i) => { rowData[h] = cols[i]; });
        return {
           studentCode: rowData['codigo_unico'] || '',
           lastName: rowData['apellidos'] || '',
           firstName: rowData['nombres'] || 'Sin Nombre',
        };
      }).filter(r => r.studentCode);
      
      if (rows.length === 0) {
        alert(`No se detectaron datos. Verifica cabeceras y separador "${delimiter}".`);
      }
      setParsedRows(rows);
    };
    reader.readAsText(file);
  };

  const handleImportSubmit = async () => {
    setLoading(true);
    try {
      await apiClient.post(`/events/${eventId}/student-imports`, {
        fileName: fileToUpload?.name || 'padron.csv',
        expectedColumns: ['codigo_unico', 'apellidos', 'nombres'],
        rows: parsedRows
      }, { token: session?.accessToken, isBearer: true });
      setShowImportModal(false);
      loadStudents(); // Recargar grid
      alert('Importación realizada exitosamente');
    } catch (err: any) {
      alert(`Error en importación masiva: ${err?.message || ''}`);
    } finally {
      setLoading(false);
    }
  };

  if (!session) return null;

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '24px', position: 'relative' }}>
      
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <button onClick={() => navigate('/staff/dashboard')} style={{ background: 'transparent', border: 'none', color: 'var(--text-primary)', cursor: 'pointer' }}>
            <ArrowLeft size={24} />
          </button>
          <h2 style={{ margin: 0 }}>Directorio de Estudiantes</h2>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <Button variant="secondary" onClick={() => setShowImportModal(true)}>
            <UploadCloud size={18} style={{ marginRight: '8px' }} />
            Carga Masiva (CSV)
          </Button>
          <Button onClick={handleOpenCreate}>
            <Plus size={18} style={{ marginRight: '8px' }} />
            Añadir Estudiante
          </Button>
        </div>
      </div>

      <GlassCard style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', background: 'rgba(255,255,255,0.03)', borderRadius: 'var(--radius-md)', padding: '0 12px', border: '1px solid var(--border-light)' }}>
           <Search size={20} style={{ color: 'var(--text-muted)' }} />
           <input 
             type="text" 
             placeholder="Buscar por código, nombres o apellidos..." 
             value={search}
             onChange={(e) => setSearch(e.target.value)}
             style={{ 
               flex: 1, border: 'none', background: 'transparent', color: 'var(--text-primary)',
               padding: '12px', outline: 'none'
             }} 
           />
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-light)', color: 'var(--text-secondary)' }}>
                <th style={{ padding: '12px 16px', fontWeight: 'normal' }}>CÓDIGO ÚNICO</th>
                <th style={{ padding: '12px 16px', fontWeight: 'normal' }}>NOMBRES</th>
                <th style={{ padding: '12px 16px', fontWeight: 'normal' }}>APELLIDOS</th>
                <th style={{ padding: '12px 16px', fontWeight: 'normal', textAlign: 'right' }}>ACCIONES</th>
              </tr>
            </thead>
            <tbody>
              {students.length === 0 && !loading && (
                <tr>
                  <td colSpan={4} style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)' }}>
                    No hay estudiantes registrados.
                  </td>
                </tr>
              )}
              {loading && students.length === 0 && (
                <tr><td colSpan={4} style={{ textAlign: 'center', padding: '32px' }}>Cargando...</td></tr>
              )}
              {students.map(std => (
                <tr key={std.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                  <td style={{ padding: '12px 16px' }}>{std.studentCode}</td>
                  <td style={{ padding: '12px 16px' }}>{std.firstName}</td>
                  <td style={{ padding: '12px 16px' }}>{std.lastName}</td>
                  <td style={{ padding: '12px 16px', textAlign: 'right', display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                    <button onClick={() => handleOpenEdit(std)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--accent-primary)' }} title="Editar">
                      <Edit2 size={18} />
                    </button>
                    <button onClick={() => handleDelete(std.id)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#ff4d4d' }} title="Eliminar">
                      <Trash2 size={18} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </GlassCard>

      {/* MODAL PARA EDICION/CREACION INDIVIDUAL */}
      {showEditModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
          <GlassCard style={{ width: '100%', maxWidth: '400px', padding: '24px' }}>
            <h3 style={{ marginTop: 0, marginBottom: '24px' }}>{selectedStudent ? 'Editar Estudiante' : 'Añadir Estudiante'}</h3>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <Input label="Código Único" value={formData.studentCode} onChange={e => setFormData({...formData, studentCode: e.target.value})} />
              <Input label="Nombres" value={formData.firstName} onChange={e => setFormData({...formData, firstName: e.target.value})} />
              <Input label="Apellidos" value={formData.lastName} onChange={e => setFormData({...formData, lastName: e.target.value})} />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '32px' }}>
              <Button variant="secondary" onClick={() => setShowEditModal(false)}>Cancelar</Button>
              <Button onClick={handleSaveStudent} disabled={!formData.studentCode || !formData.firstName}>
                Guardar
              </Button>
            </div>
          </GlassCard>
        </div>
      )}

      {/* MODAL PARA CARGA MASIVA */}
      {showImportModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
          <GlassCard style={{ width: '100%', maxWidth: '500px', padding: '24px' }}>
            <h3 style={{ marginTop: 0, marginBottom: '16px' }}>Importación Masiva de Estudiantes</h3>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '24px', fontSize: '0.9rem' }}>
              Sube el archivo CSV con las columnas <code style={{color:'var(--accent-primary)'}}>codigo_unico</code>, <code style={{color:'var(--accent-primary)'}}>apellidos</code>, y <code style={{color:'var(--accent-primary)'}}>nombres</code>.
            </p>

            <div style={{ border: '2px dashed var(--border-light)', borderRadius: 'var(--radius-md)', padding: '32px', textAlign: 'center', marginBottom: '24px' }}>
              <UploadCloud size={32} style={{ color: 'var(--text-muted)', marginBottom: '16px' }} />
              <p style={{ margin: 0, marginBottom: '16px' }}>Haz clic para elegir tu archivo CSV</p>
              <input type="file" accept=".csv" ref={fileInputRef} onChange={handleFileChange} style={{ display: 'none' }} />
              <Button variant="secondary" size="sm" onClick={() => fileInputRef.current?.click()}>
                {fileToUpload ? fileToUpload.name : 'Seleccionar Archivo'}
              </Button>
              {parsedRows.length > 0 && (
                <p style={{ color: 'var(--accent-primary)', marginTop: '12px', fontSize: '0.85rem' }}>
                  A procesar: {parsedRows.length} estudiantes.
                </p>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <Button variant="secondary" onClick={() => { setShowImportModal(false); setFileToUpload(null); setParsedRows([]); }}>
                Cancelar
              </Button>
              <Button onClick={handleImportSubmit} disabled={!fileToUpload || parsedRows.length === 0} isLoading={loading}>
                Importar
              </Button>
            </div>
          </GlassCard>
        </div>
      )}

    </div>
  );
};
