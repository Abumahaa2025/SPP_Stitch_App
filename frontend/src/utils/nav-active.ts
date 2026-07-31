/** Which bottom tab should appear active for a given route — Spec §3. */
export function resolveActiveTab(pathname: string): string {
  if (pathname === '/' || pathname === '/index') return 'home';
  if (pathname.startsWith('/brain')) return 'assistant';
  if (pathname.startsWith('/notifications')) return 'notifications';

  // المزيد — reports, connections, settings, help, about, setup, billing
  if (
    pathname.startsWith('/hub')
    || pathname.startsWith('/settings')
    || pathname.startsWith('/setup')
    || pathname.startsWith('/profile')
    || pathname.startsWith('/support')
    || pathname.startsWith('/about')
    || pathname.startsWith('/guides')
    || pathname.startsWith('/upload')
    || pathname.startsWith('/reports')
    || pathname.startsWith('/billing')
    || pathname.startsWith('/operational/services')
  ) return 'more';

  // تشغيل العقار — daily operations
  if (
    pathname.startsWith('/owner')
    || pathname.startsWith('/portfolio')
    || pathname.startsWith('/tenants')
    || pathname.startsWith('/contracts')
    || pathname.startsWith('/maintenance')
    || pathname.startsWith('/operational')
    || pathname.startsWith('/property/')
    || pathname.startsWith('/sensors')
    || pathname.startsWith('/wallet')
    || pathname.startsWith('/health')
  ) return 'operations';

  return 'home';
}
