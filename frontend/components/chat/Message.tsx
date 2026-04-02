'use client';

import { useMemo, useState } from 'react';
import { FileText, ChevronDown, ChevronUp, Pin } from 'lucide-react';
import { TierBadge } from './TierBadge';
import { useChatStore } from '@/stores/chat.store';
import { apiClient } from '@/api/client';
import { useShallow } from 'zustand/react/shallow';
import type { Message as MessageType, RagSource } from '@/types';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface MessageProps {
  message: MessageType;
}

function SourcesPanel({ sources }: { sources: RagSource[] }) {
  const { setCitationShutter, activeConversationId, conversationDocuments, addConversationDocument, setSearchAll } = useChatStore(
    useShallow((s) => ({
      setCitationShutter: s.setCitationShutter,
      activeConversationId: s.activeConversationId,
      conversationDocuments: s.conversationDocuments,
      addConversationDocument: s.addConversationDocument,
      setSearchAll: s.setSearchAll,
    }))
  );

  const attachedIds = activeConversationId
    ? new Set((conversationDocuments[activeConversationId] ?? []).map((d) => d.document_id))
    : new Set<string>();

  const handleAttach = (src: RagSource) => {
    if (!activeConversationId || attachedIds.has(src.document_id)) return;
    apiClient
      .post(`/chat/${activeConversationId}/documents`, { document_ids: [src.document_id] })
      .then(() => {
        addConversationDocument(activeConversationId, { document_id: src.document_id, filename: src.filename });
        setSearchAll(activeConversationId, false);
      })
      .catch(console.error);
  };

  // Deduplicate by filename — keep highest-score chunk per file
  const deduped = useMemo(() => {
    const map = new Map<string, RagSource>();
    for (const s of sources) {
      const existing = map.get(s.filename);
      if (!existing || s.score > existing.score) map.set(s.filename, s);
    }
    return [...map.values()].sort((a, b) => b.score - a.score);
  }, [sources]);

  const [open, setOpen] = useState(false);

  // TODO: re do deduped to show chunk rather than unique document 

  return (
    <div className="px-1 mt-0.5">
      {/* Toggle button */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 text-[10px] font-mono text-muted-foreground/60 hover:text-muted-foreground transition-colors"
      >
        <FileText size={10} />
        <span>{deduped.length} source{deduped.length !== 1 ? 's' : ''}</span>
        {open ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
      </button>

      {/* Source list — click opens Citation Shutter in Context Sidebar */}
      {open && (
        <ul className="mt-1.5 space-y-1">
          {deduped.map((src) => (
            <li
              key={src.filename + (src.chunk_id ?? src.chunk_index)}
              className="rounded-sm bg-muted/20 border border-border/20 overflow-hidden"
            >
              <div className="flex items-center gap-2 px-2 py-1">
                <button
                  type="button"
                  onClick={() => setCitationShutter(src)}
                  className="flex items-center gap-2 flex-1 border-2 border-red-500 min-w-0 text-left hover:opacity-80 transition-opacity"
                >
                  <FileText size={10} className="text-muted-foreground/50 flex-shrink-0" />
                  <span className="text-[10px] text-muted-foreground truncate flex-1 font-mono">
                    {src.filename}
                  </span>
                  {src.score_type && (
                    <span className="text-[9px] font-mono px-1 py-0.5 rounded bg-muted/40 text-muted-foreground/50 flex-shrink-0">
                      {src.score_type}
                    </span>
                  )}
                </button>
                {activeConversationId && (
                  <button
                    type="button"
                    onClick={() => handleAttach(src)}
                    disabled={attachedIds.has(src.document_id)}
                    title={attachedIds.has(src.document_id) ? 'Already in scope' : 'Pin to conversation'}
                    className="flex-shrink-0 p-0.5 rounded text-muted-foreground/30 hover:text-foreground disabled:opacity-20 disabled:cursor-default transition-colors"
                  >
                    <Pin size={9} />
                  </button>
                )}
              </div>
              {/* Snippet — click opens citation shutter */}
              {src.text && (
                <button
                  type="button"
                  onClick={() => setCitationShutter(src)}
                  className="w-full text-left hover:bg-muted/30 transition-colors"
                >
                  <p className="px-2 pb-2 text-[10px] text-muted-foreground/60 font-mono leading-relaxed line-clamp-3 border-t border-border/10 pt-1">
                    {src.text}
                  </p>
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function Message({ message }: MessageProps) {
  const isUser = message.role === 'user';
  const hasSources = !isUser && (message.rag_sources?.length ?? 0) > 0;

  return (
    <div className={`flex gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
      {/* Avatar */}
      <div
        className={`w-6 h-6 rounded-lg flex-shrink-0 flex items-center justify-center text-xs font-bold font-display ${
          isUser
            ? 'bg-foreground/10 border border-foreground/20 text-foreground'
            : 'bg-foreground/5 border border-foreground/10 text-muted-foreground'
        }`}
      >
        {isUser ? 'U' : 'A'}
      </div>

      {/* Bubble */}
      <div
        className={`max-w-[80%] ${
          isUser ? 'items-end' : 'items-start'
        } flex flex-col gap-1`}
      >
        <div className={isUser ? 'msg-user' : 'msg-ai'}>
          {isUser ? (
            <span className="whitespace-pre-wrap">{message.content}</span>
          ) : (
            <div className="message-content">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {message.content}
              </ReactMarkdown>
            </div>
          )}
        </div>

        {/* Footer: tier badge + sources toggle */}
        {!isUser && (
          <div className="flex flex-col gap-1 w-full">
            {message.model_used && (
              <div className="px-1">
                <TierBadge tier={1} model={message.model_used} />
              </div>
            )}
            {hasSources && (
              <SourcesPanel sources={message.rag_sources!} />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
