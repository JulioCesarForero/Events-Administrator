import type { CSSProperties, ReactNode } from 'react';

export type BadgeTone = 'success' | 'warn' | 'error' | 'info' | 'neutral';

interface StatusBadgeProps {
  tone?: BadgeTone;
  children: ReactNode;
  style?: CSSProperties;
}

const TONE_MAP: Record<BadgeTone, { bg: string; fg: string }> = {
  success: { bg: 'rgba(57,255,20,0.18)', fg: 'var(--accent-primary)' },
  warn: { bg: 'rgba(255,193,7,0.18)', fg: '#FFC107' },
  error: { bg: 'rgba(255,0,0,0.18)', fg: 'var(--error)' },
  info: { bg: 'rgba(0,212,255,0.18)', fg: '#00D4FF' },
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
        fontSize: '0.75rem',
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
