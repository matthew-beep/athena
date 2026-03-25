'use client';

import { useState, useEffect, useId, useRef } from 'react';
import { FileText, Loader2, CheckCircle2, AlertCircle, MessageSquare, Plus, EllipsisIcon } from 'lucide-react';
import { useAuthStore } from '@/stores/auth.store';
import { useChatStore } from '@/stores/chat.store';
import { cn } from '@/utils/cn';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/api/client';
import { Modal } from '@/components/ui/Modal';
import type { CollectionItem, Message, ProgressMap } from '@/types';
import { Menu } from '@/components/ui/Menu';

export interface DocumentItem {
  document_id: string;
  filename: string;
  file_type?: string;
  processing_status: string;
  upload_date?: string;
  word_count?: number;
  chunk_count?: number;
  error_message?: string;
  collection_id?: string;
  collection_name?: string;
}

const STATUS_CONFIG: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  pending:    { label: 'Pending',    icon: <FileText size={11} />,                             color: 'text-amber-400' },
  processing: { label: 'Processing', icon: <Loader2 size={11} className="animate-spin" />,    color: 'text-blue-400' },
  complete:   { label: 'Ready',      icon: <CheckCircle2 size={11} />,                         color: 'text-green-400' },
  error:      { label: 'Error',      icon: <AlertCircle size={11} />,                          color: 'text-red-400' },
  extracting: { label: 'Extracting', icon: <Loader2 size={11} className="animate-spin" />,    color: 'text-primary' },
  chunking:   { label: 'Chunking',   icon: <Loader2 size={11} className="animate-spin" />,    color: 'text-primary' },
  embedding:  { label: 'Embedding',  icon: <Loader2 size={11} className="animate-spin" />,    color: 'text-primary' },
  uploading:  { label: 'Uploading',  icon: <Loader2 size={11} className="animate-spin" />,    color: 'text-primary' },
};

function TypeBadge({ type }: { type: string }) {
  const styles: Record<string, { bg: string; border: string; color: string; label: string }> = {
    pdf:      { bg: 'rgba(248,113,113,0.1)',  border: 'rgba(248,113,113,0.28)', color: 'var(--red)',    label: 'PDF' },
    video:    { bg: 'rgba(251,191,36,0.1)',   border: 'rgba(251,191,36,0.28)',  color: 'var(--amber)',  label: 'VID' },
    markdown: { bg: 'var(--blue-a)',          border: 'var(--blue-br)',         color: 'var(--blue)',   label: 'MD'  },
    default:  { bg: 'var(--blue-a)',          border: 'var(--blue-br)',         color: 'var(--blue)',   label: 'TXT' },
  };
  const s = styles[type] ?? styles.default;
  return (
    <div
      className="flex items-center justify-center flex-shrink-0"
      style={{
        width: 28, height: 28, borderRadius: 7,
        background: s.bg, border: `1px solid ${s.border}`,
        color: s.color, fontSize: 8, fontWeight: 700,
        letterSpacing: '0.04em', fontFamily: 'var(--fm)',
      }}
    >
      {s.label}
    </div>
  );
}

function getDocType(filename: string, mime?: string): string {
  const ext = filename.split('.').pop()?.toLowerCase() ?? '';
  if (['mp4', 'webm', 'mov', 'avi', 'mkv'].includes(ext)) return 'video';
  if (['md', 'markdown'].includes(ext)) return 'markdown';
  if (ext === 'pdf') return 'pdf';
  return 'default';
}

function formatDate(iso?: string) {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function DocumentMenu({
  isDeleting,
  collections,
  currentCollectionId,
  onDelete,
  onMoveToCollection,
}: {
  isDeleting: boolean;
  collections: CollectionItem[];
  currentCollectionId: string | null;
  onDelete: () => void;
  onMoveToCollection: (collectionId: string | null) => void;
}) {
  const menuId = useId();
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<'main' | 'collections'>('main');
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Node | null;
      if (!target) return;
      if (buttonRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      setOpen(false);
      setView('main');
    };
    window.addEventListener('pointerdown', onPointerDown);
    return () => window.removeEventListener('pointerdown', onPointerDown);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setOpen(false); setView('main'); }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open]);

  const close = () => { setOpen(false); setView('main'); };

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        type="button"
        disabled={isDeleting}
        onClick={() => { setOpen(v => !v); setView('main'); }}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        className="opacity-0 group-hover:opacity-100 focus:opacity-100 w-6 h-6 rounded-sm flex items-center justify-center text-muted-foreground/50 hover:text-[var(--t1)] hover:bg-[var(--raised-h)] transition-all"
      >
        <EllipsisIcon size={12} />
      </button>

      {open && (
        <Menu ref={menuRef} id={menuId} className="absolute right-0 top-8 z-50">
          {view === 'main' ? (
            <>
              <Menu.Item onClick={() => setView('collections')}>
                Move to collection
              </Menu.Item>
              <Menu.Item variant="danger" onClick={() => { close(); onDelete(); }}>
                {isDeleting ? 'Deleting…' : 'Delete'}
              </Menu.Item>
            </>
          ) : (
            <>
              <Menu.Item onClick={() => setView('main')}>← Back</Menu.Item>
              {currentCollectionId && (
                <Menu.Item onClick={() => { close(); onMoveToCollection(null); }}>
                  Unassign
                </Menu.Item>
              )}
              {collections.map((c) => (
                <Menu.Item
                  key={c.collection_id}
                  onClick={() => { close(); onMoveToCollection(c.collection_id); }}
                  className={c.collection_id === currentCollectionId ? 'text-[var(--t1)]' : ''}
                >
                  {c.name}
                </Menu.Item>
              ))}
              {collections.length === 0 && (
                <div className="px-3 py-2 text-xs text-[var(--t4)]">No collections</div>
              )}
            </>
          )}
        </Menu>
      )}
    </div>
  );
}

interface DocumentConversation {
  conversation_id: string;
  title: string | null;
  last_active: string;
}

interface DocumentListProps {
  documents: DocumentItem[];
  loading: boolean;
  error: string | null;
  search: string;
  progressMap?: ProgressMap | null;
  collectionIds?: string[];
  fileType?: string;
  collections?: CollectionItem[];
  onDelete: (documentId: string) => void;
  onMoveToCollection: (documentId: string, collectionId: string | null) => Promise<void>;
}

export function DocumentList({
  documents,
  loading,
  error,
  search = "",
  progressMap = null,
  collectionIds = [],
  fileType = "all",
  collections = [],
  onDelete,
  onMoveToCollection,
}: DocumentListProps) {
  const [deleting, setDeleting] = useState<Set<string>>(new Set());
  const [conversationsModal, setConversationsModal] = useState<{
    open: boolean;
    documentId: string | null;
    conversations: DocumentConversation[];
  }>({ open: false, documentId: null, conversations: [] });
  const router = useRouter();
  const { setActiveConversation, setMessages, addConversation, setPendingDocuments } = useChatStore();

  const handleDelete = async (documentId: string) => {
    setDeleting((prev) => new Set(prev).add(documentId));
    const token = useAuthStore.getState().token;
    const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
    try {
      await fetch(`/api/documents/${documentId}`, { method: 'DELETE', headers });
      onDelete(documentId);
    } catch {
      // silently ignore — parent will re-sync on next fetch
    } finally {
      setDeleting((prev) => { const n = new Set(prev); n.delete(documentId); return n; });
    }
  };

  const handleChat = async (documentId: string) => {
    try {
      const res = await apiClient.get<{ conversations: DocumentConversation[] }>(
        `/documents/${documentId}/conversations`
      );
      const list = res.conversations ?? [];
      if (list.length > 0) {
        setConversationsModal({ open: true, documentId, conversations: list });
      } else {
        const doc = documents.find((d) => d.document_id === documentId);
        setPendingDocuments(doc ? [{ document_id: doc.document_id, filename: doc.filename ?? documentId, file_type: doc.file_type }] : []);
        setActiveConversation(null);
        router.push('/chat');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handlePickConversation = async (conv: DocumentConversation) => {
    const { documentId } = conversationsModal;
    setActiveConversation(conv.conversation_id);
    addConversation({
      conversation_id: conv.conversation_id,
      title: conv.title ?? 'New Conversation',
      knowledge_tier: 'ephemeral',
      started_at: conv.last_active,
      last_active: conv.last_active,
    });
    try {
      const msgs = await apiClient.get<Message[]>(`/chat/conversations/${conv.conversation_id}/messages`);
      setMessages(conv.conversation_id, msgs);
    } catch (e) {
      console.error(e);
    }
    if (documentId) {
      try {
        await apiClient.post(`/chat/${conv.conversation_id}/documents`, { document_ids: [documentId] });
      } catch (e) {
        console.error('Failed to attach document to conversation:', e);
      }
    }
    setConversationsModal((m) => ({ ...m, open: false }));
    router.push('/chat');
  };

  const handleNewChatFromModal = () => {
    const { documentId } = conversationsModal;
    if (documentId) {
      const doc = documents.find((d) => d.document_id === documentId);
      setPendingDocuments(doc ? [{ document_id: doc.document_id, filename: doc.filename ?? documentId, file_type: doc.file_type }] : []);
    }
    setActiveConversation(null);
    setConversationsModal((m) => ({ ...m, open: false }));
    router.push('/chat');
  };

  const items = documents
    .map((d) => {
      const prog = progressMap?.[d.document_id];
      const isActive = d.processing_status === 'processing' && !!prog?.active;
      return {
        id: d.document_id,
        name: d.filename,
        searchName: d.filename.toLowerCase(),
        status: isActive ? prog!.stage : d.processing_status,
        progress: isActive && prog!.total > 0 ? Math.round((prog!.done / prog!.total) * 100) : 0,
        done: prog?.done ?? 0,
        total: prog?.total ?? 0,
        chunks: isActive ? prog!.done : (d.chunk_count ?? 0),
        type: getDocType(d.filename, d.file_type),
        date: formatDate(d.upload_date) ?? '—',
        isLive: isActive,
        error: d.error_message,
        collectionId: d.collection_id ?? null,
        collectionName: d.collection_name ?? null,
        fileType: getDocType(d.filename, d.file_type),
      };
    })
    .filter((d) => !search || d.searchName.includes(search.toLowerCase()))
    .filter((d) => collectionIds.length === 0 || collectionIds.includes(d.collectionId ?? ''))
    .filter((d) => fileType === 'all' || d.fileType === fileType.toLowerCase());

  if (loading && documents.length === 0) {
    return (
      <div className="flex items-center justify-center py-10 gap-2 text-muted-foreground">
        <Loader2 size={15} className="animate-spin" />
        <span className="text-sm">Loading documents…</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-10 gap-2">
        <AlertCircle size={18} className="text-red-400/60" />
        <p className="text-sm text-muted-foreground">{error}</p>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-3">
        <div className="w-10 h-10 rounded-sm bg-muted/30 border border-border flex items-center justify-center">
          <FileText size={18} className="text-muted-foreground/50" />
        </div>
        <p className="text-sm text-muted-foreground">No documents yet</p>
        <p className="text-xs text-muted-foreground/50 font-mono">Upload a document above to get started</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col w-full">
      {/* Column header */}
      <div
        className="grid items-center px-5 py-2 border-b border-[var(--border)]"
        style={{ gridTemplateColumns: '36px 1fr 150px 95px 70px' }}
      >
        <div />
        <div className="slabel">Name</div>
        <div className="slabel">Collection</div>
        <div className="slabel">Added</div>
        <div />
      </div>

      {/* Rows */}
      <div className="flex flex-col">
        {items.map((doc) => {
          const st = STATUS_CONFIG[doc.status] ?? STATUS_CONFIG.processing;
          const isDeleting = deleting.has(doc.id);

          return (
            <div
              key={doc.id}
              className={cn(
                'group grid items-center px-5 py-2.5 border-b border-[var(--border)] transition-colors hover:bg-[var(--raised-h)]',
                isDeleting && 'opacity-40 pointer-events-none',
              )}
              style={{ gridTemplateColumns: '36px 1fr 150px 95px 70px' }}
            >
              {/* Type badge */}
              <div className="flex items-center">
                <TypeBadge type={doc.type} />
              </div>

              {/* Name + status */}
              <div className="min-w-0 flex flex-col justify-center gap-0.5 pr-3">
                <p className="text-[13px] text-[var(--t1)] truncate" style={{ fontFamily: 'var(--fb)' }}>
                  {doc.name}
                </p>
                {doc.isLive && (
                  <div className="flex flex-col gap-0.5">
                    <div className="flex items-center gap-1.5">
                      <span className={cn('text-[11px]', st.color)}>{st.label}</span>
                      {doc.status === 'embedding' && doc.total > 0 && (
                        <span className="text-[11px] text-[var(--t4)] font-mono">{doc.done}/{doc.total}</span>
                      )}
                    </div>
                    <div className="h-px w-32 rounded-full bg-[var(--border)] overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-300"
                        style={{
                          width: doc.status === 'embedding' && doc.total > 0
                            ? `${Math.round((doc.done / doc.total) * 100)}%`
                            : '20%',
                          background: 'hsl(var(--primary) / 0.6)',
                          animation: doc.status !== 'embedding' ? 'shimmerPulse 2s ease-in-out infinite' : undefined,
                        }}
                      />
                    </div>
                  </div>
                )}
                {!doc.isLive && doc.status !== 'complete' && (
                  <span className={cn('text-[11px] flex items-center gap-1', st.color)}>
                    {st.icon}{st.label}
                  </span>
                )}
                {doc.error && (
                  <span className="text-[11px] text-red-400/70 truncate font-mono" title={doc.error}>
                    {doc.error}
                  </span>
                )}
              </div>

              {/* Collection */}
              <div className="flex items-center gap-1.5 min-w-0 pr-2">
                {doc.collectionName ? (
                  <>
                    <div className="w-1.5 h-1.5 rounded-full flex-shrink-0 bg-[var(--blue)]" />
                    <span className="text-[12px] text-[var(--t2)] truncate" style={{ fontFamily: 'var(--fb)' }}>
                      {doc.collectionName}
                    </span>
                  </>
                ) : (
                  <span className="text-[12px] text-[var(--t4)]">—</span>
                )}
              </div>

              {/* Added */}
              <div className="flex items-center">
                <span className="text-[12px] text-[var(--t3)]">{doc.date}</span>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-1">
                <button
                  className="flex items-center justify-center w-6 h-6 rounded-sm text-[var(--t3)] hover:text-[var(--t1)] hover:bg-[var(--raised-h)] transition-all"
                  onClick={() => handleChat(doc.id)}
                  title="Chat with this document"
                >
                  <MessageSquare size={12} />
                </button>
                {!doc.isLive && (
                  <DocumentMenu
                    isDeleting={isDeleting}
                    collections={collections}
                    currentCollectionId={doc.collectionId}
                    onDelete={() => handleDelete(doc.id)}
                    onMoveToCollection={(collectionId) => onMoveToCollection(doc.id, collectionId)}
                  />
                )}
              </div>
            </div>
          );
        })}
      </div>

      <Modal
        open={conversationsModal.open}
        onClose={() => setConversationsModal((m) => ({ ...m, open: false }))}
        title="Chats for this document"
        footer={
          <button
            type="button"
            onClick={handleNewChatFromModal}
            className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium text-foreground bg-muted/50 hover:bg-muted border border-border/50 transition-colors"
          >
            <Plus size={14} />
            Start new chat
          </button>
        }
      >
        <ul className="max-h-64 overflow-y-auto p-2">
          {conversationsModal.conversations.map((conv) => (
            <li key={conv.conversation_id}>
              <button
                type="button"
                onClick={() => handlePickConversation(conv)}
                className="w-full text-left px-3 py-2.5 rounded-lg text-sm text-foreground hover:bg-muted/50 transition-colors flex flex-col gap-0.5"
              >
                <span className="font-medium truncate">{conv.title || 'New Conversation'}</span>
                <span className="text-xs text-muted-foreground font-mono">
                  {formatDate(conv.last_active) ?? conv.last_active}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </Modal>
    </div>
  );
}
