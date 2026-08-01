/**
 * Home account rail — profile (+ agent), links, database (Excel), settings.
 * Placed on the home screen to replace scattered quick-access duplicates.
 */
import React, { useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, Pressable, Modal, Switch, Linking, Platform, Share, Alert,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';

import { GlassCard } from '@/src/components/GlassCard';
import { KeyboardAwareTextInput } from '@/src/components/KeyboardAwareTextInput';
import { AgentPortalShareCard } from '@/src/components/AgentPortalShareCard';
import { usePortalAccess } from '@/src/hooks/usePortalAccess';
import { usePropertyOS } from '@/src/hooks/usePropertyOS';
import { useNotificationPrefs } from '@/src/hooks/usePreferences';
import { buildPropertyExcelCsv, sharePropertyExcel } from '@/src/utils/property-excel-export';
import type { AgentPermissions, PropertyAgentRecord } from '@/src/types/portal-access';
import { colors, spacing, typography, radius } from '@/src/theme';
import { useI18n } from '@/src/i18n';

const DEFAULT_PERMS: AgentPermissions = {
  contracts: true, maintenance: true, tenants: true, wallet: false, settings: false,
};

type RailKey = 'profile' | 'links' | 'database' | 'settings';

export function HomeAccountRail({ testID = 'home-account-rail' }: { testID?: string }) {
  const { t, isRTL, lang } = useI18n();
  const ar = lang === 'ar' || !!isRTL;
  const router = useRouter();
  const { countEnabled } = useNotificationPrefs();
  const { state: os } = usePropertyOS(countEnabled);
  const { agents, addAgent } = usePortalAccess();
  const [open, setOpen] = useState<RailKey | null>(null);
  const [agentName, setAgentName] = useState('');
  const [agentPhone, setAgentPhone] = useState('');
  const [agentEmail, setAgentEmail] = useState('');
  const [perms, setPerms] = useState<AgentPermissions>(DEFAULT_PERMS);
  const [lastAgent, setLastAgent] = useState<PropertyAgentRecord | null>(null);

  const displayName = useMemo(() => {
    return os.property?.name?.trim()
      || (ar ? 'حساب المالك' : 'Owner account');
  }, [os.property?.name, ar]);

  const close = () => setOpen(null);

  const onRail = (key: RailKey) => {
    Haptics.selectionAsync();
    if (key === 'links') {
      router.push('/operational/portals' as any);
      return;
    }
    if (key === 'settings') {
      router.push('/settings' as any);
      return;
    }
    setOpen(key);
  };

  const createAgent = async () => {
    if (!agentName.trim()) return;
    const agent = await addAgent({
      name: agentName.trim(),
      phone: agentPhone,
      email: agentEmail,
      permissions: perms,
    });
    setLastAgent(agent);
    setAgentName('');
    setAgentPhone('');
    setAgentEmail('');
    setPerms(DEFAULT_PERMS);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const shareAgent = (agent: PropertyAgentRecord) => {
    const msg = `${ar ? 'رابط الوكيل' : 'Agent link'}: ${agent.portalUrl}`;
    const phone = agent.phone.replace(/\D/g, '');
    if (phone) {
      const url = Platform.select({
        ios: `whatsapp://send?phone=${phone}&text=${encodeURIComponent(msg)}`,
        default: `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`,
      });
      Linking.openURL(url!).catch(() => Share.share({ message: msg }));
    } else {
      Share.share({ message: msg });
    }
  };

  const exportExcel = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const csv = await buildPropertyExcelCsv(os, ar);
      await sharePropertyExcel(csv, os.property?.name || 'spp-database');
    } catch (e: any) {
      Alert.alert(ar ? 'تعذر التصدير' : 'Export failed', String(e?.message || e));
    }
  };

  return (
    <View style={[styles.wrap, isRTL && styles.wrapRtl]} testID={testID}>
      <RailBtn
        icon="user"
        label={displayName}
        active={open === 'profile'}
        onPress={() => onRail('profile')}
        testID={`${testID}-profile`}
      />
      <RailBtn
        icon="link"
        label={ar ? 'الروابط' : 'Links'}
        onPress={() => onRail('links')}
        testID={`${testID}-links`}
      />
      <RailBtn
        icon="database"
        label={ar ? 'قاعدة البيانات' : 'Database'}
        active={open === 'database'}
        onPress={() => onRail('database')}
        testID={`${testID}-database`}
      />
      <RailBtn
        icon="settings"
        label={ar ? 'الإعدادات' : 'Settings'}
        onPress={() => onRail('settings')}
        testID={`${testID}-settings`}
      />

      <Modal visible={open === 'profile'} transparent animationType="fade" onRequestClose={close}>
        <View style={styles.modalWrap}>
          <GlassCard padding={18} radiusToken="lg" edge="gold">
            <Text style={[styles.title, ar && styles.rtl]}>{ar ? 'الملف الشخصي' : 'Profile'}</Text>
            <Text style={[styles.sub, ar && styles.rtl]}>{displayName}</Text>
            <Pressable style={styles.secondaryBtn} onPress={() => { close(); router.push('/profile' as any); }}>
              <Text style={styles.secondaryBtnText}>{ar ? 'فتح الملف الشخصي' : 'Open profile'}</Text>
            </Pressable>

            <Text style={[styles.section, ar && styles.rtl, { marginTop: 14 }]}>
              {ar ? 'إضافة وكيل + الصلاحيات' : 'Add agent + permissions'}
            </Text>
            <KeyboardAwareTextInput
              value={agentName}
              onChangeText={setAgentName}
              placeholder={ar ? 'اسم الوكيل' : 'Agent name'}
              placeholderTextColor={colors.textSubtle}
              style={[styles.input, ar && styles.rtl]}
            />
            <KeyboardAwareTextInput
              value={agentPhone}
              onChangeText={setAgentPhone}
              placeholder={ar ? 'جوال الوكيل' : 'Agent phone'}
              placeholderTextColor={colors.textSubtle}
              keyboardType="phone-pad"
              style={[styles.input, ar && styles.rtl]}
            />
            <KeyboardAwareTextInput
              value={agentEmail}
              onChangeText={setAgentEmail}
              placeholder={ar ? 'بريد الوكيل' : 'Agent email'}
              placeholderTextColor={colors.textSubtle}
              keyboardType="email-address"
              style={[styles.input, ar && styles.rtl]}
            />
            {(['contracts', 'maintenance', 'tenants', 'wallet', 'settings'] as const).map((p) => (
              <View key={p} style={[styles.permRow, ar && styles.rowRtl]}>
                <Text style={styles.permLabel}>{t(`opsv2.portals.perm.${p}` as any)}</Text>
                <Switch
                  value={perms[p]}
                  onValueChange={(v) => setPerms((prev) => ({ ...prev, [p]: v }))}
                  trackColor={{ true: colors.emerald }}
                />
              </View>
            ))}
            <Pressable style={styles.primary} onPress={createAgent}>
              <Text style={styles.primaryText}>{ar ? 'إنشاء وكيل وإرسال رابط' : 'Create agent & link'}</Text>
            </Pressable>
            {lastAgent ? (
              <View style={{ marginTop: 12 }}>
                <AgentPortalShareCard agent={lastAgent} />
                <Pressable style={styles.secondaryBtn} onPress={() => shareAgent(lastAgent)}>
                  <Text style={styles.secondaryBtnText}>{ar ? 'إرسال الرابط' : 'Send link'}</Text>
                </Pressable>
              </View>
            ) : null}
            {agents.length > 0 ? (
              <Text style={[styles.dim, ar && styles.rtl, { marginTop: 10 }]}>
                {ar ? `وكلاء مسجّلون: ${agents.length}` : `Agents on file: ${agents.length}`}
              </Text>
            ) : null}
            <Pressable style={[styles.secondaryBtn, { marginTop: 10 }]} onPress={close}>
              <Text style={styles.secondaryBtnText}>{ar ? 'إغلاق' : 'Close'}</Text>
            </Pressable>
          </GlassCard>
        </View>
      </Modal>

      <Modal visible={open === 'database'} transparent animationType="fade" onRequestClose={close}>
        <View style={styles.modalWrap}>
          <GlassCard padding={18} radiusToken="lg" edge="emerald">
            <Text style={[styles.title, ar && styles.rtl]}>{ar ? 'قاعدة البيانات' : 'Database'}</Text>
            <Text style={[styles.sub, ar && styles.rtl]}>
              {ar
                ? 'حفظ بيانات العقار والمستأجرين والأشهر كملف إكسل/CSV ومشاركتها.'
                : 'Save property, tenants, and months as Excel/CSV and share.'}
            </Text>
            <Pressable style={styles.primary} onPress={exportExcel}>
              <Text style={styles.primaryText}>{ar ? 'حفظ قاعدة البيانات في إكسل' : 'Save database as Excel'}</Text>
            </Pressable>
            <Pressable
              style={styles.secondaryBtn}
              onPress={() => { close(); router.push('/tenants/official' as any); }}
            >
              <Text style={styles.secondaryBtnText}>{ar ? 'جدول المستأجرين' : 'Tenant table'}</Text>
            </Pressable>
            <Pressable style={[styles.secondaryBtn, { marginTop: 8 }]} onPress={close}>
              <Text style={styles.secondaryBtnText}>{ar ? 'إغلاق' : 'Close'}</Text>
            </Pressable>
          </GlassCard>
        </View>
      </Modal>
    </View>
  );
}

function RailBtn({
  icon, label, onPress, active, testID,
}: {
  icon: keyof typeof Feather.glyphMap;
  label: string;
  onPress: () => void;
  active?: boolean;
  testID?: string;
}) {
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      style={[styles.railBtn, active && styles.railBtnOn]}
    >
      <Feather name={icon} size={14} color={active ? colors.bg : colors.gold} />
      <Text style={[styles.railLabel, active && styles.railLabelOn]} numberOfLines={1}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
    gap: 8,
    marginBottom: spacing.md,
  },
  wrapRtl: { flexDirection: 'row-reverse', justifyContent: 'flex-start' },
  railBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.goldEdge,
    backgroundColor: colors.goldSoft,
    maxWidth: '48%',
  },
  railBtnOn: { backgroundColor: colors.gold, borderColor: colors.gold },
  railLabel: { color: colors.gold, fontSize: 11, fontWeight: typography.weight.semibold, flexShrink: 1 },
  railLabelOn: { color: colors.bg },
  modalWrap: { flex: 1, backgroundColor: 'rgba(0,0,0,0.72)', justifyContent: 'center', padding: 18 },
  title: { color: colors.text, fontSize: 17, fontWeight: typography.weight.semibold },
  sub: { color: colors.textDim, fontSize: 13, marginTop: 6, lineHeight: 19 },
  section: { color: colors.gold, fontSize: 12, fontWeight: typography.weight.semibold, marginBottom: 8 },
  input: {
    marginTop: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: colors.text,
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  permRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 },
  rowRtl: { flexDirection: 'row-reverse' },
  permLabel: { color: colors.textDim, fontSize: 13 },
  primary: {
    marginTop: 14, backgroundColor: colors.emerald, borderRadius: radius.md,
    paddingVertical: 12, alignItems: 'center',
  },
  primaryText: { color: colors.bg, fontWeight: typography.weight.semibold },
  secondaryBtn: {
    marginTop: 10, borderRadius: radius.md, paddingVertical: 11, alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border,
  },
  secondaryBtnText: { color: colors.gold, fontWeight: typography.weight.semibold, fontSize: 13 },
  dim: { color: colors.textMuted, fontSize: 12 },
  rtl: { writingDirection: 'rtl', textAlign: 'right' },
});
