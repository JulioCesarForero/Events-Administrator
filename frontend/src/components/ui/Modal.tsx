import React, { useId } from 'react';
import { X } from 'lucide-react';
import { GlassCard } from './GlassCard';
import { useDialogA11y } from '../../hooks/useDialogA11y';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  /** Pie opcional para acciones (alineadas a la derecha). */
  footer?: React.ReactNode;
  /** `alertdialog` para confirmaciones que requieren respuesta. */
  role?: 'dialog' | 'alertdialog';
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
  footer,
  role = 'dialog',
}) => {
  const titleId = useId();
  const panelRef = useDialogA11y<HTMLDivElement>(isOpen, onClose);

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        backdropFilter: 'blur(4px)',
        zIndex: 5000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 'var(--space-5)'
      }}
      onClick={onClose}
    >
      <div
        ref={panelRef}
        role={role}
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        tabIndex={-1}
        className="animate-slide-up"
        onClick={e => e.stopPropagation()}
        style={{ width: '100%', maxWidth: '500px', outline: 'none' }}
      >
        <GlassCard style={{ padding: '0', display: 'flex', flexDirection: 'column', maxHeight: '90vh' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 'var(--space-3) var(--space-3) var(--space-3) var(--space-5)', borderBottom: '1px solid var(--border-light)' }}>
            <h2 id={titleId} style={{ margin: 0, fontSize: 'var(--text-xl)' }}>{title}</h2>
            <button
              type="button"
              className="icon-btn"
              onClick={onClose}
              aria-label="Cerrar"
              data-dialog-close="true"
            >
              <X size={24} aria-hidden="true" />
            </button>
          </div>
          <div style={{ padding: 'var(--space-5)', overflowY: 'auto' }}>
            {children}
          </div>
          {footer && (
            <div
              style={{
                display: 'flex',
                justifyContent: 'flex-end',
                gap: 'var(--space-3)',
                flexWrap: 'wrap',
                padding: 'var(--space-4) var(--space-5)',
                borderTop: '1px solid var(--border-light)',
              }}
            >
              {footer}
            </div>
          )}
        </GlassCard>
      </div>
    </div>
  );
};
