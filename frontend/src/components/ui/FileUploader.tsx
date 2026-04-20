import { useId, useRef, useState } from 'react';
import { Upload } from 'lucide-react';

interface FileUploaderProps {
  accept?: string;
  /** Maximum file size in megabytes. */
  maxSizeMb?: number;
  onFileSelected: (file: File | null) => void;
  label?: string;
  helper?: string;
}

export const FileUploader: React.FC<FileUploaderProps> = ({
  accept,
  maxSizeMb = 5,
  onFileSelected,
  label = 'Haz clic para elegir un archivo',
  helper,
}) => {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState('');

  const handle = (f: File | null) => {
    setError('');
    if (!f) {
      setFile(null);
      setPreview(null);
      onFileSelected(null);
      return;
    }
    if (f.size > maxSizeMb * 1024 * 1024) {
      setError(`El archivo supera ${maxSizeMb} MB.`);
      return;
    }
    setFile(f);
    if (f.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (ev) => setPreview(ev.target?.result as string);
      reader.readAsDataURL(f);
    } else {
      setPreview(null);
    }
    onFileSelected(f);
  };

  return (
    <div>
      <div
        onClick={() => inputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click();
        }}
        style={{
          border: `2px dashed ${file ? 'var(--accent-primary)' : 'var(--border-light)'}`,
          borderRadius: 'var(--radius-md)',
          padding: '28px 20px',
          textAlign: 'center',
          cursor: 'pointer',
        }}
      >
        {preview ? (
          <img
            src={preview}
            alt="Vista previa"
            style={{ maxHeight: '180px', borderRadius: '8px', objectFit: 'contain' }}
          />
        ) : (
          <>
            <Upload
              size={40}
              style={{ color: file ? 'var(--accent-primary)' : 'var(--text-muted)', marginBottom: '8px' }}
            />
            <p style={{ margin: 0, color: 'var(--text-secondary)' }}>
              {file ? file.name : label}
            </p>
          </>
        )}
      </div>
      <input
        id={inputId}
        ref={inputRef}
        type="file"
        accept={accept}
        style={{ display: 'none' }}
        onChange={(e) => handle(e.target.files?.[0] || null)}
      />
      {helper && (
        <small style={{ color: 'var(--text-muted)', display: 'block', marginTop: '8px' }}>
          {helper}
        </small>
      )}
      {error && (
        <small style={{ color: 'var(--error)', display: 'block', marginTop: '8px' }}>
          {error}
        </small>
      )}
    </div>
  );
};
