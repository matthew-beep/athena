'use client';

import { useEffect, useState } from 'react';
import { FileText, FileType, Video, Loader2, CheckCircle2, AlertCircle, Trash2 } from 'lucide-react';
import { useAuthStore } from '@/stores/auth.store';
import { cn } from '@/utils/cn';

export interface ProcessingDocDisplay {
  document_id: string;
  filename: string;
  mime_type?: string;
  status: string;
  progress: number;
  chunks: number;
  concepts: number;
}

interface Document {
  document_id: string;
  filename: string;
  file_type?: string;
  processing_status: string;
  upload_date?: string;
  word_count?: number;
  chunk_count?: number;
  error_message?: string;
}

interface Progress {
  stage: string;
  done: number;
  total: number;
  active: boolean;
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

const TYPE_ICON: Record<string, React.ReactNode> = {
  pdf:      <FileText size={14} />,
  video:    <Video size={14} />,
  markdown: <FileType size={14} />,
  default:  <FileText size={14} />,
};

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

interface DocumentListProps {
  refreshKey?: number;
  processingDocs?: ProcessingDocDisplay[];
}

export function DocumentList({ refreshKey, processingDocs = [] }: DocumentListProps) {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [progressMap, setProgressMap] = useState<Record<string, Progress>>({});
  const [deleting, setDeleting] = useState<Set<string>>(new Set());

  const fetchDocuments = () => {
    const token = useAuthStore.getState().token;
    return fetch('/api/documents', {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then((r) => r.json())
      .then((data) => { setDocuments(data.documents ?? []); setError(null); })
      .catch(() => setError('Failed to load documents'));
  };

  // Fetch on mount and on refreshKey change
  useEffect(() => {
    setLoading(true);
    fetchDocuments().finally(() => setLoading(false));
  }, [refreshKey]);

  // Poll document list every 3s while any are still processing
  useEffect(() => {
    const hasPending = documents.some(
      (d) => d.processing_status === 'processing' || d.processing_status === 'pending'
    );
    if (!hasPending) return;
    const t = setInterval(fetchDocuments, 3000);
    return () => clearInterval(t);
  }, [documents]);

  // Poll /progress every 800ms for actively processing documents
  useEffect(() => {
    const processingDocs = documents.filter((d) => d.processing_status === 'processing');
    if (processingDocs.length === 0) {
      setProgressMap({});
      return;
    }
    const token = useAuthStore.getState().token;
    const headers = token ? { Authorization: `Bearer ${token}` } : {};

    const poll = () => {
      processingDocs.forEach((doc) => {
        fetch(`/api/documents/${doc.document_id}/progress`, { headers })
          .then((r) => r.json())
          .then((data: Progress) => {
            setProgressMap((prev) => ({ ...prev, [doc.document_id]: data }));
          })
          .catch(() => {});
      });
    };

    poll();
    const t = setInterval(poll, 800);
    return () => clearInterval(t);
  }, [documents]);

  const handleDelete = async (documentId: string) => {
    setDeleting((prev) => new Set(prev).add(documentId));
    const token = useAuthStore.getState().token;
    try {
      await fetch(`/api/documents/${documentId}`, {
        method: 'DELETE',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      setDocuments((prev) => prev.filter((d) => d.document_id !== documentId));
      setProgressMap((prev) => { const n = { ...prev }; delete n[documentId]; return n; });
    } catch {
      // silently ignore — list will re-sync on next poll
    } finally {
      setDeleting((prev) => { const n = new Set(prev); n.delete(documentId); return n; });
    }
  };

  const processingIds = new Set(processingDocs.map((d) => d.document_id));

  const allItems = [
    // Upload placeholders (while file is still transferring)
    ...processingDocs.map((d) => ({
      id: d.document_id,
      name: d.filename,
      status: d.status,
      progress: d.progress,
      done: 0,
      total: 0,
      chunks: d.chunks,
      type: getDocType(d.filename, d.mime_type),
      date: 'Just now',
      isLive: true,
      error: undefined as string | undefined,
    })),
    // Real DB documents (excluding upload placeholders)
    ...documents.filter((d) => !processingIds.has(d.document_id)).map((d) => {
      const prog = progressMap[d.document_id];
      const isActive = d.processing_status === 'processing' && !!prog?.active;
      return {
        id: d.document_id,
        name: d.filename,
        status: isActive ? prog.stage : d.processing_status,
        progress: isActive && prog.total > 0 ? Math.round((prog.done / prog.total) * 100) : 0,
        done: prog?.done ?? 0,
        total: prog?.total ?? 0,
        chunks: isActive ? prog.done : (d.chunk_count ?? 0),
        type: getDocType(d.filename, d.file_type),
        date: formatDate(d.upload_date) ?? '—',
        isLive: isActive,
        error: d.error_message,
      };
    }),
  ];

  if (loading && documents.length === 0 && processingDocs.length === 0) {
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

  if (allItems.length === 0) {
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
    <ul className="space-y-1.5">
      {allItems.map((doc) => {
        const st = STATUS_CONFIG[doc.status] ?? STATUS_CONFIG.processing;
        const isDeleting = deleting.has(doc.id);

        return (
          <li
            key={doc.id}
            className={cn(
              'group glass rounded-sm px-3 py-2.5 transition-opacity',
              doc.isLive && 'border-primary/20',
              isDeleting && 'opacity-40 pointer-events-none'
            )}
          >
            <div className="flex items-start gap-3">
              {/* File type icon */}
              <div className={cn(
                'w-8 h-8 rounded-sm glass-subtle flex items-center justify-center flex-shrink-0 mt-0.5 border border-border/20',
                doc.isLive ? 'text-primary' : 'text-muted-foreground'
              )}>
                {TYPE_ICON[doc.type] || <FileText size={14} />}
              </div>

              {/* Name + status */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{doc.name}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className={cn('flex items-center gap-1 text-xs', st.color)}>
                    {st.icon}
                    {st.label}
                    {doc.isLive && doc.status === 'embedding' && doc.total > 0 && (
                      <span className="text-muted-foreground">
                        {doc.done} / {doc.total}
                      </span>
                    )}
                  </span>
                  {!doc.isLive && doc.chunks > 0 && (
                    <span className="text-xs text-muted-foreground font-mono">· {doc.chunks} chunks</span>
                  )}
                  {doc.error && (
                    <span className="text-xs text-red-400/70 font-mono truncate max-w-[200px]" title={doc.error}>
                      {doc.error}
                    </span>
                  )}
                </div>
              </div>

              {/* Date + delete */}
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className="text-xs text-muted-foreground font-mono">{doc.date}</span>
                {!doc.isLive && (
                  <button
                    onClick={() => handleDelete(doc.id)}
                    disabled={isDeleting}
                    className="opacity-0 group-hover:opacity-100 w-6 h-6 rounded-sm flex items-center justify-center text-muted-foreground/50 hover:text-red-400 hover:bg-red-500/10 transition-all"
                    title="Delete document"
                  >
                    {isDeleting ? (
                      <Loader2 size={12} className="animate-spin" />
                    ) : (
                      <Trash2 size={12} />
                    )}
                  </button>
                )}
              </div>
            </div>

            {/* Progress bar — shown while actively processing */}
            {doc.isLive && doc.status !== 'complete' && (
              <div className="mt-2 space-y-1">
                <div className="h-px rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-300"
                    style={{
                      width: doc.status === 'embedding' && doc.total > 0
                        ? `${Math.round((doc.done / doc.total) * 100)}%`
                        : doc.progress > 0 ? `${doc.progress}%` : '15%',
                      background: 'hsl(var(--primary) / 0.6)',
                    }}
                  />
                </div>
                <div className="flex justify-between">
                  <span className="text-[10px] text-muted-foreground font-mono">
                    {doc.status === 'uploading'   && 'Uploading file…'}
                    {doc.status === 'extracting'  && 'Extracting text…'}
                    {doc.status === 'chunking'    && 'Splitting into chunks…'}
                    {doc.status === 'embedding'   && doc.total > 0
                      ? `Embedding chunk ${doc.done} of ${doc.total}…`
                      : doc.status === 'embedding' && 'Embedding…'}
                    {doc.status === 'processing'  && 'Processing…'}
                  </span>
                  {doc.status === 'embedding' && doc.total > 0 && (
                    <span className="text-[10px] text-muted-foreground font-mono">
                      {Math.round((doc.done / doc.total) * 100)}%
                    </span>
                  )}
                </div>
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
