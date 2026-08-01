/**
 * Build CSV (Excel-openable) from Property OS + payment ledger.
 */
import { Share, Platform } from 'react-native';
import type { PropertyOSState } from '@/src/types/property-os';
import { loadCanonicalTenants } from '@/src/utils/canonical-tenant-store';

function esc(v: string | number | undefined | null) {
  const s = String(v ?? '');
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export async function buildPropertyExcelCsv(os: PropertyOSState, ar: boolean): Promise<string> {
  const reg = await loadCanonicalTenants();
  const lines: string[] = [];
  const prop = os.property;

  lines.push(ar ? 'قسم,حقل,قيمة' : 'Section,Field,Value');
  lines.push(['Property', 'name', prop?.name || ''].map(esc).join(','));
  lines.push(['Property', 'city', prop?.city || ''].map(esc).join(','));
  lines.push(['Property', 'units', String(os.units.length)].map(esc).join(','));
  lines.push(['Property', 'tenants', String(os.tenants.length)].map(esc).join(','));
  lines.push('');

  lines.push(
    ar
      ? 'مستأجر,وحدة,جوال,إيجار,عقد,حالة,مصدر'
      : 'Tenant,Unit,Phone,Rent,Contract,Status,Source',
  );
  const tenants = reg.tenants.length
    ? reg.tenants
    : os.tenants.map((t) => {
        const unit = os.units.find((u) => u.id === t.unitId);
        return {
          name: t.name,
          unitNumber: unit?.number || '',
          phone: t.phone,
          rentAmount: unit?.rentAmount || 0,
          contractNumber: os.contracts.find((c) => c.tenantId === t.id)?.number || '',
          status: 'active',
          source: 'os',
        };
      });
  for (const t of tenants) {
    lines.push([
      t.name,
      t.unitNumber,
      t.phone,
      t.rentAmount,
      ('contractNumber' in t ? t.contractNumber : '') || '',
      t.status,
      t.source,
    ].map(esc).join(','));
  }

  lines.push('');
  lines.push(
    ar
      ? 'مستأجر,شهر,مستحق,مدفوع,متبقي,حالة'
      : 'Tenant,Month,Due,Paid,Remaining,Status',
  );
  for (const row of os.paymentLedger || []) {
    lines.push([
      row.tenant,
      row.monthLabel || row.monthKey,
      row.due,
      row.paid,
      row.remaining,
      row.statusLabel || row.status,
    ].map(esc).join(','));
  }

  return lines.join('\n');
}

export async function sharePropertyExcel(csv: string, baseName: string) {
  const safe = (baseName || 'spp-database').replace(/[^\w\u0600-\u06FF-]+/g, '_').slice(0, 40);
  const message = `${safe}.csv\n\n${csv}`;
  await Share.share(
    Platform.OS === 'ios'
      ? { message, title: `${safe}.csv` }
      : { message, title: `${safe}.csv` },
  );
}
