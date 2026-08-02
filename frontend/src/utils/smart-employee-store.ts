/** Persist Smart Employee state locally. */
import { storage } from '@/src/utils/storage';
import type { SmartEmployeeState } from '@/src/types/smart-employee';

const KEY = 'spp.smartEmployee';

const EMPTY: SmartEmployeeState = { tasks: [], activity: [] };

export async function loadSmartEmployee(): Promise<SmartEmployeeState> {
  const raw = await storage.getItem<string>(KEY, '');
  if (!raw) return EMPTY;
  try {
    const parsed = JSON.parse(raw) as SmartEmployeeState;
    return {
      tasks: parsed.tasks || [],
      activity: parsed.activity || [],
      lastThoughtAt: parsed.lastThoughtAt,
      lastThoughtAr: parsed.lastThoughtAr,
      lastThoughtEn: parsed.lastThoughtEn,
    };
  } catch {
    return EMPTY;
  }
}

export async function saveSmartEmployee(state: SmartEmployeeState): Promise<void> {
  await storage.setItem(KEY, JSON.stringify({
    ...state,
    tasks: (state.tasks || []).slice(0, 40),
    activity: (state.activity || []).slice(0, 30),
  }));
}
