'use client';

import { X } from 'lucide-react';
import { cn } from '@/utils/cn';

export interface PillProps {
  children: React.ReactNode;
  active?: boolean;
  className?: string;
  /** Optional click handler for interactive pills */
  onClick?: () => void;
  onDelete?: () => void;
  fontSize?: number;
}

export function Pill({ children, active = false, className, onDelete, onClick, fontSize = 10 }: PillProps) {
  const isInteractive = typeof onClick === 'function';
  const pillClassName = cn(
    'inline-flex items-center gap-1 rounded-full px-2 py-0.5 transition-colors border border-[var(--border)]',
    'hover:bg-[var(--raised)]',
    active
      ? 'bg-[var(--blue-b)] text-[var(--blue)] hover:bg-[var(--blue-a)]'
      : 'text-[var(--t2)] hover:text-[var(--t1)]',
    isInteractive && 'cursor-pointer',
    onDelete && 'pr-1',
    className
  );
  const pillStyle = { fontSize };

  const content = (
    <>
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
    </>
  );

  if (isInteractive) {
    return (
      <button type="button" className={pillClassName} style={pillStyle} onClick={onClick}>
        {content}
      </button>
    );
  }

  return (
    <span className={pillClassName} style={pillStyle}>
      {content}
    </span>
  );
}
