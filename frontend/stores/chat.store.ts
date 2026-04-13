'use client';

import { create } from 'zustand';
import type { Conversation, Message, RagSource, ConversationDocument } from '@/types';

export interface PendingDocument {
  document_id: string;
  filename: string;
  file_type?: string;
}

interface ChatState {
  conversations: Conversation[];
  activeConversationId: string | null;
  messages: Record<string, Message[]>;
  streamingContent: Record<string, string>;
  isStreaming: Record<string, boolean>;
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
  appendStreamToken: (convId: string, token: string) => void;
  setIsStreaming: (convId: string, val: boolean) => void;
  clearStream: (convId: string) => void;
  updateConversationTitle: (id: string, title: string) => void;
  setContextTokens: (conversationId: string, tokens: number) => void;
  bulkSetContextTokens: (map: Record<string, number>) => void;
  setContextBudget: (budget: number) => void;
  setMessageTokens: (tokens: number) => void;
  setStatusMessage: (msg: string | null) => void;
  setActiveModel: (model: string) => void;

  conversationSearchAll: Record<string, boolean>;
  setSearchAll: (convId: string, val: boolean) => void;
  pendingSearchAll: boolean;
  setPendingSearchAll: (val: boolean) => void;

  /** Docs staged to attach once the first message creates the conversation */
  pendingDocuments: PendingDocument[];
  setPendingDocuments: (docs: PendingDocument[]) => void;

  /** Documents currently attached to each conversation — source of truth for scope bar + attach buttons */
  conversationDocuments: Record<string, ConversationDocument[]>;
  setConversationDocuments: (convId: string, docs: ConversationDocument[]) => void;
  addConversationDocument: (convId: string, doc: ConversationDocument) => void;
  removeConversationDocument: (convId: string, docId: string) => void;

  /** Citation Shutter: when set, Context Sidebar shows the source chunk in a drill-down drawer */
  citationShutter: RagSource | null;
  setCitationShutter: (source: RagSource | null) => void;

  /** Command palette (document picker) open state — only relevant when on chat page */
  commandPaletteOpen: boolean;
  setCommandPaletteOpen: (open: boolean) => void;

  /** When set (timestamp), UI can show live "waiting for first token" count-up until first token or done */
  requestStartedAt: number | null;
  setRequestStartedAt: (t: number | null) => void;

  /** TTFT in ms when first token arrived; shown until 'done' updates lastInferenceStats (avoids flash of old value) */
  firstTokenReachedMs: number | null;
  setFirstTokenReachedMs: (ms: number | null) => void;

  /**  rag sources for the active conversation */
  selectedMessageId: Record<string, string>;
  setSelectedMessageId: (conversationId: string, id: string) => void;

  selectedSourceIndex: number | null;
  setSelectedSourceIndex: (index: number | null) => void;

  /** Suggestions for the active conversation */
  conversationSuggestions: Record<string, { suggestions: string[]; loading: boolean }>;
  setConversationSuggestions: (conversationId: string, suggestions: string[]) => void;
  setConversationSuggestionsLoading: (conversationId: string, loading: boolean) => void;
}

export const useChatStore = create<ChatState>((set) => ({
  conversations: [],
  activeConversationId: null,
  messages: {},
  streamingContent: {},
  isStreaming: {},
  contextTokens: {},
  contextBudget: 0,
  messageTokens: 0,
  statusMessage: null,
  activeModel: process.env.NEXT_PUBLIC_OLLAMA_MODEL ?? 'qwen2.5:7b',

  conversationSearchAll: {},
  setSearchAll: (convId, val) =>
    set((s) => ({ conversationSearchAll: { ...s.conversationSearchAll, [convId]: val } })),
  pendingSearchAll: false,
  setPendingSearchAll: (val) => set({ pendingSearchAll: val }),

  pendingDocuments: [],
  setPendingDocuments: (docs) => set({ pendingDocuments: docs }),

  conversationDocuments: {},
  setConversationDocuments: (convId, docs) =>
    set((s) => ({ conversationDocuments: { ...s.conversationDocuments, [convId]: docs } })),
  addConversationDocument: (convId, doc) =>
    set((s) => {
      const existing = s.conversationDocuments[convId] ?? [];
      if (existing.some((d) => d.document_id === doc.document_id)) return s;
      return { conversationDocuments: { ...s.conversationDocuments, [convId]: [...existing, doc] } };
    }),
  removeConversationDocument: (convId, docId) =>
    set((s) => ({
      conversationDocuments: {
        ...s.conversationDocuments,
        [convId]: (s.conversationDocuments[convId] ?? []).filter((d) => d.document_id !== docId),
      },
    })),

  citationShutter: null,
  setCitationShutter: (source) => set({ citationShutter: source }),

  commandPaletteOpen: false,
  setCommandPaletteOpen: (open) => set({ commandPaletteOpen: open }),

  requestStartedAt: null,
  setRequestStartedAt: (t) => set({ requestStartedAt: t }),

  firstTokenReachedMs: null,
  setFirstTokenReachedMs: (ms) => set({ firstTokenReachedMs: ms }),

  selectedMessageId: {},
  setSelectedMessageId: (conversationId, id) => set((s) => ({ selectedMessageId: { ...s.selectedMessageId, [conversationId]: id } })),

  selectedSourceIndex: null,
  setSelectedSourceIndex: (index) => set({ selectedSourceIndex: index }),

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

  appendStreamToken: (convId, token) =>
    set((s) => ({ streamingContent: { ...s.streamingContent, [convId]: (s.streamingContent[convId] ?? '') + token } })),

  setIsStreaming: (convId, val) =>
    set((s) => ({ isStreaming: { ...s.isStreaming, [convId]: val } })),

  clearStream: (convId) =>
    set((s) => ({ streamingContent: { ...s.streamingContent, [convId]: '' }, statusMessage: null })),

  updateConversationTitle: (id, title) =>
    set((s) => ({
      conversations: s.conversations.map((c) =>
        c.conversation_id === id ? { ...c, title } : c
      ),
    })),

  setContextTokens: (conversationId, tokens) =>
    set((s) => ({ contextTokens: { ...s.contextTokens, [conversationId]: tokens } })),

  bulkSetContextTokens: (map) =>
    set((s) => ({ contextTokens: { ...s.contextTokens, ...map } })),

  setContextBudget: (budget) => set({ contextBudget: budget }),

  setMessageTokens: (tokens) => set({ messageTokens: tokens }),

  setStatusMessage: (msg) => set({ statusMessage: msg }),
  setActiveModel: (model) => set({ activeModel: model }),

  conversationSuggestions: {},
  setConversationSuggestions: (conversationId, suggestions) =>
    set((s) => ({
      conversationSuggestions: {
        ...s.conversationSuggestions,
        [conversationId]: { suggestions, loading: false },
      },
    })),
  setConversationSuggestionsLoading: (conversationId, loading) =>
    set((s) => ({
      conversationSuggestions: {
        ...s.conversationSuggestions,
        [conversationId]: { suggestions: s.conversationSuggestions[conversationId]?.suggestions ?? [], loading },
      },
    })),
}));
