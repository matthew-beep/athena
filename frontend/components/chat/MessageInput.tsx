'use client';

import { useState, type KeyboardEvent, useRef } from 'react';
import { Send, Square } from 'lucide-react';
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
  const { sendMessage } = useSSEChat();
  const { isStreaming, activeConversationId, setMessageTokens, statusMessage, activeModel, pendingSearchAll, setPendingSearchAll, setSearchAll, conversationSearchAll } = useChatStore(
    useShallow((s) => ({
      isStreaming: s.isStreaming,
      activeConversationId: s.activeConversationId,
      setMessageTokens: s.setMessageTokens,
      statusMessage: s.statusMessage,
      activeModel: s.activeModel,
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

  const tokenEst = estimateTokens(text);
  const isOverWarn = devMode && tokenEst > WARN_TOKENS;
  const isOverMax = tokenEst > MAX_TOKENS;

  return (
    <div className="p-4 border-2 flex-shrink-0">
      {/* Status message (e.g. "summarizing context...") */}
      {statusMessage && (
        <p className="text-center text-[10px] text-muted-foreground/60 font-mono mb-1.5 animate-pulse">
          {statusMessage}
        </p>
      )}
      <div className="border-2 border-border/50 rounded-2xl"> pill section </div>
      <div
        className={cn(
          'glass rounded-2xl border flex items-center justify-between gap-2 px-4 py-2 focus-within:border-border transition-colors',
          isOverWarn ? 'border-yellow-500/40' : 'border-border/50'
        )}
      >
        <textarea
          ref={textareaRef}
          value={text}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onInput={handleInput}
          placeholder="Message Athena… (Enter to send, Shift+Enter for new line)"
          className="border-2 flex-1 bg-transparent resize-none outline-none text-sm text-foreground placeholder:text-muted-foreground min-h-[24px] max-h-[200px]"
          rows={1}
          disabled={isStreaming}
        />
        <button
          onClick={handleSend}
          disabled={!text.trim() || isStreaming || isOverMax}
          className={cn(
            'px-3 py-3 rounded-lg text-xs font-semibold transition-all flex-grow-0 flex items-center gap-1.5',
            text.trim() && !isStreaming && !isOverMax
              ? 'bg-foreground text-background hover:bg-foreground/90'
              : 'text-muted-foreground cursor-not-allowed bg-foreground'
          )}
        >
          {isStreaming ? <Square size={12} /> : <Send size={12} />}
        </button>
      </div>

      <div className="flex items-center justify-between mt-1.5 px-1 border-2 border-border/50 rounded-2xl">
        <p className="text-[10px] text-muted-foreground/40 font-mono">
          {activeModel ?? '—'} · Tier 1
        </p>
        {devMode && text.length > 0 && (
          <p
            className={cn(
              'text-[10px] font-mono tabular-nums',
              isOverMax
                ? 'text-red-400'
                : isOverWarn
                ? 'text-yellow-400'
                : 'text-muted-foreground/40'
            )}
          >
            {isOverMax
              ? `~${tokenEst} tok — too long, split message`
              : isOverWarn
              ? `~${tokenEst} tok — getting long`
              : `~${tokenEst} tok`}
          </p>
        )}
      </div>
    </div>
  );
}
