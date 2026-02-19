import { Sidebar } from "./Sidebar";
import { TabBar } from "./TabBar";
import { SystemFooter } from "./SystemFooter";
import { useUIStore } from "../../stores/ui.store";
import { ChatWindow } from "../chat/ChatWindow";
import { ResearchPanel } from "../research/ResearchPanel";
import { KnowledgeGraph } from "../graph/KnowledgeGraph";
import { QuizzesPanel } from "../quizzes/QuizzesPanel";
import { DocumentsPanel } from "../documents/DocumentsPanel";
import { SettingsPanel } from "../settings/SettingsPanel";

function TabContent() {
  const { activeTab } = useUIStore();
  switch (activeTab) {
    case "chat":
      return <ChatWindow />;
    case "research":
      return <ResearchPanel />;
    case "graph":
      return <KnowledgeGraph />;
    case "quizzes":
      return <QuizzesPanel />;
    case "documents":
      return <DocumentsPanel />;
    case "settings":
      return <SettingsPanel />;
    default:
      return <ChatWindow />;
  }
}

export function AppShell() {
  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden bg-background">
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <div className="flex flex-col flex-1 overflow-hidden">
          <TabBar />
          <div className="flex-1 overflow-hidden">
            <TabContent />
          </div>
        </div>
      </div>
      <SystemFooter />
    </div>
  );
}
