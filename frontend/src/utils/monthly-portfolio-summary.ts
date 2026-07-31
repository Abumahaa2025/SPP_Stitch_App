/**
 * Monthly portfolio aggregates from payment ledger + occupancy moves (months 1–8+).
 */
import type { PropertyOSState, PaymentLedgerEntry } from '@/src/types/property-os';

export type OccupancyMove = {
  at: string;
  batchId?: string;
  period?: string;
  departed: { unit: string; tenant: string; phone?: string }[];
  newcomers: { unit: string; tenant: string; phone?: string; rent?: number }[];
};

export type MonthlyAggregate = {
  monthKey: string;
  monthLabel: string;
  year?: number;
  month?: number;
  dueTotal: number;
  paidTotal: number;
  arrearsTotal: number;
  paidCount: number;
  lateCount: number;
  tenantCount: number;
  departed: { unit: string; tenant: string }[];
  entered: { unit: string; tenant: string }[];
};

export type PortfolioPeriodSummary = {
  months: MonthlyAggregate[];
  totals: {
    due: number;
    paid: number;
    arrears: number;
    departed: number;
    entered: number;
  };
  allDeparted: { unit: string; tenant: string; at?: string }[];
  allEntered: { unit: string; tenant: string; at?: string }[];
};

function isLate(e: PaymentLedgerEntry): boolean {
  const rem = Number(e.remaining) || 0;
  const st = (e.status || '').toLowerCase();
  return rem > 0.009 || st === 'unpaid' || st === 'unpaid_confirmed' || st === 'partial';
}

function isPaid(e: PaymentLedgerEntry): boolean {
  const rem = Number(e.remaining) || 0;
  const st = (e.status || '').toLowerCase();
  return !isLate(e) && (st === 'paid' || ((Number(e.paid) || 0) > 0 && rem <= 0.009));
}

function sortMonthKey(a: string, b: string): number {
  return a.localeCompare(b);
}

/**
 * Build month-by-month totals. When occupancyMoves exist, attach departed/entered
 * to the nearest month (by apply time / period label).
 */
export function buildMonthlyPortfolioSummary(
  state: PropertyOSState,
  moves: OccupancyMove[] = [],
): PortfolioPeriodSummary {
  const ledger = state.paymentLedger || [];
  const byMonth = new Map<string, PaymentLedgerEntry[]>();
  for (const row of ledger) {
    const key = row.monthKey || row.monthLabel || 'unknown';
    const list = byMonth.get(key) || [];
    list.push(row);
    byMonth.set(key, list);
  }

  const months: MonthlyAggregate[] = [...byMonth.entries()]
    .sort(([a], [b]) => sortMonthKey(a, b))
    .map(([monthKey, rows]) => {
      const sample = rows[0];
      let dueTotal = 0;
      let paidTotal = 0;
      let arrearsTotal = 0;
      let paidCount = 0;
      let lateCount = 0;
      const tenants = new Set<string>();
      for (const r of rows) {
        dueTotal += Number(r.due) || 0;
        paidTotal += Number(r.paid) || 0;
        arrearsTotal += Number(r.remaining) || 0;
        tenants.add(r.tenantId);
        if (isLate(r)) lateCount += 1;
        else if (isPaid(r)) paidCount += 1;
      }
      return {
        monthKey,
        monthLabel: sample?.monthLabel || monthKey,
        year: sample?.year,
        month: sample?.month,
        dueTotal,
        paidTotal,
        arrearsTotal,
        paidCount,
        lateCount,
        tenantCount: tenants.size,
        departed: [] as { unit: string; tenant: string }[],
        entered: [] as { unit: string; tenant: string }[],
      };
    });

  const allDeparted: { unit: string; tenant: string; at?: string }[] = [];
  const allEntered: { unit: string; tenant: string; at?: string }[] = [];

  // Attach moves to last month in range, or match by period string
  for (const mv of moves) {
    for (const d of mv.departed) {
      allDeparted.push({ ...d, at: mv.at });
    }
    for (const n of mv.newcomers) {
      allEntered.push({ unit: n.unit, tenant: n.tenant, at: mv.at });
    }
    const target =
      months.find((m) => mv.period && (m.monthLabel.includes(mv.period) || mv.period.includes(m.monthLabel)))
      || months[months.length - 1];
    if (target) {
      target.departed = [
        ...target.departed,
        ...mv.departed.map((d) => ({ unit: d.unit, tenant: d.tenant })),
      ];
      target.entered = [
        ...target.entered,
        ...mv.newcomers.map((n) => ({ unit: n.unit, tenant: n.tenant })),
      ];
    }
  }

  // Also surface unitHistory as departed if not already listed
  for (const h of state.unitHistory || []) {
    const unit = state.units.find((u) => u.id === h.unitId);
    const unitNum = unit?.number || h.unitId;
    if (!allDeparted.some((d) => d.unit === unitNum && d.tenant === h.tenantName)) {
      allDeparted.push({ unit: unitNum, tenant: h.tenantName, at: h.endedAt });
    }
  }

  const totals = months.reduce(
    (acc, m) => ({
      due: acc.due + m.dueTotal,
      paid: acc.paid + m.paidTotal,
      arrears: acc.arrears + m.arrearsTotal,
      departed: acc.departed,
      entered: acc.entered,
    }),
    { due: 0, paid: 0, arrears: 0, departed: allDeparted.length, entered: allEntered.length },
  );
  totals.departed = allDeparted.length;
  totals.entered = allEntered.length;

  return { months, totals, allDeparted, allEntered };
}
