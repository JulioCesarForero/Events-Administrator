import type { CSSProperties, ReactNode } from 'react';

export type BadgeTone = 'success' | 'warn' | 'error' | 'info' | 'neutral';

interface StatusBadgeProps {
  tone?: BadgeTone;
  children: ReactNode;
  style?: CSSProperties;
}

const TONE_MAP: Record<BadgeTone, { bg: string; fg: string }> = {
  success: { bg: 'var(--success-dim)', fg: 'var(--success)' },
  warn: { bg: 'var(--warning-dim)', fg: 'var(--warning)' },
  error: { bg: 'var(--error-dim)', fg: 'var(--error)' },
  info: { bg: 'var(--info-dim)', fg: 'var(--info)' },
  neutral: { bg: 'rgba(255,255,255,0.08)', fg: 'var(--text-secondary)' },
};

export const StatusBadge: React.FC<StatusBadgeProps> = ({ tone = 'neutral', children, style }) => {
  const colors = TONE_MAP[tone];
  return (
    <span
      style={{
        display: 'inline-block',
        padding: '3px 10px',
        borderRadius: '999px',
        fontSize: 'var(--text-xs)',
        fontWeight: 600,
        background: colors.bg,
        color: colors.fg,
        ...style,
      }}
    >
      {children}
    </span>
  );
};
