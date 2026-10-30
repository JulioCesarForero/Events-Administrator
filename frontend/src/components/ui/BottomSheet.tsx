import { useId } from 'react';
import type { ReactNode } from 'react';
import { X } from 'lucide-react';
import { GlassCard } from './GlassCard';
import { useDialogA11y } from '../../hooks/useDialogA11y';

interface BottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  title?: ReactNode;
  children: ReactNode;
}

export const BottomSheet: React.FC<BottomSheetProps> = ({ isOpen, onClose, title, children }) => {
  const titleId = useId();
  const panelRef = useDialogA11y<HTMLDivElement>(isOpen, onClose);

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.55)',
        backdropFilter: 'blur(3px)',
        display: 'flex',
        alignItems: 'flex-end',
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
        style={{ width: '100%' }}
      >
        <GlassCard
          style={{
            padding: 0,
            borderBottomLeftRadius: 0,
            borderBottomRightRadius: 0,
            maxHeight: '80vh',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '14px 18px',
              borderBottom: '1px solid var(--border-light)',
            }}
          >
            <h2 id={titleId} style={{ margin: 0, fontSize: 'var(--text-base)' }}>{title}</h2>
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
          <div style={{ padding: '16px 18px', overflowY: 'auto' }}>{children}</div>
        </GlassCard>
      </div>
    </div>
  );
};
