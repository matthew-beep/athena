import { MessageList } from "./MessageList";
import { MessageInput } from "./MessageInput";
import { useChatStore } from "../../stores/chat.store";

export function ChatWindow() {
  const { activeConversationId } = useChatStore();

  return (
    <div className="h-full flex flex-col">
      <MessageList conversationId={activeConversationId} />
      <MessageInput />
    </div>
  );
}
