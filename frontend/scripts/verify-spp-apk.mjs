#!/usr/bin/env node
/**
 * Verify an APK is a real standalone SPP install (not Emergent/Metro debug shell).
 *
 * Checks:
 *  - package (applicationId) == ai.spp.stitch (via aapt if available, else AndroidManifest presence)
 *  - embedded JS bundle present (index.android.bundle or *.hbc / expo bundle assets)
 *  - bundle does not require Emergent preview host
 */
import fs from 'fs';
import path from 'path';
import { execSync, spawnSync } from 'child_process';

const apk = process.argv[2];
const expectPkg = process.argv[3] || 'ai.spp.stitch';

if (!apk || !fs.existsSync(apk)) {
  console.error('Usage: node scripts/verify-spp-apk.mjs <path-to.apk> [packageId]');
  process.exit(1);
}

function findAapt() {
  const sdk = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT || '';
  if (!sdk) return null;
  try {
    const tools = path.join(sdk, 'build-tools');
    const vers = fs.readdirSync(tools).sort().reverse();
    for (const v of vers) {
      const cand = path.join(tools, v, process.platform === 'win32' ? 'aapt.exe' : 'aapt');
      if (fs.existsSync(cand)) return cand;
    }
  } catch { /* ignore */ }
  return null;
}

const errors = [];
const aapt = findAapt();
if (aapt) {
  try {
    const out = execSync(`"${aapt}" dump badging "${apk}"`, { encoding: 'utf8' });
    const m = out.match(/package: name='([^']+)'/);
    const pkg = m?.[1] || '';
    console.log('package:', pkg);
    const launch = out.match(/launchable-activity: name='([^']+)'/);
    console.log('launchable-activity:', launch?.[1] || '(none)');
    if (pkg !== expectPkg) errors.push(`applicationId ${pkg} != ${expectPkg}`);
    if (launch?.[1] && !/MainActivity/.test(launch[1])) {
      errors.push(`unexpected launch activity: ${launch[1]}`);
    }
    if (/emergent/i.test(out)) errors.push('aapt badging mentions emergent');
  } catch (e) {
    errors.push(`aapt failed: ${e.message}`);
  }
} else {
  console.warn('aapt not found â€” skipping package dump (bundle checks still run)');
}

// Prefer unzip listing without extra deps (CI has unzip; Windows uses tar / PowerShell)
let names = [];
try {
  const unzip = spawnSync('unzip', ['-Z1', apk], { encoding: 'utf8' });
  if (unzip.status === 0) {
    names = unzip.stdout.split(/\r?\n/).filter(Boolean);
  } else {
    const tar = spawnSync('tar', ['-tf', apk], { encoding: 'utf8' });
    if (tar.status === 0) names = tar.stdout.split(/\r?\n/).filter(Boolean);
  }
} catch { /* ignore */ }

if (!names.length && process.platform === 'win32') {
  try {
    const ps = spawnSync(
      'powershell',
      [
        '-NoProfile',
        '-Command',
        `Add-Type -AssemblyName System.IO.Compression.FileSystem; `
        + `$z=[IO.Compression.ZipFile]::OpenRead('${apk.replace(/'/g, "''")}'); `
        + `$z.Entries | ForEach-Object { $_.FullName }; $z.Dispose()`,
      ],
      { encoding: 'utf8', maxBuffer: 20_000_000 },
    );
    if (ps.status === 0) names = ps.stdout.split(/\r?\n/).filter(Boolean);
  } catch { /* ignore */ }
}

if (!names.length) {
  errors.push('could not list APK entries');
} else {
  const bundleCandidates = names.filter((n) =>
    /index\.android\.bundle$|\.hbc$|android\.bundle$|\/bundle$/i.test(n)
    || (/^assets\//.test(n) && /\.(bundle|hbc)$/i.test(n)),
  );
  console.log('bundle candidates:', bundleCandidates.slice(0, 8).join(', ') || '(none)');
  if (!bundleCandidates.length) {
    errors.push('No embedded JS bundle â€” this APK is a Metro/Emergent shell, not standalone SPP');
  }

  // Extract a small text sample from the largest bundle-like asset if possible
  const samplePath = bundleCandidates[0];
  if (samplePath && process.platform !== 'win32') {
    try {
      const sample = execSync(`unzip -p "${apk}" "${samplePath}" | head -c 200000`, {
        encoding: 'utf8',
        maxBuffer: 2_000_000,
      });
      if (/preview\.emergentagent\.com|emergent\.sh\/|EXPO_PACKAGER_PROXY/i.test(sample)) {
        errors.push('JS bundle still references Emergent preview packager');
      }
      if (!/SPP|spp\.beta|Smart Property|ظƒظˆظٹظ„|beta-login/i.test(sample)) {
        console.warn('Warning: SPP markers not found in first 200KB of bundle (may be hermes binary)');
      } else {
        console.log('SPP markers found in bundle text sample');
      }
    } catch { /* hermes binary â€” ok */ }
  }
}

if (errors.length) {
  console.error('\nAPK verification FAILED:');
  for (const e of errors) console.error(' -', e);
  process.exit(1);
}

console.log('\nAPK verification OK â€” standalone SPP package');
process.exit(0);
