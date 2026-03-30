import React, { useState, useRef, useCallback } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  FlatList,
  Text,
  Animated,
  Image,
  Linking,
  ScrollView,
  Modal,
  Dimensions,
} from 'react-native';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/src/theme';
import { useCardStore, useSettingsStore } from '@/src/store';
import { ThemedView, ThemedText, GlowCard, PrimaryButton } from '@/src/components/ui';
import { identifyCard, ClaudeCardResult } from '@/src/api/claude';
import { fetchCardPrice } from '@/src/api/tcg';
import { TradingCard } from '@/src/types/card';
import { formatPrice } from '@/src/utils/pricing';
import { CARD_SCAN_RATE_LIMIT } from '@/src/utils/constants';
import 'react-native-get-random-values';
import { v4 as uuidv4 } from 'uuid';

type CardResult = ClaudeCardResult & { source?: string };

// What the scanner is currently doing
type ScanPhase =
  | 'ready'       // Waiting — show "Tippe zum Scannen"
  | 'capturing'   // Taking photo
  | 'processing'  // Claude is analyzing
  | 'confirming'  // Claude result — confirm
  | 'fetching'    // Fetching prices
  | 'history';    // History view

export default function CardsScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const [permission, requestPermission] = useCameraPermissions();
  const [phase, setPhase] = useState<ScanPhase>('ready');
  const [pendingCard, setPendingCard] = useState<{ imageUri: string; result: CardResult; prices?: Awaited<ReturnType<typeof fetchCardPrice>> } | null>(null);

  const cameraRef = useRef<CameraView>(null);
  const isCameraReady = useRef(false);
  const isCapturing = useRef(false); // guard against double-tap
  const tapAnim = useRef(new Animated.Value(1)).current;

  const { claudeApiKey, pokemonTcgApiKey, incrementCardScanCount, scanStats } = useSettingsStore();
  const canScan = scanStats.cardScansToday < CARD_SCAN_RATE_LIMIT;
  const { cards, addCard, removeCard, toggleFavorite } = useCardStore();
  const [selectedCard, setSelectedCard] = useState<TradingCard | null>(null);

  // Stop any active work when tab loses focus
  useFocusEffect(
    useCallback(() => {
      isCapturing.current = false;
      return () => {
        isCameraReady.current = false;
        isCapturing.current = false;
      };
    }, []),
  );

  const handleCameraReady = useCallback(() => {
    isCameraReady.current = true;
  }, []);

  // ── Tap-to-scan: photo → Claude directly ─────────────────────────────────

  const handleFrameTap = useCallback(async () => {
    if (isCapturing.current || !isCameraReady.current || !cameraRef.current) return;
    if (phase !== 'ready') return;

    if (!canScan) {
      Alert.alert('Limit erreicht', `Maximal ${CARD_SCAN_RATE_LIMIT} Karten-Scans heute. Starte die App neu um weiterzumachen.`);
      return;
    }
    if (!claudeApiKey) {
      Alert.alert('Kein API-Key', 'Bitte füge deinen Claude API-Key in den Einstellungen ein.');
      return;
    }

    isCapturing.current = true;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    Animated.sequence([
      Animated.timing(tapAnim, { toValue: 0.6, duration: 80, useNativeDriver: true }),
      Animated.timing(tapAnim, { toValue: 1, duration: 180, useNativeDriver: true }),
    ]).start();

    setPhase('capturing');

    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.8, skipProcessing: true, shutterSound: false });
      if (!photo?.uri) throw new Error('no photo');

      setPhase('processing');

      // Crop to card frame: 8% horizontal padding, card aspect ratio 0.716, vertically centered
      const { width: sw, height: sh } = Dimensions.get('window');
      const scale = Math.max(photo.width / sw, photo.height / sh);
      const ox = (photo.width - sw * scale) / 2;
      const oy = (photo.height - sh * scale) / 2;
      const frameW = sw * 0.84;
      const frameH = frameW / 0.716;
      const availH = sh - (insets.top + 60) - (insets.bottom + 80);
      const frameTop = insets.top + 60 + Math.max(0, (availH - frameH) / 2);
      const cropX = Math.max(0, Math.round(ox + 0.08 * sw * scale));
      const cropY = Math.max(0, Math.round(oy + frameTop * scale));
      const cropW = Math.min(photo.width - cropX, Math.round(frameW * scale));
      const cropH = Math.min(photo.height - cropY, Math.round(frameH * scale));
      const cropped = await manipulateAsync(
        photo.uri,
        [{ crop: { originX: cropX, originY: cropY, width: cropW, height: cropH } }],
        { compress: 0.85, format: SaveFormat.JPEG },
      );

      const result = await identifyCard(claudeApiKey, cropped.uri);
      // Auto-fetch prices immediately after recognition
      const prices = await fetchCardPrice(
        { game: result.game, name: result.name, setCode: result.setCode, cardNumber: result.cardNumber },
        pokemonTcgApiKey || undefined,
      );
      setPendingCard({ imageUri: cropped.uri, result: { ...result, source: 'claude' }, prices: prices ?? undefined });
      incrementCardScanCount();
      setPhase('confirming');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      setPhase('ready');
      Alert.alert('Erkennung fehlgeschlagen', 'Karte konnte nicht erkannt werden. Halte die Karte direkt in den Rahmen und tippe nochmal.');
    } finally {
      isCapturing.current = false;
    }
  }, [phase, claudeApiKey, canScan, tapAnim]);

  // ── Save card ──────────────────────────────────────────────────────────────

  const handleSave = useCallback(async () => {
    if (!pendingCard) return;

    const prices = pendingCard.prices;

    const card: TradingCard = {
      id: uuidv4(),
      game: pendingCard.result.game,
      name: pendingCard.result.name,
      setName: pendingCard.result.setName,
      setCode: pendingCard.result.setCode,
      cardNumber: pendingCard.result.cardNumber,
      rarity: pendingCard.result.rarity,
      condition: pendingCard.result.condition as TradingCard['condition'],
      imageUri: pendingCard.imageUri,
      isFavorite: false,
      scannedAt: new Date().toISOString(),
      prices: prices ?? undefined,
    };

    addCard(card);
    setPendingCard(null);
    setPhase('ready');
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, [pendingCard, addCard, pokemonTcgApiKey]);

  const handleDiscard = useCallback(() => {
    setPendingCard(null);
    isCapturing.current = false;
    setPhase('ready');
  }, []);

  // ── Permission ─────────────────────────────────────────────────────────────

  if (!permission?.granted && phase !== 'history') {
    requestPermission();
  }

  const isInCameraPhase = ['ready', 'capturing', 'processing'].includes(phase);

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <ThemedView style={styles.container}>

      {/* ── Camera view ── */}
      {isInCameraPhase && (
        <View style={{ flex: 1 }}>
          <CameraView
            ref={cameraRef}
            style={StyleSheet.absoluteFill}
            facing="back"
            onCameraReady={handleCameraReady}
          />

          {/* Flex column overlay — header / frame / bottom — properly centered */}
          <View style={{ flex: 1, flexDirection: 'column' }}>
            {/* Spacer that matches header height so frame doesn't slide under it */}
            <View style={{ height: insets.top + 60 }} />

            {/* Frame area — takes remaining space, centers the frame */}
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: '8%' }}>
              <TouchableOpacity
                activeOpacity={1}
                onPress={handleFrameTap}
                style={{ width: '100%' }}
                accessibilityLabel="Auf Karte tippen zum Scannen"
              >
                <Animated.View
                  style={[
                    styles.cardFrame,
                    {
                      opacity: tapAnim,
                      borderColor:
                        phase === 'processing' || phase === 'capturing' ? theme.colors.primary
                        : 'rgba(255,255,255,0.55)',
                      borderWidth: 2,
                    },
                  ]}
                >
                  {/* Corner marks */}
                  <View style={[styles.corner, styles.cornerTL, { borderColor: 'rgba(255,255,255,0.7)' }]} />
                  <View style={[styles.corner, styles.cornerTR, { borderColor: 'rgba(255,255,255,0.7)' }]} />
                  <View style={[styles.corner, styles.cornerBL, { borderColor: 'rgba(255,255,255,0.7)' }]} />
                  <View style={[styles.corner, styles.cornerBR, { borderColor: 'rgba(255,255,255,0.7)' }]} />

                  {/* Center hint — only in ready state */}
                  {phase === 'ready' && (
                    <View style={styles.frameCenterHint}>
                      <Text style={styles.frameCenterIcon}>◎</Text>
                      <Text style={styles.frameCenterText}>Tippen zum Scannen</Text>
                    </View>
                  )}

                  {/* Scanning spinner inside frame */}
                  {(phase === 'capturing' || phase === 'processing') && (
                    <View style={styles.frameCenterHint}>
                      <ActivityIndicator color="#ffffff" size="large" />
                      <Text style={styles.frameCenterText}>
                        {phase === 'capturing' ? 'Foto wird aufgenommen...' : 'Claude analysiert Karte...'}
                      </Text>
                    </View>
                  )}
                </Animated.View>
              </TouchableOpacity>
            </View>

            {/* Bottom hint — fixed height below frame */}
            <View style={{ height: insets.bottom + 80, justifyContent: 'flex-start', alignItems: 'center', paddingTop: 12, paddingHorizontal: 24 }}>
              {phase === 'ready' && (
                <Text style={styles.hintText}>Karte in den Rahmen legen, dann auf den Rahmen tippen</Text>
              )}
            </View>
          </View>

          {/* Header — absolute on top of everything */}
          <View style={[styles.cameraHeader, { paddingTop: insets.top + 12 }]}>
            <TouchableOpacity onPress={() => router.back()} style={styles.headerBackBtn} accessibilityLabel="Zurück">
              <Text style={styles.headerBackText}>← Zurück</Text>
            </TouchableOpacity>
            <View style={styles.headerCenter}>
              <Text style={styles.headerBrandText}>PriceNinja</Text>
              <Text style={styles.headerSubText}>Card Scanner · {CARD_SCAN_RATE_LIMIT - scanStats.cardScansToday} übrig</Text>
            </View>
            <TouchableOpacity onPress={() => setPhase('history')} style={styles.headerRightBtn} accessibilityLabel="Gespeicherte Karten">
              <Text style={styles.headerRightText}>Saved</Text>
            </TouchableOpacity>
          </View>

        </View>
      )}

      {/* ── Result + prices ── */}
      {phase === 'confirming' && pendingCard && (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={[styles.overlay, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 24 }]}
          showsVerticalScrollIndicator={false}
        >
          {/* Card image */}
          {pendingCard.prices?.cardImageUrl ? (
            <View style={{ alignItems: 'center', marginBottom: 16 }}>
              <Image
                source={{ uri: pendingCard.prices.cardImageUrl }}
                style={{ width: 180, height: 252, borderRadius: 8 }}
                resizeMode="contain"
              />
            </View>
          ) : (
            <View style={{ alignItems: 'center', marginBottom: 16 }}>
              <Image
                source={{ uri: pendingCard.imageUri }}
                style={{ width: 180, height: 252, borderRadius: 8 }}
                resizeMode="contain"
              />
            </View>
          )}

          {/* Card info */}
          <GlowCard style={{ marginBottom: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <Text style={{ fontSize: 20 }}>
                {pendingCard.result.game === 'pokemon' ? '⚡' : pendingCard.result.game === 'yugioh' ? '👁' : '⚔️'}
              </Text>
              <ThemedText weight="bold" size="xl" style={{ flex: 1 }}>{pendingCard.result.name}</ThemedText>
            </View>
            <ThemedText variant="secondary">{pendingCard.result.game.toUpperCase()} · Claude ⚡</ThemedText>
            {pendingCard.result.setName && <ThemedText variant="muted" style={{ marginTop: 4 }}>Set: {pendingCard.result.setName}</ThemedText>}
            {pendingCard.result.cardNumber && <ThemedText variant="muted">Nr: {pendingCard.result.cardNumber}</ThemedText>}
            {pendingCard.result.rarity && <ThemedText variant="muted">Seltenheit: {pendingCard.result.rarity}</ThemedText>}
            {pendingCard.result.condition && (
              <ThemedText size="sm" style={{ color: theme.colors.primary, marginTop: 6 }}>
                Zustand: {pendingCard.result.condition}
              </ThemedText>
            )}
          </GlowCard>

          {/* Prices */}
          {pendingCard.prices && (
            <TouchableOpacity
              onPress={() => {
                if (pendingCard.prices?.cardmarketUrl) {
                  Linking.openURL(pendingCard.prices.cardmarketUrl);
                }
              }}
              activeOpacity={pendingCard.prices.cardmarketUrl ? 0.7 : 1}
            >
              <GlowCard style={{ marginBottom: 12, borderColor: pendingCard.prices.cardmarketUrl ? theme.colors.primary + '55' : theme.colors.border, borderWidth: 1 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <ThemedText weight="semibold" size="sm">Cardmarket</ThemedText>
                  {pendingCard.prices.cardmarketUrl && (
                    <Text style={{ color: theme.colors.primary, fontSize: 12 }}>Öffnen →</Text>
                  )}
                </View>
                {pendingCard.prices.cardmarketLow && (
                  <View style={styles.priceRow}>
                    <ThemedText variant="muted" size="sm">Niedrigster Preis</ThemedText>
                    <ThemedText weight="bold" style={{ color: theme.colors.primary }}>{formatPrice(pendingCard.prices.cardmarketLow)}</ThemedText>
                  </View>
                )}
                {pendingCard.prices.cardmarketMid && (
                  <View style={styles.priceRow}>
                    <ThemedText variant="muted" size="sm">Durchschnitt</ThemedText>
                    <ThemedText weight="semibold">{formatPrice(pendingCard.prices.cardmarketMid)}</ThemedText>
                  </View>
                )}
                {pendingCard.prices.cardmarketTrend && (
                  <View style={styles.priceRow}>
                    <ThemedText variant="muted" size="sm">Trend</ThemedText>
                    <ThemedText variant="secondary">{formatPrice(pendingCard.prices.cardmarketTrend)}</ThemedText>
                  </View>
                )}
                {!pendingCard.prices.cardmarketLow && !pendingCard.prices.cardmarketMid && (
                  <ThemedText variant="muted" size="sm">Kein Preis verfügbar</ThemedText>
                )}
              </GlowCard>
            </TouchableOpacity>
          )}

          {pendingCard.prices?.tcgplayerLow && (
            <GlowCard style={{ marginBottom: 12 }}>
              <ThemedText weight="semibold" size="sm" style={{ marginBottom: 6 }}>TCGPlayer</ThemedText>
              <View style={styles.priceRow}>
                <ThemedText variant="muted" size="sm">Niedrigster Preis</ThemedText>
                <ThemedText weight="bold">{formatPrice(pendingCard.prices.tcgplayerLow)}</ThemedText>
              </View>
              {pendingCard.prices.tcgplayerMid && (
                <View style={styles.priceRow}>
                  <ThemedText variant="muted" size="sm">Market</ThemedText>
                  <ThemedText variant="secondary">{formatPrice(pendingCard.prices.tcgplayerMid)}</ThemedText>
                </View>
              )}
            </GlowCard>
          )}

          <View style={{ flexDirection: 'row', gap: 12 }}>
            <PrimaryButton title="✓ Speichern" onPress={handleSave} style={{ flex: 1 }} />
            <PrimaryButton title="✕ Verwerfen" variant="outline" onPress={handleDiscard} style={{ flex: 1 }} />
          </View>
        </ScrollView>
      )}

      {/* ── Fetching prices ── */}
      {phase === 'fetching' && (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 }}>
          <ActivityIndicator color={theme.colors.primary} size="large" />
          <ThemedText variant="secondary">Preis wird abgerufen...</ThemedText>
        </View>
      )}

      {/* ── History ── */}
      {phase === 'history' && (
        <View style={{ flex: 1 }}>
          <View style={[styles.historyHeader, { paddingTop: insets.top + 12, borderBottomColor: theme.colors.border }]}>
            <TouchableOpacity onPress={() => setPhase('ready')} style={{ width: 80 }} accessibilityLabel="Zurück zum Scanner">
              <Text style={[styles.historyBackText, { color: theme.colors.primary }]}>← Scanner</Text>
            </TouchableOpacity>
            <ThemedText weight="bold" size="xl">Saved Cards</ThemedText>
            <View style={{ width: 80 }} />
          </View>

          <FlatList
            data={cards}
            keyExtractor={(c) => c.id}
            renderItem={({ item }) => (
              <TouchableOpacity onPress={() => setSelectedCard(item)} activeOpacity={0.75}>
                <GlowCard style={{ marginHorizontal: 16, marginVertical: 6 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                    {/* Thumbnail */}
                    {(item.imageUri || item.prices?.cardImageUrl) ? (
                      <Image
                        source={{ uri: item.prices?.cardImageUrl ?? item.imageUri }}
                        style={{ width: 48, height: 67, borderRadius: 4 }}
                        resizeMode="cover"
                      />
                    ) : (
                      <View style={{ width: 48, height: 67, borderRadius: 4, backgroundColor: theme.colors.surface, alignItems: 'center', justifyContent: 'center' }}>
                        <Text style={{ fontSize: 22 }}>{item.game === 'pokemon' ? '⚡' : item.game === 'yugioh' ? '👁' : '⚔️'}</Text>
                      </View>
                    )}
                    <View style={{ flex: 1 }}>
                      <ThemedText weight="semibold" numberOfLines={1}>{item.name}</ThemedText>
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
                      <TouchableOpacity onPress={() => toggleFavorite(item.id)} accessibilityLabel={item.isFavorite ? 'Aus Favoriten entfernen' : 'Zu Favoriten'}>
                        <Text style={{ fontSize: 22 }}>{item.isFavorite ? '⭐' : '☆'}</Text>
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => { Alert.alert('Löschen', `"${item.name}" löschen?`, [{ text: 'Abbrechen', style: 'cancel' }, { text: 'Löschen', style: 'destructive', onPress: () => removeCard(item.id) }]); }} accessibilityLabel="Karte löschen">
                        <Text style={{ fontSize: 22 }}>🗑️</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </GlowCard>
              </TouchableOpacity>
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

          {/* Card Detail Modal */}
          <Modal
            visible={selectedCard !== null}
            animationType="slide"
            transparent
            onRequestClose={() => setSelectedCard(null)}
          >
            <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' }}>
              <View style={{ backgroundColor: theme.colors.background, borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '92%' }}>
                {/* Modal Header */}
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1, borderBottomColor: theme.colors.border }}>
                  <ThemedText weight="bold" size="lg" numberOfLines={1} style={{ flex: 1 }}>{selectedCard?.name}</ThemedText>
                  <TouchableOpacity onPress={() => setSelectedCard(null)} style={{ paddingLeft: 12 }}>
                    <Text style={{ color: theme.colors.textSecondary, fontSize: 22 }}>✕</Text>
                  </TouchableOpacity>
                </View>

                <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
                  {/* Photo */}
                  {selectedCard && (selectedCard.prices?.cardImageUrl || selectedCard.imageUri) && (
                    <View style={{ alignItems: 'center', marginBottom: 16 }}>
                      <Image
                        source={{ uri: selectedCard.prices?.cardImageUrl ?? selectedCard.imageUri }}
                        style={{ width: 200, height: 280, borderRadius: 10 }}
                        resizeMode="contain"
                      />
                    </View>
                  )}

                  {/* Card Info */}
                  {selectedCard && (
                    <GlowCard style={{ marginBottom: 12 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                        <Text style={{ fontSize: 22 }}>{selectedCard.game === 'pokemon' ? '⚡' : selectedCard.game === 'yugioh' ? '👁' : '⚔️'}</Text>
                        <ThemedText weight="bold" size="lg" style={{ flex: 1 }}>{selectedCard.name}</ThemedText>
                        {selectedCard.isFavorite && <Text style={{ fontSize: 18 }}>⭐</Text>}
                      </View>
                      <ThemedText variant="secondary" size="sm">{selectedCard.game.toUpperCase()}</ThemedText>
                      {selectedCard.setName && <ThemedText variant="muted" size="sm" style={{ marginTop: 4 }}>Set: {selectedCard.setName}</ThemedText>}
                      {selectedCard.cardNumber && <ThemedText variant="muted" size="sm">Nr: {selectedCard.cardNumber}</ThemedText>}
                      {selectedCard.rarity && <ThemedText variant="muted" size="sm">Seltenheit: {selectedCard.rarity}</ThemedText>}
                      {selectedCard.condition && <ThemedText variant="muted" size="sm">Zustand: {selectedCard.condition}</ThemedText>}
                      <ThemedText variant="muted" size="xs" style={{ marginTop: 6 }}>
                        Gescannt: {new Date(selectedCard.scannedAt).toLocaleDateString('de-DE')}
                      </ThemedText>
                    </GlowCard>
                  )}

                  {/* Cardmarket Preise */}
                  {selectedCard?.prices && (
                    <TouchableOpacity
                      onPress={() => selectedCard.prices?.cardmarketUrl && Linking.openURL(selectedCard.prices.cardmarketUrl)}
                      activeOpacity={selectedCard.prices.cardmarketUrl ? 0.75 : 1}
                    >
                      <GlowCard style={{ marginBottom: 12, borderColor: theme.colors.primary + '44', borderWidth: 1 }}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                          <ThemedText weight="semibold">Cardmarket</ThemedText>
                          {selectedCard.prices.cardmarketUrl && <Text style={{ color: theme.colors.primary, fontSize: 12 }}>Öffnen →</Text>}
                        </View>
                        {selectedCard.prices.cardmarketLow && (
                          <View style={styles.priceRow}>
                            <ThemedText variant="muted" size="sm">Niedrigster Preis</ThemedText>
                            <ThemedText weight="bold" style={{ color: theme.colors.primary }}>{formatPrice(selectedCard.prices.cardmarketLow)}</ThemedText>
                          </View>
                        )}
                        {selectedCard.prices.cardmarketMid && (
                          <View style={styles.priceRow}>
                            <ThemedText variant="muted" size="sm">Durchschnitt</ThemedText>
                            <ThemedText weight="semibold">{formatPrice(selectedCard.prices.cardmarketMid)}</ThemedText>
                          </View>
                        )}
                        {selectedCard.prices.cardmarketTrend && (
                          <View style={styles.priceRow}>
                            <ThemedText variant="muted" size="sm">Trend</ThemedText>
                            <ThemedText variant="secondary">{formatPrice(selectedCard.prices.cardmarketTrend)}</ThemedText>
                          </View>
                        )}
                        {!selectedCard.prices.cardmarketLow && !selectedCard.prices.cardmarketMid && (
                          <ThemedText variant="muted" size="sm">Kein Preis verfügbar</ThemedText>
                        )}
                      </GlowCard>
                    </TouchableOpacity>
                  )}

                  {/* TCGPlayer */}
                  {selectedCard?.prices?.tcgplayerLow && (
                    <GlowCard style={{ marginBottom: 12 }}>
                      <ThemedText weight="semibold" style={{ marginBottom: 8 }}>TCGPlayer</ThemedText>
                      <View style={styles.priceRow}>
                        <ThemedText variant="muted" size="sm">Niedrigster Preis</ThemedText>
                        <ThemedText weight="bold">{formatPrice(selectedCard.prices.tcgplayerLow)}</ThemedText>
                      </View>
                      {selectedCard.prices.tcgplayerMid && (
                        <View style={styles.priceRow}>
                          <ThemedText variant="muted" size="sm">Market</ThemedText>
                          <ThemedText variant="secondary">{formatPrice(selectedCard.prices.tcgplayerMid)}</ThemedText>
                        </View>
                      )}
                    </GlowCard>
                  )}

                  {/* Actions */}
                  <View style={{ flexDirection: 'row', gap: 12, marginTop: 8 }}>
                    <TouchableOpacity
                      onPress={() => { if (selectedCard) { toggleFavorite(selectedCard.id); setSelectedCard(cards.find(c => c.id === selectedCard.id) ?? null); } }}
                      style={{ flex: 1, padding: 14, borderRadius: 10, borderWidth: 1, borderColor: theme.colors.border, alignItems: 'center' }}
                    >
                      <Text style={{ fontSize: 18 }}>{selectedCard?.isFavorite ? '⭐ Favorit' : '☆ Favorit'}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => {
                        if (!selectedCard) return;
                        Alert.alert('Löschen', `"${selectedCard.name}" löschen?`, [
                          { text: 'Abbrechen', style: 'cancel' },
                          { text: 'Löschen', style: 'destructive', onPress: () => { removeCard(selectedCard.id); setSelectedCard(null); } },
                        ]);
                      }}
                      style={{ flex: 1, padding: 14, borderRadius: 10, borderWidth: 1, borderColor: theme.colors.error + '66', alignItems: 'center' }}
                    >
                      <Text style={{ color: theme.colors.error, fontSize: 15, fontWeight: '600' }}>🗑️ Löschen</Text>
                    </TouchableOpacity>
                  </View>
                </ScrollView>
              </View>
            </View>
          </Modal>

          <TouchableOpacity
            onPress={() => setPhase('ready')}
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

const CORNER_SIZE = 18;

const styles = StyleSheet.create({
  container: { flex: 1 },

  // Camera header
  cameraHeader: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: 'rgba(0,0,0,0.55)',
    zIndex: 10,
  },
  headerBackBtn: { width: 80, alignItems: 'flex-start' },
  headerBackText: { color: 'white', fontSize: 15, fontWeight: '500' },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerBrandText: { color: '#00ff88', fontWeight: 'bold', fontSize: 20 },
  headerSubText: { color: 'white', fontSize: 12, letterSpacing: 1 },
  headerRightBtn: { width: 80, alignItems: 'flex-end' },
  headerRightText: { color: 'white', fontSize: 15, fontWeight: '500' },

  // Card frame border
  cardFrame: {
    width: '100%',
    aspectRatio: 0.716,
    borderWidth: 2,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Corner accent marks
  corner: {
    position: 'absolute',
    width: CORNER_SIZE,
    height: CORNER_SIZE,
    borderWidth: 2.5,
    borderRadius: 2,
  },
  cornerTL: { top: -1, left: -1, borderRightWidth: 0, borderBottomWidth: 0 },
  cornerTR: { top: -1, right: -1, borderLeftWidth: 0, borderBottomWidth: 0 },
  cornerBL: { bottom: -1, left: -1, borderRightWidth: 0, borderTopWidth: 0 },
  cornerBR: { bottom: -1, right: -1, borderLeftWidth: 0, borderTopWidth: 0 },

  // Hint shown inside frame
  frameCenterHint: {
    alignItems: 'center',
    gap: 10,
  },
  frameCenterIcon: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 36,
    lineHeight: 40,
  },
  frameCenterText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 13,
    fontWeight: '500',
    letterSpacing: 0.3,
    textAlign: 'center',
  },

  hintText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 12,
    textAlign: 'center',
  },

  // Result overlay (floats above camera)
  resultOverlay: {
    position: 'absolute',
    left: 0, right: 0,
    zIndex: 20,
  },

  // Full-screen overlay for Claude result
  overlay: { padding: 20, gap: 12 },

  priceRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 2 },

  // History
  historyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  historyBackText: { fontSize: 15, fontWeight: '600' },

  // FAB
  fab: {
    position: 'absolute',
    right: 24,
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 32,
    elevation: 6,
  },
  fabText: { fontWeight: 'bold', fontSize: 15 },
});
