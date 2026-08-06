import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { seedState, uid } from "../data/seed";
import { nextMaintStatus } from "../engines";
import type { ImportedPropertyRow } from "../engines";
import {
  applyRenewalSubmitResult,
  buildRenewalAlerts,
  markRenewalSubmitting,
  ownerApproveRenewal,
  recordTenantReply,
  startTenantRenewalNotice,
} from "../engines/ejar";
import {
  buildOwnerAuthFromNotice,
  decideOwnerAuth,
  executeAuthorizedAction,
  markNoticeStatus,
  noticesToAlerts,
  pullPlatformNotices,
} from "../engines/platforms";
import {
  buildCredentials,
  clearEjarSecrets,
  getEjarGateway,
  readEjarSecrets,
  saveEjarSecrets,
  type EjarMode,
} from "../integrations/ejar";
import { clearDatabase, loadDatabase, saveDatabase } from "./db";
import type {
  Agent,
  AppState,
  Contract,
  EjarConnection,
  MaintenanceRequest,
  OwnerProfile,
  PermissionKey,
  PlatformKind,
  PlatformLink,
  Property,
  PropertyPackageInput,
  Technician,
  Toast,
  ToastKind,
} from "../data/types";

function resolveEjarApiKey(ejar: EjarConnection): string {
  const stored = readEjarSecrets();
  if (stored) return stored;
  if (ejar.mode === "mock" && ejar.connected && ejar.facilityNo) {
    return `mock-restored-${ejar.facilityNo}`;
  }
  return "";
}

interface StoreApi {
  state: AppState;
  loading: boolean;
  saving: boolean;
  ready: boolean;
  toasts: Toast[];
  login: (username: string, password: string) => boolean;
  logout: () => void;
  resetDemo: () => Promise<void>;
  addProperty: (p: Omit<Property, "id" | "status">) => void;
  importProperties: (rows: ImportedPropertyRow[]) => void;
  cyclePropertyStatus: (id: string) => void;
  addContract: (c: Omit<Contract, "id" | "no">) => void;
  renewContract: (id: string) => void;
  addMaintenance: (m: Omit<MaintenanceRequest, "id" | "no" | "status" | "tech">) => void;
  advanceMaintenance: (id: string) => void;
  addTechnician: (t: Omit<Technician, "id" | "rating">) => void;
  simulateSensors: () => void;
  savePropertyPackage: (input: PropertyPackageInput) => Promise<void>;
  updateOwner: (owner: OwnerProfile) => void;
  addAgent: (agent: Omit<Agent, "id" | "accessLink" | "status"> & { status?: Agent["status"] }) => void;
  toggleAgentPermission: (agentId: string, permission: PermissionKey) => void;
  refreshOperationalAlerts: () => void;
  connectEjar: (input: {
    facilityNo: string;
    apiKey: string;
    mode?: EjarMode;
    baseUrl?: string;
    autoSubmitOnApproval?: boolean;
  }) => Promise<boolean>;
  disconnectEjar: () => void;
  updateEjarSettings: (patch: Partial<Pick<EjarConnection, "autoSubmitOnApproval" | "baseUrl" | "mode">>) => void;
  syncEjarNotifications: () => Promise<void>;
  notifyTenantRenewal: (contractId: string) => void;
  tenantReplyRenewal: (renewalId: string, accept: boolean, token?: string) => boolean;
  ownerApproveEjarRenewal: (renewalId: string) => Promise<void>;
  submitEjarRenewal: (renewalId: string) => Promise<void>;
  resolveAlert: (alertId: string) => void;
  upsertPlatformLink: (link: PlatformLink) => void;
  addPlatformLink: (input: {
    name: string;
    portalUrl: string;
    kind?: PlatformKind;
    apiBaseUrl?: string;
    accountNo?: string;
  }) => void;
  removePlatformLink: (id: string) => void;
  connectPlatformLink: (id: string, input: { accountNo: string; apiKey: string }) => void;
  disconnectPlatformLink: (id: string) => void;
  updatePlatformLinkFlags: (
    id: string,
    patch: Partial<Pick<PlatformLink, "receiveNotifications" | "actOnBehalfEnabled" | "portalUrl" | "apiBaseUrl" | "notes">>,
  ) => void;
  syncPlatformInbox: () => void;
  notifyOwnerAboutNotice: (noticeId: string) => void;
  notifyTenantsAboutNotice: (noticeId: string) => void;
  requestOwnerAuthorization: (noticeId: string) => void;
  ownerDecideAuthorization: (authId: string, accept: boolean, token?: string) => boolean;
  executeOwnerAuthorizedAction: (authId: string) => void;
  dismissPlatformNotice: (noticeId: string) => void;
  pushToast: (msg: string, kind?: ToastKind) => void;
}

const StoreContext = createContext<StoreApi | null>(null);

function withMergedAlerts(s: AppState): AppState {
  const generated = buildRenewalAlerts(s);
  const platformAlerts = noticesToAlerts(s);
  const manual = s.alerts.filter((a) => a.resolved || (!a.relatedContractId && a.actions?.[0]?.type !== "open_platforms"));
  const byTitle = new Set(manual.map((a) => `${a.title}|${a.relatedContractId || ""}`));
  const uniqueGen = [...generated, ...platformAlerts].filter(
    (a) => !byTitle.has(`${a.title}|${a.relatedContractId || ""}`),
  );
  return { ...s, alerts: [...uniqueGen, ...manual].slice(0, 50) };
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>(() => seedState());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [ready, setReady] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      const data = await loadDatabase();
      if (!alive) return;
      setState(withMergedAlerts(data));
      setReady(true);
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    (async () => {
      setSaving(true);
      try {
        await saveDatabase(state);
      } finally {
        if (!cancelled) setSaving(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [state, ready]);

  const pushToast = useCallback((msg: string, kind: ToastKind = "ok") => {
    const id = uid("toast");
    setToasts((prev) => [...prev, { id, msg, kind }]);
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 2800);
  }, []);

  const submitFromSnapshot = useCallback(
    async (snapshot: AppState, renewalId: string) => {
      if (!snapshot.ejar.connected) {
        pushToast("اربط حساب منصة إيجار أولاً من صفحة إيجار", "danger");
        return;
      }
      const renewal = snapshot.ejarRenewals.find((r) => r.id === renewalId);
      if (!renewal) {
        pushToast("طلب التجديد غير موجود", "danger");
        return;
      }
      const apiKey = resolveEjarApiKey(snapshot.ejar);
      if (!apiKey) {
        pushToast("أعد إدخال مفتاح الربط (خاصة في الوضع الحي)", "warn");
        return;
      }

      setState((s) =>
        withMergedAlerts({
          ...s,
          ejarRenewals: markRenewalSubmitting(s.ejarRenewals, renewalId),
        }),
      );

      const creds = buildCredentials({
        facilityNo: snapshot.ejar.facilityNo,
        apiKey,
        mode: snapshot.ejar.mode,
        baseUrl: snapshot.ejar.baseUrl,
      });
      const result = await getEjarGateway(snapshot.ejar.mode).submitRenewal(creds, {
        facilityNo: creds.facilityNo,
        contractNo: renewal.contractNo,
        tenantName: renewal.tenantName,
        tenantPhone: renewal.tenantPhone,
        propertyName: renewal.propertyName,
        endDate: renewal.endDate,
        ownerApprovedAt: renewal.ownerApprovedAt || new Date().toISOString(),
        tenantApprovedAt: renewal.tenantReplyAt || new Date().toISOString(),
      });

      const modeLabel = snapshot.ejar.mode === "live" ? "حي" : "محاكاة";
      setState((s) =>
        withMergedAlerts({
          ...s,
          ejar: { ...s.ejar, lastSyncAt: new Date().toISOString() },
          ejarRenewals: applyRenewalSubmitResult(s.ejarRenewals, renewalId, result, modeLabel),
        }),
      );
      pushToast(result.message, result.ok ? "ok" : "danger");
    },
    [pushToast],
  );

  const api = useMemo<StoreApi>(
    () => ({
      state,
      loading,
      saving,
      ready,
      toasts,
      pushToast,
      login: (username, password) => {
        if (!username.trim() || !password.trim()) return false;
        setState((s) => ({ ...s, loggedIn: true }));
        pushToast("تم تسجيل الدخول");
        return true;
      },
      logout: () => {
        setState((s) => ({ ...s, loggedIn: false }));
        pushToast("تم تسجيل الخروج بنجاح");
      },
      resetDemo: async () => {
        setLoading(true);
        await clearDatabase();
        const next = seedState();
        next.loggedIn = true;
        setState(next);
        setLoading(false);
        pushToast("تم تفريغ قاعدة البيانات");
      },
      addProperty: (p) => {
        setState((s) =>
          withMergedAlerts({
            ...s,
            properties: [{ id: uid("p"), status: "شاغرة", ...p }, ...s.properties],
          }),
        );
        pushToast("تم حفظ العقار في قاعدة البيانات");
      },
      importProperties: (rows) => {
        setState((s) =>
          withMergedAlerts({
            ...s,
            properties: [
              ...rows.map((r) => ({ id: uid("p"), status: "شاغرة" as const, ...r })),
              ...s.properties,
            ],
          }),
        );
        pushToast(`تم استرداد ${rows.length} عقار إلى قاعدة البيانات`);
      },
      cyclePropertyStatus: (id) => {
        const order: Property["status"][] = ["شاغرة", "مؤجرة", "تحت الصيانة"];
        setState((s) => ({
          ...s,
          properties: s.properties.map((p) => {
            if (p.id !== id) return p;
            const next = order[(order.indexOf(p.status) + 1) % order.length];
            return { ...p, status: next };
          }),
        }));
        pushToast("تم تحديث حالة العقار");
      },
      addContract: (c) => {
        setState((s) => {
          const prefix = c.type === "عقد صيانة" ? "MNT" : "CON";
          const no = `${prefix}-${new Date().getFullYear()}-${String(s.contracts.length + 1).padStart(3, "0")}`;
          return withMergedAlerts({
            ...s,
            contracts: [{ id: uid("c"), no, ...c }, ...s.contracts],
          });
        });
        pushToast("تم حفظ العقد في قاعدة البيانات");
      },
      renewContract: (id) => {
        setState((s) =>
          withMergedAlerts({
            ...s,
            contracts: s.contracts.map((c) => {
              if (c.id !== id) return c;
              const d = new Date(c.end);
              d.setFullYear(d.getFullYear() + 1);
              return { ...c, end: d.toISOString().slice(0, 10) };
            }),
          }),
        );
        pushToast("تم تجديد العقد لسنة إضافية");
      },
      addMaintenance: (m) => {
        setState((s) => {
          const no = String(1000 + s.maintenance.length + 1);
          return {
            ...s,
            maintenance: [
              { id: uid("m"), no, status: "جديد", tech: "—", ...m },
              ...s.maintenance,
            ],
          };
        });
        pushToast("تم حفظ طلب الصيانة");
      },
      advanceMaintenance: (id) => {
        setState((s) => ({
          ...s,
          maintenance: s.maintenance.map((m) => {
            if (m.id !== id) return m;
            const status = nextMaintStatus(m.status);
            const tech =
              status !== "جديد" && m.tech === "—" && s.technicians[0]
                ? s.technicians[0].name
                : m.tech;
            return { ...m, status, tech };
          }),
        }));
        pushToast("تم تحديث حالة طلب الصيانة");
      },
      addTechnician: (t) => {
        setState((s) => ({
          ...s,
          technicians: [{ id: uid("t"), rating: 0, ...t }, ...s.technicians],
        }));
        pushToast("تم حفظ الفني");
      },
      simulateSensors: () => {
        pushToast("لا توجد حساسات بعد — أضف بياناتك أولاً", "warn");
      },
      savePropertyPackage: async (input) => {
        setSaving(true);
        await new Promise((r) => setTimeout(r, 350));
        setState((s) => {
          const propertyId = uid("p");
          const hasTenants = input.tenants.length > 0;
          const property: Property = {
            id: propertyId,
            status: input.property.status || (hasTenants ? "مؤجرة" : "شاغرة"),
            ...input.property,
          };

          let contracts = s.contracts;
          let tenants = s.tenants;
          let rents = s.rents;
          let seq = s.contracts.length;

          for (const block of input.tenants) {
            seq += 1;
            const prefix = block.contractType === "عقد صيانة" ? "MNT" : "CON";
            const contractNo = `${prefix}-${new Date().getFullYear()}-${String(seq).padStart(3, "0")}`;
            const tenantId = uid("tn");
            contracts = [
              {
                id: uid("c"),
                no: contractNo,
                unit: block.unit,
                property: property.name,
                propertyId,
                tenant: block.name,
                tenantId,
                start: block.start,
                end: block.end,
                type: block.contractType,
                rent: block.rent,
              },
              ...contracts,
            ];
            tenants = [
              {
                id: tenantId,
                name: block.name,
                unit: block.unit,
                contractNo,
                rent: block.rent,
                phone: block.phone,
                status: "نشط",
                email: block.email || undefined,
                nationalId: block.nationalId || undefined,
                secondaryPhone: block.secondaryPhone || undefined,
                notes: block.notes || undefined,
                deposit: block.deposit || undefined,
              },
              ...tenants,
            ];
            rents = [
              {
                id: uid("r"),
                contractNo,
                tenant: block.name,
                property: property.name,
                amount: block.rentAmount || block.rent,
                dueDate: block.dueDate || block.start,
                status: block.rentStatus,
                method: block.method || undefined,
                paidDate: block.rentStatus === "مدفوع" ? block.dueDate || block.start : undefined,
              },
              ...rents,
            ];
          }

          return withMergedAlerts({
            ...s,
            properties: [property, ...s.properties],
            contracts,
            tenants,
            rents,
          });
        });
        setSaving(false);
        pushToast("تم حفظ البيانات في جداول قاعدة البيانات");
      },
      updateOwner: (owner) => {
        setState((s) => ({ ...s, owner }));
        pushToast("تم تحديث بيانات المالك");
      },
      addAgent: (agent) => {
        setState((s) => {
          const slug = agent.name.trim().replace(/\s+/g, "-").slice(0, 24) || "agent";
          return {
            ...s,
            agents: [
              {
                id: uid("ag"),
                status: agent.status || "نشط",
                accessLink: `smart-employee.app/access/${encodeURIComponent(slug)}`,
                name: agent.name,
                phone: agent.phone,
                role: agent.role,
                permissions: agent.permissions,
              },
              ...s.agents,
            ],
          };
        });
        pushToast("تم حفظ الوكيل/الشريك");
      },
      toggleAgentPermission: (agentId, permission) => {
        setState((s) => ({
          ...s,
          agents: s.agents.map((a) => {
            if (a.id !== agentId) return a;
            const has = a.permissions.includes(permission);
            return {
              ...a,
              permissions: has
                ? a.permissions.filter((p) => p !== permission)
                : [...a.permissions, permission],
            };
          }),
        }));
      },
      refreshOperationalAlerts: () => {
        setState((s) => withMergedAlerts(s));
        pushToast("تم تحديث التنبيهات والاقتراحات");
      },
      connectEjar: async ({ facilityNo, apiKey, mode, baseUrl, autoSubmitOnApproval }) => {
        if (!facilityNo.trim() || !apiKey.trim()) {
          pushToast("أدخل رقم المنشأة ومفتاح الربط", "warn");
          return false;
        }
        const nextMode: EjarMode = mode || state.ejar.mode || "mock";
        const creds = buildCredentials({
          facilityNo,
          apiKey,
          mode: nextMode,
          baseUrl: baseUrl || state.ejar.baseUrl,
        });
        const auth = await getEjarGateway(nextMode).authenticate(creds);
        if (!auth.ok) {
          pushToast(auth.message, "danger");
          return false;
        }
        saveEjarSecrets(apiKey.trim());
        const ejar: EjarConnection = {
          connected: true,
          facilityNo: creds.facilityNo,
          apiKeyMasked: `${apiKey.trim().slice(0, 3)}••••${apiKey.trim().slice(-2)}`,
          mode: nextMode,
          baseUrl: creds.baseUrl,
          autoSubmitOnApproval:
            autoSubmitOnApproval ?? state.ejar.autoSubmitOnApproval ?? true,
          lastSyncAt: new Date().toISOString(),
          notes:
            nextMode === "live"
              ? `ربط حي عبر ${creds.baseUrl}`
              : "وضع المحاكاة — جاهز لاستبدال بـ API الرسمي",
        };
        setState((s) => ({ ...s, ejar }));
        pushToast(auth.message);
        return true;
      },
      disconnectEjar: () => {
        clearEjarSecrets();
        setState((s) => ({
          ...s,
          ejar: {
            ...s.ejar,
            connected: false,
            facilityNo: "",
            apiKeyMasked: "",
            notes: "",
            lastSyncAt: undefined,
          },
        }));
        pushToast("تم إلغاء ربط إيجار");
      },
      updateEjarSettings: (patch) => {
        setState((s) =>
          withMergedAlerts({
            ...s,
            ejar: { ...s.ejar, ...patch },
          }),
        );
        pushToast("تم تحديث إعدادات إيجار");
      },
      syncEjarNotifications: async () => {
        if (!state.ejar.connected) {
          pushToast("اربط حساب إيجار أولاً", "warn");
          return;
        }
        const apiKey = resolveEjarApiKey(state.ejar);
        if (!apiKey) {
          pushToast("أعد إدخال مفتاح الربط للوضع الحي", "warn");
          return;
        }
        try {
          const creds = buildCredentials({
            facilityNo: state.ejar.facilityNo,
            apiKey,
            mode: state.ejar.mode,
            baseUrl: state.ejar.baseUrl,
          });
          const items = await getEjarGateway(state.ejar.mode).fetchNotifications(creds);
          setState((s) => {
            const imported = items.map((n) => ({
              id: uid("al"),
              title: n.title || "إشعار إيجار",
              desc: n.body,
              time: new Date(n.receivedAt || Date.now()).toLocaleString("ar-SA"),
              level: "info" as const,
              suggestion: "راجع مسار التجديد أو العقود المرتبطة.",
            }));
            return withMergedAlerts({
              ...s,
              ejar: { ...s.ejar, lastSyncAt: new Date().toISOString() },
              alerts: [...imported, ...s.alerts].slice(0, 40),
            });
          });
          pushToast(items.length ? `تم جلب ${items.length} إشعار من إيجار` : "لا توجد إشعارات جديدة");
        } catch (err) {
          pushToast(
            err instanceof Error ? err.message : "فشل مزامنة إشعارات إيجار",
            "danger",
          );
        }
      },
      notifyTenantRenewal: (contractId) => {
        let replyPath = "";
        setState((s) => {
          const result = startTenantRenewalNotice(s, contractId);
          if (!result) return s;
          replyPath = result.replyPath;
          return withMergedAlerts({ ...s, ejarRenewals: result.renewals });
        });
        pushToast(
          replyPath
            ? `تم إرسال إشعار التجديد — رابط رد المستأجر جاهز`
            : "تم إرسال إشعار التجديد للمستأجر",
        );
      },
      tenantReplyRenewal: (renewalId, accept, token) => {
        let ok = false;
        let message = "";
        setState((s) => {
          const result = recordTenantReply(s.ejarRenewals, renewalId, accept, token);
          ok = result.ok;
          message = result.message;
          if (!result.ok) return s;
          return withMergedAlerts({ ...s, ejarRenewals: result.renewals });
        });
        pushToast(message || (ok ? "تم التسجيل" : "تعذر التسجيل"), ok ? "ok" : "danger");
        return ok;
      },
      ownerApproveEjarRenewal: async (renewalId) => {
        let next: AppState | null = null;
        setState((s) => {
          next = withMergedAlerts({
            ...s,
            ejarRenewals: ownerApproveRenewal(s.ejarRenewals, renewalId),
          });
          return next;
        });
        if (!next) return;
        const approved = next as AppState;
        if (approved.ejar.autoSubmitOnApproval !== false && approved.ejar.connected) {
          pushToast("تمت موافقة المالك — جاري الرفع التلقائي لإيجار");
          await submitFromSnapshot(approved, renewalId);
        } else {
          pushToast("تمت موافقة المالك — جاهز للرفع إلى إيجار");
        }
      },
      submitEjarRenewal: async (renewalId) => {
        await submitFromSnapshot(state, renewalId);
      },
      resolveAlert: (alertId) => {
        setState((s) => ({
          ...s,
          alerts: s.alerts.map((a) => (a.id === alertId ? { ...a, resolved: true } : a)),
        }));
      },
      upsertPlatformLink: (link) => {
        setState((s) => ({
          ...s,
          platformLinks: s.platformLinks.some((p) => p.id === link.id)
            ? s.platformLinks.map((p) => (p.id === link.id ? link : p))
            : [link, ...s.platformLinks],
        }));
        pushToast("تم حفظ رابط المنصة");
      },
      addPlatformLink: ({ name, portalUrl, kind, apiBaseUrl, accountNo }) => {
        if (!name.trim() || !portalUrl.trim()) {
          pushToast("أدخل اسم المنصة والرابط", "warn");
          return;
        }
        const link: PlatformLink = {
          id: uid("plt"),
          kind: kind || "custom",
          name: name.trim(),
          portalUrl: portalUrl.trim(),
          apiBaseUrl: apiBaseUrl?.trim() || "",
          accountNo: accountNo?.trim() || "",
          connected: false,
          receiveNotifications: true,
          actOnBehalfEnabled: true,
          createdAt: new Date().toISOString(),
          notes: "رابط مخصص",
        };
        setState((s) => ({ ...s, platformLinks: [link, ...s.platformLinks] }));
        pushToast("تمت إضافة الرابط");
      },
      removePlatformLink: (id) => {
        if (["plt_ejar", "plt_electricity", "plt_water"].includes(id)) {
          pushToast("لا يمكن حذف المنصات الأساسية — يمكن إلغاء ربطها فقط", "warn");
          return;
        }
        setState((s) => ({
          ...s,
          platformLinks: s.platformLinks.filter((p) => p.id !== id),
        }));
        pushToast("تم حذف الرابط");
      },
      connectPlatformLink: (id, { accountNo, apiKey }) => {
        if (!accountNo.trim() || !apiKey.trim()) {
          pushToast("أدخل رقم الحساب ومفتاح الربط", "warn");
          return;
        }
        setState((s) => ({
          ...s,
          platformLinks: s.platformLinks.map((p) =>
            p.id === id
              ? {
                  ...p,
                  connected: true,
                  accountNo: accountNo.trim(),
                  apiKeyMasked: `${apiKey.trim().slice(0, 3)}••••${apiKey.trim().slice(-2)}`,
                  lastSyncAt: new Date().toISOString(),
                }
              : p,
          ),
        }));
        pushToast("تم ربط المنصة واستقبال الإشعارات مفعّل");
      },
      disconnectPlatformLink: (id) => {
        setState((s) => ({
          ...s,
          platformLinks: s.platformLinks.map((p) =>
            p.id === id
              ? {
                  ...p,
                  connected: false,
                  apiKeyMasked: undefined,
                  lastSyncAt: undefined,
                }
              : p,
          ),
        }));
        pushToast("تم إلغاء ربط المنصة");
      },
      updatePlatformLinkFlags: (id, patch) => {
        setState((s) => ({
          ...s,
          platformLinks: s.platformLinks.map((p) => (p.id === id ? { ...p, ...patch } : p)),
        }));
        pushToast("تم تحديث إعدادات الرابط");
      },
      syncPlatformInbox: () => {
        let synced = 0;
        setState((s) => {
          const { notices, syncedIds } = pullPlatformNotices(s);
          synced = syncedIds.length;
          if (!syncedIds.length) return s;
          const at = new Date().toISOString();
          return withMergedAlerts({
            ...s,
            platformNotices: notices,
            platformLinks: s.platformLinks.map((p) =>
              syncedIds.includes(p.id) ? { ...p, lastSyncAt: at } : p,
            ),
          });
        });
        if (!synced) {
          pushToast("اربط منصة واحدة على الأقل مع تفعيل استقبال الإشعارات", "warn");
          return;
        }
        pushToast("تم سحب الرسائل والإشعارات من المنصات المرتبطة");
      },
      notifyOwnerAboutNotice: (noticeId) => {
        const notice = state.platformNotices.find((n) => n.id === noticeId);
        if (!notice) {
          pushToast("الإشعار غير موجود", "danger");
          return;
        }
        const ownerLabel = state.owner.name || state.owner.phone || "المالك";
        setState((s) =>
          withMergedAlerts({
            ...s,
            platformNotices: markNoticeStatus(
              s.platformNotices,
              noticeId,
              "أُشعر_المالك",
              `أُرسل إشعار للمالك (${ownerLabel}): ${notice.title}`,
            ),
          }),
        );
        pushToast(`تم إرسال الإشعار والاقتراح إلى المالك`);
      },
      notifyTenantsAboutNotice: (noticeId) => {
        const notice = state.platformNotices.find((n) => n.id === noticeId);
        if (!notice) {
          pushToast("الإشعار غير موجود", "danger");
          return;
        }
        const tenants = state.tenants.filter((t) =>
          notice.relatedTenantIds?.length ? notice.relatedTenantIds.includes(t.id) : t.status === "نشط",
        );
        if (!tenants.length) {
          pushToast("لا يوجد مستأجرون لإرسال الإشعار إليهم", "warn");
          return;
        }
        setState((s) =>
          withMergedAlerts({
            ...s,
            platformNotices: markNoticeStatus(
              s.platformNotices,
              noticeId,
              "أُشعر_المستأجرون",
              `أُرسل إشعار لـ ${tenants.length} مستأجر: ${notice.suggestion}`,
            ),
          }),
        );
        pushToast(`تم إرسال الإشعار لـ ${tenants.length} مستأجر`);
      },
      requestOwnerAuthorization: (noticeId) => {
        const notice = state.platformNotices.find((n) => n.id === noticeId);
        if (!notice) {
          pushToast("الإشعار غير موجود", "danger");
          return;
        }
        const platform = state.platformLinks.find((p) => p.id === notice.platformId);
        if (platform && !platform.actOnBehalfEnabled) {
          pushToast("فعّل صلاحية التصرف نيابة عن المالك في إعدادات الرابط", "warn");
          return;
        }
        const auth = buildOwnerAuthFromNotice(notice, platform);
        setState((s) =>
          withMergedAlerts({
            ...s,
            ownerAuthorizations: [auth, ...s.ownerAuthorizations],
            platformNotices: s.platformNotices.map((n) =>
              n.id === noticeId
                ? {
                    ...n,
                    status: "بانتظار_إذن_المالك",
                    ownerAuthId: auth.id,
                    history: [
                      ...n.history,
                      {
                        at: new Date().toISOString(),
                        note: `طُلب إذن المالك — رابط الموافقة /owner-auth/${auth.id}`,
                      },
                    ],
                  }
                : n,
            ),
          }),
        );
        pushToast("تم طلب إذن المالك لإتمام السداد/الإجراء");
      },
      ownerDecideAuthorization: (authId, accept, token) => {
        let ok = false;
        let message = "";
        setState((s) => {
          const result = decideOwnerAuth(s.ownerAuthorizations, authId, accept, token);
          ok = result.ok;
          message = result.message;
          if (!result.ok || !result.auth) return s;
          let next: AppState = {
            ...s,
            ownerAuthorizations: result.auths,
            platformNotices: markNoticeStatus(
              s.platformNotices,
              result.auth.noticeId,
              accept ? "مأذون" : "مرفوض",
              accept ? "المالك وافق على التنفيذ نيابة عنه" : "المالك رفض الإجراء",
            ),
          };
          if (accept) {
            const exec = executeAuthorizedAction(
              next.ownerAuthorizations,
              next.platformNotices,
              authId,
            );
            if (exec.ok) {
              next = {
                ...next,
                ownerAuthorizations: exec.auths,
                platformNotices: exec.notices,
              };
              message = exec.message;
            }
          }
          return withMergedAlerts(next);
        });
        pushToast(message, ok ? "ok" : "danger");
        return ok;
      },
      executeOwnerAuthorizedAction: (authId) => {
        setState((s) => {
          const result = executeAuthorizedAction(s.ownerAuthorizations, s.platformNotices, authId);
          if (!result.ok) {
            pushToast(result.message, "danger");
            return s;
          }
          pushToast(result.message);
          return withMergedAlerts({
            ...s,
            ownerAuthorizations: result.auths,
            platformNotices: result.notices,
          });
        });
      },
      dismissPlatformNotice: (noticeId) => {
        setState((s) =>
          withMergedAlerts({
            ...s,
            platformNotices: markNoticeStatus(s.platformNotices, noticeId, "متجاهل", "تم تجاهل الإشعار"),
          }),
        );
      },
    }),
    [state, loading, saving, ready, toasts, pushToast, submitFromSnapshot],
  );

  return <StoreContext.Provider value={api}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used within StoreProvider");
  return ctx;
}
