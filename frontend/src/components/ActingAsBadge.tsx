/**
 * ActingAsBadge — a small, unmistakable label at the top of every
 * portal explaining WHICH role the current session belongs to.
 *
 * Owner never sees this (they use the main app). Agent/Tech/Tenant
 * portals each mount it right below the ScreenHeader so the visitor
 * always knows "I am here as X, and I only see X's data."
 *
 * Non-invasive · additive · no dependency on backend or auth engine.
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { colors, spacing, typography, radius, iconSize } from '../theme';
import { useI18n } from '../i18n';

export type PortalRole = 'agent' | 'tech' | 'tenant';

const ROLE_META: Record<PortalRole, {
  labelKey: string;
  icon: keyof typeof Feather.glyphMap;
  color: string;
  edge: string;
  bg: string;
}> = {
  agent:  { labelKey: 'role.badge.agent',  icon: 'briefcase', color: colors.gold,    edge: colors.goldEdge,    bg: colors.goldSoft },
  tech:   { labelKey: 'role.badge.tech',   icon: 'tool',      color: colors.emerald, edge: colors.emeraldEdge, bg: colors.emeraldSoft },
  tenant: { labelKey: 'role.badge.tenant', icon: 'home',      color: colors.gold,    edge: colors.goldEdge,    bg: colors.goldSoft },
};

type Props = {
  role: PortalRole;
  displayName: string;
  /** Optional secondary line — the property/unit/scope of this session. */
  scope?: string;
};

export function ActingAsBadge({ role, displayName, scope }: Props) {
  const { t, isRTL } = useI18n();
  const meta = ROLE_META[role];

  return (
    <View style={styles.wrap}>
      <View style={[
        styles.pill,
        { borderColor: meta.edge, backgroundColor: meta.bg },
        isRTL && { flexDirection: 'row-reverse' },
      ]}>
        <View style={[styles.chip, { borderColor: meta.edge }]}>
          <Feather name={meta.icon} size={iconSize.sm} color={meta.color} />
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <View style={[styles.headline, isRTL && { flexDirection: 'row-reverse' }]}>
            <Text style={[styles.roleLabel, { color: meta.color }]}>
              {t(meta.labelKey as any).toUpperCase()}
            </Text>
            <View style={[styles.dot, { backgroundColor: meta.color }]} />
            <Text style={[styles.name, isRTL && styles.rtl]} numberOfLines={1}>
              {displayName}
            </Text>
          </View>
          {scope ? (
            <Text style={[styles.scope, isRTL && styles.rtl]} numberOfLines={1}>
              {scope}
            </Text>
          ) : null}
        </View>
      </View>
      <Text style={[styles.hint, isRTL && styles.rtl]}>
        {t('role.badge.hint' as any)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: spacing.md, gap: 6 },
  pill: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 14, paddingVertical: 12, borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
  chip: {
    width: 30, height: 30, borderRadius: 15,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  headline: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  roleLabel: {
    fontSize: 10, letterSpacing: 1.6,
    fontWeight: typography.weight.semibold,
  },
  dot: { width: 3, height: 3, borderRadius: 2, opacity: 0.6 },
  name: {
    color: colors.text, fontSize: 13,
    fontWeight: typography.weight.semibold, letterSpacing: -0.15,
    flexShrink: 1,
  },
  rtl: { textAlign: 'right', writingDirection: 'rtl' },
  scope: {
    color: colors.textMuted, fontSize: 11.5, letterSpacing: 0.2,
  },
  hint: {
    color: colors.textSubtle, fontSize: 10.5, letterSpacing: 0.2,
    lineHeight: 15, marginHorizontal: 4,
  },
});
