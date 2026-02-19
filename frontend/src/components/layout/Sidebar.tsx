import { useEffect } from "react";
import { PlusCircle, MessageSquare, LogOut } from "lucide-react";
import { useChatStore } from "../../stores/chat.store";
import { useAuthStore } from "../../stores/auth.store";
import { apiClient } from "../../api/client";
import type { Conversation, Message } from "../../types";
import { cn } from "../../utils/cn";

export function Sidebar() {
  const { logout, user } = useAuthStore();
  const {
    conversations,
    setConversations,
    activeConversationId,
    setActiveConversation,
    setMessages,
  } = useChatStore();

  useEffect(() => {
    apiClient
      .get<Conversation[]>("/chat/conversations")
      .then(setConversations)
      .catch(console.error);
  }, [setConversations]);

  const handleSelectConversation = async (conv: Conversation) => {
    setActiveConversation(conv.conversation_id);
    try {
      const msgs = await apiClient.get<Message[]>(
        `/chat/conversations/${conv.conversation_id}/messages`
      );
      setMessages(conv.conversation_id, msgs);
    } catch (e) {
      console.error(e);
    }
  };

  const handleNewChat = () => {
    setActiveConversation(null);
  };

  return (
    <div className="w-64 h-full flex flex-col glass-subtle border-r border-border/50 flex-shrink-0">
      {/* Header */}
      <div className="p-4 border-b border-border/50">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-7 h-7 rounded-lg bg-primary/20 border border-primary/30 flex items-center justify-center">
            <span className="text-primary text-sm font-bold">A</span>
          </div>
          <span className="font-semibold text-sm">Athena</span>
        </div>
        <button
          onClick={handleNewChat}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-xl glass-subtle hover:glass text-sm text-muted-foreground hover:text-foreground transition-all"
        >
          <PlusCircle size={14} />
          New conversation
        </button>
      </div>

      {/* Conversation list */}
      <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
        {conversations.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-8">
            No conversations yet
          </p>
        )}
        {conversations.map((conv) => (
          <button
            key={conv.conversation_id}
            onClick={() => handleSelectConversation(conv)}
            className={cn(
              "w-full text-left px-3 py-2 rounded-lg text-sm transition-all flex items-start gap-2",
              activeConversationId === conv.conversation_id
                ? "bg-primary/15 text-primary border border-primary/20"
                : "text-muted-foreground hover:text-foreground hover:bg-white/5"
            )}
          >
            <MessageSquare size={13} className="mt-0.5 shrink-0" />
            <span className="truncate leading-tight">
              {conv.title ?? "Untitled"}
            </span>
          </button>
        ))}
      </div>

      {/* Footer */}
      <div className="p-3 border-t border-border/50">
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">{user?.username}</span>
          <button
            onClick={logout}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-white/5 transition-all"
            title="Logout"
          >
            <LogOut size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
