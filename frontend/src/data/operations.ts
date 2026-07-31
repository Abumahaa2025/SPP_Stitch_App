import React from 'react';
import { Feather } from '@expo/vector-icons';
import type { SourceApp } from '@/src/utils/source-web';

type FeatherIcon = React.ComponentProps<typeof Feather>['name'];

export type OperationTool = {
  key: string;
  icon: FeatherIcon;
  labelKey: string;
  hintKey: string;
  route?: string;
  /** Opens Source web portal when EXPO_PUBLIC_SOURCE_WEB_URL is set. */
  sourceApp?: SourceApp;
  accent?: 'gold' | 'emerald';
};

/** Source web operational power — native routes + GAS portals when configured. */
export const OPERATION_TOOLS: OperationTool[] = [
  {
    key: 'owner-portal',
    icon: 'home',
    labelKey: 'ops.ownerPortal',
    hintKey: 'ops.ownerPortal.hint',
    route: '/owner',
    sourceApp: 'owner',
    accent: 'gold',
  },
  {
    key: 'tenant-portal',
    icon: 'users',
    labelKey: 'ops.tenantPortal',
    hintKey: 'ops.tenantPortal.hint',
    route: '/tenants',
    sourceApp: 'tenant',
  },
  {
    key: 'technician',
    icon: 'tool',
    labelKey: 'ops.technician',
    hintKey: 'ops.technician.hint',
    route: '/maintenance',
    sourceApp: 'technician',
    accent: 'emerald',
  },
  {
    key: 'whatsapp',
    icon: 'message-circle',
    labelKey: 'ops.whatsapp',
    hintKey: 'ops.whatsapp.hint',
    route: '/support',
    accent: 'emerald',
  },
  {
    key: 'reports',
    icon: 'file-text',
    labelKey: 'ops.reports',
    hintKey: 'ops.reports.hint',
    route: '/reports',
    sourceApp: 'koil',
  },
  {
    key: 'bulk-import',
    icon: 'upload-cloud',
    labelKey: 'ops.bulkImport',
    hintKey: 'ops.bulkImport.hint',
    route: '/upload',
    sourceApp: 'koil',
    accent: 'gold',
  },
  {
    key: 'sensors',
    icon: 'activity',
    labelKey: 'ops.sensors',
    hintKey: 'ops.sensors.hint',
    route: '/sensors',
    sourceApp: 'koil',
  },
  {
    key: 'messages',
    icon: 'bell',
    labelKey: 'ops.alerts',
    hintKey: 'ops.alerts.hint',
    route: '/notifications',
    sourceApp: 'koil',
  },
];
