import type { Persona } from '@/src/services/beta-auth';

/** Paths always allowed for any authenticated persona. */
const SHARED_PREFIXES = [
  '/notifications',
  '/hub',
  '/support',
  '/about',
  '/settings',
  '/profile',
  '/beta-login',
  '/onboarding',
];

function strip(path: string): string {
  return (path || '/').split('?')[0] || '/';
}

/** Spec §13 — tenant / technician must not reach owner ops surfaces. */
export function personaHomeRoute(persona: Persona | string | null | undefined): string {
  if (persona === 'technician') return '/maintenance';
  if (persona === 'tenant') return '/notifications';
  return '/';
}

export function isPathAllowedForPersona(
  persona: Persona | string | null | undefined,
  pathname: string,
): boolean {
  if (!persona || persona === 'owner') return true;
  const path = strip(pathname);

  if (SHARED_PREFIXES.some((p) => path === p || path.startsWith(`${p}/`))) return true;

  if (persona === 'tenant') {
    return (
      path === '/'
      || path.startsWith('/portal/tenant')
      || path === '/brain'
      || path.startsWith('/tenants/')
      || path.startsWith('/roles/accept')
    );
  }

  if (persona === 'technician') {
    return (
      path === '/'
      || path === '/maintenance'
      || path.startsWith('/maintenance/')
      || path.startsWith('/portal/tech')
      || path === '/brain'
      || path.startsWith('/roles/accept')
    );
  }

  return true;
}

/** Map tab keys to safe routes for restricted personas (five tabs stay; destinations adapt). */
export function tabPathForPersona(
  key: string,
  defaultPath: string,
  persona: Persona | string | null | undefined,
): string {
  if (persona === 'technician' && (key === 'home' || key === 'operations')) return '/maintenance';
  if (persona === 'tenant' && (key === 'home' || key === 'operations')) return '/notifications';
  if (!isPathAllowedForPersona(persona, defaultPath)) {
    return personaHomeRoute(persona);
  }
  return defaultPath;
}
