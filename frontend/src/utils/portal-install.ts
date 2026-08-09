/**
 * Helpers for installing portal links as home-screen apps (tenant/tech/agent/guard).
 * Web: prefer beforeinstallprompt; otherwise guide Add-to-Home-Screen.
 */
import { Platform, Share, Linking, Alert } from 'react-native';

export type PortalInstallRole = 'tenant' | 'tech' | 'agent' | 'guard';

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

let deferredPrompt: BeforeInstallPromptEvent | null = null;
let listening = false;

/** Capture Chrome/Edge install prompt when available (web only). */
export function ensurePortalInstallListener(): void {
  if (listening || Platform.OS !== 'web' || typeof window === 'undefined') return;
  listening = true;
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e as BeforeInstallPromptEvent;
  });
}

export function hasNativeInstallPrompt(): boolean {
  return Boolean(deferredPrompt);
}

/** Try browser install prompt. Returns true if a prompt was shown. */
export async function promptPortalInstall(): Promise<boolean> {
  ensurePortalInstallListener();
  if (!deferredPrompt) return false;
  const ev = deferredPrompt;
  deferredPrompt = null;
  try {
    await ev.prompt();
    await ev.userChoice;
    return true;
  } catch {
    return false;
  }
}

export function portalInstallSteps(ar: boolean): string[] {
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  const ios = /iPad|iPhone|iPod/i.test(ua) || Platform.OS === 'ios';
  if (ios) {
    return ar
      ? [
        'افتح الرابط في Safari',
        'اضغط مشاركة □↑',
        'اختر «إضافة إلى الشاشة الرئيسية»',
        'افتح الأيقونة من الشاشة الرئيسية كتطبيق',
      ]
      : [
        'Open this link in Safari',
        'Tap Share □↑',
        'Choose “Add to Home Screen”',
        'Open the icon anytime like an app',
      ];
  }
  return ar
    ? [
      'افتح الرابط في Chrome',
      'القائمة ⋮ ← تثبيت التطبيق / إضافة إلى الشاشة الرئيسية',
      'أو اضغط «تنزيل كتطبيق» إن ظهر',
      'افتح الأيقونة من الشاشة الرئيسية لاحقاً',
    ]
    : [
      'Open this link in Chrome',
      'Menu ⋮ → Install app / Add to Home screen',
      'Or tap “Install as app” when shown',
      'Open the icon from your home screen anytime',
    ];
}

/**
 * Owner-side action: open the share URL (so install UI appears) and/or share
 * install instructions with the portal link.
 */
export async function sharePortalInstallLink(opts: {
  url: string;
  roleLabel: string;
  ar: boolean;
  tip: string;
}): Promise<void> {
  const { url, roleLabel, ar, tip } = opts;
  const message = ar
    ? `تنزيل ${roleLabel} كتطبيق على الجوال:\n${url}\n\n${tip}`
    : `Install ${roleLabel} as a phone app:\n${url}\n\n${tip}`;

  try {
    await Share.share({ message, url });
  } catch {
    try {
      await Linking.openURL(url);
    } catch {
      Alert.alert(
        ar ? 'تنزيل كتطبيق' : 'Install as app',
        portalInstallSteps(ar).map((s, i) => `${i + 1}. ${s}`).join('\n'),
      );
    }
  }
}
