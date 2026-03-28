import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  FlatList,
  Text,
  Animated,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useTheme } from '@/src/theme';
import { useCardStore, useSettingsStore } from '@/src/store';
import { ThemedView, ThemedText, GlowCard, PrimaryButton } from '@/src/components/ui';
import { identifyCard, ClaudeCardResult } from '@/src/api/claude';
import { identifyCardByOcr, OcrCardMatch } from '@/src/api/cardOcr';
import { fetchCardPrice } from '@/src/api/tcg';
import { TradingCard } from '@/src/types/card';
import { formatPrice } from '@/src/utils/pricing';
import 'react-native-get-random-values';
import { v4 as uuidv4 } from 'uuid';

// A unified type so OCR and Claude results share one confirming flow
type CardResult = (ClaudeCardResult | OcrCardMatch) & { source?: string };

type CardScanState = 'history' | 'scanning' | 'ocr-detected' | 'confirming' | 'fetching';
type OcrStatus = 'idle' | 'scanning' | 'detected' | 'failed';

const OCR_INTERVAL_MS = 1500;
const OCR_FAIL_THRESHOLD = 6;
const OCR_MIN_CONFIDENCE = 0.7;

export default function CardsScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanState, setScanState] = useState<CardScanState>('scanning');
  const [ocrStatus, setOcrStatus] = useState<OcrStatus>('idle');
  const [pendingCard, setPendingCard] = useState<{ imageUri: string; result: CardResult } | null>(null);
  const [detectedName, setDetectedName] = useState<string>('');

  const cameraRef = useRef<CameraView>(null);
  const isCameraReady = useRef(false);
  const isOcrRunning = useRef(false);
  const ocrInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  const failCount = useRef(0);
  const frameGlow = useRef(new Animated.Value(0)).current;

  const { claudeApiKey } = useSettingsStore();
  const { cards, addCard, removeCard, toggleFavorite } = useCardStore();

  // ── Animated frame glow ────────────────────────────────────────────────────

  const pulseFrame = useCallback(
    (color: 'scanning' | 'detected' | 'failed') => {
      Animated.sequence([
        Animated.timing(frameGlow, { toValue: 1, duration: 300, useNativeDriver: false }),
        Animated.timing(frameGlow, { toValue: 0, duration: 300, useNativeDriver: false }),
      ]).start();
    },
    [frameGlow],
  );

  const frameBorderColor = frameGlow.interpolate({
    inputRange: [0, 1],
    outputRange: [theme.colors.primary, theme.colors.accent ?? '#00ff88'],
  });

  // ── OCR scanning loop ──────────────────────────────────────────────────────

  const stopOcrLoop = useCallback(() => {
    if (ocrInterval.current) {
      clearInterval(ocrInterval.current);
      ocrInterval.current = null;
    }
  }, []);

  const startOcrLoop = useCallback(() => {
    if (ocrInterval.current) return;
    if (!isCameraReady.current) return;
    failCount.current = 0;
    setOcrStatus('scanning');

    ocrInterval.current = setInterval(async () => {
      if (isOcrRunning.current || !cameraRef.current || !isCameraReady.current) return;
      isOcrRunning.current = true;

      try {
        const photo = await cameraRef.current.takePictureAsync({
          quality: 0.4,
          skipProcessing: true,
        });
        if (!photo?.uri) return;

        const match = await identifyCardByOcr(photo.uri);

        if (match && match.confidence >= OCR_MIN_CONFIDENCE) {
          stopOcrLoop();
          setDetectedName(match.name);
          setPendingCard({ imageUri: photo.uri, result: match });
          setOcrStatus('detected');
          setScanState('ocr-detected');
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          pulseFrame('detected');
        } else {
          failCount.current += 1;
          if (failCount.current >= OCR_FAIL_THRESHOLD) {
            setOcrStatus('failed');
          }
        }
      } catch {
        failCount.current += 1;
      } finally {
        isOcrRunning.current = false;
      }
    }, OCR_INTERVAL_MS);
  }, [stopOcrLoop, pulseFrame]);

  // Start/stop OCR loop with scan state
  useEffect(() => {
    if (scanState === 'scanning' && permission?.granted) {
      setOcrStatus('idle');
      isCameraReady.current = false; // will be set true by onCameraReady
      return () => stopOcrLoop();
    }
    stopOcrLoop();
    return stopOcrLoop;
  }, [scanState, permission?.granted, stopOcrLoop]);

  const handleCameraReady = useCallback(() => {
    isCameraReady.current = true;
    // Give the preview 500ms to fully render before taking the first photo
    setTimeout(startOcrLoop, 500);
  }, [startOcrLoop]);

  // ── Save card ──────────────────────────────────────────────────────────────

  const saveCard = useCallback(
    async (imageUri: string, result: CardResult) => {
      setScanState('fetching');

      const prices = await fetchCardPrice({
        game: result.game,
        name: result.name,
        setCode: result.setCode,
        cardNumber: result.cardNumber,
      });

      const card: TradingCard = {
        id: uuidv4(),
        game: result.game,
        name: result.name,
        setName: result.setName,
        setCode: result.setCode,
        cardNumber: result.cardNumber,
        rarity: result.rarity,
        condition: result.condition as TradingCard['condition'],
        imageUri,
        isFavorite: false,
        scannedAt: new Date().toISOString(),
        prices: prices ?? undefined,
      };

      addCard(card);
      setPendingCard(null);
      setScanState('scanning');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
    [addCard],
  );

  const handleConfirmOcr = useCallback(() => {
    if (!pendingCard) return;
    saveCard(pendingCard.imageUri, pendingCard.result);
  }, [pendingCard, saveCard]);

  const handleSaveCard = useCallback(() => {
    if (!pendingCard) return;
    saveCard(pendingCard.imageUri, pendingCard.result);
  }, [pendingCard, saveCard]);

  // ── Manual capture → Claude fallback ──────────────────────────────────────

  const handleManualCapture = useCallback(async () => {
    if (!claudeApiKey) {
      Alert.alert('Kein API-Key', 'Bitte füge deinen Claude API-Key in den Einstellungen ein.');
      return;
    }
    if (!cameraRef.current) return;

    stopOcrLoop();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);

    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.8 });
      if (!photo?.uri) throw new Error('Kein Foto');

      setScanState('fetching');
      const result = await identifyCard(claudeApiKey, photo.uri);
      setPendingCard({ imageUri: photo.uri, result: { ...result, source: 'claude' } });
      setScanState('confirming');
    } catch {
      setScanState('scanning');
      Alert.alert('Scan fehlgeschlagen', 'Karte konnte nicht erkannt werden.');
    }
  }, [claudeApiKey, stopOcrLoop]);

  // Retry with Claude from ocr-detected state
  const handleClaudeRetry = useCallback(async () => {
    if (!pendingCard) return;
    if (!claudeApiKey) {
      Alert.alert('Kein API-Key', 'Bitte füge deinen Claude API-Key in den Einstellungen ein.');
      return;
    }
    setScanState('fetching');
    try {
      const result = await identifyCard(claudeApiKey, pendingCard.imageUri);
      setPendingCard({ imageUri: pendingCard.imageUri, result: { ...result, source: 'claude' } });
      setScanState('confirming');
    } catch {
      setScanState('scanning');
      Alert.alert('Scan fehlgeschlagen');
    }
  }, [pendingCard, claudeApiKey]);

  // ── Frame status label ─────────────────────────────────────────────────────

  const frameBorderStyle =
    ocrStatus === 'detected'
      ? theme.colors.success ?? '#00ff88'
      : ocrStatus === 'failed'
        ? theme.colors.warning ?? '#ffaa00'
        : theme.colors.primary;

  const ocrStatusText =
    ocrStatus === 'scanning' ? '◉  Scanning...'
    : ocrStatus === 'detected' ? `✓  ${detectedName}`
    : ocrStatus === 'failed' ? '⚠  Karte nicht erkannt — manuell scannen'
    : '';

  // ── Permission ─────────────────────────────────────────────────────────────

  if (!permission?.granted && scanState !== 'history') {
    requestPermission();
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <ThemedView style={styles.container}>

      {/* ── Camera / scanning ── */}
      {(scanState === 'scanning' || scanState === 'ocr-detected') && (
        <View style={{ flex: 1 }}>
          <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} facing="back" onCameraReady={handleCameraReady} />

          {/* Card frame overlay */}
          <View
            style={[
              styles.cardFrame,
              { borderColor: frameBorderStyle },
            ]}
          />

          {/* OCR status pill below frame */}
          {ocrStatusText.length > 0 && (
            <View style={[styles.ocrPill, { top: '63%' }]}>
              <Text style={[
                styles.ocrPillText,
                { color: ocrStatus === 'detected' ? '#00ff88' : ocrStatus === 'failed' ? '#ffaa00' : '#ffffff' },
              ]}>
                {ocrStatusText}
              </Text>
            </View>
          )}

          {/* Header */}
          <View style={[styles.cameraHeader, { paddingTop: insets.top + 12, backgroundColor: 'rgba(0,0,0,0.6)' }]}>
            <TouchableOpacity onPress={() => router.back()} style={styles.headerBackBtn} accessibilityLabel="Zurück">
              <Text style={styles.headerBackText}>← Zurück</Text>
            </TouchableOpacity>
            <View style={styles.headerCenter}>
              <Text style={styles.headerBrandText}>PriceNinja</Text>
              <Text style={styles.headerSubText}>Card Scanner</Text>
            </View>
            <TouchableOpacity onPress={() => setScanState('history')} style={styles.headerRightBtn} accessibilityLabel="Kartenverlauf anzeigen">
              <Text style={styles.headerRightText}>Verlauf</Text>
            </TouchableOpacity>
          </View>

          {/* Bottom: manual capture (fallback) */}
          <View style={[styles.cameraBottom, { paddingBottom: insets.bottom + 32 }]}>
            {/* Tip text */}
            <Text style={styles.scanTip}>
              {ocrStatus === 'failed'
                ? 'Karte in den Rahmen halten oder manuell auslösen'
                : 'Karte in den Rahmen halten — wird automatisch erkannt'}
            </Text>

            {/* Manual shutter (visible but secondary) */}
            <TouchableOpacity
              onPress={handleManualCapture}
              style={[styles.captureBtn, { borderColor: theme.colors.primary, opacity: 0.85 }]}
              accessibilityLabel="Karte manuell fotografieren (Claude)"
            >
              <View style={[styles.captureInner, { backgroundColor: theme.colors.primary }]} />
            </TouchableOpacity>
            <Text style={styles.captureLabel}>Claude</Text>
          </View>
        </View>
      )}

      {/* ── OCR detected: quick confirm ── */}
      {scanState === 'ocr-detected' && pendingCard && (
        <View style={[styles.detectedOverlay, { bottom: insets.bottom + 120, backgroundColor: 'rgba(0,0,0,0.85)' }]}>
          <GlowCard style={{ marginHorizontal: 16 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <Text style={{ fontSize: 18 }}>
                {pendingCard.result.game === 'pokemon' ? '⚡' : pendingCard.result.game === 'yugioh' ? '👁' : '⚔️'}
              </Text>
              <ThemedText weight="bold" size="xl">{pendingCard.result.name}</ThemedText>
            </View>
            <ThemedText variant="secondary">{pendingCard.result.game.toUpperCase()}</ThemedText>
            {pendingCard.result.setName && (
              <ThemedText variant="muted">Set: {pendingCard.result.setName}</ThemedText>
            )}
            {pendingCard.result.cardNumber && (
              <ThemedText variant="muted">Nr: {pendingCard.result.cardNumber}</ThemedText>
            )}
            {'source' in pendingCard.result && pendingCard.result.source === 'ocr+db' && (
              <ThemedText size="sm" style={{ color: '#00ff88', marginTop: 4 }}>✓ Datenbank-Match</ThemedText>
            )}
          </GlowCard>
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 12, paddingHorizontal: 16 }}>
            <PrimaryButton title="✓ Speichern" onPress={handleConfirmOcr} style={{ flex: 2 }} />
            <PrimaryButton
              title="Claude"
              variant="outline"
              onPress={handleClaudeRetry}
              style={{ flex: 1 }}
            />
            <PrimaryButton
              title="✕"
              variant="outline"
              onPress={() => { setPendingCard(null); setScanState('scanning'); }}
              style={{ flex: 1 }}
            />
          </View>
        </View>
      )}

      {/* ── Claude result: full confirm ── */}
      {scanState === 'confirming' && pendingCard && (
        <View style={[styles.overlay, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 20 }]}>
          <GlowCard>
            <ThemedText weight="bold" size="xl">{pendingCard.result.name}</ThemedText>
            <ThemedText variant="secondary">{pendingCard.result.game.toUpperCase()} · Claude</ThemedText>
            {pendingCard.result.setName && <ThemedText variant="muted">Set: {pendingCard.result.setName}</ThemedText>}
            {pendingCard.result.cardNumber && <ThemedText variant="muted">Nr: {pendingCard.result.cardNumber}</ThemedText>}
          </GlowCard>
          <View style={{ flexDirection: 'row', gap: 12, marginTop: 16 }}>
            <PrimaryButton title="Speichern + Preis" onPress={handleSaveCard} style={{ flex: 1 }} />
            <PrimaryButton title="Abbrechen" variant="outline" onPress={() => setScanState('scanning')} style={{ flex: 1 }} />
          </View>
        </View>
      )}

      {/* ── Loading ── */}
      {scanState === 'fetching' && (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 }}>
          <ActivityIndicator color={theme.colors.primary} size="large" />
          <ThemedText variant="secondary">Preis wird abgerufen...</ThemedText>
        </View>
      )}

      {/* ── History ── */}
      {scanState === 'history' && (
        <View style={{ flex: 1 }}>
          <View style={[styles.historyHeader, { paddingTop: insets.top + 12, borderBottomColor: theme.colors.border }]}>
            <TouchableOpacity onPress={() => setScanState('scanning')} style={styles.historyBackBtn} accessibilityLabel="Zurück zum Scanner">
              <Text style={[styles.historyBackText, { color: theme.colors.primary }]}>← Scanner</Text>
            </TouchableOpacity>
            <ThemedText weight="bold" size="xl">Kartenverlauf</ThemedText>
            <View style={{ width: 80 }} />
          </View>

          <FlatList
            data={cards}
            keyExtractor={(c) => c.id}
            renderItem={({ item }) => (
              <GlowCard style={{ marginHorizontal: 16, marginVertical: 6 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <View style={{ flex: 1 }}>
                    <ThemedText weight="semibold">{item.name}</ThemedText>
                    <ThemedText variant="secondary" size="sm">
                      {item.game.toUpperCase()} · {item.setName ?? 'Unbekanntes Set'}
                    </ThemedText>
                    {item.prices?.cardmarketLow && (
                      <ThemedText style={{ color: theme.colors.primary, fontWeight: 'bold' }}>
                        ab {formatPrice(item.prices.cardmarketLow)}
                      </ThemedText>
                    )}
                  </View>
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <TouchableOpacity
                      onPress={() => toggleFavorite(item.id)}
                      accessibilityLabel={item.isFavorite ? 'Von Favoriten entfernen' : 'Zu Favoriten hinzufügen'}
                    >
                      <Text style={{ fontSize: 24 }}>{item.isFavorite ? '⭐' : '☆'}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => removeCard(item.id)} accessibilityLabel="Karte löschen">
                      <Text style={{ fontSize: 24 }}>🗑️</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </GlowCard>
            )}
            ListEmptyComponent={
              <View style={{ alignItems: 'center', paddingVertical: 60 }}>
                <Text style={{ fontSize: 64 }}>♦</Text>
                <ThemedText weight="bold" size="xl" style={{ marginTop: 16 }}>Keine Karten</ThemedText>
                <ThemedText variant="secondary" style={{ textAlign: 'center' }}>Scanne deine erste Karte</ThemedText>
              </View>
            }
            showsVerticalScrollIndicator={false}
          />

          <TouchableOpacity
            onPress={() => setScanState('scanning')}
            style={[styles.fab, { backgroundColor: theme.colors.primary, bottom: insets.bottom + 24 }]}
            accessibilityLabel="Neue Karte scannen"
          >
            <Text style={[styles.fabText, { color: theme.colors.background }]}>＋ Scannen</Text>
          </TouchableOpacity>
        </View>
      )}

    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  // Camera header
  cameraHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 16,
    paddingBottom: 12,
    zIndex: 10,
  },
  headerBackBtn: { width: 80, alignItems: 'flex-start' },
  headerBackText: { color: 'white', fontSize: 15, fontWeight: '500' },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerBrandText: { color: '#00ff88', fontWeight: 'bold', fontSize: 20 },
  headerSubText: { color: 'white', fontSize: 12, letterSpacing: 1 },
  headerRightBtn: { width: 80, alignItems: 'flex-end' },
  headerRightText: { color: 'white', fontSize: 15, fontWeight: '500' },
  // Card frame
  cardFrame: {
    position: 'absolute',
    top: '20%',
    left: '10%',
    right: '10%',
    aspectRatio: 0.716,
    borderWidth: 2,
    borderRadius: 8,
  },
  // OCR pill
  ocrPill: {
    position: 'absolute',
    left: '10%',
    right: '10%',
    alignItems: 'center',
  },
  ocrPillText: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.5,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    overflow: 'hidden',
  },
  // Capture
  cameraBottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    gap: 8,
  },
  scanTip: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 4,
  },
  captureBtn: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  captureInner: { width: 48, height: 48, borderRadius: 24 },
  captureLabel: { color: 'rgba(255,255,255,0.5)', fontSize: 11 },
  // OCR detected overlay (floats above camera)
  detectedOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 20,
  },
  // Claude confirming
  overlay: { flex: 1, padding: 20, gap: 16 },
  // History
  historyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  historyBackBtn: { width: 80 },
  historyBackText: { fontSize: 15, fontWeight: '600' },
  // FAB
  fab: {
    position: 'absolute',
    right: 24,
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 32,
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  fabText: { fontWeight: 'bold', fontSize: 15 },
});
