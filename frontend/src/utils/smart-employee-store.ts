/** Persist Smart Employee state locally. */
import { storage } from '@/src/utils/storage';
import type { SmartEmployeeState } from '@/src/types/smart-employee';
import { EMPTY_EMPLOYEE_PREFS } from '@/src/types/smart-employee';

const KEY = 'spp.smartEmployee';

const EMPTY: SmartEmployeeState = {
  tasks: [],
  activity: [],
  prefs: EMPTY_EMPLOYEE_PREFS,
  mode: 'local',
};

export async function loadSmartEmployee(): Promise<SmartEmployeeState> {
  const raw = await storage.getItem<string>(KEY, '');
  if (!raw) return { ...EMPTY, prefs: { ...EMPTY_EMPLOYEE_PREFS } };
  try {
    const parsed = JSON.parse(raw) as SmartEmployeeState;
    return {
      tasks: parsed.tasks || [],
      activity: parsed.activity || [],
      prefs: {
        ...EMPTY_EMPLOYEE_PREFS,
        ...(parsed.prefs || {}),
        dismissCountByKind: { ...(parsed.prefs?.dismissCountByKind || {}) },
        lastDismissedAtByKind: { ...(parsed.prefs?.lastDismissedAtByKind || {}) },
        quietUntilByKind: { ...(parsed.prefs?.quietUntilByKind || {}) },
      },
      mode: parsed.mode || 'local',
      lastThoughtAt: parsed.lastThoughtAt,
      lastThoughtAr: parsed.lastThoughtAr,
      lastThoughtEn: parsed.lastThoughtEn,
    };
  } catch {
    return { ...EMPTY, prefs: { ...EMPTY_EMPLOYEE_PREFS } };
  }
}

export async function saveSmartEmployee(state: SmartEmployeeState): Promise<void> {
  await storage.setItem(KEY, JSON.stringify({
    ...state,
    prefs: state.prefs || EMPTY_EMPLOYEE_PREFS,
    tasks: (state.tasks || []).slice(0, 50),
    activity: (state.activity || []).slice(0, 30),
  }));
}
