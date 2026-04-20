import { useEffect } from 'react';
import type { ReactNode } from 'react';
import { X } from 'lucide-react';
import { GlassCard } from './GlassCard';

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
        background: 'rgba(0,0,0,0.6)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        justifyContent: side === 'right' ? 'flex-end' : 'flex-start',
        zIndex: 5000,
      }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
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
            <h3 style={{ margin: 0, fontSize: '1.1rem' }}>{title}</h3>
            <button
              onClick={onClose}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--text-secondary)',
                cursor: 'pointer',
              }}
              aria-label="Cerrar"
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
