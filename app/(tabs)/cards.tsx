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
import { TradingCard, getCardCategory, getCardEmoji, getCardLabel, CardCategory } from '@/src/types/card';
import { formatPrice } from '@/src/utils/pricing';
import { CARD_SCAN_RATE_LIMIT } from '@/src/utils/constants';
import 'react-native-get-random-values';
import { v4 as uuidv4 } from 'uuid';

type CardResult = ClaudeCardResult & { source?: string };

type ScanPhase =
  | 'ready'
  | 'capturing'
  | 'processing'
  | 'confirming'
  | 'fetching'
  | 'history';

type HistoryFilter = 'all' | 'tcg' | 'sports';

export default function CardsScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const [permission, requestPermission] = useCameraPermissions();
  const [phase, setPhase] = useState<ScanPhase>('ready');
  const [pendingCard, setPendingCard] = useState<{ imageUri: string; result: CardResult; prices?: Awaited<ReturnType<typeof fetchCardPrice>> } | null>(null);
  const [historyFilter, setHistoryFilter] = useState<HistoryFilter>('all');

  const cameraRef = useRef<CameraView>(null);
  const isCameraReady = useRef(false);
  const isCapturing = useRef(false);
  const tapAnim = useRef(new Animated.Value(1)).current;

  const { claudeApiKey, pokemonTcgApiKey, incrementCardScanCount, scanStats } = useSettingsStore();
  const canScan = scanStats.cardScansToday < CARD_SCAN_RATE_LIMIT;
  const { cards, addCard, removeCard, toggleFavorite } = useCardStore();
  const [selectedCard, setSelectedCard] = useState<TradingCard | null>(null);

  const filteredCards = cards.filter(c => {
    if (historyFilter === 'all') return true;
    return getCardCategory(c.game) === historyFilter;
  });

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

  const handleFrameTap = useCallback(async () => {
    if (isCapturing.current || !isCameraReady.current || !cameraRef.current) return;
    if (phase !== 'ready') return;

    if (!canScan) {
      Alert.alert('Limit erreicht', `Maximal ${CARD_SCAN_RATE_LIMIT} Scans heute. Starte die App neu um weiterzumachen.`);
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
      const prices = await fetchCardPrice(
        { game: result.game, name: result.name, setCode: result.setCode, cardNumber: result.cardNumber, searchQuery: result.searchQuery },
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

  const handleSave = useCallback(async () => {
    if (!pendingCard) return;

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
      prices: pendingCard.prices ?? undefined,
    };

    addCard(card);
    setPendingCard(null);
    setPhase('ready');
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, [pendingCard, addCard]);

  const handleDiscard = useCallback(() => {
    setPendingCard(null);
    isCapturing.current = false;
    setPhase('ready');
  }, []);

  if (!permission?.granted && phase !== 'history') {
    requestPermission();
  }

  const isInCameraPhase = ['ready', 'capturing', 'processing'].includes(phase);

  // ── Price display helpers ────────────────────────────────────────────────────

  function renderPriceSection(prices: NonNullable<TradingCard['prices']>, game: TradingCard['game']) {
    const category = getCardCategory(game);

    if (category === 'sports') {
      return (
        <TouchableOpacity
          onPress={() => prices.ebayUrl && Linking.openURL(prices.ebayUrl)}
          activeOpacity={prices.ebayUrl ? 0.7 : 1}
        >
          <GlowCard style={{ marginBottom: 12, borderColor: prices.ebayUrl ? theme.colors.primary + '55' : theme.colors.border, borderWidth: 1 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <ThemedText weight="semibold" size="sm">eBay · Aktive Angebote</ThemedText>
              {prices.ebayUrl && <Text style={{ color: theme.colors.primary, fontSize: 12 }}>Suchen →</Text>}
            </View>
            {prices.ebayMinPrice ? (
              <View style={styles.priceRow}>
                <ThemedText variant="muted" size="sm">Günstigstes Angebot</ThemedText>
                <ThemedText weight="bold" style={{ color: theme.colors.primary }}>{formatPrice(prices.ebayMinPrice)}</ThemedText>
              </View>
            ) : null}
            {prices.ebayAvgPrice ? (
              <View style={styles.priceRow}>
                <ThemedText variant="muted" size="sm">Durchschnitt</ThemedText>
                <ThemedText weight="semibold">{formatPrice(prices.ebayAvgPrice)}</ThemedText>
              </View>
            ) : null}
            {!prices.ebayMinPrice && !prices.ebayAvgPrice && (
              <ThemedText variant="muted" size="sm">Keine Angebote gefunden — auf eBay suchen</ThemedText>
            )}
          </GlowCard>
        </TouchableOpacity>
      );
    }

    // TCG / other — Cardmarket + TCGPlayer
    return (
      <>
        <TouchableOpacity
          onPress={() => prices.cardmarketUrl && Linking.openURL(prices.cardmarketUrl)}
          activeOpacity={prices.cardmarketUrl ? 0.7 : 1}
        >
          <GlowCard style={{ marginBottom: 12, borderColor: prices.cardmarketUrl ? theme.colors.primary + '55' : theme.colors.border, borderWidth: 1 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <ThemedText weight="semibold" size="sm">Cardmarket</ThemedText>
              {prices.cardmarketUrl && <Text style={{ color: theme.colors.primary, fontSize: 12 }}>Öffnen →</Text>}
            </View>
            {prices.cardmarketLow ? (
              <View style={styles.priceRow}>
                <ThemedText variant="muted" size="sm">Niedrigster Preis</ThemedText>
                <ThemedText weight="bold" style={{ color: theme.colors.primary }}>{formatPrice(prices.cardmarketLow)}</ThemedText>
              </View>
            ) : null}
            {prices.cardmarketMid ? (
              <View style={styles.priceRow}>
                <ThemedText variant="muted" size="sm">Durchschnitt</ThemedText>
                <ThemedText weight="semibold">{formatPrice(prices.cardmarketMid)}</ThemedText>
              </View>
            ) : null}
            {prices.cardmarketTrend ? (
              <View style={styles.priceRow}>
                <ThemedText variant="muted" size="sm">Trend</ThemedText>
                <ThemedText variant="secondary">{formatPrice(prices.cardmarketTrend)}</ThemedText>
              </View>
            ) : null}
            {!prices.cardmarketLow && !prices.cardmarketMid && (
              <ThemedText variant="muted" size="sm">Kein Preis verfügbar</ThemedText>
            )}
          </GlowCard>
        </TouchableOpacity>
        {prices.tcgplayerLow ? (
          <GlowCard style={{ marginBottom: 12 }}>
            <ThemedText weight="semibold" size="sm" style={{ marginBottom: 6 }}>TCGPlayer</ThemedText>
            <View style={styles.priceRow}>
              <ThemedText variant="muted" size="sm">Niedrigster Preis</ThemedText>
              <ThemedText weight="bold">{formatPrice(prices.tcgplayerLow)}</ThemedText>
            </View>
            {prices.tcgplayerMid ? (
              <View style={styles.priceRow}>
                <ThemedText variant="muted" size="sm">Market</ThemedText>
                <ThemedText variant="secondary">{formatPrice(prices.tcgplayerMid)}</ThemedText>
              </View>
            ) : null}
          </GlowCard>
        ) : null}
      </>
    );
  }

  function renderCardBadge(game: TradingCard['game']) {
    const category = getCardCategory(game);
    const badgeColor = category === 'tcg' ? '#3b82f6' : category === 'sports' ? '#f59e0b' : theme.colors.border;
    return (
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
        <View style={{ backgroundColor: badgeColor + '33', borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2 }}>
          <Text style={{ color: badgeColor, fontSize: 11, fontWeight: '600' }}>
            {category === 'tcg' ? 'TCG' : category === 'sports' ? 'SPORTS' : 'CARD'}
          </Text>
        </View>
        <ThemedText variant="secondary" size="sm">{getCardLabel(game)}</ThemedText>
      </View>
    );
  }

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

          <View style={{ flex: 1, flexDirection: 'column' }}>
            <View style={{ height: insets.top + 60 }} />

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
                  <View style={[styles.corner, styles.cornerTL, { borderColor: 'rgba(255,255,255,0.7)' }]} />
                  <View style={[styles.corner, styles.cornerTR, { borderColor: 'rgba(255,255,255,0.7)' }]} />
                  <View style={[styles.corner, styles.cornerBL, { borderColor: 'rgba(255,255,255,0.7)' }]} />
                  <View style={[styles.corner, styles.cornerBR, { borderColor: 'rgba(255,255,255,0.7)' }]} />

                  {phase === 'ready' && (
                    <View style={styles.frameCenterHint}>
                      <Text style={styles.frameCenterIcon}>◎</Text>
                      <Text style={styles.frameCenterText}>Tippen zum Scannen</Text>
                      <Text style={[styles.frameCenterText, { marginTop: 6, fontSize: 11, opacity: 0.75 }]}>
                        Pokémon · Yu-Gi-Oh · Magic{'\n'}WWE · Baseball · Soccer · NBA …
                      </Text>
                    </View>
                  )}

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

            <View style={{ height: insets.bottom + 80, justifyContent: 'flex-start', alignItems: 'center', paddingTop: 12, paddingHorizontal: 24 }}>
              {phase === 'ready' && (
                <Text style={styles.hintText}>Karte in den Rahmen legen, dann auf den Rahmen tippen</Text>
              )}
            </View>
          </View>

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
          <View style={{ alignItems: 'center', marginBottom: 16 }}>
            <Image
              source={{ uri: pendingCard.prices?.cardImageUrl ?? pendingCard.imageUri }}
              style={{ width: 180, height: 252, borderRadius: 8 }}
              resizeMode="contain"
            />
          </View>

          {/* Card info */}
          <GlowCard style={{ marginBottom: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <Text style={{ fontSize: 22 }}>{getCardEmoji(pendingCard.result.game)}</Text>
              <ThemedText weight="bold" size="xl" style={{ flex: 1 }}>{pendingCard.result.name}</ThemedText>
            </View>
            {renderCardBadge(pendingCard.result.game)}
            {pendingCard.result.setName && <ThemedText variant="muted" style={{ marginTop: 4 }}>Set: {pendingCard.result.setName}</ThemedText>}
            {pendingCard.result.cardNumber && <ThemedText variant="muted">Nr: {pendingCard.result.cardNumber}</ThemedText>}
            {pendingCard.result.rarity && <ThemedText variant="muted">Seltenheit/Variante: {pendingCard.result.rarity}</ThemedText>}
            {pendingCard.result.condition && (
              <ThemedText size="sm" style={{ color: theme.colors.primary, marginTop: 6 }}>
                Zustand: {pendingCard.result.condition}
              </ThemedText>
            )}
          </GlowCard>

          {/* Prices — category-aware */}
          {pendingCard.prices && renderPriceSection(pendingCard.prices, pendingCard.result.game)}

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

          {/* Category filter */}
          <View style={{ flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingVertical: 10 }}>
            {(['all', 'tcg', 'sports'] as HistoryFilter[]).map(f => {
              const active = historyFilter === f;
              const label = f === 'all' ? `Alle (${cards.length})` : f === 'tcg' ? `TCG (${cards.filter(c => getCardCategory(c.game) === 'tcg').length})` : `Sports (${cards.filter(c => getCardCategory(c.game) === 'sports').length})`;
              return (
                <TouchableOpacity
                  key={f}
                  onPress={() => { setHistoryFilter(f); Haptics.selectionAsync(); }}
                  style={{
                    paddingHorizontal: 14,
                    paddingVertical: 7,
                    borderRadius: 20,
                    backgroundColor: active ? theme.colors.primary : theme.colors.surface,
                    borderWidth: 1,
                    borderColor: active ? theme.colors.primary : theme.colors.border,
                  }}
                  accessibilityLabel={`Filter: ${label}`}
                >
                  <Text style={{ color: active ? theme.colors.background : theme.colors.text, fontSize: 13, fontWeight: active ? '700' : '400' }}>
                    {label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <FlatList
            data={filteredCards}
            keyExtractor={(c) => c.id}
            renderItem={({ item }) => {
              const category = getCardCategory(item.game);
              const badgeColor = category === 'tcg' ? '#3b82f6' : category === 'sports' ? '#f59e0b' : theme.colors.border;
              const priceDisplay = category === 'sports'
                ? (item.prices?.ebayMinPrice ? `ab ${formatPrice(item.prices.ebayMinPrice)}` : null)
                : (item.prices?.cardmarketLow ? `ab ${formatPrice(item.prices.cardmarketLow)}` : null);

              return (
                <TouchableOpacity onPress={() => setSelectedCard(item)} activeOpacity={0.75}>
                  <GlowCard style={{ marginHorizontal: 16, marginVertical: 6 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                      {(item.imageUri || item.prices?.cardImageUrl) ? (
                        <Image
                          source={{ uri: item.prices?.cardImageUrl ?? item.imageUri }}
                          style={{ width: 48, height: 67, borderRadius: 4 }}
                          resizeMode="cover"
                        />
                      ) : (
                        <View style={{ width: 48, height: 67, borderRadius: 4, backgroundColor: theme.colors.surface, alignItems: 'center', justifyContent: 'center' }}>
                          <Text style={{ fontSize: 22 }}>{getCardEmoji(item.game)}</Text>
                        </View>
                      )}
                      <View style={{ flex: 1 }}>
                        <ThemedText weight="semibold" numberOfLines={1}>{item.name}</ThemedText>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
                          <View style={{ backgroundColor: badgeColor + '33', borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1 }}>
                            <Text style={{ color: badgeColor, fontSize: 10, fontWeight: '600' }}>
                              {category === 'tcg' ? 'TCG' : category === 'sports' ? 'SPORTS' : 'CARD'}
                            </Text>
                          </View>
                          <ThemedText variant="secondary" size="sm" numberOfLines={1} style={{ flex: 1 }}>
                            {item.setName ?? getCardLabel(item.game)}
                          </ThemedText>
                        </View>
                        {priceDisplay && (
                          <ThemedText style={{ color: theme.colors.primary, fontWeight: 'bold', marginTop: 2 }}>
                            {priceDisplay}
                          </ThemedText>
                        )}
                      </View>
                      <View style={{ flexDirection: 'row', gap: 8 }}>
                        <TouchableOpacity onPress={() => toggleFavorite(item.id)} accessibilityLabel={item.isFavorite ? 'Aus Favoriten entfernen' : 'Zu Favoriten'}>
                          <Text style={{ fontSize: 22 }}>{item.isFavorite ? '⭐' : '☆'}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={() => { Alert.alert('Löschen', `"${item.name}" löschen?`, [{ text: 'Abbrechen', style: 'cancel' }, { text: 'Löschen', style: 'destructive', onPress: () => removeCard(item.id) }]); }}
                          accessibilityLabel="Karte löschen"
                        >
                          <Text style={{ fontSize: 22 }}>🗑️</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  </GlowCard>
                </TouchableOpacity>
              );
            }}
            ListEmptyComponent={
              <View style={{ alignItems: 'center', paddingVertical: 60 }}>
                <Text style={{ fontSize: 64 }}>♦</Text>
                <ThemedText weight="bold" size="xl" style={{ marginTop: 16 }}>Keine Karten</ThemedText>
                <ThemedText variant="secondary" style={{ textAlign: 'center' }}>
                  {historyFilter === 'all' ? 'Scanne deine erste Karte' : `Keine ${historyFilter === 'tcg' ? 'TCG' : 'Sports'}-Karten gespeichert`}
                </ThemedText>
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
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1, borderBottomColor: theme.colors.border }}>
                  <ThemedText weight="bold" size="lg" numberOfLines={1} style={{ flex: 1 }}>{selectedCard?.name}</ThemedText>
                  <TouchableOpacity onPress={() => setSelectedCard(null)} style={{ paddingLeft: 12 }}>
                    <Text style={{ color: theme.colors.textSecondary, fontSize: 22 }}>✕</Text>
                  </TouchableOpacity>
                </View>

                <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 40 }} showsVerticalScrollIndicator={false}>
                  {selectedCard && (selectedCard.prices?.cardImageUrl || selectedCard.imageUri) && (
                    <View style={{ alignItems: 'center', marginBottom: 16 }}>
                      <Image
                        source={{ uri: selectedCard.prices?.cardImageUrl ?? selectedCard.imageUri }}
                        style={{ width: 200, height: 280, borderRadius: 10 }}
                        resizeMode="contain"
                      />
                    </View>
                  )}

                  {selectedCard && (
                    <GlowCard style={{ marginBottom: 12 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                        <Text style={{ fontSize: 22 }}>{getCardEmoji(selectedCard.game)}</Text>
                        <ThemedText weight="bold" size="lg" style={{ flex: 1 }}>{selectedCard.name}</ThemedText>
                        {selectedCard.isFavorite && <Text style={{ fontSize: 18 }}>⭐</Text>}
                      </View>
                      {renderCardBadge(selectedCard.game)}
                      {selectedCard.setName && <ThemedText variant="muted" size="sm" style={{ marginTop: 4 }}>Set: {selectedCard.setName}</ThemedText>}
                      {selectedCard.cardNumber && <ThemedText variant="muted" size="sm">Nr: {selectedCard.cardNumber}</ThemedText>}
                      {selectedCard.rarity && <ThemedText variant="muted" size="sm">Seltenheit/Variante: {selectedCard.rarity}</ThemedText>}
                      {selectedCard.condition && <ThemedText variant="muted" size="sm">Zustand: {selectedCard.condition}</ThemedText>}
                      <ThemedText variant="muted" size="xs" style={{ marginTop: 6 }}>
                        Gescannt: {new Date(selectedCard.scannedAt).toLocaleDateString('de-DE')}
                      </ThemedText>
                    </GlowCard>
                  )}

                  {selectedCard?.prices && renderPriceSection(selectedCard.prices, selectedCard.game)}

                  <View style={{ flexDirection: 'row', gap: 12, marginTop: 8 }}>
                    <TouchableOpacity
                      onPress={() => {
                        if (selectedCard) {
                          toggleFavorite(selectedCard.id);
                          setSelectedCard(cards.find(c => c.id === selectedCard.id) ?? null);
                        }
                      }}
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

  cardFrame: {
    width: '100%',
    aspectRatio: 0.716,
    borderWidth: 2,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },

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

  frameCenterHint: {
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 20,
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

  resultOverlay: {
    position: 'absolute',
    left: 0, right: 0,
    zIndex: 20,
  },

  overlay: { padding: 20, gap: 12 },

  priceRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 2 },

  historyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  historyBackText: { fontSize: 15, fontWeight: '600' },

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
