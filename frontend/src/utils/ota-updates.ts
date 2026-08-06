/**
 * EAS Update (OTA) — deliver JS/TS changes to installed beta APKs
 * without new download links (same idea as tafriz live web deploy).
 *
 * Native/plugin changes still require one new APK; keep expo.version
 * stable for JS-only work so runtimeVersion (appVersion policy) matches.
 */
import { Platform } from 'react-native';
import * as Updates from 'expo-updates';

export type OtaCheckResult = {
  checked: boolean;
  updated: boolean;
  reason?: string;
};

export async function applySilentOtaUpdate(): Promise<OtaCheckResult> {
  if (Platform.OS === 'web') {
    return { checked: false, updated: false, reason: 'web' };
  }
  if (__DEV__ || !Updates.isEnabled) {
    return { checked: false, updated: false, reason: 'dev_or_disabled' };
  }

  try {
    const probe = await Updates.checkForUpdateAsync();
    if (!probe.isAvailable) {
      return { checked: true, updated: false, reason: 'up_to_date' };
    }
    const fetched = await Updates.fetchUpdateAsync();
    if (!fetched.isNew) {
      return { checked: true, updated: false, reason: 'no_new_bundle' };
    }
    await Updates.reloadAsync();
    return { checked: true, updated: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { checked: true, updated: false, reason: message };
  }
}
