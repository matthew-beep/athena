import { create } from "zustand";

type Tab = "chat" | "research" | "graph" | "quizzes" | "documents" | "settings";

interface UIState {
  activeTab: Tab;
  sidebarOpen: boolean;
  setActiveTab: (tab: Tab) => void;
  setSidebarOpen: (open: boolean) => void;
  toggleSidebar: () => void;
}

export const useUIStore = create<UIState>((set) => ({
  activeTab: "chat",
  sidebarOpen: true,
  setActiveTab: (activeTab) => set({ activeTab }),
  setSidebarOpen: (sidebarOpen) => set({ sidebarOpen }),
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
}));
