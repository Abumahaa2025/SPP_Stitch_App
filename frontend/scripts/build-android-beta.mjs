#!/usr/bin/env node
/**
 * Build installable Android APK for external beta testers (EAS preview profile).
 * Reads EXPO_PUBLIC_* from .env.beta — never uses LAN IPs.
 *
 * Prerequisites:
 *   1. Render beta API live (SPP_BETA_MODE=true)
 *   2. frontend/.env.beta with EXPO_PUBLIC_BACKEND_URL=https://....onrender.com
 *   3. eas login  OR  EXPO_TOKEN set
 *
 * Usage:
 *   node scripts/build-android-beta.mjs
 *   node scripts/build-android-beta.mjs --non-interactive
 */
import { spawnSync } from 'child_process';
import { existsSync, readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const betaEnvPath = path.join(root, '.env.beta');

function parseEnv(filePath) {
  if (!existsSync(filePath)) return {};
  const out = {};
  for (const line of readFileSync(filePath, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const i = trimmed.indexOf('=');
    if (i < 1) continue;
    const key = trimmed.slice(0, i).trim();
    let val = trimmed.slice(i + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    out[key] = val;
  }
  return out;
}

const beta = parseEnv(betaEnvPath);
const backendUrl = beta.EXPO_PUBLIC_BACKEND_URL || process.env.EXPO_PUBLIC_BACKEND_URL || '';
const betaMode = beta.EXPO_PUBLIC_BETA_MODE || 'true';

const bad =
  !backendUrl ||
  backendUrl.includes('YOUR-BETA-API') ||
  backendUrl.includes('example.com') ||
  backendUrl.includes('127.0.0.1') ||
  backendUrl.includes('192.168.') ||
  backendUrl.includes('localhost');

if (bad) {
  console.error('\n❌ Set a public Render URL in frontend/.env.beta before building:\n');
  console.error('   EXPO_PUBLIC_BETA_MODE=true');
  console.error('   EXPO_PUBLIC_BACKEND_URL=https://YOUR-SERVICE.onrender.com\n');
  process.exit(1);
}

console.log('\n📦 SPP Android Beta APK build');
console.log(`   Backend: ${backendUrl}`);
console.log(`   Beta mode: ${betaMode}`);

let appVersion = 'unknown';
try {
  const appJson = JSON.parse(readFileSync(path.join(root, 'app.json'), 'utf8'));
  appVersion = appJson.expo?.version ?? appVersion;
} catch { /* ignore */ }
console.log(`   App version: ${appVersion}`);
console.log('   EAS quota exhausted? Use GitHub Actions: Beta APK — GitHub (no EAS quota)\n');

const args = ['eas-cli', 'build', '-p', 'android', '--profile', 'preview'];
if (process.argv.includes('--non-interactive')) args.push('--non-interactive');

const env = {
  ...process.env,
  EXPO_PUBLIC_BETA_MODE: betaMode,
  EXPO_PUBLIC_BACKEND_URL: backendUrl.replace(/\/$/, ''),
};

const result = spawnSync('npx', args, { cwd: root, stdio: 'inherit', env, shell: true });
process.exit(result.status ?? 1);
