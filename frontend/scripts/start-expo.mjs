#!/usr/bin/env node
/**
 * Starts Expo with a stable LAN hostname.
 * Pin EXPO_LAN_HOST in .env so exp:// link stays the same across restarts.
 */
import { spawn } from 'child_process';
import { writeFileSync, readFileSync, existsSync } from 'fs';
import { networkInterfaces } from 'os';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const linkOnly = process.argv.includes('--link-only');

function readDotEnv() {
  const envPath = path.join(root, '.env');
  if (!existsSync(envPath)) return {};
  const out = {};
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
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

function detectLanHost() {
  const fileEnv = readDotEnv();
  const pinned = process.env.EXPO_LAN_HOST || fileEnv.EXPO_LAN_HOST;
  if (pinned) return pinned;

  const candidates = [];
  for (const name of Object.keys(networkInterfaces())) {
    const lower = name.toLowerCase();
    if (lower.includes('virtual') || lower.includes('vmware') || lower.includes('vethernet')) continue;
    for (const iface of networkInterfaces()[name] || []) {
      if (iface.family !== 'IPv4' || iface.internal) continue;
      const ip = iface.address;
      if (ip.startsWith('169.254.')) continue;
      if (ip.startsWith('192.168.56.')) continue;
      candidates.push({ ip, name });
    }
  }
  const home = candidates.find((c) => c.ip.startsWith('192.168.1.'));
  if (home) return home.ip;
  const wifi = candidates.find((c) => /wi-?fi|wlan|wireless/i.test(c.name));
  if (wifi) return wifi.ip;
  return candidates[0]?.ip || '127.0.0.1';
}

function writeLinkFile(host, port) {
  const link = `exp://${host}:${port}`;
  const lines = [
    link,
    '',
    'SPP — رابط Expo Go الثابت',
    'Stable Expo Go link (while EXPO_LAN_HOST + port stay the same)',
    '',
    'Arabic:',
    '  1) ثبّت EXPO_LAN_HOST في ملف .env (مثال: 192.168.1.104)',
    '  2) شغّل: npm start',
    '  3) في Expo Go: Recent → frontend (أو الصق الرابط أعلاه)',
    '',
    'English:',
    '  1) Set EXPO_LAN_HOST in .env to your PC LAN IP',
    '  2) Run: npm start',
    '  3) In Expo Go: Recent → frontend',
    '',
    `Host: ${host}`,
    `Port: ${port}`,
    `Updated: ${new Date().toISOString()}`,
    '',
  ];
  writeFileSync(path.join(root, 'EXPO_LINK.txt'), lines.join('\n'), 'utf8');
  return link;
}

const fileEnv = readDotEnv();
const port = process.env.EXPO_PORT || fileEnv.EXPO_PORT || '8081';
const host = detectLanHost();
const link = writeLinkFile(host, port);

console.log('\n══════════════════════════════════════');
console.log('  SPP Expo Go');
console.log(`  ${link}`);
console.log('  → frontend/EXPO_LINK.txt');
if (!fileEnv.EXPO_LAN_HOST && !process.env.EXPO_LAN_HOST) {
  console.log('  Tip: add EXPO_LAN_HOST to .env to lock this IP');
}
console.log('══════════════════════════════════════\n');

if (linkOnly) process.exit(0);

const userArgs = process.argv.slice(2).filter((a) => a !== '--link-only');
const hasTunnel = userArgs.includes('--tunnel');
const expoArgs = ['expo', 'start', '--port', port, ...(hasTunnel ? ['--tunnel'] : ['--lan']), ...userArgs.filter((a) => a !== '--tunnel')];

const child = spawn('npx', expoArgs, {
  cwd: root,
  env: {
    ...process.env,
    REACT_NATIVE_PACKAGER_HOSTNAME: host,
    EXPO_DEVTOOLS_LISTEN_ADDRESS: '0.0.0.0',
  },
  stdio: 'inherit',
  shell: true,
});

child.on('exit', (code) => process.exit(code ?? 0));
