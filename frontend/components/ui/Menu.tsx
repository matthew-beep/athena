'use client';

import { forwardRef } from 'react';
import { cn } from '@/utils/cn';

export interface MenuProps {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  id?: string;
}

const MenuRoot = forwardRef<HTMLDivElement, MenuProps>(function Menu(
  { children, className, style, id },
  ref
) {
  return (
    <div
      ref={ref}
      id={id}
      role="menu"
      className={cn(
        'min-w-36 overflow-hidden rounded-md border border-[var(--border)]',
        'bg-[color:var(--panel,#0b0f14)] shadow-lg backdrop-blur',
        className
      )}
      style={style}
    >
      {children}
    </div>
  );
});

export interface MenuItemProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  children: React.ReactNode;
  variant?: 'default' | 'danger';
  className?: string;
}

function MenuItem({ children, variant = 'default', className, ...rest }: MenuItemProps) {
  return (
    <button
      type="button"
      role="menuitem"
      className={cn(
        'w-full px-3 py-2 text-left text-sm transition-colors',
        variant === 'default' &&
          'text-[var(--t2)] hover:bg-[color:var(--border)]/30 hover:text-[var(--t1)]',
        variant === 'danger' &&
          'text-red-400 hover:bg-[color:var(--border)]/30 hover:text-red-300',
        className
      )}
      {...rest}
    >
      {children}
    </button>
  );
}

export const Menu = Object.assign(MenuRoot, { Item: MenuItem }) as typeof MenuRoot & {
  Item: typeof MenuItem;
};
