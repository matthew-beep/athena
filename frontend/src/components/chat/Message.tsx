import { TierBadge } from "./TierBadge";
import type { Message as MessageType } from "../../types";

interface MessageProps {
  message: MessageType;
}

export function Message({ message }: MessageProps) {
  const isUser = message.role === "user";

  return (
    <div className={`flex gap-3 ${isUser ? "flex-row-reverse" : "flex-row"}`}>
      {/* Avatar */}
      <div
        className={`w-7 h-7 rounded-lg flex-shrink-0 flex items-center justify-center text-xs font-bold ${
          isUser
            ? "bg-primary/20 border border-primary/30 text-primary"
            : "bg-accent/15 border border-accent/25 text-accent"
        }`}
      >
        {isUser ? "U" : "A"}
      </div>

      {/* Bubble */}
      <div
        className={`max-w-[80%] ${
          isUser ? "items-end" : "items-start"
        } flex flex-col gap-1`}
      >
        <div
          className={`rounded-2xl px-4 py-3 text-sm ${
            isUser
              ? "bg-primary/15 border border-primary/20 text-foreground"
              : "glass-subtle text-foreground"
          }`}
        >
          <div className="message-content whitespace-pre-wrap">
            {message.content}
          </div>
        </div>
        {!isUser && message.model_used && (
          <div className="px-1">
            <TierBadge tier={1} model={message.model_used} />
          </div>
        )}
      </div>
    </div>
  );
}
