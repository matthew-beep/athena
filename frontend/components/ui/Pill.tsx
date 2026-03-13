'use client';

import { X } from 'lucide-react';
import { cn } from '@/utils/cn';

export interface PillProps {
  children: React.ReactNode;
  active?: boolean;
  className?: string;
  /** When provided, an X appears on the right; click runs this function */
  onDelete?: () => void;
}

export function Pill({ children, active = false, className, onDelete }: PillProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-3 py-1 text-sm transition-colors border border-[var(--border)]',
        'hover:bg-[var(--raised)]',
        active
          ? 'bg-[var(--blue-b)] text-[var(--blue)] hover:bg-[var(--blue-a)]'
          : 'text-[var(--t2)] hover:text-[var(--t1)]',
        onDelete && 'pr-1',
        className
      )}
    >
      <span className="min-w-0">{children}</span>
      {onDelete && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="w-6 h-6 flex-shrink-0 rounded-full flex items-center justify-center text-[var(--t3)] hover:text-[var(--t1)] hover:bg-[var(--raised)] transition-colors"
          aria-label="Remove"
        >
          <X className="w-3 h-3" />
        </button>
      )}
    </span>
  );
}
