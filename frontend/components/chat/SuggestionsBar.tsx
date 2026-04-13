'use client';

import { useChatStore } from '@/stores/chat.store';
import { useSSEChat } from '@/hooks/useSSEChat';

export function SuggestionsBar() {
  const activeConversationId = useChatStore((s) => s.activeConversationId);
  const suggestions = useChatStore(
    (s) => s.conversationSuggestions[s.activeConversationId ?? '']?.suggestions
  ) ?? [];
  const loading = useChatStore(
    (s) => s.conversationSuggestions[s.activeConversationId ?? '']?.loading ?? false
  );
  const isStreaming = useChatStore(
    (s) => s.activeConversationId ? (s.isStreaming[s.activeConversationId] ?? false) : false
  );
  const setConversationSuggestions = useChatStore((s) => s.setConversationSuggestions);
  const { sendMessage } = useSSEChat();

  if (isStreaming || (!loading && suggestions.length === 0)) return null;

  const handleClick = (suggestion: string) => {
    if (!activeConversationId) return;
    setConversationSuggestions(activeConversationId, []);
    sendMessage(suggestion, activeConversationId);
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 flex-wrap">
        {[90, 120, 75].map((w) => (
          <div
            key={w}
            className="h-7 rounded-full bg-[var(--raised-h)] animate-pulse"
            style={{ width: w }}
          />
        ))}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {suggestions.map((suggestion) => (
        <button
          key={suggestion}
          type="button"
          onClick={() => handleClick(suggestion)}
          className="inline-flex items-center px-3 py-1.5 rounded-full border border-[var(--border-s)] bg-[var(--raised)] hover:bg-[var(--raised-h)] text-[12px] text-[var(--t2)] hover:text-[var(--t1)] transition-colors font-[var(--fb)] truncate max-w-[260px]"
        >
          {suggestion}
        </button>
      ))}
    </div>
  );
}
