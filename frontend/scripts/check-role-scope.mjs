/**
 * Spec navigation / role-scope smoke checks (mirrors role-scope.ts rules).
 * Run: node frontend/scripts/check-role-scope.mjs
 */

function isPathAllowedForPersona(persona, pathname) {
  const path = (pathname || '/').split('?')[0] || '/';
  if (!persona || persona === 'owner') return true;
  const shared = ['/notifications', '/hub', '/support', '/about', '/settings', '/profile', '/beta-login', '/onboarding'];
  if (shared.some((p) => path === p || path.startsWith(`${p}/`))) return true;
  if (persona === 'tenant') {
    return path === '/' || path.startsWith('/portal/tenant') || path === '/brain';
  }
  if (persona === 'technician') {
    return path === '/' || path === '/maintenance' || path.startsWith('/portal/tech') || path === '/brain';
  }
  return true;
}

function tabPathForPersona(key, defaultPath, persona) {
  if (persona === 'technician' && (key === 'home' || key === 'operations')) return '/maintenance';
  if (persona === 'tenant' && (key === 'home' || key === 'operations')) return '/notifications';
  if (!isPathAllowedForPersona(persona, defaultPath)) {
    if (persona === 'technician') return '/maintenance';
    if (persona === 'tenant') return '/notifications';
  }
  return defaultPath;
}

const cases = [
  ['owner', '/owner', true],
  ['owner', '/contracts', true],
  ['tenant', '/owner', false],
  ['tenant', '/contracts', false],
  ['tenant', '/notifications', true],
  ['tenant', '/portal/tenant?id=1', true],
  ['technician', '/owner', false],
  ['technician', '/maintenance', true],
  ['technician', '/portal/tech?t=x', true],
];

let failed = 0;
for (const [persona, path, expected] of cases) {
  const got = isPathAllowedForPersona(persona, path);
  if (got !== expected) {
    console.error(`FAIL allow ${persona} ${path}: got ${got} expected ${expected}`);
    failed += 1;
  }
}

const tabCases = [
  ['technician', 'operations', '/owner', '/maintenance'],
  ['tenant', 'home', '/', '/notifications'],
  ['owner', 'operations', '/owner', '/owner'],
];
for (const [persona, key, def, expected] of tabCases) {
  const got = tabPathForPersona(key, def, persona);
  if (got !== expected) {
    console.error(`FAIL tab ${persona} ${key}: got ${got} expected ${expected}`);
    failed += 1;
  }
}

if (failed) {
  console.error(`role-scope checks failed: ${failed}`);
  process.exit(1);
}
console.log(`role-scope checks passed: ${cases.length + tabCases.length}`);
