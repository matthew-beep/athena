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
      className={cn('menu', className)}
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
        'menu-item',
        variant === 'danger' && 'danger',
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
