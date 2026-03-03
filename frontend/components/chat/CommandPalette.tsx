'use client';

import {
  useEffect,
  useRef,
  useState,
  useMemo,
  useCallback,
} from 'react';
import { Search, FileText, Check, Upload, FolderPlus } from 'lucide-react';
import { useChatStore } from '@/stores/chat.store';
import { useShallow } from 'zustand/react/shallow';
import { useRouter } from 'next/navigation';
import { cn } from '@/utils/cn';
import { apiClient } from '@/api/client';
import { Modal } from '@/components/ui/Modal';

const MAX_RECENT = 5;
const COMMON_ACTIONS = [
  { id: '/upload', label: 'Upload document', icon: Upload, href: '/documents' },
  { id: '/new-project', label: 'New project', icon: FolderPlus, href: '/chat' },
] as const;

interface DocItem {
  document_id: string;
  filename: string;
  file_type?: string;
  processing_status?: string;
  upload_date?: string;
}

type ListItem = { type: 'doc'; doc: DocItem } | { type: 'action'; id: string; label: string; href: string };

function fuzzyMatch(query: string, filename: string): boolean {
  if (!query.trim()) return true;
  const q = query.toLowerCase().trim();
  const f = filename.toLowerCase();
  const words = q.split(/\s+/).filter(Boolean);
  return words.every((w) => f.includes(w));
}

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  /** Called after documents are attached so the Context Sidebar can refetch its list */
  onAttachComplete?: () => void;
}

export function CommandPalette({ open, onClose, onAttachComplete }: CommandPaletteProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const { activeConversationId, setPendingDocuments } = useChatStore(
    useShallow((s) => ({
      activeConversationId: s.activeConversationId,
      setPendingDocuments: s.setPendingDocuments,
    }))
  );

  const [query, setQuery] = useState('');
  const [allDocs, setAllDocs] = useState<DocItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(0);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const isSearchMode = query.trim().length > 0;
  const recentDocs = useMemo(() => allDocs.slice(0, MAX_RECENT), [allDocs]);
  const filteredDocs = useMemo(() => {
    if (!isSearchMode) return [];
    const q = query.trim();
    return allDocs.filter((d) => fuzzyMatch(q, d.filename ?? ''));
  }, [allDocs, isSearchMode, query]);

  const listItems: ListItem[] = useMemo(() => {
    if (isSearchMode) {
      return filteredDocs.map((doc) => ({ type: 'doc' as const, doc }));
    }
    const items: ListItem[] = recentDocs.map((doc) => ({ type: 'doc' as const, doc }));
    COMMON_ACTIONS.forEach((a) => {
      items.push({ type: 'action', id: a.id, label: a.label, href: a.href });
    });
    return items;
  }, [isSearchMode, filteredDocs, recentDocs]);

  const canAttach = activeConversationId != null && listItems.some((i) => i.type === 'doc');
  const selectedCount = selectedIds.size;

  useEffect(() => {
    if (!open) return;
    setQuery('');
    setHighlightIndex(0);
    setSelectedIds(new Set());
    setLoading(true);
    apiClient
      .get<{ documents: DocItem[] }>('/documents')
      .then((res) => setAllDocs(Array.isArray(res?.documents) ? res.documents : []))
      .catch(() => setAllDocs([]))
      .finally(() => setLoading(false));
    setTimeout(() => inputRef.current?.focus(), 0);
  }, [open]);

  useEffect(() => {
    setHighlightIndex((i) => Math.min(Math.max(0, i), Math.max(0, listItems.length - 1)));
  }, [listItems.length]);

  const scrollHighlightIntoView = useCallback((index: number) => {
    const el = listRef.current?.querySelector(`[data-index="${index}"]`);
    el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, []);

  const attachAndClose = useCallback(
    async (ids: string[]) => {
      if (ids.length === 0) {
        onClose();
        return;
      }
      if (!activeConversationId) {
        // No conversation yet — store as pending, attached after first message creates the conv
        const docs = allDocs
          .filter((d) => ids.includes(d.document_id))
          .map((d) => ({ document_id: d.document_id, filename: d.filename, file_type: d.file_type }));
        setPendingDocuments(docs);
        onClose();
        return;
      }
      try {
        await apiClient.post(`/chat/${activeConversationId}/documents`, { document_ids: ids });
        onAttachComplete?.();
      } catch (e) {
        console.error('Attach failed:', e);
      }
      onClose();
    },
    [activeConversationId, allDocs, onAttachComplete, onClose, setPendingDocuments]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!open) return;
      switch (e.key) {
        case 'Escape':
          e.preventDefault();
          onClose();
          return;
        case 'ArrowDown':
          e.preventDefault();
          setHighlightIndex((i) => {
            const next = Math.min(i + 1, listItems.length - 1);
            scrollHighlightIntoView(next);
            return next;
          });
          return;
        case 'ArrowUp':
          e.preventDefault();
          setHighlightIndex((i) => {
            const next = Math.max(0, i - 1);
            scrollHighlightIntoView(next);
            return next;
          });
          return;
        case ' ':
          e.preventDefault();
          const item = listItems[highlightIndex];
          if (item?.type === 'doc') {
            const id = item.doc.document_id;
            setSelectedIds((s) => {
              const next = new Set(s);
              if (next.has(id)) next.delete(id);
              else next.add(id);
              return next;
            });
          }
          return;
        case 'Enter':
          e.preventDefault();
          const highlighted = listItems[highlightIndex];
          if (e.metaKey || e.ctrlKey) {
            if (selectedCount > 0) {
              attachAndClose([...selectedIds]);
            }
            return;
          }
          if (highlighted?.type === 'action') {
            onClose();
            router.push(highlighted.href);
            return;
          }
          if (highlighted?.type === 'doc') {
            if (selectedCount > 0) {
              attachAndClose([...selectedIds]);
            } else {
              attachAndClose([highlighted.doc.document_id]);
            }
          }
          return;
        default:
          break;
      }
    },
    [
      open,
      listItems,
      highlightIndex,
      selectedIds,
      selectedCount,
      onClose,
      attachAndClose,
      router,
      scrollHighlightIntoView,
    ]
  );

  return (
    <Modal
      open={open}
      onClose={onClose}
      maxWidth="max-w-2xl"
      footer={
        canAttach && selectedCount > 0 ? (
          <div className="flex items-center justify-between px-2">
            <span className="text-xs text-muted-foreground font-mono">
              {selectedCount} document{selectedCount !== 1 ? 's' : ''} selected. Press Enter to
              attach.
            </span>
            <span className="text-[10px] font-mono text-muted-foreground/50">⌘↵ add all</span>
          </div>
        ) : undefined
      }
    >
      <div onKeyDown={handleKeyDown} role="presentation">
        {/* Search bar */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border/30">
          <Search size={18} className="text-muted-foreground/60 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search documents or run an action…"
            className="flex-1 bg-transparent text-foreground placeholder:text-muted-foreground/50 outline-none text-sm min-w-0"
            aria-autocomplete="list"
            aria-controls="command-palette-list"
            aria-activedescendant={listItems[highlightIndex] ? `item-${highlightIndex}` : undefined}
          />
        </div>

        {/* Result list */}
        <div
          id="command-palette-list"
          ref={listRef}
          className="max-h-[min(60vh,400px)] overflow-y-auto overscroll-contain py-2"
        >
          {loading ? (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">
              Loading documents…
            </div>
          ) : listItems.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground/80">
              {isSearchMode
                ? 'No documents found. Press Enter to search deep content…'
                : 'No recent documents.'}
            </div>
          ) : (
            <ul className="space-y-0.5">
              {!isSearchMode && listItems.length > 0 && listItems[0].type === 'doc' && (
                <li className="px-3 pt-2 pb-1">
                  <span className="text-[10px] font-mono text-muted-foreground/50 uppercase tracking-wider">
                    Recent documents
                  </span>
                </li>
              )}
              {listItems.map((item, idx) => {
                const highlighted = idx === highlightIndex;
                const showActionsHeader =
                  !isSearchMode && item.type === 'action' && listItems[idx - 1]?.type === 'doc';
                if (item.type === 'action') {
                  const ActionIcon = COMMON_ACTIONS.find((a) => a.id === item.id)?.icon ?? FileText;
                  return (
                    <li key={item.id} className="list-none">
                      {showActionsHeader && (
                        <div className="px-3 pt-3 pb-1">
                          <span className="text-[10px] font-mono text-muted-foreground/50 uppercase tracking-wider">
                            Common actions
                          </span>
                        </div>
                      )}
                      <button
                        type="button"
                        data-index={idx}
                        id={`item-${idx}`}
                        onClick={() => {
                          onClose();
                          router.push(item.href);
                        }}
                        onMouseEnter={() => setHighlightIndex(idx)}
                        className={cn(
                          'w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors',
                          highlighted && 'bg-foreground/10'
                        )}
                      >
                        <span className="w-5 h-5 shrink-0" aria-hidden />
                        <ActionIcon size={14} className="text-muted-foreground/60 shrink-0" />
                        <span className="text-sm text-foreground">{item.label}</span>
                      </button>
                    </li>
                  );
                }
                const doc = item.doc;
                const selected = selectedIds.has(doc.document_id);
                return (
                  <li key={doc.document_id} data-index={idx}>
                    <button
                      type="button"
                      id={`item-${idx}`}
                      onClick={() => {
                        if (activeConversationId) {
                          if (selectedCount > 0 && selectedIds.has(doc.document_id)) {
                            attachAndClose([...selectedIds]);
                          } else if (selectedCount === 0) {
                            attachAndClose([doc.document_id]);
                          }
                        }
                      }}
                      onMouseEnter={() => setHighlightIndex(idx)}
                      className={cn(
                        'w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors',
                        highlighted && 'bg-foreground/10',
                        selected && 'bg-primary/10'
                      )}
                    >
                      <span
                        className={cn(
                          'w-5 h-5 rounded border flex items-center justify-center shrink-0',
                          selected
                            ? 'bg-primary border-primary text-primary-foreground'
                            : 'border-border/40 text-transparent'
                        )}
                      >
                        {selected ? <Check size={12} /> : null}
                      </span>
                      <FileText size={14} className="text-muted-foreground/60 shrink-0" />
                      <span className="text-sm text-foreground truncate flex-1">
                        {doc.filename ?? doc.document_id}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </Modal>
  );
}
