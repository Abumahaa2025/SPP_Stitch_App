/**
 * Official tenant registry — latest statement names + manual official edits.
 */
import React, { useCallback, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, Pressable, TextInput, Modal, Alert, Linking, Share,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Feather } from '@expo/vector-icons';

import { ScreenScaffold } from '@/src/components/ScreenScaffold';
import { StoryScreenHeader } from '@/src/components/StoryScreenHeader';
import { GlassCard } from '@/src/components/GlassCard';
import { AliveEmpty } from '@/src/components/AliveEmpty';
import { usePropertyOS } from '@/src/hooks/usePropertyOS';
import { useNotificationPrefs } from '@/src/hooks/usePreferences';
import {
  loadCanonicalTenants,
  updateCanonicalTenant,
  vacateCanonicalTenant,
  transferCanonicalTenant,
  addNewOfficialTenant,
  buildWhatsAppCollectionMessage,
  syncCanonicalFromPropertyOS,
} from '@/src/utils/canonical-tenant-store';
import type { CanonicalTenant, CanonicalTenantState } from '@/src/types/canonical-tenant';
import { colors, spacing, typography, radius } from '@/src/theme';
import { useI18n } from '@/src/i18n';

function fmtMoney(n: number, ar: boolean) {
  return `${Number(n || 0).toLocaleString()} ${ar ? 'ر.س' : 'SAR'}`;
}

export default function OfficialTenantsScreen() {
  const { isRTL, lang } = useI18n();
  const ar = lang === 'ar' || !!isRTL;
  const router = useRouter();
  const { countEnabled } = useNotificationPrefs();
  const { state: os, reload } = usePropertyOS(countEnabled);
  const [reg, setReg] = useState<CanonicalTenantState>({ tenants: [], events: [] });
  const [query, setQuery] = useState('');
  const [edit, setEdit] = useState<CanonicalTenant | null>(null);
  const [draftName, setDraftName] = useState('');
  const [draftPhone, setDraftPhone] = useState('');
  const [draftRent, setDraftRent] = useState('');
  const [draftContract, setDraftContract] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [newUnitId, setNewUnitId] = useState('');

  const refresh = useCallback(async () => {
    await reload();
    let s = await loadCanonicalTenants();
    if (!s.tenants.length) {
      // Seed from current OS after reload via storage-backed hook state on next focus;
      // direct sync uses live os snapshot when available.
      const raw = await import('@/src/utils/storage').then((m) => m.storage.getItem<string>('spp.propertyOS', ''));
      if (raw) {
        try {
          const osState = JSON.parse(raw);
          if (osState?.tenants?.length) {
            s = await syncCanonicalFromPropertyOS(osState, { lang: ar ? 'ar' : 'en' });
          }
        } catch { /* ignore */ }
      }
    }
    setReg(s);
  }, [reload, ar]);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  const active = useMemo(() => {
    const q = query.trim().toLowerCase();
    return reg.tenants
      .filter((t) => t.status === 'active')
      .filter((t) => !q || [t.name, t.phone, t.unitNumber, t.contractNumber].join(' ').toLowerCase().includes(q));
  }, [reg.tenants, query]);

  const vacated = useMemo(() => reg.tenants.filter((t) => t.status !== 'active').slice(0, 40), [reg.tenants]);

  const openEdit = (t: CanonicalTenant) => {
    setEdit(t);
    setDraftName(t.name);
    setDraftPhone(t.phone);
    setDraftRent(String(t.rentAmount || ''));
    setDraftContract(t.contractNumber || '');
  };

  const saveEdit = async () => {
    if (!edit) return;
    const rent = Number(String(draftRent).replace(/,/g, ''));
    await updateCanonicalTenant(edit.id, {
      name: draftName.trim(),
      phone: draftPhone.trim(),
      rentAmount: Number.isFinite(rent) ? rent : edit.rentAmount,
      contractNumber: draftContract.trim(),
    });
    setEdit(null);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    await refresh();
  };

  const doVacate = (t: CanonicalTenant) => {
    Alert.alert(
      ar ? 'إخلاء مستأجر؟' : 'Vacate tenant?',
      ar ? `سيتم اعتماد إخلاء ${t.name} من وحدة ${t.unitNumber} رسمياً.` : `Officially vacate ${t.name} from unit ${t.unitNumber}.`,
      [
        { text: ar ? 'إلغاء' : 'Cancel', style: 'cancel' },
        {
          text: ar ? 'إخلاء' : 'Vacate',
          style: 'destructive',
          onPress: async () => {
            await vacateCanonicalTenant(t.id, ar ? 'إخلاء رسمي' : 'Official vacate');
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            await refresh();
          },
        },
      ],
    );
  };

  const doTransfer = (t: CanonicalTenant) => {
    const vacant = os.units.filter((u) => u.status === 'vacant' || u.id === t.unitId);
    if (!vacant.length) {
      Alert.alert(ar ? 'لا وحدات متاحة للنقل' : 'No units available to transfer');
      return;
    }
    const target = vacant.find((u) => u.id !== t.unitId) || vacant[0];
    Alert.alert(
      ar ? 'نقل مستأجر؟' : 'Transfer tenant?',
      ar ? `نقل ${t.name} إلى وحدة ${target.number}` : `Move ${t.name} to unit ${target.number}`,
      [
        { text: ar ? 'إلغاء' : 'Cancel', style: 'cancel' },
        {
          text: ar ? 'نقل' : 'Transfer',
          onPress: async () => {
            await transferCanonicalTenant(t.id, target.id, target.number, ar ? 'نقل رسمي' : 'Official transfer');
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            await refresh();
          },
        },
      ],
    );
  };

  const messageTenant = async (t: CanonicalTenant) => {
    const arrears = (os.paymentLedger || [])
      .filter((l) => l.tenantId === t.osTenantId)
      .reduce((s, l) => s + (Number(l.remaining) || 0), 0);
    const msg = buildWhatsAppCollectionMessage(t, ar, arrears);
    const phone = t.phone.replace(/\D/g, '');
    if (!phone) {
      Alert.alert(ar ? 'لا يوجد جوال معتمد' : 'No official phone');
      return;
    }
    const wa = `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`;
    Linking.openURL(wa).catch(() => Share.share({ message: msg }));
  };

  const submitNew = async () => {
    const unit = os.units.find((u) => u.id === newUnitId) || os.units.find((u) => u.status === 'vacant') || os.units[0];
    if (!unit || !draftName.trim()) return;
    const rent = Number(String(draftRent).replace(/,/g, '')) || unit.rentAmount || 0;
    await addNewOfficialTenant({
      name: draftName.trim(),
      phone: draftPhone.trim(),
      unitId: unit.id,
      unitNumber: unit.number,
      rentAmount: rent,
      contractNumber: draftContract.trim(),
      lang: ar ? 'ar' : 'en',
    });
    setShowNew(false);
    setDraftName('');
    setDraftPhone('');
    setDraftRent('');
    setDraftContract('');
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    await refresh();
  };

  return (
    <ScreenScaffold testID="official-tenants">
      <StoryScreenHeader
        question={ar ? 'قاعدة المستأجرين الرسمية' : 'Official tenant registry'}
        hint={ar ? 'الأسماء من آخر كشف — قابلة للتعديل الرسمي للتواصل الآلي' : 'Names from latest statement — editable for auto-contact'}
        showBack
      />

      <View style={[styles.toolbar, isRTL && styles.rowRtl]}>
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder={ar ? 'بحث بالاسم / الجوال / الوحدة' : 'Search name / phone / unit'}
          placeholderTextColor={colors.textSubtle}
          style={[styles.search, isRTL && styles.rtl]}
        />
        <Pressable
          style={styles.addBtn}
          onPress={() => {
            Haptics.selectionAsync();
            setShowNew(true);
            setDraftName('');
            setDraftPhone('');
            setDraftRent('');
            setNewUnitId(os.units.find((u) => u.status === 'vacant')?.id || os.units[0]?.id || '');
          }}
        >
          <Feather name="user-plus" size={16} color={colors.bg} />
        </Pressable>
      </View>

      <Pressable style={styles.summaryLink} onPress={() => router.push('/operational/monthly-summary' as any)}>
        <Text style={styles.summaryLinkText}>{ar ? 'الملخص الشهري المفصّل ←' : 'Detailed monthly summary →'}</Text>
      </Pressable>

      {active.length === 0 ? (
        <AliveEmpty
          title={ar ? 'لا مستأجرين رسميين بعد' : 'No official tenants yet'}
          body={ar ? 'اعتمد آخر كشف لبناء القاعدة، أو أضف مستأجراً جديداً.' : 'Apply the latest statement, or add a new tenant.'}
          actionLabel={ar ? 'رفع كشف' : 'Upload'}
          onAction={() => router.push('/upload' as any)}
        />
      ) : (
        active.map((t) => (
          <GlassCard key={t.id} padding={16} radiusToken="md" style={{ marginBottom: spacing.sm }} edge="gold">
            <Pressable onPress={() => t.osTenantId && router.push(`/tenants/${t.osTenantId}` as any)}>
              <Text style={[styles.name, isRTL && styles.rtl]}>{t.name}</Text>
              <Text style={[styles.dim, isRTL && styles.rtl]}>
                {ar ? 'وحدة' : 'Unit'} {t.unitNumber} · {fmtMoney(t.rentAmount, ar)}
                {t.contractNumber ? ` · ${t.contractNumber}` : ''}
              </Text>
              <Text style={[styles.dim, isRTL && styles.rtl]}>{t.phone || (ar ? 'بدون جوال' : 'No phone')}</Text>
              <Text style={[styles.badge, isRTL && styles.rtl]}>
                {t.source === 'manual_official'
                  ? (ar ? 'تعديل رسمي معتمد' : 'Manual official')
                  : (ar ? 'من آخر كشف' : 'Latest statement')}
              </Text>
            </Pressable>
            <View style={[styles.actions, isRTL && styles.rowRtl]}>
              <Action icon="edit-2" label={ar ? 'تعديل' : 'Edit'} onPress={() => openEdit(t)} />
              <Action icon="message-circle" label={ar ? 'تواصل' : 'Message'} onPress={() => messageTenant(t)} />
              <Action icon="log-out" label={ar ? 'إخلاء' : 'Vacate'} onPress={() => doVacate(t)} />
              <Action icon="shuffle" label={ar ? 'نقل' : 'Transfer'} onPress={() => doTransfer(t)} />
            </View>
          </GlassCard>
        ))
      )}

      {vacated.length > 0 ? (
        <GlassCard padding={16} radiusToken="md" style={{ marginTop: spacing.md }}>
          <Text style={[styles.section, isRTL && styles.rtl]}>{ar ? 'سجل المغادرين / المنقولين' : 'Vacated / transferred'}</Text>
          {vacated.map((t) => (
            <Text key={t.id} style={[styles.dim, isRTL && styles.rtl, { marginTop: 6 }]}>
              {t.name} · {t.unitNumber} · {t.status}
            </Text>
          ))}
        </GlassCard>
      ) : null}

      <Modal visible={!!edit} transparent animationType="fade" onRequestClose={() => setEdit(null)}>
        <View style={styles.modalWrap}>
          <GlassCard padding={20} radiusToken="lg" edge="gold">
            <Text style={[styles.name, isRTL && styles.rtl]}>{ar ? 'تعديل رسمي' : 'Official edit'}</Text>
            <Field ar={ar} label={ar ? 'الاسم' : 'Name'} value={draftName} onChange={setDraftName} />
            <Field ar={ar} label={ar ? 'الجوال' : 'Phone'} value={draftPhone} onChange={setDraftPhone} />
            <Field ar={ar} label={ar ? 'الإيجار' : 'Rent'} value={draftRent} onChange={setDraftRent} keyboardType="numeric" />
            <Field ar={ar} label={ar ? 'رقم العقد' : 'Contract'} value={draftContract} onChange={setDraftContract} />
            <View style={[styles.actions, isRTL && styles.rowRtl]}>
              <Pressable style={styles.primary} onPress={saveEdit}>
                <Text style={styles.primaryText}>{ar ? 'اعتماد' : 'Save official'}</Text>
              </Pressable>
              <Pressable style={styles.secondary} onPress={() => setEdit(null)}>
                <Text style={styles.secondaryText}>{ar ? 'إلغاء' : 'Cancel'}</Text>
              </Pressable>
            </View>
          </GlassCard>
        </View>
      </Modal>

      <Modal visible={showNew} transparent animationType="fade" onRequestClose={() => setShowNew(false)}>
        <View style={styles.modalWrap}>
          <GlassCard padding={20} radiusToken="lg" edge="emerald">
            <Text style={[styles.name, isRTL && styles.rtl]}>{ar ? 'مستأجر جديد رسمي' : 'New official tenant'}</Text>
            <Field ar={ar} label={ar ? 'الاسم' : 'Name'} value={draftName} onChange={setDraftName} />
            <Field ar={ar} label={ar ? 'الجوال' : 'Phone'} value={draftPhone} onChange={setDraftPhone} />
            <Field ar={ar} label={ar ? 'الإيجار' : 'Rent'} value={draftRent} onChange={setDraftRent} keyboardType="numeric" />
            <Field ar={ar} label={ar ? 'رقم العقد' : 'Contract'} value={draftContract} onChange={setDraftContract} />
            <Text style={[styles.dim, isRTL && styles.rtl, { marginTop: 8 }]}>
              {ar ? 'الوحدة:' : 'Unit:'} {os.units.find((u) => u.id === newUnitId)?.number || '—'}
            </Text>
            <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
              {os.units.slice(0, 12).map((u) => (
                <Pressable
                  key={u.id}
                  onPress={() => setNewUnitId(u.id)}
                  style={[styles.chip, newUnitId === u.id && styles.chipOn]}
                >
                  <Text style={styles.chipText}>{u.number}</Text>
                </Pressable>
              ))}
            </View>
            <View style={[styles.actions, isRTL && styles.rowRtl]}>
              <Pressable style={styles.primary} onPress={submitNew}>
                <Text style={styles.primaryText}>{ar ? 'إضافة واعتماد' : 'Add & adopt'}</Text>
              </Pressable>
              <Pressable style={styles.secondary} onPress={() => setShowNew(false)}>
                <Text style={styles.secondaryText}>{ar ? 'إلغاء' : 'Cancel'}</Text>
              </Pressable>
            </View>
          </GlassCard>
        </View>
      </Modal>
    </ScreenScaffold>
  );
}

function Field({
  ar, label, value, onChange, keyboardType,
}: {
  ar: boolean; label: string; value: string; onChange: (v: string) => void; keyboardType?: 'numeric';
}) {
  return (
    <View style={{ marginTop: 10 }}>
      <Text style={[styles.dim, ar && styles.rtl]}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        keyboardType={keyboardType}
        placeholderTextColor={colors.textSubtle}
        style={[styles.input, ar && styles.rtl]}
      />
    </View>
  );
}

function Action({ icon, label, onPress }: { icon: keyof typeof Feather.glyphMap; label: string; onPress: () => void }) {
  return (
    <Pressable onPress={() => { Haptics.selectionAsync(); onPress(); }} style={styles.action}>
      <Feather name={icon} size={13} color={colors.gold} />
      <Text style={styles.actionText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  toolbar: { flexDirection: 'row', gap: 8, marginBottom: spacing.md, alignItems: 'center' },
  rowRtl: { flexDirection: 'row-reverse' },
  rtl: { writingDirection: 'rtl', textAlign: 'right' },
  search: {
    flex: 1,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: colors.text,
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  addBtn: {
    width: 42, height: 42, borderRadius: 21, backgroundColor: colors.emerald,
    alignItems: 'center', justifyContent: 'center',
  },
  summaryLink: { marginBottom: spacing.md },
  summaryLinkText: { color: colors.gold, fontWeight: typography.weight.semibold },
  name: { color: colors.text, fontSize: 16, fontWeight: typography.weight.semibold },
  dim: { color: colors.textDim, fontSize: 12, marginTop: 4 },
  badge: { color: colors.gold, fontSize: 11, marginTop: 6 },
  section: { color: colors.textMuted, fontSize: 11, letterSpacing: 0.8, textTransform: 'uppercase' },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  action: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 10, paddingVertical: 8, borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border,
  },
  actionText: { color: colors.text, fontSize: 11 },
  modalWrap: { flex: 1, backgroundColor: 'rgba(0,0,0,0.72)', justifyContent: 'center', padding: 20 },
  input: {
    marginTop: 6, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, borderRadius: radius.md,
    paddingHorizontal: 12, paddingVertical: 10, color: colors.text, backgroundColor: 'rgba(255,255,255,0.03)',
  },
  primary: { flex: 1, backgroundColor: colors.emerald, borderRadius: radius.md, paddingVertical: 12, alignItems: 'center' },
  primaryText: { color: colors.bg, fontWeight: typography.weight.semibold },
  secondary: { flex: 1, borderRadius: radius.md, paddingVertical: 12, alignItems: 'center', borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  secondaryText: { color: colors.textDim },
  chip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: radius.pill, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  chipOn: { borderColor: colors.goldEdge, backgroundColor: colors.goldSoft },
  chipText: { color: colors.text, fontSize: 12 },
});
