import { useId } from 'react';
import type { SelectHTMLAttributes } from 'react';

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
}

/** Igual que `Input`: label asociado, error anunciado y estilos de `glass-input`. */
export const Select: React.FC<SelectProps> = ({ label, error, className = '', id, children, ...props }) => {
  const autoId = useId();
  const selectId = id || autoId;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%' }}>
      {label && (
        <label
          htmlFor={selectId}
          style={{ fontSize: 'var(--text-sm)', fontWeight: 500, color: 'var(--text-secondary)' }}
        >
          {label}
        </label>
      )}
      <select
        id={selectId}
        className={`glass-input ${className}`}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${selectId}-error` : undefined}
        {...props}
      >
        {children}
      </select>
      {error && (
        <span id={`${selectId}-error`} style={{ fontSize: 'var(--text-xs)', color: 'var(--error)' }}>
          {error}
        </span>
      )}
    </div>
  );
};
