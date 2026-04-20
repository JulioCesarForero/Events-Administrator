import type { ReactNode } from 'react';
import { AlertTriangle, CheckCircle2, Info, XCircle } from 'lucide-react';
import { GlassCard } from './GlassCard';

type Tone = 'info' | 'success' | 'warn' | 'error';

interface InlineAlertProps {
  tone?: Tone;
  title?: ReactNode;
  children?: ReactNode;
  actions?: ReactNode;
}

const CONFIG: Record<Tone, { color: string; Icon: typeof Info }> = {
  info: { color: '#00D4FF', Icon: Info },
  success: { color: 'var(--accent-primary)', Icon: CheckCircle2 },
  warn: { color: '#FFC107', Icon: AlertTriangle },
  error: { color: 'var(--error)', Icon: XCircle },
};

export const InlineAlert: React.FC<InlineAlertProps> = ({
  tone = 'info',
  title,
  children,
  actions,
}) => {
  const { color, Icon } = CONFIG[tone];
  return (
    <GlassCard
      role="alert"
      style={{
        borderLeft: `3px solid ${color}`,
        padding: '14px 16px',
        display: 'flex',
        alignItems: 'flex-start',
        gap: '12px',
      }}
    >
      <Icon color={color} size={20} style={{ flexShrink: 0, marginTop: '2px' }} />
      <div style={{ flex: 1 }}>
        {title && <strong style={{ display: 'block' }}>{title}</strong>}
        {children && (
          <div
            style={{
              marginTop: title ? '4px' : 0,
              color: 'var(--text-secondary)',
              fontSize: '0.9rem',
              lineHeight: 1.55,
            }}
          >
            {children}
          </div>
        )}
        {actions && <div style={{ marginTop: '10px' }}>{actions}</div>}
      </div>
    </GlassCard>
  );
};
