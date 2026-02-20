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
        ? 'glass-subtle'
        : variant === 'strong'
        ? 'glass-strong'
        : 'glass';

    return (
      <div
        ref={ref}
        className={cn(
          base,
          'rounded-xl',
          hoverable && 'glass-hover cursor-pointer',
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
