'use client';

import { CheckIcon, EllipsisIcon } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import type { CollectionItem } from '@/types';
import { Menu } from '@/components/ui/Menu';

type MenuAction = 'rename' | 'delete';

export interface CollectionsListProps {
  collections: CollectionItem[];
  selectedCollections: CollectionItem[];
  onSelectCollection: (collection: CollectionItem) => void;
  onAction?: (collection: CollectionItem, action: MenuAction) => void;
  editingCollectionId?: string | null;
  onSaveRename?: (collectionId: string, newName: string) => void;
  onCancelRename?: () => void;
}

function useOnClickOutside(
  refs: Array<React.RefObject<HTMLElement>>,
  handler: () => void
) {
  useEffect(() => {
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Node | null;
      if (!target) return;
      if (refs.some((r) => r.current && r.current.contains(target))) return;
      handler();
    };
    window.addEventListener('pointerdown', onPointerDown);
    return () => window.removeEventListener('pointerdown', onPointerDown);
  }, [refs, handler]);
}

function CollectionRow({
  collection,
  checked,
  onToggle,
  onAction,
  isEditing,
  onSaveRename,
  onCancelRename,
}: {
  collection: CollectionItem;
  checked: boolean;
  onToggle: () => void;
  onAction?: (action: MenuAction) => void;
  isEditing: boolean;
  onSaveRename?: (newName: string) => void;
  onCancelRename?: () => void;
}) {
  const menuId = useId();
  const [open, setOpen] = useState(false);
  const [editValue, setEditValue] = useState(collection.name);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useOnClickOutside([buttonRef, menuRef], () => setOpen(false));

  useEffect(() => {
    if (isEditing) {
      setEditValue(collection.name);
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [isEditing, collection.name]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open]);

  const submitRename = () => {
    const trimmed = editValue.trim();
    if (trimmed) onSaveRename?.(trimmed);
    else onCancelRename?.();
  };

  return (
    <div
      className={[
        'group flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors',
        'hover:bg-[color:var(--border)]/30',
        checked ? 'text-[var(--t1)]' : 'text-[var(--t2)]',
      ].join(' ')}
    >
      <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-2.5">
        <input
          type="checkbox"
          checked={checked}
          className="doc-sidebar-checkbox"
          onChange={onToggle}
        />
        {isEditing ? (
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <input
              ref={inputRef}
              type="text"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') submitRename();
                if (e.key === 'Escape') onCancelRename?.();
              }}
              onBlur={() => onCancelRename?.()}
              className="min-w-0 flex-1 bg-transparent outline-none text-[var(--t1)] border-b border-[var(--border)] focus:border-[var(--blue)] py-0.5"
            />
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={submitRename}
              className="inline-flex items-center justify-center rounded-md p-1 text-muted-foreground hover:text-[var(--t1)] hover:bg-[color:var(--border)]/30 transition-colors"
              aria-label="Save"
            >
              <CheckIcon className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <>
            <span className="truncate group-hover:text-[var(--t1)]">{collection.name}</span>
            {collection.document_count > 0 && (
              <span className="ml-auto shrink-0 text-xs text-[var(--t3)]">{collection.document_count}</span>
            )}
          </>
        )}
      </label>

      {!isEditing && (
        <div className="relative">
          <button
            ref={buttonRef}
            type="button"
            className={[
              'inline-flex items-center justify-center rounded-md p-1',
              'text-muted-foreground hover:text-[var(--t1)] hover:bg-[color:var(--border)]/30 transition-colors',
              'opacity-0 group-hover:opacity-100 focus:opacity-100',
            ].join(' ')}
            aria-haspopup="menu"
            aria-expanded={open}
            aria-controls={menuId}
            onClick={() => setOpen((v) => !v)}
          >
            <EllipsisIcon className="h-4 w-4" />
          </button>

          {open && (
            <Menu
              ref={menuRef}
              id={menuId}
              className="absolute right-0 top-8 z-50"
            >
              <Menu.Item
                onClick={() => {
                  setOpen(false);
                  onAction?.('rename');
                }}
              >
                Rename
              </Menu.Item>
              <Menu.Item
                variant="danger"
                onClick={() => {
                  setOpen(false);
                  onAction?.('delete');
                }}
              >
                Delete
              </Menu.Item>
            </Menu>
          )}
        </div>
      )}
    </div>
  );
}

export function CollectionsList({
  collections,
  selectedCollections,
  onSelectCollection,
  onAction,
  editingCollectionId = null,
  onSaveRename,
  onCancelRename,
}: CollectionsListProps) {
  return (
    <div className="flex flex-col gap-1 h-full">
      {collections.map((collection) => (
        <CollectionRow
          key={collection.collection_id}
          collection={collection}
          checked={selectedCollections.some((c) => c.collection_id === collection.collection_id)}
          onToggle={() => onSelectCollection(collection)}
          onAction={(action) => onAction?.(collection, action)}
          isEditing={editingCollectionId === collection.collection_id}
          onSaveRename={(newName) => onSaveRename?.(collection.collection_id, newName)}
          onCancelRename={() => onCancelRename?.()}
        />
      ))}
    </div>
  );
}
