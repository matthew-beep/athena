'use client';

import { create } from 'zustand';
import type { ResourceStats } from '@/types';
import { HealthStats } from '@/hooks/useHealthCheck';

interface InferenceStats {
  ttftMs: number
  tokensPerSec: number
}

interface SystemState {
  stats: ResourceStats | null;
  lastUpdated: number | null;
  setStats: (stats: ResourceStats) => void;
  health: HealthStats | null;
  setHealth: (health: HealthStats) => void;
  lastInferenceStats: InferenceStats | null;
  setLastInferenceStats: (stats: InferenceStats) => void;
  /** Running sum/count for average TTFT (session) */
  ttftSum: number;
  ttftCount: number;
}

export const useSystemStore = create<SystemState>((set) => ({
  stats: null,
  lastUpdated: null,
  setStats: (stats) => set({ stats, lastUpdated: Date.now() }),
  health: null,
  setHealth: (health) => set({ health }),
  lastInferenceStats: null,
  setLastInferenceStats: (stats) =>
    set((s) => ({
      lastInferenceStats: stats,
      ttftSum: s.ttftSum + stats.ttftMs,
      ttftCount: s.ttftCount + 1,
    })),
  ttftSum: 0,
  ttftCount: 0,
}));