/** Kowil (كويل · العقار الذكي) capabilities — additive SPP layer, same workflow spirit. */
export type KowilCapability = {
  id: string;
  icon: 'upload-cloud' | 'cpu' | 'trending-up' | 'tool' | 'eye' | 'bell';
  titleKey: string;
  hintKey: string;
};

export const KOWIL_CAPABILITIES: KowilCapability[] = [
  { id: 'import', icon: 'upload-cloud', titleKey: 'kowil.cap.import', hintKey: 'kowil.cap.import.hint' },
  { id: 'employee', icon: 'cpu', titleKey: 'kowil.cap.employee', hintKey: 'kowil.cap.employee.hint' },
  { id: 'collection', icon: 'trending-up', titleKey: 'kowil.cap.collection', hintKey: 'kowil.cap.collection.hint' },
  { id: 'maintenance', icon: 'tool', titleKey: 'kowil.cap.maintenance', hintKey: 'kowil.cap.maintenance.hint' },
  { id: 'vision', icon: 'eye', titleKey: 'kowil.cap.vision', hintKey: 'kowil.cap.vision.hint' },
  { id: 'alerts', icon: 'bell', titleKey: 'kowil.cap.alerts', hintKey: 'kowil.cap.alerts.hint' },
];

export const ONBOARDING_GUIDANCE_KEYS = [
  'onboarding.guide.step0',
  'onboarding.guide.step1',
  'onboarding.guide.step2',
  'onboarding.guide.step3',
  'onboarding.guide.step4',
  'onboarding.guide.step5',
] as const;
