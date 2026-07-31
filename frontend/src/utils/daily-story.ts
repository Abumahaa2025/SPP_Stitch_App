import type { Briefing } from '@/src/api/client';
import type { IntelligenceInsight } from '@/src/api/intelligence';

export type StoryTone = 'attention' | 'neutral' | 'positive' | 'opportunity';
export type StoryIcon = 'contract' | 'maintenance' | 'collection' | 'opportunity' | 'sensor' | 'spark';

export type DailyStoryItem = {
  id: string;
  icon: StoryIcon;
  text: string;
  tone: StoryTone;
  route?: string;
  propertyId?: string;
};

type TFn = (key: string) => string;

function greetingKey(): string {
  const h = new Date().getHours();
  if (h < 12) return 'story.greeting.morning';
  if (h < 17) return 'story.greeting.afternoon';
  return 'story.greeting.evening';
}

/** Build the first-30-seconds narrative from live briefing data. */
export function buildDailyStory(
  briefing: Briefing | null,
  insights: IntelligenceInsight[],
  t: TFn,
): { greeting: string; intro: string; items: DailyStoryItem[] } {
  const items: DailyStoryItem[] = [];

  if (!briefing) {
    return { greeting: t(greetingKey()), intro: t('story.intro'), items: [] };
  }

  const contracts = briefing.expiring_contracts ?? 0;
  if (contracts === 1) {
    items.push({
      id: 'contracts',
      icon: 'contract',
      text: t('story.contracts.one'),
      tone: 'attention',
      route: '/contracts',
    });
  } else if (contracts > 1) {
    items.push({
      id: 'contracts',
      icon: 'contract',
      text: t('story.contracts.many').replace('{count}', String(contracts)),
      tone: 'attention',
      route: '/contracts',
    });
  }

  const maint = briefing.decisions.filter((d) => d.kind === 'maintenance').length;
  if (maint === 1) {
    const d = briefing.decisions.find((x) => x.kind === 'maintenance');
    items.push({
      id: 'maintenance',
      icon: 'maintenance',
      text: t('story.maintenance.one'),
      tone: 'attention',
      route: '/maintenance',
      propertyId: d?.property_id,
    });
  } else if (maint > 1) {
    items.push({
      id: 'maintenance',
      icon: 'maintenance',
      text: t('story.maintenance.many').replace('{count}', String(maint)),
      tone: 'attention',
      route: '/maintenance',
    });
  }

  const occ = briefing.occupancy ?? 0;
  if (occ > 0) {
    items.push({
      id: 'collection',
      icon: 'collection',
      text: t('story.collection').replace('{pct}', String(occ)),
      tone: occ >= 90 ? 'positive' : occ >= 75 ? 'neutral' : 'attention',
      route: '/insights',
    });
  }

  const opps = briefing.decisions.filter((d) => d.kind === 'opportunity');
  if (opps.length === 1) {
    items.push({
      id: 'opportunity',
      icon: 'opportunity',
      text: opps[0].title || t('story.opportunity.one'),
      tone: 'opportunity',
      route: opps[0].property_id ? `/property/${opps[0].property_id}` : '/intelligence',
      propertyId: opps[0].property_id,
    });
  } else if (opps.length > 1) {
    items.push({
      id: 'opportunity',
      icon: 'opportunity',
      text: t('story.opportunity.many').replace('{count}', String(opps.length)),
      tone: 'opportunity',
      route: '/intelligence',
    });
  } else if (insights.length > 0) {
    const top = insights[0];
    items.push({
      id: `insight-${top.id}`,
      icon: 'opportunity',
      text: top.headline,
      tone: 'opportunity',
      route: top.property_id ? `/property/${top.property_id}` : '/intelligence',
      propertyId: top.property_id ?? undefined,
    });
  }

  const alerts = briefing.sensor_alerts?.length ?? 0;
  if (alerts > 0) {
    items.push({
      id: 'sensors',
      icon: 'sensor',
      text: alerts === 1
        ? t('story.sensor.one')
        : t('story.sensor.many').replace('{count}', String(alerts)),
      tone: 'attention',
      route: '/sensors',
    });
  }

  if (briefing.properties_count > 0) {
    items.push({
      id: 'spp-working',
      icon: 'spark',
      text: t('story.spp.doing').replace('{count}', String(briefing.properties_count)),
      tone: 'positive',
      route: '/hub',
    });
  }

  return {
    greeting: t(greetingKey()),
    intro: t('story.intro'),
    items: items.slice(0, 6),
  };
}
