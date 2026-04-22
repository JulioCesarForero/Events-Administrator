import { useEffect, useState } from 'react';
import { Modal } from './Modal';
import { apiClient } from '../../api/client';

export type LegalDocumentType = 'DATA_POLICY' | 'EVENT_TERMS';

interface PublishedLegalDoc {
  id: string;
  eventId: string;
  documentType: LegalDocumentType | string;
  versionLabel: string;
  title: string;
  contentMarkdown: string;
  status: string;
  publishedAt?: string | null;
}

interface LegalViewerModalProps {
  eventId: string;
  documentType: LegalDocumentType;
  open: boolean;
  onClose: () => void;
  fallbackTitle?: string;
}

const TYPE_TITLES: Record<LegalDocumentType, string> = {
  DATA_POLICY: 'Política de tratamiento de datos',
  EVENT_TERMS: 'Términos y condiciones',
};

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderInline(line: string): string {
  let out = escapeHtml(line);
  out = out.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  out = out.replace(/\*(.+?)\*/g, '<em>$1</em>');
  out = out.replace(/`([^`]+)`/g, '<code>$1</code>');
  out = out.replace(
    /\[([^\]]+)\]\((https?:[^\s)]+)\)/g,
    '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>',
  );
  return out;
}

function renderMarkdownBasic(md: string): string {
  const lines = md.replace(/\r\n/g, '\n').split('\n');
  const html: string[] = [];
  let inList = false;
  let paragraph: string[] = [];

  const flushParagraph = () => {
    if (paragraph.length > 0) {
      html.push(`<p>${paragraph.map(renderInline).join(' ')}</p>`);
      paragraph = [];
    }
  };
  const closeList = () => {
    if (inList) {
      html.push('</ul>');
      inList = false;
    }
  };

  for (const raw of lines) {
    const line = raw.trimEnd();
    if (!line.trim()) {
      flushParagraph();
      closeList();
      continue;
    }
    const heading = /^(#{1,4})\s+(.+)$/.exec(line);
    if (heading) {
      flushParagraph();
      closeList();
      const level = heading[1].length;
      html.push(`<h${level}>${renderInline(heading[2])}</h${level}>`);
      continue;
    }
    const bullet = /^[-*]\s+(.+)$/.exec(line);
    if (bullet) {
      flushParagraph();
      if (!inList) {
        html.push('<ul>');
        inList = true;
      }
      html.push(`<li>${renderInline(bullet[1])}</li>`);
      continue;
    }
    closeList();
    paragraph.push(line.trim());
  }
  flushParagraph();
  closeList();
  return html.join('\n');
}

export const LegalViewerModal = ({
  eventId,
  documentType,
  open,
  onClose,
  fallbackTitle,
}: LegalViewerModalProps) => {
  const [doc, setDoc] = useState<PublishedLegalDoc | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    if (!open || !eventId) return;
    const controller = new AbortController();
    setLoading(true);
    setError('');
    setDoc(null);
    apiClient
      .get<PublishedLegalDoc[]>(
        `/portal/events/${eventId}/published-legal-documents?type=${documentType}`,
        { signal: controller.signal },
      )
      .then((rows) => {
        const latest = rows && rows.length > 0 ? rows[0] : null;
        setDoc(latest);
        if (!latest) {
          setError(
            'El organizador aún no ha publicado este documento para el evento.',
          );
        }
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        const msg =
          err instanceof Error ? err.message : 'No se pudo cargar el documento';
        setError(msg);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [open, eventId, documentType]);

  const title = doc?.title || fallbackTitle || TYPE_TITLES[documentType];

  return (
    <Modal isOpen={open} onClose={onClose} title={title}>
      <div style={{ maxHeight: '60vh', overflowY: 'auto' }}>
        {loading && (
          <p style={{ color: 'var(--text-secondary)' }}>Cargando documento…</p>
        )}
        {!loading && error && (
          <p style={{ color: 'var(--text-secondary)' }}>{error}</p>
        )}
        {!loading && !error && doc && (
          <>
            <div
              style={{
                fontSize: '0.8rem',
                color: 'var(--text-muted)',
                marginBottom: '12px',
              }}
            >
              Versión <strong>{doc.versionLabel}</strong>
              {doc.publishedAt && (
                <>
                  {' '}
                  · Publicado{' '}
                  {new Date(doc.publishedAt).toLocaleDateString('es-CO')}
                </>
              )}
            </div>
            <div
              className="legal-content"
              style={{ lineHeight: 1.6, color: 'var(--text-primary)' }}
              dangerouslySetInnerHTML={{
                __html: renderMarkdownBasic(doc.contentMarkdown || ''),
              }}
            />
          </>
        )}
      </div>
    </Modal>
  );
};
