import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { PageHeader } from "../components/PageHeader";
import { useStore } from "../lib/store";
import type { ContractType, PropertyType, RentPayment } from "../data/types";
import "./pages.css";

export function DataEntryPage() {
  const { savePropertyPackage, saving } = useStore();
  const navigate = useNavigate();
  const [includeTenant, setIncludeTenant] = useState(true);

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);

    const propertyName = String(fd.get("propName") || "").trim();
    if (!propertyName) return;

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
      },
      contract: includeTenant
        ? {
            unit: String(fd.get("unit") || "").trim(),
            tenantName: String(fd.get("tenantName") || "").trim(),
            type: String(fd.get("contractType") || "إيجار سكني") as ContractType,
            start: String(fd.get("start") || ""),
            end: String(fd.get("end") || ""),
            rent: Number(fd.get("rent") || 0),
          }
        : undefined,
      tenant: includeTenant
        ? {
            name: String(fd.get("tenantName") || "").trim(),
            phone: String(fd.get("phone") || "").trim(),
            email: String(fd.get("email") || "").trim() || undefined,
            nationalId: String(fd.get("nationalId") || "").trim() || undefined,
            secondaryPhone: String(fd.get("secondaryPhone") || "").trim() || undefined,
            notes: String(fd.get("tenantNotes") || "").trim() || undefined,
            deposit: Number(fd.get("deposit") || 0) || undefined,
          }
        : undefined,
      rent: includeTenant
        ? {
            amount: Number(fd.get("rentAmount") || fd.get("rent") || 0),
            dueDate: String(fd.get("dueDate") || fd.get("start") || ""),
            status: String(fd.get("rentStatus") || "قادم") as RentPayment["status"],
            method: String(fd.get("method") || "").trim() || undefined,
          }
        : undefined,
    });

    navigate("/properties");
  };

  return (
    <div className="stack">
      <PageHeader
        kicker="إدخال البيانات"
        title="صفحة إدخال بيانات العقار"
        desc="أدخل العقار والعقد والإيجار وبيانات المستأجر في صفحة واحدة — ثم تُحفظ في قاعدة البيانات."
      />

      <form className="card block form-grid" onSubmit={onSubmit}>
        <h3 className="form-section-title">1) بيانات العقار (إلزامي)</h3>
        <div className="field">
          <label htmlFor="propName">اسم العقار *</label>
          <input id="propName" name="propName" required placeholder="فيلا النرجس" />
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
            <input id="rooms" name="rooms" type="number" min={1} required defaultValue={3} />
          </div>
          <div className="field">
            <label htmlFor="baths">
              دورات المياه <span className="opt">(اختياري)</span>
            </label>
            <input id="baths" name="baths" type="number" min={0} />
          </div>
        </div>
        <div className="field">
          <label htmlFor="propNotes">
            ملاحظات العقار <span className="opt">(اختياري)</span>
          </label>
          <textarea id="propNotes" name="propNotes" placeholder="أي تفاصيل إضافية" />
        </div>

        <label className="check-row">
          <input
            type="checkbox"
            checked={includeTenant}
            onChange={(e) => setIncludeTenant(e.target.checked)}
          />
          إضافة عقد ومستأجر وإيجار مع هذا العقار
        </label>

        {includeTenant && (
          <>
            <h3 className="form-section-title">2) العقد والإيجار</h3>
            <div className="two-col">
              <div className="field">
                <label htmlFor="unit">الوحدة *</label>
                <input id="unit" name="unit" required={includeTenant} placeholder="شقة 210" />
              </div>
              <div className="field">
                <label htmlFor="contractType">نوع العقد *</label>
                <select id="contractType" name="contractType" defaultValue="إيجار سكني">
                  <option>إيجار سكني</option>
                  <option>إيجار تجاري</option>
                  <option>عقد صيانة</option>
                </select>
              </div>
            </div>
            <div className="two-col">
              <div className="field">
                <label htmlFor="start">بداية العقد *</label>
                <input id="start" name="start" type="date" required={includeTenant} />
              </div>
              <div className="field">
                <label htmlFor="end">نهاية العقد *</label>
                <input id="end" name="end" type="date" required={includeTenant} />
              </div>
            </div>
            <div className="two-col">
              <div className="field">
                <label htmlFor="rent">قيمة الإيجار السنوي *</label>
                <input id="rent" name="rent" type="number" min={0} required={includeTenant} />
              </div>
              <div className="field">
                <label htmlFor="rentAmount">مبلغ دفعة الإيجار *</label>
                <input id="rentAmount" name="rentAmount" type="number" min={0} required={includeTenant} />
              </div>
            </div>
            <div className="two-col">
              <div className="field">
                <label htmlFor="dueDate">تاريخ استحقاق الدفعة *</label>
                <input id="dueDate" name="dueDate" type="date" required={includeTenant} />
              </div>
              <div className="field">
                <label htmlFor="rentStatus">حالة الدفعة *</label>
                <select id="rentStatus" name="rentStatus" defaultValue="قادم">
                  <option>قادم</option>
                  <option>مدفوع</option>
                  <option>متأخر</option>
                </select>
              </div>
            </div>
            <div className="field">
              <label htmlFor="method">
                طريقة الدفع <span className="opt">(اختياري)</span>
              </label>
              <input id="method" name="method" placeholder="تحويل / شبكة / نقداً" />
            </div>

            <h3 className="form-section-title">3) بيانات المستأجر</h3>
            <div className="field">
              <label htmlFor="tenantName">اسم المستأجر *</label>
              <input id="tenantName" name="tenantName" required={includeTenant} />
            </div>
            <div className="field">
              <label htmlFor="phone">الجوال *</label>
              <input id="phone" name="phone" required={includeTenant} placeholder="05xxxxxxxx" />
            </div>
            <div className="field">
              <label htmlFor="email">
                البريد الإلكتروني <span className="opt">(اختياري)</span>
              </label>
              <input id="email" name="email" type="email" placeholder="name@email.com" />
            </div>
            <div className="field">
              <label htmlFor="nationalId">
                رقم الهوية / الإقامة <span className="opt">(اختياري)</span>
              </label>
              <input id="nationalId" name="nationalId" />
            </div>
            <div className="field">
              <label htmlFor="secondaryPhone">
                جوال إضافي <span className="opt">(اختياري)</span>
              </label>
              <input id="secondaryPhone" name="secondaryPhone" placeholder="05xxxxxxxx" />
            </div>
            <div className="field">
              <label htmlFor="deposit">
                مبلغ التأمين <span className="opt">(اختياري)</span>
              </label>
              <input id="deposit" name="deposit" type="number" min={0} />
            </div>
            <div className="field">
              <label htmlFor="tenantNotes">
                ملاحظات المستأجر <span className="opt">(اختياري)</span>
              </label>
              <textarea id="tenantNotes" name="tenantNotes" />
            </div>
          </>
        )}

        <button className="btn btn-primary" type="submit" disabled={saving}>
          {saving ? "جاري الحفظ في قاعدة البيانات..." : "حفظ في قاعدة البيانات"}
        </button>
      </form>
    </div>
  );
}
