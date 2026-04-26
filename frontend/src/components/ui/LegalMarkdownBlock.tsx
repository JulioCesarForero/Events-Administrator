import ReactMarkdown from 'react-markdown';
import './LegalMarkdownBlock.css';

type LegalMarkdownBlockProps = {
  content: string | undefined;
  /** Shown when content is empty or only whitespace. */
  emptyLabel?: string;
};

/**
 * Renders admin-authored Markdown as readable text for end users (not raw syntax).
 */
export function LegalMarkdownBlock({
  content,
  emptyLabel = '(sin contenido)',
}: LegalMarkdownBlockProps) {
  const text = content?.trim() ?? '';
  if (!text) {
    return <p className="legal-md-block legal-md-block--empty">{emptyLabel}</p>;
  }

  return (
    <div className="legal-md-block">
      <ReactMarkdown>{text}</ReactMarkdown>
    </div>
  );
}
