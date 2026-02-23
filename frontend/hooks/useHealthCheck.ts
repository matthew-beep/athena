'use client';

import { useEffect } from 'react';
import { apiClient } from '@/api/client';
import { useSystemStore } from '@/stores/system.store';

type HealthDetails = Record<string, boolean>;

export type HealthStats = {
  status: 'ok' | 'fail';
  details: HealthDetails;
};

export function useHealthCheck(intervalMs = 10000) {
  const setHealth = useSystemStore((s) => s.setHealth);

  useEffect(() => {
    const fetchHealth = async () => {
      try {
        const data = await apiClient.get<HealthStats>('/system/health');
        setHealth(data);
      } catch {
        // mark as failed if request fails
        setHealth({ status: 'fail', details: {} });
      }
    };

    fetchHealth();
    const id = setInterval(fetchHealth, intervalMs);
    return () => clearInterval(id);
  }, [intervalMs, setHealth]);
}