import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Feather } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { ScreenScaffold } from '@/src/components/ScreenScaffold';
import { StoryScreenHeader } from '@/src/components/StoryScreenHeader';
import { AliveEmpty } from '@/src/components/AliveEmpty';
import { GlassCard } from '@/src/components/GlassCard';
import { GuidedSetup } from '@/src/components/GuidedSetup';
import { OperationHint } from '@/src/components/OperationHint';
import { useOperational } from '@/src/hooks/useOperational';
import { usePropertyOS } from '@/src/hooks/usePropertyOS';
import { useNotificationPrefs } from '@/src/hooks/usePreferences';
import { api, type DecisionT, type PropertyT } from '@/src/api/client';
import { colors, spacing, typography } from '@/src/theme';
import { useI18n } from '@/src/i18n';
import { formatDate } from '@/src/utils/locale';
import { AgentPermissionGate } from '@/src/components/AgentPermissionGate';

const daysOpen = (createdAt: string) => {
  const created = new Date(createdAt).getTime();
  return Math.max(1, Math.round((Date.now() - created) / (1000 * 60 * 60 * 24)));
};

export default function Maintenance() {
  const { t } = useI18n();
  const router = useRouter();
  const { countEnabled } = useNotificationPrefs();
  const { state: osState } = usePropertyOS(countEnabled);
  const { openTickets } = useOperational();
  const [decisions, setDecisions] = useState<DecisionT[]>([]);
  const [props, setProps] = useState<PropertyT[]>([]);

  useEffect(() => {
    api.decisions().then((d) => setDecisions(d.filter((x) => x.kind === 'maintenance')));
    api.properties().then(setProps);
  }, []);

  const propMap = useMemo(() => {
    const m = new Map<string, PropertyT>();
    props.forEach((p) => m.set(p.id, p));
    return m;
  }, [props]);

  return (
    <AgentPermissionGate perm="maintenance">
    <ScreenScaffold testID="maintenance-screen">
      <StoryScreenHeader question={t('page.q.maintenance')} hint={t('maintenance.sub')} showBack testID="maintenance-header" />

      <GuidedSetup flowId="technician" defaultOpen={decisions.length === 0 && !openTickets.length} testID="maintenance-guided" />

      <OperationHint feature="maintenance" />

      <Pressable
        style={styles.createBtn}
        onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push('/maintenance/create' as any); }}
        testID="maintenance-new-btn"
      >
        <Text style={styles.createBtnText}>{t('opsv2.maint.new' as any)}</Text>
      </Pressable>

      {openTickets.length > 0 ? (
        <View style={{ marginTop: spacing.lg }}>
          <Text style={styles.sectionEyebrow}>{t('op.owner.maintenance')}</Text>
          {openTickets.map((tk, i) => {
            const unit = osState.units.find((u) => u.id === tk.unitId);
            return (
              <Animated.View key={tk.id} entering={FadeInDown.duration(500).delay(i * 50)} style={{ marginBottom: spacing.md }}>
                <Pressable onPress={() => router.push(`/maintenance/${tk.id}` as any)}>
                <GlassCard padding={16} radiusToken="md" edge="emerald">
                  <Text style={styles.itemTitle}>{tk.title}</Text>
                  <Text style={styles.openFor}>
                    {unit?.number ? `${t('op.tenant.unit')} ${unit.number}` : ''} · {tk.status}
                    {tk.progressPercent != null ? ` · ${tk.progressPercent}%` : ''}
                  </Text>
                  {tk.etaMinutes ? (
                    <Text style={styles.workflowStep}>
                      {t('maint.eta' as any)}: {tk.etaMinutes} {t('maint.minutes' as any)}
                    </Text>
                  ) : null}
                  {tk.technicianName ? <Text style={styles.itemBody}>{tk.technicianName}</Text> : null}
                </GlassCard>
                </Pressable>
              </Animated.View>
            );
          })}
          {osState.technicianPortalToken ? (
            <Pressable
              style={styles.techBtn}
              onPress={() => {
                Haptics.selectionAsync();
                router.push(`/portal/tech?t=${osState.technicianPortalToken}` as any);
              }}
            >
              <Text style={styles.techBtnText}>{t('op.tech.title')} →</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}

      <View style={{ marginTop: spacing.xl }}>
        <Text style={styles.sectionEyebrow}>{t('maintenance.requests.title')}</Text>
        {decisions.length === 0 ? (
          <AliveEmpty title={t('alive.maintenance.title')} body={t('alive.maintenance.body')} />
        ) : (
          decisions.map((d, i) => {
            const prop = d.property_id ? propMap.get(d.property_id) : null;
            return (
              <Animated.View key={d.id} entering={FadeInDown.duration(650).delay(100 + i * 80)} style={styles.row}>
                <View style={styles.spine}>
                  <View style={[styles.dot, { backgroundColor: d.priority === 'critical' ? colors.danger : colors.gold }]} />
                  {i < decisions.length - 1 ? <View style={styles.line} /> : null}
                </View>
                <View style={{ flex: 1 }}>
                  <GlassCard padding={22} radiusToken="lg" edge={d.priority === 'critical' ? 'gold' : 'neutral'}>
                    {prop ? <Text style={styles.propName}>{prop.name}</Text> : null}
                    <Text style={styles.itemTitle}>{d.title}</Text>
                    <Text style={styles.openFor}>
                      {t('maintenance.openFor').replace('{days}', String(daysOpen(d.created_at)))}
                    </Text>
                    <Text style={styles.itemBody}>{d.reason}</Text>
                    <Text style={styles.itemAction}>{d.recommended_action}</Text>
                    <View style={styles.metaRow}>
                      <Feather name="target" size={12} color={colors.textMuted} />
                      <Text style={styles.metaText}>{t('maintenance.confidence').replace('{n}', String(d.confidence))}</Text>
                      <View style={styles.metaDot} />
                      <Feather name="clock" size={12} color={colors.textMuted} />
                      <Text style={styles.metaText}>{formatDate(d.created_at)}</Text>
                    </View>
                  </GlassCard>
                </View>
              </Animated.View>
            );
          })
        )}
      </View>
    </ScreenScaffold>
    </AgentPermissionGate>
  );
}

const styles = StyleSheet.create({
  sectionEyebrow: {
    color: colors.textMuted, fontSize: 10.5, letterSpacing: 2,
    textTransform: 'uppercase', fontWeight: typography.weight.medium,
    marginBottom: spacing.sm,
  },
  sectionSub: { color: colors.textDim, fontSize: 13, lineHeight: 20, marginBottom: spacing.md },
  row: { flexDirection: 'row', gap: 12 },
  spine: { width: 12, alignItems: 'center', paddingTop: 20 },
  dot: {
    width: 10, height: 10, borderRadius: 5,
    shadowColor: colors.gold, shadowOpacity: 0.6, shadowRadius: 6, shadowOffset: { width: 0, height: 0 },
  },
  line: { flex: 1, width: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginTop: 6, marginBottom: -spacing.md },
  propName: { color: colors.textMuted, fontSize: 12, marginBottom: 6 },
  itemTitle: { color: colors.text, fontSize: 16, fontWeight: typography.weight.semibold, lineHeight: 24 },
  openFor: { color: colors.gold, fontSize: 13, marginTop: 6, fontWeight: typography.weight.medium },
  itemBody: { color: colors.textDim, fontSize: 14, lineHeight: 22, marginTop: 8 },
  itemAction: { color: colors.gold, fontSize: 14, lineHeight: 21, marginTop: 12, fontWeight: typography.weight.medium },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12, flexWrap: 'wrap' },
  metaText: { color: colors.textMuted, fontSize: 12 },
  metaDot: { width: 3, height: 3, borderRadius: 1.5, backgroundColor: colors.textSubtle, marginHorizontal: 4 },
  techBtn: { marginTop: spacing.sm, paddingVertical: 10 },
  techBtnText: { color: colors.emerald, fontSize: typography.small, fontWeight: typography.weight.semibold },
  createBtn: {
    marginTop: spacing.md, paddingVertical: 14, borderRadius: 12,
    backgroundColor: colors.emerald, alignItems: 'center',
  },
  createBtnText: { color: colors.bg, fontWeight: typography.weight.semibold, fontSize: 14 },
  workflowStep: { color: colors.textMuted, fontSize: 11, marginTop: 4 },
});
