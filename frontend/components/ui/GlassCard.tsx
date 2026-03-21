'use client';

import { forwardRef } from 'react';
import { cn } from '@/utils/cn';

interface GlassCardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'subtle' | 'default' | 'strong';
  hoverable?: boolean;
}

export const GlassCard = forwardRef<HTMLDivElement, GlassCardProps>(
  (
    { className, variant = 'default', hoverable = false, children, ...props },
    ref
  ) => {
    const base =
      variant === 'subtle'
        ? 'bg-[var(--raised)] border border-[var(--border)]'
        : variant === 'strong'
        ? 'bg-[var(--surface-2)] border border-[var(--border-s)]'
        : 'bg-[var(--raised)] border border-[var(--border)]';

    return (
      <div
        ref={ref}
        className={cn(
          base,
          'rounded-xl',
          hoverable && 'hover:bg-[var(--raised-h)] cursor-pointer',
          className
        )}
        {...props}
      >
        {children}
      </div>
    );
  }
);
GlassCard.displayName = 'GlassCard';
