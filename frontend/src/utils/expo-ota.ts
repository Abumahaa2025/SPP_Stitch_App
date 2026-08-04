/**
 * EAS Update (OTA) — pull JS bundle updates without reinstalling the APK.
 * Channel must match eas.json preview profile (`beta`).
 */
import * as Updates from 'expo-updates';

export async function applyExpoOtaIfAvailable(): Promise<void> {
  if (__DEV__) return;
  try {
    const update = await Updates.checkForUpdateAsync();
    if (!update.isAvailable) return;
    await Updates.fetchUpdateAsync();
    await Updates.reloadAsync();
  } catch {
    /* offline or misconfigured channel — native build still works */
  }
}
