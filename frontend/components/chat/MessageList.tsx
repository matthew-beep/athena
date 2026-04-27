'use client';

import { useEffect, useRef } from 'react';
import { Message } from './Message';
import { useChatStore } from '@/stores/chat.store';
import { useShallow } from 'zustand/react/shallow';
import type { Message as MessageType } from '@/types';
import { StreamingMarkdown } from './AthenaMarkdown';
import { SuggestionsBar } from './SuggestionsBar';

// Isolated component — only re-renders when streamingContent changes,
// keeping MessageList itself out of the per-token render cycle
function StreamingBubble({ conversationId }: { conversationId: string }) {
  const streamingContent = useChatStore((s) => s.streamingContent[conversationId] ?? '');
  const streamingSources = useChatStore((s) => s.streamingSources[conversationId] ?? []);
  if (!streamingContent) return null;
  return (
    <div className="animate-fade-up flex gap-3">
      <div className="msg-ai min-w-0">
        <div className="message-content">
          <StreamingMarkdown content={streamingContent} sources={streamingSources} />
        </div>
      </div>
    </div>
  );
}

interface MessageListProps {
  conversationId: string | null;
}

export function MessageList({ conversationId }: MessageListProps) {
  const { messages, isStreaming } = useChatStore(
    useShallow((s) => ({
      messages: s.messages,
      isStreaming: conversationId ? (s.isStreaming[conversationId] ?? false) : false,
    }))
  );

  const bottomRef = useRef<HTMLDivElement>(null);

  const msgs: MessageType[] = conversationId
    ? (messages[conversationId] ?? [])
    : [];

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [msgs.length, isStreaming]);

  if (msgs.length === 0 && !isStreaming) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-0">
        <div className="text-center animate-fade-up">
          <div className="w-12 h-12 mx-auto mb-4 rounded-xl bg-foreground/5 border border-foreground/10 flex items-center justify-center">
            <span className="text-2xl font-bold font-display text-foreground/30">A</span>
          </div>
          <h2 className="text-base font-display font-semibold mb-1 tracking-tight">
            Ask Athena anything
          </h2>
          <p className="text-sm text-muted-foreground">Start a conversation below</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto overflow-x-hidden px-4 py-4 space-y-4 min-h-0 w-full">
      {msgs.map((msg) => (
        <div key={msg.message_id} className="animate-fade-up">
          <Message message={msg} />
        </div>
      ))}

      {conversationId && <SuggestionsBar />}

      {/* Streaming assistant message */}
      {isStreaming && conversationId && <StreamingBubble conversationId={conversationId} />}

      {/* Typing indicator — waiting for first token */}
      {isStreaming && !useChatStore.getState().streamingContent[conversationId ?? ''] && (
        <div className="animate-fade-up flex gap-3">
          <div className="msg-ai flex items-center gap-1.5">
            <div className="typing-dot" />
            <div className="typing-dot" />
            <div className="typing-dot" />
          </div>
        </div>
      )}

      <div ref={bottomRef} />
    </div>
  );
}
