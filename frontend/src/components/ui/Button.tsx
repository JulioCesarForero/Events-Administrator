import type { ButtonHTMLAttributes } from 'react';
import type { LucideIcon } from 'lucide-react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  icon?: LucideIcon;
  isLoading?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  icon: Icon,
  isLoading,
  className = '',
  disabled,
  ...props
}) => {
  const getVariantClass = () => {
    switch (variant) {
      case 'primary': return 'btn-primary';
      case 'secondary': return 'btn-secondary';
      case 'outline': return 'btn-secondary'; // Can be specialized
      case 'ghost': return 'btn-secondary'; // Can be specialized
      default: return 'btn-primary';
    }
  };

  const getSizeStyle = () => {
    switch (size) {
      case 'sm': return { padding: '8px 16px', fontSize: '0.875rem' };
      case 'lg': return { padding: '16px 32px', fontSize: '1.125rem' };
      case 'md':
      default: return { padding: '12px 24px', fontSize: '1rem' };
    }
  };

  return (
    <button
      className={`btn ${getVariantClass()} ${className}`}
      style={getSizeStyle()}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading && (
        <div style={{ marginRight: '8px', width: '16px', height: '16px', border: '2px solid transparent', borderTopColor: 'currentColor', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
      )}
      {!isLoading && Icon && <Icon size={size === 'sm' ? 16 : size === 'lg' ? 24 : 20} />}
      {children}
      <style>
        {`@keyframes spin { 100% { transform: rotate(360deg); } }`}
      </style>
    </button>
  );
};
