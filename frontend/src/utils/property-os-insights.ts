import type { PropertyOSState } from '@/src/types/property-os';
import type { Briefing } from '@/src/api/client';

export type SetupInsight = {
  id: string;
  text: string;
  priority: 'high' | 'medium' | 'low';
  actionRoute?: string;
};

export function buildSetupInsights(
  os: PropertyOSState,
  briefing: Briefing | null,
  t: (k: string) => string,
): SetupInsight[] {
  const insights: SetupInsight[] = [];
  const occupied = os.units.filter((u) => u.status === 'occupied').length;
  const total = os.units.length || 1;
  const occPct = Math.round((occupied / total) * 100);

  const lateCount = briefing?.decisions?.filter((d) =>
    d.title?.includes('late') || d.title?.includes('متأخر'),
  ).length ?? Math.max(0, os.tenants.length - os.contracts.length);

  if (lateCount > 0) {
    insights.push({
      id: 'late',
      text: t('pos.insights.late').replace('{n}', String(lateCount)),
      priority: 'high',
      actionRoute: '/billing',
    });
  }

  const expiring = briefing?.expiring_contracts ?? os.contracts.filter((c) => {
    const days = Math.round((new Date(c.endDate).getTime() - Date.now()) / 86400000);
    return days >= 0 && days <= 12;
  }).length;

  if (expiring > 0) {
    insights.push({
      id: 'expiring',
      text: t('pos.insights.expiring').replace('{n}', String(expiring)),
      priority: 'high',
      actionRoute: '/contracts',
    });
  }

  const costUnit = os.units.find((u) => u.notes?.includes('سباكة') || u.notes?.includes('plumb'));
  if (costUnit) {
    insights.push({
      id: 'cost',
      text: t('pos.insights.costUnit').replace('{unit}', costUnit.number),
      priority: 'medium',
      actionRoute: '/maintenance',
    });
  } else if (os.units.length) {
    insights.push({
      id: 'cost',
      text: t('pos.insights.costUnit').replace('{unit}', os.units[0].number),
      priority: 'low',
      actionRoute: '/maintenance',
    });
  }

  if (os.units.some((u) => u.notes?.includes('سباكة') || u.notes?.includes('plumb'))) {
    insights.push({
      id: 'plumbing',
      text: t('pos.insights.plumbing').replace('{pct}', '18'),
      priority: 'medium',
      actionRoute: '/insights',
    });
  }

  if (occPct < 96 && os.units.length >= 2) {
    insights.push({
      id: 'occ',
      text: t('pos.insights.occupancy').replace('{pct}', String(Math.max(1, 100 - occPct))),
      priority: 'medium',
      actionRoute: '/health',
    });
  }

  const tenant = os.tenants[0];
  if (tenant) {
    insights.push({
      id: 'contact',
      text: t('pos.insights.contact').replace('{name}', tenant.name),
      priority: 'medium',
      actionRoute: '/tenants',
    });
  }

  const unit = os.units.find((u) => u.status === 'occupied');
  if (unit) {
    insights.push({
      id: 'rent',
      text: t('pos.insights.rentRaise').replace('{unit}', unit.number),
      priority: 'low',
      actionRoute: '/contracts',
    });
  }

  insights.push({
    id: 'pdf',
    text: t('pos.insights.pdf'),
    priority: 'low',
    actionRoute: '/reports',
  });

  insights.push({
    id: 'wa',
    text: t('pos.insights.whatsapp'),
    priority: 'low',
    actionRoute: '/setup/whatsapp',
  });

  return insights.slice(0, 6);
}
