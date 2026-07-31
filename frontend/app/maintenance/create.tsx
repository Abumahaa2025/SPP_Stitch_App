import React, { useState } from 'react';
import { useRouter, useLocalSearchParams } from 'expo-router';
import * as Haptics from 'expo-haptics';

import { ScreenScaffold } from '@/src/components/ScreenScaffold';
import { StoryScreenHeader } from '@/src/components/StoryScreenHeader';
import { MaintenanceJourney } from '@/src/components/maintenance/MaintenanceJourney';
import { PhaseSaveResult } from '@/src/components/PhaseSaveResult';
import { AliveEmpty } from '@/src/components/AliveEmpty';
import { usePropertyOS } from '@/src/hooks/usePropertyOS';
import { useOperational } from '@/src/hooks/useOperational';
import { useTechnicians } from '@/src/hooks/useTechnicians';
import { useNotificationPrefs } from '@/src/hooks/usePreferences';
import { useI18n } from '@/src/i18n';

export default function MaintenanceCreateScreen() {
  const { t } = useI18n();
  const router = useRouter();
  const params = useLocalSearchParams<{ unitId?: string }>();
  const { countEnabled } = useNotificationPrefs();
  const { state } = usePropertyOS(countEnabled);
  const { openTicket } = useOperational();
  const { technicians, create } = useTechnicians();
  const [done, setDone] = useState(false);
  const [ticketId, setTicketId] = useState<string | null>(null);
  const [ticketTitle, setTicketTitle] = useState('');

  const unit = params.unitId
    ? state.units.find((u) => u.id === params.unitId)
    : state.units[0];

  if (!unit) {
    return (
      <ScreenScaffold testID="maintenance-create">
        <StoryScreenHeader question={t('opsv2.maint.new' as any)} showBack />
        <AliveEmpty
          title={t('journey.block.noUnitMaint.title' as any)}
          body={t('journey.block.noUnitMaint.body' as any)}
          nextHint={t('pos.progress.nextLine' as any).replace('{next}', t('pos.phase.units' as any))}
          actionLabel={t('journey.block.noUnitMaint.action' as any)}
          onAction={() => router.push('/setup/property-os?phase=units' as any)}
        />
      </ScreenScaffold>
    );
  }

  if (done && ticketId) {
    return (
      <ScreenScaffold testID="maintenance-create-done">
        <StoryScreenHeader question={t('opsv2.maint.step.tracking' as any)} showBack />
        <PhaseSaveResult
          rows={[
            { label: t('opsv2.maint.step.create' as any), value: ticketTitle },
            { label: t('op.tenant.unit'), value: unit.number },
            { label: t('opsv2.maint.step.tracking' as any), value: ticketId },
          ]}
          nextHint={t('opsv2.maint.step.tracking' as any)}
          actions={[
            { label: t('maint.detail' as any), onPress: () => router.replace(`/maintenance/${ticketId}` as any), primary: true },
            { label: t('result.viewManage' as any), onPress: () => router.push('/maintenance' as any) },
            { label: t('result.goHome' as any), onPress: () => router.replace('/') },
          ]}
        />
      </ScreenScaffold>
    );
  }

  return (
    <ScreenScaffold testID="maintenance-create">
      <StoryScreenHeader
        question={t('opsv2.maint.new' as any)}
        hint={t('opsv2.maintenance.hint' as any)}
        showBack
      />
      <MaintenanceJourney
        unitId={unit.id}
        unitLabel={`${t('op.tenant.unit')} ${unit.number}`}
        technicianList={technicians}
        onCreateTechnician={create}
        onSubmit={async (data) => {
          const ticket = await openTicket(unit.id, data.title, undefined, data.description, unit.number, {
            category: data.category,
            priority: data.priority,
            technicianId: data.technicianId,
            technicianName: data.technicianName,
            media: data.media,
          });
          setTicketTitle(data.title);
          setTicketId(ticket.id);
          setDone(true);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }}
        onCancel={() => router.back()}
      />
    </ScreenScaffold>
  );
}
