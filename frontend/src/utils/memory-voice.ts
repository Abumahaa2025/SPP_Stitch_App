import type { PortfolioMemoryAsset } from '@/src/api/intelligence';

type Lang = 'en' | 'ar';

/** Turn asset records into experience-based sentences — not database rows. */
export function assetExperience(asset: PortfolioMemoryAsset, lang: Lang): string {
  const name = asset.name;

  if (lang === 'ar') {
    if (asset.fault_count >= 2) {
      return `نتذكّر أن «${name}» تعطّل ${asset.fault_count} مرات — قد يحتاج استبدالًا قريبًا.`;
    }
    if (asset.warranty_days != null && asset.warranty_days <= 45 && asset.warranty_days >= 0) {
      return `ضمان «${name}» ينتهي خلال ${asset.warranty_days} يومًا — راجع التغطية قبل أي إصلاح.`;
    }
    if (asset.life_pct >= 75) {
      return `«${name}» استهلك ${asset.life_pct}% من عمره التشغيلي — ضعه على قائمة المراقبة.`;
    }
    if (asset.risk === 'critical' || asset.risk === 'high') {
      return `«${name}» يحتاج انتباهك — مخاطر مرتفعة في سجل الصيانة.`;
    }
    return `«${name}» في سجلنا — ${asset.fault_count} حدث صيانة مسجّل.`;
  }

  if (asset.fault_count >= 2) {
    return `We remember ${name} failed ${asset.fault_count} times — replacement may be due soon.`;
  }
  if (asset.warranty_days != null && asset.warranty_days <= 45 && asset.warranty_days >= 0) {
    return `The ${name} warranty expires in ${asset.warranty_days} days — check coverage before the next repair.`;
  }
  if (asset.life_pct >= 75) {
    return `${name} has used ${asset.life_pct}% of its service life — worth watching closely.`;
  }
  if (asset.risk === 'critical' || asset.risk === 'high') {
    return `${name} needs attention — elevated risk in the maintenance history.`;
  }
  return `We track ${name} — ${asset.fault_count} maintenance event${asset.fault_count === 1 ? '' : 's'} on record.`;
}
