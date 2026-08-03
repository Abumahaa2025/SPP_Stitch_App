import { Stack, useRouter, usePathname } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import * as Localization from "expo-localization";
import { useEffect, useState } from "react";
import { LogBox, Platform, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import * as Linking from "expo-linking";

import { useIconFonts } from "@/src/hooks/use-icon-fonts";
import { setLang } from "@/src/i18n";
import { storage } from "@/src/utils/storage";
import { SplashIntro } from "@/src/components/SplashIntro";
import { WorkspaceProvider } from "@/src/context/WorkspaceContext";
import { WorkspaceChrome } from "@/src/components/WorkspaceChrome";
import { isPathAllowedForPersona, personaHomeRoute } from "@/src/utils/role-scope";
import { resolvePortalInAppFromUrl } from "@/src/utils/portal-links";
import { applySilentOtaUpdate } from "@/src/utils/ota-updates";

LogBox.ignoreAllLogs(true);

SplashScreen.preventAutoHideAsync();

/**
 * Detects the language SPP should start in when the user has NOT yet
 * expressed an explicit preference (`spp.lang` unset).
 *
 * Rule (per user directive):
 *   · If the device locale starts with `ar` (any Arabic script variant),
 *     open in Arabic + RTL.
 *   · Otherwise fall back to English.
 *   · Any saved user preference always wins — this helper is only
 *     consulted when there is no stored preference.
 */
function detectDeviceLang(): 'ar' | 'en' {
  try {
    const locales = Localization.getLocales?.() ?? [];
    // Newer API returns a list; older API exposes .locale as a string.
    const first = locales[0]?.languageTag ?? (Localization as any).locale ?? '';
    if (typeof first === 'string' && first.toLowerCase().startsWith('ar')) return 'ar';
  } catch {
    /* fall through */
  }
  return 'en';
}

/**
 * Root layout — enforces the cold-start ritual:
 *   1. Load fonts + restore language.
 *   2. Show SPP Intro (BrandOrb + Wordmark + tagline) for at least 1.4s.
 *   3. Route the app to `/` (or `/onboarding` for first-launch) — never
 *      the last visited screen.
 *   4. Fade the intro out to reveal Home.
 */
export default function RootLayout() {
  const [loaded, error] = useIconFonts();
  const [langReady, setLangReady] = useState(false);
  const [minHoldElapsed, setMinHoldElapsed] = useState(false);
  const [routed, setRouted] = useState(false);
  const [introDone, setIntroDone] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  // Restore language before rendering any screen.
  //   1. Any explicit user preference (`spp.lang`) always wins — never override.
  //   2. Otherwise, detect device locale via expo-localization (Arabic → RTL).
  useEffect(() => {
    (async () => {
      const saved = await storage.getItem<'en' | 'ar' | null>('spp.lang', null);
      const chosen: 'en' | 'ar' = saved === 'en' || saved === 'ar'
        ? saved
        : detectDeviceLang();
      setLang(chosen);
      setLangReady(true);
    })();
  }, []);

  // Enforce a minimum splash hold for brand presence (~2s logo entrance).
  useEffect(() => {
    const t = setTimeout(() => setMinHoldElapsed(true), 2000);
    return () => clearTimeout(t);
  }, []);

  // Hide the native splash the moment fonts + i18n are ready.
  useEffect(() => {
    if ((loaded || error) && langReady) SplashScreen.hideAsync();
  }, [loaded, error, langReady]);

  // Silent OTA (EAS Update) — JS changes reach the phone without new APK links.
  useEffect(() => {
    if (!langReady || !(loaded || error)) return;
    void applySilentOtaUpdate();
  }, [langReady, loaded, error]);

  // Cold-start routing: beta login → onboarding → home
  //
  // Deep-link allowlist (Batch 2 · role-portal fix):
  // Portal QR links (/portal/agent, /portal/tech, /portal/tenant) and a
  // handful of always-linkable info screens must survive cold start —
  // otherwise a shared portal URL bounces the guest to the owner's home.
  useEffect(() => {
    if (routed) return;
    if (!langReady || !(loaded || error)) return;
    (async () => {
      const betaMode = process.env.EXPO_PUBLIC_BETA_MODE === 'true';
      const betaAuthed = await storage.getItem<boolean>('spp.betaAuthed', false);
      const onboarded = await storage.getItem<boolean>('spp.onboarded', false);
      const persona = await storage.getItem<string>('spp.betaPersona', '');

      let initialUrl: string | null = null;
      try {
        initialUrl = await Linking.getInitialURL();
      } catch {
        initialUrl = null;
      }

      // Share sheet opens MainActivity with ACTION_SEND — land on Upload
      let openedFromShare = false;
      if (Platform.OS === 'android') {
        openedFromShare = !!(initialUrl && /send|content:|file:/i.test(initialUrl));
      }

      const portalFromUrl = initialUrl ? resolvePortalInAppFromUrl(initialUrl) : null;

      const isDeepLink =
        pathname.startsWith('/portal/') ||
        pathname.startsWith('/roles/accept') ||
        pathname === '/upload' ||
        !!portalFromUrl ||
        ['/support', '/about', '/billing', '/privacy', '/terms'].includes(pathname);

      if (portalFromUrl && !pathname.startsWith('/portal/')) {
        router.replace(portalFromUrl as any);
        setRouted(true);
        return;
      }

      let target = '/';
      if (betaMode && !betaAuthed && !isDeepLink) {
        target = '/beta-login';
      } else if (!onboarded && !isDeepLink) {
        target = '/onboarding';
      } else if (persona === 'technician') {
        target = '/maintenance';
      } else if (persona === 'tenant') {
        target = '/notifications';
      } else if (openedFromShare) {
        target = '/upload';
      }

      if (!isDeepLink && pathname !== target) router.replace(target as any);
      setRouted(true);
    })();
  }, [langReady, loaded, error, routed, pathname, router]);

  // Runtime deep links (WhatsApp / browser → app)
  useEffect(() => {
    const onUrl = ({ url }: { url: string }) => {
      const route = resolvePortalInAppFromUrl(url);
      if (route) router.push(route as any);
    };
    const sub = Linking.addEventListener('url', onUrl);
    return () => sub.remove();
  }, [router]);

  // Spec §13 — continuous persona allowlist (tenant / technician).
  useEffect(() => {
    if (!routed || !introDone) return;
    let alive = true;
    (async () => {
      const betaAuthed = await storage.getItem<boolean>('spp.betaAuthed', false);
      if (!betaAuthed) return;
      const persona = await storage.getItem<string>('spp.betaPersona', '');
      if (!persona || persona === 'owner') return;
      if (!isPathAllowedForPersona(persona, pathname || '/')) {
        if (alive) router.replace(personaHomeRoute(persona) as any);
      }
    })();
    return () => { alive = false; };
  }, [pathname, routed, introDone, router]);

  // Fade the SPP intro out once everything is ready + min hold has passed.
  const readyForHandoff = langReady && (loaded || error) && minHoldElapsed && routed;
  const [introMounted, setIntroMounted] = useState(true);
  useEffect(() => {
    if (!readyForHandoff) return;
    const t = setTimeout(() => setIntroDone(true), 60);
    return () => clearTimeout(t);
  }, [readyForHandoff]);
  useEffect(() => {
    if (!introDone) return;
    // Give the fade-out animation (~520ms) time to finish before unmounting.
    const t = setTimeout(() => setIntroMounted(false), 700);
    return () => clearTimeout(t);
  }, [introDone]);

  if ((!loaded && !error) || !langReady) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <WorkspaceProvider>
          <View style={{ flex: 1, backgroundColor: '#050A12' }}>
            <Stack
              screenOptions={{
                headerShown: false,
                animation: 'fade_from_bottom',
                animationDuration: 280,
                gestureEnabled: true,
                contentStyle: { backgroundColor: '#050A12' },
              }}
            />
            <WorkspaceChrome />
            {introMounted ? <SplashIntro visible={!introDone} /> : null}
          </View>
        </WorkspaceProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
