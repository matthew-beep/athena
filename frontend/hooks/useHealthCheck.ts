'use client';

import { useEffect } from 'react';
import { apiClient } from '@/api/client';
import { useSystemStore } from '@/stores/system.store';
import { useChatStore } from '@/stores/chat.store';

type HealthDetails = Record<string, boolean>;

export type HealthStats = {
  status: 'ok' | 'fail';
  details: HealthDetails;
};

export function useHealthCheck(intervalMs = 10000) {
  const setHealth = useSystemStore((s) => s.setHealth);
  const setActiveModel = useChatStore((s) => s.setActiveModel);

  useEffect(() => {
    const fetchHealth = async () => {
      try {
        const data = await apiClient.get<HealthStats>('/system/health');
        setHealth(data);
      } catch {
        setHealth({ status: 'fail', details: {} });
      }
    };

    const fetchModels = async () => {
      try {
        const data = await apiClient.get<{ models: { name: string; tier: number }[] }>('/system/models');
        const tier1 = data.models.find((m) => m.tier === 1);
        if (tier1) setActiveModel(tier1.name);
      } catch {
        // leave as default
      }
    };

    fetchHealth();
    fetchModels(); // seed model name on mount, no need to poll
    const id = setInterval(fetchHealth, intervalMs);
    return () => clearInterval(id);
  }, [intervalMs, setHealth, setActiveModel]);
}