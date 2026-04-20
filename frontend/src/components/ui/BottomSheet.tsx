import { useEffect } from 'react';
import type { ReactNode } from 'react';
import { X } from 'lucide-react';
import { GlassCard } from './GlassCard';

interface BottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  title?: ReactNode;
  children: ReactNode;
}

export const BottomSheet: React.FC<BottomSheetProps> = ({ isOpen, onClose, title, children }) => {
  useEffect(() => {
    if (isOpen) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = 'unset';
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

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
      role="dialog"
      aria-modal="true"
    >
      <div
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
            <h3 style={{ margin: 0, fontSize: '1rem' }}>{title}</h3>
            <button
              onClick={onClose}
              aria-label="Cerrar"
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--text-secondary)',
                cursor: 'pointer',
              }}
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
