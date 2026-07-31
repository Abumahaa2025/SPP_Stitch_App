/**
 * Local daily-operations assistant — uses persisted Property OS data.
 * Understands natural Arabic/English, summarizes, confirms before actions.
 */
import type {
  ContractRecord, PropertyOSState, TenantRecord, UnitRecord, UnitHistoryEntry,
} from '@/src/types/property-os';
import { onNotificationPrepared, onRenewalSuggested } from '@/src/utils/operational-flow-engine';
import { arrearsFromPropertyOS, isArrearsLedgerEntry } from '@/src/utils/ops-truth';

export type OpsChoice = {
  id: string;
  labelKey: string;
};

export type OpsPending = {
  kind:
    | 'contract_end_choice'
    | 'whatsapp_preview'
    | 'payment_confirm'
    | 'technician_link'
    | 'maintenance_confirm'
    | 'generic_confirm';
  unitId?: string;
  tenantId?: string;
  contractId?: string;
  whatsappMessage?: string;
  phone?: string;
  maintenanceTitle?: string;
  unitNumber?: string;
  choices?: OpsChoice[];
  actionLabel?: string;
};

export type OpsReply = {
  text: string;
  pending?: OpsPending;
  suggestions?: string[];
};

export type OpsMutations = {
  endContract: (contractId: string, unitId: string, tenant: TenantRecord) => void;
  recordPayment: (unitId: string, tenantId: string, amount: number) => void;
  getState: () => PropertyOSState;
  ensureTechnicianPortal?: () => string;
  openMaintenanceTicket?: (
    unitId: string,
    title: string,
    tenantId?: string,
    unitNumber?: string,
  ) => void | Promise<void>;
};

const AR_YES = /^(نعم|أكد|أرسل|موافق|تم|yes|ok|send|confirm)/i;
const AR_NO = /^(لا|إلغاء|cancel|no)/i;

function extractUnitNumber(text: string): string | null {
  const patterns = [
    /(?:شقة|وحدة|unit|apt|apartment)\s*[#:]?\s*(\d+)/i,
    /(\d+)\s*(?:شقة|وحدة)/,
    /^(\d+)$/,
  ];
  for (const p of patterns) {
    const m = text.match(p);
    if (m?.[1]) return m[1];
  }
  return null;
}

function findUnit(state: PropertyOSState, num: string): UnitRecord | undefined {
  return state.units.find((u) => u.number === num || u.number === String(Number(num)));
}

function tenantForUnit(state: PropertyOSState, unitId: string): TenantRecord | undefined {
  return state.tenants.find((t) => t.unitId === unitId);
}

function activeContract(state: PropertyOSState, unitId: string, tenantId?: string): ContractRecord | undefined {
  return state.contracts.find((c) => {
    if (c.unitId !== unitId) return false;
    if (tenantId && c.tenantId !== tenantId) return false;
    return new Date(c.endDate).getTime() >= Date.now() - 86400000 * 30;
  }) ?? state.contracts.find((c) => c.unitId === unitId);
}

function unitHistoryNote(state: PropertyOSState, unitId: string, lang: 'ar' | 'en'): string {
  const hist = (state.unitHistory ?? []).filter((h) => h.unitId === unitId);
  const last = hist[hist.length - 1];
  if (!last) return '';
  if (lang === 'ar') {
    let s = `\n\nملاحظة: المستأجر السابق كان ${last.tenantName}`;
    if (last.lateAmount) s += ` وعليه متأخرات ${last.lateAmount.toLocaleString('ar-SA')} ريال`;
    if (last.followUpCount) s += ` وتمت متابعته ${last.followUpCount} مرات`;
    s += '.';
    return s;
  }
  let s = `\n\nNote: Previous tenant was ${last.tenantName}`;
  if (last.lateAmount) s += ` with ${last.lateAmount} SAR outstanding`;
  if (last.followUpCount) s += `, followed up ${last.followUpCount} times`;
  return `${s}.`;
}

function fmtDate(d: string, lang: 'ar' | 'en') {
  try {
    return new Date(d).toLocaleDateString(lang === 'ar' ? 'ar-SA' : 'en-US');
  } catch {
    return d;
  }
}

function isContractEndQuery(text: string) {
  return /خلص|انتهى|انتهاء|انتهت|ended|expir|finish/i.test(text) && /عقد|contract|شقة|وحدة|\d/.test(text);
}

function isPaymentQuery(text: string) {
  return /دفع|سدد|paid|payment|تحصيل/i.test(text);
}

function isTechnicianQuery(text: string) {
  return /فني|technician|رابط الفني|ربط فني/i.test(text);
}

function isMaintenanceOpenQuery(text: string) {
  return /(?:فتح|أنشئ|انشئ|سجّل|سجل).*(?:بلاغ|صيانة)|(?:بلاغ|طلب)\s*صيانة|maintenance\s*(?:ticket|request)|open\s+(?:a\s+)?ticket/i.test(text);
}

function extractMaintenanceTitle(text: string, lang: 'ar' | 'en'): string {
  const stripped = text
    .replace(/(?:شقة|وحدة|unit|apt|apartment)\s*[#:]?\s*\d+/gi, '')
    .replace(/(?:فتح|أنشئ|انشئ|سجّل|سجل)\s*(?:بلاغ|طلب)?\s*صيانة?/gi, '')
    .replace(/maintenance\s*(?:ticket|request)?/gi, '')
    .replace(/open\s+(?:a\s+)?ticket/gi, '')
    .trim();
  if (stripped.length >= 3) return stripped.slice(0, 120);
  return lang === 'ar' ? 'بلاغ صيانة' : 'Maintenance request';
}

function isReminderQuery(text: string) {
  return /تذكير|remind|متأخر/i.test(text);
}

function isReportQuery(text: string) {
  return /تقرير|report/i.test(text);
}

function isMostLateQuery(text: string) {
  return /أكثر.*تأخر|most.*late|مين.*متأخر/i.test(text);
}

function isArrearsQuery(text: string) {
  return /متأخر|متبقي|متأخرات|مستحق|arrear|overdue|outstanding|unpaid|who.*(late|owe)|كم.*(باقي|متبقي)/i.test(text);
}

/**
 * Bug-6: answer arrears/late questions from PropertyOS ledger (Source of Truth)
 * before deferring to the LLM. Lists late tenants with real remaining amounts.
 */
function buildArrearsReply(state: PropertyOSState, lang: 'ar' | 'en'): OpsReply {
  const truth = arrearsFromPropertyOS(state);
  const ledger = (state.paymentLedger || []).filter(isArrearsLedgerEntry);

  if (!ledger.length) {
    return {
      text: lang === 'ar'
        ? 'لا توجد متأخرات مؤكدة في بيانات العقار الحالية.'
        : 'No confirmed arrears in the current property data.',
    };
  }

  // Aggregate remaining per tenant from the ledger.
  const byTenant = new Map<string, { name: string; unit: string; total: number; months: number }>();
  ledger.forEach((l) => {
    const prev = byTenant.get(l.tenantId) || { name: l.tenant || '—', unit: l.unit || '—', total: 0, months: 0 };
    prev.total += Number(l.remaining) || 0;
    prev.months += 1;
    byTenant.set(l.tenantId, prev);
  });
  const rows = [...byTenant.values()].sort((a, b) => b.total - a.total);

  const lines = rows.slice(0, 12).map((r) => (lang === 'ar'
    ? `• ${r.name} — وحدة ${r.unit} — ${r.total.toLocaleString('ar-SA')} ريال (${r.months} شهر)`
    : `• ${r.name} — unit ${r.unit} — ${r.total.toLocaleString()} SAR (${r.months} mo)`));

  const header = lang === 'ar'
    ? `المتأخرات من بيانات العقار: ${truth.lateTenantCount} مستأجر · ${truth.totalUnpaid.toLocaleString('ar-SA')} ريال`
    : `Arrears from property data: ${truth.lateTenantCount} tenant(s) · ${truth.totalUnpaid.toLocaleString()} SAR`;

  return {
    text: `${header}\n${lines.join('\n')}`,
    suggestions: lang === 'ar' ? ['أرسل تذكير للمتأخرين', 'تقرير العقار'] : ['Send reminders', 'Property report'],
  };
}

function buildContractEndReply(
  state: PropertyOSState,
  unit: UnitRecord,
  lang: 'ar' | 'en',
): OpsReply {
  const tenant = tenantForUnit(state, unit.id);
  const contract = activeContract(state, unit.id, tenant?.id);
  const hist = unitHistoryNote(state, unit.id, lang);

  if (lang === 'ar') {
    const tenantName = tenant?.name ?? '—';
    const end = contract ? fmtDate(contract.endDate, lang) : '—';
    return {
      text: `وجدت الوحدة ${unit.number}. المستأجر الحالي: ${tenantName}. العقد ينتهي بتاريخ ${end}.${hist}\n\nهل تريد:\n1️⃣ تسجيل انتهاء العقد\n2️⃣ إرسال تنبيه للمستأجر\n3️⃣ إضافة مستأجر جديد لاحقًا`,
      pending: {
        kind: 'contract_end_choice',
        unitId: unit.id,
        tenantId: tenant?.id,
        contractId: contract?.id,
        choices: [
          { id: 'end', labelKey: 'ops.choice.endContract' },
          { id: 'alert', labelKey: 'ops.choice.sendAlert' },
          { id: 'new_tenant', labelKey: 'ops.choice.newTenantLater' },
        ],
      },
      suggestions: ['تسجيل انتهاء العقد', 'إرسال تنبيه', 'لا شكرًا'],
    };
  }

  return {
    text: `Found unit ${unit.number}. Current tenant: ${tenant?.name ?? '—'}. Contract ends ${contract ? fmtDate(contract.endDate, lang) : '—'}.${hist}\n\nWould you like to:\n1️⃣ Record contract end\n2️⃣ Send tenant alert\n3️⃣ Add new tenant later`,
    pending: {
      kind: 'contract_end_choice',
      unitId: unit.id,
      tenantId: tenant?.id,
      contractId: contract?.id,
      choices: [
        { id: 'end', labelKey: 'ops.choice.endContract' },
        { id: 'alert', labelKey: 'ops.choice.sendAlert' },
        { id: 'new_tenant', labelKey: 'ops.choice.newTenantLater' },
      ],
    },
    suggestions: ['Record contract end', 'Send alert', 'No thanks'],
  };
}

function buildPaymentReply(state: PropertyOSState, unit: UnitRecord, lang: 'ar' | 'en'): OpsReply {
  const tenant = tenantForUnit(state, unit.id);
  if (!tenant) {
    return {
      text: lang === 'ar'
        ? `الوحدة ${unit.number} لا يوجد لها مستأجر مسجّل حاليًا.`
        : `Unit ${unit.number} has no registered tenant.`,
    };
  }
  const amount = unit.rentAmount;
  if (lang === 'ar') {
    return {
      text: `الوحدة ${unit.number} — المستأجر ${tenant.name}.\nالإيجار الشهري: ${amount.toLocaleString('ar-SA')} ريال.\n\nهل تريد تسجيل دفعة بقيمة ${amount.toLocaleString('ar-SA')} ريال؟`,
      pending: {
        kind: 'payment_confirm',
        unitId: unit.id,
        tenantId: tenant.id,
        actionLabel: `payment:${amount}`,
      },
      suggestions: ['نعم، سجّل الدفعة', 'لا'],
    };
  }
  return {
    text: `Unit ${unit.number} — tenant ${tenant.name}.\nMonthly rent: ${amount}.\n\nRecord payment of ${amount}?`,
    pending: {
      kind: 'payment_confirm',
      unitId: unit.id,
      tenantId: tenant.id,
      actionLabel: `payment:${amount}`,
    },
    suggestions: ['Yes, record payment', 'No'],
  };
}

function buildReminderReply(state: PropertyOSState, lang: 'ar' | 'en'): OpsReply {
  const late = state.tenants.filter((t) => {
    const unit = state.units.find((u) => u.id === t.unitId);
    return unit && unit.status === 'occupied';
  });
  if (!late.length) {
    return { text: lang === 'ar' ? 'لا يوجد مستأجرون متأخرون حاليًا.' : 'No late tenants right now.' };
  }
  const lines = late.map((t) => {
    const u = state.units.find((x) => x.id === t.unitId);
    return lang === 'ar'
      ? `• ${t.name} — وحدة ${u?.number ?? '?'} — ${u?.rentAmount.toLocaleString('ar-SA')} ريال`
      : `• ${t.name} — unit ${u?.number ?? '?'} — ${u?.rentAmount}`;
  });
  const msg = lang === 'ar'
    ? `سأرسل تذكير واتساب للمتأخرين:\n${lines.join('\n')}\n\nمعاينة الرسالة:\n«تذكير: يرجى سداد الإيجار في أقرب وقت.»\n\nهل أرسل؟`
    : `WhatsApp reminder preview for:\n${lines.join('\n')}\n\n«Reminder: please settle rent soon.»\n\nSend?`;
  return {
    text: msg,
    pending: {
      kind: 'whatsapp_preview',
      whatsappMessage: lang === 'ar'
        ? 'تذكير: يرجى سداد الإيجار في أقرب وقت.'
        : 'Reminder: please settle rent soon.',
      actionLabel: 'bulk_reminder',
    },
    suggestions: lang === 'ar' ? ['نعم، أرسل', 'لا'] : ['Yes, send', 'No'],
  };
}

function buildReportReply(state: PropertyOSState, lang: 'ar' | 'en'): OpsReply {
  const occ = state.units.filter((u) => u.status === 'occupied').length;
  const total = state.units.length || 1;
  const revenue = state.units.reduce((s, u) => s + (u.status === 'occupied' ? u.rentAmount : 0), 0);
  if (lang === 'ar') {
    return {
      text: `تقرير ${state.property?.name ?? 'المحفظة'} — هذا الشهر:\n• الوحدات: ${state.units.length}\n• الإشغال: ${Math.round((occ / total) * 100)}%\n• الإيراد الشهري المتوقع: ${revenue.toLocaleString('ar-SA')} ريال\n• المستأجرون: ${state.tenants.length}\n• العقود النشطة: ${state.contracts.length}`,
      suggestions: ['أرسل التقرير PDF', 'من الأكثر تأخرًا؟'],
    };
  }
  return {
    text: `Report for ${state.property?.name ?? 'portfolio'}:\n• Units: ${state.units.length}\n• Occupancy: ${Math.round((occ / total) * 100)}%\n• Expected monthly: ${revenue}\n• Tenants: ${state.tenants.length}\n• Contracts: ${state.contracts.length}`,
  };
}

function buildMostLateReply(state: PropertyOSState, lang: 'ar' | 'en'): OpsReply {
  // Bug-6: prefer the live PropertyOS ledger (SoT) over legacy unitHistory.
  const ledger = (state.paymentLedger || []).filter(isArrearsLedgerEntry);
  if (ledger.length) {
    const byTenant = new Map<string, { name: string; unit: string; total: number }>();
    ledger.forEach((l) => {
      const prev = byTenant.get(l.tenantId) || { name: l.tenant || '—', unit: l.unit || '—', total: 0 };
      prev.total += Number(l.remaining) || 0;
      byTenant.set(l.tenantId, prev);
    });
    const top = [...byTenant.values()].sort((a, b) => b.total - a.total)[0];
    if (top) {
      return {
        text: lang === 'ar'
          ? `الأكثر تأخرًا: ${top.name} — وحدة ${top.unit} — ${top.total.toLocaleString('ar-SA')} ريال`
          : `Most late: ${top.name} — unit ${top.unit} — ${top.total.toLocaleString()} SAR`,
        suggestions: lang === 'ar' ? ['أرسل تذكير للمتأخرين'] : ['Send reminders'],
      };
    }
  }
  const withLate = (state.unitHistory ?? [])
    .filter((h) => h.lateAmount && h.lateAmount > 0)
    .sort((a, b) => (b.lateAmount ?? 0) - (a.lateAmount ?? 0));
  if (withLate.length) {
    const top = withLate[0];
    const unit = state.units.find((u) => u.id === top.unitId);
    return {
      text: lang === 'ar'
        ? `الأكثر تأخرًا سابقًا: ${top.tenantName} — وحدة ${unit?.number ?? '?'} — ${top.lateAmount?.toLocaleString('ar-SA')} ريال`
        : `Most late historically: ${top.tenantName} — unit ${unit?.number ?? '?'} — ${top.lateAmount}`,
    };
  }
  return {
    text: lang === 'ar'
      ? 'لا توجد متأخرات مسجّلة. يمكنك قول: «أرسل تذكير للمتأخرين».'
      : 'No late balances on record. Try: "send rent reminders".',
  };
}

function buildMaintenanceOpenReply(
  state: PropertyOSState,
  unit: UnitRecord,
  title: string,
  lang: 'ar' | 'en',
): OpsReply {
  const tenant = tenantForUnit(state, unit.id);
  if (lang === 'ar') {
    return {
      text: `سأفتح بلاغ صيانة للوحدة ${unit.number}:\n«${title}»\n\nهل أؤكد فتح البلاغ وإشعار الفني؟`,
      pending: {
        kind: 'maintenance_confirm',
        unitId: unit.id,
        tenantId: tenant?.id,
        maintenanceTitle: title,
        unitNumber: unit.number,
      },
      suggestions: ['نعم، افتح البلاغ', 'لا'],
    };
  }
  return {
    text: `Open maintenance ticket for unit ${unit.number}:\n«${title}»\n\nConfirm and notify technician?`,
    pending: {
      kind: 'maintenance_confirm',
      unitId: unit.id,
      tenantId: tenant?.id,
      maintenanceTitle: title,
      unitNumber: unit.number,
    },
    suggestions: ['Yes, open ticket', 'No'],
  };
}

function buildTechnicianReply(text: string, state: PropertyOSState, lang: 'ar' | 'en', techLink: string): OpsReply {
  const nameMatch = text.match(/(?:فني|technician)\s+(\S+)/i) ?? text.match(/(\S+)\s+بالبلاغ/);
  const name = nameMatch?.[1] ?? 'محمد';
  const link = techLink;
  if (lang === 'ar') {
    return {
      text: `سأربط الفني ${name} ببلاغ الصيانة.\nرابط البوابة:\n${link}\n\nهل أرسل الرابط للفني عبر واتساب؟`,
      pending: {
        kind: 'technician_link',
        whatsappMessage: `مرحبًا ${name}، رابط بلاغات الصيانة:\n${link}`,
        actionLabel: `tech:${name}`,
      },
      suggestions: ['نعم، أرسل', 'لا'],
    };
  }
  return {
    text: `Link technician ${name} to maintenance.\nPortal:\n${link}\n\nSend via WhatsApp?`,
    pending: { kind: 'technician_link', whatsappMessage: `Hi ${name}, maintenance portal:\n${link}`, actionLabel: `tech:${name}` },
    suggestions: ['Yes, send', 'No'],
  };
}

/** Parse user message into assistant reply (or null → fall back to API). */
export function parseDailyOps(
  text: string,
  state: PropertyOSState,
  lang: 'ar' | 'en',
  mutations?: Pick<OpsMutations, 'ensureTechnicianPortal'>,
): OpsReply | null {
  if (!state.property || state.units.length === 0) return null;

  const trimmed = text.trim();
  const unitNum = extractUnitNumber(trimmed);

  if (isMostLateQuery(trimmed)) return buildMostLateReply(state, lang);
  if (isReportQuery(trimmed)) return buildReportReply(state, lang);
  if (isReminderQuery(trimmed) && !unitNum) return buildReminderReply(state, lang);
  // Bug-6: answer arrears from PropertyOS ledger before LLM (only when we have a ledger).
  if (isArrearsQuery(trimmed) && !unitNum && (state.paymentLedger?.length ?? 0) > 0) {
    return buildArrearsReply(state, lang);
  }

  if (unitNum) {
    const unit = findUnit(state, unitNum);
    if (!unit) {
      return {
        text: lang === 'ar'
          ? `لم أجد وحدة رقم ${unitNum}. الوحدات المتاحة: ${state.units.map((u) => u.number).join('، ')}`
          : `Unit ${unitNum} not found. Available: ${state.units.map((u) => u.number).join(', ')}`,
      };
    }
    if (isContractEndQuery(trimmed)) return buildContractEndReply(state, unit, lang);
    if (isPaymentQuery(trimmed)) return buildPaymentReply(state, unit, lang);
    if (isMaintenanceOpenQuery(trimmed)) {
      return buildMaintenanceOpenReply(state, unit, extractMaintenanceTitle(trimmed, lang), lang);
    }
  }

  if (isMaintenanceOpenQuery(trimmed) && !unitNum) {
    return {
      text: lang === 'ar'
        ? 'أي وحدة؟ مثال: «افتح بلاغ صيانة للشقة 5 — تسريب ماء»'
        : 'Which unit? Example: "open maintenance ticket for unit 5 — water leak"',
    };
  }

  if (isTechnicianQuery(trimmed)) {
    const link = mutations?.ensureTechnicianPortal?.() ?? `https://spp.beta/tech?t=${state.technicianPortalToken || 'pending'}`;
    return buildTechnicianReply(trimmed, state, lang, link);
  }

  if (isContractEndQuery(trimmed) && !unitNum) {
    return {
      text: lang === 'ar'
        ? 'أي وحدة تقصد؟ مثال: «الشقة 5 خلص عقدها»'
        : 'Which unit? Example: "unit 5 contract ended"',
    };
  }

  return null;
}

/** Handle follow-up when pending action exists. */
export function continueDailyOps(
  text: string,
  pending: OpsPending,
  state: PropertyOSState,
  lang: 'ar' | 'en',
  mutations: OpsMutations,
): OpsReply {
  const trimmed = text.trim();

    if (AR_NO.test(trimmed)) {
    return { text: lang === 'ar' ? 'تم الإلغاء. كيف أساعدك؟' : 'Cancelled. How can I help?' };
  }

  if (pending.kind === 'contract_end_choice') {
    const pickEnd = /1|انتهاء|تسجيل|end/i.test(trimmed);
    const pickAlert = /2|تنبيه|alert|إرسال/i.test(trimmed);
    const pickNew = /3|مستأجر جديد|new tenant/i.test(trimmed);

    const tenant = pending.tenantId
      ? state.tenants.find((t) => t.id === pending.tenantId)
      : undefined;
    const unit = pending.unitId ? state.units.find((u) => u.id === pending.unitId) : undefined;

    if (pickEnd && pending.contractId && tenant && unit) {
      mutations.endContract(pending.contractId, unit.id, tenant);
      void onRenewalSuggested(unit.number, tenant.name);
      return {
        text: lang === 'ar'
          ? `✅ تم تسجيل انتهاء عقد الوحدة ${unit.number} للمستأجر ${tenant.name}.`
          : `✅ Contract ended for unit ${unit.number}, tenant ${tenant.name}.`,
      };
    }
    if (pickAlert && tenant) {
      const msg = lang === 'ar'
        ? `تنبيه: عقد الوحدة ${unit?.number ?? ''} ينتهي قريبًا. يرجى التواصل لتجديد العقد.`
        : `Alert: unit ${unit?.number ?? ''} contract ending soon. Please contact us to renew.`;
      return {
        text: lang === 'ar'
          ? `معاينة واتساب لـ ${tenant.name} (${tenant.phone}):\n«${msg}»\n\nهل أرسل؟`
          : `WhatsApp preview for ${tenant.name}:\n«${msg}»\n\nSend?`,
        pending: {
          kind: 'whatsapp_preview',
          phone: tenant.phone,
          whatsappMessage: msg,
          tenantId: tenant.id,
          unitId: unit?.id,
        },
        suggestions: lang === 'ar' ? ['نعم، أرسل', 'لا'] : ['Yes, send', 'No'],
      };
    }
    if (pickNew) {
      return {
        text: lang === 'ar'
          ? `حسنًا. عندما تكون جاهزًا قل: «أضف مستأجر جديد للوحدة ${unit?.number ?? ''}» — أو افتح الإعداد من الإعدادات.`
          : `When ready, say "add new tenant for unit ${unit?.number ?? ''}" or open setup in Settings.`,
      };
    }
  }

  if (pending.kind === 'whatsapp_preview') {
    if (AR_YES.test(trimmed)) {
      void onNotificationPrepared('op.event.notificationPrepared', pending.phone ? { phone: pending.phone } : undefined);
      return {
        text: lang === 'ar'
          ? `✅ تم تجهيز الإرسال عبر واتساب.\n${pending.phone ? `إلى: ${pending.phone}\n` : ''}افتح واتساب من الرسائل لإتمام الإرسال.`
          : `✅ WhatsApp message prepared.${pending.phone ? `\nTo: ${pending.phone}` : ''}\nOpen Messages to send.`,
      };
    }
  }

  if (pending.kind === 'payment_confirm' && pending.unitId && pending.tenantId) {
    if (AR_YES.test(trimmed) || /سجّل|سجل|record/i.test(trimmed)) {
      const unit = state.units.find((u) => u.id === pending.unitId);
      const amount = unit?.rentAmount ?? 0;
      mutations.recordPayment(pending.unitId, pending.tenantId, amount);
      const tenant = state.tenants.find((t) => t.id === pending.tenantId);
      return {
        text: lang === 'ar'
          ? `✅ تم تسجيل دفعة ${amount.toLocaleString('ar-SA')} ريال للمستأجر ${tenant?.name ?? ''} — وحدة ${unit?.number ?? ''}.`
          : `✅ Recorded payment ${amount} for ${tenant?.name ?? ''}, unit ${unit?.number ?? ''}.`,
      };
    }
  }

  if (pending.kind === 'technician_link' && AR_YES.test(trimmed)) {
    return {
      text: lang === 'ar' ? '✅ تم تجهيز رابط الفني للإرسال.' : '✅ Technician link ready to send.',
    };
  }

  if (pending.kind === 'maintenance_confirm' && pending.unitId && pending.maintenanceTitle) {
    if (AR_YES.test(trimmed) || /افتح|open|confirm/i.test(trimmed)) {
      void mutations.openMaintenanceTicket?.(
        pending.unitId,
        pending.maintenanceTitle,
        pending.tenantId,
        pending.unitNumber,
      );
      const unit = state.units.find((u) => u.id === pending.unitId);
      return {
        text: lang === 'ar'
          ? `✅ تم فتح بلاغ «${pending.maintenanceTitle}» للوحدة ${unit?.number ?? ''}. سيتم إشعار الفني بعد موافقتك على التعيين.`
          : `✅ Opened ticket «${pending.maintenanceTitle}» for unit ${unit?.number ?? ''}. Assign technician after approval.`,
      };
    }
  }

  return {
    text: lang === 'ar' ? 'لم أفهم. اختر أحد الخيارات أو أعد صياغة طلبك.' : 'Please pick an option or rephrase.',
    pending,
  };
}

export function dailyOpsSuggestions(state: PropertyOSState, lang: 'ar' | 'en'): string[] {
  if (!state.setupCompleted && !state.property) return [];
  const u = state.units[0]?.number ?? '5';
  if (lang === 'ar') {
    return [
      `الشقة ${u} خلص عقدها`,
      `المستأجر في وحدة ${u} دفع`,
      'أرسل تذكير إيجار للمتأخرين',
      'أعطني تقرير هذا الشهر',
      `افتح بلاغ صيانة للشقة ${u} — تكييف`,
      'رابط الفني',
    ];
  }
  return [
    `Unit ${u} contract ended`,
    `Tenant in unit ${u} paid`,
    'Send rent reminders to late tenants',
    'Monthly report',
    `Open maintenance ticket for unit ${u} — AC`,
    'Technician portal link',
  ];
}
