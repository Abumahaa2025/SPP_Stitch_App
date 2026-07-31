#!/usr/bin/env node
/**
 * After `expo prebuild`, ensure release APK is installable without an EAS keystore
 * by signing with the debug keystore (beta / CI only).
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const gradlePath = path.join(root, 'android', 'app', 'build.gradle');

if (!fs.existsSync(gradlePath)) {
  console.error('Missing', gradlePath, '— run expo prebuild first');
  process.exit(1);
}

let src = fs.readFileSync(gradlePath, 'utf8');

if (/buildTypes\s*\{[\s\S]*?release\s*\{[\s\S]*?signingConfig\s+signingConfigs\.debug/.test(src)) {
  console.log('Release already uses debug signingConfig');
  process.exit(0);
}

if (!/signingConfigs\s*\{\s*debug\s*\{/.test(src) && !/signingConfigs\s*\{[\s\S]*debug\s*\{/.test(src)) {
  console.error('No debug signingConfigs block found in', gradlePath);
  process.exit(1);
}

const patched = src.replace(
  /(release\s*\{)(?![\s\S]*?signingConfig\s+signingConfigs\.debug)/,
  '$1\n            signingConfig signingConfigs.debug',
);

if (patched === src) {
  // Fallback: inject after first "release {"
  const idx = src.indexOf('release {');
  if (idx < 0) {
    console.error('Could not find release { block');
    process.exit(1);
  }
  const insertAt = idx + 'release {'.length;
  src = `${src.slice(0, insertAt)}\n            signingConfig signingConfigs.debug${src.slice(insertAt)}`;
  fs.writeFileSync(gradlePath, src);
} else {
  fs.writeFileSync(gradlePath, patched);
}

console.log('Patched release signingConfig → signingConfigs.debug');
