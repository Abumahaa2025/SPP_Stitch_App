import type React from 'react';
import type { Feather } from '@expo/vector-icons';
import type { SourceApp } from '@/src/utils/source-web';
import { WORKSPACE_BRAND_ONLY_HEIGHT } from '@/src/constants/chrome';

type FeatherIcon = React.ComponentProps<typeof Feather>['name'];

export type WorkspaceNavItem = {
  key: string;
  labelKey: string;
  descKey: string;
  icon: FeatherIcon;
  tone?: 'gold' | 'emerald' | 'neutral';
  route?: string;
  sourceApp?: SourceApp;
  homeAnchor?: 'brief' | 'priorities' | 'health';
};

export type WorkspaceNavGroup = {
  key: string;
  emoji: string;
  labelKey: string;
  hintKey?: string;
  icon: FeatherIcon;
  tone?: 'gold' | 'emerald' | 'neutral';
  defaultOpen?: boolean;
  /** Smart Property Employee — distinctive assistant section */
  featured?: boolean;
  /** Single tap navigates (e.g. Home) */
  standalone?: boolean;
  standaloneRoute?: string;
  items: WorkspaceNavItem[];
};

/** Permanent SPP system map — matches owner navigation spec. */
export const WORKSPACE_NAV: WorkspaceNavGroup[] = [
  {
    key: 'home',
    emoji: '🏠',
    labelKey: 'ws.group.dashboard',
    hintKey: 'ws.group.dashboard.hint',
    icon: 'home',
    tone: 'gold',
    standalone: true,
    standaloneRoute: '/',
    items: [],
  },
  {
    key: 'manager',
    emoji: '🤖',
    labelKey: 'ws.group.manager',
    hintKey: 'ws.group.manager.hint',
    icon: 'cpu',
    tone: 'gold',
    featured: true,
    defaultOpen: true,
    items: [
      { key: 'ask', labelKey: 'ws.manager.ask', descKey: 'ws.manager.ask.desc', icon: 'message-circle', route: '/brain', tone: 'gold' },
      { key: 'brief', labelKey: 'ws.manager.brief', descKey: 'ws.manager.brief.desc', icon: 'sunrise', homeAnchor: 'brief', route: '/', tone: 'gold' },
      { key: 'decisions', labelKey: 'ws.manager.decisions', descKey: 'ws.manager.decisions.desc', icon: 'check-square', homeAnchor: 'priorities', route: '/', tone: 'emerald' },
      { key: 'recommendations', labelKey: 'ws.manager.recommendations', descKey: 'ws.manager.recommendations.desc', icon: 'target', route: '/intelligence', tone: 'gold' },
      { key: 'action-center', labelKey: 'ws.manager.actionCenter', descKey: 'ws.manager.actionCenter.desc', icon: 'zap', route: '/hub', tone: 'emerald' },
    ],
  },
  {
    key: 'properties',
    emoji: '🏢',
    labelKey: 'ws.group.properties',
    hintKey: 'ws.group.properties.hint',
    icon: 'layers',
    tone: 'emerald',
    items: [
      { key: 'all', labelKey: 'ws.properties.all', descKey: 'ws.properties.all.desc', icon: 'home', route: '/portfolio' },
      { key: 'owner-portal', labelKey: 'ws.properties.ownerPortal', descKey: 'ws.properties.ownerPortal.desc', icon: 'external-link', route: '/owner', sourceApp: 'owner' },
      { key: 'units', labelKey: 'ws.properties.units', descKey: 'ws.properties.units.desc', icon: 'box', route: '/portfolio' },
      { key: 'health', labelKey: 'ws.properties.health', descKey: 'ws.properties.health.desc', icon: 'heart', route: '/health', tone: 'emerald' },
      { key: 'occupancy', labelKey: 'ws.properties.occupancy', descKey: 'ws.properties.occupancy.desc', icon: 'pie-chart', route: '/health' },
    ],
  },
  {
    key: 'tenants',
    emoji: '👥',
    labelKey: 'ws.group.tenants',
    hintKey: 'ws.group.tenants.hint',
    icon: 'users',
    items: [
      { key: 'all', labelKey: 'ws.tenants.all', descKey: 'ws.tenants.all.desc', icon: 'users', route: '/tenants' },
      { key: 'messages', labelKey: 'ws.tenants.messages', descKey: 'ws.tenants.messages.desc', icon: 'mail', route: '/notifications' },
      { key: 'portal', labelKey: 'ws.tenants.portal', descKey: 'ws.tenants.portal.desc', icon: 'external-link', route: '/tenants', sourceApp: 'tenant' },
      { key: 'record', labelKey: 'ws.tenants.record', descKey: 'ws.tenants.record.desc', icon: 'book-open', route: '/tenants' },
    ],
  },
  {
    key: 'contracts',
    emoji: '📑',
    labelKey: 'ws.group.contracts',
    hintKey: 'ws.group.contracts.hint',
    icon: 'file-text',
    tone: 'gold',
    items: [
      { key: 'contracts', labelKey: 'ws.contracts.list', descKey: 'ws.contracts.list.desc', icon: 'file-text', route: '/contracts' },
      { key: 'renewals', labelKey: 'ws.contracts.renewals', descKey: 'ws.contracts.renewals.desc', icon: 'refresh-cw', route: '/contracts' },
      { key: 'collection', labelKey: 'ws.contracts.collection', descKey: 'ws.contracts.collection.desc', icon: 'dollar-sign', route: '/billing' },
      { key: 'late', labelKey: 'ws.contracts.late', descKey: 'ws.contracts.late.desc', icon: 'alert-circle', route: '/intelligence' },
    ],
  },
  {
    key: 'maintenance',
    emoji: '🔧',
    labelKey: 'ws.group.maintenance',
    hintKey: 'ws.group.maintenance.hint',
    icon: 'tool',
    tone: 'emerald',
    items: [
      { key: 'requests', labelKey: 'ws.maintenance.requests', descKey: 'ws.maintenance.requests.desc', icon: 'tool', route: '/maintenance' },
      { key: 'technician', labelKey: 'ws.maintenance.technician', descKey: 'ws.maintenance.technician.desc', icon: 'send', route: '/maintenance', sourceApp: 'technician' },
      { key: 'preventive', labelKey: 'ws.maintenance.preventive', descKey: 'ws.maintenance.preventive.desc', icon: 'activity', route: '/sensors' },
      { key: 'virtual', labelKey: 'ws.maintenance.virtual', descKey: 'ws.maintenance.virtual.desc', icon: 'cpu', route: '/sensors', sourceApp: 'koil' },
      { key: 'memory', labelKey: 'ws.maintenance.memory', descKey: 'ws.maintenance.memory.desc', icon: 'database', route: '/memory' },
    ],
  },
  {
    key: 'finance',
    emoji: '💰',
    labelKey: 'ws.group.finance',
    hintKey: 'ws.group.finance.hint',
    icon: 'trending-up',
    tone: 'gold',
    items: [
      { key: 'wallet', labelKey: 'op.owner.wallet', descKey: 'op.owner.wallet.hint', icon: 'credit-card', route: '/wallet', tone: 'gold' },
      { key: 'payments', labelKey: 'op.owner.payments', descKey: 'op.owner.payments.hint', icon: 'dollar-sign', route: '/operational/payments', tone: 'emerald' },
      { key: 'revenue', labelKey: 'ws.finance.revenue', descKey: 'ws.finance.revenue.desc', icon: 'trending-up', route: '/portfolio' },
      { key: 'expenses', labelKey: 'ws.finance.expenses', descKey: 'ws.finance.expenses.desc', icon: 'minus-circle', route: '/reports' },
      { key: 'reports', labelKey: 'ws.finance.reports', descKey: 'ws.finance.reports.desc', icon: 'bar-chart-2', route: '/reports', sourceApp: 'koil' },
      { key: 'pdf', labelKey: 'ws.finance.pdf', descKey: 'ws.finance.pdf.desc', icon: 'file', route: '/reports' },
    ],
  },
  {
    key: 'documents',
    emoji: '📂',
    labelKey: 'ws.group.documents',
    hintKey: 'ws.group.documents.hint',
    icon: 'folder',
    items: [
      { key: 'upload', labelKey: 'ws.documents.upload', descKey: 'ws.documents.upload.desc', icon: 'upload-cloud', route: '/upload', tone: 'gold' },
      { key: 'pdf', labelKey: 'ws.documents.pdf', descKey: 'ws.documents.pdf.desc', icon: 'file', route: '/upload' },
      { key: 'excel', labelKey: 'ws.documents.excel', descKey: 'ws.documents.excel.desc', icon: 'grid', route: '/upload' },
      { key: 'images', labelKey: 'ws.documents.images', descKey: 'ws.documents.images.desc', icon: 'image', route: '/upload' },
      { key: 'ai', labelKey: 'ws.documents.ai', descKey: 'ws.documents.ai.desc', icon: 'zap', route: '/brain', tone: 'gold' },
    ],
  },
  {
    key: 'whatsapp',
    emoji: '📱',
    labelKey: 'ws.group.whatsapp',
    hintKey: 'ws.group.whatsapp.hint',
    icon: 'message-circle',
    tone: 'emerald',
    items: [
      { key: 'whatsapp', labelKey: 'ws.whatsapp.chat', descKey: 'ws.whatsapp.chat.desc', icon: 'message-circle', route: '/support' },
      { key: 'campaigns', labelKey: 'ws.whatsapp.campaigns', descKey: 'ws.whatsapp.campaigns.desc', icon: 'radio', route: '/support' },
      { key: 'notifications', labelKey: 'ws.whatsapp.notifications', descKey: 'ws.whatsapp.notifications.desc', icon: 'bell', route: '/notifications', sourceApp: 'koil' },
    ],
  },
  {
    key: 'settings',
    emoji: '⚙️',
    labelKey: 'ws.group.settings',
    hintKey: 'ws.group.settings.hint',
    icon: 'settings',
    items: [
      { key: 'propertyOs', labelKey: 'ws.settings.propertyOs', descKey: 'ws.settings.propertyOs.desc', icon: 'compass', route: '/setup/property-os', tone: 'gold' },
      { key: 'subscription', labelKey: 'ws.settings.subscription', descKey: 'ws.settings.subscription.desc', icon: 'credit-card', route: '/billing' },
      { key: 'help', labelKey: 'ws.settings.help', descKey: 'ws.settings.help.desc', icon: 'help-circle', route: '/support' },
      { key: 'security', labelKey: 'ws.settings.security', descKey: 'ws.settings.security.desc', icon: 'lock', route: '/settings', sourceApp: 'settings' },
      { key: 'learn', labelKey: 'ws.settings.learn', descKey: 'ws.settings.learn.desc', icon: 'play-circle', route: '/guides', tone: 'gold' },
    ],
  },
  {
    key: 'integrations',
    emoji: '🔗',
    labelKey: 'ws.group.integrations',
    hintKey: 'ws.group.integrations.hint',
    icon: 'link',
    tone: 'emerald',
    defaultOpen: false,
    items: [
      { key: 'hub', labelKey: 'ws.group.integrations', descKey: 'ws.group.integrations.hint', icon: 'link', route: '/operational/services', tone: 'emerald' },
      { key: 'sheets', labelKey: 'ws.integrations.sheets', descKey: 'ws.integrations.sheets.desc', icon: 'database', route: '/setup/sheets', tone: 'emerald' },
      { key: 'green', labelKey: 'ws.integrations.greenApi', descKey: 'ws.integrations.greenApi.desc', icon: 'message-circle', route: '/setup/greenApi', tone: 'emerald' },
      { key: 'ha', labelKey: 'ws.integrations.homeAssistant', descKey: 'ws.integrations.homeAssistant.desc', icon: 'home', route: '/setup/homeAssistant', tone: 'emerald' },
    ],
  },
  {
    key: 'privacy',
    emoji: '🔒',
    labelKey: 'ws.group.privacy',
    hintKey: 'ws.group.privacy.hint',
    icon: 'shield',
    items: [
      { key: 'account', labelKey: 'ws.privacy.account', descKey: 'ws.privacy.account.desc', icon: 'user', route: '/profile' },
      { key: 'privacy', labelKey: 'ws.privacy.policy', descKey: 'ws.privacy.policy.desc', icon: 'shield', route: '/privacy' },
      { key: 'terms', labelKey: 'ws.privacy.terms', descKey: 'ws.privacy.terms.desc', icon: 'file-text', route: '/terms' },
      { key: 'about', labelKey: 'ws.privacy.about', descKey: 'ws.privacy.about.desc', icon: 'info', route: '/about' },
    ],
  },
];

export const WORKSPACE_SIDEBAR_WIDTH = 320;
export const WORKSPACE_BRAND_HEIGHT = WORKSPACE_BRAND_ONLY_HEIGHT;
/** @deprecated quick row removed in polish phase */
export const WORKSPACE_QUICK_HEIGHT = 0;
/** @deprecated ask row removed in polish phase */
export const WORKSPACE_ASK_HEIGHT = 0;
export const WORKSPACE_TOTAL_HEADER_HEIGHT = WORKSPACE_BRAND_HEIGHT;
/** @deprecated use WORKSPACE_QUICK_HEIGHT */
export const WORKSPACE_ACTION_HEIGHT = WORKSPACE_QUICK_HEIGHT;
/** @deprecated use WORKSPACE_TOTAL_HEADER_HEIGHT */
export const WORKSPACE_HEADER_HEIGHT = WORKSPACE_TOTAL_HEADER_HEIGHT;
