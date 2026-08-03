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
import type {
  AppState,
  Contract,
  MaintStatus,
  MaintenanceRequest,
  Property,
  Technician,
  Toast,
  ToastKind,
} from "../data/types";

const STORAGE_KEY = "smart-employee-v1";

interface StoreApi {
  state: AppState;
  toasts: Toast[];
  login: (username: string, password: string) => boolean;
  logout: () => void;
  resetDemo: () => void;
  addProperty: (p: Omit<Property, "id" | "status">) => void;
  cyclePropertyStatus: (id: string) => void;
  addContract: (c: Omit<Contract, "id" | "no">) => void;
  renewContract: (id: string) => void;
  addMaintenance: (m: Omit<MaintenanceRequest, "id" | "no" | "status" | "tech">) => void;
  advanceMaintenance: (id: string) => void;
  addTechnician: (t: Omit<Technician, "id" | "rating">) => void;
  simulateSensors: () => void;
  pushToast: (msg: string, kind?: ToastKind) => void;
}

const StoreContext = createContext<StoreApi | null>(null);

function loadState(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return seedState();
    const parsed = JSON.parse(raw) as AppState;
    return { ...seedState(), ...parsed, loggedIn: Boolean(parsed.loggedIn) };
  } catch {
    return seedState();
  }
}

const STATUS_ORDER: MaintStatus[] = ["جديد", "قيد التنفيذ", "مكتمل"];

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>(() => loadState());
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

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
      resetDemo: () => {
        const next = seedState();
        next.loggedIn = true;
        setState(next);
        pushToast("تمت إعادة ضبط البيانات التجريبية");
      },
      addProperty: (p) => {
        setState((s) => ({
          ...s,
          properties: [{ id: uid("p"), status: "شاغرة", ...p }, ...s.properties],
        }));
        pushToast("تمت إضافة العقار بنجاح");
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
        pushToast("تمت إضافة العقد بنجاح");
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
            const idx = STATUS_ORDER.indexOf(m.status);
            const status = STATUS_ORDER[Math.min(idx + 1, STATUS_ORDER.length - 1)];
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
    }),
    [state, toasts, pushToast],
  );

  return <StoreContext.Provider value={api}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used within StoreProvider");
  return ctx;
}
