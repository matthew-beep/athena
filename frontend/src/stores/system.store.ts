import { create } from "zustand";
import type { ResourceStats } from "../types";

interface SystemState {
  stats: ResourceStats | null;
  lastUpdated: number | null;
  setStats: (stats: ResourceStats) => void;
}

export const useSystemStore = create<SystemState>((set) => ({
  stats: null,
  lastUpdated: null,
  setStats: (stats) => set({ stats, lastUpdated: Date.now() }),
}));
