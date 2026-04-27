'use client';

import { useCallback, useState, useEffect } from 'react';
import { MessageList } from './MessageList';
import { MessageInput } from './MessageInput';
import { useChatStore } from '@/stores/chat.store';
import { useUIStore } from '@/stores/ui.store';
import { DocumentBar } from './DocumentBar';
import { CommandPalette } from './CommandPalette';
import { ScopeBar } from './ScopeBar';
import { PanelRightClose, PanelRightOpen } from 'lucide-react';
import { apiClient } from '@/api/client';
import type { ConversationDocument } from '@/types';

export function ChatWindow() {
  const { sidebarCollapsed, setSidebarCollapsed } = useUIStore();
  const { activeConversationId, conversations, commandPaletteOpen, setCommandPaletteOpen, pendingDocuments, setConversationDocuments } =
    useChatStore();
  const [contextPanelOpen, setContextPanelOpen] = useState(false);

  // Fetch attached documents whenever the active conversation changes.
  // Lives here so ScopeBar and DocumentBar both have data regardless of panel state.
  const refetchDocs = useCallback(() => {
    if (!activeConversationId) return;
    apiClient
      .get<{ documents: ConversationDocument[] }>(`/chat/${activeConversationId}/documents`)
      .then((res) => setConversationDocuments(activeConversationId, Array.isArray(res?.documents) ? res.documents : []))
      .catch(() => setConversationDocuments(activeConversationId, []));
  }, [activeConversationId, setConversationDocuments]);

  useEffect(() => {
    refetchDocs();
  }, [refetchDocs]);

  // Auto-open the context panel when arriving on a new chat with staged documents
  useEffect(() => {
    if (pendingDocuments.length > 0 && !activeConversationId) {
      setContextPanelOpen(true);
      setSidebarCollapsed(true);
    }
  }, [pendingDocuments.length, activeConversationId, setSidebarCollapsed]);

  const title = conversations.find((conversation) => conversation.conversation_id === activeConversationId)?.title || 'New Conversation';

  return (
    <div className='w-full h-full flex flex-col min-h-0 p-3 gap-3 relative'>
      <div className="flex-shrink-0 flex justify-between items-center">
        <h1>{title}</h1>
        {/* DocumentBar toggle hidden — pending rework */}
      </div>
      <div className="flex-1 min-h-0 w-full flex gap-5 justify-center">
        <div className="flex-1 min-h-0 min-w-0 flex flex-col items-center animate-scale-in rounded-lg max-w-3xl">
          <MessageList conversationId={activeConversationId} />
          <ScopeBar />
          <MessageInput />
        </div>
        {/* DocumentBar hidden — pending rework */}
      </div>
      <CommandPalette
        open={commandPaletteOpen}
        onClose={() => setCommandPaletteOpen(false)}
        onAttachComplete={refetchDocs}
      />
    </div>
  );
}
