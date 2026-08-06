import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Trash2, Upload } from "lucide-react";
import { PageHeader } from "../components/PageHeader";
import { useStore } from "../lib/store";
import { parsePropertiesCsv } from "../engines";
import type { ContractType, PropertyType, RentPayment, TenantBlockInput } from "../data/types";
import "./pages.css";

type Mode = "choose" | "manual" | "import";

function emptyTenant(): TenantBlockInput {
  return {
    name: "",
    phone: "",
    unit: "",
    contractType: "إيجار سكني",
    start: "",
    end: "",
    rent: 0,
    rentAmount: 0,
    dueDate: "",
    rentStatus: "قادم",
  };
}

export function DataEntryPage() {
  const { savePropertyPackage, importProperties, saving, pushToast } = useStore();
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>("choose");
  const [tenants, setTenants] = useState<TenantBlockInput[]>([]);

  const updateTenant = (index: number, patch: Partial<TenantBlockInput>) => {
    setTenants((prev) => prev.map((t, i) => (i === index ? { ...t, ...patch } : t)));
  };

  const onManualSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const propertyName = String(fd.get("propName") || "").trim();
    if (!propertyName) return;

    for (let i = 0; i < tenants.length; i++) {
      const t = tenants[i];
      if (!t.name.trim() || !t.phone.trim() || !t.unit.trim() || !t.start || !t.end) {
        pushToast(`أكمل بيانات المستأجر رقم ${i + 1} (الإلزامية)`, "warn");
        return;
      }
    }

    await savePropertyPackage({
      property: {
        name: propertyName,
        location: String(fd.get("location") || "").trim(),
        city: String(fd.get("city") || "الرياض"),
        type: String(fd.get("type") || "سكني") as PropertyType,
        price: Number(fd.get("price") || 0),
        area: Number(fd.get("area") || 0),
        rooms: Number(fd.get("rooms") || 1),
        baths: Number(fd.get("baths") || 0) || undefined,
        notes: String(fd.get("propNotes") || "").trim() || undefined,
        ejarUnitId: String(fd.get("ejarUnitId") || "").trim() || undefined,
      },
      tenants: tenants.map((t) => ({
        ...t,
        name: t.name.trim(),
        phone: t.phone.trim(),
        unit: t.unit.trim(),
        email: t.email?.trim() || undefined,
        nationalId: t.nationalId?.trim() || undefined,
        secondaryPhone: t.secondaryPhone?.trim() || undefined,
        notes: t.notes?.trim() || undefined,
        method: t.method?.trim() || undefined,
        deposit: t.deposit || undefined,
      })),
    });

    navigate("/properties");
  };

  const onImport = async (file: File | null) => {
    if (!file) return;
    const text = await file.text();
    const result = parsePropertiesCsv(text);
    if (!result.properties.length) {
      pushToast(result.errors[0] || "تعذر استرداد البيانات", "danger");
      return;
    }
    importProperties(result.properties);
    pushToast("تم استرداد بيانات العقارات إلى الجدول");
    navigate("/properties");
  };

  return (
    <div className="stack">
      <PageHeader
        kicker="إدخال البيانات"
        title="صفحة إدخال بيانات العقار"
        desc="ابدأ بإدخال يدوي أو استرداد بيانات. الصفحة موحدة، وزر (+) يضيف بيانات مستأجر/عقد ثم الحفظ في قاعدة البيانات."
      />

      {mode === "choose" && (
        <section className="home-top-actions">
          <button className="card home-action primary-action" type="button" onClick={() => setMode("manual")}>
            <Plus size={20} />
            <div>
              <strong>إدخال يدوي</strong>
              <p className="muted">تعبئة بيانات العقار والمستأجرين يدوياً</p>
            </div>
          </button>
          <button className="card home-action" type="button" onClick={() => setMode("import")}>
            <Upload size={20} />
            <div>
              <strong>استرداد بيانات</strong>
              <p className="muted">استيراد ملف CSV للعقارات إلى الجدول</p>
            </div>
          </button>
        </section>
      )}

      {mode === "import" && (
        <section className="card block">
          <div className="block-head">
            <h3>استرداد بيانات عقارية</h3>
            <button className="btn btn-ghost" type="button" onClick={() => setMode("choose")}>
              رجوع للخيارات
            </button>
          </div>
          <p className="muted">
            الأعمدة: اسم العقار، الموقع، المدينة، النوع، الإيجار، المساحة، الغرف
          </p>
          <input type="file" accept=".csv,text/csv" onChange={(e) => void onImport(e.target.files?.[0] || null)} />
        </section>
      )}

      {mode === "manual" && (
        <form className="card block form-grid" onSubmit={onManualSubmit}>
          <div className="block-head" style={{ marginBottom: 0 }}>
            <h3 className="form-section-title" style={{ margin: 0 }}>
              بيانات العقار
            </h3>
            <button className="btn btn-ghost" type="button" onClick={() => setMode("choose")}>
              تغيير الطريقة
            </button>
          </div>

          <div className="field">
            <label htmlFor="propName">اسم العقار *</label>
            <input id="propName" name="propName" required placeholder="اسم العقار" />
          </div>
          <div className="field">
            <label htmlFor="location">الموقع *</label>
            <input id="location" name="location" required placeholder="الحي، المدينة" />
          </div>
          <div className="two-col">
            <div className="field">
              <label htmlFor="city">المدينة *</label>
              <select id="city" name="city" defaultValue="الرياض">
                <option>الرياض</option>
                <option>جدة</option>
                <option>الدمام</option>
                <option>الخبر</option>
                <option>مكة</option>
                <option>المدينة</option>
              </select>
            </div>
            <div className="field">
              <label htmlFor="type">النوع *</label>
              <select id="type" name="type" defaultValue="سكني">
                <option>سكني</option>
                <option>تجاري</option>
              </select>
            </div>
          </div>
          <div className="two-col">
            <div className="field">
              <label htmlFor="price">قيمة الإيجار السنوي *</label>
              <input id="price" name="price" type="number" min={0} required />
            </div>
            <div className="field">
              <label htmlFor="area">المساحة م² *</label>
              <input id="area" name="area" type="number" min={1} required />
            </div>
          </div>
          <div className="two-col">
            <div className="field">
              <label htmlFor="rooms">الغرف *</label>
              <input id="rooms" name="rooms" type="number" min={1} required defaultValue={1} />
            </div>
            <div className="field">
              <label htmlFor="baths">
                دورات المياه <span className="opt">(اختياري)</span>
              </label>
              <input id="baths" name="baths" type="number" min={0} />
            </div>
          </div>
          <div className="field">
            <label htmlFor="ejarUnitId">
              رقم الوحدة في إيجار <span className="opt">(اختياري)</span>
            </label>
            <input id="ejarUnitId" name="ejarUnitId" placeholder="للربط مع منصة إيجار" />
          </div>
          <div className="field">
            <label htmlFor="propNotes">
              ملاحظات العقار <span className="opt">(اختياري)</span>
            </label>
            <textarea id="propNotes" name="propNotes" />
          </div>

          <div className="block-head">
            <h3 className="form-section-title" style={{ margin: 0 }}>
              بيانات المستأجرين / العقود
            </h3>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setTenants((prev) => [...prev, emptyTenant()])}
            >
              <Plus size={16} /> إضافة بيانات مستأجر
            </button>
          </div>

          {!tenants.length && (
            <div className="empty">
              لا يوجد مستأجر بعد. اضغط (+) لإضافة بيانات مستأجر وعقد وإيجار، أو احفظ العقار شاغراً.
            </div>
          )}

          {tenants.map((t, index) => (
            <div key={index} className="tenant-block card">
              <div className="block-head">
                <h3>مستأجر {index + 1}</h3>
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => setTenants((prev) => prev.filter((_, i) => i !== index))}
                >
                  <Trash2 size={16} /> حذف
                </button>
              </div>

              <div className="field">
                <label>اسم المستأجر *</label>
                <input
                  required
                  value={t.name}
                  onChange={(e) => updateTenant(index, { name: e.target.value })}
                />
              </div>
              <div className="two-col">
                <div className="field">
                  <label>الجوال *</label>
                  <input
                    required
                    value={t.phone}
                    onChange={(e) => updateTenant(index, { phone: e.target.value })}
                    placeholder="05xxxxxxxx"
                  />
                </div>
                <div className="field">
                  <label>الوحدة *</label>
                  <input
                    required
                    value={t.unit}
                    onChange={(e) => updateTenant(index, { unit: e.target.value })}
                  />
                </div>
              </div>
              <div className="two-col">
                <div className="field">
                  <label>نوع العقد *</label>
                  <select
                    value={t.contractType}
                    onChange={(e) =>
                      updateTenant(index, { contractType: e.target.value as ContractType })
                    }
                  >
                    <option>إيجار سكني</option>
                    <option>إيجار تجاري</option>
                    <option>عقد صيانة</option>
                  </select>
                </div>
                <div className="field">
                  <label>قيمة الإيجار السنوي *</label>
                  <input
                    type="number"
                    min={0}
                    required
                    value={t.rent || ""}
                    onChange={(e) =>
                      updateTenant(index, {
                        rent: Number(e.target.value || 0),
                        rentAmount: Number(e.target.value || 0),
                      })
                    }
                  />
                </div>
              </div>
              <div className="two-col">
                <div className="field">
                  <label>بداية العقد *</label>
                  <input
                    type="date"
                    required
                    value={t.start}
                    onChange={(e) => updateTenant(index, { start: e.target.value })}
                  />
                </div>
                <div className="field">
                  <label>نهاية العقد *</label>
                  <input
                    type="date"
                    required
                    value={t.end}
                    onChange={(e) => updateTenant(index, { end: e.target.value })}
                  />
                </div>
              </div>
              <div className="two-col">
                <div className="field">
                  <label>مبلغ دفعة الإيجار *</label>
                  <input
                    type="number"
                    min={0}
                    required
                    value={t.rentAmount || ""}
                    onChange={(e) => updateTenant(index, { rentAmount: Number(e.target.value || 0) })}
                  />
                </div>
                <div className="field">
                  <label>تاريخ الاستحقاق *</label>
                  <input
                    type="date"
                    required
                    value={t.dueDate}
                    onChange={(e) => updateTenant(index, { dueDate: e.target.value })}
                  />
                </div>
              </div>
              <div className="two-col">
                <div className="field">
                  <label>حالة الدفعة *</label>
                  <select
                    value={t.rentStatus}
                    onChange={(e) =>
                      updateTenant(index, {
                        rentStatus: e.target.value as RentPayment["status"],
                      })
                    }
                  >
                    <option>قادم</option>
                    <option>مدفوع</option>
                    <option>متأخر</option>
                  </select>
                </div>
                <div className="field">
                  <label>
                    طريقة الدفع <span className="opt">(اختياري)</span>
                  </label>
                  <input
                    value={t.method || ""}
                    onChange={(e) => updateTenant(index, { method: e.target.value })}
                  />
                </div>
              </div>
              <div className="field">
                <label>
                  البريد <span className="opt">(اختياري)</span>
                </label>
                <input
                  type="email"
                  value={t.email || ""}
                  onChange={(e) => updateTenant(index, { email: e.target.value })}
                />
              </div>
              <div className="two-col">
                <div className="field">
                  <label>
                    رقم الهوية / الإقامة <span className="opt">(اختياري)</span>
                  </label>
                  <input
                    value={t.nationalId || ""}
                    onChange={(e) => updateTenant(index, { nationalId: e.target.value })}
                  />
                </div>
                <div className="field">
                  <label>
                    جوال إضافي <span className="opt">(اختياري)</span>
                  </label>
                  <input
                    value={t.secondaryPhone || ""}
                    onChange={(e) => updateTenant(index, { secondaryPhone: e.target.value })}
                  />
                </div>
              </div>
              <div className="two-col">
                <div className="field">
                  <label>
                    مبلغ التأمين <span className="opt">(اختياري)</span>
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={t.deposit || ""}
                    onChange={(e) => updateTenant(index, { deposit: Number(e.target.value || 0) })}
                  />
                </div>
                <div className="field">
                  <label>
                    ملاحظات <span className="opt">(اختياري)</span>
                  </label>
                  <input
                    value={t.notes || ""}
                    onChange={(e) => updateTenant(index, { notes: e.target.value })}
                  />
                </div>
              </div>
            </div>
          ))}

          <button
            type="button"
            className="btn btn-soft"
            onClick={() => setTenants((prev) => [...prev, emptyTenant()])}
          >
            <Plus size={16} /> إضافة مستأجر آخر
          </button>

          <button className="btn btn-primary" type="submit" disabled={saving}>
            {saving ? "جاري الحفظ في الجداول..." : "حفظ في قاعدة البيانات"}
          </button>
        </form>
      )}
    </div>
  );
}
