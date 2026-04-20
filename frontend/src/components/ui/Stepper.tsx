import type { ReactNode } from 'react';
import { CheckCircle2 } from 'lucide-react';

export interface Step {
  key: string;
  label: string;
  helper?: ReactNode;
}

interface StepperProps {
  steps: Step[];
  currentIndex: number;
  /** Optional: mark specific indices as done (useful for non-linear progress). */
  doneIndices?: number[];
}

export const Stepper: React.FC<StepperProps> = ({ steps, currentIndex, doneIndices }) => {
  return (
    <ol
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: '8px',
        listStyle: 'none',
        padding: 0,
        margin: 0,
      }}
      aria-label="Progreso"
    >
      {steps.map((s, idx) => {
        const done = doneIndices?.includes(idx) ?? idx < currentIndex;
        const active = idx === currentIndex;
        const circleBg = done
          ? 'var(--accent-primary)'
          : active
            ? '#FFC107'
            : 'var(--border-light)';
        const textColor = done || active ? 'var(--text-primary)' : 'var(--text-muted)';
        return (
          <li
            key={s.key}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              flexBasis: 'auto',
              padding: '4px 10px 4px 4px',
              borderRadius: '999px',
              background: active ? 'rgba(255,193,7,0.12)' : 'transparent',
            }}
            aria-current={active ? 'step' : undefined}
          >
            <span
              style={{
                width: 26,
                height: 26,
                borderRadius: '50%',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: circleBg,
                color: done || active ? '#000' : 'var(--text-muted)',
                fontSize: '0.8rem',
                fontWeight: 700,
              }}
            >
              {done ? <CheckCircle2 size={16} /> : idx + 1}
            </span>
            <span style={{ color: textColor, fontSize: '0.85rem' }}>{s.label}</span>
          </li>
        );
      })}
    </ol>
  );
};
