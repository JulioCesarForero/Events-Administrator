import { createContext, useCallback, useContext, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { CheckCircle2, AlertTriangle, Info, XCircle, X } from 'lucide-react';

type ToastTone = 'info' | 'success' | 'warn' | 'error';

interface ToastItem {
  id: number;
  tone: ToastTone;
  title?: string;
  message: string;
}

interface ToastContextValue {
  push: (t: Omit<ToastItem, 'id'>) => void;
  success: (message: string, title?: string) => void;
  info: (message: string, title?: string) => void;
  warn: (message: string, title?: string) => void;
  error: (message: string, title?: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const TONE_CONFIG: Record<ToastTone, { color: string; Icon: typeof Info }> = {
  info: { color: '#00D4FF', Icon: Info },
  success: { color: 'var(--accent-primary)', Icon: CheckCircle2 },
  warn: { color: '#FFC107', Icon: AlertTriangle },
  error: { color: 'var(--error)', Icon: XCircle },
};

export const ToastProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const idRef = useRef(0);

  const remove = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const push = useCallback(
    (t: Omit<ToastItem, 'id'>) => {
      const id = ++idRef.current;
      setToasts((prev) => [...prev, { ...t, id }]);
      // Auto dismiss after 5 seconds.
      setTimeout(() => remove(id), 5000);
    },
    [remove],
  );

  const api: ToastContextValue = {
    push,
    success: (message, title) => push({ tone: 'success', message, title }),
    info: (message, title) => push({ tone: 'info', message, title }),
    warn: (message, title) => push({ tone: 'warn', message, title }),
    error: (message, title) => push({ tone: 'error', message, title }),
  };

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div
        aria-live="polite"
        style={{
          position: 'fixed',
          bottom: '20px',
          right: '20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
          zIndex: 9999,
          maxWidth: '360px',
        }}
      >
        {toasts.map((t) => {
          const { color, Icon } = TONE_CONFIG[t.tone];
          return (
            <div
              key={t.id}
              className="glass-panel"
              style={{
                padding: '12px 14px',
                borderLeft: `3px solid ${color}`,
                display: 'flex',
                gap: '10px',
                alignItems: 'flex-start',
              }}
            >
              <Icon size={18} color={color} style={{ flexShrink: 0, marginTop: '2px' }} />
              <div style={{ flex: 1 }}>
                {t.title && <strong style={{ display: 'block' }}>{t.title}</strong>}
                <div style={{ color: 'var(--text-secondary)', fontSize: '0.88rem' }}>
                  {t.message}
                </div>
              </div>
              <button
                aria-label="Cerrar notificación"
                onClick={() => remove(t.id)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--text-muted)',
                }}
              >
                <X size={16} />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = (): ToastContextValue => {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    // Fallback: if the provider is not mounted, fall back to console + no-op.
    const fallback: ToastContextValue = {
      push: ({ message }) => console.log('[toast]', message),
      success: (message) => console.log('[toast success]', message),
      info: (message) => console.log('[toast info]', message),
      warn: (message) => console.warn('[toast warn]', message),
      error: (message) => console.error('[toast error]', message),
    };
    return fallback;
  }
  return ctx;
};

