'use client';

import { useMemo, useState } from 'react';
import { FileText, ChevronDown, ChevronUp } from 'lucide-react';
import { TierBadge } from './TierBadge';
import type { Message as MessageType, RagSource } from '@/types';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface MessageProps {
  message: MessageType;
}

function SourcesPanel({ sources }: { sources: RagSource[] }) {
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

      {/* Source list */}
      {open && (
        <ul className="mt-1.5 space-y-1">
          {deduped.map((src) => (
            <li
              key={src.filename}
              className="rounded-sm bg-muted/20 border border-border/20 overflow-hidden"
            >
              {/* Header row */}
              <div className="flex items-center gap-2 px-2 py-1">
                <FileText size={10} className="text-muted-foreground/50 flex-shrink-0" />
                <span className="text-[10px] text-muted-foreground truncate flex-1 font-mono">
                  {src.filename}
                </span>
                <span className="text-[10px] font-mono text-muted-foreground/50 flex-shrink-0">
                  {Math.round(src.score * 100)}%
                </span>
              </div>
              {/* Snippet */}
              {src.text && (
                <p className="px-2 pb-2 text-[10px] text-muted-foreground/60 font-mono leading-relaxed line-clamp-3 border-t border-border/10 pt-1">
                  {src.text}
                </p>
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
        <div
          className={`px-4 py-3 text-sm ${
            isUser
              ? 'rounded-2xl bg-foreground/8 border border-foreground/10 text-foreground'
              : 'rounded-xl glass-subtle text-foreground'
          }`}
          style={isUser ? { background: 'hsl(var(--glass-bg)/0.08)' } : undefined}
        >
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {message.content}
          </ReactMarkdown>
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
