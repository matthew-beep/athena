'use client';

import { TierBadge } from './TierBadge';
import type { Message as MessageType } from '@/types';

interface MessageProps {
  message: MessageType;
}

export function Message({ message }: MessageProps) {
  const isUser = message.role === 'user';

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
