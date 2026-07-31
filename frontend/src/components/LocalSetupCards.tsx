import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { GlassCard } from '@/src/components/GlassCard';
import { colors, spacing, typography, radius } from '@/src/theme';
import { useI18n } from '@/src/i18n';
import type { ContractRecord, PropertyRecord, TenantRecord, UnitRecord } from '@/src/types/property-os';
import { formatDate } from '@/src/utils/locale';

type PropertyProps = {
  property: PropertyRecord;
  units: UnitRecord[];
  testID?: string;
};

/** Locally saved property + units — shown in management when API data is empty. */
export function LocalPropertyCard({ property, units, testID = 'local-property' }: PropertyProps) {
  const { t, isRTL } = useI18n();
  return (
    <Animated.View entering={FadeInDown.duration(500)} testID={testID}>
      <Text style={[styles.badge, isRTL && styles.rtl]}>{t('result.localData' as any)}</Text>
      <GlassCard padding={20} radiusToken="lg" edge="gold">
        <Text style={[styles.title, isRTL && styles.rtl]}>{property.name}</Text>
        <Text style={[styles.sub, isRTL && styles.rtl]}>{property.city}{property.district ? ` · ${property.district}` : ''}</Text>
        <View style={[styles.kpiRow, isRTL && styles.rowRtl]}>
          <Text style={styles.kpi}>{t('pos.property.unitCount')}: {property.unitCount}</Text>
          <Text style={styles.kpi}>{t('portfolio.kpi.units')}: {units.length}</Text>
        </View>
        {units.length > 0 ? (
          <View style={styles.unitList}>
            {units.map((u) => (
              <View key={u.id} style={[styles.unitRow, isRTL && styles.rowRtl]}>
                <Text style={styles.unitNum}>{u.number}</Text>
                <Text style={styles.unitMeta}>
                  {t(`pos.status.${u.status}` as 'pos.status.occupied')} · {u.rentAmount}
                </Text>
              </View>
            ))}
          </View>
        ) : null}
      </GlassCard>
    </Animated.View>
  );
}

type ContractProps = {
  contract: ContractRecord;
  tenant?: TenantRecord;
  unit?: UnitRecord;
  testID?: string;
};

export function LocalContractCard({ contract, tenant, unit, testID }: ContractProps) {
  const { t, isRTL } = useI18n();
  return (
    <Animated.View entering={FadeInDown.duration(500)} testID={testID ?? `local-contract-${contract.id}`}>
      <GlassCard padding={20} radiusToken="lg" edge="emerald" style={{ marginBottom: spacing.md }}>
        <View style={[styles.pill, isRTL && styles.rowRtl]}>
          <View style={styles.pillDot} />
          <Text style={styles.pillText}>{t('result.status.active' as any)}</Text>
        </View>
        <Text style={[styles.title, isRTL && styles.rtl]}>{contract.number}</Text>
        <Text style={[styles.sub, isRTL && styles.rtl]}>
          {tenant?.name ?? '—'} · {t('pos.tenant.unit')} {unit?.number ?? '—'}
        </Text>
        <View style={[styles.kpiRow, isRTL && styles.rowRtl, { marginTop: spacing.sm }]}>
          <Text style={styles.kpi}>{formatDate(contract.startDate)} → {formatDate(contract.endDate)}</Text>
          <Text style={styles.kpi}>{contract.rentAmount}</Text>
        </View>
      </GlassCard>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  badge: {
    color: colors.gold, fontSize: 10, letterSpacing: 1.2, textTransform: 'uppercase',
    marginBottom: spacing.sm, fontWeight: typography.weight.semibold,
  },
  rtl: { writingDirection: 'rtl', textAlign: 'right' },
  rowRtl: { flexDirection: 'row-reverse' },
  title: { color: colors.text, fontSize: 17, fontWeight: typography.weight.semibold },
  sub: { color: colors.textMuted, fontSize: 13, marginTop: 4 },
  kpiRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.md, gap: 12 },
  kpi: { color: colors.textDim, fontSize: 12 },
  unitList: { marginTop: spacing.md, gap: 6 },
  unitRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 8, paddingHorizontal: 10, borderRadius: radius.md,
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  unitNum: { color: colors.text, fontSize: 13, fontWeight: typography.weight.medium },
  unitMeta: { color: colors.textMuted, fontSize: 11 },
  pill: {
    flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start',
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth, borderColor: colors.emeraldEdge,
    backgroundColor: colors.emeraldSoft,
  },
  pillDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: colors.emerald },
  pillText: { color: colors.emerald, fontSize: 10, letterSpacing: 1, fontWeight: typography.weight.medium },
});
