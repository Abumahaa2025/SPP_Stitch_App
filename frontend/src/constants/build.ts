/**
 * Visible build stamp — always mirrors expo.version from app.json / native config.
 * Do not hardcode old versions (that made testers think they were still on 1.0.38).
 */
import Constants from 'expo-constants';
import appJson from '../../app.json';

const fromNative =
  Constants.expoConfig?.version ||
  Constants.nativeAppVersion ||
  (appJson as { expo?: { version?: string } })?.expo?.version ||
  '0.0.0';

export const APP_VERSION = String(fromNative);

/** Shown on Home / Upload — e.g. beta-1.0.40 */
export const UX_BUILD_STAMP = `beta-${APP_VERSION}`;
