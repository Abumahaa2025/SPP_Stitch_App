/** Built-in guidance flows — i18n keys under guided.{flowId}.* */
export type GuidedFlowId =
  | 'property'
  | 'building'
  | 'unit'
  | 'tenant'
  | 'technician'
  | 'whatsapp'
  | 'greenApi'
  | 'sensors'
  | 'virtualSensors'
  | 'excel'
  | 'pdf'
  | 'sheets';

export type GuidedFlow = {
  id: GuidedFlowId;
  stepCount: number;
  route?: string;
  learnKey?: string;
};

export const GUIDED_FLOWS: Record<GuidedFlowId, GuidedFlow> = {
  property: { id: 'property', stepCount: 4, route: '/setup/property-os', learnKey: 'property' },
  building: { id: 'building', stepCount: 4, route: '/portfolio', learnKey: 'building' },
  unit: { id: 'unit', stepCount: 4, route: '/portfolio', learnKey: 'unit' },
  tenant: { id: 'tenant', stepCount: 4, route: '/setup/property-os?phase=tenants', learnKey: 'tenants' },
  technician: { id: 'technician', stepCount: 4, route: '/maintenance', learnKey: 'technician' },
  whatsapp: { id: 'whatsapp', stepCount: 4, route: '/setup/whatsapp', learnKey: 'whatsapp' },
  greenApi: { id: 'greenApi', stepCount: 4, route: '/setup/greenApi', learnKey: 'greenApi' },
  sensors: { id: 'sensors', stepCount: 4, route: '/sensors', learnKey: 'sensors' },
  virtualSensors: { id: 'virtualSensors', stepCount: 3, route: '/sensors', learnKey: 'virtualSensors' },
  excel: { id: 'excel', stepCount: 4, route: '/upload', learnKey: 'excel' },
  pdf: { id: 'pdf', stepCount: 4, route: '/upload', learnKey: 'pdf' },
  sheets: { id: 'sheets', stepCount: 4, route: '/setup/sheets', learnKey: 'sheets' },
};

/** Screen → default guidance flow shown at top */
export const SCREEN_GUIDANCE: Partial<Record<string, GuidedFlowId>> = {
  '/portfolio': 'property',
  '/tenants': 'tenant',
  '/maintenance': 'technician',
  '/sensors': 'virtualSensors',
  '/upload': 'pdf',
};
