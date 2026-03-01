'use client';

import { create } from 'zustand';
import type { Conversation, Message } from '@/types';

interface ChatState {
  conversations: Conversation[];
  activeConversationId: string | null;
  messages: Record<string, Message[]>;
  streamingContent: string;
  isStreaming: boolean;
  // Developer mode: context window state
  contextTokens: Record<string, number>; // per-conversation token count (from context_debug SSE event)
  contextBudget: number;                 // total token budget (8192) — same for all conversations
  messageTokens: number;                 // live estimate as user types
  statusMessage: string | null;          // e.g. "summarizing context..."
  activeModel: string | null;            // last model name returned by the backend
  setConversations: (convs: Conversation[]) => void;
  addConversation: (conv: Conversation) => void;
  setActiveConversation: (id: string | null) => void;
  setMessages: (conversationId: string, msgs: Message[]) => void;
  addMessage: (conversationId: string, msg: Message) => void;
  appendStreamToken: (token: string) => void;
  setIsStreaming: (val: boolean) => void;
  clearStream: () => void;
  updateConversationTitle: (id: string, title: string) => void;
  setContextTokens: (conversationId: string, tokens: number) => void;
  setMessageTokens: (tokens: number) => void;
  setStatusMessage: (msg: string | null) => void;
  setActiveModel: (model: string) => void;

  conversationSearchAll: Record<string, boolean>;
  setSearchAll: (convId: string, val: boolean) => void;
  pendingSearchAll: boolean;
  setPendingSearchAll: (val: boolean) => void;
}

export const useChatStore = create<ChatState>((set) => ({
  conversations: [],
  activeConversationId: null,
  messages: {},
  streamingContent: '',
  isStreaming: false,
  contextTokens: {},
  contextBudget: 4096,
  messageTokens: 0,
  statusMessage: null,
  activeModel: process.env.NEXT_PUBLIC_OLLAMA_MODEL ?? 'qwen2.5:7b',

  conversationSearchAll: {},
  setSearchAll: (convId, val) =>
    set((s) => ({ conversationSearchAll: { ...s.conversationSearchAll, [convId]: val } })),
  pendingSearchAll: false,
  setPendingSearchAll: (val) => set({ pendingSearchAll: val }),

  setConversations: (convs) => set({ conversations: convs }),

  addConversation: (conv) =>
    set((s) => ({
      conversations: [
        conv,
        ...s.conversations.filter(
          (c) => c.conversation_id !== conv.conversation_id
        ),
      ],
    })),

  setActiveConversation: (id) => set({ activeConversationId: id }),

  setMessages: (conversationId, msgs) =>
    set((s) => ({ messages: { ...s.messages, [conversationId]: msgs } })),

  addMessage: (conversationId, msg) =>
    set((s) => ({
      messages: {
        ...s.messages,
        [conversationId]: [...(s.messages[conversationId] ?? []), msg],
      },
    })),

  appendStreamToken: (token) =>
    set((s) => ({ streamingContent: s.streamingContent + token })),

  setIsStreaming: (val) => set({ isStreaming: val }),

  clearStream: () => set({ streamingContent: '', statusMessage: null }),

  updateConversationTitle: (id, title) =>
    set((s) => ({
      conversations: s.conversations.map((c) =>
        c.conversation_id === id ? { ...c, title } : c
      ),
    })),

  setContextTokens: (conversationId, tokens) =>
    set((s) => ({ contextTokens: { ...s.contextTokens, [conversationId]: tokens } })),

  setMessageTokens: (tokens) => set({ messageTokens: tokens }),

  setStatusMessage: (msg) => set({ statusMessage: msg }),
  setActiveModel: (model) => set({ activeModel: model }),
}));
