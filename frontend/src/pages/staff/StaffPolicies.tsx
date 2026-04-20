import { useState, useEffect, useCallback } from 'react';
import { useAuthStaff } from '../../contexts/AuthContext';
import { GlassCard } from '../../components/ui/GlassCard';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { apiClient } from '../../api/client';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Save,
  CheckCircle2,
  Edit2,
  Send,
  FilePlus,
} from 'lucide-react';

type DocType = 'DATA_POLICY' | 'EVENT_TERMS';
type DocStatus = 'DRAFT' | 'PUBLISHED';

interface LegalDoc {
  id: string;
  documentType: DocType | string;
  versionLabel: string;
  title: string;
  contentMarkdown?: string;
  status: DocStatus | string;
  publishedAt?: string | null;
}

const LABELS: Record<DocType, string> = {
  DATA_POLICY: 'Política de tratamiento de datos',
  EVENT_TERMS: 'Términos y condiciones',
};

export const StaffPolicies = () => {
  const { session } = useAuthStaff();
  const { eventId } = useParams();
  const navigate = useNavigate();

  const [docs, setDocs] = useState<LegalDoc[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState('');

  const [editorOpen, setEditorOpen] = useState(false);
  const [editorMode, setEditorMode] = useState<'create' | 'edit'>('create');
  const [currentType, setCurrentType] = useState<DocType>('DATA_POLICY');
  const [editing, setEditing] = useState<LegalDoc | null>(null);
  const [form, setForm] = useState({ title: '', versionLabel: 'v1.0', contentMarkdown: '' });

  const loadDocs = useCallback(async () => {
    if (!session || !eventId) return;
    setLoading(true);
    setError('');
    try {
      const res = await apiClient.get<LegalDoc[]>(
        `/events/${eventId}/legal-documents`,
        { token: session.accessToken, isBearer: true },
      );
      setDocs(res || []);
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : 'No se pudo cargar las políticas';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [session, eventId]);

  useEffect(() => {
    loadDocs();
  }, [loadDocs]);

  const openCreate = (type: DocType) => {
    setEditorMode('create');
    setCurrentType(type);
    setEditing(null);
    setForm({ title: LABELS[type], versionLabel: 'v1.0', contentMarkdown: '' });
    setEditorOpen(true);
  };

  const openEdit = (doc: LegalDoc) => {
    setEditorMode('edit');
    setCurrentType(doc.documentType as DocType);
    setEditing(doc);
    setForm({
      title: doc.title,
      versionLabel: doc.versionLabel,
      contentMarkdown: doc.contentMarkdown || '',
    });
    setEditorOpen(true);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session || !eventId) return;
    setActionLoading(true);
    setError('');
    try {
      if (editorMode === 'create') {
        await apiClient.post(
          `/events/${eventId}/legal-documents`,
          {
            documentType: currentType,
            title: form.title,
            versionLabel: form.versionLabel,
            contentMarkdown: form.contentMarkdown,
          },
          { token: session.accessToken, isBearer: true },
        );
      } else if (editing) {
        await apiClient.patch(
          `/legal-documents/${editing.id}`,
          { title: form.title, contentMarkdown: form.contentMarkdown },
          { token: session.accessToken, isBearer: true },
        );
      }
      setEditorOpen(false);
      loadDocs();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'No se pudo guardar';
      setError(msg);
    } finally {
      setActionLoading(false);
    }
  };

  const publish = async (doc: LegalDoc) => {
    if (!session) return;
    if (!window.confirm(`¿Publicar ${doc.title} (${doc.versionLabel})?`)) return;
    setActionLoading(true);
    setError('');
    try {
      await apiClient.post(
        `/legal-documents/${doc.id}/publish`,
        {},
        { token: session.accessToken, isBearer: true },
      );
      loadDocs();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'No se pudo publicar';
      setError(msg);
    } finally {
      setActionLoading(false);
    }
  };

  if (!session) return null;

  const grouped: Record<DocType, LegalDoc[]> = {
    DATA_POLICY: docs.filter((d) => d.documentType === 'DATA_POLICY'),
    EVENT_TERMS: docs.filter((d) => d.documentType === 'EVENT_TERMS'),
  };

  return (
    <div className="animate-fade-in" style={{ maxWidth: '900px', margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px' }}>
        <button
          onClick={() => navigate('/staff/dashboard')}
          style={{ background: 'transparent', border: 'none', color: 'var(--text-primary)', cursor: 'pointer' }}
        >
          <ArrowLeft size={24} />
        </button>
        <h2 style={{ margin: 0 }}>Políticas y términos del evento</h2>
      </div>

      {error && (
        <GlassCard style={{ marginBottom: '16px', borderLeft: '3px solid var(--error)' }}>
          <span style={{ color: 'var(--error)' }}>{error}</span>
        </GlassCard>
      )}

      {(Object.keys(LABELS) as DocType[]).map((type) => (
        <GlassCard key={type} style={{ marginBottom: '20px' }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '12px',
              flexWrap: 'wrap',
              gap: '12px',
            }}
          >
            <div>
              <h3 style={{ margin: 0 }}>{LABELS[type]}</h3>
              <small style={{ color: 'var(--text-secondary)' }}>
                {grouped[type].length} versión(es)
              </small>
            </div>
            <Button icon={FilePlus} variant="secondary" onClick={() => openCreate(type)}>
              Nueva versión
            </Button>
          </div>

          {loading && grouped[type].length === 0 && (
            <p style={{ color: 'var(--text-secondary)' }}>Cargando…</p>
          )}
          {!loading && grouped[type].length === 0 && (
            <p style={{ color: 'var(--text-muted)', margin: 0 }}>
              Aún no hay versiones de este documento. Crea una para que la reserva sea posible.
            </p>
          )}

          {grouped[type].map((d) => (
            <div
              key={d.id}
              className="glass-panel"
              style={{
                padding: '14px',
                marginTop: '10px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '12px',
                flexWrap: 'wrap',
              }}
            >
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <strong>{d.title}</strong>
                  <span
                    style={{
                      display: 'inline-block',
                      padding: '2px 8px',
                      borderRadius: '999px',
                      fontSize: '0.7rem',
                      fontWeight: 700,
                      background:
                        d.status === 'PUBLISHED'
                          ? 'rgba(57,255,20,0.15)'
                          : 'rgba(255,193,7,0.15)',
                      color: d.status === 'PUBLISHED' ? 'var(--accent-primary)' : '#FFC107',
                    }}
                  >
                    {d.status}
                  </span>
                </div>
                <small style={{ color: 'var(--text-secondary)' }}>
                  Versión {d.versionLabel}
                  {d.publishedAt ? ` · Publicado ${new Date(d.publishedAt).toLocaleDateString()}` : ''}
                </small>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <Button
                  size="sm"
                  variant="secondary"
                  icon={Edit2}
                  disabled={d.status === 'PUBLISHED'}
                  onClick={() => openEdit(d)}
                >
                  Editar
                </Button>
                <Button
                  size="sm"
                  icon={Send}
                  disabled={d.status === 'PUBLISHED' || actionLoading}
                  onClick={() => publish(d)}
                >
                  Publicar
                </Button>
              </div>
            </div>
          ))}
        </GlassCard>
      ))}

      <Modal
        isOpen={editorOpen}
        onClose={() => !actionLoading && setEditorOpen(false)}
        title={
          editorMode === 'create'
            ? `Nueva versión: ${LABELS[currentType]}`
            : `Editar ${editing?.title || ''}`
        }
      >
        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <Input
            label="Título"
            required
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
          />
          <Input
            label="Versión"
            required
            disabled={editorMode === 'edit'}
            value={form.versionLabel}
            onChange={(e) => setForm({ ...form, versionLabel: e.target.value })}
          />
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <label style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-secondary)' }}>
              Contenido (Markdown)
            </label>
            <textarea
              className="glass-input"
              style={{ minHeight: '220px', resize: 'vertical' }}
              value={form.contentMarkdown}
              onChange={(e) => setForm({ ...form, contentMarkdown: e.target.value })}
              placeholder="Escribe la política o términos aquí…"
              required
            />
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
            <Button
              variant="secondary"
              type="button"
              onClick={() => setEditorOpen(false)}
              disabled={actionLoading}
            >
              Cancelar
            </Button>
            <Button type="submit" icon={editorMode === 'edit' ? Save : CheckCircle2} isLoading={actionLoading}>
              {editorMode === 'edit' ? 'Guardar cambios' : 'Crear borrador'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
