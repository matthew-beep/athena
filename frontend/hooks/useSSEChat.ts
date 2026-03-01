'use client';

import { useCallback } from 'react';
import { useChatStore } from '@/stores/chat.store';
import { apiClient } from '@/api/client';
import type { StreamEvent, Message, Conversation } from '@/types';

export function useSSEChat() {
  const {
    appendStreamToken,
    setIsStreaming,
    clearStream,
    addMessage,
    addConversation,
    setConversations,
    setActiveConversation,
    setMessages,
    activeConversationId,
    setContextTokens,
    setStatusMessage,
    setActiveModel,
    conversationSearchAll,
    setSearchAll,
    pendingSearchAll,
    setPendingSearchAll,
  } = useChatStore();

  const sendMessage = useCallback(
    async (content: string, conversationId?: string) => {
      if (!content.trim()) return;

      setIsStreaming(true);
      clearStream();
      // Capture context_debug tokens here; stored under the real conversation_id on 'done'
      let pendingContextTokens = 0;

      const convId = conversationId ?? activeConversationId ?? undefined;
      const isNewConversation = !convId;
      const tempConvId = isNewConversation ? `temp_conv_${Date.now()}` : convId;

      // Optimistic user message — show immediately (use temp conversation id for new convos)
      const tempUserMsg: Message = {
        message_id: `temp_${Date.now()}`,
        conversation_id: tempConvId,
        role: 'user',
        content,
        model_used: null,
        timestamp: new Date().toISOString(),
      };

      if (isNewConversation) {
        addConversation({
          conversation_id: tempConvId,
          title: content.slice(0, 50),
          knowledge_tier: 'ephemeral',
          started_at: new Date().toISOString(),
          last_active: new Date().toISOString(),
        });
        setActiveConversation(tempConvId);
      }
      addMessage(tempConvId, tempUserMsg);

      try {
        const response = await apiClient.postStream('/chat', {
          message: content,
          conversation_id: convId ?? null,
          knowledge_tier: 'ephemeral',
          search_all: isNewConversation
            ? pendingSearchAll
            : (conversationSearchAll[convId ?? ''] ?? false),
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const reader = response.body?.getReader();
        if (!reader) throw new Error('No response body');

        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() ?? '';

          for (const line of lines) {
            if (!line.startsWith('data: ')) continue;
            const raw = line.slice(6).trim();
            if (!raw) continue;

            try {
              const event = JSON.parse(raw) as StreamEvent;

              if (event.type === 'token') {
                appendStreamToken(event.content);
                // Clear status message once tokens start arriving
                setStatusMessage(null);

              } else if (event.type === 'status') {
                setStatusMessage(event.content);

              } else if (event.type === 'context_debug') {
                // Hold until 'done' so we know the real conversation_id
                pendingContextTokens = event.tokens;

              } else if (event.type === 'done') {
                const realId = event.conversation_id;
                setContextTokens(realId, pendingContextTokens);
                setActiveModel(event.model);

                const newConv: Conversation = {
                  conversation_id: realId,
                  title: content.slice(0, 50),
                  knowledge_tier: 'ephemeral',
                  started_at: new Date().toISOString(),
                  last_active: new Date().toISOString(),
                };

                const assistantMsg: Message = {
                  message_id: `msg_${Date.now()}`,
                  conversation_id: realId,
                  role: 'assistant',
                  content: useChatStore.getState().streamingContent,
                  model_used: event.model,
                  timestamp: new Date().toISOString(),
                  rag_sources: event.rag_sources,
                };

                if (isNewConversation) {
                  // Replace temp conversation with real one; set messages for real id
                  const state = useChatStore.getState();
                  const conversationsWithoutTemp = state.conversations.filter(
                    (c) => c.conversation_id !== tempConvId
                  );
                  setConversations([newConv, ...conversationsWithoutTemp]);
                  setMessages(realId, [
                    { ...tempUserMsg, conversation_id: realId },
                    assistantMsg,
                  ]);
                  setActiveConversation(realId);
                  // Migrate pending search_all state to real conversation ID and reset
                  if (pendingSearchAll) {
                    setSearchAll(realId, true);
                    setPendingSearchAll(false);
                  }
                } else {
                  setActiveConversation(realId);
                  addMessage(realId, assistantMsg);
                }

              } else if (event.type === 'error') {
                console.error('Stream error:', event.content);
                setStatusMessage(null);
              }
            } catch {
              // skip malformed SSE lines
            }
          }
        }
      } catch (err) {
        console.error('Chat error:', err);
      } finally {
        setIsStreaming(false);
        setStatusMessage(null);
      }
    },
    [
      appendStreamToken,
      setIsStreaming,
      clearStream,
      addMessage,
      addConversation,
      setConversations,
      setActiveConversation,
      setMessages,
      activeConversationId,
      setContextTokens,
      setStatusMessage,
      setActiveModel,
      conversationSearchAll,
      setSearchAll,
      pendingSearchAll,
      setPendingSearchAll,
    ]
  );

  return { sendMessage };
}
