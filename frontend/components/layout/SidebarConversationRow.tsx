'use client';

import { useState, useRef, useId, useEffect } from 'react';
import { MessageSquare, EllipsisIcon, Trash } from 'lucide-react';
import { Menu } from '@/components/ui/Menu';
import { cn } from '@/utils/cn';
import type { Conversation } from '@/types';

export function SidebarConversationRow({
  conversation,
  active,
  onSelect,
}: {
  conversation: Conversation;
  active: boolean;
  onSelect: (conv: Conversation) => void;
}) {
  const title = conversation.title ?? 'Untitled';
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const ellipsisButtonRef = useRef<HTMLButtonElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!menuOpen) return;
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Node | null;
      if (!target) return;
      if (ellipsisButtonRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      setMenuOpen(false);
    };
    window.addEventListener('pointerdown', onPointerDown);
    return () => window.removeEventListener('pointerdown', onPointerDown);
  }, [menuOpen]);

  useEffect(() => {
    if (!menuOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [menuOpen]);

  return (
    <div
      className={cn(
        'group relative flex w-full min-w-0 items-center gap-1 rounded-lg px-3 py-2 text-xs transition-all',
        active
          ? 'bg-[var(--raised-h)] text-foreground'
          : 'text-muted-foreground hover:text-foreground'
      )}
    >
      <button
        type="button"
        onClick={() => onSelect(conversation)}
        className="flex min-w-0 flex-1 items-center gap-2 rounded-md text-left"
      >
        <MessageSquare size={11} className="mt-0.5 shrink-0 opacity-50" />
        <span className="min-w-0 flex-1 truncate leading-tight">{title}</span>
      </button>

      <div className="relative shrink-0">
        <button
          ref={ellipsisButtonRef}
          type="button"
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          aria-controls={menuId}
          onClick={() => setMenuOpen((v) => !v)}
          className={cn(
            'flex h-6 w-6 items-center justify-center rounded-sm text-muted-foreground transition-all',
            'opacity-0 group-hover:opacity-100 focus:opacity-100',
            active && 'opacity-100',
            'hover:bg-[var(--raised-h)] hover:text-[var(--t1)]'
          )}
        >
          <EllipsisIcon size={12} className="opacity-40" aria-hidden />
        </button>

        {menuOpen && (
          <Menu ref={menuRef} id={menuId} className="absolute right-0 top-8 z-50">
            <Menu.Item onClick={() => setMenuOpen(false)} className='flex items-center justify-between' variant='danger'>
              Delete
              <Trash size={12} />
              
            </Menu.Item>
          </Menu>
        )}
      </div>
    </div>
  );
}
