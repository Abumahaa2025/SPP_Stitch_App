import type { Briefing, DecisionT } from '@/src/api/client';
import type { IntelligenceInsight } from '@/src/api/intelligence';

export type CommandItemKind = 'reviewed' | 'found' | 'solved' | 'recommend' | 'watching';

export type CommandItem = {
  id: string;
  kind: CommandItemKind;
  text: string;
  route?: string;
  propertyId?: string;
  decisionId?: string;
  live?: boolean;
};

type TFn = (key: string) => string;

function greetingKey(): string {
  const h = new Date().getHours();
  if (h < 12) return 'story.greeting.morning';
  if (h < 17) return 'story.greeting.afternoon';
  return 'story.greeting.evening';
}

/** Executive command center — SPP already worked before the owner arrived. */
export function buildCommandCenter(
  briefing: Briefing | null,
  insights: IntelligenceInsight[],
  t: TFn,
): {
  greeting: string;
  lead: string;
  work: CommandItem[];
  recommendations: DecisionT[];
} {
  if (!briefing) {
    return {
      greeting: t(greetingKey()),
      lead: t('cmd.lead.empty'),
      work: [],
      recommendations: [],
    };
  }

  const work: CommandItem[] = [];

  if (briefing.properties_count > 0) {
    work.push({
      id: 'reviewed',
      kind: 'reviewed',
      text: t('cmd.reviewed').replace('{count}', String(briefing.properties_count)),
      route: '/portfolio',
      live: true,
    });
  }

  const opps = briefing.decisions.filter((d) => d.kind === 'opportunity');
  const insightCount = Math.max(opps.length, insights.length);
  if (insightCount > 0) {
    work.push({
      id: 'found',
      kind: 'found',
      text: insightCount === 1
        ? t('cmd.found.one')
        : t('cmd.found.many').replace('{count}', String(insightCount)),
      route: '/intelligence',
      live: true,
    });
  }

  const maint = briefing.decisions.filter((d) => d.kind === 'maintenance');
  const solved = briefing.sensor_alerts?.length === 0 && maint.length === 0;
  if (solved && briefing.properties_count > 0) {
    work.push({
      id: 'solved',
      kind: 'solved',
      text: t('cmd.solved.quiet'),
      route: '/health',
    });
  } else if (maint.length > 0) {
    work.push({
      id: 'solved',
      kind: 'solved',
      text: maint.length === 1
        ? t('cmd.solved.one')
        : t('cmd.solved.many').replace('{count}', String(maint.length)),
      route: '/maintenance',
    });
  }

  if (briefing.expiring_contracts > 0) {
    work.push({
      id: 'watch-contracts',
      kind: 'watching',
      text: briefing.expiring_contracts === 1
        ? t('cmd.watch.contract.one')
        : t('cmd.watch.contract.many').replace('{count}', String(briefing.expiring_contracts)),
      route: '/contracts',
      live: true,
    });
  }

  if (briefing.occupancy > 0 && briefing.occupancy < 85) {
    work.push({
      id: 'watch-collection',
      kind: 'watching',
      text: t('cmd.watch.collection').replace('{pct}', String(briefing.occupancy)),
      route: '/insights',
      live: true,
    });
  }

  const recommendations = briefing.decisions.slice(0, 4);

  return {
    greeting: t(greetingKey()),
    lead: t('cmd.lead'),
    work: work.slice(0, 5),
    recommendations,
  };
}
