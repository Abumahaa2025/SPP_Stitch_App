import type { Briefing } from '@/src/api/client';
import type { PulseItem } from '@/src/components/PulseRow';

type TFn = (k: string) => string;

/** Source web #homePulseRow — المهام · المتأخرات · الصيانة · التحصيل */
export function buildPulseItems(briefing: Briefing | null, t: TFn): PulseItem[] {
  if (!briefing || briefing.properties_count === 0) {
    return [
      { key: 'tasks', label: t('home.pulse.tasks'), value: '—' },
      { key: 'late', label: t('home.pulse.late'), value: '—' },
      { key: 'maintenance', label: t('home.pulse.maintenance'), value: '—' },
      { key: 'collection', label: t('home.pulse.collection'), value: '—' },
    ];
  }

  const tasks = briefing.decisions.length;
  const late = briefing.decisions.filter((d) => d.kind === 'financial').length;
  const maintenance = briefing.decisions.filter((d) => d.kind === 'maintenance').length;
  const collection = briefing.occupancy > 0 ? `${briefing.occupancy}%` : '—';

  return [
    {
      key: 'tasks',
      label: t('home.pulse.tasks'),
      value: String(tasks),
      onPress: tasks > 0 ? () => {} : undefined,
    },
    {
      key: 'late',
      label: t('home.pulse.late'),
      value: late > 0 ? String(late) : '0',
    },
    {
      key: 'maintenance',
      label: t('home.pulse.maintenance'),
      value: maintenance > 0 ? String(maintenance) : '0',
    },
    {
      key: 'collection',
      label: t('home.pulse.collection'),
      value: collection,
    },
  ];
}
