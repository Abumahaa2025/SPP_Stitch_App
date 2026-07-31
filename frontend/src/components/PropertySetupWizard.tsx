import React, { useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, Pressable, Linking, Platform,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useRouter, useLocalSearchParams } from 'expo-router';

import { ScreenScaffold } from '@/src/components/ScreenScaffold';
import { StoryScreenHeader } from '@/src/components/StoryScreenHeader';
import { GlassCard } from '@/src/components/GlassCard';
import { SetupProgressBar } from '@/src/components/SetupProgressBar';
import { WizardSuccessToast } from '@/src/components/WizardSuccessToast';
import { JourneyWelcome } from '@/src/components/journey/JourneyWelcome';
import { JourneyPhaseCard } from '@/src/components/journey/JourneyPhaseCard';
import { JourneyLaunchComplete } from '@/src/components/journey/JourneyLaunchComplete';
import { JourneyValueTip } from '@/src/components/journey/JourneyValueTip';
import { PhaseSaveResult } from '@/src/components/PhaseSaveResult';
import { PortalShareCard } from '@/src/components/PortalShareCard';
import { PhaseJourneyGuide } from '@/src/components/journey/PhaseJourneyGuide';
import { WizardPrerequisite } from '@/src/components/journey/WizardPrerequisite';
import {
  ALERTS_SUCCESS, PHASE_EMOJI, PHASE_INTRO, PHASE_SUCCESS, visiblePhases,
} from '@/src/components/journey/journey-phases';
import {
  WizardChipGroup, WizardInfoBox, WizardTextField, WizardToggle, WizardPhaseIntro,
} from '@/src/components/WizardFormFields';
import { colors, spacing, typography, radius } from '@/src/theme';
import { useI18n } from '@/src/i18n';
import { usePropertyOS } from '@/src/hooks/usePropertyOS';
import { useNotificationPrefs } from '@/src/hooks/usePreferences';
import type {
  ContractRecord, GasType, MaintenanceResponsibility, PaymentMethod, PropertyType,
  RentPeriod, ServiceResponsibility, SetupPhaseId, UnitRecord, UnitStatus, UnitType,
} from '@/src/types/property-os';

const PHASES: SetupPhaseId[] = [
  'property', 'units', 'tenants', 'contracts', 'alerts', 'smartEmployee',
];

const emptyUnitDraft = () => ({
  number: '',
  type: 'apartment' as UnitType,
  rooms: '2',
  livingRooms: '1',
  bathrooms: '1',
  area: '',
  floor: '',
  kitchen: true,
  balcony: false,
  parking: false,
  elevator: true,
  furnished: false,
  status: 'vacant' as UnitStatus,
  rentAmount: '',
  rentPeriod: 'monthly' as RentPeriod,
  paymentMethod: 'transfer' as PaymentMethod,
  paymentDueDay: '1',
  electricity: 'tenant' as ServiceResponsibility,
  electricityMeter: '',
  water: 'tenant' as ServiceResponsibility,
  waterMeter: '',
  internet: 'tenant' as 'tenant' | 'included',
  gas: 'central' as GasType,
  maintenanceBy: 'contract' as MaintenanceResponsibility,
  hasInsurance: false,
  insuranceAmount: '',
  notes: '',
});

type FieldErrors = Record<string, string>;
type PhaseView = 'intro' | 'form' | 'success';

export function PropertySetupWizard() {
  const { t, isRTL, lang } = useI18n();
  const router = useRouter();
  const params = useLocalSearchParams<{ phase?: string }>();
  const { countEnabled, update: updateNotif } = useNotificationPrefs();
  const {
    state, phases, saveProperty, addUnit, addTenant, addContract,
    enableAlerts, ensureTechnicianPortal, nextPhase, markSetupComplete,
    overallPercent,
  } = usePropertyOS(countEnabled);

  const skipWelcome = Boolean(params.phase) || Boolean(state.property);
  const [showWelcome, setShowWelcome] = useState(!skipWelcome);
  const initialPhase = (params.phase as SetupPhaseId) || nextPhase || 'property';
  const [phase, setPhase] = useState<SetupPhaseId>(
    PHASES.includes(initialPhase) ? initialPhase : 'property',
  );
  const [lastTenant, setLastTenant] = useState<typeof state.tenants[0] | null>(null);
  const [lastSavedUnit, setLastSavedUnit] = useState<UnitRecord | null>(null);
  const [lastContract, setLastContract] = useState<ContractRecord | null>(null);
  const [phaseView, setPhaseView] = useState<PhaseView>(skipWelcome ? 'intro' : 'intro');
  const [successPhase, setSuccessPhase] = useState<SetupPhaseId | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);
  const [advancing, setAdvancing] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  const reqErr = t('pos.field.requiredError');
  const clearErr = (key: string) => {
    setFieldErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  // Property draft
  const [propName, setPropName] = useState(state.property?.name ?? '');
  const [propType, setPropType] = useState<PropertyType>(state.property?.type ?? 'residential');
  const [city, setCity] = useState(state.property?.city ?? '');
  const [district, setDistrict] = useState(state.property?.district ?? '');
  const [buildings, setBuildings] = useState(String(state.property?.buildingCount ?? 1));
  const [unitCount, setUnitCount] = useState(String(state.property?.unitCount ?? 1));

  const [unitDraft, setUnitDraft] = useState(emptyUnitDraft);

  const [tenantName, setTenantName] = useState('');
  const [tenantPhone, setTenantPhone] = useState('');
  const [tenantEmail, setTenantEmail] = useState('');
  const [tenantId, setTenantId] = useState('');
  const [tenantUnitId, setTenantUnitId] = useState(state.units[0]?.id ?? '');
  const [moveIn, setMoveIn] = useState(new Date().toISOString().slice(0, 10));

  const [contractNum, setContractNum] = useState('');
  const [contractStart, setContractStart] = useState(new Date().toISOString().slice(0, 10));
  const [contractEnd, setContractEnd] = useState('');
  const [contractRent, setContractRent] = useState('');
  const [contractDeposit, setContractDeposit] = useState('');
  const [contractTerms, setContractTerms] = useState('');
  const [contractTenantId, setContractTenantId] = useState(state.tenants[0]?.id ?? '');

  const phaseIndex = PHASES.indexOf(phase);
  const currentPhaseMeta = phases.find((p) => p.id === phase);

  const unitTypeOptions = useMemo(() => ([
    'apartment', 'shop', 'office', 'warehouse', 'villa', 'room', 'other',
  ] as UnitType[]).map((v) => ({
    value: v,
    label: t(`pos.unitType.${v}` as 'pos.unitType.apartment'),
  })), [t]);

  const goPhase = (p: SetupPhaseId) => {
    Haptics.selectionAsync();
    setFieldErrors({});
    setSuccessPhase(null);
    setPhase(p);
    setPhaseView(p === 'smartEmployee' ? 'form' : 'intro');
  };

  const finishPhase = (completed: SetupPhaseId) => {
    setSuccessPhase(completed);
    setPhaseView('success');
    setAdvancing(false);
  };

  const onSuccessContinue = () => {
    const cfg = successPhase && successPhase in PHASE_SUCCESS
      ? PHASE_SUCCESS[successPhase as keyof typeof PHASE_SUCCESS]
      : successPhase === 'alerts' ? ALERTS_SUCCESS : null;
    setSuccessPhase(null);
    if (cfg) {
      goPhase(cfg.nextPhase);
    } else if (phase === 'smartEmployee') {
      setPhaseView('form');
    }
  };

  const validateProperty = () => {
    const errs: FieldErrors = {};
    if (!propName.trim()) errs.propName = reqErr;
    if (!city.trim()) errs.city = reqErr;
    if (!unitCount.trim() || Number(unitCount) <= 0) errs.unitCount = reqErr;
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const validateUnit = () => {
    const errs: FieldErrors = {};
    if (!unitDraft.number.trim()) errs.unitNumber = reqErr;
    if (!unitDraft.rentAmount.trim() || Number(unitDraft.rentAmount) <= 0) errs.rentAmount = reqErr;
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const validateTenant = () => {
    const errs: FieldErrors = {};
    if (!tenantName.trim()) errs.tenantName = reqErr;
    if (!tenantPhone.trim()) errs.tenantPhone = reqErr;
    if (!tenantUnitId) errs.tenantUnitId = reqErr;
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const validateContract = () => {
    const errs: FieldErrors = {};
    if (!contractNum.trim()) errs.contractNum = reqErr;
    if (!contractStart.trim()) errs.contractStart = reqErr;
    if (!contractEnd.trim()) errs.contractEnd = reqErr;
    if (!contractTenantId) errs.contractTenantId = reqErr;
    if (!contractRent.trim() || Number(contractRent) <= 0) errs.contractRent = reqErr;
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const onContinue = () => {
    if (advancing) return;
    Haptics.selectionAsync();

    if (phase === 'property') {
      if (!validateProperty()) return;
      saveProperty({
        name: propName.trim(),
        type: propType,
        city: city.trim(),
        district: district.trim(),
        buildingCount: Math.max(0, Number(buildings) || 0),
        unitCount: Math.max(1, Number(unitCount) || 1),
      });
      finishPhase('property');
      return;
    }

    if (phase === 'units') {
      if (!validateUnit()) return;
      const unit = addUnit({
        number: unitDraft.number.trim(),
        type: unitDraft.type,
        rooms: unitDraft.type === 'apartment' ? Number(unitDraft.rooms) || undefined : undefined,
        livingRooms: unitDraft.type === 'apartment' ? Number(unitDraft.livingRooms) || undefined : undefined,
        bathrooms: unitDraft.type === 'apartment' ? Number(unitDraft.bathrooms) || undefined : undefined,
        kitchen: unitDraft.type === 'apartment' ? unitDraft.kitchen : undefined,
        balcony: unitDraft.type === 'apartment' ? unitDraft.balcony : undefined,
        area: unitDraft.area ? Number(unitDraft.area) : undefined,
        floor: unitDraft.floor ? Number(unitDraft.floor) : undefined,
        parking: unitDraft.parking,
        elevator: unitDraft.elevator,
        furnished: unitDraft.furnished,
        status: unitDraft.status,
        rentAmount: Number(unitDraft.rentAmount),
        rentPeriod: unitDraft.rentPeriod,
        paymentMethod: unitDraft.paymentMethod,
        paymentDueDay: Math.min(28, Math.max(1, Number(unitDraft.paymentDueDay) || 1)),
        electricity: unitDraft.electricity,
        electricityMeter: unitDraft.electricityMeter || undefined,
        water: unitDraft.water,
        waterMeter: unitDraft.waterMeter || undefined,
        internet: unitDraft.internet,
        gas: unitDraft.gas,
        maintenanceBy: unitDraft.maintenanceBy,
        hasInsurance: unitDraft.hasInsurance,
        insuranceAmount: unitDraft.hasInsurance ? Number(unitDraft.insuranceAmount) || undefined : undefined,
        notes: unitDraft.notes || undefined,
      });
      setLastSavedUnit(unit);
      finishPhase('units');
      return;
    }

    if (phase === 'tenants') {
      if (!validateTenant()) return;
      const tenant = addTenant({
        name: tenantName.trim(),
        phone: tenantPhone.trim(),
        email: tenantEmail.trim(),
        nationalId: tenantId.trim() || undefined,
        unitId: tenantUnitId,
        moveInDate: moveIn,
      }, lang);
      setLastTenant(tenant);
      setContractTenantId(tenant?.id ?? '');
      const unit = state.units.find((u) => u.id === tenantUnitId);
      if (unit) setContractRent(String(unit.rentAmount));
      finishPhase('tenants');
      return;
    }

    if (phase === 'contracts') {
      if (!validateContract()) return;
      const tenant = state.tenants.find((x) => x.id === contractTenantId) ?? lastTenant;
      const contract = addContract({
        number: contractNum.trim(),
        tenantId: contractTenantId,
        unitId: tenant?.unitId ?? tenantUnitId,
        startDate: contractStart,
        endDate: contractEnd,
        rentAmount: Number(contractRent),
        paymentType: 'monthly',
        depositAmount: Number(contractDeposit) || 0,
        specialTerms: contractTerms.trim() || undefined,
      });
      setLastContract(contract);
      finishPhase('contracts');
      return;
    }

    if (phase === 'alerts') {
      enableAlerts();
      updateNotif('priorities', true);
      updateNotif('contractRenewals', true);
      updateNotif('maintenance', true);
      markSetupComplete();
      finishPhase('alerts');
      return;
    }

    router.replace('/');
  };

  const shareWhatsApp = () => {
    const tenant = lastTenant ?? state.tenants[state.tenants.length - 1];
    if (!tenant) return;
    const url = Platform.select({
      ios: `whatsapp://send?phone=${tenant.phone.replace(/\D/g, '')}&text=${encodeURIComponent(tenant.whatsAppMessage)}`,
      default: `https://wa.me/${tenant.phone.replace(/\D/g, '')}?text=${encodeURIComponent(tenant.whatsAppMessage)}`,
    });
    Linking.openURL(url!).catch(() => {});
  };

  const goHome = () => router.replace('/');
  const viewOwner = () => router.push('/owner' as any);

  const techLink = ensureTechnicianPortal();
  const tenantPortal = lastTenant ?? state.tenants[state.tenants.length - 1];
  const blockedForm = (phase === 'tenants' && state.units.length === 0)
    || (phase === 'contracts' && state.tenants.length === 0);
  const showFormActions = phase !== 'smartEmployee' && phaseView === 'form' && !blockedForm;

  if (showWelcome) {
    return (
      <ScreenScaffold testID="property-os-welcome">
        <JourneyWelcome
          onStart={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            setShowWelcome(false);
            setPhaseView('intro');
          }}
        />
      </ScreenScaffold>
    );
  }

  const addAnotherUnit = () => {
    setSuccessPhase(null);
    setPhaseView('form');
    setUnitDraft(emptyUnitDraft());
    setFieldErrors({});
    setPhase('units');
  };

  const addAnotherTenant = () => {
    setSuccessPhase(null);
    setPhaseView('form');
    setTenantName('');
    setTenantPhone('');
    setTenantEmail('');
    setTenantId('');
    setFieldErrors({});
    setPhase('tenants');
  };

  if (successPhase && phaseView === 'success') {
    const cfg = successPhase === 'alerts'
      ? ALERTS_SUCCESS
      : (successPhase in PHASE_SUCCESS
        ? PHASE_SUCCESS[successPhase as keyof typeof PHASE_SUCCESS]
        : null);
    if (cfg) {
      const nextHint = t(cfg.nextKey as any);

      if (successPhase === 'tenants' && lastTenant) {
        const unit = state.units.find((u) => u.id === lastTenant.unitId);
        const contract = state.contracts.find((c) => c.tenantId === lastTenant.id);
        return (
          <ScreenScaffold testID="property-os-success-tenant">
            <PhaseSaveResult
              rows={[
                { label: t('pos.tenant.name'), value: lastTenant.name },
                { label: t('pos.tenant.unit'), value: unit?.number ?? '—' },
                { label: t('pos.contract.number'), value: contract?.number ?? t('result.noContractYet' as any) },
                { label: t('pos.portal.link'), value: lastTenant.portalUrl },
                { label: t('pos.units.status'), value: t('result.status.active' as any) },
              ]}
              nextHint={nextHint}
              actions={[
                { label: t('result.sendLink' as any), onPress: shareWhatsApp, primary: true },
                { label: t('result.addContract' as any), onPress: onSuccessContinue },
                { label: t('result.addAnother' as any), onPress: addAnotherTenant },
                { label: t('result.viewManage' as any), onPress: () => router.push('/tenants' as any) },
                { label: t('result.goHome' as any), onPress: goHome },
              ]}
            >
              <PortalShareCard tenant={lastTenant} unitNumber={unit?.number} />
            </PhaseSaveResult>
          </ScreenScaffold>
        );
      }

      if (successPhase === 'units' && lastSavedUnit) {
        return (
          <ScreenScaffold testID="property-os-success-unit">
            <PhaseSaveResult
              rows={[
                { label: t('pos.units.number'), value: lastSavedUnit.number },
                { label: t('pos.rent.amount'), value: String(lastSavedUnit.rentAmount) },
                { label: t('pos.units.status'), value: t(`pos.status.${lastSavedUnit.status}` as 'pos.status.occupied') },
              ]}
              nextHint={nextHint}
              actions={[
                { label: t('result.continue' as any), onPress: onSuccessContinue, primary: true },
                { label: t('result.addAnother' as any), onPress: addAnotherUnit },
                { label: t('result.viewManage' as any), onPress: viewOwner },
                { label: t('result.goHome' as any), onPress: goHome },
              ]}
            />
          </ScreenScaffold>
        );
      }

      if (successPhase === 'property') {
        return (
          <ScreenScaffold testID="property-os-success-property">
            <PhaseSaveResult
              rows={[
                { label: t('pos.property.name'), value: propName.trim() },
                { label: t('pos.property.city'), value: city.trim() },
                { label: t('pos.property.unitCount'), value: unitCount },
              ]}
              nextHint={nextHint}
              actions={[
                { label: t('result.continue' as any), onPress: onSuccessContinue, primary: true },
                { label: t('result.viewManage' as any), onPress: viewOwner },
                { label: t('result.goHome' as any), onPress: goHome },
              ]}
            />
            <View style={{ marginTop: spacing.md }}>
              <JourneyValueTip />
            </View>
          </ScreenScaffold>
        );
      }

      if (successPhase === 'alerts') {
        return (
          <ScreenScaffold testID="property-os-success-alerts">
            <PhaseSaveResult
              rows={[
                { label: t('pos.phase.alerts' as 'pos.phase.property'), value: t('result.status.active' as any) },
                { label: t('pos.property.name'), value: state.property?.name ?? propName.trim() },
                { label: t('pos.progress.title'), value: `${overallPercent}%` },
              ]}
              nextHint={nextHint}
              actions={[
                { label: t('result.continue' as any), onPress: onSuccessContinue, primary: true },
                { label: t('result.viewManage' as any), onPress: viewOwner },
                { label: t('result.goHome' as any), onPress: goHome },
              ]}
            />
          </ScreenScaffold>
        );
      }

      if (successPhase === 'contracts' && lastContract) {
        const tenant = state.tenants.find((x) => x.id === lastContract.tenantId) ?? lastTenant;
        const unit = state.units.find((u) => u.id === lastContract.unitId);
        return (
          <ScreenScaffold testID="property-os-success-contract">
            <PhaseSaveResult
              rows={[
                { label: t('pos.contract.number'), value: lastContract.number },
                { label: t('pos.tenant.name'), value: tenant?.name ?? '—' },
                { label: t('pos.tenant.unit'), value: unit?.number ?? '—' },
                { label: t('pos.contract.rent'), value: String(lastContract.rentAmount) },
              ]}
              nextHint={nextHint}
              actions={[
                { label: t('result.continue' as any), onPress: onSuccessContinue, primary: true },
                { label: t('result.viewManage' as any), onPress: () => router.push('/contracts' as any) },
                { label: t('result.goHome' as any), onPress: goHome },
              ]}
            />
          </ScreenScaffold>
        );
      }

      return (
        <ScreenScaffold testID="property-os-success">
          <PhaseSaveResult
            rows={cfg.checklistKeys.map((k) => ({ label: '✓', value: t(k as any) }))}
            nextHint={nextHint}
            actions={[
              { label: t('result.continue' as any), onPress: onSuccessContinue, primary: true },
              { label: t('result.goHome' as any), onPress: goHome },
            ]}
          />
          <View style={{ marginTop: spacing.md }}>
            <JourneyValueTip />
          </View>
        </ScreenScaffold>
      );
    }
  }

  if (phaseView === 'intro' && phase !== 'smartEmployee') {
    const intro = PHASE_INTRO[phase];
    return (
      <ScreenScaffold testID="property-os-phase-intro">
        <StoryScreenHeader
          question={t('pos.wizard.title')}
          hint={t(`pos.phase.${phase}` as 'pos.phase.property')}
          showBack
        />
        <JourneyPhaseCard
          emoji={PHASE_EMOJI[phase]}
          titleKey={intro.titleKey}
          bodyKey={intro.bodyKey}
          whereLabel={`${t('journey.where')} · ${t(`pos.phase.${phase}` as 'pos.phase.property')}`}
          onStart={() => setPhaseView('form')}
        />
      </ScreenScaffold>
    );
  }

  if (phase === 'smartEmployee' && phaseView === 'intro') {
    return (
      <ScreenScaffold testID="property-os-smart-intro">
        <JourneyPhaseCard
          emoji={PHASE_EMOJI.smartEmployee}
          titleKey="journey.intro.smartEmployee.title"
          bodyKey="journey.intro.smartEmployee.body"
          onStart={() => setPhaseView('form')}
        />
      </ScreenScaffold>
    );
  }

  return (
    <ScreenScaffold testID="property-os-wizard">
      {successToast ? <WizardSuccessToast message={successToast} /> : null}

      <StoryScreenHeader
        question={t('pos.wizard.title')}
        hint={t('pos.wizard.subtitle')}
        showBack
        testID="property-os-header"
      />

      {phase !== 'smartEmployee' ? (
        <SetupProgressBar compact testID="property-os-progress" />
      ) : null}

      {phase !== 'smartEmployee' ? (
        <Animated.View entering={FadeInDown.duration(500)}>
          <GlassCard padding={16} radiusToken="lg" edge="gold">
            <View style={[styles.phaseNav, isRTL && styles.rowRtl]}>
              {visiblePhases(phaseIndex, phases).map((p) => {
                const i = PHASES.indexOf(p);
                const meta = phases.find((x) => x.id === p);
                const active = p === phase;
                const done = meta?.complete;
                return (
                  <Pressable
                    key={p}
                    onPress={() => { if (i <= phaseIndex || done) goPhase(p); }}
                    style={[styles.phaseDot, active && styles.phaseDotActive, done && styles.phaseDotDone]}
                  >
                    <Text style={[styles.phaseDotText, (active || done) && styles.phaseDotTextActive]}>
                      {i + 1}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            <Text style={[styles.phaseTitle, isRTL && styles.rtl]}>
              {t(`pos.phase.${phase}` as 'pos.phase.property')}
              {currentPhaseMeta ? ` · ${currentPhaseMeta.percent}%` : ''}
            </Text>
          </GlassCard>
        </Animated.View>
      ) : null}

      {phaseView === 'form' && phase !== 'smartEmployee' ? (
        <PhaseJourneyGuide phase={phase} />
      ) : null}

      <View style={{ paddingBottom: spacing['2xl'] }}>
        {phase === 'property' && phaseView === 'form' ? (
          <PhaseCard>
            <WizardPhaseIntro text={t('pos.intro.property')} />
            <WizardTextField
              label={t('pos.property.name')} required
              hint={t('pos.hint.property.name')}
              example={t('journey.ex.propertyName')}
              value={propName} onChangeText={(v) => { setPropName(v); clearErr('propName'); }}
              placeholder={t('pos.property.namePh')} testID="pos-prop-name"
              error={fieldErrors.propName}
            />
            <WizardChipGroup
              label={t('pos.property.type')}
              hint={t('pos.hint.property.type')}
              options={(['residential', 'commercial', 'mixed', 'land', 'other'] as PropertyType[]).map((v) => ({
                value: v, label: t(`pos.type.${v}` as 'pos.type.residential'),
              }))}
              value={propType} onChange={setPropType} testID="pos-prop-type"
            />
            <WizardTextField
              label={t('pos.property.city')} required
              hint={t('pos.hint.property.city')}
              example={t('journey.ex.city')}
              value={city} onChangeText={(v) => { setCity(v); clearErr('city'); }}
              placeholder={t('pos.property.cityPh')} testID="pos-prop-city"
              error={fieldErrors.city}
            />
            <WizardTextField
              label={t('pos.property.district')}
              hint={t('pos.hint.property.district')}
              value={district} onChangeText={setDistrict}
              placeholder={t('pos.property.districtPh')} testID="pos-prop-district"
            />
            <WizardTextField
              label={t('pos.property.buildings')}
              hint={t('pos.hint.property.buildings')}
              value={buildings} onChangeText={setBuildings} keyboard="numeric" testID="pos-prop-buildings"
            />
            <WizardTextField
              label={t('pos.property.unitCount')} required
              hint={t('pos.hint.property.unitCount')}
              value={unitCount} onChangeText={(v) => { setUnitCount(v); clearErr('unitCount'); }}
              keyboard="numeric" testID="pos-prop-units"
              error={fieldErrors.unitCount}
            />
          </PhaseCard>
        ) : null}

        {phase === 'units' && phaseView === 'form' ? (
          <PhaseCard>
            <WizardPhaseIntro text={t('pos.intro.units')} />
            {state.units.length > 0 ? (
              <Text style={[styles.saved, isRTL && styles.rtl]}>
                {t('pos.units.saved').replace('{n}', String(state.units.length))}
              </Text>
            ) : null}
            <WizardTextField
              label={t('pos.units.number')} required
              hint={t('pos.hint.units.number')}
              example={t('journey.ex.unitNumber')}
              value={unitDraft.number}
              onChangeText={(v) => { setUnitDraft((d) => ({ ...d, number: v })); clearErr('unitNumber'); }}
              placeholder={t('pos.units.numberPh')} testID="pos-unit-num"
              error={fieldErrors.unitNumber}
            />
            <WizardChipGroup label={t('pos.units.type')} options={unitTypeOptions} value={unitDraft.type} onChange={(v) => setUnitDraft((d) => ({ ...d, type: v }))} testID="pos-unit-type" />
            {unitDraft.type === 'apartment' ? (
              <>
                <WizardTextField label={t('pos.units.rooms')} value={unitDraft.rooms} onChangeText={(v) => setUnitDraft((d) => ({ ...d, rooms: v }))} keyboard="numeric" />
                <WizardTextField label={t('pos.units.livingRooms')} value={unitDraft.livingRooms} onChangeText={(v) => setUnitDraft((d) => ({ ...d, livingRooms: v }))} keyboard="numeric" />
                <WizardTextField label={t('pos.units.bathrooms')} value={unitDraft.bathrooms} onChangeText={(v) => setUnitDraft((d) => ({ ...d, bathrooms: v }))} keyboard="numeric" />
                <WizardToggle label={t('pos.units.kitchen')} value={unitDraft.kitchen} onChange={(v) => setUnitDraft((d) => ({ ...d, kitchen: v }))} />
                <WizardToggle label={t('pos.units.balcony')} value={unitDraft.balcony} onChange={(v) => setUnitDraft((d) => ({ ...d, balcony: v }))} />
              </>
            ) : null}
            <WizardTextField label={t('pos.units.area')} value={unitDraft.area} onChangeText={(v) => setUnitDraft((d) => ({ ...d, area: v }))} keyboard="numeric" />
            <WizardTextField label={t('pos.units.floor')} value={unitDraft.floor} onChangeText={(v) => setUnitDraft((d) => ({ ...d, floor: v }))} keyboard="numeric" />
            <WizardToggle label={t('pos.units.parking')} value={unitDraft.parking} onChange={(v) => setUnitDraft((d) => ({ ...d, parking: v }))} />
            <WizardToggle label={t('pos.units.elevator')} value={unitDraft.elevator} onChange={(v) => setUnitDraft((d) => ({ ...d, elevator: v }))} />
            <WizardToggle label={t('pos.units.furnished')} value={unitDraft.furnished} onChange={(v) => setUnitDraft((d) => ({ ...d, furnished: v }))} />
            <WizardChipGroup label={t('pos.units.status')} options={(['occupied', 'vacant', 'reserved', 'maintenance'] as UnitStatus[]).map((v) => ({ value: v, label: t(`pos.status.${v}` as 'pos.status.occupied') }))} value={unitDraft.status} onChange={(v) => setUnitDraft((d) => ({ ...d, status: v }))} />
            <WizardTextField
              label={t('pos.rent.amount')} required
              hint={t('pos.hint.units.rent')}
              example={t('journey.ex.rent')}
              value={unitDraft.rentAmount}
              onChangeText={(v) => { setUnitDraft((d) => ({ ...d, rentAmount: v })); clearErr('rentAmount'); }}
              keyboard="numeric" testID="pos-unit-rent"
              error={fieldErrors.rentAmount}
            />
            <WizardChipGroup label={t('pos.rent.period')} options={(['monthly', 'semi_annual', 'annual'] as RentPeriod[]).map((v) => ({ value: v, label: t(`pos.rent.${v}` as 'pos.rent.monthly') }))} value={unitDraft.rentPeriod} onChange={(v) => setUnitDraft((d) => ({ ...d, rentPeriod: v }))} />
            <WizardChipGroup label={t('pos.rent.paymentMethod')} options={(['transfer', 'cash', 'platform'] as PaymentMethod[]).map((v) => ({ value: v, label: t(`pos.pay.${v}` as 'pos.pay.transfer') }))} value={unitDraft.paymentMethod} onChange={(v) => setUnitDraft((d) => ({ ...d, paymentMethod: v }))} />
            <WizardTextField label={t('pos.rent.dueDay')} value={unitDraft.paymentDueDay} onChangeText={(v) => setUnitDraft((d) => ({ ...d, paymentDueDay: v }))} keyboard="numeric" />
            <WizardChipGroup label={t('pos.services.electricity')} hint={t('pos.hint.services.electricity')} options={(['tenant', 'owner', 'included'] as ServiceResponsibility[]).map((v) => ({ value: v, label: t(`pos.svc.${v}` as 'pos.svc.tenant') }))} value={unitDraft.electricity} onChange={(v) => setUnitDraft((d) => ({ ...d, electricity: v }))} />
            <WizardTextField label={t('pos.meter.electricity')} value={unitDraft.electricityMeter} onChangeText={(v) => setUnitDraft((d) => ({ ...d, electricityMeter: v }))} />
            <WizardChipGroup label={t('pos.services.water')} hint={t('pos.hint.services.water')} options={(['tenant', 'owner', 'included'] as ServiceResponsibility[]).map((v) => ({ value: v, label: t(`pos.svc.${v}` as 'pos.svc.tenant') }))} value={unitDraft.water} onChange={(v) => setUnitDraft((d) => ({ ...d, water: v }))} />
            <WizardTextField label={t('pos.meter.water')} value={unitDraft.waterMeter} onChangeText={(v) => setUnitDraft((d) => ({ ...d, waterMeter: v }))} />
            <WizardChipGroup label={t('pos.services.internet')} options={[{ value: 'tenant' as const, label: t('pos.svc.internetTenant') }, { value: 'included' as const, label: t('pos.svc.internetIncluded') }]} value={unitDraft.internet} onChange={(v) => setUnitDraft((d) => ({ ...d, internet: v }))} />
            <WizardChipGroup label={t('pos.services.gas')} options={(['central', 'independent'] as GasType[]).map((v) => ({ value: v, label: t(`pos.gas.${v}` as 'pos.gas.central') }))} value={unitDraft.gas} onChange={(v) => setUnitDraft((d) => ({ ...d, gas: v }))} />
            <WizardChipGroup label={t('pos.maintenance.by')} options={(['owner', 'tenant', 'contract'] as MaintenanceResponsibility[]).map((v) => ({ value: v, label: t(`pos.maint.${v}` as 'pos.maint.owner') }))} value={unitDraft.maintenanceBy} onChange={(v) => setUnitDraft((d) => ({ ...d, maintenanceBy: v }))} />
            <WizardChipGroup label={t('pos.insurance.has')} options={[{ value: 'yes' as const, label: t('pos.insurance.yes') }, { value: 'no' as const, label: t('pos.insurance.no') }]} value={unitDraft.hasInsurance ? 'yes' : 'no'} onChange={(v) => setUnitDraft((d) => ({ ...d, hasInsurance: v === 'yes' }))} />
            {unitDraft.hasInsurance ? (
              <WizardTextField label={t('pos.insurance.amount')} value={unitDraft.insuranceAmount} onChangeText={(v) => setUnitDraft((d) => ({ ...d, insuranceAmount: v }))} keyboard="numeric" />
            ) : null}
            <WizardTextField label={t('pos.units.notes')} hint={t('pos.hint.units.notes')} value={unitDraft.notes} onChangeText={(v) => setUnitDraft((d) => ({ ...d, notes: v }))} placeholder={t('pos.units.notesPh')} />
          </PhaseCard>
        ) : null}

        {phase === 'tenants' && phaseView === 'form' ? (
          state.units.length === 0 ? (
            <WizardPrerequisite
              titleKey="journey.block.noUnits.title"
              bodyKey="journey.block.noUnits.body"
              actionKey="journey.block.noUnits.action"
              onAction={() => goPhase('units')}
              testID="wizard-block-no-units"
            />
          ) : (
          <PhaseCard>
            <WizardPhaseIntro text={t('pos.intro.tenants')} />
            <WizardTextField
              label={t('pos.tenant.name')} required
              hint={t('pos.hint.tenant.name')}
              example={t('journey.ex.tenantName')}
              value={tenantName} onChangeText={(v) => { setTenantName(v); clearErr('tenantName'); }}
              testID="pos-tenant-name" error={fieldErrors.tenantName}
            />
            <WizardTextField
              label={t('pos.tenant.phone')} required
              hint={t('pos.hint.tenant.phone')}
              example={t('journey.ex.phone')}
              value={tenantPhone} onChangeText={(v) => { setTenantPhone(v); clearErr('tenantPhone'); }}
              keyboard="phone-pad" testID="pos-tenant-phone" error={fieldErrors.tenantPhone}
            />
            <WizardTextField label={t('pos.tenant.email')} hint={t('pos.hint.tenant.email')} value={tenantEmail} onChangeText={setTenantEmail} keyboard="email-address" />
            <WizardTextField label={t('pos.tenant.nationalId')} hint={t('pos.hint.tenant.nationalId')} value={tenantId} onChangeText={setTenantId} />
            <WizardChipGroup
              label={t('pos.tenant.unit')} required
              options={state.units.map((u) => ({ value: u.id, label: u.number }))}
              value={tenantUnitId} onChange={(v) => { setTenantUnitId(v); clearErr('tenantUnitId'); }}
              testID="pos-tenant-unit" error={fieldErrors.tenantUnitId}
            />
            <WizardTextField label={t('pos.tenant.moveIn')} value={moveIn} onChangeText={setMoveIn} placeholder="YYYY-MM-DD" />
          </PhaseCard>
          )
        ) : null}

        {phase === 'contracts' && phaseView === 'form' ? (
          state.tenants.length === 0 ? (
            <WizardPrerequisite
              titleKey="journey.block.noTenants.title"
              bodyKey="journey.block.noTenants.body"
              actionKey="journey.block.noTenants.action"
              onAction={() => goPhase('tenants')}
              testID="wizard-block-no-tenants"
            />
          ) : (
          <PhaseCard>
            <WizardPhaseIntro text={t('pos.intro.contracts')} />
            <WizardTextField
              label={t('pos.contract.number')} required
              hint={t('pos.hint.contract.number')}
              value={contractNum} onChangeText={(v) => { setContractNum(v); clearErr('contractNum'); }}
              testID="pos-contract-num" error={fieldErrors.contractNum}
            />
            <WizardChipGroup
              label={t('pos.tenant.name')} required
              options={state.tenants.map((x) => ({ value: x.id, label: x.name }))}
              value={contractTenantId} onChange={(v) => { setContractTenantId(v); clearErr('contractTenantId'); }}
              error={fieldErrors.contractTenantId}
            />
            <WizardTextField
              label={t('pos.contract.start')} required
              value={contractStart} onChangeText={(v) => { setContractStart(v); clearErr('contractStart'); }}
              placeholder="YYYY-MM-DD" error={fieldErrors.contractStart}
            />
            <WizardTextField
              label={t('pos.contract.end')} required
              hint={t('pos.hint.contract.end')}
              value={contractEnd} onChangeText={(v) => { setContractEnd(v); clearErr('contractEnd'); }}
              placeholder="YYYY-MM-DD" error={fieldErrors.contractEnd}
            />
            <WizardTextField
              label={t('pos.contract.rent')} required
              value={contractRent} onChangeText={(v) => { setContractRent(v); clearErr('contractRent'); }}
              keyboard="numeric" error={fieldErrors.contractRent}
            />
            <WizardTextField label={t('pos.contract.deposit')} value={contractDeposit} onChangeText={setContractDeposit} keyboard="numeric" />
            <WizardTextField label={t('pos.contract.terms')} value={contractTerms} onChangeText={setContractTerms} />
          </PhaseCard>
          )
        ) : null}

        {phase === 'alerts' && phaseView === 'form' ? (
          <PhaseCard>
            <WizardPhaseIntro text={t('pos.intro.alerts')} />
            <WizardInfoBox why={t('pos.alerts.why')} example={t('pos.alerts.enable')} />
            <PortalPreview title={t('pos.portal.tech.lead')} subtitle={t('pos.portal.tech.why')} link={techLink} isRTL={isRTL} />
          </PhaseCard>
        ) : null}

        {phase === 'smartEmployee' ? (
          <Animated.View entering={FadeInDown.duration(600)} style={{ marginTop: spacing.lg }}>
            <PhaseJourneyGuide phase="smartEmployee" />
            {tenantPortal ? (
              <PortalPreview
                title={t('pos.portal.tenant.lead')}
                link={tenantPortal.portalUrl}
                extra={tenantPortal.whatsAppMessage}
                onShare={shareWhatsApp}
                shareLabel={t('pos.portal.shareWhatsapp')}
                isRTL={isRTL}
              />
            ) : null}
            <View style={{ marginTop: spacing.md }}>
              <JourneyLaunchComplete
                onServices={() => { markSetupComplete(); router.replace('/operational/services' as any); }}
                onUpload={() => { markSetupComplete(); router.replace('/upload' as any); }}
                onDaily={() => { markSetupComplete(); router.replace('/' as any); }}
              />
            </View>
          </Animated.View>
        ) : null}

        {showFormActions ? (
          <Animated.View entering={FadeInDown.duration(500).delay(80)} style={styles.actions}>
            {phaseIndex > 0 ? (
              <Pressable style={styles.secondaryBtn} onPress={() => goPhase(PHASES[phaseIndex - 1])} disabled={advancing}>
                <Text style={styles.secondaryText}>{t('pos.back')}</Text>
              </Pressable>
            ) : null}
            <Pressable
              style={[styles.primaryBtn, advancing && styles.primaryBtnDisabled]}
              onPress={onContinue}
              disabled={advancing}
              testID="pos-wizard-continue"
            >
              <Text style={styles.primaryText}>{t('pos.continue')}</Text>
              <Feather name="arrow-right" size={14} color={colors.bg} />
            </Pressable>
          </Animated.View>
        ) : null}

        {showFormActions ? (
          <>
            <Pressable style={styles.importLink} onPress={() => router.push('/upload')}>
              <Feather name="upload" size={14} color={colors.gold} />
              <Text style={styles.importText}>{t('pos.wizard.importAlt')}</Text>
            </Pressable>
            <Text style={[styles.importHint, isRTL && styles.rtl]}>{t('pos.wizard.importHint')}</Text>
          </>
        ) : null}
      </View>
    </ScreenScaffold>
  );
}

function PhaseCard({ children }: { children: React.ReactNode }) {
  return (
    <Animated.View entering={FadeInDown.duration(550).delay(60)} style={{ marginTop: spacing.md }}>
      <GlassCard padding={20} radiusToken="lg" edge="emerald">{children}</GlassCard>
    </Animated.View>
  );
}

function PortalPreview({
  title, subtitle, link, extra, onShare, shareLabel, isRTL,
}: {
  title: string; subtitle?: string; link: string; extra?: string;
  onShare?: () => void; shareLabel?: string; isRTL: boolean;
}) {
  const { t } = useI18n();
  return (
    <View style={styles.portalBox}>
      <Text style={[styles.portalTitle, isRTL && styles.rtl]}>{title}</Text>
      {subtitle ? <Text style={[styles.portalSub, isRTL && styles.rtl]}>{subtitle}</Text> : null}
      <Text style={[styles.portalLabel, isRTL && styles.rtl]}>{t('pos.portal.link')}</Text>
      <Text style={styles.portalLink} selectable>{link}</Text>
      {extra ? (
        <>
          <Text style={[styles.portalLabel, isRTL && styles.rtl, { marginTop: 8 }]}>{t('pos.portal.whatsapp')}</Text>
          <Text style={[styles.portalExtra, isRTL && styles.rtl]} selectable>{extra}</Text>
        </>
      ) : null}
      {onShare && shareLabel ? (
        <Pressable style={styles.shareBtn} onPress={onShare}>
          <Feather name="message-circle" size={14} color={colors.emerald} />
          <Text style={styles.shareText}>{shareLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  welcomeWrap: { flex: 1, justifyContent: 'center', paddingVertical: spacing['2xl'] },
  welcomeTitle: {
    color: colors.text, fontSize: 24, fontWeight: typography.weight.semibold,
    letterSpacing: typography.letter.tight, textAlign: 'center',
  },
  welcomeBody: {
    color: colors.textDim, fontSize: 15, lineHeight: 24, marginTop: 14, textAlign: 'center',
  },
  welcomeBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: colors.emerald, borderRadius: radius.md, paddingVertical: 16, marginTop: 28,
  },
  welcomeBtnText: { color: colors.bg, fontSize: 15, fontWeight: typography.weight.semibold },
  phaseNav: { flexDirection: 'row', justifyContent: 'space-between', gap: 4 },
  rowRtl: { flexDirection: 'row-reverse' },
  phaseDot: {
    width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border,
  },
  phaseDotActive: { borderColor: colors.goldEdge, backgroundColor: colors.goldSoft },
  phaseDotDone: { borderColor: colors.emeraldEdge, backgroundColor: colors.emeraldSoft },
  phaseDotText: { color: colors.textSubtle, fontSize: 11, fontWeight: typography.weight.semibold },
  phaseDotTextActive: { color: colors.text },
  phaseTitle: { color: colors.textMuted, fontSize: 12, marginTop: 12 },
  rtl: { writingDirection: 'rtl', textAlign: 'right' },
  saved: { color: colors.emerald, fontSize: 12, marginBottom: spacing.sm },
  completeTitle: {
    color: colors.text, fontSize: 22, fontWeight: typography.weight.semibold,
    textAlign: 'center', lineHeight: 30,
  },
  checklist: { marginTop: 20, gap: 10 },
  checkItem: { color: colors.textDim, fontSize: 14.5, lineHeight: 22 },
  completeCta: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: colors.emerald, borderRadius: radius.md, paddingVertical: 18, marginTop: 24,
  },
  completeCtaText: { color: colors.bg, fontSize: 16, fontWeight: typography.weight.semibold },
  actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg },
  primaryBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: colors.emerald, borderRadius: radius.md, paddingVertical: 16,
  },
  primaryBtnDisabled: { opacity: 0.55 },
  primaryText: { color: colors.bg, fontSize: 14, fontWeight: typography.weight.semibold },
  secondaryBtn: {
    paddingVertical: 16, paddingHorizontal: 18, borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border,
  },
  secondaryText: { color: colors.textDim, fontSize: 13 },
  importLink: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: spacing.lg, alignSelf: 'center' },
  importText: { color: colors.gold, fontSize: 13, fontWeight: typography.weight.medium },
  importHint: { color: colors.textSubtle, fontSize: 11.5, textAlign: 'center', marginTop: 6, lineHeight: 17 },
  portalBox: {
    marginTop: spacing.md, padding: 14, borderRadius: radius.md,
    backgroundColor: 'rgba(255,255,255,0.03)', borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border,
  },
  portalTitle: { color: colors.text, fontSize: 14, fontWeight: typography.weight.semibold },
  portalSub: { color: colors.textDim, fontSize: 12, lineHeight: 18, marginTop: 4 },
  portalLabel: { color: colors.textMuted, fontSize: 10, letterSpacing: 1, marginTop: 10, textTransform: 'uppercase' },
  portalLink: { color: colors.gold, fontSize: 11.5, marginTop: 4 },
  portalExtra: { color: colors.textDim, fontSize: 12, lineHeight: 18, marginTop: 4 },
  shareBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12,
    alignSelf: 'flex-start', paddingVertical: 8, paddingHorizontal: 12,
    borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.emeraldEdge,
    backgroundColor: colors.emeraldSoft,
  },
  shareText: { color: colors.emerald, fontSize: 12, fontWeight: typography.weight.medium },
});
