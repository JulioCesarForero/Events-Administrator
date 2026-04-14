import type { HTMLAttributes } from 'react';

interface GlassCardProps extends HTMLAttributes<HTMLDivElement> {
  hoverEffect?: boolean;
}

export const GlassCard: React.FC<GlassCardProps> = ({ 
  children, 
  hoverEffect = false, 
  className = '',
  style,
  ...props 
}) => {
  return (
    <div 
      className={`glass-panel ${hoverEffect ? 'glass-panel-hover' : ''} ${className}`}
      style={{ padding: '24px', ...style }}
      {...props}
    >
      {children}
    </div>
  );
};
