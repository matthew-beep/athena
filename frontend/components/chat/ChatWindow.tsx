'use client';

import { MessageList } from './MessageList';
import { MessageInput } from './MessageInput';
import { useChatStore } from '@/stores/chat.store';

export function ChatWindow() {
  const { activeConversationId, conversations } = useChatStore();
  console.log(conversations);

  const title = conversations.find((conversation) => conversation.conversation_id === activeConversationId)?.title || 'New Conversation';

  return (
    <div className=' rounded-2xl w-full h-full flex flex-col min-h-0 py-5 px-5'>
      <div className=" flex-shrink-0"><h1>{title}</h1></div>
      <div className="flex-1 min-h-0 w-full flex gap-5">
        <div className="flex-1 min-h-0 flex flex-col glass-strong shadow-glass animate-scale-in rounded-lg">
          <MessageList conversationId={activeConversationId} />
          <MessageInput />
        </div>
        <div className="flex flex-col">
          <div className="glass-strong shadow-glass p-5 rounded-lg">resources panel</div>
          <div className="glass-strong shadow-glass p-5 rounded-lg">resources panel</div>
          <div className="glass-strong shadow-glass p-5 rounded-lg">resources panel</div>
        </div>
      </div>
    </div>
  );
}
