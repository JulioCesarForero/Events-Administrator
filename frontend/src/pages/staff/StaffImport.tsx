import { useState, useRef } from 'react';
import { useAuthStaff } from '../../contexts/AuthContext';
import { GlassCard } from '../../components/ui/GlassCard';
import { Button } from '../../components/ui/Button';
import { apiClient } from '../../api/client';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, UploadCloud } from 'lucide-react';

export const StaffImport = () => {
  const { session } = useAuthStaff();
  const { eventId } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [fileToUpload, setFileToUpload] = useState<File | null>(null);
  const [parsedRows, setParsedRows] = useState<any[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileToUpload(file);

    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const cleanText = text.replace(/\r/g, ''); // Fix Windows CR
      const lines = cleanText.split('\n').filter(l => l.trim().length > 0);
      if (lines.length === 0) return;
      
      // Detect separator (commas or semicolons frequently used by ES Excel)
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
      }).filter(r => r.studentCode); // Se ignora si no hay codigo as it's required
      
      if (rows.length === 0) {
        alert(`No se detectaron estudiantes válidos. Verifica que las cabeceras sean exactamente (codigo_unico, apellidos, nombres) separadas por "${delimiter}".`);
      }
      setParsedRows(rows);
    };
    reader.readAsText(file);
  };

  const handleImport = async () => {
    setLoading(true);
    try {
      await apiClient.post(`/events/${eventId}/student-imports`, {
        fileName: fileToUpload?.name || 'padron.csv',
        expectedColumns: ['codigo_unico', 'apellidos', 'nombres'],
        rows: parsedRows
      }, { token: session?.accessToken, isBearer: true });
      alert('Importación iniciada');
      navigate('/staff/dashboard');
    } catch (err: any) {
      alert(`Error iniciando importación: ${err?.message || JSON.stringify(err)}`);
    } finally {
      setLoading(false);
    }
  };

  if (!session) return null;

  return (
    <div className="animate-fade-in" style={{ maxWidth: '600px', margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px' }}>
        <button onClick={() => navigate('/staff/dashboard')} style={{ background: 'transparent', border: 'none', color: 'var(--text-primary)', cursor: 'pointer' }}>
          <ArrowLeft size={24} />
        </button>
        <h2 style={{ margin: 0 }}>Importar Padrón de Estudiantes</h2>
      </div>

      <GlassCard>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '24px' }}>
          Sube el archivo CSV con las columnas `codigo_unico`, `apellidos`, y `nombres`.
        </p>

        <div style={{ border: '2px dashed var(--border-light)', borderRadius: 'var(--radius-md)', padding: '40px', textAlign: 'center', marginBottom: '24px' }}>
          <UploadCloud size={48} style={{ color: 'var(--text-muted)', marginBottom: '16px' }} />
          <p>Haz clic o arrastra tu archivo CSV aquí</p>
          <input 
            type="file" 
            accept=".csv" 
            ref={fileInputRef} 
            onChange={handleFileChange} 
            style={{ display: 'none' }} 
          />
          <Button variant="secondary" style={{ marginTop: '16px' }} onClick={() => fileInputRef.current?.click()}>
            {fileToUpload ? fileToUpload.name : 'Seleccionar Archivo'}
          </Button>
          {parsedRows.length > 0 && (
            <p style={{ color: 'var(--accent-primary)', marginTop: '8px', fontSize: '0.875rem' }}>
              Se procesarán {parsedRows.length} registros válidos.
            </p>
          )}
        </div>

        <Button style={{ width: '100%' }} onClick={handleImport} disabled={!fileToUpload || parsedRows.length === 0} isLoading={loading}>
          Procesar Importación
        </Button>
      </GlassCard>
    </div>
  );
};
