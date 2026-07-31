import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, Linking, Platform } from 'react-native';
import { KeyboardAwareTextInput } from '@/src/components/KeyboardAwareTextInput';
import type { TechnicianRecord, TechnicianSpecialty } from '@/src/types/technician';
import { TechPortalShareCard } from '@/src/components/TechPortalShareCard';
import * as DocumentPicker from 'expo-document-picker';
import * as Haptics from 'expo-haptics';
import { Feather } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { GlassCard } from '@/src/components/GlassCard';
import { OperationHint } from '@/src/components/OperationHint';
import type {
  MaintenanceCategory,
  MaintenancePriority,
  MediaAttachment,
} from '@/src/types/operational';
import { colors, spacing, typography, radius } from '@/src/theme';
import { useI18n } from '@/src/i18n';

const STEPS = [
  'create', 'type', 'description', 'photos', 'video', 'priority', 'technician', 'submit',
] as const;

type StepId = typeof STEPS[number];

const CATEGORIES: MaintenanceCategory[] = ['plumbing', 'electrical', 'ac', 'general', 'other'];
const SPECIALTIES: TechnicianSpecialty[] = ['plumbing', 'electrical', 'ac', 'general', 'other'];
const PRIORITIES: MaintenancePriority[] = ['low', 'medium', 'high', 'urgent'];

type Props = {
  unitId: string;
  unitLabel?: string;
  tenantId?: string;
  technicianList?: TechnicianRecord[];
  onCreateTechnician?: (input: { name: string; phone: string; specialty: TechnicianSpecialty }) => Promise<TechnicianRecord>;
  onSubmit: (data: {
    title: string;
    description: string;
    category: MaintenanceCategory;
    priority: MaintenancePriority;
    technicianId?: string;
    technicianName?: string;
    media: MediaAttachment[];
  }) => Promise<void>;
  onCancel?: () => void;
};

export function MaintenanceJourney({
  unitId, unitLabel, tenantId, technicianList = [],
  onCreateTechnician, onSubmit, onCancel,
}: Props) {
  const { t, isRTL } = useI18n();
  const [stepIdx, setStepIdx] = useState(0);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<MaintenanceCategory>('general');
  const [description, setDescription] = useState('');
  const [media, setMedia] = useState<MediaAttachment[]>([]);
  const [priority, setPriority] = useState<MaintenancePriority>('medium');
  const [technicianId, setTechnicianId] = useState<string | undefined>();
  const [showAddTech, setShowAddTech] = useState(false);
  const [newTechName, setNewTechName] = useState('');
  const [newTechPhone, setNewTechPhone] = useState('');
  const [newTechSpecialty, setNewTechSpecialty] = useState<TechnicianSpecialty>('general');
  const [createdTech, setCreatedTech] = useState<TechnicianRecord | null>(null);
  const [busy, setBusy] = useState(false);

  const selectedTech = technicianList.find((t) => t.id === technicianId);

  const step = STEPS[stepIdx];

  const pickMedia = async (type: 'photo' | 'video' | 'file') => {
    const res = await DocumentPicker.getDocumentAsync({
      copyToCacheDirectory: true,
      type: type === 'video' ? 'video/*' : type === 'photo' ? 'image/*' : '*/*',
    });
    if (res.canceled || !res.assets?.[0]) return;
    const a = res.assets[0];
    setMedia((m) => [...m, {
      uri: a.uri,
      type,
      name: a.name,
      addedAt: new Date().toISOString(),
    }]);
    Haptics.selectionAsync();
  };

  const next = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (stepIdx < STEPS.length - 1) setStepIdx(stepIdx + 1);
  };

  const back = () => {
    if (stepIdx > 0) setStepIdx(stepIdx - 1);
    else onCancel?.();
  };

  const handleSubmit = async () => {
    if (!title.trim()) return;
    setBusy(true);
    try {
      await onSubmit({
        title: title.trim(),
        description: description.trim(),
        category,
        priority,
        technicianId: selectedTech?.id,
        technicianName: selectedTech?.name,
        media,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } finally {
      setBusy(false);
    }
  };

  const stepLabel = (s: StepId) => t(`opsv2.maint.step.${s}` as any);

  const shareWhatsApp = (phone: string, message: string) => {
    const digits = phone.replace(/\D/g, '');
    if (!digits) return;
    const url = Platform.select({
      ios: `whatsapp://send?phone=${digits}&text=${encodeURIComponent(message)}`,
      default: `https://wa.me/${digits}?text=${encodeURIComponent(message)}`,
    });
    Linking.openURL(url!).catch(() => {});
  };

  const handleCreateTechLink = async () => {
    if (!newTechName.trim() || !onCreateTechnician) return;
    setBusy(true);
    try {
      const tech = await onCreateTechnician({
        name: newTechName.trim(),
        phone: newTechPhone,
        specialty: newTechSpecialty,
      });
      setTechnicianId(tech.id);
      setCreatedTech(tech);
      setShowAddTech(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } finally {
      setBusy(false);
    }
  };

  return (
    <View testID="maintenance-journey">
      <OperationHint feature="maintenance" />

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.stepper}>
        {STEPS.map((s, i) => (
          <View key={s} style={[styles.stepChip, i <= stepIdx && styles.stepChipActive]}>
            <Text style={[styles.stepChipText, i <= stepIdx && styles.stepChipTextActive]}>
              {i + 1}. {stepLabel(s)}
            </Text>
          </View>
        ))}
      </ScrollView>

      <Animated.View entering={FadeInDown.duration(400)} key={step}>
        <GlassCard padding={18} radiusToken="lg" edge="emerald" style={{ marginTop: spacing.md }}>
          {unitLabel ? (
            <Text style={[styles.unit, isRTL && styles.rtl]}>{unitLabel}</Text>
          ) : null}

          {step === 'create' ? (
            <>
              <Text style={[styles.label, isRTL && styles.rtl]}>{stepLabel('create')}</Text>
              <KeyboardAwareTextInput
                value={title}
                onChangeText={setTitle}
                placeholder={t('op.tenant.requestPh')}
                placeholderTextColor={colors.textSubtle}
                style={[styles.input, isRTL && styles.rtl]}
              />
            </>
          ) : null}

          {step === 'type' ? (
            <>
              <Text style={[styles.label, isRTL && styles.rtl]}>{stepLabel('type')}</Text>
              <View style={styles.chips}>
                {CATEGORIES.map((c) => (
                  <Pressable
                    key={c}
                    style={[styles.chip, category === c && styles.chipActive]}
                    onPress={() => setCategory(c)}
                  >
                    <Text style={[styles.chipText, category === c && styles.chipTextActive]}>
                      {t(`opsv2.maint.type.${c}` as any)}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </>
          ) : null}

          {step === 'description' ? (
            <>
              <Text style={[styles.label, isRTL && styles.rtl]}>{stepLabel('description')}</Text>
              <KeyboardAwareTextInput
                value={description}
                onChangeText={setDescription}
                multiline
                style={[styles.input, styles.multiline, isRTL && styles.rtl]}
                placeholderTextColor={colors.textSubtle}
              />
            </>
          ) : null}

          {step === 'photos' ? (
            <>
              <Text style={[styles.label, isRTL && styles.rtl]}>{stepLabel('photos')}</Text>
              <Pressable style={styles.mediaBtn} onPress={() => pickMedia('photo')}>
                <Feather name="camera" size={16} color={colors.emerald} />
                <Text style={styles.mediaBtnText}>{t('opsv2.maint.addPhoto' as any)}</Text>
              </Pressable>
              {media.filter((m) => m.type === 'photo').map((m) => (
                <Text key={m.uri} style={styles.mediaName}>{m.name}</Text>
              ))}
            </>
          ) : null}

          {step === 'video' ? (
            <>
              <Text style={[styles.label, isRTL && styles.rtl]}>{stepLabel('video')}</Text>
              <Pressable style={styles.mediaBtn} onPress={() => pickMedia('video')}>
                <Feather name="video" size={16} color={colors.emerald} />
                <Text style={styles.mediaBtnText}>{t('opsv2.maint.addVideo' as any)}</Text>
              </Pressable>
              <Pressable style={[styles.mediaBtn, { marginTop: 8 }]} onPress={() => pickMedia('file')}>
                <Feather name="paperclip" size={16} color={colors.gold} />
                <Text style={[styles.mediaBtnText, { color: colors.gold }]}>{t('opsv2.maint.addFile' as any)}</Text>
              </Pressable>
            </>
          ) : null}

          {step === 'priority' ? (
            <>
              <Text style={[styles.label, isRTL && styles.rtl]}>{stepLabel('priority')}</Text>
              <View style={styles.chips}>
                {PRIORITIES.map((p) => (
                  <Pressable
                    key={p}
                    style={[styles.chip, priority === p && styles.chipActive]}
                    onPress={() => setPriority(p)}
                  >
                    <Text style={[styles.chipText, priority === p && styles.chipTextActive]}>
                      {t(`opsv2.maint.priority.${p}` as any)}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </>
          ) : null}

          {step === 'technician' ? (
            <>
              <Text style={[styles.label, isRTL && styles.rtl]}>{t('maint.selectTech' as any)}</Text>
              {technicianList.map((tech) => (
                <Pressable
                  key={tech.id}
                  style={[styles.techRow, technicianId === tech.id && styles.techRowActive]}
                  onPress={() => setTechnicianId(tech.id)}
                >
                  <Text style={styles.techText}>{tech.name}</Text>
                  <Text style={styles.dim}>{tech.phone} · {t(`opsv2.maint.type.${tech.specialty}` as any)}</Text>
                </Pressable>
              ))}
              <Pressable style={styles.mediaBtn} onPress={() => setShowAddTech(!showAddTech)}>
                <Feather name="user-plus" size={16} color={colors.gold} />
                <Text style={[styles.mediaBtnText, { color: colors.gold }]}>{t('maint.addTech' as any)}</Text>
              </Pressable>
              {showAddTech && onCreateTechnician ? (
                <View style={styles.addTechBox}>
                  <Text style={[styles.addTechTitle, isRTL && styles.rtl]}>{t('maint.addTech' as any)}</Text>

                  <Text style={[styles.fieldLabel, isRTL && styles.rtl]}>{t('maint.techName' as any)}</Text>
                  <KeyboardAwareTextInput
                    value={newTechName}
                    onChangeText={setNewTechName}
                    placeholder={t('maint.techName' as any)}
                    placeholderTextColor={colors.textSubtle}
                    style={[styles.input, isRTL && styles.rtl]}
                  />

                  <Text style={[styles.fieldLabel, isRTL && styles.rtl]}>{t('maint.techPhone' as any)}</Text>
                  <KeyboardAwareTextInput
                    value={newTechPhone}
                    onChangeText={setNewTechPhone}
                    placeholder={t('maint.techPhone' as any)}
                    placeholderTextColor={colors.textSubtle}
                    keyboardType="phone-pad"
                    style={[styles.input, isRTL && styles.rtl]}
                  />

                  <Text style={[styles.fieldLabel, isRTL && styles.rtl]}>{t('maint.techSpecialty' as any)}</Text>
                  <View style={styles.chips}>
                    {SPECIALTIES.map((s) => (
                      <Pressable
                        key={s}
                        style={[styles.chip, newTechSpecialty === s && styles.chipActive]}
                        onPress={() => setNewTechSpecialty(s)}
                      >
                        <Text style={[styles.chipText, newTechSpecialty === s && styles.chipTextActive]}>
                          {t(`opsv2.maint.type.${s}` as any)}
                        </Text>
                      </Pressable>
                    ))}
                  </View>

                  <Pressable
                    style={[styles.navPrimary, { marginTop: spacing.md }, (!newTechName.trim() || busy) && { opacity: 0.5 }]}
                    onPress={handleCreateTechLink}
                    disabled={!newTechName.trim() || busy}
                  >
                    <Text style={styles.navPrimaryText}>{t('maint.createLink' as any)}</Text>
                  </Pressable>

                  {createdTech ? (
                    <TechPortalShareCard tech={createdTech} testID="maint-created-tech" />
                  ) : null}
                </View>
              ) : null}
            </>
          ) : null}

          {step === 'submit' ? (
            <>
              <Text style={[styles.label, isRTL && styles.rtl]}>{title}</Text>
              <Text style={[styles.dim, isRTL && styles.rtl]}>
                {t(`opsv2.maint.type.${category}` as any)} · {t(`opsv2.maint.priority.${priority}` as any)}
              </Text>
              {description ? <Text style={[styles.dim, isRTL && styles.rtl]}>{description}</Text> : null}
              {media.length ? (
                <Text style={[styles.dim, isRTL && styles.rtl]}>{media.length} ملف(ات) مرفقة</Text>
              ) : null}
              {selectedTech ? <Text style={[styles.dim, isRTL && styles.rtl]}>{selectedTech.name}</Text> : null}
            </>
          ) : null}
        </GlassCard>
      </Animated.View>

      <View style={[styles.nav, isRTL && styles.navRtl]}>
        <Pressable style={styles.navBtn} onPress={back}>
          <Text style={styles.navBtnText}>{stepIdx === 0 ? '✕' : '←'}</Text>
        </Pressable>
        {step !== 'submit' ? (
          <Pressable
            style={[styles.navPrimary, !title.trim() && step === 'create' && { opacity: 0.5 }]}
            onPress={next}
            disabled={step === 'create' && !title.trim()}
          >
            <Text style={styles.navPrimaryText}>→</Text>
          </Pressable>
        ) : (
          <Pressable style={styles.navPrimary} onPress={handleSubmit} disabled={busy}>
            <Text style={styles.navPrimaryText}>{t('opsv2.maint.submit' as any)}</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  stepper: { marginTop: spacing.md, maxHeight: 44 },
  stepChip: {
    paddingHorizontal: 10, paddingVertical: 6, marginRight: 8, borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border,
  },
  stepChipActive: { borderColor: colors.emeraldEdge, backgroundColor: colors.emeraldSoft },
  stepChipText: { color: colors.textMuted, fontSize: 10 },
  stepChipTextActive: { color: colors.emerald, fontWeight: typography.weight.semibold },
  unit: { color: colors.gold, fontSize: 12, marginBottom: 8 },
  label: { color: colors.text, fontSize: 16, fontWeight: typography.weight.semibold, marginBottom: 10 },
  rtl: { writingDirection: 'rtl', textAlign: 'right' },
  input: {
    borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border,
    padding: 12, color: colors.text, fontSize: typography.body,
    backgroundColor: 'rgba(255,255,255,0.02)',
  },
  multiline: { minHeight: 100, textAlignVertical: 'top' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border,
  },
  chipActive: { borderColor: colors.emeraldEdge, backgroundColor: colors.emeraldSoft },
  chipText: { color: colors.textDim, fontSize: 13 },
  chipTextActive: { color: colors.emerald, fontWeight: typography.weight.semibold },
  mediaBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12,
    borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.emeraldEdge,
    backgroundColor: colors.emeraldSoft,
  },
  mediaBtnText: { color: colors.emerald, fontSize: 13, fontWeight: typography.weight.medium },
  mediaName: { color: colors.textDim, fontSize: 11, marginTop: 6 },
  techRow: {
    padding: 12, borderRadius: radius.md, marginTop: 8,
    borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border,
  },
  techRowActive: { borderColor: colors.emeraldEdge, backgroundColor: colors.emeraldSoft },
  techText: { color: colors.text, fontSize: 14 },
  dim: { color: colors.textDim, fontSize: 13, marginTop: 6, lineHeight: 20 },
  nav: { flexDirection: 'row', gap: 10, marginTop: spacing.lg },
  navRtl: { flexDirection: 'row-reverse' },
  navBtn: {
    width: 48, height: 48, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border,
  },
  navBtnText: { color: colors.textDim, fontSize: 18 },
  navPrimary: {
    flex: 1, height: 48, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.emerald,
  },
  navPrimaryText: { color: colors.bg, fontSize: 15, fontWeight: typography.weight.semibold },
  addTechBox: { marginTop: spacing.md, gap: 6 },
  addTechTitle: { color: colors.gold, fontSize: 15, fontWeight: typography.weight.semibold, marginBottom: 4 },
  fieldLabel: { color: colors.textMuted, fontSize: 12, marginTop: 8, marginBottom: 4 },
  linkReady: { color: colors.emerald, fontSize: 12, marginTop: spacing.md, fontWeight: typography.weight.medium },
  linkText: { color: colors.textDim, fontSize: 11, lineHeight: 18, marginTop: 4 },
  sendBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    marginTop: spacing.sm, paddingVertical: 12, borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth, borderColor: colors.emeraldEdge,
    backgroundColor: colors.emeraldSoft,
  },
  sendBtnText: { color: colors.emerald, fontSize: 14, fontWeight: typography.weight.semibold },
});
