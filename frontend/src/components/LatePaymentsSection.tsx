import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Modal,
  ScrollView,
  LayoutAnimation,
  Platform,
  UIManager,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { GlassCard } from '@/src/components/GlassCard';
import type { LatePaymentsReport, TenantKnowledgeCard } from '@/src/api/portfolio-analysis';
import { colors, spacing, typography, radius } from '@/src/theme';
import { useI18n } from '@/src/i18n';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

type Props = {
  data: LatePaymentsReport;
  title: string;
  delay?: number;
  embedded?: boolean;
  tenantCards?: TenantKnowledgeCard[];
};

function fmt(n: number, ar: boolean) {
  return `${n.toLocaleString('ar-SA')} ${ar ? 'ر.س' : 'SAR'}`;
}

function FieldRow({
  label,
  value,
  isRTL,
  accent,
}: {
  label: string;
  value: string;
  isRTL: boolean;
  accent?: boolean;
}) {
  return (
    <View style={[styles.fieldRow, isRTL && styles.rowRtl]}>
      <Text style={[styles.fieldLabel, isRTL && styles.rtl]}>{label}</Text>
      <Text style={[accent ? styles.fieldValueAccent : styles.fieldValue, isRTL && styles.rtl]}>{value}</Text>
    </View>
  );
}

function findCard(
  cards: TenantKnowledgeCard[] | undefined,
  unit: string,
  tenant: string,
): TenantKnowledgeCard | null {
  if (!cards?.length) return null;
  const exact = cards.find((c) => c.unit === unit && c.tenant === tenant);
  if (exact) return exact;
  return cards.find((c) => c.unit === unit) || null;
}

function TenantDetailModal({
  card,
  visible,
  onClose,
  ar,
  isRTL,
}: {
  card: TenantKnowledgeCard | null;
  visible: boolean;
  onClose: () => void;
  ar: boolean;
  isRTL: boolean;
}) {
  if (!card) return null;
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalSheet}>
          <View style={[styles.modalHeader, isRTL && styles.rowRtl]}>
            <Text style={[styles.modalTitle, isRTL && styles.rtl]}>{ar ? 'بطاقة المستأجر' : 'Tenant card'}</Text>
            <Pressable onPress={onClose} hitSlop={12}>
              <Feather name="x" size={22} color={colors.textMuted} />
            </Pressable>
          </View>
          <ScrollView style={styles.modalBody} contentContainerStyle={{ paddingBottom: 32 }}>
            <FieldRow label={ar ? 'الاسم' : 'Name'} value={card.tenant} isRTL={isRTL} accent />
            <FieldRow label={ar ? 'الوحدة' : 'Unit'} value={card.unit} isRTL={isRTL} />
            <FieldRow
              label={ar ? 'الجوال' : 'Phone'}
              value={card.phone || (ar ? 'غير متوفر' : 'N/A')}
              isRTL={isRTL}
            />
            <FieldRow
              label={ar ? 'رقم العقد' : 'Contract'}
              value={card.contract || (ar ? 'غير متوفر' : 'N/A')}
              isRTL={isRTL}
            />
            <FieldRow label={ar ? 'قيمة الإيجار' : 'Rent'} value={fmt(card.rent || 0, ar)} isRTL={isRTL} accent />
            <FieldRow
              label={ar ? 'بداية العقد (أول ظهور)' : 'Contract start (first seen)'}
              value={card.contract_start || card.first_seen_label || (ar ? 'غير متوفر' : 'N/A')}
              isRTL={isRTL}
            />
            <FieldRow
              label={ar ? 'نهاية العقد (آخر ظهور)' : 'Contract end (last seen)'}
              value={card.contract_end || card.last_seen_label || (ar ? 'غير متوفر' : 'N/A')}
              isRTL={isRTL}
            />
            {card.dates_note ? (
              <Text style={[styles.note, isRTL && styles.rtl]}>{card.dates_note}</Text>
            ) : null}
            <FieldRow
              label={ar ? 'المتأخرات المؤكدة' : 'Confirmed arrears'}
              value={fmt(card.confirmed_arrears || 0, ar)}
              isRTL={isRTL}
              accent
            />
            {card.last_important_change ? (
              <FieldRow
                label={ar ? 'آخر تغيير مهم' : 'Last important change'}
                value={card.last_important_change}
                isRTL={isRTL}
              />
            ) : null}

            <Text style={[styles.monthsHeading, isRTL && styles.rtl]}>
              {ar ? 'حالة السداد لكل شهر' : 'Payment status by month'}
            </Text>
            {(card.months || []).map((m, i) => (
              <View key={`${m.year}-${m.month}-${i}`} style={styles.monthRow}>
                <FieldRow label={m.label} value={m.status_label || m.status} isRTL={isRTL} />
                {m.status === 'unpaid_confirmed' || m.status === 'partial' ? (
                  <Text style={[styles.monthAmt, isRTL && styles.rtl]}>
                    {ar ? `متبقي مؤكد: ${fmt(m.remaining || 0, true)}` : `Confirmed remaining: ${fmt(m.remaining || 0, false)}`}
                  </Text>
                ) : null}
              </View>
            ))}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function CollapsibleBlock({
  header,
  sub,
  meta,
  defaultOpen = false,
  children,
  testID,
}: {
  header: string;
  sub?: string;
  meta?: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
  testID?: string;
}) {
  const { isRTL } = useI18n();
  const [open, setOpen] = useState(defaultOpen);

  const toggle = () => {
    Haptics.selectionAsync();
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setOpen((v) => !v);
  };

  return (
    <View style={styles.blockWrap} testID={testID}>
      <Pressable onPress={toggle}>
        <View style={[styles.blockHeader, isRTL && styles.rowRtl]}>
          <View style={styles.blockHeaderText}>
            <Text style={[styles.blockTitle, isRTL && styles.rtl]}>{header}</Text>
            {sub ? <Text style={[styles.blockSub, isRTL && styles.rtl]}>{sub}</Text> : null}
            {meta ? <Text style={[styles.blockMeta, isRTL && styles.rtl]}>{meta}</Text> : null}
          </View>
          <Feather name={open ? 'chevron-up' : 'chevron-down'} size={18} color={colors.textMuted} />
        </View>
      </Pressable>
      {open ? <View style={styles.blockBody}>{children}</View> : null}
    </View>
  );
}

export function LatePaymentsSection({ data, title, delay = 0, embedded = false, tenantCards }: Props) {
  const { isRTL } = useI18n();
  const ar = isRTL;
  const { summary, months, tenant_totals } = data;
  const [selected, setSelected] = useState<TenantKnowledgeCard | null>(null);

  const openTenant = (unit: string, tenant: string) => {
    Haptics.selectionAsync();
    const card = findCard(tenantCards, unit, tenant);
    if (card) setSelected(card);
  };

  const topLine = summary.top_tenant
    ? ar
      ? `${summary.top_tenant.tenant} — ${summary.top_tenant.unit} (${fmt(summary.top_tenant.total_unpaid, true)})`
      : `${summary.top_tenant.tenant} — ${summary.top_tenant.unit} (${fmt(summary.top_tenant.total_unpaid, false)})`
    : '—';

  const oldestLine = summary.oldest_tenant
    ? ar
      ? `${summary.oldest_tenant.tenant} — ${summary.oldest_tenant.unit} (${summary.oldest_tenant.month_label})`
      : `${summary.oldest_tenant.tenant} — ${summary.oldest_tenant.unit} (${summary.oldest_tenant.month_label})`
    : '—';

  const inner = (
    <>
      {!embedded ? <Text style={[styles.sectionTitle, isRTL && styles.rtl]}>{title}</Text> : null}

      <View style={styles.summaryBox}>
        <FieldRow
          label={ar ? 'إجمالي المتأخرات المؤكدة' : 'Confirmed overdue total'}
          value={fmt(summary.total_unpaid, ar)}
          isRTL={isRTL}
          accent
        />
        <FieldRow
          label={ar ? 'عدد المتأخرين المؤكدين' : 'Confirmed late tenants'}
          value={String(summary.late_tenant_count)}
          isRTL={isRTL}
        />
        <FieldRow label={ar ? 'أعلى متأخر' : 'Highest overdue'} value={topLine} isRTL={isRTL} />
        <FieldRow label={ar ? 'أقدم متأخر' : 'Oldest overdue'} value={oldestLine} isRTL={isRTL} />
      </View>

      {months.length === 0 && tenant_totals.length === 0 ? (
        <Text style={[styles.empty, isRTL && styles.rtl]}>
          {ar ? 'لا متأخرات مؤكدة في الأشهر المحلّلة' : 'No confirmed late rows in parsed months'}
        </Text>
      ) : null}

      {months.map((m) => (
        <CollapsibleBlock
          key={m.key}
          testID={`late-month-${m.key}`}
          header={m.label}
          sub={
            ar
              ? `${m.tenant_count} مستأجر متأخر مؤكد`
              : `${m.tenant_count} confirmed late`
          }
          meta={ar ? `إجمالي الشهر: ${fmt(m.month_total, true)}` : `Month total: ${fmt(m.month_total, false)}`}
        >
          {m.tenants.map((t, i) => (
            <Pressable
              key={`${m.key}-${t.unit}-${t.tenant}-${i}`}
              onPress={() => openTenant(t.unit, t.tenant)}
              style={styles.tenantCard}
            >
              <Text style={[styles.tenantName, isRTL && styles.rtl]}>{t.tenant}</Text>
              <FieldRow label={ar ? 'الوحدة' : 'Unit'} value={t.unit} isRTL={isRTL} />
              <FieldRow label={ar ? 'المتبقي المؤكد' : 'Confirmed remaining'} value={fmt(t.remaining, ar)} isRTL={isRTL} accent />
              <FieldRow label={ar ? 'الحالة' : 'Status'} value={t.status_label} isRTL={isRTL} />
              <Text style={[styles.tapHint, isRTL && styles.rtl]}>
                {ar ? 'اضغط لبطاقة المستأجر الكاملة' : 'Tap for full tenant card'}
              </Text>
            </Pressable>
          ))}
        </CollapsibleBlock>
      ))}

      {tenant_totals.length > 0 ? (
        <View style={styles.totalsSection}>
          <Text style={[styles.totalsHeading, isRTL && styles.rtl]}>
            {ar ? 'إجمالي كل مستأجر (مؤكد فقط)' : 'Per-tenant totals (confirmed only)'}
          </Text>
          {tenant_totals.map((tt, idx) => (
            <CollapsibleBlock
              key={`${tt.unit}-${tt.tenant}-${idx}`}
              testID={`late-tenant-total-${idx}`}
              header={`${tt.tenant} — ${tt.unit}`}
              sub={ar ? `أشهر مؤكدة: ${tt.late_month_count}` : `Confirmed months: ${tt.late_month_count}`}
              meta={ar ? `إجمالي: ${fmt(tt.total_unpaid, true)}` : `Total: ${fmt(tt.total_unpaid, false)}`}
            >
              <Pressable onPress={() => openTenant(tt.unit, tt.tenant)} style={styles.tenantCard}>
                <FieldRow label={ar ? 'رقم العقد' : 'Contract'} value={tt.contract || '—'} isRTL={isRTL} />
                <FieldRow
                  label={ar ? 'الجوال' : 'Phone'}
                  value={tt.phone || (ar ? 'بدون جوال' : 'No phone')}
                  isRTL={isRTL}
                />
                {tt.months.map((mo, mi) => (
                  <FieldRow key={`${mo.label}-${mi}`} label={mo.label} value={fmt(mo.amount, ar)} isRTL={isRTL} />
                ))}
                <Text style={[styles.tapHint, isRTL && styles.rtl]}>
                  {ar ? 'اضغط لبطاقة المستأجر الكاملة' : 'Tap for full tenant card'}
                </Text>
              </Pressable>
            </CollapsibleBlock>
          ))}
        </View>
      ) : null}

      <TenantDetailModal
        card={selected}
        visible={!!selected}
        onClose={() => setSelected(null)}
        ar={ar}
        isRTL={isRTL}
      />
    </>
  );

  if (embedded) {
    return <View>{inner}</View>;
  }

  return (
    <Animated.View entering={FadeInDown.duration(500).delay(delay)}>
      <GlassCard padding={18} radiusToken="md" edge="gold" style={styles.sectionCard}>
        {inner}
      </GlassCard>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  sectionCard: { marginTop: 4 },
  sectionTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: typography.weight.semibold,
    marginBottom: 12,
  },
  summaryBox: {
    padding: 12,
    borderRadius: radius.md,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    marginBottom: 14,
    gap: 2,
  },
  empty: { color: colors.textMuted, fontSize: 13, marginBottom: 8 },
  blockWrap: {
    marginBottom: 10,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: 'rgba(255,255,255,0.02)',
    overflow: 'hidden',
  },
  blockHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    gap: 10,
  },
  blockHeaderText: { flex: 1, gap: 3 },
  blockTitle: { color: colors.text, fontSize: 14, fontWeight: typography.weight.semibold },
  blockSub: { color: colors.textDim, fontSize: 12 },
  blockMeta: { color: colors.gold, fontSize: 12, fontWeight: typography.weight.medium },
  blockBody: {
    paddingHorizontal: 10,
    paddingBottom: 10,
    gap: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.divider,
  },
  tenantCard: {
    padding: 12,
    borderRadius: radius.sm,
    backgroundColor: 'rgba(0,0,0,0.15)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.divider,
    gap: 4,
  },
  tenantName: {
    color: colors.text,
    fontSize: 14,
    fontWeight: typography.weight.semibold,
    marginBottom: 4,
  },
  tapHint: { color: colors.gold, fontSize: 11, marginTop: 6 },
  fieldRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
    paddingVertical: 3,
  },
  rowRtl: { flexDirection: 'row-reverse' },
  fieldLabel: { color: colors.textMuted, fontSize: 12, flex: 1 },
  fieldValue: { color: colors.text, fontSize: 12, fontWeight: typography.weight.medium, maxWidth: '55%' },
  fieldValueAccent: {
    color: colors.gold,
    fontSize: 12,
    fontWeight: typography.weight.semibold,
    maxWidth: '55%',
  },
  rtl: { writingDirection: 'rtl', textAlign: 'right' },
  totalsSection: { marginTop: 8, gap: 4 },
  totalsHeading: {
    color: colors.textDim,
    fontSize: 12,
    fontWeight: typography.weight.semibold,
    marginBottom: 6,
    letterSpacing: 0.3,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    maxHeight: '88%',
    backgroundColor: '#0b1220',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    paddingTop: 14,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    marginBottom: 8,
  },
  modalTitle: { color: colors.text, fontSize: 17, fontWeight: typography.weight.semibold },
  modalBody: { paddingHorizontal: 18 },
  note: { color: colors.textDim, fontSize: 11, lineHeight: 16, marginVertical: 8 },
  monthsHeading: {
    color: colors.text,
    fontSize: 13,
    fontWeight: typography.weight.semibold,
    marginTop: 14,
    marginBottom: 8,
  },
  monthRow: { marginBottom: 6, gap: 2 },
  monthAmt: { color: colors.gold, fontSize: 11, marginBottom: 4 },
});
