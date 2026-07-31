import type React from 'react';
import type { Feather } from '@expo/vector-icons';
import type { SourceApp } from '@/src/utils/source-web';

type FeatherIcon = React.ComponentProps<typeof Feather>['name'];

export type DirectoryActionKind = 'view' | 'add' | 'send' | 'report' | 'analyze' | 'follow';

export type DirectoryAction = {
  key: string;
  kind: DirectoryActionKind;
  labelKey: string;
  icon: FeatherIcon;
  route?: string;
  sourceApp?: SourceApp;
};

export type DirectoryGroup = {
  key: string;
  titleKey: string;
  hintKey: string;
  icon: FeatherIcon;
  accent?: 'gold' | 'emerald';
  defaultOpen?: boolean;
  actions: DirectoryAction[];
};

export type HomeShortcut = {
  key: string;
  labelKey: string;
  icon: FeatherIcon;
  route?: string;
  anchor?: 'priorities';
  accent?: 'gold' | 'emerald';
};

export const HOME_SHORTCUTS: HomeShortcut[] = [
  { key: 'today', labelKey: 'org.short.today', icon: 'sun', anchor: 'priorities', accent: 'gold' },
  { key: 'upload', labelKey: 'org.short.upload', icon: 'upload-cloud', route: '/upload', accent: 'gold' },
  { key: 'properties', labelKey: 'org.short.properties', icon: 'home', route: '/portfolio' },
  /** Figma UX strip — portfolio tile (pulse icon + المحفظة label). */
  { key: 'portfolio', labelKey: 'more.portfolio', icon: 'activity', route: '/portfolio', accent: 'gold' },
  { key: 'contracts', labelKey: 'org.short.contracts', icon: 'file-text', route: '/contracts' },
  { key: 'maintenance', labelKey: 'org.short.maintenance', icon: 'tool', route: '/maintenance', accent: 'gold' },
  { key: 'reports', labelKey: 'org.short.reports', icon: 'bar-chart-2', route: '/reports', accent: 'gold' },
  { key: 'settings', labelKey: 'org.short.settings', icon: 'settings', route: '/settings' },
  { key: 'ask', labelKey: 'org.short.ask', icon: 'message-circle', route: '/brain', accent: 'gold' },
];

/** Expandable groups — maps every existing screen and Source portal. */
export const HOME_DIRECTORY: DirectoryGroup[] = [
  {
    key: 'properties',
    titleKey: 'org.group.properties',
    hintKey: 'org.group.properties.hint',
    icon: 'home',
    accent: 'gold',
    defaultOpen: true,
    actions: [
      { key: 'portfolio', kind: 'view', labelKey: 'org.properties.portfolio', icon: 'layers', route: '/portfolio' },
      { key: 'health', kind: 'follow', labelKey: 'org.properties.health', icon: 'heart', route: '/health' },
      { key: 'sensors', kind: 'view', labelKey: 'org.properties.sensors', icon: 'activity', route: '/sensors', sourceApp: 'koil' },
      { key: 'owner', kind: 'view', labelKey: 'org.properties.owner', icon: 'user', route: '/owner', sourceApp: 'owner' },
      { key: 'intelligence', kind: 'analyze', labelKey: 'org.properties.intelligence', icon: 'zap', route: '/intelligence' },
    ],
  },
  {
    key: 'tenants',
    titleKey: 'org.group.tenants',
    hintKey: 'org.group.tenants.hint',
    icon: 'users',
    actions: [
      { key: 'list', kind: 'view', labelKey: 'org.tenants.list', icon: 'users', route: '/tenants' },
      { key: 'portal', kind: 'view', labelKey: 'org.tenants.portal', icon: 'external-link', route: '/tenants', sourceApp: 'tenant' },
      { key: 'add', kind: 'add', labelKey: 'org.tenants.add', icon: 'plus-circle', route: '/upload' },
      { key: 'send', kind: 'send', labelKey: 'org.tenants.send', icon: 'message-circle', route: '/support' },
    ],
  },
  {
    key: 'contracts',
    titleKey: 'org.group.contracts',
    hintKey: 'org.group.contracts.hint',
    icon: 'file-text',
    actions: [
      { key: 'list', kind: 'view', labelKey: 'org.contracts.list', icon: 'file-text', route: '/contracts' },
      { key: 'add', kind: 'add', labelKey: 'org.contracts.add', icon: 'plus-circle', route: '/upload' },
      { key: 'follow', kind: 'follow', labelKey: 'org.contracts.follow', icon: 'clock', route: '/contracts' },
      { key: 'report', kind: 'report', labelKey: 'org.contracts.report', icon: 'bar-chart-2', route: '/reports', sourceApp: 'koil' },
    ],
  },
  {
    key: 'maintenance',
    titleKey: 'org.group.maintenance',
    hintKey: 'org.group.maintenance.hint',
    icon: 'tool',
    accent: 'emerald',
    defaultOpen: true,
    actions: [
      { key: 'list', kind: 'view', labelKey: 'org.maintenance.list', icon: 'tool', route: '/maintenance' },
      { key: 'follow', kind: 'follow', labelKey: 'org.maintenance.follow', icon: 'bell', route: '/notifications', sourceApp: 'koil' },
      { key: 'technician', kind: 'send', labelKey: 'org.maintenance.technician', icon: 'send', route: '/maintenance', sourceApp: 'technician' },
      { key: 'add', kind: 'add', labelKey: 'org.maintenance.add', icon: 'plus-circle', route: '/upload' },
    ],
  },
  {
    key: 'finance',
    titleKey: 'org.group.finance',
    hintKey: 'org.group.finance.hint',
    icon: 'dollar-sign',
    accent: 'gold',
    actions: [
      { key: 'reports', kind: 'report', labelKey: 'org.finance.reports', icon: 'file-text', route: '/reports', sourceApp: 'koil' },
      { key: 'insights', kind: 'analyze', labelKey: 'org.finance.insights', icon: 'trending-up', route: '/insights' },
      { key: 'billing', kind: 'view', labelKey: 'org.finance.billing', icon: 'credit-card', route: '/billing' },
      { key: 'portfolio', kind: 'view', labelKey: 'org.finance.performance', icon: 'pie-chart', route: '/portfolio' },
    ],
  },
  {
    key: 'upload',
    titleKey: 'org.group.upload',
    hintKey: 'org.group.upload.hint',
    icon: 'upload-cloud',
    accent: 'gold',
    defaultOpen: true,
    actions: [
      { key: 'upload', kind: 'add', labelKey: 'org.upload.single', icon: 'upload', route: '/upload' },
      { key: 'bulk', kind: 'add', labelKey: 'org.upload.bulk', icon: 'upload-cloud', route: '/upload', sourceApp: 'koil' },
      { key: 'analyze', kind: 'analyze', labelKey: 'org.upload.analyze', icon: 'message-circle', route: '/brain' },
      { key: 'memory', kind: 'analyze', labelKey: 'org.upload.memory', icon: 'database', route: '/memory' },
    ],
  },
  {
    key: 'messages',
    titleKey: 'org.group.messages',
    hintKey: 'org.group.messages.hint',
    icon: 'message-circle',
    accent: 'emerald',
    actions: [
      { key: 'alerts', kind: 'follow', labelKey: 'org.messages.alerts', icon: 'bell', route: '/notifications', sourceApp: 'koil' },
      { key: 'whatsapp', kind: 'send', labelKey: 'org.messages.whatsapp', icon: 'message-circle', route: '/support' },
      { key: 'support', kind: 'send', labelKey: 'org.messages.support', icon: 'headphones', route: '/support' },
    ],
  },
  {
    key: 'settings',
    titleKey: 'org.group.settings',
    hintKey: 'org.group.settings.hint',
    icon: 'settings',
    actions: [
      { key: 'settings', kind: 'view', labelKey: 'org.settings.app', icon: 'settings', route: '/settings', sourceApp: 'settings' },
      { key: 'billing', kind: 'view', labelKey: 'org.settings.billing', icon: 'credit-card', route: '/billing' },
      { key: 'profile', kind: 'view', labelKey: 'org.settings.profile', icon: 'user', route: '/profile' },
      { key: 'guides', kind: 'view', labelKey: 'org.settings.guides', icon: 'book-open', route: '/guides' },
    ],
  },
  {
    key: 'privacy',
    titleKey: 'org.group.privacy',
    hintKey: 'org.group.privacy.hint',
    icon: 'shield',
    actions: [
      { key: 'privacy', kind: 'view', labelKey: 'org.privacy.policy', icon: 'shield', route: '/privacy' },
      { key: 'terms', kind: 'view', labelKey: 'org.privacy.terms', icon: 'file', route: '/terms' },
      { key: 'about', kind: 'view', labelKey: 'org.privacy.about', icon: 'info', route: '/about' },
      { key: 'profile', kind: 'view', labelKey: 'org.privacy.account', icon: 'user', route: '/profile' },
    ],
  },
];
