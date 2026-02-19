import {
  MessageSquare,
  Search,
  Network,
  BookOpen,
  FileText,
  Settings,
} from "lucide-react";
import { useUIStore } from "../../stores/ui.store";
import { cn } from "../../utils/cn";

const TABS = [
  { id: "chat" as const, label: "Chat", icon: MessageSquare },
  { id: "research" as const, label: "Research", icon: Search },
  { id: "graph" as const, label: "Knowledge", icon: Network },
  { id: "quizzes" as const, label: "Quizzes", icon: BookOpen },
  { id: "documents" as const, label: "Documents", icon: FileText },
  { id: "settings" as const, label: "Settings", icon: Settings },
];

export function TabBar() {
  const { activeTab, setActiveTab } = useUIStore();

  return (
    <div className="flex items-center gap-1 px-4 py-2 border-b border-border/50 glass-subtle flex-shrink-0">
      {TABS.map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          onClick={() => setActiveTab(id)}
          className={cn(
            "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-all",
            activeTab === id
              ? "bg-primary/15 text-primary border border-primary/25"
              : "text-muted-foreground hover:text-foreground hover:bg-white/5"
          )}
        >
          <Icon size={14} />
          {label}
        </button>
      ))}
    </div>
  );
}
