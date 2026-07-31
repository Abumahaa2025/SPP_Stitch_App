import { useCallback, useEffect, useState } from 'react';
import {
  addTechnician,
  loadTechnicians,
  subscribeTechnicians,
  recordTechLogin,
  updateTechnicianRating,
} from '@/src/utils/technician-store';
import type { TechnicianRecord, TechnicianSpecialty } from '@/src/types/technician';

export function useTechnicians() {
  const [technicians, setTechnicians] = useState<TechnicianRecord[]>([]);
  const [ready, setReady] = useState(false);

  const reload = useCallback(async () => {
    setTechnicians(await loadTechnicians());
    setReady(true);
  }, []);

  useEffect(() => {
    reload();
    const unsub = subscribeTechnicians(() => { reload(); });
    return () => { unsub(); };
  }, [reload]);

  const create = useCallback(async (input: {
    name: string;
    phone: string;
    specialty: TechnicianSpecialty;
  }) => {
    const tech = await addTechnician(input);
    await reload();
    return tech;
  }, [reload]);

  const logLogin = useCallback(async (id: string) => {
    await recordTechLogin(id);
    await reload();
  }, [reload]);

  const rate = useCallback(async (id: string, rating: number) => {
    await updateTechnicianRating(id, rating);
    await reload();
  }, [reload]);

  return { ready, technicians, create, logLogin, rate, reload };
}
