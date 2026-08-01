/**
 * HTTPS / bridge entry — maps shared portal links into the correct in-app portal.
 */
import { useEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { ScreenScaffold } from '@/src/components/ScreenScaffold';
import { inAppAgentPortal, inAppTechPortal, inAppTenantPortal } from '@/src/utils/portal-links';
import { colors, typography } from '@/src/theme';
import { useI18n } from '@/src/i18n';

export default function PortalOpenBridge() {
  const { lang, isRTL } = useI18n();
  const ar = lang === 'ar' || !!isRTL;
  const router = useRouter();
  const params = useLocalSearchParams<{
    role?: string;
    id?: string;
    t?: string;
    n?: string;
    u?: string;
    prop?: string;
    name?: string;
    unit?: string;
  }>();

  useEffect(() => {
    const role = String(params.role || 'tenant').toLowerCase();
    const id = String(params.id || '');
    const t = String(params.t || '');
    const meta = {
      name: params.n || params.name,
      unit: params.u || params.unit,
      property: params.prop,
    };
    let target: string | null = null;
    if (role === 'tech' && t) target = inAppTechPortal(t, id || undefined, meta);
    else if (role === 'agent' && id && t) target = inAppAgentPortal(id, t, meta);
    else if (id && t) target = inAppTenantPortal(id, t, meta);

    if (target) {
      router.replace(target as any);
    }
  }, [params.role, params.id, params.t, params.n, params.u, params.prop, params.name, params.unit, router]);

  return (
    <ScreenScaffold testID="portal-open-bridge">
      <View style={styles.wrap}>
        <ActivityIndicator color={colors.gold} />
        <Text style={[styles.text, ar && styles.rtl]}>
          {ar ? 'جاري فتح البوابة…' : 'Opening portal…'}
        </Text>
      </View>
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14, paddingTop: 80 },
  text: { color: colors.textMuted, fontSize: typography.small },
  rtl: { writingDirection: 'rtl', textAlign: 'right' },
});
