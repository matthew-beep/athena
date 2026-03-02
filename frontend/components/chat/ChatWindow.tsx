'use client';

import { MessageList } from './MessageList';
import { MessageInput } from './MessageInput';
import { useChatStore } from '@/stores/chat.store';
import { useUIStore } from '@/stores/ui.store';
import { DocumentBar } from './DocumentBar';
import { PanelRightClose, PanelRightOpen } from 'lucide-react';
import { useState } from 'react';

export function ChatWindow() {
  const { sidebarCollapsed, setSidebarCollapsed } = useUIStore();
  const { activeConversationId, conversations } = useChatStore();
  const [contextPanelOpen, setContextPanelOpen] = useState(false);
  const title = conversations.find((conversation) => conversation.conversation_id === activeConversationId)?.title || 'New Conversation';


  return (
    <div className='w-full h-full flex flex-col min-h-0 p-3 gap-3'>
      <div className="flex-shrink-0 flex justify-between items-center">
        <h1>{title}</h1>
        <button 
        onClick={() => {

          if (contextPanelOpen) {
            setContextPanelOpen(false); 
            setSidebarCollapsed(false);
          } else {
            setContextPanelOpen(true); 
            setSidebarCollapsed(true);
          }
        }} 
        className="flex items-center justify-center w-8 h-8 rounded-lg border-2 border-border/50"
        >
          {contextPanelOpen ? <PanelRightClose size={14} /> : <PanelRightOpen size={14} />}
        </button>
      </div>
      <div className="flex-1 min-h-0 w-full flex gap-5">
        <div className="flex-1 min-h-0 flex flex-col glass-strong shadow-glass animate-scale-in rounded-lg">
          <MessageList conversationId={activeConversationId} />
          <MessageInput />
        </div>
        {contextPanelOpen && (
          <DocumentBar />
        )}
      </div>
    </div>
  );
}
