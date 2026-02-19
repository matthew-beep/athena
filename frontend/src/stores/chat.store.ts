import { create } from "zustand";
import type { Conversation, Message } from "../types";

interface ChatState {
  conversations: Conversation[];
  activeConversationId: string | null;
  messages: Record<string, Message[]>;
  streamingContent: string;
  isStreaming: boolean;
  setConversations: (convs: Conversation[]) => void;
  addConversation: (conv: Conversation) => void;
  setActiveConversation: (id: string | null) => void;
  setMessages: (conversationId: string, msgs: Message[]) => void;
  addMessage: (conversationId: string, msg: Message) => void;
  appendStreamToken: (token: string) => void;
  setIsStreaming: (val: boolean) => void;
  clearStream: () => void;
  updateConversationTitle: (id: string, title: string) => void;
}

export const useChatStore = create<ChatState>((set) => ({
  conversations: [],
  activeConversationId: null,
  messages: {},
  streamingContent: "",
  isStreaming: false,

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

  clearStream: () => set({ streamingContent: "" }),

  updateConversationTitle: (id, title) =>
    set((s) => ({
      conversations: s.conversations.map((c) =>
        c.conversation_id === id ? { ...c, title } : c
      ),
    })),
}));
