/**
 * محرك الاستيراد البسيط — CSV عربي/إنجليزي للعقارات والعقود.
 * جاهز للتوسع لاحقاً إلى Excel/Sheets دون كسر التوافق.
 */

export interface ImportedPropertyRow {
  name: string;
  location: string;
  city: string;
  type: "سكني" | "تجاري";
  price: number;
  area: number;
  rooms: number;
}

export interface ImportResult {
  properties: ImportedPropertyRow[];
  errors: string[];
}

function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let q = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      q = !q;
      continue;
    }
    if (ch === "," && !q) {
      out.push(cur.trim());
      cur = "";
      continue;
    }
    cur += ch;
  }
  out.push(cur.trim());
  return out;
}

const HEADER_MAP: Record<string, keyof ImportedPropertyRow | "skip"> = {
  name: "name",
  الاسم: "name",
  "اسم العقار": "name",
  location: "location",
  الموقع: "location",
  city: "city",
  المدينة: "city",
  type: "type",
  النوع: "type",
  price: "price",
  الإيجار: "price",
  "قيمة الإيجار": "price",
  area: "area",
  المساحة: "area",
  rooms: "rooms",
  الغرف: "rooms",
};

export function parsePropertiesCsv(text: string): ImportResult {
  const lines = text
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  if (lines.length < 2) {
    return { properties: [], errors: ["الملف فارغ أو بدون بيانات"] };
  }

  const rawHeaders = splitCsvLine(lines[0]);
  const cols = rawHeaders.map((h) => HEADER_MAP[h] || HEADER_MAP[h.toLowerCase()] || null);

  if (!cols.includes("name")) {
    return { properties: [], errors: ["عمود اسم العقار مفقود"] };
  }

  const properties: ImportedPropertyRow[] = [];
  const errors: string[] = [];

  lines.slice(1).forEach((line, idx) => {
    const cells = splitCsvLine(line);
    const row: Partial<ImportedPropertyRow> = {};
    cols.forEach((key, i) => {
      if (!key || key === "skip") return;
      const val = cells[i] ?? "";
      if (key === "price" || key === "area" || key === "rooms") {
        (row as Record<string, number>)[key] = Number(String(val).replace(/[^\d.]/g, "")) || 0;
      } else if (key === "type") {
        row.type = val.includes("تجار") || val.toLowerCase().includes("comm") ? "تجاري" : "سكني";
      } else {
        (row as Record<string, string>)[key] = val;
      }
    });

    if (!row.name) {
      errors.push(`سطر ${idx + 2}: اسم العقار فارغ`);
      return;
    }

    properties.push({
      name: row.name,
      location: row.location || "غير محدد",
      city: row.city || "الرياض",
      type: row.type || "سكني",
      price: row.price || 0,
      area: row.area || 0,
      rooms: row.rooms || 1,
    });
  });

  return { properties, errors };
}
