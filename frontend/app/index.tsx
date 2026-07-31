import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, RefreshControl,
} from 'react-native';
import Animated, {
  FadeIn, useSharedValue, useAnimatedScrollHandler,
} from 'react-native-reanimated';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { storage } from '@/src/utils/storage';

import { AmbientBackground } from '@/src/components/AmbientBackground';
import { BrandOrb, Wordmark } from '@/src/components/BrandOrb';
import { AliveEmpty } from '@/src/components/AliveEmpty';
import { HomeCommandCenter } from '@/src/components/HomeCommandCenter';
import { HomeShortcuts } from '@/src/components/HomeShortcuts';
import { HOME_SHORTCUTS } from '@/src/data/home-directory';
import { SetupProgressBar } from '@/src/components/SetupProgressBar';
import { usePropertyOS, phaseRoute } from '@/src/hooks/usePropertyOS';
import { useNotificationPrefs } from '@/src/hooks/usePreferences';
import { useWorkspacePadding } from '@/src/hooks/use-workspace-padding';
import { api, type Briefing, type NotifT } from '@/src/api/client';
import { clearExecutiveCache, fetchExecutiveCached } from '@/src/api/executive-cache';
import { mergeBriefingWithExecutive } from '@/src/api/executive-map';
import { colors, spacing, typography } from '@/src/theme';
import { useI18n } from '@/src/i18n';
import { UX_BUILD_STAMP } from '@/src/constants/build';

const EMPTY_BRIEFING: Briefing = {
  salutation: '',
  owner_name: '',
  headline: '',
  narrative: [],
  portfolio_annual_revenue: 0,
  avg_health: 0,
  occupancy: 0,
  properties_count: 0,
  tenants_count: 0,
  expiring_contracts: 0,
  decisions: [],
  sensor_alerts: [],
};

const AnimatedScroll = Animated.ScrollView;

/** Figma UX reorg — dashboard quick-access strip (RTL visual: upload → reports → maintenance → portfolio). */
const QUICK_ACCESS_KEYS = ['upload', 'reports', 'maintenance', 'portfolio'] as const;
const QUICK_ACCESS = QUICK_ACCESS_KEYS
  .map((key) => HOME_SHORTCUTS.find((sc) => sc.key === key))
  .filter((sc): sc is NonNullable<typeof sc> => Boolean(sc));

export default function Home() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { t } = useI18n();
  const [briefing, setBriefing] = useState<Briefing | null>(null);
  const [notifications, setNotifications] = useState<NotifT[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const wsPad = useWorkspacePadding();
  const { countEnabled } = useNotificationPrefs();
  const { state: osState, nextPhase } = usePropertyOS(countEnabled);

  const scrollY = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((e) => {
    scrollY.value = e.contentOffset.y;
  });

  const load = async () => {
    try {
      const [briefResult, execResult, sensorsResult, notifResult] = await Promise.allSettled([
        api.briefing(),
        fetchExecutiveCached(),
        api.sensors(),
        api.notifications(),
      ]);
      const baseBrief = briefResult.status === 'fulfilled' ? briefResult.value : EMPTY_BRIEFING;
      const exec = execResult.status === 'fulfilled' ? execResult.value : null;
      const sensors = sensorsResult.status === 'fulfilled' ? sensorsResult.value : [];
      const alerts = sensors.filter((s) => s.status !== 'nominal').slice(0, 3);
      if (exec) {
        setBriefing(mergeBriefingWithExecutive(baseBrief, exec, alerts));
      } else {
        setBriefing(baseBrief);
      }
      if (notifResult.status === 'fulfilled') {
        const sorted = [...notifResult.value].sort((a, b) => {
          if (a.priority === 'high' && b.priority !== 'high') return -1;
          if (b.priority === 'high' && a.priority !== 'high') return 1;
          return 0;
        });
        setNotifications(sorted);
      }
    } catch {
      // Briefing unavailable — alive empty guides the owner.
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    (async () => {
      const done = await storage.getItem<boolean>('spp.onboarded', false);
      if (!done) {
        router.replace('/onboarding');
        return;
      }
      load();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onRefresh = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setRefreshing(true);
    clearExecutiveCache();
    load();
  };

  return (
    <View style={styles.root} testID="ai-employee-home">
      <StatusBar style="light" />
      <AmbientBackground scrollY={scrollY} />

      {loading && !briefing ? (
        <View style={[styles.loading, { paddingTop: insets.top + wsPad.paddingTop }]}>
          <BrandOrb size={64} />
          <Wordmark size="sm" color={colors.textMuted} />
          <Text style={styles.loadingText}>{t('home.loading')}</Text>
        </View>
      ) : (
        <AnimatedScroll
          testID="home-scroll"
          onScroll={onScroll}
          scrollEventThrottle={16}
          contentContainerStyle={[
            styles.scroll,
            {
              paddingTop: insets.top + wsPad.paddingTop + spacing.md,
              paddingBottom: insets.bottom + wsPad.paddingBottom + spacing['2xl'],
              paddingRight: wsPad.paddingRight + spacing.lg,
            },
          ]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.gold}
            />
          }
        >
          {!briefing && !loading ? (
            <>
              <SetupProgressBar testID="home-setup-progress" />
              <AliveEmpty
                title={t('alive.home.title')}
                body={t('alive.home.body')}
                nextHint={!osState.property
                  ? t('journey.home.nextSetup' as any)
                  : t('journey.home.nextUpload' as any)}
                actionLabel={!osState.property
                  ? t('pos.progress.continue')
                  : t('alive.home.action')}
                onAction={() => router.push(
                  (!osState.property
                    ? (nextPhase ? phaseRoute(nextPhase) : '/setup/property-os')
                    : '/upload') as any,
                )}
                testID="home-alive-empty"
              />
            </>
          ) : (
            <>
              <SetupProgressBar testID="home-setup-progress-live" />
              <HomeCommandCenter
                briefing={briefing}
                notifications={notifications}
              />
            </>
          )}

          <View style={styles.quickAccess}>
            <HomeShortcuts
              items={QUICK_ACCESS}
              compact
              delay={260}
              testID="home-quick-access"
            />
          </View>

          <Animated.View entering={FadeIn.duration(700).delay(900)} style={styles.footer}>
            <View style={styles.footerLine} />
            <Text style={styles.footerText}>{t('home.footer')}</Text>
            <Text style={styles.buildStamp} testID="ux-build-stamp">{UX_BUILD_STAMP}</Text>
          </Animated.View>
        </AnimatedScroll>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  loading: {
    flex: 1, alignItems: 'center', justifyContent: 'center', gap: 24,
  },
  loadingText: {
    color: colors.textMuted, fontSize: typography.small, letterSpacing: 1.2,
    textTransform: 'uppercase', fontWeight: typography.weight.medium,
  },
  scroll: {
    paddingHorizontal: spacing.lg,
  },
  quickAccess: {
    marginTop: spacing.xl,
  },
  footer: {
    marginTop: spacing['2xl'],
    alignItems: 'center',
    gap: spacing.md,
  },
  footerLine: {
    width: 40, height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
  },
  footerText: {
    color: colors.textSubtle,
    fontSize: 10.5,
    letterSpacing: 2,
    textTransform: 'uppercase',
    fontWeight: typography.weight.medium,
  },
  buildStamp: {
    color: colors.gold,
    fontSize: 10,
    letterSpacing: 0.6,
    marginTop: 6,
    fontVariant: ['tabular-nums'],
  },
});
