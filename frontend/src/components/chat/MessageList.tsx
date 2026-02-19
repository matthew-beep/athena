import { useEffect, useRef } from "react";
import { Message } from "./Message";
import { useChatStore } from "../../stores/chat.store";
import type { Message as MessageType } from "../../types";

interface MessageListProps {
  conversationId: string | null;
}

export function MessageList({ conversationId }: MessageListProps) {
  const { messages, streamingContent, isStreaming } = useChatStore();
  const bottomRef = useRef<HTMLDivElement>(null);

  const msgs: MessageType[] = conversationId
    ? (messages[conversationId] ?? [])
    : [];

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs.length, streamingContent]);

  if (msgs.length === 0 && !isStreaming) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center animate-fade-up">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center animate-float">
            <span className="text-3xl font-bold text-primary/60">A</span>
          </div>
          <h2 className="text-lg font-semibold mb-1">Ask Athena anything</h2>
          <p className="text-sm text-muted-foreground">
            Start a conversation below
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
      {msgs.map((msg) => (
        <div key={msg.message_id} className="animate-fade-up">
          <Message message={msg} />
        </div>
      ))}

      {/* Streaming assistant message */}
      {isStreaming && streamingContent && (
        <div className="animate-fade-up flex gap-3">
          <div className="w-7 h-7 rounded-lg flex-shrink-0 flex items-center justify-center text-xs font-bold bg-accent/15 border border-accent/25 text-accent">
            A
          </div>
          <div className="glass-subtle rounded-2xl px-4 py-3 text-sm max-w-[80%]">
            <div className="message-content whitespace-pre-wrap">
              {streamingContent}
              <span className="inline-block w-0.5 h-4 bg-primary ml-0.5 animate-pulse" />
            </div>
          </div>
        </div>
      )}

      {/* Typing indicator — waiting for first token */}
      {isStreaming && !streamingContent && (
        <div className="animate-fade-up flex gap-3">
          <div className="w-7 h-7 rounded-lg flex-shrink-0 flex items-center justify-center text-xs font-bold bg-accent/15 border border-accent/25 text-accent">
            A
          </div>
          <div className="glass-subtle rounded-2xl px-4 py-3 flex items-center gap-1.5">
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
