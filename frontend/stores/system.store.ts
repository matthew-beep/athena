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
  updateTtftAvg: (timeMs: number) => void;
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
  updateTtftAvg: (timeMs) => set((s) => ({ ttftSum: s.ttftSum + timeMs, ttftCount: s.ttftCount + 1 })),
  setLastInferenceStats: (stats) =>
    set((s) => ({
      lastInferenceStats: stats,
    })),
  ttftSum: 0,
  ttftCount: 0,
}));