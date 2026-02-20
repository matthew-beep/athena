'use client';

import { forwardRef } from 'react';
import { cn } from '@/utils/cn';

interface GlassButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
}

function ButtonSpinner({ size }: { size: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className="animate-spin"
    >
      <circle
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="2"
        strokeOpacity="0.3"
      />
      <path
        d="M12 2a10 10 0 0 1 10 10"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

export const GlassButton = forwardRef<HTMLButtonElement, GlassButtonProps>(
  (
    {
      className,
      variant = 'ghost',
      size = 'md',
      loading,
      children,
      disabled,
      ...props
    },
    ref
  ) => {
    const variants = {
      primary:
        'bg-foreground text-background font-semibold hover:bg-foreground/90 transition-colors',
      ghost:
        'glass-subtle hover:glass text-foreground/80 hover:text-foreground transition-all',
      danger:
        'bg-destructive/20 border border-destructive/30 text-destructive hover:bg-destructive/30 transition-all',
    };

    const sizes = {
      sm: 'px-3 py-1.5 text-xs rounded-md',
      md: 'px-4 py-2 text-sm rounded-lg',
      lg: 'px-5 py-2.5 text-sm rounded-lg',
    };

    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={cn(
          'inline-flex items-center justify-center gap-2 font-medium transition-all',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          variants[variant],
          sizes[size],
          className
        )}
        {...props}
      >
        {loading && <ButtonSpinner size={14} />}
        {children}
      </button>
    );
  }
);
GlassButton.displayName = 'GlassButton';
