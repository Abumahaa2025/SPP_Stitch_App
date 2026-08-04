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
import { clearDatabase, loadDatabase, saveDatabase } from "./db";
import type {
  Agent,
  AppState,
  Contract,
  MaintenanceRequest,
  OwnerProfile,
  PermissionKey,
  Property,
  PropertyPackageInput,
  Technician,
  Toast,
  ToastKind,
} from "../data/types";

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
  pushToast: (msg: string, kind?: ToastKind) => void;
}

const StoreContext = createContext<StoreApi | null>(null);

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
      setState(data);
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
        pushToast(`أهلاً بعودتك، ${state.user.name}`);
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
        pushToast("تمت إعادة ضبط قاعدة البيانات التجريبية");
      },
      addProperty: (p) => {
        setState((s) => ({
          ...s,
          properties: [{ id: uid("p"), status: "شاغرة", ...p }, ...s.properties],
        }));
        pushToast("تمت إضافة العقار إلى قاعدة البيانات");
      },
      importProperties: (rows) => {
        setState((s) => ({
          ...s,
          properties: [
            ...rows.map((r) => ({ id: uid("p"), status: "شاغرة" as const, ...r })),
            ...s.properties,
          ],
        }));
        pushToast(`تم استيراد ${rows.length} عقار إلى قاعدة البيانات`);
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
          return {
            ...s,
            contracts: [{ id: uid("c"), no, ...c }, ...s.contracts],
          };
        });
        pushToast("تمت إضافة العقد إلى قاعدة البيانات");
      },
      renewContract: (id) => {
        setState((s) => ({
          ...s,
          contracts: s.contracts.map((c) => {
            if (c.id !== id) return c;
            const d = new Date(c.end);
            d.setFullYear(d.getFullYear() + 1);
            return { ...c, end: d.toISOString().slice(0, 10) };
          }),
        }));
        pushToast("تم تجديد العقد لسنة إضافية");
      },
      addMaintenance: (m) => {
        setState((s) => {
          const no = String(1045 + s.maintenance.length);
          return {
            ...s,
            maintenance: [
              { id: uid("m"), no, status: "جديد", tech: "—", ...m },
              ...s.maintenance,
            ],
          };
        });
        pushToast("تم إرسال طلب الصيانة");
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
          technicians: [{ id: uid("t"), rating: 4.5, ...t }, ...s.technicians],
        }));
        pushToast("تمت إضافة الفني بنجاح");
      },
      simulateSensors: () => {
        setState((s) => {
          const sensors = s.sensors.map((sensor, i) => {
            if (i !== 0) return sensor;
            if (sensor.type === "حرارة") {
              const t = 20 + Math.floor(Math.random() * 10);
              const status = t > 26 ? "تنبيه" : "يعمل";
              return { ...sensor, reading: `${t}°C`, status: status as typeof sensor.status };
            }
            return sensor;
          });
          const hot = sensors.find((x) => x.status === "تنبيه");
          const alerts = hot
            ? [
                {
                  id: uid("a"),
                  title: "تنبيه حرارة",
                  desc: hot.unit,
                  time: "الآن",
                  level: "warn" as const,
                },
                ...s.alerts,
              ].slice(0, 8)
            : s.alerts;
          return { ...s, sensors, alerts };
        });
        pushToast("تم تحديث بيانات المستشعرات");
      },
      savePropertyPackage: async (input) => {
        setSaving(true);
        await new Promise((r) => setTimeout(r, 350));
        setState((s) => {
          const propertyId = uid("p");
          const hasTenant = Boolean(input.tenant?.name && input.contract?.tenantName);
          const property: Property = {
            id: propertyId,
            status: input.property.status || (hasTenant ? "مؤجرة" : "شاغرة"),
            ...input.property,
          };

          let contracts = s.contracts;
          let tenants = s.tenants;
          let rents = s.rents;
          let contractNo = "";

          if (input.contract && input.contract.tenantName) {
            const prefix = input.contract.type === "عقد صيانة" ? "MNT" : "CON";
            contractNo = `${prefix}-${new Date().getFullYear()}-${String(s.contracts.length + 1).padStart(3, "0")}`;
            contracts = [
              {
                id: uid("c"),
                no: contractNo,
                unit: input.contract.unit,
                property: property.name,
                propertyId,
                tenant: input.contract.tenantName,
                start: input.contract.start,
                end: input.contract.end,
                type: input.contract.type,
                rent: input.contract.rent,
              },
              ...s.contracts,
            ];
          }

          if (input.tenant && input.tenant.name && contractNo) {
            tenants = [
              {
                id: uid("tn"),
                name: input.tenant.name,
                unit: input.contract?.unit || "",
                contractNo,
                rent: input.contract?.rent || 0,
                phone: input.tenant.phone,
                status: "نشط",
                email: input.tenant.email || undefined,
                nationalId: input.tenant.nationalId || undefined,
                secondaryPhone: input.tenant.secondaryPhone || undefined,
                notes: input.tenant.notes || undefined,
                deposit: input.tenant.deposit || undefined,
              },
              ...s.tenants,
            ];
          }

          if (input.rent && contractNo) {
            rents = [
              {
                id: uid("r"),
                contractNo,
                tenant: input.contract?.tenantName || "",
                property: property.name,
                amount: input.rent.amount,
                dueDate: input.rent.dueDate,
                status: input.rent.status,
                method: input.rent.method || undefined,
                paidDate: input.rent.status === "مدفوع" ? input.rent.dueDate : undefined,
              },
              ...s.rents,
            ];
          }

          return {
            ...s,
            properties: [property, ...s.properties],
            contracts,
            tenants,
            rents,
          };
        });
        setSaving(false);
        pushToast("تم حفظ حزمة بيانات العقار في قاعدة البيانات");
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
        pushToast("تمت إضافة الوكيل/الشريك");
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
    }),
    [state, loading, saving, ready, toasts, pushToast],
  );

  return <StoreContext.Provider value={api}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used within StoreProvider");
  return ctx;
}
