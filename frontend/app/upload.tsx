import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, Pressable, Platform, ActivityIndicator, AppState,
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useRouter, useFocusEffect } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Feather } from '@expo/vector-icons';
import * as SppFileImport from 'spp-file-import';

import { ScreenScaffold } from '@/src/components/ScreenScaffold';
import { StoryScreenHeader } from '@/src/components/StoryScreenHeader';
import { GlassCard } from '@/src/components/GlassCard';
import { UploadMagic, UploadFoundHeader } from '@/src/components/UploadMagic';
import { UploadResultCard, type UploadResult } from '@/src/components/UploadResultCard';
import { GuidedSetup } from '@/src/components/GuidedSetup';
import { colors, spacing, typography, radius } from '@/src/theme';
import { useI18n } from '@/src/i18n';
import { analyzePickedFiles, buildUploadFileMeta, buildFilePreview, previewWithMapping, type FilePreview } from '@/src/utils/upload-analyze';
import { buildResultsFromParsedData, parsedToFileMeta, type ParsedFileData } from '@/src/utils/upload-parse';
import { OperationHint } from '@/src/components/OperationHint';
import { JourneyGuide } from '@/src/components/JourneyGuide';
import {
  fetchPortfolioAnalysis,
  type PortfolioAnalysis,
  type UploadFileMeta,
} from '@/src/api/portfolio-analysis';
import { UploadFilePreview } from '@/src/components/UploadFilePreview';
import { UploadResultsWizard } from '@/src/components/UploadResultsWizard';
import { PhaseSaveResult } from '@/src/components/PhaseSaveResult';
import { storage } from '@/src/utils/storage';
import { UX_BUILD_STAMP } from '@/src/constants/build';
import { apiUrl } from '@/src/constants/backend';
import {
  consumeSharedFiles,
  onSharedFilesStashed,
  type IncomingPickedFile,
} from '@/src/utils/upload-pick';

type Picked = IncomingPickedFile;

const MAGIC_PHASE_MS = 520;

export default function UploadScreen() {
  const { t, lang } = useI18n();
  const router = useRouter();
  const [files, setFiles] = useState<Picked[]>([]);
  const [results, setResults] = useState<UploadResult[]>([]);
  const [portfolioAnalysis, setPortfolioAnalysis] = useState<PortfolioAnalysis | null>(null);
  const [analysisSource, setAnalysisSource] = useState<'render' | 'fallback' | null>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [step, setStep] = useState(1);
  const [busy, setBusy] = useState(false);
  const [picking, setPicking] = useState(false);
  const [preview, setPreview] = useState<FilePreview | null>(null);
  const [importFailed, setImportFailed] = useState(false);
  const [previewReady, setPreviewReady] = useState(false);
  const [pickError, setPickError] = useState<string | null>(null);
  const [lastFileMeta, setLastFileMeta] = useState<UploadFileMeta[]>([]);
  const [applyDone, setApplyDone] = useState(false);
  const [appList, setAppList] = useState<Array<{
    packageName: string;
    activityName?: string | null;
    label: string;
    kind: string;
  }>>([]);
  const [showAppList, setShowAppList] = useState(false);
  const [nativeOk, setNativeOk] = useState(false);
  const [nativeId, setNativeId] = useState<string | null>(null);
  const [waHint, setWaHint] = useState(false);

  // Warm up Render (free tier sleeps) so analysis doesn't eat the cold start.
  // Fire-and-forget: never blocks the screen, never surfaces an error.
  useEffect(() => {
    fetch(apiUrl('/')).catch(() => {});
  }, []);

  useEffect(() => {
    const ok = Platform.OS === 'android' && SppFileImport.isAvailable();
    setNativeOk(ok);
    setNativeId(ok ? SppFileImport.nativeBuildId() : null);
  }, []);

  const ingestFiles = useCallback(async (next: Picked[]) => {
    if (!next.length) return;
    setFiles((prev) => [...prev, ...next]);
    setResults([]);
    setPortfolioAnalysis(null);
    setApplyDone(false);
    setAnalysisSource(null);
    setAnalysisError(null);
    setStep(1);
    setPreview(null);
    setPreviewReady(true);
    setImportFailed(false);
    setPickError(null);
    setShowAppList(false);
    setWaHint(false);
    try {
      const pre = await buildFilePreview(next[0]);
      setPreview(pre);
    } catch {
      setPreview(null);
    }
  }, []);

  const applyNativeResult = useCallback(async (res: {
    canceled: boolean;
    assets: Array<{ name: string; uri: string; mimeType?: string; size?: number }> | null;
    openedWhatsApp?: boolean;
  } | null) => {
    if (!res) return;
    if (res.openedWhatsApp) {
      setWaHint(true);
      return;
    }
    if (res.canceled || !res.assets?.length) return;
    await ingestFiles(res.assets.map((a) => ({
      name: a.name,
      mimeType: a.mimeType,
      size: a.size,
      uri: a.uri,
    })));
  }, [ingestFiles]);

  // Drain files shared from WhatsApp/Files → SPP (MainActivity writes pending JSON).
  const pullShared = useCallback(async () => {
    const shared = await consumeSharedFiles();
    if (shared.length) {
      await ingestFiles(shared);
      return;
    }
    if (Platform.OS === 'android' && SppFileImport.isAvailable()) {
      try {
        const pending = await SppFileImport.takePendingShare();
        await applyNativeResult(pending as any);
      } catch {
        /* ignore */
      }
    }
  }, [ingestFiles, applyNativeResult]);

  useFocusEffect(
    useCallback(() => {
      pullShared();
    }, [pullShared]),
  );

  useEffect(() => onSharedFilesStashed(() => { pullShared(); }), [pullShared]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') pullShared();
    });
    return () => sub.remove();
  }, [pullShared]);

  const requireNative = useCallback(() => {
    if (Platform.OS !== 'android' || !SppFileImport.isAvailable()) {
      setPickError(t('upload.pickNativeMissing' as any));
      return false;
    }
    return true;
  }, [t]);

  const openWhatsApp = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setPickError(null);
    if (!requireNative()) return;
    try {
      const res = await SppFileImport.openWhatsApp();
      if (!res?.ok) {
        setPickError(t('upload.whatsappMissing' as any));
        return;
      }
      setWaHint(true);
    } catch {
      setPickError(t('upload.pickError' as any));
    }
  }, [t, requireNative]);

  const pickFromStorage = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setPickError(null);
    setPicking(true);
    setShowAppList(false);
    try {
      if (!requireNative()) return;
      const res = await SppFileImport.pickFromStorage({ multiple: true, mimeType: '*/*' });
      await applyNativeResult(res as any);
    } catch {
      setPickError(t('upload.pickError' as any));
    } finally {
      setPicking(false);
    }
  }, [t, requireNative, applyNativeResult]);

  const openAppList = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setPickError(null);
    if (!requireNative()) return;
    setPicking(true);
    try {
      const list = await SppFileImport.listImportApps();
      setAppList(Array.isArray(list) ? list : []);
      setShowAppList(true);
    } catch {
      setPickError(t('upload.pickError' as any));
    } finally {
      setPicking(false);
    }
  }, [t, requireNative]);

  const pickFromListedApp = useCallback(async (app: {
    packageName: string;
    activityName?: string | null;
    kind: string;
  }) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setPickError(null);
    setPicking(true);
    try {
      if (!requireNative()) return;
      const res = await SppFileImport.pickFromApp(
        app.packageName,
        app.activityName ?? null,
        app.kind,
      );
      await applyNativeResult(res as any);
    } catch {
      setPickError(t('upload.pickError' as any));
    } finally {
      setPicking(false);
    }
  }, [t, requireNative, applyNativeResult]);

  // Keep alias used by retry buttons.
  const pickFiles = openAppList;

  const removeFile = (name: string) => {
    Haptics.selectionAsync();
    setFiles((prev) => {
      const next = prev.filter((f) => f.name !== name);
      if (!next.length) setStep(1);
      return next;
    });
    setResults([]);
    setPortfolioAnalysis(null);
    setApplyDone(false);
    setAnalysisSource(null);
    setAnalysisError(null);
    setPreview(null);
    setPreviewReady(false);
    setImportFailed(false);
  };

  const runAnalysis = async () => {
    if (!files.length || busy) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setBusy(true);
    setImportFailed(false);
    setResults([]);
    setPortfolioAnalysis(null);
    setApplyDone(false);
    setAnalysisSource(null);
    setAnalysisError(null);
    setStep(2);
    try {
      for (let s = 2; s <= 6; s++) {
        setStep(s);
        await new Promise((r) => setTimeout(r, MAGIC_PHASE_MS));
      }

      let analyzed: UploadResult[] = [];
      let fileMeta = await buildUploadFileMeta(files);
      const hasContent = fileMeta.some((f) => (f.textSnippet?.length ?? 0) > 10);

      if (preview && preview.parseable) {
        const parsed: ParsedFileData = {
          fileName: preview.fileName,
          columns: preview.columns,
          rows: preview.allRows,
          rowCount: preview.rowCount,
          mapping: preview.mapping,
          mappedFields: preview.columns.map((c) => preview.mapping[c] ?? 'skip'),
        };
        analyzed = buildResultsFromParsedData(parsed, lang);
        const restMeta = fileMeta.slice(1);
        fileMeta = [parsedToFileMeta(parsed, files[0]), ...restMeta];
      }

      if (!hasContent) {
        setImportFailed(true);
        setStep(1);
        return;
      }

      let portfolio: PortfolioAnalysis | null = null;
      let source: 'render' | 'fallback' | null = null;

      try {
        portfolio = await fetchPortfolioAnalysis(fileMeta);
        source = 'render';
        setAnalysisError(null);
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'analysis failed';
        setAnalysisError(msg);
        source = 'fallback';
      }

      if (!analyzed.length) {
        analyzed = await analyzePickedFiles(files, lang);
      }

      setAnalysisSource(source);
      setResults(analyzed);
      setLastFileMeta(fileMeta);
      if (portfolio) {
        setPortfolioAnalysis(portfolio);
        await storage.setItem('spp.lastPortfolioAnalysis', JSON.stringify(portfolio));
      }
      setStep(7);
    } catch {
      setImportFailed(true);
      setStep(1);
    } finally {
      setBusy(false);
    }
  };

  const onMappingChange = (mapping: FilePreview['mapping']) => {
    if (!preview) return;
    setPreview(previewWithMapping(preview, mapping));
  };

  const resetUpload = () => {
    setFiles([]);
    setResults([]);
    setPortfolioAnalysis(null);
    setApplyDone(false);
    setAnalysisSource(null);
    setAnalysisError(null);
    setStep(1);
    setPreview(null);
    setPreviewReady(false);
    setImportFailed(false);
    setPickError(null);
  };

  return (
    <ScreenScaffold testID="upload-screen">
      <StoryScreenHeader
        question={t('page.q.upload')}
        hint={t('upload.sub')}
        testID="upload-header"
      />

      <View style={styles.buildBar} testID="upload-build-stamp">
        <Text style={styles.buildStamp}>v1.0.33 · {UX_BUILD_STAMP}</Text>
        <Text style={styles.apiHint} numberOfLines={2}>
          package ai.spp.stitch · native {nativeOk ? `OK (${nativeId || 'ready'})` : 'MISSING — reinstall APK'}
        </Text>
      </View>

      {!busy && !results.length && files.length === 0 && !previewReady ? (
        <Animated.View entering={FadeInDown.duration(350)} style={{ marginTop: spacing.md }}>
          <GlassCard padding={16} radiusToken="lg" edge="gold">
            <Text style={styles.sourceSheetTitle}>{t('upload.source.title' as any)}</Text>
            <Pressable style={styles.sourceRow} onPress={openWhatsApp} testID="upload-source-whatsapp">
              <Feather name="message-circle" size={20} color={colors.gold} />
              <View style={{ flex: 1 }}>
                <Text style={styles.sourceRowTitle}>{t('upload.source.whatsapp' as any)}</Text>
                <Text style={styles.sourceRowSub}>{t('upload.source.whatsappSub' as any)}</Text>
              </View>
            </Pressable>
            <Pressable style={styles.sourceRow} onPress={openAppList} testID="upload-source-apps">
              <Feather name="grid" size={20} color={colors.gold} />
              <View style={{ flex: 1 }}>
                <Text style={styles.sourceRowTitle}>{t('upload.source.apps' as any)}</Text>
                <Text style={styles.sourceRowSub}>{t('upload.source.appsSub' as any)}</Text>
              </View>
            </Pressable>
            <Pressable style={styles.sourceRow} onPress={pickFromStorage} testID="upload-source-storage">
              <Feather name="folder" size={20} color={colors.gold} />
              <View style={{ flex: 1 }}>
                <Text style={styles.sourceRowTitle}>{t('upload.source.storage' as any)}</Text>
                <Text style={styles.sourceRowSub}>{t('upload.source.storageSub' as any)}</Text>
              </View>
            </Pressable>
            {waHint ? (
              <Text style={styles.waHint}>{t('upload.whatsappHint' as any)}</Text>
            ) : null}
          </GlassCard>
        </Animated.View>
      ) : null}

      {showAppList && !busy && !results.length ? (
        <Animated.View entering={FadeInDown.duration(280)} style={{ marginTop: spacing.md }}>
          <GlassCard padding={16} radiusToken="lg">
            <Text style={styles.sourceSheetTitle}>{t('upload.source.appsTitle' as any)}</Text>
            {appList.length === 0 ? (
              <Text style={styles.failBody}>{t('upload.pickError' as any)}</Text>
            ) : (
              appList.slice(0, 30).map((app) => (
                <Pressable
                  key={`${app.packageName}:${app.activityName || ''}:${app.kind}`}
                  style={styles.sourceRow}
                  onPress={() => pickFromListedApp(app)}
                >
                  <Feather
                    name={app.kind === 'whatsapp' ? 'message-circle' : app.kind === 'storage' ? 'folder' : 'box'}
                    size={18}
                    color={colors.gold}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.sourceRowTitle}>{app.label}</Text>
                    <Text style={styles.sourceRowSub}>{app.packageName}</Text>
                  </View>
                </Pressable>
              ))
            )}
            <Pressable style={styles.sourceCancel} onPress={() => setShowAppList(false)}>
              <Text style={styles.secondaryText}>{t('upload.source.cancel' as any)}</Text>
            </Pressable>
          </GlassCard>
        </Animated.View>
      ) : null}

      {analysisSource ? (
        <View style={[styles.sourceBadge, analysisSource === 'render' ? styles.sourceRender : styles.sourceFallback]}>
          <Text style={styles.sourceText}>
            {analysisSource === 'render' ? t('upload.source.render') : t('upload.source.fallback')}
          </Text>
        </View>
      ) : null}
      {analysisError && analysisSource === 'fallback' ? (
        <Text style={styles.errorHint} numberOfLines={2}>{analysisError}</Text>
      ) : null}

      <GuidedSetup flowId="pdf" defaultOpen={files.length === 0} testID="upload-guided" />

      <View style={{ marginTop: spacing.md }}>
        <JourneyGuide
          where={t('page.q.upload')}
          now={t('upload.sub')}
          benefit={t('journey.upload.explain.review' as any)}
          next={t('journey.upload.doneNext' as any)}
          testID="upload-journey-guide"
        />
      </View>

      <View style={{ marginTop: spacing.sm }}>
        <OperationHint feature="import" />
      </View>

      {pickError ? (
        <Animated.View entering={FadeInDown.duration(400)} style={{ marginTop: spacing.md }}>
          <GlassCard padding={16} radiusToken="md" edge="gold">
            <Text style={styles.failBody}>{pickError}</Text>
            <Pressable style={[styles.primaryBtn, { marginTop: spacing.sm }]} onPress={pickFiles}>
              <Text style={styles.primaryText}>{t('journey.upload.failRetry')}</Text>
            </Pressable>
          </GlassCard>
        </Animated.View>
      ) : null}

      {picking ? (
        <View style={styles.pickingRow}>
          <ActivityIndicator color={colors.gold} />
          <Text style={styles.pickingText}>{t('upload.picking' as any)}</Text>
        </View>
      ) : null}

      {files.length > 0 && !busy && !results.length ? (
        <Animated.View entering={FadeInDown.duration(400)} style={styles.fileBlock}>
          <Text style={styles.fileBlockTitle}>{t('upload.selectedFiles')}</Text>
          {files.map((f) => (
            <View key={f.name} style={styles.fileRow}>
              <Feather name="file" size={16} color={colors.gold} />
              <View style={{ flex: 1 }}>
                <Text style={styles.fileName} numberOfLines={2}>{f.name}</Text>
                {f.size ? (
                  <Text style={styles.fileSize}>
                    {t('upload.fileSize' as any)}: {Math.round(f.size / 1024)} KB
                  </Text>
                ) : null}
              </View>
              <Pressable onPress={() => removeFile(f.name)} hitSlop={8}>
                <Feather name="x" size={16} color={colors.textMuted} />
              </Pressable>
            </View>
          ))}
          <Pressable style={styles.addMoreBtn} onPress={pickFiles} disabled={picking}>
            <Feather name="plus" size={14} color={colors.gold} />
            <Text style={styles.addMoreText}>{t('upload.addMore')}</Text>
          </Pressable>
        </Animated.View>
      ) : null}

      {importFailed ? (
        <Animated.View entering={FadeInDown.duration(500)} style={{ marginTop: spacing.lg }}>
          <GlassCard padding={20} radiusToken="lg" edge="gold">
            <Text style={styles.failTitle}>{t('journey.upload.failTitle')}</Text>
            <Text style={styles.failBody}>{t('journey.upload.failBody')}</Text>
            <View style={styles.actions}>
              <Pressable
                style={styles.secondaryBtn}
                onPress={() => { setImportFailed(false); setFiles([]); setPreview(null); setPreviewReady(false); }}
              >
                <Text style={styles.secondaryText}>{t('journey.upload.failRetry')}</Text>
              </Pressable>
              <Pressable style={styles.primaryBtn} onPress={pickFiles}>
                <Text style={styles.primaryText}>{t('journey.upload.failMatch')}</Text>
              </Pressable>
            </View>
          </GlassCard>
        </Animated.View>
      ) : null}

      {!busy && !results.length && previewReady && preview && !importFailed ? (
        <View style={{ marginTop: spacing.lg }}>
          <UploadFilePreview
            preview={preview}
            onConfirm={runAnalysis}
            onCancel={() => { setFiles([]); setPreview(null); setPreviewReady(false); }}
            onMappingChange={onMappingChange}
          />
        </View>
      ) : null}

      {!busy && !results.length && previewReady && !preview && files.length > 0 && !importFailed ? (
        <Animated.View entering={FadeInDown.duration(500)} style={{ marginTop: spacing.lg }}>
          <GlassCard padding={20} radiusToken="lg">
            <Text style={styles.failBody}>{t('journey.upload.noPreview')}</Text>
            <View style={[styles.actions, { marginTop: spacing.md }]}>
              <Pressable style={styles.secondaryBtn} onPress={() => { setFiles([]); setPreviewReady(false); }}>
                <Text style={styles.secondaryText}>{t('journey.upload.confirmNo')}</Text>
              </Pressable>
              <Pressable style={styles.primaryBtn} onPress={runAnalysis}>
                <Text style={styles.primaryText}>{t('journey.upload.confirmYes')}</Text>
              </Pressable>
            </View>
          </GlassCard>
        </Animated.View>
      ) : null}

      {busy || results.length > 0 ? (
        <UploadMagic step={step} done={results.length > 0} />
      ) : null}

      {results.length > 0 ? (
        <Animated.View entering={FadeInDown.duration(600)}>
          <UploadFoundHeader />
          {portfolioAnalysis && analysisSource === 'render' ? (
            <UploadResultsWizard
              analysis={portfolioAnalysis}
              fileMeta={lastFileMeta}
              lang={lang}
              applied={applyDone}
              onApplied={() => setApplyDone(true)}
              onReset={resetUpload}
            />
          ) : null}
          {/* Heuristic local cards — hide when live engine analysis is on screen (proof clarity). */}
          {analysisSource !== 'render' ? (
            <View style={{ gap: spacing.lg, marginTop: spacing.lg }}>
              {results.map((r, i) => (
                <Animated.View key={r.id} entering={FadeInDown.duration(500).delay(120 + i * 100)}>
                  <UploadResultCard
                    result={r}
                    testID={`upload-result-${r.id}`}
                    onApprove={() => router.push('/portfolio')}
                    onAsk={() => router.push({ pathname: '/brain', params: { q: r.summary } } as any)}
                  />
                </Animated.View>
              ))}
              <View style={{ marginTop: spacing.xl }}>
                <PhaseSaveResult
                  rows={[
                    { label: t('upload.selectedFiles'), value: files.map((f) => f.name).join(' · ') || '—' },
                    {
                      label: t('upload.reportTitle'),
                      value: `${results.length}`,
                    },
                  ]}
                  nextHint={t('upload.doneActions' as any)}
                  actions={[
                    { label: t('upload.viewPortfolio' as any), onPress: () => router.push('/portfolio' as any), primary: true },
                    { label: t('upload.uploadMore' as any), onPress: resetUpload },
                    { label: t('result.goHome' as any), onPress: () => router.replace('/') },
                  ]}
                  testID="upload-done-actions"
                />
              </View>
            </View>
          ) : null}
        </Animated.View>
      ) : null}
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  dropZone: {
    marginTop: spacing.xl, borderRadius: radius.lg,
    borderWidth: 1.5, borderColor: colors.goldEdge, borderStyle: 'dashed',
    backgroundColor: colors.goldSoft,
  },
  dropInner: { alignItems: 'center', paddingVertical: 40, paddingHorizontal: spacing.lg, gap: 14 },
  dropTitle: { color: colors.text, fontSize: 22, fontWeight: typography.weight.semibold, textAlign: 'center' },
  pickHint: {
    color: colors.textDim,
    fontSize: 13,
    lineHeight: 20,
    textAlign: 'center',
    paddingHorizontal: spacing.sm,
  },
  shareHint: {
    color: colors.gold,
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
    paddingHorizontal: spacing.sm,
  },
  sourceSheetTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: typography.weight.semibold,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  sourceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  sourceRowTitle: { color: colors.text, fontSize: 15, fontWeight: typography.weight.medium },
  sourceRowSub: { color: colors.textMuted, fontSize: 12, marginTop: 2, lineHeight: 16 },
  sourceCancel: {
    marginTop: spacing.sm,
    paddingVertical: 12,
    alignItems: 'center',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  waHint: {
    marginTop: spacing.sm,
    color: colors.gold,
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8, marginTop: spacing.sm },
  chip: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  chipText: { color: colors.textDim, fontSize: 11 },
  fileBlock: {
    marginTop: spacing.xl, padding: spacing.lg, borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border,
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  fileBlockTitle: { color: colors.text, fontSize: 14, fontWeight: typography.weight.semibold, marginBottom: 8 },
  fileRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12 },
  fileSize: { color: colors.textMuted, fontSize: 11, marginTop: 2 },
  pickingRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: spacing.lg },
  pickingText: { color: colors.textDim, fontSize: 13 },
  addMoreBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: spacing.sm, alignSelf: 'flex-start' },
  addMoreText: { color: colors.gold, fontSize: 12, fontWeight: typography.weight.medium },
  fileName: { flex: 1, color: colors.text, fontSize: 14 },
  actions: { flexDirection: 'row', gap: 10, marginTop: spacing.md },
  secondaryBtn: {
    flex: 1, paddingVertical: 14, borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, alignItems: 'center',
  },
  secondaryText: { color: colors.textDim, fontSize: 13, fontWeight: typography.weight.medium },
  primaryBtn: {
    flex: 2, flexDirection: 'row', gap: 8, paddingVertical: 14, borderRadius: radius.pill,
    backgroundColor: colors.gold, alignItems: 'center', justifyContent: 'center',
  },
  primaryText: { color: colors.bg, fontSize: 14, fontWeight: typography.weight.semibold },
  buildBar: {
    marginTop: spacing.sm,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.goldEdge,
    backgroundColor: colors.goldSoft,
  },
  buildStamp: {
    color: colors.gold,
    fontSize: 11,
    fontWeight: typography.weight.semibold,
    letterSpacing: 0.4,
    fontVariant: ['tabular-nums'],
  },
  apiHint: { color: colors.textSubtle, fontSize: 9, marginTop: 4, letterSpacing: 0.2 },
  sourceBadge: {
    alignSelf: 'flex-start',
    marginTop: spacing.sm,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },
  sourceRender: { backgroundColor: colors.emeraldSoft, borderColor: colors.emeraldEdge },
  sourceFallback: { backgroundColor: colors.goldSoft, borderColor: colors.goldEdge },
  sourceText: { fontSize: 10, fontWeight: typography.weight.medium, color: colors.text },
  errorHint: { color: colors.textMuted, fontSize: 10, marginTop: 6, lineHeight: 14 },
  failTitle: { color: colors.text, fontSize: 17, fontWeight: typography.weight.semibold, marginBottom: 8 },
  failBody: { color: colors.textDim, fontSize: 14, lineHeight: 22 },
});
