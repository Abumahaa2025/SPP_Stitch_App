export type ManagerKey =
  | 'property'
  | 'tenant'
  | 'contract'
  | 'financial'
  | 'maintenance'
  | 'memory'
  | 'advisor'
  | 'performance'
  | 'documents'
  | 'assistant';

export type ManagerDef = {
  key: ManagerKey;
  emoji: string;
  route: string;
  titleKey: string;
  roleKey: string;
  proactiveKey: string;
  actionKey: string;
  featured?: boolean;
};

/** SPP Operating System — managers, not modules. */
export const OS_MANAGERS: ManagerDef[] = [
  {
    key: 'assistant',
    emoji: '🤖',
    route: '/brain',
    titleKey: 'os.manager.assistant',
    roleKey: 'os.role.assistant',
    proactiveKey: 'os.proactive.assistant',
    actionKey: 'os.action.assistant',
    featured: true,
  },
  {
    key: 'property',
    emoji: '🏠',
    route: '/portfolio',
    titleKey: 'os.manager.property',
    roleKey: 'os.role.property',
    proactiveKey: 'os.proactive.property',
    actionKey: 'os.action.property',
  },
  {
    key: 'tenant',
    emoji: '👥',
    route: '/tenants',
    titleKey: 'os.manager.tenant',
    roleKey: 'os.role.tenant',
    proactiveKey: 'os.proactive.tenant',
    actionKey: 'os.action.tenant',
  },
  {
    key: 'contract',
    emoji: '📑',
    route: '/contracts',
    titleKey: 'os.manager.contract',
    roleKey: 'os.role.contract',
    proactiveKey: 'os.proactive.contract',
    actionKey: 'os.action.contract',
  },
  {
    key: 'financial',
    emoji: '💰',
    route: '/insights',
    titleKey: 'os.manager.financial',
    roleKey: 'os.role.financial',
    proactiveKey: 'os.proactive.financial',
    actionKey: 'os.action.financial',
  },
  {
    key: 'maintenance',
    emoji: '🔧',
    route: '/maintenance',
    titleKey: 'os.manager.maintenance',
    roleKey: 'os.role.maintenance',
    proactiveKey: 'os.proactive.maintenance',
    actionKey: 'os.action.maintenance',
  },
  {
    key: 'memory',
    emoji: '📚',
    route: '/memory',
    titleKey: 'os.manager.memory',
    roleKey: 'os.role.memory',
    proactiveKey: 'os.proactive.memory',
    actionKey: 'os.action.memory',
  },
  {
    key: 'advisor',
    emoji: '🧠',
    route: '/intelligence',
    titleKey: 'os.manager.advisor',
    roleKey: 'os.role.advisor',
    proactiveKey: 'os.proactive.advisor',
    actionKey: 'os.action.advisor',
  },
  {
    key: 'performance',
    emoji: '📈',
    route: '/health',
    titleKey: 'os.manager.performance',
    roleKey: 'os.role.performance',
    proactiveKey: 'os.proactive.performance',
    actionKey: 'os.action.performance',
  },
  {
    key: 'documents',
    emoji: '📷',
    route: '/upload',
    titleKey: 'os.manager.documents',
    roleKey: 'os.role.documents',
    proactiveKey: 'os.proactive.documents',
    actionKey: 'os.action.documents',
    featured: true,
  },
];

export const HOME_MANAGERS = OS_MANAGERS.filter((m) => m.key !== 'assistant');
