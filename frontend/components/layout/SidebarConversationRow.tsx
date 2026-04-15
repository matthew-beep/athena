'use client';

import { useState, useRef, useId, useEffect } from 'react';
import { MessageSquare, EllipsisIcon, Trash, Loader2, Pencil } from 'lucide-react';
import { Menu } from '@/components/ui/Menu';
import { cn } from '@/utils/cn';
import type { Conversation } from '@/types';
import { apiClient } from '@/api/client';
import { useChatStore } from '@/stores/chat.store';

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
  const { conversations, setConversations, activeConversationId, setActiveConversation, updateConversationTitle } = useChatStore();
  const [menuOpen, setMenuOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(title);
  const renameInputRef = useRef<HTMLInputElement>(null);
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


  const handleRenameStart = () => {
    setRenameValue(title);
    setMenuOpen(false);
    setIsRenaming(true);
    setTimeout(() => {
      renameInputRef.current?.select();
    }, 0);
  };

  const handleRenameCommit = async () => {
    const trimmed = renameValue.trim();
    setIsRenaming(false);
    if (!trimmed || trimmed === title) return;
    try {
      await apiClient.patch(`/chat/conversations/${conversation.conversation_id}`, { title: trimmed });
      updateConversationTitle(conversation.conversation_id, trimmed);
    } catch (error) {
      console.error(error);
    }
  };

  const handleRenameKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') handleRenameCommit();
    if (e.key === 'Escape') setIsRenaming(false);
  };

  const handleDeleteConversation = async () => {
    setDeleting(true);
    console.log("deleting conversation", conversation.conversation_id);
    try {
      await apiClient.delete(`/chat/conversations/${conversation.conversation_id}`);
      setConversations(conversations.filter(c => c.conversation_id !== conversation.conversation_id));
      if (activeConversationId === conversation.conversation_id) {
        setActiveConversation(null);
      }
      setMenuOpen(false);
    } catch (error) {
      console.error(error);
    } 
    finally {
      setDeleting(false);
    }
  }
  return (
    <div
      className={cn(
        'group relative flex w-full min-w-0 items-center gap-1 rounded-lg px-3 py-2 text-xs transition-all',
        active
          ? 'bg-[var(--raised-h)] text-foreground'
          : 'text-muted-foreground hover:text-foreground'
      )}
    >
      {isRenaming ? (
        <input
          ref={renameInputRef}
          value={renameValue}
          onChange={(e) => setRenameValue(e.target.value)}
          onBlur={handleRenameCommit}
          onKeyDown={handleRenameKeyDown}
          className="min-w-0 flex-1 bg-transparent text-xs text-foreground outline-none border-b border-border/50 leading-tight"
          autoFocus
        />
      ) : (
        <button
          type="button"
          onClick={() => onSelect(conversation)}
          className="flex min-w-0 flex-1 items-center gap-2 rounded-md text-left"
        >
          <MessageSquare size={11} className="mt-0.5 shrink-0 opacity-50" />
          <span className="min-w-0 flex-1 truncate leading-tight">{title}</span>
        </button>
      )}

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
            <Menu.Item onClick={handleRenameStart} className='flex items-center justify-between'>
              <span>Rename</span>
              <Pencil size={12} />
            </Menu.Item>
            <Menu.Item onClick={handleDeleteConversation} className='flex items-center justify-between' variant='danger'>
              <span>Delete</span>
              {deleting ? <Loader2 size={12} className="animate-spin" /> : <Trash size={12} />}
            </Menu.Item>
          </Menu>
        )}
      </div>
    </div>
  );
}
