'use client';

import { useState, type KeyboardEvent, useRef } from 'react';
import { Send } from 'lucide-react';
import { useSSEChat } from '@/hooks/useSSEChat';
import { useChatStore } from '@/stores/chat.store';
import { cn } from '@/utils/cn';

export function MessageInput() {
  const [text, setText] = useState('');
  const { sendMessage } = useSSEChat();
  const { isStreaming, activeConversationId } = useChatStore();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSend = async () => {
    const msg = text.trim();
    if (!msg || isStreaming) return;
    setText('');
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

  return (
    <div className="px-4 pb-4 pt-2 flex-shrink-0">
      <div className="glass rounded-2xl border border-border/50 flex items-end gap-2 px-4 py-3 focus-within:border-border transition-colors">
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          onInput={handleInput}
          placeholder="Message Athena… (Enter to send, Shift+Enter for new line)"
          className="flex-1 bg-transparent resize-none outline-none text-sm text-foreground placeholder:text-muted-foreground min-h-[24px] max-h-[200px]"
          rows={1}
          disabled={isStreaming}
        />
        <button
          onClick={handleSend}
          disabled={!text.trim() || isStreaming}
          className={cn(
            'px-3 py-1 rounded-lg text-xs font-semibold transition-all flex-shrink-0 flex items-center gap-1.5',
            text.trim() && !isStreaming
              ? 'bg-foreground text-background hover:bg-foreground/90'
              : 'text-muted-foreground bg-muted/30 cursor-not-allowed opacity-50'
          )}
        >
          <Send size={12} />
        </button>
      </div>
      <p className="text-center text-[10px] text-muted-foreground/40 font-mono mt-2">
        qwen2.5:7b · Tier 1
      </p>
    </div>
  );
}
