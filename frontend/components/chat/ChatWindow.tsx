'use client';

import { MessageList } from './MessageList';
import { MessageInput } from './MessageInput';
import { useChatStore } from '@/stores/chat.store';

export function ChatWindow() {
  const { activeConversationId } = useChatStore();

  return (
    <div className='h-full w-full flex flex-col p-10'>
      <div className="h-full w-full border-2 flex flex-col glass-strong shadow-glass animate-scale-in rounded-lg">
        <MessageList conversationId={activeConversationId} />
        <MessageInput />
      </div>
    </div>
  );
}
