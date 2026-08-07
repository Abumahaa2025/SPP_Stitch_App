/**
 * Historical Kowil spelling of the Koil local brain (Governance §6).
 * Prefer importing from `@/src/utils/koil-local-brain` in new code.
 * Grounded answers from Property OS + Smart Employee.
 * Never invents phones, contract numbers, or financial totals.
 * Offline-safe; no cloud LLM required.
 */
import type {
  ContractRecord,
  PaymentLedgerEntry,
  PropertyOSState,
  TenantRecord,
  UnitRecord,
} from '@/src/types/property-os';
import type { EmployeeTask, SmartEmployeeState } from '@/src/types/smart-employee';
import { arrearsFromPropertyOS, isArrearsLedgerEntry } from '@/src/utils/ops-truth';
import { buildMonthlyPortfolioSummary } from '@/src/utils/monthly-portfolio-summary';
import { buildTechPortalLink, buildTenantPortalLink } from '@/src/utils/portal-links';

export type KowilLocalReply = {
  text: string;
  suggestions?: string[];
};

type Lang = 'ar' | 'en';

type TenantCtx = {
  tenant: TenantRecord;
  unit?: UnitRecord;
  contract?: ContractRecord;
  arrears: number;
  lateMonths: PaymentLedgerEntry[];
};

function money(n: number, lang: Lang): string {
  return Number(n || 0).toLocaleString(lang === 'ar' ? 'ar-SA' : undefined);
}

function digits(phone: string): string {
  return String(phone || '').replace(/\D/g, '');
}

function waLink(phone: string, message: string): string | null {
  const d = digits(phone);
  if (!d) return null;
  return `https://wa.me/${d}?text=${encodeURIComponent(message)}`;
}

function unitOf(state: PropertyOSState, unitId: string): UnitRecord | undefined {
  return state.units.find((u) => u.id === unitId);
}

function contractOf(state: PropertyOSState, tenantId: string, unitId: string): ContractRecord | undefined {
  return state.contracts.find((c) => c.tenantId === tenantId && c.unitId === unitId)
    || state.contracts.find((c) => c.tenantId === tenantId);
}

function tenantArrears(state: PropertyOSState, tenantId: string): { total: number; months: PaymentLedgerEntry[] } {
  const months = (state.paymentLedger || []).filter(
    (r) => r.tenantId === tenantId && isArrearsLedgerEntry(r),
  );
  const total = months.reduce((s, r) => s + (Number(r.remaining) || 0), 0);
  return { total, months };
}

function ctxFor(state: PropertyOSState, tenant: TenantRecord): TenantCtx {
  const unit = unitOf(state, tenant.unitId);
  const contract = contractOf(state, tenant.id, tenant.unitId);
  const { total, months } = tenantArrears(state, tenant.id);
  return { tenant, unit, contract, arrears: total, lateMonths: months };
}

/** Resolve tenant from free text: name, unit number, or phone digits. */
function findTenants(state: PropertyOSState, q: string): TenantCtx[] {
  const raw = String(q || '').trim();
  if (!raw || !state.tenants.length) return [];

  const phoneHit = digits(raw);
  const unitMatch = raw.match(/(?:وحدة|unit)\s*([A-Za-z0-9\-_/]+)/i)
    || raw.match(/\b([0-9]{1,4}[A-Za-z]?)\b/);

  const scored = state.tenants.map((t) => {
    const unit = unitOf(state, t.unitId);
    let score = 0;
    const name = (t.name || '').trim();
    if (name && raw.includes(name)) score += 100;
    if (name && name.length >= 3 && raw.toLowerCase().includes(name.toLowerCase())) score += 80;
    // Partial Arabic/English name tokens (≥3 chars)
    for (const tok of name.split(/\s+/).filter((x) => x.length >= 3)) {
      if (raw.includes(tok)) score += 40;
    }
    if (unit?.number && (raw.includes(unit.number) || (unitMatch && unitMatch[1] === unit.number))) {
      score += 70;
    }
    if (phoneHit.length >= 7 && digits(t.phone).includes(phoneHit)) score += 90;
    if (phoneHit.length >= 7 && phoneHit.includes(digits(t.phone)) && digits(t.phone).length >= 7) {
      score += 90;
    }
    return { score, ctx: ctxFor(state, t) };
  }).filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score);

  if (scored.length) return scored.slice(0, 5).map((s) => s.ctx);

  // Unit-only: "وحدة 12" without tenant name
  if (unitMatch) {
    const num = unitMatch[1];
    return state.tenants
      .filter((t) => unitOf(state, t.unitId)?.number === num)
      .map((t) => ctxFor(state, t));
  }
  return [];
}

function daysUntil(iso: string): number {
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return 9999;
  return Math.ceil((t - Date.now()) / 86400000);
}

function draftReminder(ctx: TenantCtx, lang: Lang): string {
  const name = ctx.tenant.name || (lang === 'ar' ? 'المستأجر' : 'Tenant');
  const unit = ctx.unit?.number || '—';
  const rent = ctx.tenant.officialRent || ctx.contract?.rentAmount || ctx.unit?.rentAmount || 0;
  if (lang === 'ar') {
    return (
      `السلام عليكم ${name}،\n\n`
      + `تذكير من إدارة العقار بخصوص وحدة ${unit}.\n`
      + (rent ? `الإيجار: ${money(rent, lang)} ر.س\n` : '')
      + (ctx.arrears > 0 ? `المتأخرات: ${money(ctx.arrears, lang)} ر.س\n` : '')
      + `\nنرجو التسوية أو الرد لتحديد موعد السداد. شكراً لكم.`
    );
  }
  return (
    `Hello ${name},\n\n`
    + `Reminder from property management for unit ${unit}.\n`
    + (rent ? `Rent: ${money(rent, lang)} SAR\n` : '')
    + (ctx.arrears > 0 ? `Arrears: ${money(ctx.arrears, lang)} SAR\n` : '')
    + `\nPlease settle or reply with a payment date. Thank you.`
  );
}

function portalFor(state: PropertyOSState, ctx: TenantCtx): { url: string; message: string } {
  const meta = {
    name: ctx.tenant.name,
    unit: ctx.unit?.number,
    property: state.property?.name,
  };
  const token = ctx.tenant.portalToken || '';
  const built = token
    ? buildTenantPortalLink(ctx.tenant.id, token, meta)
    : null;
  const url = (built?.url || ctx.tenant.portalUrl || '').trim();
  const message = (ctx.tenant.whatsAppMessage || '').trim()
    || (url
      ? (meta.name
        ? `مرحباً ${meta.name} — بوابة المستأجر:\n${url}`
        : url)
      : '');
  return { url, message };
}

function greetings(lang: Lang): KowilLocalReply {
  return {
    text: lang === 'ar'
      ? 'أهلاً — أنا كويل، الموظف الذكي داخل SPP. اسألني عن العقار، العقود، الجوال، الموجز الشهري، الروابط، التذكير، أو مهام اليوم.'
      : 'Hi — I am Kowil, the smart employee inside SPP. Ask about the property, contracts, phones, monthly summary, links, reminders, or today’s work.',
    suggestions: lang === 'ar'
      ? ['ملخص العقار', 'موجز شهري', 'من المتأخر؟', 'فجوات البيانات']
      : ['Property summary', 'Monthly summary', 'Who is late?', 'Data gaps'],
  };
}

function help(lang: Lang): KowilLocalReply {
  return {
    text: lang === 'ar'
      ? [
        'يمكنني من بيانات التطبيق الفعلية:',
        '• ملخص العقار والإشغال والمتأخرات',
        '• رقم جوال / رقم عقد / تفاصيل مستأجر أو وحدة',
        '• موجز شهري مفصّل من دفتر الأشهر',
        '• رابط بوابة المستأجر أو الفني + رسالة واتساب جاهزة',
        '• صياغة تذكير سداد مع رابط واتساب (التنفيذ من مكتب الموظف أو الرابط)',
        '• العقود المنتهية/القريبة والتجديد والشواغر',
        '• مهام اليوم من مكتب الموظف الذكي',
        '• فجوات البيانات (جوال/عقد ناقص)',
        '',
        'أمثلة: «جوال سامي» · «رقم عقد وحدة 12» · «موجز شهري» · «رابط بوابة» · «أرسل تذكير للمتأخر»',
      ].join('\n')
      : [
        'From live app data I can:',
        '• Property / occupancy / arrears summary',
        '• Phone / contract number / tenant or unit details',
        '• Detailed monthly ledger summary',
        '• Tenant or tech portal link + WhatsApp draft',
        '• Collection reminder draft + wa.me link (send via employee desk or link)',
        '• Expiring/expired contracts, renewals, vacancies',
        '• Today’s smart-employee tasks',
        '• Data gaps (missing phone/contract)',
        '',
        'Try: “phone for Sami” · “contract unit 12” · “monthly summary” · “portal link” · “remind late tenants”',
      ].join('\n'),
    suggestions: lang === 'ar'
      ? ['ماذا أفعل اليوم؟', 'موجز شهري', 'من المتأخر؟', 'فجوات البيانات']
      : ['What should I do today?', 'Monthly summary', 'Who is late?', 'Data gaps'],
  };
}

function emptyProperty(lang: Lang): KowilLocalReply {
  return {
    text: lang === 'ar'
      ? 'لا توجد بيانات عقار محفوظة بعد. من الصفحة الرئيسية اختر «يدوي» أو «استيراد»، طبّق التحليل، ثم ارجع لكويل.'
      : 'No property data saved yet. From Home choose Manual or Import, apply analysis, then come back to Kowil.',
    suggestions: lang === 'ar' ? ['كيف أبدأ؟'] : ['How do I start?'],
  };
}

function todayWork(emp: SmartEmployeeState | undefined, lang: Lang): KowilLocalReply {
  const active = (emp?.tasks || []).filter((t) =>
    t.status === 'suggested' || t.status === 'in_progress' || t.status === 'waiting_followup');
  if (!active.length) {
    return {
      text: lang === 'ar'
        ? (emp?.lastThoughtAr
          || 'لا مهام عاجلة الآن. افتح مكتب الموظف الذكي وأعد التحليل بعد تحديث البيانات.')
        : (emp?.lastThoughtEn
          || 'No urgent tasks. Open the smart employee desk and re-analyze after updating data.'),
      suggestions: lang === 'ar' ? ['ملخص العقار', 'من المتأخر؟', 'فجوات البيانات'] : ['Property summary', 'Who is late?', 'Data gaps'],
    };
  }
  const lines = active.slice(0, 8).map((t, i) => formatTaskLine(t, i, lang));
  return {
    text: lang === 'ar'
      ? `خطة العمل الآن (${active.length}):\n${lines.join('\n')}\n\nنفّذ من تبويب «الموظف الذكي» (تشغيل / لاحقاً / تجاهل).\nللتذكير أو الرابط اكتب: «أرسل تذكير» أو «رابط بوابة».`
      : `Work plan now (${active.length}):\n${lines.join('\n')}\n\nExecute from the Smart Employee tab (Run / Later / Skip).\nFor reminders/links try: “send reminder” or “portal link”.`,
    suggestions: lang === 'ar'
      ? ['أرسل تذكير للمتأخر', 'رابط بوابة', 'من المتأخر؟']
      : ['Remind late tenants', 'Portal link', 'Who is late?'],
  };
}

function formatTaskLine(t: EmployeeTask, i: number, lang: Lang): string {
  const title = lang === 'ar' ? t.titleAr : t.titleEn;
  const reason = lang === 'ar' ? t.reasonAr : t.reasonEn;
  const phone = t.whatsappPhone ? ` · ${t.whatsappPhone}` : '';
  return `${i + 1}. ${title} — ${reason}${phone}`;
}

function summary(state: PropertyOSState, lang: Lang): KowilLocalReply {
  const name = state.property?.name || (lang === 'ar' ? 'العقار' : 'Property');
  const city = state.property?.city || '';
  const units = state.units.length;
  const tenants = state.tenants.length;
  const occupied = state.units.filter((u) => u.status === 'occupied').length;
  const vacant = state.units.filter((u) => u.status === 'vacant').length;
  const contracts = state.contracts.length;
  const ledger = state.paymentLedger?.length || 0;
  const truth = arrearsFromPropertyOS(state);
  const occPct = units ? Math.round((occupied / units) * 100) : 0;
  const missingPhone = state.tenants.filter((t) => !digits(t.phone)).length;
  const withPortal = state.tenants.filter((t) => t.portalUrl || t.portalToken).length;

  if (lang === 'ar') {
    return {
      text:
        `ملخص «${name}»${city ? ` — ${city}` : ''}:\n`
        + `• الوحدات: ${units} (مشغولة ${occupied} · شاغرة ${vacant}) · إشغال ${occPct}%\n`
        + `• المستأجرون: ${tenants} · العقود: ${contracts} · بوابات: ${withPortal}\n`
        + `• دفتر الأشهر: ${ledger} صف\n`
        + `• المتأخرات: ${truth.lateTenantCount} مستأجر · ${money(truth.totalUnpaid, lang)} ر.س\n`
        + `• بدون جوال محفوظ: ${missingPhone}`
        + (state.lastImportAt ? `\n• آخر استيراد: ${state.lastImportAt.slice(0, 10)}` : ''),
      suggestions: ['موجز شهري', 'من المتأخر؟', 'فجوات البيانات', 'العقود'],
    };
  }
  return {
    text:
      `Summary for «${name}»${city ? ` — ${city}` : ''}:\n`
      + `• Units: ${units} (occupied ${occupied} · vacant ${vacant}) · occupancy ${occPct}%\n`
      + `• Tenants: ${tenants} · contracts: ${contracts} · portals: ${withPortal}\n`
      + `• Ledger rows: ${ledger}\n`
      + `• Arrears: ${truth.lateTenantCount} tenant(s) · ${money(truth.totalUnpaid, lang)} SAR\n`
      + `• Missing phone: ${missingPhone}`
      + (state.lastImportAt ? `\n• Last import: ${state.lastImportAt.slice(0, 10)}` : ''),
    suggestions: ['Monthly summary', 'Who is late?', 'Data gaps', 'Contracts'],
  };
}

function monthlyDetail(state: PropertyOSState, lang: Lang): KowilLocalReply {
  const period = buildMonthlyPortfolioSummary(state, state.occupancyMoves || []);
  if (!period.months.length) {
    return {
      text: lang === 'ar'
        ? 'لا يوجد دفتر أشهر بعد. استورد كشفًا فيه أشهر/مدفوعات ثم طبّق التحليل.'
        : 'No monthly ledger yet. Import a statement with months/payments and apply analysis.',
      suggestions: lang === 'ar' ? ['ملخص العقار', 'فجوات البيانات'] : ['Property summary', 'Data gaps'],
    };
  }

  const lines = period.months.slice(-8).map((m) => {
    if (lang === 'ar') {
      return (
        `• ${m.monthLabel}: مستحق ${money(m.dueTotal, lang)} · محصّل ${money(m.paidTotal, lang)}`
        + ` · متبقي ${money(m.arrearsTotal, lang)} · متأخرون ${m.lateCount}/${m.tenantCount}`
        + (m.departed.length ? ` · غادر ${m.departed.length}` : '')
        + (m.entered.length ? ` · دخل ${m.entered.length}` : '')
      );
    }
    return (
      `• ${m.monthLabel}: due ${money(m.dueTotal, lang)} · paid ${money(m.paidTotal, lang)}`
      + ` · remaining ${money(m.arrearsTotal, lang)} · late ${m.lateCount}/${m.tenantCount}`
      + (m.departed.length ? ` · left ${m.departed.length}` : '')
      + (m.entered.length ? ` · entered ${m.entered.length}` : '')
    );
  });

  const t = period.totals;
  const head = lang === 'ar'
    ? `موجز شهري مفصّل (${period.months.length} شهر):\n${lines.join('\n')}\n\n`
      + `الإجمالي: مستحق ${money(t.due, lang)} · محصّل ${money(t.paid, lang)} · متبقي ${money(t.arrears, lang)}\n`
      + `حركة: غادر ${t.departed} · دخل ${t.entered}`
    : `Detailed monthly summary (${period.months.length} months):\n${lines.join('\n')}\n\n`
      + `Totals: due ${money(t.due, lang)} · paid ${money(t.paid, lang)} · remaining ${money(t.arrears, lang)}\n`
      + `Moves: left ${t.departed} · entered ${t.entered}`;

  return {
    text: head,
    suggestions: lang === 'ar'
      ? ['من المتأخر؟', 'ملخص العقار', 'أرسل تذكير للمتأخر']
      : ['Who is late?', 'Property summary', 'Remind late tenants'],
  };
}

function counts(state: PropertyOSState, lang: Lang, kind: 'tenants' | 'units'): KowilLocalReply {
  if (kind === 'tenants') {
    const n = state.tenants.length;
    const names = state.tenants.slice(0, 10).map((t) => {
      const u = unitOf(state, t.unitId);
      const phone = digits(t.phone) ? t.phone : (lang === 'ar' ? 'بدون جوال' : 'no phone');
      return lang === 'ar'
        ? `• ${t.name} — وحدة ${u?.number || '—'} — ${phone}`
        : `• ${t.name} — unit ${u?.number || '—'} — ${phone}`;
    });
    return {
      text: lang === 'ar'
        ? `عدد المستأجرين: ${n}${names.length ? `\n${names.join('\n')}` : ''}`
        : `Tenant count: ${n}${names.length ? `\n${names.join('\n')}` : ''}`,
      suggestions: lang === 'ar' ? ['جوال مستأجر', 'العقود', 'من المتأخر؟'] : ['Tenant phone', 'Contracts', 'Who is late?'],
    };
  }
  const lines = state.units.slice(0, 14).map((u) => {
    const tenant = state.tenants.find((t) => t.unitId === u.id);
    const st = u.status === 'occupied'
      ? (lang === 'ar' ? 'مشغولة' : 'occupied')
      : u.status === 'vacant'
        ? (lang === 'ar' ? 'شاغرة' : 'vacant')
        : u.status;
    return lang === 'ar'
      ? `• وحدة ${u.number} — ${st}${tenant ? ` — ${tenant.name}` : ''}`
      : `• Unit ${u.number} — ${st}${tenant ? ` — ${tenant.name}` : ''}`;
  });
  return {
    text: lang === 'ar'
      ? `عدد الوحدات: ${state.units.length}\n${lines.join('\n')}`
      : `Unit count: ${state.units.length}\n${lines.join('\n')}`,
    suggestions: lang === 'ar' ? ['الشواغر', 'ملخص العقار'] : ['Vacancies', 'Property summary'],
  };
}

function arrears(state: PropertyOSState, lang: Lang): KowilLocalReply {
  const truth = arrearsFromPropertyOS(state);
  const ledger = (state.paymentLedger || []).filter(isArrearsLedgerEntry);
  if (!ledger.length && truth.totalUnpaid <= 0) {
    return {
      text: lang === 'ar'
        ? 'لا توجد متأخرات ظاهرة في بيانات العقار الحالية.'
        : 'No arrears visible in the current property data.',
      suggestions: lang === 'ar' ? ['موجز شهري', 'ملخص العقار'] : ['Monthly summary', 'Property summary'],
    };
  }
  const byTenant = new Map<string, { name: string; unit: string; total: number; phone: string }>();
  ledger.forEach((l) => {
    const t = state.tenants.find((x) => x.id === l.tenantId);
    const prev = byTenant.get(l.tenantId) || {
      name: l.tenant || t?.name || '—',
      unit: l.unit || '—',
      total: 0,
      phone: t?.phone || '',
    };
    prev.total += Number(l.remaining) || 0;
    byTenant.set(l.tenantId, prev);
  });
  const rows = [...byTenant.values()].sort((a, b) => b.total - a.total).slice(0, 12);
  const lines = rows.map((r) => (lang === 'ar'
    ? `• ${r.name} — وحدة ${r.unit} — ${money(r.total, lang)} ر.س${r.phone ? ` — ${r.phone}` : ' — بلا جوال'}`
    : `• ${r.name} — unit ${r.unit} — ${money(r.total, lang)} SAR${r.phone ? ` — ${r.phone}` : ' — no phone'}`));
  return {
    text: lang === 'ar'
      ? `المتأخرون (${truth.lateTenantCount}) · الإجمالي ${money(truth.totalUnpaid, lang)} ر.س\n${lines.join('\n') || '—'}\n\nللتذكير: «أرسل تذكير للمتأخر» أو سمّ المستأجر.`
      : `Late tenants (${truth.lateTenantCount}) · total ${money(truth.totalUnpaid, lang)} SAR\n${lines.join('\n') || '—'}\n\nRemind: “remind late tenants” or name a tenant.`,
    suggestions: lang === 'ar'
      ? ['أرسل تذكير للمتأخر', 'موجز شهري', 'فجوات البيانات']
      : ['Remind late tenants', 'Monthly summary', 'Data gaps'],
  };
}

function tenantDetail(ctx: TenantCtx, state: PropertyOSState, lang: Lang): KowilLocalReply {
  const { tenant, unit, contract, arrears: arTotal, lateMonths } = ctx;
  const portal = portalFor(state, ctx);
  const phone = digits(tenant.phone) ? tenant.phone : (lang === 'ar' ? 'غير متوفر في البيانات' : 'not in data');
  const contractNo = contract?.number?.trim()
    || (lang === 'ar' ? 'غير متوفر في البيانات' : 'not in data');
  const monthLines = lateMonths.slice(0, 6).map((m) => (
    lang === 'ar'
      ? `  – ${m.monthLabel}: متبقي ${money(m.remaining, lang)} ر.س (${m.statusLabel || m.status})`
      : `  – ${m.monthLabel}: remaining ${money(m.remaining, lang)} SAR (${m.statusLabel || m.status})`
  ));

  if (lang === 'ar') {
    return {
      text: [
        `ملف المستأجر «${tenant.name}»:`,
        `• الوحدة: ${unit?.number || '—'} · الحالة: ${unit?.status || '—'}`,
        `• الجوال: ${phone}`,
        `• البريد: ${tenant.email || '—'}`,
        `• رقم العقد: ${contractNo}`,
        contract
          ? `• مدة العقد: ${contract.startDate || '—'} ← ${contract.endDate || '—'} · إيجار ${money(contract.rentAmount, lang)} ر.س`
          : '• لا يوجد عقد مربوط في النظام',
        `• المتأخرات: ${money(arTotal, lang)} ر.س`,
        monthLines.length ? `• أشهر متأخرة:\n${monthLines.join('\n')}` : '',
        portal.url ? `• رابط البوابة:\n${portal.url}` : '• رابط البوابة: غير مُنشأ بعد',
      ].filter(Boolean).join('\n'),
      suggestions: ['أرسل تذكير', 'رابط بوابة', 'رقم العقد', 'موجز شهري'],
    };
  }
  return {
    text: [
      `Tenant file «${tenant.name}»:`,
      `• Unit: ${unit?.number || '—'} · status: ${unit?.status || '—'}`,
      `• Phone: ${phone}`,
      `• Email: ${tenant.email || '—'}`,
      `• Contract no.: ${contractNo}`,
      contract
        ? `• Term: ${contract.startDate || '—'} → ${contract.endDate || '—'} · rent ${money(contract.rentAmount, lang)} SAR`
        : '• No linked contract in the system',
      `• Arrears: ${money(arTotal, lang)} SAR`,
      monthLines.length ? `• Late months:\n${monthLines.join('\n')}` : '',
      portal.url ? `• Portal link:\n${portal.url}` : '• Portal link: not created yet',
    ].filter(Boolean).join('\n'),
    suggestions: ['Send reminder', 'Portal link', 'Contract number', 'Monthly summary'],
  };
}

function phonesAnswer(state: PropertyOSState, q: string, lang: Lang): KowilLocalReply {
  const hits = findTenants(state, q);
  if (hits.length === 1) {
    const c = hits[0];
    const phone = digits(c.tenant.phone) ? c.tenant.phone : null;
    if (!phone) {
      return {
        text: lang === 'ar'
          ? `لا يوجد رقم جوال محفوظ لـ «${c.tenant.name}» (وحدة ${c.unit?.number || '—'}). أضفه من قاعدة البيانات أو السجل الرسمي.`
          : `No phone saved for «${c.tenant.name}» (unit ${c.unit?.number || '—'}). Add it in the database / official registry.`,
        suggestions: lang === 'ar' ? ['فجوات البيانات', 'ملف المستأجر'] : ['Data gaps', 'Tenant file'],
      };
    }
    return {
      text: lang === 'ar'
        ? `جوال «${c.tenant.name}» (وحدة ${c.unit?.number || '—'}): ${phone}`
        : `Phone for «${c.tenant.name}» (unit ${c.unit?.number || '—'}): ${phone}`,
      suggestions: lang === 'ar' ? ['أرسل تذكير', 'رابط بوابة', 'رقم العقد'] : ['Send reminder', 'Portal link', 'Contract number'],
    };
  }
  if (hits.length > 1) {
    const lines = hits.map((c) => (lang === 'ar'
      ? `• ${c.tenant.name} — وحدة ${c.unit?.number || '—'} — ${digits(c.tenant.phone) ? c.tenant.phone : 'بلا جوال'}`
      : `• ${c.tenant.name} — unit ${c.unit?.number || '—'} — ${digits(c.tenant.phone) ? c.tenant.phone : 'no phone'}`));
    return {
      text: lang === 'ar' ? `وجدت أكثر من مستأجر:\n${lines.join('\n')}\nحدّد الاسم أو الوحدة.` : `Multiple tenants:\n${lines.join('\n')}\nSpecify name or unit.`,
      suggestions: hits.slice(0, 3).map((c) => (lang === 'ar' ? `جوال ${c.tenant.name}` : `Phone ${c.tenant.name}`)),
    };
  }

  const withPhone = state.tenants.filter((t) => digits(t.phone));
  const without = state.tenants.length - withPhone.length;
  const lines = withPhone.slice(0, 12).map((t) => {
    const u = unitOf(state, t.unitId);
    return lang === 'ar'
      ? `• ${t.name} — وحدة ${u?.number || '—'} — ${t.phone}`
      : `• ${t.name} — unit ${u?.number || '—'} — ${t.phone}`;
  });
  return {
    text: lang === 'ar'
      ? `أرقام الجوال المحفوظة (${withPhone.length}/${state.tenants.length}) · ناقص ${without}:\n${lines.join('\n') || '—'}\n\nاسأل: «جوال [الاسم]» أو «جوال وحدة 12».`
      : `Saved phones (${withPhone.length}/${state.tenants.length}) · missing ${without}:\n${lines.join('\n') || '—'}\n\nAsk: “phone [name]” or “phone unit 12”.`,
    suggestions: lang === 'ar' ? ['فجوات البيانات', 'من المتأخر؟'] : ['Data gaps', 'Who is late?'],
  };
}

function contractsAnswer(state: PropertyOSState, q: string, lang: Lang): KowilLocalReply {
  const hits = findTenants(state, q);
  const renewing = state.contracts
    .map((c) => ({ c, days: daysUntil(c.endDate) }))
    .filter((x) => x.days <= 60)
    .sort((a, b) => a.days - b.days);

  if (hits.length >= 1) {
    const blocks = hits.slice(0, 3).map((ctx) => {
      const c = ctx.contract;
      if (!c) {
        return lang === 'ar'
          ? `• ${ctx.tenant.name} (وحدة ${ctx.unit?.number || '—'}): لا يوجد رقم عقد في البيانات`
          : `• ${ctx.tenant.name} (unit ${ctx.unit?.number || '—'}): no contract number in data`;
      }
      const d = daysUntil(c.endDate);
      return lang === 'ar'
        ? `• ${ctx.tenant.name} — وحدة ${ctx.unit?.number || '—'}\n  رقم العقد: ${c.number || '—'}\n  من ${c.startDate || '—'} إلى ${c.endDate || '—'} (${d < 0 ? `منتهٍ منذ ${Math.abs(d)} يوم` : `يتبقى ${d} يوم`})\n  الإيجار: ${money(c.rentAmount, lang)} ر.س · تأمين ${money(c.depositAmount, lang)} ر.س`
        : `• ${ctx.tenant.name} — unit ${ctx.unit?.number || '—'}\n  Contract no.: ${c.number || '—'}\n  ${c.startDate || '—'} → ${c.endDate || '—'} (${d < 0 ? `expired ${Math.abs(d)}d ago` : `${d}d left`})\n  Rent: ${money(c.rentAmount, lang)} SAR · deposit ${money(c.depositAmount, lang)} SAR`;
    });
    return {
      text: blocks.join('\n\n'),
      suggestions: lang === 'ar' ? ['أرسل تذكير', 'رابط بوابة', 'العقود القريبة'] : ['Send reminder', 'Portal link', 'Expiring contracts'],
    };
  }

  if (!state.contracts.length) {
    return {
      text: lang === 'ar'
        ? 'لا توجد عقود محفوظة بعد الاستيراد. قد يحتاج الكشف عمود رقم/تاريخ عقد، أو إضافتها يدويًا.'
        : 'No contracts saved after import. The sheet may lack contract number/dates, or add them manually.',
      suggestions: lang === 'ar' ? ['فجوات البيانات', 'ملخص العقار'] : ['Data gaps', 'Property summary'],
    };
  }

  const lines = state.contracts.slice(0, 12).map((c) => {
    const t = state.tenants.find((x) => x.id === c.tenantId);
    const u = unitOf(state, c.unitId);
    const d = daysUntil(c.endDate);
    return lang === 'ar'
      ? `• ${c.number || '—'} — ${t?.name || '—'} — وحدة ${u?.number || '—'} — ينتهي ${c.endDate || '—'} (${d < 0 ? 'منتهٍ' : `${d}ي`})`
      : `• ${c.number || '—'} — ${t?.name || '—'} — unit ${u?.number || '—'} — ends ${c.endDate || '—'} (${d < 0 ? 'expired' : `${d}d`})`;
  });

  const renewLines = renewing.slice(0, 5).map(({ c, days }) => {
    const t = state.tenants.find((x) => x.id === c.tenantId);
    return lang === 'ar'
      ? `  – ${t?.name || '—'} · ${c.number || '—'} · ${days < 0 ? `منتهٍ ${Math.abs(days)}ي` : `${days}ي`}`
      : `  – ${t?.name || '—'} · ${c.number || '—'} · ${days < 0 ? `expired ${Math.abs(days)}d` : `${days}d`}`;
  });

  return {
    text: lang === 'ar'
      ? `العقود (${state.contracts.length}):\n${lines.join('\n')}`
        + (renewLines.length ? `\n\nقرب التجديد/الانتهاء:\n${renewLines.join('\n')}` : '')
        + `\n\nاسأل: «رقم عقد [الاسم]» أو «عقد وحدة 12».`
      : `Contracts (${state.contracts.length}):\n${lines.join('\n')}`
        + (renewLines.length ? `\n\nExpiring/expired:\n${renewLines.join('\n')}` : '')
        + `\n\nAsk: “contract [name]” or “contract unit 12”.`,
    suggestions: lang === 'ar' ? ['رقم عقد', 'فجوات البيانات', 'ملخص العقار'] : ['Contract number', 'Data gaps', 'Property summary'],
  };
}

function portalAnswer(state: PropertyOSState, q: string, lang: Lang): KowilLocalReply {
  if (/فني|tech|technician/i.test(q)) {
    const token = state.technicianPortalToken || '';
    if (!token) {
      return {
        text: lang === 'ar'
          ? 'لا يوجد رمز بوابة فني بعد. أنشئه من إعدادات البوابات / الفنيين.'
          : 'No technician portal token yet. Create it from portals / technicians setup.',
        suggestions: lang === 'ar' ? ['ملخص العقار'] : ['Property summary'],
      };
    }
    const link = buildTechPortalLink(token);
    return {
      text: lang === 'ar'
        ? `رابط بوابة الفني:\n${link.url}`
        : `Technician portal link:\n${link.url}`,
      suggestions: lang === 'ar' ? ['رابط مستأجر', 'ماذا أفعل اليوم؟'] : ['Tenant portal', 'What should I do today?'],
    };
  }

  const hits = findTenants(state, q);
  const list = hits.length ? hits : state.tenants.slice(0, 5).map((t) => ctxFor(state, t));
  if (!list.length) {
    return {
      text: lang === 'ar' ? 'لا مستأجرين لإنشاء روابط بوابة.' : 'No tenants to build portal links for.',
      suggestions: lang === 'ar' ? ['ملخص العقار'] : ['Property summary'],
    };
  }

  if (hits.length === 1 || (/رابط|portal|بوابة/i.test(q) && hits.length === 1)) {
    const ctx = list[0];
    const portal = portalFor(state, ctx);
    if (!portal.url) {
      return {
        text: lang === 'ar'
          ? `لا يوجد رابط بوابة لـ «${ctx.tenant.name}» بعد.`
          : `No portal link for «${ctx.tenant.name}» yet.`,
        suggestions: lang === 'ar' ? ['فجوات البيانات'] : ['Data gaps'],
      };
    }
    const link = waLink(ctx.tenant.phone, portal.message || portal.url);
    return {
      text: lang === 'ar'
        ? `بوابة «${ctx.tenant.name}» (وحدة ${ctx.unit?.number || '—'}):\n${portal.url}`
          + (portal.message ? `\n\nرسالة جاهزة:\n${portal.message}` : '')
          + (link ? `\n\nافتح واتساب:\n${link}` : '\n\n(لا جوال — انسخ الرابط يدويًا)')
          + `\n\nأو نفّذ من مكتب الموظف الذكي مهمة «إرسال رابط البوابة».`
        : `Portal for «${ctx.tenant.name}» (unit ${ctx.unit?.number || '—'}):\n${portal.url}`
          + (portal.message ? `\n\nReady message:\n${portal.message}` : '')
          + (link ? `\n\nOpen WhatsApp:\n${link}` : '\n\n(No phone — copy the link manually)')
          + `\n\nOr run “send portal link” from the Smart Employee desk.`,
      suggestions: lang === 'ar' ? ['أرسل تذكير', 'جوال', 'ماذا أفعل اليوم؟'] : ['Send reminder', 'Phone', 'What should I do today?'],
    };
  }

  const lines = list.slice(0, 6).map((ctx) => {
    const portal = portalFor(state, ctx);
    return lang === 'ar'
      ? `• ${ctx.tenant.name} — وحدة ${ctx.unit?.number || '—'}\n  ${portal.url || 'بدون رابط'}`
      : `• ${ctx.tenant.name} — unit ${ctx.unit?.number || '—'}\n  ${portal.url || 'no link'}`;
  });
  return {
    text: lang === 'ar'
      ? `روابط البوابات:\n${lines.join('\n')}\n\nحدّد مستأجرًا: «رابط بوابة سامي».`
      : `Portal links:\n${lines.join('\n')}\n\nSpecify: “portal link for Sami”.`,
    suggestions: list.slice(0, 3).map((c) => (lang === 'ar' ? `رابط بوابة ${c.tenant.name}` : `Portal ${c.tenant.name}`)),
  };
}

function reminderAnswer(state: PropertyOSState, q: string, lang: Lang, emp?: SmartEmployeeState | null): KowilLocalReply {
  let targets = findTenants(state, q);
  if (!targets.length && /متأخر|late|arrear|overdue|الجميع|all/i.test(q)) {
    const truthIds = new Set(
      (state.paymentLedger || [])
        .filter(isArrearsLedgerEntry)
        .map((r) => r.tenantId),
    );
    targets = state.tenants.filter((t) => truthIds.has(t.id)).map((t) => ctxFor(state, t));
  }
  if (!targets.length) {
    // Prefer employee collect tasks
    const tasks = (emp?.tasks || []).filter(
      (t) => (t.kind === 'collect_arrears' || t.kind === 'escalate_collection')
        && (t.status === 'suggested' || t.status === 'in_progress' || t.status === 'waiting_followup')
        && t.whatsappMessage,
    );
    if (tasks.length) {
      const lines = tasks.slice(0, 4).map((t, i) => {
        const link = t.whatsappPhone ? waLink(t.whatsappPhone, t.whatsappMessage || '') : null;
        return lang === 'ar'
          ? `${i + 1}. ${t.titleAr}\n${t.whatsappMessage}${link ? `\nواتساب: ${link}` : ''}`
          : `${i + 1}. ${t.titleEn}\n${t.whatsappMessage}${link ? `\nWhatsApp: ${link}` : ''}`;
      });
      return {
        text: lang === 'ar'
          ? `تذكيرات جاهزة من مكتب الموظف:\n\n${lines.join('\n\n')}\n\nاضغط تشغيل في تبويب الموظف الذكي لإرسالها.`
          : `Ready reminders from the employee desk:\n\n${lines.join('\n\n')}\n\nTap Run on the Smart Employee tab to send.`,
        suggestions: lang === 'ar' ? ['ماذا أفعل اليوم؟', 'من المتأخر؟'] : ['What should I do today?', 'Who is late?'],
      };
    }
    return {
      text: lang === 'ar'
        ? 'حدّد المستأجر أو الوحدة لإعداد التذكير، أو قل «أرسل تذكير للمتأخر».'
        : 'Name a tenant/unit for a reminder, or say “remind late tenants”.',
      suggestions: lang === 'ar' ? ['من المتأخر؟', 'ماذا أفعل اليوم؟'] : ['Who is late?', 'What should I do today?'],
    };
  }

  const blocks = targets.slice(0, 5).map((ctx, i) => {
    const msg = draftReminder(ctx, lang);
    const link = waLink(ctx.tenant.phone, msg);
    if (lang === 'ar') {
      return (
        `${i + 1}. تذكير لـ ${ctx.tenant.name} — وحدة ${ctx.unit?.number || '—'} — متأخر ${money(ctx.arrears, lang)} ر.س\n`
        + `الجوال: ${digits(ctx.tenant.phone) ? ctx.tenant.phone : 'غير متوفر'}\n`
        + `الرسالة:\n${msg}`
        + (link ? `\n\nرابط الإرسال:\n${link}` : '\n\n(أضف الجوال أولاً ثم أعد الطلب)')
      );
    }
    return (
      `${i + 1}. Reminder for ${ctx.tenant.name} — unit ${ctx.unit?.number || '—'} — arrears ${money(ctx.arrears, lang)} SAR\n`
      + `Phone: ${digits(ctx.tenant.phone) ? ctx.tenant.phone : 'missing'}\n`
      + `Message:\n${msg}`
      + (link ? `\n\nSend link:\n${link}` : '\n\n(Add a phone first, then retry)')
    );
  });

  return {
    text: lang === 'ar'
      ? `${blocks.join('\n\n—\n\n')}\n\nكويل جهّز الرسالة والرابط. الإرسال يتم عبر واتساب أو زر تشغيل في مكتب الموظف (لا إرسال خفي من السيرفر).`
      : `${blocks.join('\n\n—\n\n')}\n\nKowil drafted the message and link. Send via WhatsApp or Run on the employee desk (no silent server send).`,
    suggestions: lang === 'ar'
      ? ['رابط بوابة', 'ماذا أفعل اليوم؟', 'من المتأخر؟']
      : ['Portal link', 'What should I do today?', 'Who is late?'],
  };
}

function vacancies(state: PropertyOSState, lang: Lang): KowilLocalReply {
  const vacant = state.units.filter((u) => u.status === 'vacant');
  if (!vacant.length) {
    return {
      text: lang === 'ar' ? 'لا وحدات شاغرة ظاهرة حاليًا.' : 'No vacant units visible right now.',
      suggestions: lang === 'ar' ? ['ملخص العقار', 'العقود'] : ['Property summary', 'Contracts'],
    };
  }
  const lines = vacant.slice(0, 15).map((u) => (lang === 'ar'
    ? `• وحدة ${u.number} — إيجار ${money(u.rentAmount, lang)} ر.س`
    : `• Unit ${u.number} — rent ${money(u.rentAmount, lang)} SAR`));
  return {
    text: lang === 'ar'
      ? `الشواغر (${vacant.length}):\n${lines.join('\n')}\n\nتابع التسويق من مكتب الموظف أو قاعدة البيانات.`
      : `Vacancies (${vacant.length}):\n${lines.join('\n')}\n\nFollow up from the employee desk or database.`,
    suggestions: lang === 'ar' ? ['ماذا أفعل اليوم؟', 'ملخص العقار'] : ['What should I do today?', 'Property summary'],
  };
}

function dataGaps(state: PropertyOSState, lang: Lang): KowilLocalReply {
  const noPhone = state.tenants.filter((t) => !digits(t.phone));
  const noContract = state.tenants.filter((t) => !contractOf(state, t.id, t.unitId));
  const noPortal = state.tenants.filter((t) => !t.portalUrl && !t.portalToken);
  const emptyContractNumber = state.contracts.filter((c) => !String(c.number || '').trim());
  const noLedger = !(state.paymentLedger && state.paymentLedger.length);

  const lines: string[] = [];
  if (lang === 'ar') {
    lines.push(`فجوات البيانات في «${state.property?.name || 'العقار'}»:`);
    lines.push(`• بدون جوال: ${noPhone.length}`);
    noPhone.slice(0, 6).forEach((t) => {
      lines.push(`  – ${t.name} · وحدة ${unitOf(state, t.unitId)?.number || '—'}`);
    });
    lines.push(`• مستأجر بلا عقد مربوط: ${noContract.length}`);
    noContract.slice(0, 6).forEach((t) => {
      lines.push(`  – ${t.name} · وحدة ${unitOf(state, t.unitId)?.number || '—'}`);
    });
    lines.push(`• عقود بلا رقم: ${emptyContractNumber.length}`);
    lines.push(`• بدون رابط بوابة: ${noPortal.length}`);
    if (noLedger) lines.push('• دفتر الأشهر فارغ — الموجز الشهري المفصّل غير متاح حتى الاستيراد.');
    lines.push('\nأكمل النواقص من قاعدة البيانات / السجل الرسمي، ثم اسأل كويل مجددًا.');
  } else {
    lines.push(`Data gaps for «${state.property?.name || 'property'}»:`);
    lines.push(`• Missing phone: ${noPhone.length}`);
    noPhone.slice(0, 6).forEach((t) => {
      lines.push(`  – ${t.name} · unit ${unitOf(state, t.unitId)?.number || '—'}`);
    });
    lines.push(`• Tenant without linked contract: ${noContract.length}`);
    noContract.slice(0, 6).forEach((t) => {
      lines.push(`  – ${t.name} · unit ${unitOf(state, t.unitId)?.number || '—'}`);
    });
    lines.push(`• Contracts without number: ${emptyContractNumber.length}`);
    lines.push(`• Missing portal link: ${noPortal.length}`);
    if (noLedger) lines.push('• Monthly ledger empty — detailed monthly summary needs import.');
    lines.push('\nFill gaps in the database / official registry, then ask Kowil again.');
  }

  return {
    text: lines.join('\n'),
    suggestions: lang === 'ar'
      ? ['جوال مستأجر', 'العقود', 'موجز شهري']
      : ['Tenant phone', 'Contracts', 'Monthly summary'],
  };
}

function occupancyMoves(state: PropertyOSState, lang: Lang): KowilLocalReply {
  const moves = state.occupancyMoves || [];
  const history = state.unitHistory || [];
  if (!moves.length && !history.length) {
    return {
      text: lang === 'ar'
        ? 'لا توجد حركة مغادرة/دخول محفوظة بعد. تظهر بعد استيراد كشوف متتالية.'
        : 'No occupancy moves saved yet. They appear after consecutive statement imports.',
      suggestions: lang === 'ar' ? ['موجز شهري', 'ملخص العقار'] : ['Monthly summary', 'Property summary'],
    };
  }
  const lines: string[] = [];
  for (const mv of moves.slice(-3)) {
    lines.push(lang === 'ar' ? `فترة ${mv.period || mv.at.slice(0, 10)}:` : `Period ${mv.period || mv.at.slice(0, 10)}:`);
    mv.departed.slice(0, 8).forEach((d) => {
      lines.push(lang === 'ar'
        ? `  ← غادر: ${d.tenant} · وحدة ${d.unit}${d.phone ? ` · ${d.phone}` : ''}`
        : `  ← left: ${d.tenant} · unit ${d.unit}${d.phone ? ` · ${d.phone}` : ''}`);
    });
    mv.newcomers.slice(0, 8).forEach((n) => {
      lines.push(lang === 'ar'
        ? `  → دخل: ${n.tenant} · وحدة ${n.unit}${n.phone ? ` · ${n.phone}` : ''}`
        : `  → entered: ${n.tenant} · unit ${n.unit}${n.phone ? ` · ${n.phone}` : ''}`);
    });
  }
  if (!moves.length && history.length) {
    history.slice(0, 8).forEach((h) => {
      const u = unitOf(state, h.unitId);
      lines.push(lang === 'ar'
        ? `• تاريخ: ${h.tenantName} غادر وحدة ${u?.number || '—'} (${h.endedAt.slice(0, 10)})`
        : `• History: ${h.tenantName} left unit ${u?.number || '—'} (${h.endedAt.slice(0, 10)})`);
    });
  }
  return {
    text: lines.join('\n'),
    suggestions: lang === 'ar' ? ['موجز شهري', 'الشواغر'] : ['Monthly summary', 'Vacancies'],
  };
}

/** Always returns a reply — never null. */
export function answerKowilLocal(
  text: string,
  state: PropertyOSState,
  lang: Lang,
  employee?: SmartEmployeeState | null,
): KowilLocalReply {
  const q = String(text || '').trim();
  if (!q) return help(lang);

  if (/^(مرحبا|أهلا|السلام|hi|hello|hey)\b/i.test(q) || q.length <= 2) {
    return greetings(lang);
  }
  if (/مساعد|كيف.*(استخدم|أبدأ|ابدأ)|help|what can you|ماذا تستطيع|قدراتك/i.test(q)) {
    return help(lang);
  }
  if (/ماذا أفعل|مهام اليوم|خطة العمل|what should i do|today.?work|my tasks|مهام الموظف|موظف ذكي/i.test(q)) {
    return todayWork(employee || undefined, lang);
  }
  if (!state.property && state.units.length === 0 && state.tenants.length === 0) {
    return emptyProperty(lang);
  }

  // Detailed intents first (before generic summary)
  if (/فجوات|نواق|ناقص|data gap|missing (phone|data|contract)|بدون جوال/i.test(q)) {
    return dataGaps(state, lang);
  }
  if (/موجز\s*شهر|تفصيل\s*شهر|شهري\s*مفصل|monthly|ledger|دفتر\s*الأشهر|حسب\s*الشهر/i.test(q)) {
    return monthlyDetail(state, lang);
  }
  if (/جوال|هاتف|رقم\s*الجوال|phone|mobile|whats?app\s*number/i.test(q)) {
    return phonesAnswer(state, q, lang);
  }
  if (/رقم\s*العقد|عقد\s*رقم|رقم\s*عقد|contract\s*(no|number|#)?|العقود|تجديد|منته[يةي]?|انته[ىي]|expir/i.test(q)) {
    return contractsAnswer(state, q, lang);
  }
  if (/رابط|بوابة|portal|share\s*link|qr/i.test(q)) {
    return portalAnswer(state, q, lang);
  }
  if (/تذكير|ذكّر|ذكر|أرسل.*(واتس|whats)|remind|send (whats?app|reminder)|تحصيل/i.test(q)) {
    return reminderAnswer(state, q, lang, employee);
  }
  if (/شاغر|الشواغر|vacan|empty unit/i.test(q)) {
    return vacancies(state, lang);
  }
  if (/مغادر|دخل|newcomer|depart|حركة|occupancy\s*move|إخلاء|إسكان/i.test(q)) {
    return occupancyMoves(state, lang);
  }
  if (/ملف|تفاصيل\s*المستأجر|tenant\s*(file|detail)|عن\s*المستأجر/i.test(q)
    || (findTenants(state, q).length === 1 && /من\s+هو|who\s+is|معلومات/i.test(q))) {
    const hits = findTenants(state, q);
    if (hits.length === 1) return tenantDetail(hits[0], state, lang);
    if (hits.length > 1) {
      return {
        text: lang === 'ar'
          ? `أي مستأجر؟\n${hits.map((h) => `• ${h.tenant.name} — وحدة ${h.unit?.number || '—'}`).join('\n')}`
          : `Which tenant?\n${hits.map((h) => `• ${h.tenant.name} — unit ${h.unit?.number || '—'}`).join('\n')}`,
        suggestions: hits.slice(0, 3).map((h) => (lang === 'ar' ? `ملف ${h.tenant.name}` : `File ${h.tenant.name}`)),
      };
    }
  }

  // Named tenant shorthand: query is mostly a name
  const named = findTenants(state, q);
  if (named.length === 1 && q.length <= 48 && !/ملخص|تقرير|كم|summary|report|how many/i.test(q)) {
    return tenantDetail(named[0], state, lang);
  }

  if (/ملخص|وضع العقار|حالة العقار|summary|status|overview|dashboard/i.test(q)) {
    return summary(state, lang);
  }
  if (/كم\s*مستأجر|عدد المستأجر|how many tenant|tenant count|المستأجرون/i.test(q)) {
    return counts(state, lang, 'tenants');
  }
  if (/كم\s*وحدة|عدد الوحد|how many unit|unit count|الوحدات/i.test(q)) {
    return counts(state, lang, 'units');
  }
  if (/من المتأخر|المتأخر|متأخرات|arrear|who.*(late|owe)|overdue/i.test(q)) {
    return arrears(state, lang);
  }
  if (/تقرير|report/i.test(q)) {
    // Prefer monthly when ledger exists
    if ((state.paymentLedger || []).length) return monthlyDetail(state, lang);
    return summary(state, lang);
  }
  if (/اسم العقار|property name|ما اسم/i.test(q)) {
    const name = state.property?.name || '—';
    return {
      text: lang === 'ar' ? `اسم العقار: ${name}` : `Property name: ${name}`,
      suggestions: lang === 'ar' ? ['ملخص العقار', 'موجز شهري'] : ['Property summary', 'Monthly summary'],
    };
  }

  // Default grounded snapshot — never “I couldn’t reach…”
  return summary(state, lang);
}
