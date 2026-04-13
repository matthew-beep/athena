'use client';

import { useState, type KeyboardEvent, useRef } from 'react';
import { Send, Square, Globe } from 'lucide-react';
import { useSSEChat } from '@/hooks/useSSEChat';
import { useChatStore } from '@/stores/chat.store';
import { useUIStore } from '@/stores/ui.store';
import { cn } from '@/utils/cn';
import { useShallow } from 'zustand/react/shallow';

// Rough approximation: ~4 chars per token (good enough for a live estimate)
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

const MAX_TOKENS = 5500;
const WARN_TOKENS = 3000;

export function MessageInput() {
  const [text, setText] = useState('');
  const { sendMessage, stopStreaming } = useSSEChat();
  const { isStreaming, activeConversationId, setMessageTokens, statusMessage, activeModel, pendingSearchAll, setPendingSearchAll, setSearchAll, conversationSearchAll } = useChatStore(
    useShallow((s) => ({
      isStreaming: s.activeConversationId ? (s.isStreaming[s.activeConversationId] ?? false) : false,
      activeConversationId: s.activeConversationId,
      setMessageTokens: s.setMessageTokens,
      statusMessage: s.statusMessage,
      activeModel: s.activeModel,
      pendingSearchAll: s.pendingSearchAll,
      setPendingSearchAll: s.setPendingSearchAll,
      setSearchAll: s.setSearchAll,
      conversationSearchAll: s.conversationSearchAll,
    }))
  );

  const devMode = useUIStore((s) => s.devMode);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const tokenDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleSend = async () => {
    const msg = text.trim();
    if (!msg || isStreaming) return;
    setText('');
    setMessageTokens(0);
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
    await sendMessage(msg, activeConversationId ?? undefined);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleInput = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setText(val);
    // Debounce store write — only DevModeOverlay reads messageTokens, no need to update every keystroke
    if (tokenDebounceRef.current) clearTimeout(tokenDebounceRef.current);
    tokenDebounceRef.current = setTimeout(() => setMessageTokens(estimateTokens(val)), 150);
  };

  const isSearchAll = activeConversationId
    ? conversationSearchAll[activeConversationId] ?? false
    : pendingSearchAll;

  const handleSearchAllToggle = () => {
    if (activeConversationId) {
      setSearchAll(activeConversationId, !isSearchAll);
    } else {
      setPendingSearchAll(!pendingSearchAll);
    }
  };

  const tokenEst = estimateTokens(text);
  const isOverWarn = devMode && tokenEst > WARN_TOKENS;
  const isOverMax = tokenEst > MAX_TOKENS;

  return (
    <div className="p-4 flex-shrink-0 w-full">
      {/* Status message (e.g. "summarizing context...") */}
      {statusMessage && (
        <p className="text-center text-[10px] text-muted-foreground/60 font-mono mb-1.5 animate-pulse">
          {statusMessage}
        </p>
      )}
      <div
        className={cn(
          'bg-[var(--raised)] rounded-2xl border flex flex-col items-center justify-between gap-2 px-4 py-2 focus-within:border-border transition-colors',
          isOverWarn ? 'border-yellow-500/40' : 'border-border/50'
        )}
      >
        <div className='w-full flex py-1'>
          <textarea
            ref={textareaRef}
            value={text}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            onInput={handleInput}
            placeholder="Message Athena… (Enter to send, Shift+Enter for new line)"
            className="flex-1 bg-transparent resize-none outline-none text-sm text-foreground placeholder:text-muted-foreground min-h-[24px] max-h-[200px]"
            rows={1}
            disabled={isStreaming}
          />
        </div>

        <div className='w-full flex items-center justify-between'>
          <button
            onClick={handleSearchAllToggle}
            title={isSearchAll ? 'Searching all documents — click to disable' : 'Search all documents'}
            className={cn(
              'p-1.5 rounded-lg transition-all flex-shrink-0',
              isSearchAll
                ? 'text-foreground bg-[var(--raised-h)]'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <Globe size={14} />
          </button>

          {isStreaming ? (
            <button
              onClick={stopStreaming}
              className="px-3 py-3 rounded-lg text-xs font-semibold transition-all flex-grow-0 flex items-center gap-1.5 bg-foreground text-background hover:bg-foreground/90"
            >
              <Square size={12} />
            </button>
          ) : (
            <button
              onClick={handleSend}
              disabled={!text.trim() || isOverMax}
              className={cn(
                'px-3 py-3 rounded-lg text-xs font-semibold transition-all flex-grow-0 flex items-center gap-1.5',
                text.trim() && !isOverMax
                  ? 'bg-foreground text-background hover:bg-foreground/90'
                  : 'text-muted-foreground cursor-not-allowed bg-foreground'
              )}
            >
              <Send size={12} />
            </button>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between mt-1.5 px-1">
        <p className="text-[10px] text-muted-foreground/40 font-mono">
          {activeModel ?? '—'} · Tier 1
        </p>
      </div>
    </div>
  );
}
