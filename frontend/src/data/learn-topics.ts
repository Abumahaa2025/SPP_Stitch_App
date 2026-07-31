/** Learning Center curriculum — maps to official tutorial videos later. */

export type LearnTopic = {

  key: string;

  icon: 'home' | 'upload-cloud' | 'message-circle' | 'file-text' | 'layers' | 'users' | 'tool' | 'bell' | 'database' | 'activity' | 'settings' | 'grid' | 'box' | 'credit-card' | 'shield' | 'table' | 'file';

  route: string;

  sourceApp?: 'owner' | 'tenant' | 'technician' | 'koil' | 'settings';

};



export const LEARN_TOPICS: LearnTopic[] = [

  { key: 'start', icon: 'home', route: '/' },

  { key: 'property', icon: 'grid', route: '/portfolio' },

  { key: 'building', icon: 'layers', route: '/portfolio' },

  { key: 'unit', icon: 'box', route: '/portfolio' },

  { key: 'owner', icon: 'layers', route: '/owner', sourceApp: 'owner' },

  { key: 'upload', icon: 'upload-cloud', route: '/upload' },

  { key: 'pdf', icon: 'file', route: '/upload' },

  { key: 'excel', icon: 'table', route: '/upload' },

  { key: 'brain', icon: 'message-circle', route: '/brain' },

  { key: 'contracts', icon: 'file-text', route: '/contracts' },

  { key: 'tenants', icon: 'users', route: '/tenants', sourceApp: 'tenant' },

  { key: 'tenant', icon: 'users', route: '/tenants' },

  { key: 'maintenance', icon: 'tool', route: '/maintenance', sourceApp: 'technician' },

  { key: 'technician', icon: 'tool', route: '/roles' },

  { key: 'sensors', icon: 'activity', route: '/sensors' },

  { key: 'virtualSensors', icon: 'activity', route: '/sensors' },

  { key: 'whatsapp', icon: 'message-circle', route: '/setup/whatsapp' },

  { key: 'greenApi', icon: 'message-circle', route: '/setup/greenApi' },

  { key: 'sheets', icon: 'database', route: '/setup/sheets' },

  { key: 'memory', icon: 'database', route: '/memory' },

  { key: 'notifications', icon: 'bell', route: '/notifications' },

  { key: 'roles', icon: 'shield', route: '/roles' },

  { key: 'billing', icon: 'credit-card', route: '/billing' },

  { key: 'settings', icon: 'settings', route: '/settings', sourceApp: 'settings' },

];

