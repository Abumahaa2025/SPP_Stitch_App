/**
 * Kowil local brain — answers from Property OS without cloud LLM.
 * Guarantees every query gets a grounded reply (offline / no API key).
 */
import type { PropertyOSState } from '@/src/types/property-os';
import { arrearsFromPropertyOS, isArrearsLedgerEntry } from '@/src/utils/ops-truth';

export type KowilLocalReply = {
  text: string;
  suggestions?: string[];
};

function greetings(lang: 'ar' | 'en'): KowilLocalReply {
  return {
    text: lang === 'ar'
      ? 'أهلاً — أنا كويل، الموظف الذكي داخل SPP. اسألني عن العقار، الوحدات، المستأجرين، المتأخرات، أو الصيانة.'
      : 'Hi — I am Kowil, the smart employee inside SPP. Ask about the property, units, tenants, arrears, or maintenance.',
    suggestions: lang === 'ar'
      ? ['ملخص العقار', 'كم مستأجر؟', 'من المتأخر؟', 'تقرير']
      : ['Property summary', 'How many tenants?', 'Who is late?', 'Report'],
  };
}

function help(lang: 'ar' | 'en'): KowilLocalReply {
  return {
    text: lang === 'ar'
      ? 'يمكنني:\n• ملخص العقار والإشغال\n• عدد الوحدات والمستأجرين\n• المتأخرات ومن عليه مبلغ\n• فتح بلاغ صيانة / رابط فني\n• تقرير سريع\n\nجرّب: «ملخص العقار» أو «من المتأخر؟»'
      : 'I can:\n• Property & occupancy summary\n• Units and tenant counts\n• Arrears and who owes\n• Open maintenance / tech link\n• Quick report\n\nTry: “property summary” or “who is late?”',
    suggestions: lang === 'ar'
      ? ['ملخص العقار', 'من المتأخر؟', 'كم وحدة؟']
      : ['Property summary', 'Who is late?', 'How many units?'],
  };
}

function emptyProperty(lang: 'ar' | 'en'): KowilLocalReply {
  return {
    text: lang === 'ar'
      ? 'لا توجد بيانات عقار محفوظة بعد. من الصفحة الرئيسية اختر «يدوي» أو «استيراد»، ثم ارجع لكويل وسألني عن الملخص.'
      : 'No property data saved yet. From Home choose Manual or Import, then come back and ask me for a summary.',
    suggestions: lang === 'ar' ? ['كيف أبدأ؟'] : ['How do I start?'],
  };
}

function summary(state: PropertyOSState, lang: 'ar' | 'en'): KowilLocalReply {
  const name = state.property?.name || (lang === 'ar' ? 'العقار' : 'Property');
  const units = state.units.length;
  const tenants = state.tenants.length;
  const occupied = state.units.filter((u) => u.status === 'occupied').length;
  const vacant = state.units.filter((u) => u.status === 'vacant').length;
  const contracts = state.contracts.length;
  const ledger = state.paymentLedger?.length || 0;
  const truth = arrearsFromPropertyOS(state);
  const occPct = units ? Math.round((occupied / units) * 100) : 0;

  if (lang === 'ar') {
    return {
      text:
        `ملخص «${name}»:\n`
        + `• الوحدات: ${units} (مشغولة ${occupied} · شاغرة ${vacant}) · إشغال ${occPct}%\n`
        + `• المستأجرون: ${tenants} · العقود: ${contracts}\n`
        + `• دفتر الأشهر: ${ledger} صف\n`
        + `• المتأخرات: ${truth.lateTenantCount} مستأجر · ${truth.totalUnpaid.toLocaleString('ar-SA')} ر.س`,
      suggestions: ['من المتأخر؟', 'كم مستأجر؟', 'تقرير'],
    };
  }
  return {
    text:
      `Summary for «${name}»:\n`
      + `• Units: ${units} (occupied ${occupied} · vacant ${vacant}) · occupancy ${occPct}%\n`
      + `• Tenants: ${tenants} · contracts: ${contracts}\n`
      + `• Ledger rows: ${ledger}\n`
      + `• Arrears: ${truth.lateTenantCount} tenant(s) · ${truth.totalUnpaid.toLocaleString()} SAR`,
    suggestions: ['Who is late?', 'How many tenants?', 'Report'],
  };
}

function counts(state: PropertyOSState, lang: 'ar' | 'en', kind: 'tenants' | 'units'): KowilLocalReply {
  if (kind === 'tenants') {
    const n = state.tenants.length;
    const names = state.tenants.slice(0, 8).map((t) => {
      const u = state.units.find((x) => x.id === t.unitId);
      return lang === 'ar' ? `• ${t.name} — وحدة ${u?.number || '—'}` : `• ${t.name} — unit ${u?.number || '—'}`;
    });
    return {
      text: lang === 'ar'
        ? `عدد المستأجرين: ${n}${names.length ? `\n${names.join('\n')}` : ''}`
        : `Tenant count: ${n}${names.length ? `\n${names.join('\n')}` : ''}`,
      suggestions: lang === 'ar' ? ['من المتأخر؟', 'ملخص العقار'] : ['Who is late?', 'Property summary'],
    };
  }
  const lines = state.units.slice(0, 12).map((u) => (
    lang === 'ar'
      ? `• وحدة ${u.number} — ${u.status === 'occupied' ? 'مشغولة' : u.status === 'vacant' ? 'شاغرة' : u.status}`
      : `• Unit ${u.number} — ${u.status}`
  ));
  return {
    text: lang === 'ar'
      ? `عدد الوحدات: ${state.units.length}\n${lines.join('\n')}`
      : `Unit count: ${state.units.length}\n${lines.join('\n')}`,
  };
}

function arrears(state: PropertyOSState, lang: 'ar' | 'en'): KowilLocalReply {
  const truth = arrearsFromPropertyOS(state);
  const ledger = (state.paymentLedger || []).filter(isArrearsLedgerEntry);
  if (!ledger.length && truth.totalUnpaid <= 0) {
    return {
      text: lang === 'ar'
        ? 'لا توجد متأخرات ظاهرة في بيانات العقار الحالية.'
        : 'No arrears visible in the current property data.',
      suggestions: lang === 'ar' ? ['ملخص العقار'] : ['Property summary'],
    };
  }
  const byTenant = new Map<string, { name: string; unit: string; total: number }>();
  ledger.forEach((l) => {
    const prev = byTenant.get(l.tenantId) || { name: l.tenant || '—', unit: l.unit || '—', total: 0 };
    prev.total += Number(l.remaining) || 0;
    byTenant.set(l.tenantId, prev);
  });
  const rows = [...byTenant.values()].sort((a, b) => b.total - a.total).slice(0, 10);
  const lines = rows.map((r) => (lang === 'ar'
    ? `• ${r.name} — وحدة ${r.unit} — ${r.total.toLocaleString('ar-SA')} ر.س`
    : `• ${r.name} — unit ${r.unit} — ${r.total.toLocaleString()} SAR`));
  return {
    text: lang === 'ar'
      ? `المتأخرون (${truth.lateTenantCount}) · الإجمالي ${truth.totalUnpaid.toLocaleString('ar-SA')} ر.س\n${lines.join('\n') || '—'}`
      : `Late tenants (${truth.lateTenantCount}) · total ${truth.totalUnpaid.toLocaleString()} SAR\n${lines.join('\n') || '—'}`,
    suggestions: lang === 'ar' ? ['أرسل تذكير', 'ملخص العقار'] : ['Send reminder', 'Property summary'],
  };
}

/** Always returns a reply — never null. */
export function answerKowilLocal(
  text: string,
  state: PropertyOSState,
  lang: 'ar' | 'en',
): KowilLocalReply {
  const q = String(text || '').trim();
  if (!q) return help(lang);

  if (/^(مرحبا|أهلا|السلام|hi|hello|hey)\b/i.test(q) || q.length <= 2) {
    return greetings(lang);
  }
  if (/مساعد|كيف.*(استخدم|أبدأ|ابدأ)|help|what can you|ماذا تستطيع/i.test(q)) {
    return help(lang);
  }
  if (!state.property && state.units.length === 0 && state.tenants.length === 0) {
    if (/ابدأ|بدء|start|كيف/i.test(q)) return emptyProperty(lang);
    return emptyProperty(lang);
  }

  if (/ملخص|وضع العقار|حالة العقار|summary|status|overview|dashboard/i.test(q)) {
    return summary(state, lang);
  }
  if (/كم\s*مستأجر|عدد المستأجر|how many tenant|tenant count/i.test(q)) {
    return counts(state, lang, 'tenants');
  }
  if (/كم\s*وحدة|عدد الوحد|how many unit|unit count/i.test(q)) {
    return counts(state, lang, 'units');
  }
  if (/من المتأخر|المتأخر|متأخرات|arrear|who.*(late|owe)|overdue/i.test(q)) {
    return arrears(state, lang);
  }
  if (/تقرير|report/i.test(q)) {
    return summary(state, lang);
  }
  if (/اسم العقار|property name|ما اسم/i.test(q)) {
    const name = state.property?.name || '—';
    return {
      text: lang === 'ar' ? `اسم العقار: ${name}` : `Property name: ${name}`,
      suggestions: lang === 'ar' ? ['ملخص العقار'] : ['Property summary'],
    };
  }

  // Default grounded snapshot — never “I couldn’t reach…”
  return summary(state, lang);
}
