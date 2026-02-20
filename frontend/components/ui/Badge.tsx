'use client';

import { cn } from '@/utils/cn';

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'default' | 'primary' | 'accent' | 'muted';
  className?: string;
}

export function Badge({
  children,
  variant = 'default',
  className,
}: BadgeProps) {
  const variants = {
    default: 'bg-muted text-muted-foreground',
    primary: 'bg-primary/10 text-primary border border-primary/20',
    accent: 'bg-accent/10 text-accent border border-accent/20',
    muted: 'bg-muted/50 text-muted-foreground border border-border',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center px-2 py-0.5 rounded text-xs font-mono font-medium',
        variants[variant],
        className
      )}
    >
      {children}
    </span>
  );
}
