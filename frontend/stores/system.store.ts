'use client';

import { create } from 'zustand';
import type { ResourceStats } from '@/types';
import { HealthStats } from '@/hooks/useHealthCheck';

interface SystemState {
  stats: ResourceStats | null;
  lastUpdated: number | null;
  setStats: (stats: ResourceStats) => void;
  health: HealthStats | null;
  setHealth: (health: HealthStats) => void;
}

export const useSystemStore = create<SystemState>((set) => ({
  stats: null,
  lastUpdated: null,
  setStats: (stats) => set({ stats, lastUpdated: Date.now() }),
  health: null,
  setHealth: (health) => set({ health }),
}));
