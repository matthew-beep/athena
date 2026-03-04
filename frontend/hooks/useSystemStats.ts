'use client';

import { useEffect, useState } from 'react';
import { apiClient } from '@/api/client';
import { useSystemStore } from '@/stores/system.store';
import { useAuthStore } from '@/stores/auth.store';
import type { ResourceStats, ModelStats } from '@/types';

export function useSystemStats(intervalMs = 10000) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const setStats = useSystemStore((s) => s.setStats);

  useEffect(() => {
    if (!isAuthenticated) return;

    const fetchStats = async () => {
      try {
        const stats = await apiClient.get<ResourceStats>('/system/resources');
        setStats(stats);
      } catch {
        // silently fail — footer shows stale data
      }
    };

    fetchStats();
    const id = setInterval(fetchStats, intervalMs);
    return () => clearInterval(id);
  }, [isAuthenticated, intervalMs, setStats]);
}


export function useModelStats(intervalMs = 15000) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const [modelStats, setModelStats] = useState<ModelStats | null>(null);

  useEffect(() => {
    if (!isAuthenticated) return;

    const fetch = async () => {
      try {
        const data = await apiClient.get<ModelStats>('/system/model-stats');
        setModelStats(data);
      } catch {
        // silently fail
      }
    };

    fetch();
    const id = setInterval(fetch, intervalMs);
    return () => clearInterval(id);
  }, [isAuthenticated, intervalMs]);

  return modelStats;
}