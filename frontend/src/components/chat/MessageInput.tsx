import { useState, KeyboardEvent, useRef } from "react";
import { Send } from "lucide-react";
import { useSSEChat } from "../../hooks/useSSEChat";
import { useChatStore } from "../../stores/chat.store";
import { cn } from "../../utils/cn";

export function MessageInput() {
  const [text, setText] = useState("");
  const { sendMessage } = useSSEChat();
  const { isStreaming, activeConversationId } = useChatStore();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSend = async () => {
    const msg = text.trim();
    if (!msg || isStreaming) return;
    setText("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";
    await sendMessage(msg, activeConversationId ?? undefined);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleInput = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  };

  return (
    <div className="px-4 pb-4 pt-2 flex-shrink-0">
      <div className="glass rounded-2xl border border-border/70 flex items-end gap-2 px-4 py-3 focus-within:border-primary/40 transition-colors">
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          onInput={handleInput}
          placeholder="Message Athena... (Enter to send, Shift+Enter for new line)"
          className="flex-1 bg-transparent resize-none outline-none text-sm text-foreground placeholder:text-muted-foreground min-h-[24px] max-h-[200px]"
          rows={1}
          disabled={isStreaming}
        />
        <button
          onClick={handleSend}
          disabled={!text.trim() || isStreaming}
          className={cn(
            "p-2 rounded-xl transition-all flex-shrink-0",
            text.trim() && !isStreaming
              ? "btn-glow text-white"
              : "text-muted-foreground bg-muted/50 cursor-not-allowed"
          )}
        >
          <Send size={16} />
        </button>
      </div>
      <p className="text-center text-xs text-muted-foreground/50 mt-2">
        Prototype — llama3.2:3b · Tier 1
      </p>
    </div>
  );
}
