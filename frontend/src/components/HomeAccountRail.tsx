/**
 * Home side rail — separate buttons (not merged into Account):
 * Account (profile) · Operations · Permissions · Control desk
 *   (tenant / guard / agent portal links under Control).
 */
import React, { useEffect, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, Pressable, Modal, Switch, Linking, Platform, Share, ScrollView,
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
import { storage } from '@/src/utils/storage';
import { buildTenantPortalLink, PORTAL_BRIDGE_URL } from '@/src/utils/portal-links';
import { formatDate } from '@/src/utils/locale';
import type { AgentPermissions, PropertyAgentRecord } from '@/src/types/portal-access';
import { DEFAULT_AGENT_PERMISSIONS } from '@/src/types/portal-access';
import { colors, typography, radius } from '@/src/theme';
import { useI18n } from '@/src/i18n';

const DEFAULT_PERMS: AgentPermissions = DEFAULT_AGENT_PERMISSIONS;

const GUARDS_KEY = 'spp.accountControl.guards';

type MenuView = 'menu' | 'permissions' | 'control';

type GuardDraft = {
  id: string;
  name: string;
  phone: string;
  portalToken: string;
  portalUrl: string;
  linkActive: boolean;
};

function uid(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

function buildGuardShareUrl(id: string, token: string, name: string) {
  const sp = new URLSearchParams({
    role: 'guard',
    id,
    t: token,
    n: name,
    v: '36',
  });
  return `${PORTAL_BRIDGE_URL}?${sp.toString()}`;
}

async function loadGuards(): Promise<GuardDraft[]> {
  const raw = await storage.getItem<string>(GUARDS_KEY, '');
  if (!raw) return [];
  try {
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    return Array.isArray(parsed) ? parsed as GuardDraft[] : [];
  } catch {
    return [];
  }
}

async function saveGuards(list: GuardDraft[]) {
  await storage.setItem(GUARDS_KEY, JSON.stringify(list));
}

export function HomeAccountRail({ testID = 'home-account-rail' }: { testID?: string }) {
  const { t, isRTL, lang } = useI18n();
  const ar = lang === 'ar' || !!isRTL;
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const wsPad = useWorkspacePadding();
  const { countEnabled } = useNotificationPrefs();
  const { state: os } = usePropertyOS(countEnabled);
  const { agents, addAgent, setAgentActive, getLastLogin } = usePortalAccess();
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<MenuView>('menu');
  const [agentName, setAgentName] = useState('');
  const [agentPhone, setAgentPhone] = useState('');
  const [agentEmail, setAgentEmail] = useState('');
  const [perms, setPerms] = useState<AgentPermissions>(DEFAULT_PERMS);
  const [lastAgent, setLastAgent] = useState<PropertyAgentRecord | null>(null);
  const [guards, setGuards] = useState<GuardDraft[]>([]);
  const [guardName, setGuardName] = useState('');
  const [guardPhone, setGuardPhone] = useState('');
  const [showGuardForm, setShowGuardForm] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const list = await loadGuards();
      if (!cancelled) setGuards(list);
    })();
    return () => { cancelled = true; };
  }, []);

  const persistGuards = async (list: GuardDraft[]) => {
    setGuards(list);
    await saveGuards(list);
  };

  const displayName = useMemo(() => {
    return os.property?.name?.trim() || (ar ? 'الحساب' : 'Account');
  }, [os.property?.name, ar]);

  const tenants = os.tenants || [];

  const close = () => {
    setOpen(false);
    setView('menu');
    setShowGuardForm(false);
  };

  const go = (route: string) => {
    Haptics.selectionAsync();
    close();
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
    setPerms(DEFAULT_PERMS);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const createGuard = async () => {
    if (!guardName.trim()) return;
    const id = uid('guard');
    const token = uid('gtok').slice(-12);
    const name = guardName.trim();
    const portalUrl = buildGuardShareUrl(id, token, name);
    await persistGuards([
      {
        id,
        name,
        phone: guardPhone.trim(),
        portalToken: token,
        portalUrl,
        linkActive: true,
      },
      ...guards,
    ]);
    setGuardName('');
    setGuardPhone('');
    setShowGuardForm(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const shareUrl = (label: string, url: string, phone?: string) => {
    const msg = `${label}: ${url}`;
    const digits = (phone || '').replace(/\D/g, '');
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

  const top = insets.top + wsPad.paddingTop + 56;

  const openPanel = (next: MenuView) => {
    Haptics.selectionAsync();
    setView(next);
    setShowGuardForm(false);
    setOpen(true);
  };

  const railTools: {
    key: string;
    icon: keyof typeof Feather.glyphMap;
    label: string;
    active: boolean;
    onPress: () => void;
  }[] = [
    {
      key: 'account',
      icon: 'user',
      label: ar ? 'الحساب' : 'Account',
      active: open && view === 'menu',
      onPress: () => openPanel('menu'),
    },
    {
      key: 'operations',
      icon: 'briefcase',
      label: ar ? 'العمليات' : 'Ops',
      active: false,
      onPress: () => {
        Haptics.selectionAsync();
        close();
        router.push('/owner' as any);
      },
    },
    {
      key: 'permissions',
      icon: 'shield',
      label: ar ? 'الصلاحيات' : 'Perms',
      active: open && view === 'permissions',
      onPress: () => openPanel('permissions'),
    },
    {
      key: 'control',
      icon: 'cpu',
      label: ar ? 'التحكم' : 'Control',
      active: open && view === 'control',
      onPress: () => openPanel('control'),
    },
  ];

  const Back = () => (
    <Pressable
      style={[styles.backRow, ar && styles.rowRtl]}
      onPress={close}
      testID={`${testID}-back`}
    >
      <Feather name={ar ? 'chevron-right' : 'chevron-left'} size={16} color={colors.gold} />
      <Text style={styles.backText}>{ar ? 'إغلاق' : 'Close'}</Text>
    </Pressable>
  );

  const LinkRow = ({
    title,
    meta,
    url,
    active,
    onToggle,
    onShare,
    onOpen,
    tone = 'gold',
  }: {
    title: string;
    meta?: string;
    url: string;
    active?: boolean;
    onToggle?: () => void;
    onShare: () => void;
    onOpen?: () => void;
    tone?: 'gold' | 'emerald';
  }) => (
    <View style={styles.linkCard}>
      <View style={[styles.linkHead, ar && styles.rowRtl]}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.linkTitle, ar && styles.rtl]} numberOfLines={1}>{title}</Text>
          {meta ? <Text style={[styles.linkMeta, ar && styles.rtl]}>{meta}</Text> : null}
        </View>
        {typeof active === 'boolean' ? (
          <View style={[styles.activePill, active ? styles.activeOn : styles.activeOff]}>
            <Text style={styles.activePillText}>
              {active
                ? (ar ? 'مفعّل' : 'Active')
                : (ar ? 'متوقف' : 'Off')}
            </Text>
          </View>
        ) : null}
      </View>
      <Text style={styles.linkUrl} selectable numberOfLines={2}>{url}</Text>
      <View style={[styles.linkActions, ar && styles.rowRtl]}>
        <Pressable style={styles.chip} onPress={onShare}>
          <Feather name="send" size={12} color={colors.emerald} />
          <Text style={styles.chipText}>{ar ? 'إرسال' : 'Send'}</Text>
        </Pressable>
        {onOpen ? (
          <Pressable style={styles.chip} onPress={onOpen}>
            <Feather name="external-link" size={12} color={tone === 'emerald' ? colors.emerald : colors.gold} />
            <Text style={[styles.chipText, { color: tone === 'emerald' ? colors.emerald : colors.gold }]}>
              {ar ? 'فتح' : 'Open'}
            </Text>
          </Pressable>
        ) : null}
        {onToggle ? (
          <Pressable style={styles.chip} onPress={onToggle}>
            <Feather name="power" size={12} color={colors.textMuted} />
            <Text style={[styles.chipText, { color: colors.textMuted }]}>
              {active ? (ar ? 'إيقاف' : 'Disable') : (ar ? 'تفعيل' : 'Enable')}
            </Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );

  return (
    <>
      <View
        style={[styles.rail, { top, right: 6 + (wsPad.paddingRight || 0) }]}
        testID={testID}
        pointerEvents="box-none"
      >
        {railTools.map((tool) => (
          <Pressable
            key={tool.key}
            testID={`${testID}-${tool.key}`}
            onPress={tool.onPress}
            style={[styles.railBtn, tool.active && styles.railBtnOn]}
            accessibilityRole="button"
            accessibilityLabel={tool.label}
          >
            <Feather
              name={tool.icon}
              size={15}
              color={tool.active ? colors.bg : colors.gold}
            />
            <Text
              style={[styles.railLabel, tool.active && styles.railLabelOn]}
              numberOfLines={1}
            >
              {tool.label}
            </Text>
          </Pressable>
        ))}
      </View>

      <Modal visible={open} transparent animationType="fade" onRequestClose={close}>
        <Pressable style={styles.modalWrap} onPress={close} testID={`${testID}-backdrop`}>
          <Pressable
            style={[styles.dropdownAnchor, { top: Math.max(24, top - 8), right: 6 + (wsPad.paddingRight || 0) }]}
            onPress={(e) => e.stopPropagation?.()}
          >
            <GlassCard padding={14} radiusToken="lg" edge="gold" style={styles.dropdownCard}>
              {view === 'menu' ? (
                <>
                  <Text style={[styles.kowilEyebrow, ar && styles.rtl]}>
                    {ar ? 'كويل · الحساب' : 'Kowil · Account'}
                  </Text>
                  <Text style={[styles.title, ar && styles.rtl]} numberOfLines={1}>
                    {displayName}
                  </Text>
                  <Text style={[styles.sub, ar && styles.rtl]}>
                    {ar
                      ? 'بيانات الحساب فقط — العمليات والصلاحيات والتحكم أزرار منفصلة تحت الحساب'
                      : 'Account profile only — Ops, Permissions, and Control are separate buttons under Account'}
                  </Text>
                  <View style={styles.menuList}>
                    <Pressable
                      testID={`${testID}-item-profile`}
                      onPress={() => go('/profile')}
                      style={[styles.menuRow, ar && styles.rowRtl]}
                    >
                      <View style={styles.menuIconWrap}>
                        <Feather name="user" size={15} color={colors.gold} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.menuLabel, ar && styles.rtl]}>
                          {ar ? 'بيانات حساب المستخدم' : 'Account profile'}
                        </Text>
                        <Text style={[styles.menuHint, ar && styles.rtl]}>
                          {ar ? 'الاسم والبريد والملف' : 'Name, email, profile'}
                        </Text>
                      </View>
                      <Feather
                        name={ar ? 'chevron-left' : 'chevron-right'}
                        size={14}
                        color={colors.textMuted}
                      />
                    </Pressable>
                  </View>
                </>
              ) : null}

              {view === 'permissions' ? (
                <ScrollView
                  style={styles.panelScroll}
                  contentContainerStyle={{ paddingBottom: 8 }}
                  showsVerticalScrollIndicator={false}
                  keyboardShouldPersistTaps="handled"
                >
                  <Back />
                  <Text style={[styles.title, ar && styles.rtl]}>
                    {ar ? 'إدارة الصلاحيات' : 'Permissions'}
                  </Text>
                  <Text style={[styles.sub, ar && styles.rtl]}>
                    {ar ? 'حدّد نطاق صلاحيات الوكيل قبل إنشاء الرابط' : 'Set agent scopes before creating the link'}
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
                  <Pressable style={styles.primary} onPress={createAgent} testID={`${testID}-create-agent`}>
                    <Text style={styles.primaryText}>
                      {ar ? 'إنشاء وكيل ورابط' : 'Create agent & link'}
                    </Text>
                  </Pressable>
                  {lastAgent ? (
                    <View style={{ marginTop: 12 }}>
                      <AgentPortalShareCard agent={lastAgent} />
                    </View>
                  ) : null}
                </ScrollView>
              ) : null}

              {view === 'control' ? (
                <ScrollView
                  style={styles.panelScroll}
                  contentContainerStyle={{ paddingBottom: 10 }}
                  showsVerticalScrollIndicator={false}
                  keyboardShouldPersistTaps="handled"
                >
                  <Back />
                  <Text style={[styles.kowilEyebrow, ar && styles.rtl]}>
                    {ar ? 'كويل · لوحة التحكم' : 'Kowil · Control desk'}
                  </Text>
                  <Text style={[styles.title, ar && styles.rtl]}>
                    {ar ? 'إدارة التحكم' : 'Link control'}
                  </Text>
                  <Text style={[styles.sub, ar && styles.rtl]}>
                    {ar
                      ? 'تابع كل الروابط وفعّلها أو أوقفها وأرسلها — مستأجر · حارس · وكلاء'
                      : 'Monitor, enable/disable, and send every link — tenant · guard · agents'}
                  </Text>

                  <View style={styles.statsRow}>
                    <View style={styles.stat}>
                      <Text style={styles.statNum}>{tenants.length}</Text>
                      <Text style={styles.statLbl}>{ar ? 'مستأجر' : 'Tenants'}</Text>
                    </View>
                    <View style={styles.stat}>
                      <Text style={styles.statNum}>{guards.length}</Text>
                      <Text style={styles.statLbl}>{ar ? 'حارس' : 'Guards'}</Text>
                    </View>
                    <View style={styles.stat}>
                      <Text style={styles.statNum}>{agents.length}</Text>
                      <Text style={styles.statLbl}>{ar ? 'وكلاء' : 'Agents'}</Text>
                    </View>
                  </View>

                  {/* Tenants */}
                  <Text style={[styles.section, ar && styles.rtl]}>
                    {ar ? 'روابط المستأجرين' : 'Tenant links'}
                  </Text>
                  {!tenants.length ? (
                    <Text style={[styles.empty, ar && styles.rtl]}>
                      {ar ? 'لا مستأجرين بعد — أضفهم من العمليات' : 'No tenants yet — add from operations'}
                    </Text>
                  ) : tenants.slice(0, 12).map((tenant) => {
                    const unit = os.units.find((u) => u.id === tenant.unitId);
                    const token = tenant.portalToken || '';
                    const live = token
                      ? buildTenantPortalLink(tenant.id, token, { name: tenant.name, unit: unit?.number })
                      : null;
                    const url = live?.url || tenant.portalUrl || '—';
                    const last = getLastLogin(tenant.id, 'tenant');
                    return (
                      <LinkRow
                        key={tenant.id}
                        title={tenant.name}
                        meta={`${unit?.number ? `${ar ? 'وحدة' : 'Unit'} ${unit.number} · ` : ''}${
                          last
                            ? `${ar ? 'آخر دخول' : 'Last'}: ${formatDate(last)}`
                            : (ar ? 'لم يدخل بعد' : 'Never logged in')
                        }`}
                        url={url}
                        tone="emerald"
                        onShare={() => shareUrl(ar ? 'رابط المستأجر' : 'Tenant link', url, tenant.phone)}
                        onOpen={live?.inApp ? () => go(live.inApp) : undefined}
                      />
                    );
                  })}

                  {/* Guards */}
                  <View style={[styles.sectionRow, ar && styles.rowRtl]}>
                    <Text style={[styles.section, ar && styles.rtl, { marginTop: 0, marginBottom: 0 }]}>
                      {ar ? 'روابط الحراس' : 'Guard links'}
                    </Text>
                    <Pressable
                      onPress={() => setShowGuardForm((v) => !v)}
                      testID={`${testID}-add-guard`}
                    >
                      <Feather name={showGuardForm ? 'minus' : 'plus'} size={16} color={colors.gold} />
                    </Pressable>
                  </View>
                  {showGuardForm ? (
                    <View style={styles.inlineForm}>
                      <KeyboardAwareTextInput
                        value={guardName}
                        onChangeText={setGuardName}
                        placeholder={ar ? 'اسم الحارس' : 'Guard name'}
                        placeholderTextColor={colors.textSubtle}
                        style={[styles.input, ar && styles.rtl]}
                      />
                      <KeyboardAwareTextInput
                        value={guardPhone}
                        onChangeText={setGuardPhone}
                        placeholder={ar ? 'جوال الحارس' : 'Guard phone'}
                        placeholderTextColor={colors.textSubtle}
                        keyboardType="phone-pad"
                        style={[styles.input, ar && styles.rtl]}
                      />
                      <Pressable style={styles.primary} onPress={createGuard}>
                        <Text style={styles.primaryText}>
                          {ar ? 'إنشاء رابط الحارس' : 'Create guard link'}
                        </Text>
                      </Pressable>
                    </View>
                  ) : null}
                  {!guards.length && !showGuardForm ? (
                    <Text style={[styles.empty, ar && styles.rtl]}>
                      {ar
                        ? 'لا حارس بعد — أضف حارسًا ليتابع كويل رابطه ويفعّله أو يوقفه'
                        : 'No guard yet — add one so Kowil can track and control the link'}
                    </Text>
                  ) : null}
                  {guards.map((g) => (
                    <LinkRow
                      key={g.id}
                      title={g.name}
                      meta={g.phone || (ar ? 'حارس العقار' : 'Building guard')}
                      url={g.portalUrl}
                      active={g.linkActive}
                      onToggle={() => {
                        void persistGuards(guards.map((x) => (
                          x.id === g.id ? { ...x, linkActive: !x.linkActive } : x
                        )));
                        Haptics.selectionAsync();
                      }}
                      onShare={() => shareUrl(ar ? 'رابط الحارس' : 'Guard link', g.portalUrl, g.phone)}
                    />
                  ))}

                  {/* Agents */}
                  <Text style={[styles.section, ar && styles.rtl]}>
                    {ar ? 'روابط الوكلاء' : 'Agent links'}
                  </Text>
                  {!agents.length ? (
                    <Text style={[styles.empty, ar && styles.rtl]}>
                      {ar
                        ? 'لا وكلاء بعد — أنشئ وكيلًا من إدارة الصلاحيات'
                        : 'No agents yet — create one under Permissions'}
                    </Text>
                  ) : agents.map((agent) => (
                    <LinkRow
                      key={agent.id}
                      title={agent.name}
                      meta={`${agent.linkActive ? (ar ? 'مفعّل' : 'Active') : (ar ? 'متوقف' : 'Off')} · ${
                        getLastLogin(agent.id, 'agent')
                          ? formatDate(getLastLogin(agent.id, 'agent')!)
                          : (ar ? 'لم يدخل بعد' : 'Never')
                      }`}
                      url={agent.portalUrl}
                      active={agent.linkActive}
                      onToggle={() => setAgentActive(agent.id, !agent.linkActive)}
                      onShare={() => shareUrl(ar ? 'رابط الوكيل' : 'Agent link', agent.portalUrl, agent.phone)}
                      onOpen={() => go(`/portal/agent?id=${encodeURIComponent(agent.id)}&t=${encodeURIComponent(agent.portalToken)}`)}
                    />
                  ))}
                </ScrollView>
              ) : null}
            </GlassCard>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

/** Width reserved so home content does not sit under the side rail (4 stacked buttons). */
export const HOME_ACCOUNT_RAIL_WIDTH = 76;

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
    gap: 2,
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
  modalWrap: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)' },
  dropdownAnchor: {
    position: 'absolute',
    width: 320,
    maxWidth: '92%',
  },
  dropdownCard: { maxHeight: 560 },
  kowilEyebrow: {
    color: colors.gold,
    fontSize: 10,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    fontWeight: typography.weight.semibold,
    marginBottom: 4,
  },
  title: { color: colors.text, fontSize: 16, fontWeight: typography.weight.semibold },
  sub: { color: colors.textDim, fontSize: 12, marginTop: 4, lineHeight: 18, marginBottom: 10 },
  menuList: { gap: 6 },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 11,
    paddingHorizontal: 10,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  menuIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.goldEdge,
  },
  menuLabel: {
    color: colors.text,
    fontSize: 13,
    fontWeight: typography.weight.semibold,
  },
  menuHint: { color: colors.textMuted, fontSize: 11, marginTop: 2 },
  backRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 },
  backText: { color: colors.gold, fontSize: 13, fontWeight: typography.weight.semibold },
  panelScroll: { maxHeight: 500 },
  section: {
    color: colors.textMuted,
    fontSize: 10,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    fontWeight: typography.weight.semibold,
    marginTop: 14,
    marginBottom: 8,
  },
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 14,
    marginBottom: 8,
  },
  statsRow: { flexDirection: 'row', gap: 8, marginBottom: 4 },
  stat: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  statNum: { color: colors.gold, fontSize: 16, fontWeight: typography.weight.semibold },
  statLbl: { color: colors.textMuted, fontSize: 10, marginTop: 2 },
  empty: { color: colors.textDim, fontSize: 12, lineHeight: 18, marginBottom: 6 },
  linkCard: {
    marginBottom: 8,
    padding: 10,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  linkHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  linkTitle: { color: colors.text, fontSize: 13, fontWeight: typography.weight.semibold },
  linkMeta: { color: colors.textMuted, fontSize: 11, marginTop: 2 },
  linkUrl: { color: colors.gold, fontSize: 10, lineHeight: 14, marginTop: 6 },
  linkActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  chipText: { color: colors.emerald, fontSize: 11, fontWeight: typography.weight.semibold },
  activePill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill,
  },
  activeOn: { backgroundColor: 'rgba(46, 204, 113, 0.18)' },
  activeOff: { backgroundColor: 'rgba(255,255,255,0.06)' },
  activePillText: { color: colors.textMuted, fontSize: 10, fontWeight: typography.weight.semibold },
  inlineForm: { marginBottom: 8 },
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
  rtl: { writingDirection: 'rtl', textAlign: 'right' },
});
