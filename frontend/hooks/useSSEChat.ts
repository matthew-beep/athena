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
    setActiveConversation,
    activeConversationId,
  } = useChatStore();

  const sendMessage = useCallback(
    async (content: string, conversationId?: string) => {
      if (!content.trim()) return;

      setIsStreaming(true);
      clearStream();

      const convId = conversationId ?? activeConversationId ?? undefined;

      // Optimistic user message
      const tempUserMsg: Message = {
        message_id: `temp_${Date.now()}`,
        conversation_id: convId ?? '',
        role: 'user',
        content,
        model_used: null,
        timestamp: new Date().toISOString(),
      };

      if (convId) {
        addMessage(convId, tempUserMsg);
      }

      try {
        const response = await apiClient.postStream('/chat', {
          message: content,
          conversation_id: convId ?? null,
          knowledge_tier: 'ephemeral',
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
                

              } else if (event.type === 'done') {
                setActiveConversation(event.conversation_id);

                const newConv: Conversation = {
                  conversation_id: event.conversation_id,
                  title: content.slice(0, 50),
                  knowledge_tier: 'ephemeral',
                  started_at: new Date().toISOString(),
                  last_active: new Date().toISOString(),
                };
                addConversation(newConv);

                if (!convId) {
                  addMessage(event.conversation_id, {
                    ...tempUserMsg,
                    conversation_id: event.conversation_id,
                  });
                }

                const assistantMsg: Message = {
                  message_id: `msg_${Date.now()}`,
                  conversation_id: event.conversation_id,
                  role: 'assistant',
                  content: useChatStore.getState().streamingContent,
                  model_used: event.model,
                  timestamp: new Date().toISOString(),
                };
                addMessage(event.conversation_id, assistantMsg);
              } else if (event.type === 'error') {
                console.error('Stream error:', event.content);
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
      }
    },
    [
      appendStreamToken,
      setIsStreaming,
      clearStream,
      addMessage,
      addConversation,
      setActiveConversation,
      activeConversationId,
    ]
  );

  return { sendMessage };
}
