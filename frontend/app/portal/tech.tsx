import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import * as Haptics from 'expo-haptics';
import { Feather } from '@expo/vector-icons';

import { ScreenScaffold } from '@/src/components/ScreenScaffold';
import { StoryScreenHeader } from '@/src/components/StoryScreenHeader';
import { GlassCard } from '@/src/components/GlassCard';
import { AliveEmpty } from '@/src/components/AliveEmpty';
import { ActingAsBadge } from '@/src/components/ActingAsBadge';
import { MaintenanceTimeline } from '@/src/components/maintenance/MaintenanceTimeline';
import { KeyboardAwareTextInput } from '@/src/components/KeyboardAwareTextInput';
import { usePropertyOS } from '@/src/hooks/usePropertyOS';
import { useOperational } from '@/src/hooks/useOperational';
import { useTechnicians } from '@/src/hooks/useTechnicians';
import { useNotificationPrefs } from '@/src/hooks/usePreferences';
import type { MaintenanceTicket } from '@/src/types/operational';
import { colors, spacing, typography, radius } from '@/src/theme';
import { useI18n } from '@/src/i18n';

function TechTicketCard({
  tk, unitNumber, note, onNote, actions, isRTL, t,
}: {
  tk: MaintenanceTicket;
  unitNumber?: string;
  note: string;
  onNote: (v: string) => void;
  actions: React.ReactNode;
  isRTL: boolean;
  t: (k: string) => string;
}) {
  return (
    <GlassCard padding={16} radiusToken="md" style={styles.card}>
      <Text style={[styles.title, isRTL && styles.rtl]}>{tk.title}</Text>
      <Text style={[styles.dim, isRTL && styles.rtl]}>
        {t('op.tenant.unit')} {unitNumber ?? '—'} · {tk.progressPercent ?? 0}%
      </Text>
      <MaintenanceTimeline ticket={tk} showProgress={false} showEta />
      <KeyboardAwareTextInput
        value={note}
        onChangeText={onNote}
        placeholder={t('opsv2.tech.notes' as any)}
        placeholderTextColor={colors.textSubtle}
        style={[styles.input, isRTL && styles.rtl]}
      />
      {actions}
    </GlassCard>
  );
}

export default function TechPortalScreen() {
  const { t, isRTL } = useI18n();
  const params = useLocalSearchParams<{ id?: string; t?: string }>();
  const { countEnabled } = useNotificationPrefs();
  const { state } = usePropertyOS(countEnabled);
  const {
    tickets, ticketsForTechnician, acceptTicket, enRouteTicket, startTicket,
    uploadTicketMedia, completeTicket,
  } = useOperational();
  const { technicians, logLogin } = useTechnicians();
  const [note, setNote] = useState<Record<string, string>>({});

  const tech = technicians.find((x) => x.id === params.id && x.portalToken === params.t);
  const legacyValid = Boolean(
    !params.id && params.t && state.technicianPortalToken && params.t === state.technicianPortalToken,
  );
  const valid = Boolean(tech) || legacyValid;

  useEffect(() => {
    if (tech) void logLogin(tech.id);
  }, [tech?.id]);

  // Spec §13 — technician sees assigned tasks only (legacy shared token: none until personal link).
  const myTickets = useMemo(() => {
    if (tech) return ticketsForTechnician(tech.id);
    if (legacyValid) return [];
    return [];
  }, [tech, legacyValid, ticketsForTechnician]);

  const { newTasks, activeTasks, doneTasks } = useMemo(() => ({
    newTasks: myTickets.filter((tk) => tk.status === 'assigned' || tk.status === 'open'),
    activeTasks: myTickets.filter((tk) => ['accepted', 'en_route', 'in_progress'].includes(tk.status)),
    doneTasks: myTickets.filter((tk) => tk.status === 'closed' || tk.status === 'awaiting_tenant'),
  }), [myTickets]);

  const pickMedia = async (ticketId: string, phase: 'before' | 'after') => {
    const res = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true, type: 'image/*' });
    if (res.canceled || !res.assets?.[0]) return;
    const a = res.assets[0];
    await uploadTicketMedia(ticketId, [{
      uri: a.uri, type: 'photo', name: a.name, addedAt: new Date().toISOString(), phase,
    }], phase);
    Haptics.selectionAsync();
  };

  if (!valid) {
    return (
      <ScreenScaffold testID="tech-portal">
        <StoryScreenHeader question={t('maint.techDashboard' as any)} hint={t('op.tech.invalid')} showBack />
        <AliveEmpty title={t('op.tech.title')} body={t('op.tech.invalid')} />
      </ScreenScaffold>
    );
  }

  const renderActions = (tk: MaintenanceTicket) => (
    <View style={[styles.row, isRTL && styles.rowRtl]}>
      {tk.status === 'assigned' || tk.status === 'open' ? (
        <Pressable style={styles.btn} onPress={() => acceptTicket(tk.id)}>
          <Text style={styles.btnText}>{t('maint.accept' as any)}</Text>
        </Pressable>
      ) : null}
      {tk.status === 'accepted' ? (
        <Pressable style={styles.btn} onPress={() => enRouteTicket(tk.id)}>
          <Text style={styles.btnText}>{t('maint.enRoute' as any)}</Text>
        </Pressable>
      ) : null}
      {['accepted', 'en_route'].includes(tk.status) ? (
        <Pressable style={styles.btn} onPress={() => startTicket(tk.id)}>
          <Text style={styles.btnText}>{t('maint.start' as any)}</Text>
        </Pressable>
      ) : null}
      {tk.status === 'in_progress' ? (
        <>
          <Pressable style={styles.btn} onPress={() => pickMedia(tk.id, 'before')}>
            <Text style={styles.btnText}>{t('maint.before' as any)}</Text>
          </Pressable>
          <Pressable style={styles.btn} onPress={() => pickMedia(tk.id, 'after')}>
            <Text style={styles.btnText}>{t('maint.after' as any)}</Text>
          </Pressable>
          <Pressable
            style={[styles.btn, styles.btnClose]}
            onPress={() => completeTicket(tk.id, note[tk.id]?.trim())}
          >
            <Text style={[styles.btnText, { color: colors.gold }]}>{t('maint.complete' as any)}</Text>
          </Pressable>
        </>
      ) : null}
    </View>
  );

  const renderSection = (label: string, list: MaintenanceTicket[]) => (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, isRTL && styles.rtl]}>{label}</Text>
      {list.length === 0 ? <Text style={styles.empty}>—</Text> : list.map((tk) => {
        const unit = state.units.find((u) => u.id === tk.unitId);
        return (
          <TechTicketCard
            key={tk.id}
            tk={tk}
            unitNumber={unit?.number}
            note={note[tk.id] ?? ''}
            onNote={(v) => setNote((n) => ({ ...n, [tk.id]: v }))}
            actions={renderActions(tk)}
            isRTL={isRTL}
            t={(k) => t(k as any)}
          />
        );
      })}
    </View>
  );

  return (
    <ScreenScaffold testID="tech-portal">
      <StoryScreenHeader
        question={tech ? tech.name : t('op.tech.title')}
        hint={t('maint.techDashboard' as any)}
        showBack
      />

      {tech ? (
        <ActingAsBadge
          role="tech"
          displayName={tech.name}
          scope={`${t('maint.techJobs' as any)}: ${tech.completedJobs ?? 0} · ${t('maint.techRating' as any)}: ${tech.avgRating ?? '—'}`}
        />
      ) : null}

      {tech ? (
        <GlassCard padding={14} radiusToken="md" edge="gold" style={{ marginBottom: spacing.md }}>
          <Text style={styles.dim}>
            {t('maint.techRating' as any)}: {tech.avgRating ?? '—'} · {t('maint.techJobs' as any)}: {tech.completedJobs ?? 0}
          </Text>
        </GlassCard>
      ) : null}

      {myTickets.length === 0 ? (
        <AliveEmpty title={t('op.tech.title')} body={t('op.tech.noTickets')} />
      ) : (
        <>
          {renderSection(t('opsv2.tech.new' as any), newTasks)}
          {renderSection(t('opsv2.tech.active' as any), activeTasks)}
          {renderSection(t('opsv2.tech.done' as any), doneTasks)}
        </>
      )}
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  section: { marginBottom: spacing.lg },
  sectionTitle: {
    color: colors.textMuted, fontSize: 10, letterSpacing: 1.5,
    textTransform: 'uppercase', marginBottom: spacing.sm,
  },
  empty: { color: colors.textSubtle, fontSize: 12 },
  card: { marginBottom: spacing.md },
  title: { color: colors.text, fontSize: typography.body, fontWeight: typography.weight.semibold },
  dim: { color: colors.textMuted, fontSize: typography.small, marginTop: 4 },
  rtl: { writingDirection: 'rtl', textAlign: 'right' },
  input: {
    marginTop: 10, borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border, padding: 10, color: colors.text, fontSize: typography.small,
  },
  row: { flexDirection: 'row', gap: 8, marginTop: 10, flexWrap: 'wrap' },
  rowRtl: { flexDirection: 'row-reverse' },
  btn: {
    paddingVertical: 8, paddingHorizontal: 10, borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth, borderColor: colors.emeraldEdge,
    backgroundColor: colors.emeraldSoft,
  },
  btnClose: { borderColor: colors.goldEdge, backgroundColor: colors.goldSoft },
  btnText: { color: colors.emerald, fontSize: 11, fontWeight: typography.weight.semibold },
});
