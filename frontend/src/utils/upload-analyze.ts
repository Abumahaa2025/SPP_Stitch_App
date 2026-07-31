import * as XLSX from 'xlsx';

import type { UploadResult } from '@/src/components/UploadResultCard';
import type { ColumnField, ColumnMapping } from './upload-parse';

export type { ColumnField, ColumnMapping } from './upload-parse';

const SNIPPET_MAX = 120_000;
const EXCEL_MAX_BYTES = 8_000_000;

export type PickedFile = { name: string; mimeType?: string; size?: number; uri?: string };

type Lang = 'en' | 'ar';

const MONTH_HINT = /(?:شهر|month|يناير|فبر|مار|أب|مايو|يون|jan|feb|mar|apr|may|jun)/i;

function ext(name: string): string {
  const i = name.lastIndexOf('.');
  return i >= 0 ? name.slice(i + 1).toLowerCase() : '';
}

export type PropertyDocType =
  | 'rent_roll'
  | 'maintenance'
  | 'expense'
  | 'contract'
  | 'comprehensive'
  | 'document';

function classifyPropertyDoc(name: string): { type: PropertyDocType; labelAr: string; labelEn: string; confidence: number } {
  const lower = name.toLowerCase();
  if (/(?:صيان|maint|repair|بلاغ)/.test(lower) && /(?:كشف|roll|xlsx|xls)/.test(lower)) {
    return { type: 'maintenance', labelAr: 'كشف صيانة', labelEn: 'Maintenance log', confidence: 88 };
  }
  if (/(?:مصروف|expense|فاتورة|invoice)/.test(lower) && !/(?:إيجار|rent roll)/.test(lower)) {
    return { type: 'expense', labelAr: 'كشف مصروفات', labelEn: 'Expense sheet', confidence: 86 };
  }
  if (/(?:كشف شامل|comprehensive|ملخص محفظة)/.test(lower)) {
    return { type: 'comprehensive', labelAr: 'كشف شامل', labelEn: 'Comprehensive statement', confidence: 90 };
  }
  if (/(?:كشف|roll|إيجار|ايجار|rent|تحصيل)/.test(lower) && (MONTH_HINT.test(lower) || /\.xlsx?$/.test(lower))) {
    return { type: 'rent_roll', labelAr: 'كشف إيجارات شهري', labelEn: 'Monthly rent roll', confidence: 90 };
  }
  if (/(?:عقد|contract|lease)/.test(lower)) {
    return { type: 'contract', labelAr: 'عقد إيجار', labelEn: 'Lease contract', confidence: 85 };
  }
  if (/\.xlsx?$/.test(lower)) {
    return { type: 'rent_roll', labelAr: 'جدول إيجارات', labelEn: 'Rent spreadsheet', confidence: 72 };
  }
  if (/\.pdf$/.test(lower)) {
    return { type: 'document', labelAr: 'مستند PDF', labelEn: 'PDF document', confidence: 65 };
  }
  return { type: 'document', labelAr: 'مستند عقاري', labelEn: 'Property document', confidence: 55 };
}

function buildResult(file: PickedFile, lang: Lang, index: number): UploadResult {
  const cls = classifyPropertyDoc(file.name);
  const type = lang === 'ar' ? cls.labelAr : cls.labelEn;
  const e = ext(file.name);
  const confidence = cls.confidence - index * 2;

  const summariesAr: Record<PropertyDocType, string> = {
    rent_roll: 'كشف إيجارات — وحدات، مستأجرون، مبالغ شهرية للربط مع الأشهر السابقة.',
    maintenance: 'كشف صيانة — بنود، وحدات، تكاليف — يُربط بالمستأجرين والعقارات.',
    expense: 'كشف مصروفات — فواتير وخدمات ومصاريف تشغيل.',
    contract: 'عقد إيجار — تواريخ، أطراف، قيمة — للتجديد والمتابعة.',
    comprehensive: 'كشف شامل — إيجارات ومصروفات وصيانة في ملف واحد.',
    document: 'مستند عقاري — يُصنّف ويُربط بالمحفظة.',
  };
  const actionsAr: Record<PropertyDocType, string> = {
    rent_roll: 'يُربط مع كشوف الأشهر الأخرى — مغادرون، متأخرون، تحصيل.',
    maintenance: 'يُستخرج أكثر بند تكرر وأكثر وحدة تكلفة.',
    expense: 'يُجمع مع الإيجار لحساب صافي الربح.',
    contract: 'راجع التجديد والتواريخ قبل الاعتماد.',
    comprehensive: 'يُفكّك إلى إيجار + مصروف + صيانة.',
    document: 'راجع الحقول ثم اعتمد بعد المراجعة.',
  };

  if (lang === 'ar') {
    return {
      id: `${Date.now()}-${index}`,
      fileName: file.name,
      sourceFile: file.name,
      documentType: type,
      summary: summariesAr[cls.type],
      detected: [
        `النوع: ${cls.labelAr}`,
        `الامتداد: .${e || '—'}`,
        file.size ? `الحجم: ${Math.round(file.size / 1024)} ك.ب` : 'الحجم: —',
      ],
      whyItMatters: 'كشوف العقار تغذّي التحصيل والصيانة والعقود — وليس مجرد رفع ملفات.',
      recommendedAction: actionsAr[cls.type],
      confidence: Math.max(55, Math.min(96, confidence)),
      linkedProperty: 'محفظة SPP',
    };
  }

  return {
    id: `${Date.now()}-${index}`,
    fileName: file.name,
    sourceFile: file.name,
    documentType: type,
    summary: `Property ${cls.labelEn} — linked to portfolio intake engine.`,
    detected: [`Type: ${cls.labelEn}`, `Ext: .${e || '—'}`],
    whyItMatters: 'Property statements drive collection, maintenance, and contract decisions.',
    recommendedAction: actionsAr[cls.type],
    confidence: Math.max(55, Math.min(96, confidence)),
    linkedProperty: 'SPP portfolio',
  };
}

/** Convert Excel to CSV text — same approach as legacy Smart Property web (SheetJS). */
async function readExcelAsCsvSnippet(file: PickedFile): Promise<string | undefined> {
  if (!file.uri) return undefined;
  if (file.size && file.size > EXCEL_MAX_BYTES) return undefined;
  try {
    const res = await fetch(file.uri);
    const ab = await res.arrayBuffer();
    const wb = XLSX.read(new Uint8Array(ab), { type: 'array', cellDates: true });
    const sheetName = wb.SheetNames[0];
    if (!sheetName) return undefined;
    const sheet = wb.Sheets[sheetName];
    const csv = XLSX.utils.sheet_to_csv(sheet, { FS: ',', RS: '\n' });
    return csv.slice(0, SNIPPET_MAX);
  } catch {
    return undefined;
  }
}

/** Read CSV/TSV/text/Excel snippet for server-side parsing (no UI change). */
export async function readPropertyFileSnippet(file: PickedFile): Promise<string | undefined> {
  const lower = file.name.toLowerCase();
  if (/\.(xlsx|xls)$/.test(lower)) {
    return readExcelAsCsvSnippet(file);
  }
  if (!/\.(csv|txt|tsv)$/.test(lower) || !file.uri) return undefined;
  try {
    const res = await fetch(file.uri);
    const text = await res.text();
    return text.slice(0, SNIPPET_MAX);
  } catch {
    return undefined;
  }
}

/** Client-side preview — only when no parsed data; prefer buildResultsFromParsedData. */
export async function analyzePickedFiles(files: PickedFile[], lang: Lang): Promise<UploadResult[]> {
  await new Promise((r) => setTimeout(r, 300));
  return files.map((f, i) => buildResult(f, lang, i));
}

const COLUMN_ALIASES: Record<string, string[]> = {
  // Order matters: most specific first so "حالة العقد" and "نهاية العقد"
  // don't collapse to the generic contract-number field.
  contract_status: ['contract status', 'حالة العقد', 'حالة عقد', 'حالة', 'status'],
  contract_end: ['contract end', 'end date', 'تاريخ الانتهاء', 'تاريخ النهاية', 'نهاية العقد', 'انتهاء', 'expiry'],
  arrears: ['arrears', 'متأخرات', 'إجمالي المتأخرات', 'اجمالي المتأخرات', 'متبقي', 'remaining', 'outstanding', 'unpaid'],
  unit: ['unit', 'وحدة', 'شقة', 'رقم', 'apt'],
  tenant: ['tenant', 'مستأجر', 'اسم', 'name'],
  rent: ['rent', 'إيجار', 'ايجار', 'مبلغ', 'amount', 'تحصيل'],
  phone: ['phone', 'جوال', 'mobile', 'هاتف', 'tel'],
  contract: ['contract', 'عقد', 'lease'],
};

export type FilePreview = {
  fileName: string;
  rowCount: number;
  columnCount: number;
  columns: string[];
  recognizedColumns: string[];
  previewRows: string[][];
  parseable: boolean;
  mapping: ColumnMapping;
  allRows: string[][];
};

function autoDetectMapping(headers: string[]): ColumnMapping {
  const mapping: ColumnMapping = {};
  headers.forEach((h) => {
    const lower = h.toLowerCase();
    let field: ColumnField = 'skip';
    for (const [key, aliases] of Object.entries(COLUMN_ALIASES)) {
      if (aliases.some((a) => lower.includes(a.toLowerCase()) || h.includes(a))) {
        field = key as ColumnField;
        break;
      }
    }
    mapping[h] = field;
  });
  return mapping;
}

function mappedFieldCount(mapping: ColumnMapping): number {
  return Object.values(mapping).filter((f) => f !== 'skip').length;
}

function splitRow(line: string): string[] {
  const delim = line.includes('\t') ? '\t' : ',';
  return line.split(delim).map((c) => c.trim().replace(/^"|"$/g, ''));
}

/** Local spreadsheet preview before server analysis. */
export async function buildFilePreview(file: PickedFile, mappingOverride?: ColumnMapping): Promise<FilePreview | null> {
  const snippet = await readPropertyFileSnippet(file);
  if (!snippet) return null;
  const lines = snippet.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 1) return null;
  const rows = lines.map(splitRow);
  const headers = rows[0];
  const dataRows = rows.slice(1);
  const mapping = mappingOverride ?? autoDetectMapping(headers);
  const recognized = headers.filter((h) => mapping[h] && mapping[h] !== 'skip');
  return {
    fileName: file.name,
    rowCount: dataRows.length,
    columnCount: headers.length,
    columns: headers,
    recognizedColumns: recognized,
    previewRows: dataRows.slice(0, 5),
    allRows: dataRows,
    mapping,
    parseable: mappedFieldCount(mapping) >= 2 && dataRows.length > 0,
  };
}

/** Re-check parseability after user adjusts column mapping. */
export function previewWithMapping(preview: FilePreview, mapping: ColumnMapping): FilePreview {
  const recognized = preview.columns.filter((h) => mapping[h] && mapping[h] !== 'skip');
  return {
    ...preview,
    mapping,
    recognizedColumns: recognized,
    parseable: mappedFieldCount(mapping) >= 2 && preview.rowCount > 0,
  };
}

/** Build API payload with optional text snippets for deep parse. */
export async function buildUploadFileMeta(files: PickedFile[]) {
  return Promise.all(
    files.map(async (f) => {
      const lower = f.name.toLowerCase();
      const isExcel = /\.(xlsx|xls)$/.test(lower);
      const textSnippet = await readPropertyFileSnippet(f);
      return {
        name: f.name,
        mimeType: f.mimeType,
        size: f.size,
        ...(textSnippet ? { textSnippet } : {}),
        ...(textSnippet && isExcel ? { parsedFromExcel: true } : {}),
      };
    }),
  );
}
