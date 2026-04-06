'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  FileText,
  X,
  Sparkles,
  ExternalLink,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { useChatStore } from '@/stores/chat.store';
import type { PendingDocument } from '@/stores/chat.store';
import type { ConversationDocument, RagSource } from '@/types';
import { useSystemStore } from '@/stores/system.store';
import { useShallow } from 'zustand/react/shallow';
import { cn } from '@/utils/cn';
import { apiClient } from '@/api/client';
import { useModelStats } from '@/hooks/useSystemStats'


function isSyntheticDoc(filename: string): boolean {
  const lower = filename.toLowerCase();
  return lower.includes('synthesis') || lower.includes('research-report') || lower.includes('-report.');
}

// ── Working Memory Card (Pinned Sources) ─────────────────────────────────────

function WorkingMemoryCard({
  documents,
  mutedIds,
  onMuteToggle,
  onRemove,
  onAddClick,
  isSearchAll,
}: {
  documents: ConversationDocument[];
  mutedIds: Set<string>;
  onMuteToggle: (id: string) => void;
  onRemove: (id: string) => void;
  onAddClick: () => void;
  isSearchAll: boolean;
}) {
  return (
    <div className="px-3 py-2.5 border-b border-border/20">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <FileText size={10} className="text-muted-foreground/50" />
          <span className="text-[10px] text-muted-foreground/60 uppercase tracking-wider">
            Scope
          </span>
        </div>
        <button
          type="button"
          onClick={onAddClick}
          className="text-[10px] font-mono text-muted-foreground/40 hover:text-foreground transition-colors"
        >
          + Add
        </button>
      </div>
      {isSearchAll ? (
        <p className="text-[10px] text-muted-foreground/40 py-2 leading-relaxed">
          Global Chat Mode — Searching all documents.
        </p>
      ) : documents.length === 0 ? (
        <p className="text-[10px] text-[var(--t1)] py-2 leading-relaxed">
          General Chat Mode — No documents in scope.
        </p>
      ) : (
        <ul className="space-y-1">
          {documents.map((doc) => {
            const isSynthetic = isSyntheticDoc(doc.filename ?? '');
            const muted = mutedIds.has(doc.document_id);
            return (
              <li
                key={doc.document_id}
                className={cn(
                  'group flex items-center gap-2 px-2 py-1.5 rounded-md border transition-colors',
                  isSynthetic
                    ? 'bg-[var(--blue-a)] border-[var(--blue-br)]'
                    : 'bg-[var(--raised)] border-[var(--border)]'
                )}
                title={doc.filename}
              >
                {isSynthetic ? (
                  <Sparkles
                    size={10}
                    className="text-primary/80 shrink-0"
                    aria-hidden
                  />
                ) : (
                  <FileText
                    size={10}
                    className="text-muted-foreground/45 shrink-0"
                    aria-hidden
                  />
                )}
                <span
                  className={cn(
                    'text-[10px] truncate flex-1 min-w-0',
                    muted ? 'text-[var(--t2)] line-through' : 'text-[var(--t1)]'
                  )}
                >
                  {doc.filename ?? doc.document_id}
                </span>
                <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                  <button
                    type="button"
                    onClick={() => onMuteToggle(doc.document_id)}
                    className="p-1 rounded text-muted-foreground/50 hover:text-foreground transition-colors"
                    title={muted ? 'Unmute (include in RAG)' : 'Mute (temporarily ignore)'}
                    aria-label={muted ? 'Unmute' : 'Mute'}
                  >
                    {muted ? (
                      <VolumeX size={10} />
                    ) : (
                      <Volume2 size={10} />
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => onRemove(doc.document_id)}
                    className="p-1 rounded text-muted-foreground/50 hover:text-red-400 transition-colors"
                    title="Remove from scope"
                    aria-label="Remove"
                  >
                    <X size={10} />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

// ── Citation Shutter (drill-down drawer) ─────────────────────────────────────

function CitationShutter({
  source,
  onClose,
}: {
  source: { filename: string; text: string; chunk_index: number; document_id: string; chunk_id?: string; score_type?: string; vector_score?: number; bm25_score?: number };
  onClose: () => void;
}) {
  return (
    <div className="absolute inset-0 z-10 flex flex-col bg-background/95 border-l border-border/40 rounded-l-lg overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 border-b border-border/30 flex-shrink-0">
        <span className="text-[10px] font-mono text-muted-foreground/70 truncate">
          Citation
        </span>
        <button
          type="button"
          onClick={onClose}
          className="p-1 rounded text-muted-foreground/50 hover:text-foreground transition-colors"
          aria-label="Close"
        >
          <X size={12} />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        <div>
          <p className="text-[9px] font-mono text-muted-foreground/50 uppercase tracking-wider mb-1">
            Source
          </p>
          <p className="text-[10px] font-mono text-foreground/90 truncate">
            {source.filename}
          </p>
        </div>
        {source.chunk_id != null && (
          <div>
            <p className="text-[9px] font-mono text-muted-foreground/50 uppercase tracking-wider mb-1">
              Chunk ID
            </p>
            <p className="text-[10px] font-mono text-muted-foreground/70 break-all">
              {source.chunk_id}
            </p>
          </div>
        )}
        <div>
          <p className="text-[9px] font-mono text-muted-foreground/50 uppercase tracking-wider mb-1">
            Chunk index
          </p>
          <p className="text-[10px] font-mono text-muted-foreground/70">
            {source.chunk_index}
          </p>
        </div>
        {source.score_type && (
          <div>
            <p className="text-[9px] font-mono text-muted-foreground/50 uppercase tracking-wider mb-1">
              Scores
            </p>
            <div className="flex gap-3">
              <span className="text-[10px] font-mono text-muted-foreground/70">
                V {source.vector_score?.toFixed(3) ?? '—'}
              </span>
              {source.score_type === 'hybrid' && (
                <span className="text-[10px] font-mono text-muted-foreground/70">
                  BM25 {source.bm25_score && source.bm25_score > 0 ? source.bm25_score.toFixed(2) : '—'}
                </span>
              )}
            </div>
          </div>
        )}
        <div>
          <p className="text-[9px] font-mono text-muted-foreground/50 uppercase tracking-wider mb-1">
            Excerpt
          </p>
          <p className="text-[10px] font-mono text-foreground/80 leading-relaxed whitespace-pre-wrap">
            {source.text || '—'}
          </p>
        </div>
        <a
          href={`/documents`}
          className="inline-flex items-center gap-1.5 px-2 py-1.5 rounded-md border border-border/40 text-[10px] font-mono text-muted-foreground/70 hover:text-foreground hover:border-border transition-colors"
        >
          <ExternalLink size={10} />
          Jump to Source
        </a>
      </div>
    </div>
  );
}

// ── Context Sidebar (main export) ────────────────────────────────────────────

export function DocumentBar() {
  const {
    activeConversationId,
    contextTokens,
    contextBudget,
    activeModel,
    citationShutter,
    setCitationShutter,
    setCommandPaletteOpen,
    pendingDocuments,
    setPendingDocuments,
    conversationDocuments,
    removeConversationDocument,
    requestStartedAt,
    firstTokenReachedMs,
    conversationSearchAll,
    pendingSearchAll,
    selectedMessageId,
    messages
  } = useChatStore(
    useShallow((s) => ({
      activeConversationId: s.activeConversationId,
      contextTokens: s.contextTokens,
      contextBudget: s.contextBudget,
      activeModel: s.activeModel,
      citationShutter: s.citationShutter,
      setCitationShutter: s.setCitationShutter,
      setCommandPaletteOpen: s.setCommandPaletteOpen,
      pendingDocuments: s.pendingDocuments,
      setPendingDocuments: s.setPendingDocuments,
      conversationDocuments: s.conversationDocuments,
      removeConversationDocument: s.removeConversationDocument,
      requestStartedAt: s.requestStartedAt,
      firstTokenReachedMs: s.firstTokenReachedMs,
      conversationSearchAll: s.conversationSearchAll,
      pendingSearchAll: s.pendingSearchAll,
      selectedMessageId: s.selectedMessageId,
      messages: s.messages,
    }))
  );

  const modelStats = useModelStats();
  const lastInferenceStats = useSystemStore((s) => s.lastInferenceStats);
  const ttftSum = useSystemStore((s) => s.ttftSum);
  const ttftCount = useSystemStore((s) => s.ttftCount);
  const averageTtftMs = ttftCount > 0 ? Math.round(ttftSum / ttftCount) : 0;



  const activeMessageId = activeConversationId
  ? selectedMessageId[activeConversationId]
  : undefined;  
  
  
  const thread = activeConversationId ? (messages[activeConversationId] ?? []) : [];

  const activeMessage = activeMessageId
  ? thread.find((m) => m.message_id === activeMessageId)
  : undefined;

  const activeMessageSources = activeMessage?.rag_sources ?? [];

  const deduped = useMemo(() => {
    const map = new Map<string, RagSource>();
    for (const s of activeMessageSources) {
      const existing = map.get(s.filename);
      if (!existing || s.score > existing.score) map.set(s.filename, s);
    }
    return [...map.values()].sort((a, b) => b.score - a.score);
  }, [activeMessageSources]);

  const isSearchAll = activeConversationId
  ? (conversationSearchAll[activeConversationId] ?? false)
  : pendingSearchAll;

  const [waitingElapsedMs, setWaitingElapsedMs] = useState(0);
  useEffect(() => {
    if (requestStartedAt == null) return;
    const tick = () => setWaitingElapsedMs(Math.round(Date.now() - requestStartedAt));
    tick();
    const interval = setInterval(tick, 100);
    return () => clearInterval(interval);
  }, [requestStartedAt]);

  const [mutedIds, setMutedIds] = useState<Set<string>>(new Set());

  const storeDocuments = activeConversationId ? (conversationDocuments[activeConversationId] ?? []) : [];
  const displayDocuments: ConversationDocument[] = activeConversationId
    ? storeDocuments
    : pendingDocuments.map((d) => ({ document_id: d.document_id, filename: d.filename, file_type: d.file_type }));

  const tokens = activeConversationId
    ? (contextTokens[activeConversationId] ?? 0)
    : 0;
  const pct = contextBudget > 0 ? Math.min(tokens / contextBudget, 1) : 0;

  const handleRemoveDoc = (documentId: string) => {
    if (!activeConversationId) {
      setPendingDocuments(pendingDocuments.filter((d) => d.document_id !== documentId));
      return;
    }
    apiClient
      .delete(`/chat/${activeConversationId}/documents/${documentId}`)
      .then(() => removeConversationDocument(activeConversationId, documentId))
      .catch(console.error);
  };

  const handleMuteToggle = (id: string) => {
    setMutedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const shutterOpen = citationShutter != null;

  return (
    <div
      className={cn(
        'flex flex-col h-full min-w-0 w-72 max-w-full shrink-0 rounded-lg overflow-hidden border border-border/30 relative',
        shutterOpen && 'bg-foreground/[0.02]'
      )}
    >
      {shutterOpen && (
        <div
          className="absolute inset-0 z-0 opacity-60 pointer-events-none bg-background/50"
          aria-hidden
        />
      )}

      {/* Context usage (compact) */}
      <div className="px-3 py-2 border-b border-border/20 flex-shrink-0 relative z-[1]">
        <div className="flex items-center justify-between text-[10px] font-mono text-muted-foreground/50 mb-1">
          <span>Context</span>
          <span>
            {tokens.toLocaleString()} / {contextBudget.toLocaleString()}
          </span>
        </div>
        <div className="h-0.5 rounded-full bg-foreground/5 overflow-hidden">
          <div
            className={cn(
              'h-full rounded-full transition-all duration-300',
              pct > 0.8 ? 'bg-red-400/50' : pct > 0.6 ? 'bg-amber-400/50' : 'bg-foreground/20'
            )}
            style={{ width: `${pct * 100}%` }}
          />
        </div>
        <p className="text-[9px] font-mono text-muted-foreground/40 mt-0.5">
          {activeModel ?? '—'} · Tier 1
        </p>
      </div>

      {/* Middle: Scope + retrieval sources share space between context and footer (2:1) */}
      <div className="flex min-h-0 flex-1 flex-col relative z-[1]">
        <div className="min-h-0 min-w-0 flex-[2] overflow-y-auto">
          <WorkingMemoryCard
            documents={displayDocuments}
            mutedIds={mutedIds}
            onMuteToggle={handleMuteToggle}
            onRemove={handleRemoveDoc}
            onAddClick={() => setCommandPaletteOpen(true)}
            isSearchAll={isSearchAll}
          />
        </div>
        <div className="min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto border-t border-border/20 px-3 py-2">
        <div className="flex items-center justify-between text-[10px] font-mono text-muted-foreground/50 mb-2">
          <span>Retrieval sources</span>
          {activeMessageSources.length > 0 && (
            <span className="tabular-nums">{activeMessageSources.length}</span>
          )}
        </div>
        {!activeConversationId || !activeMessageId ? (
          <p className="text-[10px] text-muted-foreground/45 leading-relaxed">Open a chat and select an assistant message.</p>
        ) : activeMessageSources.length === 0 ? (
          <p className="text-[10px] text-muted-foreground/45 leading-relaxed">No sources for this message.</p>
        ) : (
          <ul className="flex flex-col gap-2 min-w-0">
            {deduped.map((source, i) => (
              <li
                key={source.chunk_id ?? `${source.document_id}-${source.chunk_index}-${i}`}
                className="min-w-0 rounded-md border border-border/35 bg-foreground/[0.025] p-2.5 flex items-center gap-2"
              >
                <div className="flex items-start gap-2 min-w-0">
                  <FileText className="h-3.5 w-3.5 shrink-0 mt-0.5 text-muted-foreground/50" aria-hidden />
                </div>
                <p
                  className="text-[10px] text-muted-foreground/70 leading-snug pl-5 border-l border-border/20 ml-2 min-w-0 truncate"
                  title={source.filename}
                >
                  {source.filename}
                </p>
              </li>
            ))}
            {activeMessageSources.map((source, i) => (
              <li
                key={source.chunk_id ?? `${source.document_id}-${source.chunk_index}-${i}`}
                className="min-w-0 rounded-md border border-border/35 bg-foreground/[0.025] p-2.5 space-y-1.5"
              >
                <div className="flex items-start gap-2 min-w-0">
                  <FileText className="h-3.5 w-3.5 shrink-0 mt-0.5 text-muted-foreground/50" aria-hidden />
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-medium text-foreground/90 truncate" title={source.filename}>
                      {source.filename}
                    </p>
                    <p className="text-[9px] font-mono text-muted-foreground/45 tabular-nums">
                      #{source.chunk_index}
                      {source.score_type && (
                        <span className="text-muted-foreground/35"> · {source.score_type}</span>
                      )}
                    </p>
                  </div>
                  <span className="text-[9px] font-mono tabular-nums text-muted-foreground/55 shrink-0">
                    {source.score.toFixed(3)}
                  </span>
                </div>
                {(source.vector_score != null || source.bm25_score != null) && (
                  <div className="flex flex-wrap gap-x-2 gap-y-0.5 pl-5 text-[9px] font-mono text-muted-foreground/40 tabular-nums">
                    {source.vector_score != null && <span>vec {source.vector_score.toFixed(3)}</span>}
                    {source.bm25_score != null && <span>bm25 {source.bm25_score.toFixed(3)}</span>}
                  </div>
                )}
                <p className="text-[10px] text-muted-foreground/70 leading-snug pl-5 line-clamp-4 border-l border-border/20 ml-2 min-w-0 break-words [overflow-wrap:anywhere]">
                  {source.text}
                </p>
              </li>
            ))}
          </ul>
        )}
        </div>
      </div>

      {/* Citation Shutter (slides out over content when a source is focused) */}
      {shutterOpen && citationShutter && (
        <CitationShutter
          source={citationShutter}
          onClose={() => setCitationShutter(null)}
        />
      )}

      
          <div className="flex-shrink-0 border-t border-[var(--border)] px-3 py-3 space-y-2">
            {/* Model + live indicator */}
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono text-[var(--t3)] truncate">{modelStats ? modelStats.name : '—'}</span>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-mono text-[var(--t4)]">{modelStats ? modelStats.size_gb : '—'}GB</span>
                <div className="h-1 w-1 rounded-full animate-pulse" style={{ background: 'var(--green)' }} />
              </div>
            </div>

            {/* GPU utilization bar */}
            <div className="h-[2px] w-full overflow-hidden rounded-full bg-[var(--border)]">
              <div className="h-full transition-all duration-700 bg-[var(--t3)]" style={{ width: `${modelStats ? modelStats.gpu_pct : 0}%` }} />
            </div>
            {/* RAM utilization bar */}
            <div className="h-[2px] w-full overflow-hidden rounded-full bg-[var(--border)]">
              <div className="h-full transition-all duration-700 bg-[var(--blue)]" style={{ width: `${modelStats ? modelStats.ram_pct : 0}%` }} />
            </div>
            {/* Legend */}
            <div className="flex items-center gap-2 text-[9px] font-mono text-[var(--t3)]">
              <span className="flex items-center gap-1">
                <span className="inline-block h-1 w-1.5 rounded-sm bg-[var(--blue)]" aria-hidden />
                RAM
              </span>
              <span className="text-[var(--t4)]">/</span>
              <span className="flex items-center gap-1">
                <span className="inline-block h-1 w-1.5 rounded-sm bg-[var(--t3)]" aria-hidden />
                GPU
              </span>
            </div>

            {/* Stats row */}
            <div className="flex justify-between text-[9px] font-mono text-[var(--t4)] tabular-nums">
              <span>
                {requestStartedAt != null ? `${(waitingElapsedMs / 1000).toFixed(2)}s`
                  : firstTokenReachedMs != null ? `${(firstTokenReachedMs / 1000).toFixed(2)}s`
                  : lastInferenceStats ? `${(lastInferenceStats.ttftMs / 1000).toFixed(2)}s`
                  : '—'} ttft
              </span>
              <span>{lastInferenceStats?.tokensPerSec ?? 0} tok/s</span>
              <span>avg {averageTtftMs}ms</span>
            </div>
          </div>
        

    </div>
  );
}
