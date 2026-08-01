/**
 * Maintenance — tickets + expandable «إضافة فني» (data, send link, task status tracking).
 */
import React, { useEffect, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, Pressable, TextInput, Linking, Platform, Share, LayoutAnimation, UIManager,
} from 'react-native';
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
import { TechPortalShareCard } from '@/src/components/TechPortalShareCard';
import { useOperational } from '@/src/hooks/useOperational';
import { usePropertyOS } from '@/src/hooks/usePropertyOS';
import { useTechnicians } from '@/src/hooks/useTechnicians';
import { useNotificationPrefs } from '@/src/hooks/usePreferences';
import { api, type DecisionT, type PropertyT } from '@/src/api/client';
import type { TechnicianSpecialty } from '@/src/types/technician';
import { colors, spacing, typography, radius } from '@/src/theme';
import { useI18n } from '@/src/i18n';
import { formatDate } from '@/src/utils/locale';
import { AgentPermissionGate } from '@/src/components/AgentPermissionGate';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const STATUS_FLOW = ['open', 'assigned', 'accepted', 'en_route', 'in_progress', 'awaiting_tenant', 'closed'] as const;

const daysOpen = (createdAt: string) => {
  const created = new Date(createdAt).getTime();
  return Math.max(1, Math.round((Date.now() - created) / (1000 * 60 * 60 * 24)));
};

function statusLabel(ar: boolean, status: string) {
  const map: Record<string, [string, string]> = {
    open: ['مُرسلة', 'Sent'],
    assigned: ['مُسندة', 'Assigned'],
    accepted: ['مقبولة', 'Accepted'],
    en_route: ['في الطريق', 'En route'],
    in_progress: ['قيد التنفيذ', 'In progress'],
    awaiting_tenant: ['بانتظار المستأجر', 'Awaiting tenant'],
    closed: ['مكتملة', 'Completed'],
    reprocess: ['إعادة معالجة', 'Reprocess'],
  };
  const pair = map[status];
  return pair ? (ar ? pair[0] : pair[1]) : status;
}

export default function Maintenance() {
  const { t, isRTL, lang } = useI18n();
  const ar = lang === 'ar' || !!isRTL;
  const router = useRouter();
  const { countEnabled } = useNotificationPrefs();
  const { state: osState } = usePropertyOS(countEnabled);
  const { openTickets, tickets } = useOperational();
  const { technicians, create } = useTechnicians();
  const [decisions, setDecisions] = useState<DecisionT[]>([]);
  const [props, setProps] = useState<PropertyT[]>([]);
  const [techOpen, setTechOpen] = useState(false);
  const [techName, setTechName] = useState('');
  const [techPhone, setTechPhone] = useState('');
  const [specialty, setSpecialty] = useState<TechnicianSpecialty>('general');
  const [lastTechId, setLastTechId] = useState<string | null>(null);

  useEffect(() => {
    api.decisions().then((d) => setDecisions(d.filter((x) => x.kind === 'maintenance')));
    api.properties().then(setProps);
  }, []);

  const propMap = useMemo(() => {
    const m = new Map<string, PropertyT>();
    props.forEach((p) => m.set(p.id, p));
    return m;
  }, [props]);

  const allTickets = useMemo(() => {
    const list = tickets?.length ? tickets : openTickets;
    return [...list].sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
  }, [tickets, openTickets]);

  const lastTech = technicians.find((x) => x.id === lastTechId) || technicians[technicians.length - 1];

  const toggleTech = () => {
    Haptics.selectionAsync();
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setTechOpen((v) => !v);
  };

  const createTech = async () => {
    if (!techName.trim() || !techPhone.trim()) return;
    const tech = await create({
      name: techName.trim(),
      phone: techPhone.trim(),
      specialty,
    });
    setLastTechId(tech.id);
    setTechName('');
    setTechPhone('');
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const sendTechLink = (url: string, phone: string) => {
    const msg = `${ar ? 'رابط فني SPP' : 'SPP technician link'}: ${url}`;
    const digits = phone.replace(/\D/g, '');
    if (digits) {
      const wa = Platform.select({
        ios: `whatsapp://send?phone=${digits}&text=${encodeURIComponent(msg)}`,
        default: `https://wa.me/${digits}?text=${encodeURIComponent(msg)}`,
      });
      Linking.openURL(wa!).catch(() => Share.share({ message: msg }));
    } else {
      Share.share({ message: msg });
    }
  };

  return (
    <AgentPermissionGate perm="maintenance">
    <ScreenScaffold testID="maintenance-screen">
      <StoryScreenHeader question={t('page.q.maintenance')} hint={t('maintenance.sub')} showBack testID="maintenance-header" />

      <GuidedSetup flowId="technician" defaultOpen={decisions.length === 0 && !openTickets.length} testID="maintenance-guided" />

      <OperationHint feature="maintenance" />

      {/* Add technician dropdown */}
      <Pressable onPress={toggleTech} style={[styles.techHead, ar && styles.rowRtl]} testID="maint-add-tech-toggle">
        <Feather name="tool" size={16} color={colors.emerald} />
        <Text style={[styles.techHeadText, ar && styles.rtl]}>{ar ? 'إضافة فني' : 'Add technician'}</Text>
        <Feather name={techOpen ? 'chevron-up' : 'chevron-down'} size={16} color={colors.textMuted} />
      </Pressable>

      {techOpen ? (
        <GlassCard padding={16} radiusToken="md" edge="emerald" style={{ marginTop: 8, marginBottom: spacing.md }}>
          <Text style={[styles.label, ar && styles.rtl]}>{ar ? 'بيانات الفني' : 'Technician details'}</Text>
          <TextInput
            value={techName}
            onChangeText={setTechName}
            placeholder={ar ? 'الاسم' : 'Name'}
            placeholderTextColor={colors.textSubtle}
            style={[styles.input, ar && styles.rtl]}
          />
          <TextInput
            value={techPhone}
            onChangeText={setTechPhone}
            placeholder={ar ? 'الجوال' : 'Phone'}
            placeholderTextColor={colors.textSubtle}
            keyboardType="phone-pad"
            style={[styles.input, ar && styles.rtl]}
          />
          <View style={[styles.specRow, ar && styles.rowRtl]}>
            {(['general', 'plumbing', 'electrical', 'ac', 'other'] as TechnicianSpecialty[]).map((s) => (
              <Pressable
                key={s}
                onPress={() => setSpecialty(s)}
                style={[styles.chip, specialty === s && styles.chipOn]}
              >
                <Text style={styles.chipText}>{s}</Text>
              </Pressable>
            ))}
          </View>
          <Pressable style={styles.createTechBtn} onPress={createTech} testID="maint-create-tech">
            <Text style={styles.createTechBtnText}>{ar ? 'حفظ وإرسال رابط' : 'Save & send link'}</Text>
          </Pressable>
          {lastTech ? (
            <View style={{ marginTop: 12 }}>
              <TechPortalShareCard tech={lastTech} />
              <Pressable
                style={styles.sendLinkBtn}
                onPress={() => sendTechLink(lastTech.portalUrl, lastTech.phone)}
              >
                <Text style={styles.sendLinkText}>{ar ? 'إرسال الرابط عبر واتساب' : 'Send link via WhatsApp'}</Text>
              </Pressable>
            </View>
          ) : null}
          {technicians.length > 0 ? (
            <View style={{ marginTop: 12, gap: 8 }}>
              <Text style={[styles.sectionEyebrow, ar && styles.rtl]}>{ar ? 'الفنيون' : 'Technicians'}</Text>
              {technicians.slice().reverse().slice(0, 6).map((tech) => (
                <Pressable key={tech.id} onPress={() => sendTechLink(tech.portalUrl, tech.phone)}>
                  <Text style={[styles.techLine, ar && styles.rtl]}>
                    {tech.name} · {tech.phone} · {ar ? 'إرسال رابط' : 'Send link'}
                  </Text>
                </Pressable>
              ))}
            </View>
          ) : null}
        </GlassCard>
      ) : null}

      <Pressable
        style={styles.createBtn}
        onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push('/maintenance/create' as any); }}
        testID="maintenance-new-btn"
      >
        <Text style={styles.createBtnText}>{t('opsv2.maint.new' as any)}</Text>
      </Pressable>

      {/* Status tracking: sent → completed */}
      <View style={{ marginTop: spacing.lg }}>
        <Text style={[styles.sectionEyebrow, ar && styles.rtl]}>
          {ar ? 'متابعة التنفيذ (من الإرسال إلى الاكتمال)' : 'Execution tracking (sent → completed)'}
        </Text>
        {allTickets.length === 0 ? (
          <Text style={[styles.dim, ar && styles.rtl]}>
            {ar ? 'لا مهام بعد — أنشئ بلاغاً أو أرسل مهمة لفني.' : 'No tasks yet — create a ticket or assign a technician.'}
          </Text>
        ) : (
          allTickets.slice(0, 20).map((tk, i) => {
            const unit = osState.units.find((u) => u.id === tk.unitId);
            const idx = Math.max(0, STATUS_FLOW.indexOf(tk.status as typeof STATUS_FLOW[number]));
            return (
              <Animated.View key={tk.id} entering={FadeInDown.duration(400).delay(i * 40)} style={{ marginBottom: spacing.sm }}>
                <Pressable onPress={() => router.push(`/maintenance/${tk.id}` as any)}>
                  <GlassCard padding={14} radiusToken="md" edge={tk.status === 'closed' ? 'emerald' : 'gold'}>
                    <Text style={[styles.itemTitle, ar && styles.rtl]}>{tk.title}</Text>
                    <Text style={[styles.openFor, ar && styles.rtl]}>
                      {unit?.number ? `${t('op.tenant.unit')} ${unit.number} · ` : ''}
                      {statusLabel(ar, tk.status)}
                      {tk.progressPercent != null ? ` · ${tk.progressPercent}%` : ''}
                    </Text>
                    {tk.technicianName ? (
                      <Text style={[styles.itemBody, ar && styles.rtl]}>{tk.technicianName}</Text>
                    ) : null}
                    <View style={[styles.flowRow, ar && styles.rowRtl]}>
                      {STATUS_FLOW.map((s, si) => (
                        <View
                          key={s}
                          style={[
                            styles.flowDot,
                            si <= idx && styles.flowDotOn,
                            s === 'closed' && tk.status === 'closed' && styles.flowDotDone,
                          ]}
                        />
                      ))}
                    </View>
                    <Text style={[styles.flowHint, ar && styles.rtl]}>
                      {ar ? 'إرسال ← إسناد ← قبول ← طريق ← تنفيذ ← اكتمال' : 'Sent → Assigned → Accept → Route → Work → Done'}
                    </Text>
                  </GlassCard>
                </Pressable>
              </Animated.View>
            );
          })
        )}
      </View>

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
  row: { flexDirection: 'row', gap: 12 },
  rowRtl: { flexDirection: 'row-reverse' },
  rtl: { writingDirection: 'rtl', textAlign: 'right' },
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
  createBtn: {
    marginTop: spacing.md, paddingVertical: 14, borderRadius: 12,
    backgroundColor: colors.emerald, alignItems: 'center',
  },
  createBtnText: { color: colors.bg, fontWeight: typography.weight.semibold, fontSize: 14 },
  techHead: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingVertical: 12, paddingHorizontal: 14, borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth, borderColor: colors.emeraldEdge,
    backgroundColor: colors.emeraldSoft, marginTop: spacing.sm,
  },
  techHeadText: { flex: 1, color: colors.emerald, fontSize: 14, fontWeight: typography.weight.semibold },
  label: { color: colors.textMuted, fontSize: 12, marginBottom: 6 },
  input: {
    marginTop: 8, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, borderRadius: radius.md,
    paddingHorizontal: 12, paddingVertical: 10, color: colors.text, backgroundColor: 'rgba(255,255,255,0.03)',
  },
  specRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 },
  chip: {
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border,
  },
  chipOn: { borderColor: colors.emeraldEdge, backgroundColor: colors.emeraldSoft },
  chipText: { color: colors.text, fontSize: 11 },
  createTechBtn: {
    marginTop: 12, backgroundColor: colors.emerald, borderRadius: radius.md,
    paddingVertical: 12, alignItems: 'center',
  },
  createTechBtnText: { color: colors.bg, fontWeight: typography.weight.semibold },
  sendLinkBtn: { marginTop: 10, paddingVertical: 10, alignItems: 'center' },
  sendLinkText: { color: colors.gold, fontWeight: typography.weight.semibold, fontSize: 13 },
  techLine: { color: colors.textDim, fontSize: 12 },
  dim: { color: colors.textDim, fontSize: 13, lineHeight: 20 },
  flowRow: { flexDirection: 'row', gap: 6, marginTop: 10 },
  flowDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: 'rgba(255,255,255,0.12)' },
  flowDotOn: { backgroundColor: colors.gold },
  flowDotDone: { backgroundColor: colors.emerald },
  flowHint: { color: colors.textMuted, fontSize: 10, marginTop: 6 },
});
