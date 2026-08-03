/**
 * Unified property data workbench — one screen for property + units + tenants/contracts.
 * Replaces the multi-step wizard maze with fixed fields and editable tables.
 * Saves into Property OS + official registry (database center).
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, Pressable, TextInput, ScrollView, Alert,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';

import { ScreenScaffold } from '@/src/components/ScreenScaffold';
import { StoryScreenHeader } from '@/src/components/StoryScreenHeader';
import { GlassCard } from '@/src/components/GlassCard';
import { WizardChipGroup } from '@/src/components/WizardFormFields';
import { usePropertyOS, buildTenantPortal, buildWhatsAppWelcome } from '@/src/hooks/usePropertyOS';
import { useNotificationPrefs } from '@/src/hooks/usePreferences';
import { notifyPropertySaved } from '@/src/utils/local-notifications';
import { peekPendingPropertyName, takePendingPropertyName } from '@/src/utils/pending-property-name';
import type {
  ContractRecord, PropertyOSState, PropertyType, TenantRecord, UnitRecord, UnitStatus, UnitType,
} from '@/src/types/property-os';
import { colors, spacing, typography, radius } from '@/src/theme';
import { useI18n } from '@/src/i18n';

type UnitRow = {
  key: string;
  id?: string;
  number: string;
  type: UnitType;
  rentAmount: string;
  status: UnitStatus;
};

type OccRow = {
  key: string;
  tenantId?: string;
  contractId?: string;
  unitKey: string;
  tenantName: string;
  phone: string;
  contractNumber: string;
  rentAmount: string;
  startDate: string;
  endDate: string;
};

function uid(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function emptyUnit(): UnitRow {
  return {
    key: uid('urow'),
    number: '',
    type: 'apartment',
    rentAmount: '',
    status: 'vacant',
  };
}

function emptyOcc(unitKey = ''): OccRow {
  return {
    key: uid('orow'),
    unitKey,
    tenantName: '',
    phone: '',
    contractNumber: '',
    rentAmount: '',
    startDate: today(),
    endDate: '',
  };
}

export function PropertyDataWorkbench({ testID = 'property-data-workbench' }: { testID?: string }) {
  const { t, isRTL, lang } = useI18n();
  const ar = lang === 'ar' || !!isRTL;
  const router = useRouter();
  const { countEnabled } = useNotificationPrefs();
  const { state, ready, reload, saveWorkbenchState } = usePropertyOS(countEnabled);

  const [propName, setPropName] = useState('');
  const [propType, setPropType] = useState<PropertyType>('residential');
  const [city, setCity] = useState('');
  const [district, setDistrict] = useState('');
  const [buildings, setBuildings] = useState('1');
  const [unitCount, setUnitCount] = useState('1');
  const [units, setUnits] = useState<UnitRow[]>([emptyUnit()]);
  const [occupancy, setOccupancy] = useState<OccRow[]>([]);
  const [toast, setToast] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3200);
  }, []);

  const hydrate = useCallback(async () => {
    await reload();
    const pending = await peekPendingPropertyName();
    const raw = await import('@/src/utils/storage').then((m) => m.storage.getItem<string>('spp.propertyOS', ''));
    let src: PropertyOSState = {
      property: null,
      units: [],
      tenants: [],
      contracts: [],
      alertsEnabled: false,
      technicianPortalToken: '',
      dismissedProgress: false,
      setupCompleted: false,
    };
    if (raw) {
      try { src = { ...src, ...JSON.parse(raw) }; } catch { /* ignore */ }
    }
    setPropName(src.property?.name || pending || '');
    setPropType(src.property?.type || 'residential');
    setCity(src.property?.city === '—' ? '' : (src.property?.city || ''));
    setDistrict(src.property?.district === '—' ? '' : (src.property?.district || ''));
    setBuildings(String(src.property?.buildingCount ?? 1));
    setUnitCount(String(src.property?.unitCount ?? Math.max(1, src.units.length || 1)));

    if (src.units.length) {
      const urows: UnitRow[] = src.units.map((u) => ({
        key: u.id,
        id: u.id,
        number: u.number,
        type: u.type,
        rentAmount: String(u.rentAmount || ''),
        status: u.status,
      }));
      setUnits(urows);
      const orows: OccRow[] = src.tenants.map((ten) => {
        const unit = src.units.find((u) => u.id === ten.unitId);
        const contract = src.contracts.find((c) => c.tenantId === ten.id);
        const ukey = unit?.id || '';
        return {
          key: ten.id,
          tenantId: ten.id,
          contractId: contract?.id,
          unitKey: ukey,
          tenantName: ten.name || '',
          phone: ten.phone || '',
          contractNumber: contract?.number || '',
          rentAmount: String(contract?.rentAmount ?? unit?.rentAmount ?? ''),
          startDate: contract?.startDate || ten.moveInDate || today(),
          endDate: contract?.endDate || '',
        };
      });
      setOccupancy(orows);
    } else {
      setUnits([emptyUnit()]);
      setOccupancy([]);
    }
    setLoaded(true);
  }, [reload]);

  useFocusEffect(
    useCallback(() => {
      void hydrate();
    }, [hydrate]),
  );

  useEffect(() => {
    if (ready && !loaded) void hydrate();
  }, [ready, loaded, hydrate]);

  const unitOptions = useMemo(
    () => units.filter((u) => u.number.trim()).map((u) => ({
      value: u.key,
      label: ar ? `وحدة ${u.number}` : `Unit ${u.number}`,
    })),
    [units, ar],
  );

  const propTypeOptions = useMemo(() => (
    (['residential', 'commercial', 'mixed', 'land', 'other'] as PropertyType[]).map((v) => ({
      value: v,
      label: t(`pos.type.${v}` as 'pos.type.residential'),
    }))
  ), [t]);

  const updateUnit = (key: string, patch: Partial<UnitRow>) => {
    setUnits((rows) => rows.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  };

  const updateOcc = (key: string, patch: Partial<OccRow>) => {
    setOccupancy((rows) => rows.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  };

  const addUnitRow = () => {
    Haptics.selectionAsync();
    setUnits((rows) => [...rows, emptyUnit()]);
    setUnitCount(String(Math.max(Number(unitCount) || 0, units.length + 1)));
  };

  const removeUnitRow = (key: string) => {
    setUnits((rows) => (rows.length <= 1 ? rows : rows.filter((r) => r.key !== key)));
    setOccupancy((rows) => rows.filter((r) => r.unitKey !== key));
  };

  const addOccRow = () => {
    Haptics.selectionAsync();
    const first = units.find((u) => u.number.trim())?.key || units[0]?.key || '';
    setOccupancy((rows) => [...rows, emptyOcc(first)]);
  };

  const removeOccRow = (key: string) => {
    setOccupancy((rows) => rows.filter((r) => r.key !== key));
  };

  const validate = (): string | null => {
    if (!propName.trim()) return ar ? 'أدخل اسم العقار' : 'Enter property name';
    if (!city.trim()) return ar ? 'أدخل المدينة' : 'Enter city';
    const numbered = units.filter((u) => u.number.trim());
    if (!numbered.length) return ar ? 'أضف وحدة واحدة على الأقل' : 'Add at least one unit';
    for (const u of numbered) {
      if (!u.rentAmount.trim() || Number(u.rentAmount) <= 0) {
        return ar ? `أدخل إيجار وحدة ${u.number}` : `Enter rent for unit ${u.number}`;
      }
    }
    for (const o of occupancy) {
      if (!o.tenantName.trim()) return ar ? 'أكمل اسم المستأجر في الجدول' : 'Complete tenant name in the table';
      if (!o.unitKey) return ar ? 'اربط كل مستأجر بوحدة' : 'Link each tenant to a unit';
    }
    return null;
  };

  const onSave = async () => {
    if (saving) return;
    const err = validate();
    if (err) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      Alert.alert(ar ? 'بيانات ناقصة' : 'Missing data', err);
      return;
    }
    setSaving(true);
    try {
      const propId = state.property?.id || uid('prop');
      const unitRecords: UnitRecord[] = units
        .filter((u) => u.number.trim())
        .map((u) => {
          const prev = state.units.find((x) => x.id === u.id);
          const occupied = occupancy.some((o) => o.unitKey === u.key && o.tenantName.trim());
          return {
            id: u.id || uid('unit'),
            propertyId: propId,
            number: u.number.trim(),
            type: u.type,
            status: occupied ? 'occupied' : (u.status || 'vacant'),
            rentAmount: Number(u.rentAmount) || 0,
            rentPeriod: prev?.rentPeriod || 'monthly',
            paymentMethod: prev?.paymentMethod || 'transfer',
            paymentDueDay: prev?.paymentDueDay || 1,
            electricity: prev?.electricity || 'tenant',
            water: prev?.water || 'tenant',
            internet: prev?.internet || 'tenant',
            gas: prev?.gas || 'central',
            maintenanceBy: prev?.maintenanceBy || 'contract',
            hasInsurance: prev?.hasInsurance || false,
            rooms: prev?.rooms,
            livingRooms: prev?.livingRooms,
            bathrooms: prev?.bathrooms,
            kitchen: prev?.kitchen,
            balcony: prev?.balcony,
            parking: prev?.parking,
            elevator: prev?.elevator ?? true,
            furnished: prev?.furnished,
            area: prev?.area,
            floor: prev?.floor,
            notes: prev?.notes,
          };
        });

      const keyToUnitId = new Map(units.map((u, i) => {
        const rec = unitRecords.find((r) => r.number === u.number.trim()) || unitRecords[i];
        return [u.key, rec?.id || ''] as const;
      }));

      const tenantRecords: TenantRecord[] = [];
      const contractRecords: ContractRecord[] = [];

      for (const o of occupancy.filter((x) => x.tenantName.trim())) {
        const unitId = keyToUnitId.get(o.unitKey) || '';
        const prevT = state.tenants.find((t) => t.id === o.tenantId);
        const tenantId = o.tenantId || uid('tenant');
        const token = prevT?.portalToken || uid('tok').slice(-12);
        const portal = prevT?.portalUrl
          ? { token, url: prevT.portalUrl, qrData: prevT.qrData || prevT.portalUrl }
          : buildTenantPortal(tenantId, token, { name: o.tenantName.trim() });
        tenantRecords.push({
          id: tenantId,
          name: o.tenantName.trim(),
          phone: o.phone.trim(),
          email: prevT?.email || '',
          nationalId: prevT?.nationalId,
          unitId,
          moveInDate: o.startDate || today(),
          portalToken: portal.token,
          portalUrl: portal.url,
          qrData: portal.qrData,
          whatsAppMessage: buildWhatsAppWelcome(o.tenantName.trim(), portal.url, ar ? 'ar' : 'en'),
          manualOfficial: true,
          officialRent: Number(o.rentAmount) || undefined,
        });
        if (o.contractNumber.trim() || o.rentAmount.trim()) {
          contractRecords.push({
            id: o.contractId || uid('contract'),
            number: o.contractNumber.trim() || `C-${o.tenantName.trim().slice(0, 8)}`,
            tenantId,
            unitId,
            startDate: o.startDate || today(),
            endDate: o.endDate || '',
            rentAmount: Number(o.rentAmount) || 0,
            paymentType: 'monthly',
            depositAmount: state.contracts.find((c) => c.id === o.contractId)?.depositAmount || 0,
            specialTerms: state.contracts.find((c) => c.id === o.contractId)?.specialTerms,
          });
        }
      }

      const next: PropertyOSState = {
        ...state,
        property: {
          id: propId,
          name: propName.trim(),
          type: propType,
          city: city.trim(),
          district: district.trim() || '—',
          buildingCount: Math.max(1, Number(buildings) || 1),
          unitCount: Math.max(unitRecords.length, Number(unitCount) || 1),
          createdAt: state.property?.createdAt || new Date().toISOString(),
        },
        units: unitRecords,
        tenants: tenantRecords,
        contracts: contractRecords,
        setupCompleted: true,
        alertsEnabled: true,
      };

      await saveWorkbenchState(next, ar ? 'ar' : 'en');
      await takePendingPropertyName();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      const msg = ar
        ? `تم حفظ البيانات في قاعدة البيانات — ${propName.trim()} (${unitRecords.length} وحدة · ${tenantRecords.length} مستأجر)`
        : `Saved to database — ${propName.trim()} (${unitRecords.length} units · ${tenantRecords.length} tenants)`;
      showToast(msg);
      void notifyPropertySaved(propName.trim(), ar);
    } catch (e: any) {
      Alert.alert(ar ? 'تعذر الحفظ' : 'Save failed', String(e?.message || e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScreenScaffold testID={testID}>
      <StoryScreenHeader
        question={ar ? 'إدخال بيانات العقار' : 'Property data entry'}
        hint={ar
          ? 'صفحة واحدة: العقار · الوحدات · المستأجرون والعقود — ثم حفظ في قاعدة البيانات'
          : 'One page: property · units · tenants & contracts — then save to database'}
        showBack
      />

      {toast ? (
        <Animated.View entering={FadeIn.duration(180)} exiting={FadeOut.duration(180)} style={styles.toastWrap} pointerEvents="none">
          <GlassCard padding={16} radiusToken="lg" edge="emerald">
            <Text style={[styles.toastText, ar && styles.rtl]}>{toast}</Text>
          </GlassCard>
        </Animated.View>
      ) : null}

      {/* Fixed property fields */}
      <GlassCard padding={16} radiusToken="md" edge="gold" style={styles.block}>
        <Text style={[styles.section, ar && styles.rtl]}>{ar ? 'بيانات العقار (ثابتة)' : 'Property (fixed fields)'}</Text>
        <Label ar={ar}>{ar ? 'اسم العقار' : 'Property name'}</Label>
        <Cell value={propName} onChange={setPropName} ar={ar} testID="wb-prop-name" />
        <Label ar={ar}>{ar ? 'المدينة' : 'City'}</Label>
        <Cell value={city} onChange={setCity} ar={ar} testID="wb-city" />
        <Label ar={ar}>{ar ? 'الحي' : 'District'}</Label>
        <Cell value={district} onChange={setDistrict} ar={ar} testID="wb-district" />
        <Label ar={ar}>{ar ? 'نوع العقار' : 'Property type'}</Label>
        <WizardChipGroup
          label={ar ? 'نوع العقار' : 'Property type'}
          options={propTypeOptions}
          value={propType}
          onChange={(v) => setPropType(v as PropertyType)}
        />
        <View style={[styles.row2, ar && styles.rowRtl]}>
          <View style={{ flex: 1 }}>
            <Label ar={ar}>{ar ? 'مبانٍ' : 'Buildings'}</Label>
            <Cell value={buildings} onChange={setBuildings} ar={ar} keyboard="numeric" />
          </View>
          <View style={{ flex: 1 }}>
            <Label ar={ar}>{ar ? 'عدد الوحدات' : 'Unit count'}</Label>
            <Cell value={unitCount} onChange={setUnitCount} ar={ar} keyboard="numeric" />
          </View>
        </View>
      </GlassCard>

      {/* Units table */}
      <GlassCard padding={12} radiusToken="md" edge="gold" style={styles.block}>
        <View style={[styles.sectionRow, ar && styles.rowRtl]}>
          <Text style={[styles.section, ar && styles.rtl]}>{ar ? 'جدول الوحدات' : 'Units table'}</Text>
          <Pressable style={styles.miniAdd} onPress={addUnitRow} testID="wb-add-unit">
            <Feather name="plus" size={14} color={colors.bg} />
            <Text style={styles.miniAddText}>{ar ? 'وحدة' : 'Unit'}</Text>
          </Pressable>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator>
          <View>
            <View style={[styles.tr, styles.thRow, ar && styles.rowRtl]}>
              <Text style={[styles.th, styles.colNum]}>{ar ? 'رقم' : '#'}</Text>
              <Text style={[styles.th, styles.colType]}>{ar ? 'نوع' : 'Type'}</Text>
              <Text style={[styles.th, styles.colRent]}>{ar ? 'إيجار' : 'Rent'}</Text>
              <Text style={[styles.th, styles.colStatus]}>{ar ? 'حالة' : 'Status'}</Text>
              <Text style={[styles.th, styles.colAct]} />
            </View>
            {units.map((u) => (
              <View key={u.key} style={[styles.tr, ar && styles.rowRtl]}>
                <TextInput
                  value={u.number}
                  onChangeText={(v) => updateUnit(u.key, { number: v })}
                  style={[styles.td, styles.colNum, ar && styles.rtl]}
                  placeholder="101"
                  placeholderTextColor={colors.textSubtle}
                />
                <Pressable
                  style={[styles.tdChip, styles.colType]}
                  onPress={() => {
                    const cycle: UnitType[] = ['apartment', 'shop', 'office', 'villa', 'room', 'other'];
                    const i = cycle.indexOf(u.type);
                    updateUnit(u.key, { type: cycle[(i + 1) % cycle.length] });
                  }}
                >
                  <Text style={styles.tdChipText}>{t(`pos.unitType.${u.type}` as 'pos.unitType.apartment')}</Text>
                </Pressable>
                <TextInput
                  value={u.rentAmount}
                  onChangeText={(v) => updateUnit(u.key, { rentAmount: v })}
                  style={[styles.td, styles.colRent, ar && styles.rtl]}
                  keyboardType="numeric"
                  placeholder="0"
                  placeholderTextColor={colors.textSubtle}
                />
                <Pressable
                  style={[styles.tdChip, styles.colStatus]}
                  onPress={() => updateUnit(u.key, {
                    status: u.status === 'vacant' ? 'occupied' : u.status === 'occupied' ? 'maintenance' : 'vacant',
                  })}
                >
                  <Text style={styles.tdChipText}>
                    {u.status === 'vacant' ? (ar ? 'شاغرة' : 'Vacant')
                      : u.status === 'occupied' ? (ar ? 'مشغولة' : 'Occupied')
                        : (ar ? 'صيانة' : 'Maint.')}
                  </Text>
                </Pressable>
                <Pressable style={styles.colAct} onPress={() => removeUnitRow(u.key)}>
                  <Feather name="trash-2" size={14} color={colors.danger} />
                </Pressable>
              </View>
            ))}
          </View>
        </ScrollView>
      </GlassCard>

      {/* Tenants + contracts table */}
      <GlassCard padding={12} radiusToken="md" edge="emerald" style={styles.block}>
        <View style={[styles.sectionRow, ar && styles.rowRtl]}>
          <Text style={[styles.section, ar && styles.rtl]}>
            {ar ? 'جدول المستأجرين والعقود' : 'Tenants & contracts table'}
          </Text>
          <Pressable style={styles.miniAdd} onPress={addOccRow} testID="wb-add-tenant">
            <Feather name="user-plus" size={14} color={colors.bg} />
            <Text style={styles.miniAddText}>{ar ? 'مستأجر' : 'Tenant'}</Text>
          </Pressable>
        </View>
        <Text style={[styles.hint, ar && styles.rtl]}>
          {ar
            ? 'كل صف = مستأجر + عقد مربوط بوحدة. التعديل هنا يظهر مباشرة بعد الحفظ في مركز البيانات.'
            : 'Each row = tenant + contract linked to a unit. Edits appear in Database center after save.'}
        </Text>
        <ScrollView horizontal showsHorizontalScrollIndicator>
          <View>
            <View style={[styles.tr, styles.thRow, ar && styles.rowRtl]}>
              <Text style={[styles.th, styles.colUnitPick]}>{ar ? 'وحدة' : 'Unit'}</Text>
              <Text style={[styles.th, styles.colName]}>{ar ? 'المستأجر' : 'Tenant'}</Text>
              <Text style={[styles.th, styles.colPhone]}>{ar ? 'جوال' : 'Phone'}</Text>
              <Text style={[styles.th, styles.colContract]}>{ar ? 'رقم العقد' : 'Contract #'}</Text>
              <Text style={[styles.th, styles.colRent]}>{ar ? 'إيجار' : 'Rent'}</Text>
              <Text style={[styles.th, styles.colDate]}>{ar ? 'بداية' : 'Start'}</Text>
              <Text style={[styles.th, styles.colDate]}>{ar ? 'نهاية' : 'End'}</Text>
              <Text style={[styles.th, styles.colAct]} />
            </View>
            {occupancy.length === 0 ? (
              <Text style={[styles.emptyRow, ar && styles.rtl]}>
                {ar ? 'لا صفوف بعد — اضغط «مستأجر» للإضافة' : 'No rows yet — tap Tenant to add'}
              </Text>
            ) : occupancy.map((o) => {
              const unitLabel = units.find((u) => u.key === o.unitKey)?.number || '—';
              return (
                <View key={o.key} style={[styles.tr, ar && styles.rowRtl]}>
                  <Pressable
                    style={[styles.tdChip, styles.colUnitPick]}
                    onPress={() => {
                      if (!unitOptions.length) return;
                      const idx = unitOptions.findIndex((x) => x.value === o.unitKey);
                      const next = unitOptions[(idx + 1) % unitOptions.length];
                      const unit = units.find((u) => u.key === next.value);
                      updateOcc(o.key, {
                        unitKey: next.value,
                        rentAmount: o.rentAmount || unit?.rentAmount || '',
                      });
                    }}
                  >
                    <Text style={styles.tdChipText}>{unitLabel}</Text>
                  </Pressable>
                  <TextInput
                    value={o.tenantName}
                    onChangeText={(v) => updateOcc(o.key, { tenantName: v })}
                    style={[styles.td, styles.colName, ar && styles.rtl]}
                    placeholder={ar ? 'الاسم' : 'Name'}
                    placeholderTextColor={colors.textSubtle}
                  />
                  <TextInput
                    value={o.phone}
                    onChangeText={(v) => updateOcc(o.key, { phone: v })}
                    style={[styles.td, styles.colPhone, ar && styles.rtl]}
                    keyboardType="phone-pad"
                    placeholder="05…"
                    placeholderTextColor={colors.textSubtle}
                  />
                  <TextInput
                    value={o.contractNumber}
                    onChangeText={(v) => updateOcc(o.key, { contractNumber: v })}
                    style={[styles.td, styles.colContract, ar && styles.rtl]}
                    placeholder={ar ? 'رقم العقد' : 'Contract'}
                    placeholderTextColor={colors.textSubtle}
                  />
                  <TextInput
                    value={o.rentAmount}
                    onChangeText={(v) => updateOcc(o.key, { rentAmount: v })}
                    style={[styles.td, styles.colRent, ar && styles.rtl]}
                    keyboardType="numeric"
                    placeholder="0"
                    placeholderTextColor={colors.textSubtle}
                  />
                  <TextInput
                    value={o.startDate}
                    onChangeText={(v) => updateOcc(o.key, { startDate: v })}
                    style={[styles.td, styles.colDate, ar && styles.rtl]}
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor={colors.textSubtle}
                  />
                  <TextInput
                    value={o.endDate}
                    onChangeText={(v) => updateOcc(o.key, { endDate: v })}
                    style={[styles.td, styles.colDate, ar && styles.rtl]}
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor={colors.textSubtle}
                  />
                  <Pressable style={styles.colAct} onPress={() => removeOccRow(o.key)}>
                    <Feather name="trash-2" size={14} color={colors.danger} />
                  </Pressable>
                </View>
              );
            })}
          </View>
        </ScrollView>
      </GlassCard>

      <View style={[styles.footer, ar && styles.rowRtl]}>
        <Pressable
          style={[styles.saveBtn, saving && styles.saveDisabled]}
          disabled={saving}
          onPress={onSave}
          testID="wb-save"
        >
          <Feather name="save" size={16} color={colors.bg} />
          <Text style={styles.saveText}>
            {saving
              ? (ar ? 'جارٍ الحفظ…' : 'Saving…')
              : (ar ? 'حفظ في قاعدة البيانات' : 'Save to database')}
          </Text>
        </Pressable>
        <Pressable
          style={styles.dbBtn}
          onPress={() => router.push('/database' as any)}
          testID="wb-open-db"
        >
          <Feather name="database" size={15} color={colors.gold} />
          <Text style={styles.dbText}>{ar ? 'فتح مركز البيانات' : 'Open database'}</Text>
        </Pressable>
      </View>

      <Pressable style={{ marginBottom: spacing.xl }} onPress={() => router.push('/upload' as any)}>
        <Text style={[styles.importLink, ar && styles.rtl]}>
          {ar ? 'أو استورد ملفاً ليظهر كجدول قابل للتعديل ←' : 'Or import a file to populate the editable table →'}
        </Text>
      </Pressable>
    </ScreenScaffold>
  );
}

function Label({ children, ar }: { children: string; ar: boolean }) {
  return <Text style={[styles.label, ar && styles.rtl]}>{children}</Text>;
}

function Cell({
  value, onChange, ar, keyboard, testID,
}: {
  value: string;
  onChange: (v: string) => void;
  ar: boolean;
  keyboard?: 'default' | 'numeric' | 'phone-pad';
  testID?: string;
}) {
  return (
    <TextInput
      value={value}
      onChangeText={onChange}
      keyboardType={keyboard || 'default'}
      style={[styles.input, ar && styles.rtl]}
      placeholderTextColor={colors.textSubtle}
      testID={testID}
    />
  );
}

const styles = StyleSheet.create({
  block: { marginBottom: spacing.md },
  section: {
    color: colors.gold,
    fontSize: 13,
    fontWeight: typography.weight.semibold,
    letterSpacing: 0.4,
    marginBottom: 10,
    textTransform: 'uppercase',
  },
  sectionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  rowRtl: { flexDirection: 'row-reverse' },
  rtl: { writingDirection: 'rtl', textAlign: 'right' },
  label: { color: colors.textMuted, fontSize: 12, marginBottom: 6, marginTop: 8 },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: colors.text,
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  row2: { flexDirection: 'row', gap: 10, marginTop: 4 },
  hint: { color: colors.textDim, fontSize: 12, lineHeight: 18, marginBottom: 10 },
  miniAdd: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.gold,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.md,
  },
  miniAddText: { color: colors.bg, fontSize: 12, fontWeight: typography.weight.semibold },
  tr: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  thRow: { backgroundColor: 'rgba(255,255,255,0.04)' },
  th: { color: colors.textMuted, fontSize: 11, fontWeight: typography.weight.semibold, paddingVertical: 8, paddingHorizontal: 6 },
  td: {
    color: colors.text,
    fontSize: 13,
    paddingVertical: 8,
    paddingHorizontal: 6,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: colors.border,
  },
  tdChip: {
    paddingVertical: 8,
    paddingHorizontal: 6,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: colors.border,
    justifyContent: 'center',
  },
  tdChipText: { color: colors.gold, fontSize: 12 },
  colNum: { width: 72 },
  colType: { width: 100 },
  colRent: { width: 88 },
  colStatus: { width: 88 },
  colUnitPick: { width: 72 },
  colName: { width: 140 },
  colPhone: { width: 120 },
  colContract: { width: 110 },
  colDate: { width: 110 },
  colAct: { width: 36, alignItems: 'center', justifyContent: 'center' },
  emptyRow: { color: colors.textDim, padding: 14, fontSize: 13 },
  footer: { gap: 10, marginBottom: spacing.md },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.emerald,
    paddingVertical: 14,
    borderRadius: radius.lg,
  },
  saveDisabled: { opacity: 0.6 },
  saveText: { color: colors.bg, fontSize: 15, fontWeight: typography.weight.semibold },
  dbBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.goldEdge,
    backgroundColor: colors.goldSoft,
    paddingVertical: 12,
    borderRadius: radius.lg,
  },
  dbText: { color: colors.gold, fontSize: 14, fontWeight: typography.weight.semibold },
  importLink: { color: colors.textMuted, fontSize: 13, textAlign: 'center' },
  toastWrap: {
    position: 'absolute',
    top: 72,
    left: spacing.lg,
    right: spacing.lg,
    zIndex: 50,
  },
  toastText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: typography.weight.semibold,
    textAlign: 'center',
  },
});
