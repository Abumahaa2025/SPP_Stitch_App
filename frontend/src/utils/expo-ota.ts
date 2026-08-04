/**
 * EAS Update (OTA) — pull JS bundle updates without reinstalling the APK.
 * Native builds must embed channel `beta` via app.json updates.requestHeaders
 * (`expo-channel-name`) so checkForUpdateAsync hits the same channel as
 * `eas update --channel beta`.
 */
import * as Updates from 'expo-updates';

let inFlight: Promise<void> | null = null;

export async function applyExpoOtaIfAvailable(): Promise<void> {
  if (__DEV__) return;
  if (!Updates.isEnabled) return;
  if (inFlight) return inFlight;

  inFlight = (async () => {
    try {
      const result = await Updates.checkForUpdateAsync();
      if (!result.isAvailable) return;
      const fetched = await Updates.fetchUpdateAsync();
      if (fetched.isNew) {
        await Updates.reloadAsync();
      }
    } catch {
      /* offline / channel mismatch — embedded bundle still runs */
    } finally {
      inFlight = null;
    }
  })();

  return inFlight;
}
