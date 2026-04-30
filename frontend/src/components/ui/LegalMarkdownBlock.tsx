import ReactMarkdown from 'react-markdown';
import './LegalMarkdownBlock.css';

type LegalMarkdownBlockProps = {
  content: string | undefined;
  /** Shown when content is empty or only whitespace. */
  emptyLabel?: string;
  /** Extra class on the wrapper (e.g. layout variants). */
  className?: string;
};

/**
 * Renders admin-authored Markdown as readable text for end users (not raw syntax).
 */
export function LegalMarkdownBlock({
  content,
  emptyLabel = '(sin contenido)',
  className,
}: LegalMarkdownBlockProps) {
  const text = content?.trim() ?? '';
  const rootClass = ['legal-md-block', className].filter(Boolean).join(' ');
  if (!text) {
    return <p className={`${rootClass} legal-md-block--empty`.trim()}>{emptyLabel}</p>;
  }

  return (
    <div className={rootClass}>
      <ReactMarkdown>{text}</ReactMarkdown>
    </div>
  );
}
