import type { AppState, Contract, MaintStatus, Property, Sensor, Tenant } from "../data/types";
import { daysLeft } from "../lib/format";

export type Priority = "حرج" | "مهم" | "متابعة" | "معلومة";

export interface EngineSuggestion {
  id: string;
  priority: Priority;
  kind: "متأخرات" | "تجديد_عقد" | "صيانة" | "شاغر" | "حساس" | "تحصيل";
  title: string;
  reason: string;
  action: string;
  impact: string;
  confidence: number;
  route: string;
  evidence: string[];
}

export interface PortfolioKnowledge {
  propertyCount: number;
  rentedCount: number;
  vacantCount: number;
  maintenanceCount: number;
  occupancyRate: number;
  annualRent: number;
  collectedEstimate: number;
  arrearsTotal: number;
  collectionRate: number;
  expiringContracts: Contract[];
  overdueContracts: Contract[];
  lateTenants: Tenant[];
  openMaintenance: number;
  sensorAlerts: Sensor[];
  healthScore: number;
}

export interface DailyBrief {
  greeting: string;
  headline: string;
  points: string[];
  focus: EngineSuggestion[];
}

function sum(nums: number[]) {
  return nums.reduce((a, b) => a + b, 0);
}

/** محرك المعرفة العقارية — يوحّد الحقائق من كل الجداول */
export function buildKnowledge(state: AppState): PortfolioKnowledge {
  const rentedCount = state.properties.filter((p) => p.status === "مؤجرة").length;
  const vacantCount = state.properties.filter((p) => p.status === "شاغرة").length;
  const maintenanceCount = state.properties.filter((p) => p.status === "تحت الصيانة").length;
  const propertyCount = state.properties.length;
  const occupancyRate = propertyCount ? Math.round((rentedCount / propertyCount) * 100) : 0;

  const rentContracts = state.contracts.filter((c) => c.type !== "عقد صيانة");
  const annualRent = sum(rentContracts.map((c) => c.rent));
  const lateTenants = state.tenants.filter((t) => t.status === "متأخر");
  const arrearsTotal = sum(lateTenants.map((t) => t.rent));
  const collectedEstimate = Math.max(annualRent - arrearsTotal, 0);
  const collectionRate = annualRent ? Math.round((collectedEstimate / annualRent) * 100) : 0;

  const expiringContracts = state.contracts
    .filter((c) => {
      const d = daysLeft(c.end);
      return d >= 0 && d <= 30;
    })
    .sort((a, b) => daysLeft(a.end) - daysLeft(b.end));

  const overdueContracts = state.contracts.filter((c) => daysLeft(c.end) < 0);
  const openMaintenance = state.maintenance.filter((m) => m.status !== "مكتمل").length;
  const sensorAlerts = state.sensors.filter((s) => s.status !== "يعمل");

  // درجة صحة المحفظة (0-100) — قواعد حتمية بلا AI
  let health = 100;
  health -= Math.min(35, lateTenants.length * 12);
  health -= Math.min(20, vacantCount * 8);
  health -= Math.min(15, sensorAlerts.length * 7);
  health -= Math.min(15, openMaintenance * 5);
  health -= Math.min(15, expiringContracts.length * 4);
  health = Math.max(0, Math.round(health));

  return {
    propertyCount,
    rentedCount,
    vacantCount,
    maintenanceCount,
    occupancyRate,
    annualRent,
    collectedEstimate,
    arrearsTotal,
    collectionRate,
    expiringContracts,
    overdueContracts,
    lateTenants,
    openMaintenance,
    sensorAlerts,
    healthScore: health,
  };
}

/** محرك التوصيات — اقتراحات عملية مبنية على معرفة المحفظة */
export function buildRecommendations(state: AppState, knowledge: PortfolioKnowledge): EngineSuggestion[] {
  const out: EngineSuggestion[] = [];

  for (const t of knowledge.lateTenants) {
    out.push({
      id: `arrears_${t.id}`,
      priority: "حرج",
      kind: "متأخرات",
      title: `تحصيل متأخر من ${t.name}`,
      reason: `حالة المستأجر متأخرة على وحدة ${t.unit}.`,
      action: "افتح سجل المستأجرين وتابع التحصيل",
      impact: `${t.rent.toLocaleString("ar-SA")} ر.س`,
      confidence: 92,
      route: "/tenants",
      evidence: [t.contractNo, t.phone, t.status],
    });
  }

  for (const c of knowledge.expiringContracts.slice(0, 4)) {
    const left = daysLeft(c.end);
    out.push({
      id: `renew_${c.id}`,
      priority: left <= 14 ? "حرج" : "مهم",
      kind: "تجديد_عقد",
      title: `تجديد العقد ${c.no}`,
      reason: `ينتهي خلال ${left} يوم — ${c.tenant}.`,
      action: "جدّد العقد لسنة إضافية الآن",
      impact: c.rent ? `${c.rent.toLocaleString("ar-SA")} ر.س سنوياً` : "عقد تشغيلي",
      confidence: 88,
      route: "/contracts",
      evidence: [c.unit, c.property, c.end],
    });
  }

  for (const s of knowledge.sensorAlerts) {
    out.push({
      id: `sensor_${s.id}`,
      priority: s.status === "متوقف" ? "حرج" : "مهم",
      kind: "حساس",
      title: `تنبيه ${s.type} — ${s.status}`,
      reason: `${s.unit} · القراءة: ${s.reading}`,
      action: "أنشئ طلب صيانة واربط فنياً",
      impact: "تقليل ضرر تشغيلي",
      confidence: 85,
      route: "/maintenance",
      evidence: [s.city, s.status],
    });
  }

  for (const p of state.properties.filter((x) => x.status === "شاغرة")) {
    out.push({
      id: `vacant_${p.id}`,
      priority: "متابعة",
      kind: "شاغر",
      title: `وحدة شاغرة: ${p.name}`,
      reason: `العقار في ${p.location} بدون إشغال.`,
      action: "راجع التسعير وافتح عقداً جديداً",
      impact: `${p.price.toLocaleString("ar-SA")} ر.س فرصة سنوية`,
      confidence: 78,
      route: "/contracts",
      evidence: [p.city, p.type],
    });
  }

  for (const m of state.maintenance.filter((x) => x.status === "جديد")) {
    out.push({
      id: `maint_${m.id}`,
      priority: "مهم",
      kind: "صيانة",
      title: `طلب صيانة #${m.no} بانتظار التعيين`,
      reason: m.desc,
      action: "تقدم الحالة لتعيين فني",
      impact: m.property,
      confidence: 80,
      route: "/maintenance",
      evidence: [m.type, m.status],
    });
  }

  if (knowledge.collectionRate < 70 && knowledge.annualRent > 0) {
    out.push({
      id: "collection_push",
      priority: "مهم",
      kind: "تحصيل",
      title: "نسبة التحصيل منخفضة",
      reason: `التحصيل الحالي ${knowledge.collectionRate}% فقط.`,
      action: "ركّز على المتأخرات هذا الأسبوع",
      impact: `${knowledge.arrearsTotal.toLocaleString("ar-SA")} ر.س`,
      confidence: 90,
      route: "/tenants",
      evidence: [`محصّل ${knowledge.collectedEstimate}`, `إيجار ${knowledge.annualRent}`],
    });
  }

  const rank: Record<Priority, number> = { حرج: 0, مهم: 1, متابعة: 2, معلومة: 3 };
  return out.sort((a, b) => rank[a.priority] - rank[b.priority] || b.confidence - a.confidence);
}

/** محرك الملخص اليومي */
export function buildDailyBrief(state: AppState, knowledge: PortfolioKnowledge, suggestions: EngineSuggestion[]): DailyBrief {
  const first = state.user.name.split(" ")[0] || "المدير";
  const critical = suggestions.filter((s) => s.priority === "حرج").length;
  const headline =
    critical > 0
      ? `لديك ${critical} قرارات عاجلة اليوم`
      : knowledge.healthScore >= 80
        ? "المحفظة مستقرة — لا قرارات حرجة"
        : "المحفظة تحتاج متابعة مركّزة";

  const points = [
    `صحة المحفظة ${knowledge.healthScore}/100`,
    `الإشغال ${knowledge.occupancyRate}% · شاغر ${knowledge.vacantCount}`,
    `التحصيل ${knowledge.collectionRate}% · متأخرات ${knowledge.arrearsTotal.toLocaleString("ar-SA")} ر.س`,
    knowledge.expiringContracts.length
      ? `${knowledge.expiringContracts.length} عقود خلال 30 يوماً`
      : "لا عقود حرجة الانتهاء خلال 30 يوماً",
  ];

  return {
    greeting: `صباح الخير ${first}`,
    headline,
    points,
    focus: suggestions.slice(0, 5),
  };
}

/** محرك العقود — حالة حتمية */
export function contractStatus(contract: Contract): "ساري" | "قارب_الانتهاء" | "منتهي" {
  const d = daysLeft(contract.end);
  if (d < 0) return "منتهي";
  if (d <= 30) return "قارب_الانتهاء";
  return "ساري";
}

/** محرك الصيانة — ترتيب الحالات */
export const MAINT_FLOW: MaintStatus[] = ["جديد", "قيد التنفيذ", "مكتمل"];

export function nextMaintStatus(current: MaintStatus): MaintStatus {
  const i = MAINT_FLOW.indexOf(current);
  return MAINT_FLOW[Math.min(i + 1, MAINT_FLOW.length - 1)];
}

/** محرك الحساسات — يحوّل القراءات إلى تنبيهات */
export function deriveSensorAlerts(sensors: Sensor[]) {
  return sensors
    .filter((s) => s.status !== "يعمل")
    .map((s) => ({
      title: s.status === "متوقف" ? `توقف حساس ${s.type}` : `تنبيه ${s.type}`,
      desc: `${s.unit} · ${s.reading}`,
      level: (s.status === "متوقف" ? "danger" : "warn") as "danger" | "warn",
    }));
}

/** محرك الإشغال */
export function occupancyBreakdown(properties: Property[]) {
  const rented = properties.filter((p) => p.status === "مؤجرة").length;
  const vacant = properties.filter((p) => p.status === "شاغرة").length;
  const maintenance = properties.filter((p) => p.status === "تحت الصيانة").length;
  const total = properties.length || 1;
  return {
    rented,
    vacant,
    maintenance,
    rate: Math.round((rented / total) * 100),
  };
}
