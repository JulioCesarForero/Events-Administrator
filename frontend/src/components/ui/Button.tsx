import type { ButtonHTMLAttributes, CSSProperties } from 'react';
import type { LucideIcon } from 'lucide-react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  icon?: LucideIcon;
  isLoading?: boolean;
}

const SIZE_STYLE: Record<'sm' | 'md' | 'lg', CSSProperties> = {
  sm: { padding: '8px 16px', fontSize: '0.875rem' },
  md: { padding: '12px 24px', fontSize: '1rem' },
  lg: { padding: '16px 32px', fontSize: '1.125rem' },
};

const VARIANT_CLASS: Record<NonNullable<ButtonProps['variant']>, string> = {
  primary: 'btn-primary',
  secondary: 'btn-secondary',
  outline: 'btn-secondary btn-outline',
  ghost: 'btn-secondary btn-ghost',
};

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  icon: Icon,
  isLoading,
  className = '',
  disabled,
  style,
  ...props
}) => {
  const iconSize = size === 'sm' ? 16 : size === 'lg' ? 24 : 20;

  return (
    <button
      className={`btn ${VARIANT_CLASS[variant]} ${className}`}
      style={{ ...SIZE_STYLE[size], ...style }}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading && (
        <span
          aria-hidden="true"
          className="animate-spin"
          style={{
            display: 'inline-block',
            marginRight: '8px',
            width: '16px',
            height: '16px',
            border: '2px solid transparent',
            borderTopColor: 'currentColor',
            borderRadius: '50%',
          }}
        />
      )}
      {!isLoading && Icon && <Icon size={iconSize} />}
      {children}
    </button>
  );
};
