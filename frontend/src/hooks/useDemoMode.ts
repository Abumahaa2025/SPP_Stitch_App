import { useCallback, useEffect, useState } from 'react';
import { storage } from '@/src/utils/storage';
import { api } from '@/src/api/client';

const KEY = 'spp.demoMode';

export function useDemoMode() {
  const [demoMode, setDemoModeState] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    storage.getItem<boolean>(KEY, false).then((v) => {
      setDemoModeState(v ?? false);
      setLoading(false);
    });
  }, []);

  const setDemoMode = useCallback(async (enabled: boolean) => {
    setLoading(true);
    try {
      if (enabled) {
        await api.loadDemo();
      } else {
        await api.clearDemo();
      }
      await storage.setItem(KEY, enabled);
      setDemoModeState(enabled);
    } finally {
      setLoading(false);
    }
  }, []);

  return { demoMode, loading, setDemoMode };
}
