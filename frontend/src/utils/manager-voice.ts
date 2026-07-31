import type { Briefing } from '@/src/api/client';
import type { IntelligenceInsight, PortfolioMemory } from '@/src/api/intelligence';
import type { ManagerKey } from '@/src/data/managers';

type TFn = (key: string) => string;

/** Live proactive lines per manager — falls back to inviting defaults. */
export function proactiveForManager(
  key: ManagerKey,
  t: TFn,
  briefing: Briefing | null,
  insights: IntelligenceInsight[],
  memory: PortfolioMemory | null,
): string {
  const d = briefing?.decisions ?? [];
  const maint = d.filter((x) => x.kind === 'maintenance').length;
  const topInsight = insights[0];

  switch (key) {
    case 'assistant':
      return t('os.proactive.assistant');
    case 'property':
      if (briefing?.properties_count) {
        return t('os.proactive.property.live')
          .replace('{count}', String(briefing.properties_count))
          .replace('{pct}', String(briefing.occupancy ?? 0));
      }
      return t('os.proactive.property');
    case 'tenant':
      if (briefing?.tenants_count) {
        return t('os.proactive.tenant.live').replace('{count}', String(briefing.tenants_count));
      }
      return t('os.proactive.tenant');
    case 'contract':
      if (briefing?.expiring_contracts) {
        return briefing.expiring_contracts === 1
          ? t('os.proactive.contract.one')
          : t('os.proactive.contract.many').replace('{count}', String(briefing.expiring_contracts));
      }
      return t('os.proactive.contract');
    case 'financial':
      if (briefing?.occupancy) {
        return t('os.proactive.financial.live').replace('{pct}', String(briefing.occupancy));
      }
      return t('os.proactive.financial');
    case 'maintenance':
      if (maint === 1) return t('os.proactive.maintenance.one');
      if (maint > 1) return t('os.proactive.maintenance.many').replace('{count}', String(maint));
      return t('os.proactive.maintenance');
    case 'memory':
      if (memory?.summary.repeat_faults) {
        return t('os.proactive.memory.live').replace('{count}', String(memory.summary.repeat_faults));
      }
      return t('os.proactive.memory');
    case 'advisor':
      if (topInsight?.headline) return topInsight.headline;
      return t('os.proactive.advisor');
    case 'performance':
      if (briefing?.avg_health) {
        return briefing.avg_health >= 85
          ? t('os.proactive.performance.excellent')
          : briefing.avg_health >= 70
            ? t('os.proactive.performance.stable')
            : t('os.proactive.performance.attention');
      }
      return t('os.proactive.performance');
    case 'documents':
      return t('os.proactive.documents');
    default:
      return t('os.proactive.default');
  }
}
