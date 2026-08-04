/**
 * Home account rail — vertical beside the page (physical right), not a top strip.
 */
import React, { useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, Pressable, Modal, Switch, Linking, Platform, Share,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';

import { GlassCard } from '@/src/components/GlassCard';
import { KeyboardAwareTextInput } from '@/src/components/KeyboardAwareTextInput';
import { AgentPortalShareCard } from '@/src/components/AgentPortalShareCard';
import { usePortalAccess } from '@/src/hooks/usePortalAccess';
import { usePropertyOS } from '@/src/hooks/usePropertyOS';
import { useNotificationPrefs } from '@/src/hooks/usePreferences';
import { useWorkspacePadding } from '@/src/hooks/use-workspace-padding';
import type { AgentPermissions, PropertyAgentRecord } from '@/src/types/portal-access';
import { AGENT_OWNER_PERM_KEYS, DEFAULT_AGENT_PERMISSIONS } from '@/src/types/portal-access';
import { colors, spacing, typography, radius } from '@/src/theme';
import { useI18n } from '@/src/i18n';

type RailKey = 'profile' | null;

export function HomeAccountRail({ testID = 'home-account-rail' }: { testID?: string }) {
  const { t, isRTL, lang } = useI18n();
  const ar = lang === 'ar' || !!isRTL;
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const wsPad = useWorkspacePadding();
  const { countEnabled } = useNotificationPrefs();
  const { state: os } = usePropertyOS(countEnabled);
  const { agents, addAgent } = usePortalAccess();
  const [open, setOpen] = useState<RailKey>(null);
  const [agentName, setAgentName] = useState('');
  const [agentPhone, setAgentPhone] = useState('');
  const [agentEmail, setAgentEmail] = useState('');
  const [perms, setPerms] = useState<AgentPermissions>({ ...DEFAULT_AGENT_PERMISSIONS });
  const [lastAgent, setLastAgent] = useState<PropertyAgentRecord | null>(null);

  const displayName = useMemo(() => {
    return os.property?.name?.trim() || (ar ? 'الحساب' : 'Account');
  }, [os.property?.name, ar]);

  const close = () => setOpen(null);

  const go = (route: string) => {
    Haptics.selectionAsync();
    router.push(route as any);
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
    setPerms({ ...DEFAULT_AGENT_PERMISSIONS });
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

  const top = insets.top + wsPad.paddingTop + 56;

  return (
    <>
      <View
        style={[styles.rail, { top, right: 6 + (wsPad.paddingRight || 0) }]}
        testID={testID}
        pointerEvents="box-none"
      >
        <RailIcon
          icon="user"
          label={displayName}
          active={open === 'profile'}
          onPress={() => { Haptics.selectionAsync(); setOpen('profile'); }}
          testID={`${testID}-profile`}
        />
        <RailIcon
          icon="link"
          label={ar ? 'روابط' : 'Links'}
          onPress={() => go('/operational/portals')}
          testID={`${testID}-links`}
        />
        <RailIcon
          icon="database"
          label={ar ? 'بيانات' : 'Data'}
          onPress={() => go('/database')}
          testID={`${testID}-database`}
        />
        <RailIcon
          icon="settings"
          label={ar ? 'إعدادات' : 'Settings'}
          onPress={() => go('/settings')}
          testID={`${testID}-settings`}
        />
      </View>

      <Modal visible={open === 'profile'} transparent animationType="fade" onRequestClose={close}>
        <View style={styles.modalWrap}>
          <GlassCard padding={18} radiusToken="lg" edge="gold">
            <Text style={[styles.title, ar && styles.rtl]}>{ar ? 'الملف الشخصي' : 'Profile'}</Text>
            <Text style={[styles.sub, ar && styles.rtl]}>{displayName}</Text>
            <Pressable style={styles.secondaryBtn} onPress={() => { close(); go('/profile'); }}>
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
            <Text style={[styles.section, ar && styles.rtl]}>
              {ar ? 'صلاحيات يحددها المالك' : 'Owner-selected permissions'}
            </Text>
            {AGENT_OWNER_PERM_KEYS.map((p) => (
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
    </>
  );
}

function RailIcon({
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
      <Feather name={icon} size={16} color={active ? colors.bg : colors.gold} />
      <Text style={[styles.railLabel, active && styles.railLabelOn]} numberOfLines={1}>{label}</Text>
    </Pressable>
  );
}

/** Width reserved so home content does not sit under the side rail. */
export const HOME_ACCOUNT_RAIL_WIDTH = 72;

const styles = StyleSheet.create({
  rail: {
    position: 'absolute',
    zIndex: 40,
    width: HOME_ACCOUNT_RAIL_WIDTH,
    gap: 8,
    alignItems: 'stretch',
  },
  railBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 10,
    paddingHorizontal: 4,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.goldEdge,
    backgroundColor: 'rgba(5,10,18,0.92)',
  },
  railBtnOn: { backgroundColor: colors.gold, borderColor: colors.gold },
  railLabel: {
    color: colors.gold,
    fontSize: 9,
    fontWeight: typography.weight.semibold,
    textAlign: 'center',
  },
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
