'use client';

import { useCallback, useRef } from 'react';
import { useChatStore } from '@/stores/chat.store';
import { useSystemStore } from '@/stores/system.store';
import { apiClient } from '@/api/client';
import type { StreamEvent, Message, Conversation } from '@/types';

export function useSSEChat() {
  const requestStartTime = useRef(0);
  const firstTokenTime = useRef(0);
  const tokenCount = useRef(0);
  const ttftMsRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);

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
        requestStartTime.current = performance.now();
        firstTokenTime.current = 0;
        tokenCount.current = 0;
        ttftMsRef.current = 0;
        useChatStore.getState().setRequestStartedAt(Date.now());

        abortRef.current = new AbortController();

        const pendingDocs = useChatStore.getState().pendingDocuments;
        const response = await apiClient.postStream('/chat', {
          message: content,
          conversation_id: convId ?? null,
          knowledge_tier: 'ephemeral',
          search_all: isNewConversation
            ? pendingSearchAll
            : (conversationSearchAll[convId ?? ''] ?? false),
          document_ids: isNewConversation ? pendingDocs.map((d) => d.document_id) : [],
        }, abortRef.current.signal);

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
                if (firstTokenTime.current === 0) {
                  firstTokenTime.current = performance.now();
                  ttftMsRef.current = Math.round(firstTokenTime.current - requestStartTime.current);
                  useChatStore.getState().setFirstTokenReachedMs(ttftMsRef.current);
                  useChatStore.getState().setRequestStartedAt(null);
                  useSystemStore.getState().updateTtftAvg(ttftMsRef.current);

                }
                tokenCount.current += 1;
                appendStreamToken(event.content);
                // Clear status message once tokens start arriving
                setStatusMessage(null);

              } else if (event.type === 'status') {
                setStatusMessage(event.content);

              } else if (event.type === 'context_debug') {
                // Hold until 'done' so we know the real conversation_id
                pendingContextTokens = event.tokens;

              } else if (event.type === 'done') {
                const genTimeSec =
                  firstTokenTime.current > 0
                    ? (performance.now() - firstTokenTime.current) / 1000
                    : 0;
                const tokensPerSec =
                  tokenCount.current > 0 && genTimeSec > 0
                    ? tokenCount.current / genTimeSec
                    : 0;
                useSystemStore.getState().setLastInferenceStats({
                  ttftMs: ttftMsRef.current,
                  tokensPerSec: Math.round(tokensPerSec),
                });
                useChatStore.getState().setFirstTokenReachedMs(null);

                const realId = event.conversation_id;
                setContextTokens(realId, pendingContextTokens);
                setActiveModel(event.model);

                // Clear pending docs — backend already attached them at request time.
                if (isNewConversation) {
                  useChatStore.getState().setPendingDocuments([]);
                }

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
        if (err instanceof Error && err.name === 'AbortError') {
          // User stopped the stream — not an error
        } else {
          console.error('Chat error:', err);
        }
      } finally {
        abortRef.current = null;
        useChatStore.getState().setRequestStartedAt(null);
        useChatStore.getState().setFirstTokenReachedMs(null);
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

  const stopStreaming = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  return { sendMessage, stopStreaming };
}
