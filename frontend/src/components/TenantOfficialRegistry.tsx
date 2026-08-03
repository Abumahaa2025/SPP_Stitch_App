/**
 * Official tenant registry — lives in Database center.
 * Horizontal Excel-style sheet; tap name → expand months/details in-table.
 */
import React, { useCallback, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, Pressable, TextInput, Modal, Alert, Linking, Share, ScrollView, Platform,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Feather } from '@expo/vector-icons';

import { ScreenScaffold } from '@/src/components/ScreenScaffold';
import { StoryScreenHeader } from '@/src/components/StoryScreenHeader';
import { GlassCard } from '@/src/components/GlassCard';
import { AliveEmpty } from '@/src/components/AliveEmpty';
import { buildTenantOperationalView } from '@/src/components/OperationalTenantCard';
import { usePropertyOS } from '@/src/hooks/usePropertyOS';
import { useNotificationPrefs } from '@/src/hooks/usePreferences';
import {
  loadCanonicalTenants,
  updateCanonicalTenant,
  vacateCanonicalTenant,
  transferCanonicalTenant,
  addNewOfficialTenant,
  buildWhatsAppCollectionMessage,
  syncCanonicalFromPropertyOS,
} from '@/src/utils/canonical-tenant-store';
import { buildPropertyExcelCsv, sharePropertyExcel } from '@/src/utils/property-excel-export';
import { ensureTenantPortalLink } from '@/src/utils/ensure-tenant-portal';
import { notifyTenantSaved } from '@/src/utils/local-notifications';
import type { CanonicalTenant, CanonicalTenantState } from '@/src/types/canonical-tenant';
import type { PaymentLedgerEntry, PropertyOSState } from '@/src/types/property-os';
import { colors, spacing, typography, radius } from '@/src/theme';
import { useI18n } from '@/src/i18n';

function fmtMoney(n: number, ar: boolean) {
  return `${Number(n || 0).toLocaleString()} ${ar ? 'ر.س' : 'SAR'}`;
}

/** Arabic-aware normalize so أ/ا/ة and Eastern digits still match. */
function normalizeSearch(s: string): string {
  return String(s || '')
    .toLowerCase()
    .replace(/[أإآٱا]/g, 'ا')
    .replace(/[ىي]/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
    .replace(/[^\u0600-\u06FFa-z0-9\s]/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function matchesTenantQuery(t: CanonicalTenant, rawQ: string): boolean {
  const q = normalizeSearch(rawQ);
  if (!q) return true;
  const hay = normalizeSearch([t.name, t.phone, t.unitNumber, t.contractNumber, t.notes || ''].join(' '));
  if (hay.includes(q)) return true;
  const digits = String(rawQ || '').replace(/\D/g, '');
  if (digits.length >= 3 && (t.phone || '').replace(/\D/g, '').includes(digits)) return true;
  return false;
}

function fromOsTenants(os: PropertyOSState): CanonicalTenant[] {
  return os.tenants.map((t) => {
    const unit = os.units.find((u) => u.id === t.unitId);
    const contract = os.contracts.find((c) => c.tenantId === t.id);
    return {
      id: t.id,
      osTenantId: t.id,
      unitId: t.unitId,
      unitNumber: unit?.number || '—',
      name: t.name || '—',
      phone: t.phone || '',
      rentAmount: Number(contract?.rentAmount ?? unit?.rentAmount ?? 0),
      contractNumber: contract?.number || '',
      status: 'active' as const,
      official: true,
      source: 'import' as const,
      notes: '',
      updatedAt: '',
    } satisfies CanonicalTenant;
  });
}

/** Last-resort rows from payment ledger when tenants array is empty. */
function fromLedger(os: PropertyOSState): CanonicalTenant[] {
  const map = new Map<string, CanonicalTenant>();
  for (const row of os.paymentLedger || []) {
    if (!row.tenantId || map.has(row.tenantId)) continue;
    map.set(row.tenantId, {
      id: `ldg_${row.tenantId}`,
      osTenantId: row.tenantId,
      unitId: row.unitId || '',
      unitNumber: row.unit || '—',
      name: row.tenant || '—',
      phone: '',
      rentAmount: Number(row.due) || 0,
      contractNumber: '',
      status: 'active',
      official: true,
      source: 'import',
      notes: '',
      updatedAt: '',
    });
  }
  return [...map.values()];
}

function buildCatalog(reg: CanonicalTenantState, os: PropertyOSState): CanonicalTenant[] {
  // Prefer a merge: OS is source of truth for current occupancy; registry keeps official edits.
  const fromOs = fromOsTenants(os);
  const byOsId = new Map(reg.tenants.filter((t) => t.status === 'active').map((t) => [t.osTenantId || t.id, t]));
  if (fromOs.length) {
    return fromOs.map((osRow) => {
      const regRow = byOsId.get(osRow.osTenantId || osRow.id);
      if (!regRow) return osRow;
      return {
        ...osRow,
        id: regRow.id,
        name: regRow.source === 'manual_official' ? regRow.name : (osRow.name || regRow.name),
        phone: regRow.source === 'manual_official' ? regRow.phone : (osRow.phone || regRow.phone),
        rentAmount: regRow.source === 'manual_official' ? regRow.rentAmount : (osRow.rentAmount || regRow.rentAmount),
        contractNumber: regRow.source === 'manual_official'
          ? regRow.contractNumber
          : (osRow.contractNumber || regRow.contractNumber),
        email: regRow.email || osRow.email,
        nationalId: regRow.nationalId || osRow.nationalId,
        notes: regRow.notes || '',
        source: regRow.source,
        official: true,
      };
    });
  }
  const fromReg = reg.tenants.filter((t) => t.status === 'active');
  if (fromReg.length) return fromReg;
  return fromLedger(os);
}

function monthsForTenant(os: PropertyOSState, t: CanonicalTenant): PaymentLedgerEntry[] {
  const ledger = os.paymentLedger || [];
  let rows = t.osTenantId ? ledger.filter((l) => l.tenantId === t.osTenantId) : [];
  if (!rows.length && t.name) {
    const n = normalizeSearch(t.name);
    rows = ledger.filter((l) => normalizeSearch(l.tenant).includes(n) || n.includes(normalizeSearch(l.tenant)));
  }
  return rows
    .sort((a, b) => String(a.monthKey || '').localeCompare(String(b.monthKey || '')))
    .slice(-8);
}

function statusCell(ar: boolean, rows: PaymentLedgerEntry[]) {
  if (!rows.length) return '—';
  const arrears = rows.reduce((s, r) => s + (Number(r.remaining) || 0), 0);
  if (arrears > 0.009) return ar ? 'متأخر' : 'Late';
  return ar ? 'ملتزم' : 'OK';
}

type Props = {
  /** database = home of official registry (default). */
  variant?: 'database' | 'legacy';
  testID?: string;
};

export function TenantOfficialRegistry({ variant = 'database', testID = 'database-center' }: Props) {
  const { isRTL, lang } = useI18n();
  const ar = lang === 'ar' || !!isRTL;
  const router = useRouter();
  const { countEnabled } = useNotificationPrefs();
  const { state: os, reload } = usePropertyOS(countEnabled);
  const [reg, setReg] = useState<CanonicalTenantState>({ tenants: [], events: [] });
  const [query, setQuery] = useState('');
  const [searchHit, setSearchHit] = useState<CanonicalTenant | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [edit, setEdit] = useState<CanonicalTenant | null>(null);
  const [noteTenant, setNoteTenant] = useState<CanonicalTenant | null>(null);
  const [draftName, setDraftName] = useState('');
  const [draftPhone, setDraftPhone] = useState('');
  const [draftRent, setDraftRent] = useState('');
  const [draftContract, setDraftContract] = useState('');
  const [draftNote, setDraftNote] = useState('');
  const [draftEmail, setDraftEmail] = useState('');
  const [draftNationalId, setDraftNationalId] = useState('');
  const [draftExtra, setDraftExtra] = useState('');
  const [moreFields, setMoreFields] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [newUnitId, setNewUnitId] = useState('');

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2800);
  }, []);

  const refresh = useCallback(async () => {
    await reload();
    const raw = await import('@/src/utils/storage').then((m) => m.storage.getItem<string>('spp.propertyOS', ''));
    let s = await loadCanonicalTenants();
    if (raw) {
      try {
        const osState = JSON.parse(raw) as PropertyOSState;
        if (osState?.tenants?.length || (osState?.paymentLedger || []).length) {
          if (osState.tenants?.length) {
            s = await syncCanonicalFromPropertyOS(osState, { lang: ar ? 'ar' : 'en' });
          }
        }
      } catch { /* ignore */ }
    }
    setReg(s);
  }, [reload, ar]);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  const catalog = useMemo(() => buildCatalog(reg, os), [reg, os]);

  const active = useMemo(
    () => catalog.filter((t) => matchesTenantQuery(t, query)),
    [catalog, query],
  );

  const searchSuggestions = useMemo(() => {
    const q = query.trim();
    if (q.length < 1) return [] as CanonicalTenant[];
    return catalog.filter((t) => matchesTenantQuery(t, q)).slice(0, 8);
  }, [catalog, query]);

  const runSearch = (text?: string) => {
    const q = (text ?? query).trim();
    if (!q) {
      Alert.alert(ar ? 'أدخل كلمة بحث' : 'Enter a search term');
      return;
    }
    const hits = catalog.filter((t) => matchesTenantQuery(t, q));
    if (hits.length) {
      Haptics.selectionAsync();
      setSearchHit(hits[0]);
      setExpandedId(hits[0].id);
    } else {
      Alert.alert(
        ar ? 'لا نتائج' : 'No results',
        ar ? 'لم يُعثر على مستأجر — جرّب الاسم أو الوحدة أو الجوال.' : 'No tenant matched — try name, unit, or phone.',
      );
    }
  };

  const exportExcel = async () => {
    try {
      const csv = await buildPropertyExcelCsv(os, ar);
      await sharePropertyExcel(csv, os.property?.name || 'spp-database');
    } catch (e: any) {
      Alert.alert(ar ? 'تعذر التصدير' : 'Export failed', String(e?.message || e));
    }
  };

  const vacated = useMemo(() => reg.tenants.filter((t) => t.status !== 'active').slice(0, 40), [reg.tenants]);

  const openEdit = (t: CanonicalTenant) => {
    // Always reset drafts from THIS tenant — prevents previous-tenant field leak.
    setShowNew(false);
    setEdit(t);
    setDraftName(t.name || '');
    setDraftPhone(t.phone || '');
    setDraftRent(String(t.rentAmount ?? ''));
    setDraftContract(t.contractNumber || '');
    setDraftEmail(t.email || '');
    setDraftNationalId(t.nationalId || '');
    setDraftNote(t.notes || '');
    setDraftExtra('');
    setMoreFields(Boolean(t.email || t.nationalId || t.notes));
  };

  const closeEdit = () => {
    setEdit(null);
    setMoreFields(false);
    setDraftName('');
    setDraftPhone('');
    setDraftRent('');
    setDraftContract('');
    setDraftNote('');
    setDraftEmail('');
    setDraftNationalId('');
    setDraftExtra('');
  };

  const openNote = (t: CanonicalTenant) => {
    setNoteTenant(t);
    setDraftNote(t.notes || '');
  };

  const saveEdit = async () => {
    if (!edit) return;
    const rent = Number(String(draftRent).replace(/,/g, ''));
    const extra = draftExtra.trim();
    const notes = [draftNote.trim(), extra ? `+ ${extra}` : ''].filter(Boolean).join('\n');
    await updateCanonicalTenant(edit.id, {
      name: draftName.trim(),
      phone: draftPhone.trim(),
      rentAmount: Number.isFinite(rent) ? rent : edit.rentAmount,
      contractNumber: draftContract.trim(),
      email: draftEmail.trim(),
      nationalId: draftNationalId.trim(),
      notes,
    });
    const name = draftName.trim() || edit.name;
    closeEdit();
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    showToast(ar ? `تم التعديل بنجاح — ${name}` : `Updated successfully — ${name}`);
    void notifyTenantSaved(name, ar, 'edit');
    await refresh();
  };

  const saveNote = async () => {
    if (!noteTenant) return;
    await updateCanonicalTenant(noteTenant.id, { notes: draftNote.trim() });
    const name = noteTenant.name;
    setNoteTenant(null);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    showToast(ar ? `تم حفظ الملاحظة — ${name}` : `Note saved — ${name}`);
    void notifyTenantSaved(name, ar, 'note');
    await refresh();
  };

  const doVacate = (t: CanonicalTenant) => {
    Alert.alert(
      ar ? 'إخلاء مستأجر؟' : 'Vacate tenant?',
      ar ? `سيتم اعتماد إخلاء ${t.name} من وحدة ${t.unitNumber} رسمياً.` : `Officially vacate ${t.name} from unit ${t.unitNumber}.`,
      [
        { text: ar ? 'إلغاء' : 'Cancel', style: 'cancel' },
        {
          text: ar ? 'إخلاء' : 'Vacate',
          style: 'destructive',
          onPress: async () => {
            await vacateCanonicalTenant(t.id, ar ? 'إخلاء رسمي' : 'Official vacate');
            setExpandedId(null);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            await refresh();
          },
        },
      ],
    );
  };

  const doTransfer = (t: CanonicalTenant) => {
    const vacant = os.units.filter((u) => u.status === 'vacant' || u.id === t.unitId);
    if (!vacant.length) {
      Alert.alert(ar ? 'لا وحدات متاحة للنقل' : 'No units available to transfer');
      return;
    }
    const target = vacant.find((u) => u.id !== t.unitId) || vacant[0];
    Alert.alert(
      ar ? 'نقل مستأجر؟' : 'Transfer tenant?',
      ar ? `نقل ${t.name} إلى وحدة ${target.number}` : `Move ${t.name} to unit ${target.number}`,
      [
        { text: ar ? 'إلغاء' : 'Cancel', style: 'cancel' },
        {
          text: ar ? 'نقل' : 'Transfer',
          onPress: async () => {
            await transferCanonicalTenant(t.id, target.id, target.number, ar ? 'نقل رسمي' : 'Official transfer');
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            await refresh();
          },
        },
      ],
    );
  };

  const messageTenant = async (t: CanonicalTenant) => {
    const arrears = (os.paymentLedger || [])
      .filter((l) => l.tenantId === t.osTenantId)
      .reduce((s, l) => s + (Number(l.remaining) || 0), 0);
    const msg = buildWhatsAppCollectionMessage(t, ar, arrears);
    const phone = t.phone.replace(/\D/g, '');
    if (!phone) {
      Alert.alert(ar ? 'لا يوجد جوال معتمد' : 'No official phone');
      return;
    }
    const wa = `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`;
    Linking.openURL(wa).catch(() => Share.share({ message: msg }));
  };

  const sendPortalLink = async (t: CanonicalTenant) => {
    const osId = t.osTenantId;
    if (!osId) {
      Alert.alert(ar ? 'لا يوجد مستأجر مرتبط' : 'No linked tenant record');
      return;
    }
    Haptics.selectionAsync();
    const ensured = await ensureTenantPortalLink(osId, ar ? 'ar' : 'en');
    if (!ensured) {
      Alert.alert(ar ? 'تعذر إنشاء الرابط' : 'Could not create portal link');
      return;
    }
    await reload();
    const phone = (t.phone || ensured.tenant.phone || '').replace(/\D/g, '');
    const msg = ensured.message;
    if (phone) {
      const wa = Platform.select({
        ios: `whatsapp://send?phone=${phone}&text=${encodeURIComponent(msg)}`,
        default: `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`,
      });
      Linking.openURL(wa!).catch(() => Share.share({ message: msg }));
    } else {
      Share.share({ message: msg });
    }
    showToast(ar ? `تم تجهيز رابط ${t.name}` : `Link ready for ${t.name}`);
  };

  const submitNew = async () => {
    const unit = os.units.find((u) => u.id === newUnitId) || os.units.find((u) => u.status === 'vacant') || os.units[0];
    if (!unit || !draftName.trim()) return;
    const rent = Number(String(draftRent).replace(/,/g, '')) || unit.rentAmount || 0;
    const extra = draftExtra.trim();
    const notes = [draftNote.trim(), extra ? `+ ${extra}` : ''].filter(Boolean).join('\n');
    await addNewOfficialTenant({
      name: draftName.trim(),
      phone: draftPhone.trim(),
      unitId: unit.id,
      unitNumber: unit.number,
      rentAmount: rent,
      contractNumber: draftContract.trim(),
      lang: ar ? 'ar' : 'en',
    });
    // Persist optional notes on the newest matching canonical row after add
    if (notes) {
      const s = await loadCanonicalTenants();
      const newest = s.tenants.find((x) => x.name === draftName.trim() && x.unitId === unit.id);
      if (newest) {
        await updateCanonicalTenant(newest.id, {
          notes,
          email: draftEmail.trim(),
          nationalId: draftNationalId.trim(),
        });
      }
    }
    const name = draftName.trim();
    setShowNew(false);
    setMoreFields(false);
    setDraftName('');
    setDraftPhone('');
    setDraftRent('');
    setDraftContract('');
    setDraftNote('');
    setDraftEmail('');
    setDraftNationalId('');
    setDraftExtra('');
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    showToast(ar ? `تمت الإضافة بنجاح — ${name}` : `Added successfully — ${name}`);
    void notifyTenantSaved(name, ar, 'add');
    await refresh();
  };

  const startAdd = () => {
    Haptics.selectionAsync();
    closeEdit();
    setShowNew(true);
    setDraftName('');
    setDraftPhone('');
    setDraftRent('');
    setDraftContract('');
    setDraftNote('');
    setDraftEmail('');
    setDraftNationalId('');
    setDraftExtra('');
    setMoreFields(false);
    setNewUnitId(os.units.find((u) => u.status === 'vacant')?.id || os.units[0]?.id || '');
  };

  const toggleExpand = (t: CanonicalTenant) => {
    Haptics.selectionAsync();
    setExpandedId((cur) => (cur === t.id ? null : t.id));
  };

  return (
    <ScreenScaffold testID={testID}>
      <StoryScreenHeader
        question={variant === 'database'
          ? (ar ? 'مركز البيانات' : 'Database center')
          : (ar ? 'قاعدة المستأجرين الرسمية' : 'Official tenant registry')}
        hint={ar
          ? `${os.property?.name || 'SPP'} — سجل رسمي · جدول إكسل · بحث بالاسم/الوحدة/الجوال`
          : `${os.property?.name || 'SPP'} — official registry · Excel table · search name/unit/phone`}
        showBack
      />

      {os.property ? (
        <GlassCard padding={14} radiusToken="md" edge="gold" style={{ marginBottom: spacing.md }}>
          <Text style={[styles.name, isRTL && styles.rtl]}>{os.property.name}</Text>
          <Text style={[styles.dim, isRTL && styles.rtl]}>
            {ar ? 'وحدات' : 'Units'} {os.units.length}
            {' · '}
            {ar ? 'مستأجرون' : 'Tenants'} {catalog.length}
            {' · '}
            {ar ? 'دفتر أشهر' : 'Ledger'} {(os.paymentLedger || []).length}
          </Text>
          <View style={[styles.actions, isRTL && styles.rowRtl, { marginTop: 10 }]}>
            <Pressable style={styles.exportBtn} onPress={exportExcel} testID="database-export-excel">
              <Feather name="download" size={14} color={colors.bg} />
              <Text style={styles.exportText}>{ar ? 'حفظ إكسل' : 'Save Excel'}</Text>
            </Pressable>
            <Pressable
              style={styles.workbenchBtn}
              onPress={() => router.push('/setup/property-os' as any)}
              testID="database-open-workbench"
            >
              <Feather name="edit-3" size={14} color={colors.gold} />
              <Text style={styles.workbenchText}>{ar ? 'تعديل الجداول' : 'Edit tables'}</Text>
            </Pressable>
            <Pressable onPress={() => router.push('/operational/monthly-summary' as any)}>
              <Text style={styles.summaryLinkText}>{ar ? 'الملخص الشهري ←' : 'Monthly summary →'}</Text>
            </Pressable>
          </View>
        </GlassCard>
      ) : null}

      <View style={[styles.toolbar, isRTL && styles.rowRtl]}>
        <TextInput
          value={query}
          onChangeText={setQuery}
          onSubmitEditing={() => runSearch()}
          returnKeyType="search"
          placeholder={ar ? 'بحث: الاسم · الجوال · الوحدة · العقد' : 'Search: name · phone · unit · contract'}
          placeholderTextColor={colors.textSubtle}
          style={[styles.search, isRTL && styles.rtl]}
          testID="database-search"
        />
        <Pressable style={styles.addBtn} onPress={() => runSearch()} testID="official-search-go">
          <Feather name="search" size={16} color={colors.bg} />
        </Pressable>
        <Pressable style={styles.addBtn} onPress={startAdd} testID="official-add-tenant">
          <Feather name="user-plus" size={16} color={colors.bg} />
        </Pressable>
      </View>

      {searchSuggestions.length > 0 && query.trim().length > 0 ? (
        <GlassCard padding={10} radiusToken="md" style={{ marginBottom: spacing.md }} testID="database-search-hits">
          {searchSuggestions.map((t) => (
            <Pressable
              key={t.id}
              style={[styles.hitRow, isRTL && styles.rowRtl]}
              onPress={() => {
                Haptics.selectionAsync();
                setQuery(t.name);
                setSearchHit(t);
                setExpandedId(t.id);
              }}
            >
              <Feather name="user" size={14} color={colors.gold} />
              <Text style={[styles.hitText, isRTL && styles.rtl]} numberOfLines={1}>
                {t.name} · {t.unitNumber} · {t.phone || '—'}
              </Text>
            </Pressable>
          ))}
        </GlassCard>
      ) : null}

      {catalog.length === 0 && !query.trim() ? (
        <AliveEmpty
          title={ar ? 'لا بيانات بعد' : 'No data yet'}
          body={ar
            ? 'أدخل بيانات العقار يدوياً أو استورد ملفاً لبناء مركز البيانات والسجل الرسمي.'
            : 'Enter property data manually or import a file to build the database and official registry.'}
          actionLabel={ar ? 'إدخال يدوي' : 'Manual entry'}
          onAction={() => router.push('/setup/property-os' as any)}
        />
      ) : active.length === 0 && query.trim() ? (
        <AliveEmpty
          title={ar ? 'لا نتائج للبحث' : 'No search results'}
          body={ar ? `لا مستأجر يطابق «${query.trim()}».` : `No tenant matches “${query.trim()}”.`}
          actionLabel={ar ? 'مسح البحث' : 'Clear search'}
          onAction={() => setQuery('')}
        />
      ) : (
        <GlassCard padding={0} radiusToken="md" edge="gold" style={{ marginBottom: spacing.md }} testID="official-excel-table">
          <ScrollView horizontal showsHorizontalScrollIndicator nestedScrollEnabled>
            <View style={styles.sheet}>
              <View style={[styles.headerRow, isRTL && styles.rowRtl]}>
                <Text style={[styles.th, styles.colName]}>{ar ? 'المستأجر' : 'Tenant'}</Text>
                <Text style={[styles.th, styles.colUnit]}>{ar ? 'وحدة' : 'Unit'}</Text>
                <Text style={[styles.th, styles.colRent]}>{ar ? 'إيجار' : 'Rent'}</Text>
                <Text style={[styles.th, styles.colPhone]}>{ar ? 'جوال' : 'Phone'}</Text>
                <Text style={[styles.th, styles.colContract]}>{ar ? 'عقد' : 'Contract'}</Text>
                <Text style={[styles.th, styles.colStatus]}>{ar ? 'حالة' : 'Status'}</Text>
                <Text style={[styles.th, styles.colPaid]}>{ar ? 'مدفوع' : 'Paid'}</Text>
                <Text style={[styles.th, styles.colLate]}>{ar ? 'متأخر' : 'Late'}</Text>
                <Text style={[styles.th, styles.colArrears]}>{ar ? 'متأخرات' : 'Arrears'}</Text>
                <Text style={[styles.th, styles.colActions]}>{ar ? 'خيارات' : 'Actions'}</Text>
              </View>

              {active.map((t) => {
                const months = monthsForTenant(os, t);
                const open = expandedId === t.id;
                const osTenant = t.osTenantId ? os.tenants.find((x) => x.id === t.osTenantId) : undefined;
                const view = osTenant ? buildTenantOperationalView(osTenant, os, ar) : null;
                return (
                  <View key={t.id} style={styles.rowBlock} testID={`official-row-${t.id}`}>
                    <View style={[styles.dataRow, isRTL && styles.rowRtl, open && styles.dataRowOpen]}>
                      <Pressable style={[styles.colName, styles.nameCell]} onPress={() => toggleExpand(t)}>
                        <Feather
                          name={open ? 'chevron-down' : (isRTL ? 'chevron-left' : 'chevron-right')}
                          size={14}
                          color={colors.gold}
                        />
                        <Text style={[styles.tdStrong, isRTL && styles.rtl]} numberOfLines={2}>{t.name}</Text>
                      </Pressable>
                      <Text style={[styles.td, styles.colUnit]}>{t.unitNumber || '—'}</Text>
                      <Text style={[styles.td, styles.colRent]}>{fmtMoney(t.rentAmount, ar)}</Text>
                      <Text style={[styles.td, styles.colPhone]} numberOfLines={1}>{t.phone || '—'}</Text>
                      <Text style={[styles.td, styles.colContract]} numberOfLines={1}>{t.contractNumber || '—'}</Text>
                      <Text style={[styles.td, styles.colStatus]}>{statusCell(ar, months)}</Text>
                      <Text style={[styles.td, styles.colPaid]}>{view ? String(view.paidMonths) : '—'}</Text>
                      <Text style={[styles.td, styles.colLate]}>{view ? String(view.lateMonths) : '—'}</Text>
                      <Text style={[styles.td, styles.colArrears]}>
                        {view ? fmtMoney(view.arrearsTotal, ar) : '—'}
                      </Text>
                      <View style={[styles.colActions, styles.actionsCell, isRTL && styles.rowRtl]}>
                        <Action icon="edit-2" label={ar ? 'تعديل' : 'Edit'} onPress={() => openEdit(t)} />
                        <Action icon="send" label={ar ? 'رابط' : 'Link'} onPress={() => sendPortalLink(t)} />
                        <Action icon="plus-circle" label={ar ? 'إضافة' : 'Add'} onPress={startAdd} />
                        <Action icon="file-text" label={ar ? 'ملاحظة' : 'Note'} onPress={() => openNote(t)} />
                        <Action icon="message-circle" label={ar ? 'تواصل' : 'Msg'} onPress={() => messageTenant(t)} />
                        <Action icon="log-out" label={ar ? 'إخلاء' : 'Vacate'} onPress={() => doVacate(t)} />
                        <Action icon="shuffle" label={ar ? 'نقل' : 'Move'} onPress={() => doTransfer(t)} />
                      </View>
                    </View>

                    {open ? (
                      <View style={styles.expand} testID={`official-months-${t.id}`}>
                        {/* Detail strip — still inside the sheet */}
                        <View style={[styles.detailStrip, isRTL && styles.rowRtl]}>
                          <Text style={styles.stripCell}>
                            {ar ? 'عقار: ' : 'Property: '}{view?.propertyName || os.property?.name || '—'}
                          </Text>
                          <Text style={styles.stripCell}>
                            {ar ? 'آخر دفعة: ' : 'Last pay: '}
                            {view?.lastPaymentAmount != null && view.lastPaymentLabel
                              ? `${fmtMoney(view.lastPaymentAmount, ar)} · ${view.lastPaymentLabel}`
                              : '—'}
                          </Text>
                          <Text style={styles.stripCell}>
                            {ar ? 'عقد: ' : 'Contract: '}
                            {(view?.contractStart || '—')} → {(view?.contractEnd || '—')}
                          </Text>
                          <Text style={styles.stripCell}>
                            {ar ? 'التزام: ' : 'Compliance: '}{view?.complianceLabel || statusCell(ar, months)}
                          </Text>
                          <Text style={styles.stripCell}>
                            {ar ? 'ملاحظة: ' : 'Note: '}{t.notes?.trim() || '—'}
                          </Text>
                        </View>

                        <Text style={[styles.expandTitle, isRTL && styles.rtl]}>
                          {ar ? 'الأشهر (حتى 8) — مستحق | مدفوع | متبقي | حالة' : 'Months (up to 8) — due | paid | left | status'}
                        </Text>
                        {months.length === 0 ? (
                          <Text style={[styles.dim, isRTL && styles.rtl]}>
                            {ar ? 'لا صفوف شهرية في الدفتر لهذا المستأجر بعد.' : 'No monthly ledger rows for this tenant yet.'}
                          </Text>
                        ) : (
                          <View>
                            <View style={[styles.monthHead, isRTL && styles.rowRtl]}>
                              <Text style={[styles.mh, styles.mMonth]}>{ar ? 'شهر' : 'Month'}</Text>
                              <Text style={[styles.mh, styles.mNum]}>{ar ? 'مستحق' : 'Due'}</Text>
                              <Text style={[styles.mh, styles.mNum]}>{ar ? 'مدفوع' : 'Paid'}</Text>
                              <Text style={[styles.mh, styles.mNum]}>{ar ? 'متبقي' : 'Left'}</Text>
                              <Text style={[styles.mh, styles.mStat]}>{ar ? 'حالة' : 'Status'}</Text>
                            </View>
                            {months.map((m) => (
                              <View key={m.id} style={[styles.monthRow, isRTL && styles.rowRtl]}>
                                <Text style={[styles.md, styles.mMonth]}>{m.monthLabel || m.monthKey}</Text>
                                <Text style={[styles.md, styles.mNum]}>{fmtMoney(m.due, ar)}</Text>
                                <Text style={[styles.md, styles.mNum]}>{fmtMoney(m.paid, ar)}</Text>
                                <Text style={[styles.md, styles.mNum, (Number(m.remaining) || 0) > 0 && styles.hot]}>
                                  {fmtMoney(m.remaining, ar)}
                                </Text>
                                <Text style={[styles.md, styles.mStat]}>{m.statusLabel || m.status || '—'}</Text>
                              </View>
                            ))}
                          </View>
                        )}
                      </View>
                    ) : null}
                  </View>
                );
              })}
            </View>
          </ScrollView>
        </GlassCard>
      )}

      {vacated.length > 0 ? (
        <GlassCard padding={16} radiusToken="md" style={{ marginTop: spacing.md }}>
          <Text style={[styles.section, isRTL && styles.rtl]}>{ar ? 'سجل المغادرين / المنقولين' : 'Vacated / transferred'}</Text>
          {vacated.map((t) => (
            <Text key={t.id} style={[styles.dim, isRTL && styles.rtl, { marginTop: 6 }]}>
              {t.name} · {t.unitNumber} · {t.status}
            </Text>
          ))}
        </GlassCard>
      ) : null}

      <Modal visible={!!searchHit} animationType="slide" onRequestClose={() => setSearchHit(null)}>
        <View style={styles.searchMini} testID="official-search-mini">
          <View style={[styles.searchMiniTop, isRTL && styles.rowRtl]}>
            <Pressable onPress={() => setSearchHit(null)} style={styles.searchMiniBack}>
              <Feather name={isRTL ? 'chevron-right' : 'chevron-left'} size={22} color={colors.gold} />
              <Text style={styles.searchMiniBackText}>{ar ? 'رجوع' : 'Back'}</Text>
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
            <Text style={[styles.name, isRTL && styles.rtl, { fontSize: 22 }]}>{searchHit?.name}</Text>
            <GlassCard padding={14} radiusToken="md" edge="gold" style={{ marginTop: 12 }}>
              <Text style={[styles.dim, isRTL && styles.rtl]}>{ar ? 'وحدة' : 'Unit'}: {searchHit?.unitNumber}</Text>
              <Text style={[styles.dim, isRTL && styles.rtl]}>{ar ? 'جوال' : 'Phone'}: {searchHit?.phone || '—'}</Text>
              <Text style={[styles.dim, isRTL && styles.rtl]}>{ar ? 'إيجار' : 'Rent'}: {fmtMoney(searchHit?.rentAmount || 0, ar)}</Text>
              <Text style={[styles.dim, isRTL && styles.rtl]}>{ar ? 'عقد' : 'Contract'}: {searchHit?.contractNumber || '—'}</Text>
            </GlassCard>
            {searchHit ? (
              <View style={{ marginTop: 12 }}>
                <Text style={[styles.expandTitle, isRTL && styles.rtl]}>
                  {ar ? 'الأشهر' : 'Months'}
                </Text>
                {monthsForTenant(os, searchHit).length === 0 ? (
                  <Text style={[styles.dim, isRTL && styles.rtl]}>{ar ? 'لا أشهر' : 'No months'}</Text>
                ) : monthsForTenant(os, searchHit).map((m) => (
                  <Text key={m.id} style={[styles.dim, isRTL && styles.rtl, { marginTop: 6 }]}>
                    {m.monthLabel || m.monthKey}: {fmtMoney(m.due, ar)} / {fmtMoney(m.paid, ar)} / {fmtMoney(m.remaining, ar)}
                  </Text>
                ))}
              </View>
            ) : null}
            {searchHit ? (
              <View style={[styles.actions, isRTL && styles.rowRtl, { marginTop: 16 }]}>
                <Action icon="edit-2" label={ar ? 'تعديل' : 'Edit'} onPress={() => { setSearchHit(null); openEdit(searchHit); }} />
                <Action icon="send" label={ar ? 'رابط' : 'Link'} onPress={() => sendPortalLink(searchHit)} />
                <Action icon="message-circle" label={ar ? 'تواصل' : 'Msg'} onPress={() => messageTenant(searchHit)} />
              </View>
            ) : null}
          </ScrollView>
        </View>
      </Modal>

      <Modal visible={!!edit} transparent animationType="fade" onRequestClose={closeEdit}>
        <View style={styles.modalWrap}>
          <ScrollView contentContainerStyle={{ justifyContent: 'center', flexGrow: 1 }}>
          <GlassCard key={edit?.id || 'edit-closed'} padding={20} radiusToken="lg" edge="gold">
            <Text style={[styles.name, isRTL && styles.rtl]}>
              {ar ? `تعديل رسمي — ${edit?.name || ''}` : `Official edit — ${edit?.name || ''}`}
            </Text>
            <Field ar={ar} label={ar ? 'الاسم' : 'Name'} value={draftName} onChange={setDraftName} />
            <Field ar={ar} label={ar ? 'الجوال' : 'Phone'} value={draftPhone} onChange={setDraftPhone} />
            <Field ar={ar} label={ar ? 'الإيجار' : 'Rent'} value={draftRent} onChange={setDraftRent} keyboardType="numeric" />
            <Field ar={ar} label={ar ? 'رقم العقد' : 'Contract'} value={draftContract} onChange={setDraftContract} />

            <Pressable
              style={[styles.plusRow, isRTL && styles.rowRtl]}
              onPress={() => { Haptics.selectionAsync(); setMoreFields((v) => !v); }}
              testID="official-edit-plus"
            >
              <Feather name={moreFields ? 'minus-circle' : 'plus-circle'} size={18} color={colors.gold} />
              <Text style={styles.plusText}>
                {moreFields
                  ? (ar ? 'إخفاء حقول إضافية' : 'Hide extra fields')
                  : (ar ? 'إضافة ملاحظات وحقول أخرى' : 'Add notes & more fields')}
              </Text>
            </Pressable>

            {moreFields ? (
              <View>
                <Field ar={ar} label={ar ? 'البريد' : 'Email'} value={draftEmail} onChange={setDraftEmail} />
                <Field ar={ar} label={ar ? 'رقم الهوية' : 'National ID'} value={draftNationalId} onChange={setDraftNationalId} />
                <Field ar={ar} label={ar ? 'ملاحظات' : 'Notes'} value={draftNote} onChange={setDraftNote} />
                <Field ar={ar} label={ar ? 'ملاحظة إضافية (+)' : 'Extra note (+)'} value={draftExtra} onChange={setDraftExtra} />
              </View>
            ) : null}

            <View style={[styles.actions, isRTL && styles.rowRtl]}>
              <Pressable style={styles.primary} onPress={saveEdit}>
                <Text style={styles.primaryText}>{ar ? 'اعتماد' : 'Save official'}</Text>
              </Pressable>
              <Pressable style={styles.secondary} onPress={closeEdit}>
                <Text style={styles.secondaryText}>{ar ? 'إلغاء' : 'Cancel'}</Text>
              </Pressable>
            </View>
          </GlassCard>
          </ScrollView>
        </View>
      </Modal>

      <Modal visible={!!noteTenant} transparent animationType="fade" onRequestClose={() => setNoteTenant(null)}>
        <View style={styles.modalWrap}>
          <GlassCard padding={20} radiusToken="lg" edge="emerald">
            <Text style={[styles.name, isRTL && styles.rtl]}>
              {ar ? `ملاحظة — ${noteTenant?.name || ''}` : `Note — ${noteTenant?.name || ''}`}
            </Text>
            <Field ar={ar} label={ar ? 'الملاحظة' : 'Note'} value={draftNote} onChange={setDraftNote} />
            <View style={[styles.actions, isRTL && styles.rowRtl]}>
              <Pressable style={styles.primary} onPress={saveNote}>
                <Text style={styles.primaryText}>{ar ? 'حفظ' : 'Save'}</Text>
              </Pressable>
              <Pressable style={styles.secondary} onPress={() => setNoteTenant(null)}>
                <Text style={styles.secondaryText}>{ar ? 'إلغاء' : 'Cancel'}</Text>
              </Pressable>
            </View>
          </GlassCard>
        </View>
      </Modal>

      <Modal visible={showNew} transparent animationType="fade" onRequestClose={() => { setShowNew(false); closeEdit(); }}>
        <View style={styles.modalWrap}>
          <ScrollView contentContainerStyle={{ justifyContent: 'center', flexGrow: 1 }}>
          <GlassCard key="new-tenant-form" padding={20} radiusToken="lg" edge="emerald">
            <Text style={[styles.name, isRTL && styles.rtl]}>{ar ? 'مستأجر جديد رسمي' : 'New official tenant'}</Text>
            <Field ar={ar} label={ar ? 'الاسم' : 'Name'} value={draftName} onChange={setDraftName} />
            <Field ar={ar} label={ar ? 'الجوال' : 'Phone'} value={draftPhone} onChange={setDraftPhone} />
            <Field ar={ar} label={ar ? 'الإيجار' : 'Rent'} value={draftRent} onChange={setDraftRent} keyboardType="numeric" />
            <Field ar={ar} label={ar ? 'رقم العقد' : 'Contract'} value={draftContract} onChange={setDraftContract} />
            <Pressable
              style={[styles.plusRow, isRTL && styles.rowRtl]}
              onPress={() => { Haptics.selectionAsync(); setMoreFields((v) => !v); }}
              testID="official-new-plus"
            >
              <Feather name={moreFields ? 'minus-circle' : 'plus-circle'} size={18} color={colors.gold} />
              <Text style={styles.plusText}>
                {moreFields
                  ? (ar ? 'إخفاء حقول إضافية' : 'Hide extra fields')
                  : (ar ? 'إضافة ملاحظات وحقول أخرى' : 'Add notes & more fields')}
              </Text>
            </Pressable>
            {moreFields ? (
              <View>
                <Field ar={ar} label={ar ? 'البريد' : 'Email'} value={draftEmail} onChange={setDraftEmail} />
                <Field ar={ar} label={ar ? 'رقم الهوية' : 'National ID'} value={draftNationalId} onChange={setDraftNationalId} />
                <Field ar={ar} label={ar ? 'ملاحظات' : 'Notes'} value={draftNote} onChange={setDraftNote} />
                <Field ar={ar} label={ar ? 'ملاحظة إضافية (+)' : 'Extra note (+)'} value={draftExtra} onChange={setDraftExtra} />
              </View>
            ) : null}
            <Text style={[styles.dim, isRTL && styles.rtl, { marginTop: 8 }]}>
              {ar ? 'الوحدة:' : 'Unit:'} {os.units.find((u) => u.id === newUnitId)?.number || '—'}
            </Text>
            <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
              {os.units.slice(0, 12).map((u) => (
                <Pressable
                  key={u.id}
                  onPress={() => setNewUnitId(u.id)}
                  style={[styles.chip, newUnitId === u.id && styles.chipOn]}
                >
                  <Text style={styles.chipText}>{u.number}</Text>
                </Pressable>
              ))}
            </View>
            <View style={[styles.actions, isRTL && styles.rowRtl]}>
              <Pressable style={styles.primary} onPress={submitNew}>
                <Text style={styles.primaryText}>{ar ? 'إضافة واعتماد' : 'Add & adopt'}</Text>
              </Pressable>
              <Pressable style={styles.secondary} onPress={() => { setShowNew(false); setMoreFields(false); }}>
                <Text style={styles.secondaryText}>{ar ? 'إلغاء' : 'Cancel'}</Text>
              </Pressable>
            </View>
          </GlassCard>
          </ScrollView>
        </View>
      </Modal>

      {toast ? (
        <View style={styles.toast} pointerEvents="none" testID="database-toast">
          <Feather name="check-circle" size={16} color={colors.bg} />
          <Text style={styles.toastText}>{toast}</Text>
        </View>
      ) : null}
    </ScreenScaffold>
  );
}

export default TenantOfficialRegistry;

function Field({
  ar, label, value, onChange, keyboardType,
}: {
  ar: boolean; label: string; value: string; onChange: (v: string) => void; keyboardType?: 'numeric';
}) {
  return (
    <View style={{ marginTop: 10 }}>
      <Text style={[styles.dim, ar && styles.rtl]}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        keyboardType={keyboardType}
        placeholderTextColor={colors.textSubtle}
        style={[styles.input, ar && styles.rtl]}
      />
    </View>
  );
}

function Action({ icon, label, onPress }: { icon: keyof typeof Feather.glyphMap; label: string; onPress: () => void }) {
  return (
    <Pressable onPress={() => { Haptics.selectionAsync(); onPress(); }} style={styles.action}>
      <Feather name={icon} size={12} color={colors.gold} />
      <Text style={styles.actionText}>{label}</Text>
    </Pressable>
  );
}

const COL_NAME = 150;
const COL_UNIT = 64;
const COL_RENT = 100;
const COL_PHONE = 110;
const COL_CONTRACT = 100;
const COL_STATUS = 72;
const COL_PAID = 56;
const COL_LATE = 56;
const COL_ARREARS = 100;
const COL_ACTIONS = 480;

const SHEET_W =
  COL_NAME + COL_UNIT + COL_RENT + COL_PHONE + COL_CONTRACT + COL_STATUS
  + COL_PAID + COL_LATE + COL_ARREARS + COL_ACTIONS;

const styles = StyleSheet.create({
  toolbar: { flexDirection: 'row', gap: 8, marginBottom: spacing.md, alignItems: 'center' },
  rowRtl: { flexDirection: 'row-reverse' },
  rtl: { writingDirection: 'rtl', textAlign: 'right' },
  search: {
    flex: 1,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: colors.text,
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  addBtn: {
    width: 42, height: 42, borderRadius: 21, backgroundColor: colors.emerald,
    alignItems: 'center', justifyContent: 'center',
  },
  summaryLink: { marginBottom: spacing.md },
  summaryLinkText: { color: colors.gold, fontWeight: typography.weight.semibold, fontSize: 13 },
  exportBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: colors.emerald, paddingHorizontal: 12, paddingVertical: 10, borderRadius: radius.md,
  },
  exportText: { color: colors.bg, fontWeight: typography.weight.semibold, fontSize: 12 },
  workbenchBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderWidth: StyleSheet.hairlineWidth, borderColor: colors.goldEdge,
    backgroundColor: colors.goldSoft, paddingHorizontal: 12, paddingVertical: 10, borderRadius: radius.md,
  },
  workbenchText: { color: colors.gold, fontWeight: typography.weight.semibold, fontSize: 12 },
  hitRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border,
  },
  hitText: { flex: 1, color: colors.text, fontSize: 13 },
  sheet: { minWidth: SHEET_W },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    backgroundColor: 'rgba(212,175,55,0.10)',
  },
  th: {
    color: colors.gold,
    fontSize: 11,
    fontWeight: typography.weight.semibold,
    letterSpacing: 0.2,
    paddingHorizontal: 4,
  },
  rowBlock: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  dataRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 6,
    minHeight: 48,
  },
  dataRowOpen: { backgroundColor: 'rgba(255,255,255,0.04)' },
  colName: { width: COL_NAME, paddingHorizontal: 4 },
  colUnit: { width: COL_UNIT, paddingHorizontal: 4 },
  colRent: { width: COL_RENT, paddingHorizontal: 4 },
  colPhone: { width: COL_PHONE, paddingHorizontal: 4 },
  colContract: { width: COL_CONTRACT, paddingHorizontal: 4 },
  colStatus: { width: COL_STATUS, paddingHorizontal: 4 },
  colPaid: { width: COL_PAID, paddingHorizontal: 4 },
  colLate: { width: COL_LATE, paddingHorizontal: 4 },
  colArrears: { width: COL_ARREARS, paddingHorizontal: 4 },
  colActions: { width: COL_ACTIONS, paddingHorizontal: 4 },
  nameCell: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  td: { color: colors.textDim, fontSize: 12 },
  tdStrong: { color: colors.text, fontSize: 13, fontWeight: typography.weight.semibold, flexShrink: 1 },
  actionsCell: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, alignItems: 'center' },
  expand: {
    paddingHorizontal: 12,
    paddingBottom: 12,
    paddingTop: 6,
    backgroundColor: 'rgba(0,0,0,0.22)',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    width: SHEET_W,
  },
  detailStrip: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 10,
    paddingBottom: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  stripCell: { color: colors.textDim, fontSize: 11, marginRight: 8 },
  expandTitle: {
    color: colors.textMuted,
    fontSize: 11,
    marginBottom: 8,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  monthHead: { flexDirection: 'row', marginBottom: 4 },
  monthRow: {
    flexDirection: 'row',
    paddingVertical: 5,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  mh: { color: colors.textMuted, fontSize: 10, fontWeight: typography.weight.semibold },
  md: { color: colors.textDim, fontSize: 11 },
  mMonth: { width: 120 },
  mNum: { width: 100 },
  mStat: { width: 100 },
  hot: { color: colors.warning },
  name: { color: colors.text, fontSize: 16, fontWeight: typography.weight.semibold },
  dim: { color: colors.textDim, fontSize: 12, marginTop: 4 },
  section: { color: colors.textMuted, fontSize: 11, letterSpacing: 0.8, textTransform: 'uppercase' },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  action: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    paddingHorizontal: 8, paddingVertical: 6, borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border,
  },
  actionText: { color: colors.text, fontSize: 10 },
  modalWrap: { flex: 1, backgroundColor: 'rgba(0,0,0,0.72)', justifyContent: 'center', padding: 20 },
  input: {
    marginTop: 6, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, borderRadius: radius.md,
    paddingHorizontal: 12, paddingVertical: 10, color: colors.text, backgroundColor: 'rgba(255,255,255,0.03)',
  },
  primary: { flex: 1, backgroundColor: colors.emerald, borderRadius: radius.md, paddingVertical: 12, alignItems: 'center' },
  primaryText: { color: colors.bg, fontWeight: typography.weight.semibold },
  secondary: { flex: 1, borderRadius: radius.md, paddingVertical: 12, alignItems: 'center', borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  secondaryText: { color: colors.textDim },
  chip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: radius.pill, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  chipOn: { borderColor: colors.goldEdge, backgroundColor: colors.goldSoft },
  chipText: { color: colors.text, fontSize: 12 },
  searchMini: { flex: 1, backgroundColor: colors.bg },
  searchMiniTop: { flexDirection: 'row', paddingTop: 52, paddingHorizontal: 16, paddingBottom: 8 },
  searchMiniBack: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  searchMiniBackText: { color: colors.gold, fontWeight: typography.weight.semibold, fontSize: 15 },
  plusRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 14, marginBottom: 4,
  },
  plusText: { color: colors.gold, fontSize: 13, fontWeight: typography.weight.semibold },
  toast: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 28,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.emerald,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: radius.md,
    zIndex: 50,
  },
  toastText: { color: colors.bg, flex: 1, fontSize: 13, fontWeight: typography.weight.semibold },
});
