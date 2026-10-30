import { useId } from 'react';
import type { ReactNode } from 'react';
import { X } from 'lucide-react';
import { GlassCard } from './GlassCard';
import { useDialogA11y } from '../../hooks/useDialogA11y';

interface DrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title?: ReactNode;
  children: ReactNode;
  side?: 'right' | 'left';
  width?: number;
}

/**
 * Lateral drawer for detail views. On narrow screens it stretches to full width.
 */
export const Drawer: React.FC<DrawerProps> = ({
  isOpen,
  onClose,
  title,
  children,
  side = 'right',
  width = 420,
}) => {
  const titleId = useId();
  const panelRef = useDialogA11y<HTMLDivElement>(isOpen, onClose);

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.6)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        justifyContent: side === 'right' ? 'flex-end' : 'flex-start',
        zIndex: 5000,
      }}
      onClick={onClose}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        tabIndex={-1}
        className="animate-slide-up"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: `${width}px`,
          height: '100vh',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <GlassCard style={{ padding: 0, display: 'flex', flexDirection: 'column', height: '100vh', borderRadius: 0 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '18px 20px',
              borderBottom: '1px solid var(--border-light)',
            }}
          >
            <h2 id={titleId} style={{ margin: 0, fontSize: 'var(--text-lg)' }}>{title}</h2>
            <button
              type="button"
              className="icon-btn"
              onClick={onClose}
              aria-label="Cerrar"
              data-dialog-close="true"
            >
              <X size={22} />
            </button>
          </div>
          <div style={{ padding: '20px', overflowY: 'auto', flex: 1 }}>{children}</div>
        </GlassCard>
      </div>
    </div>
  );
};
