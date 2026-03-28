import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  FlatList,
  Text,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useTheme } from '@/src/theme';
import { useCardStore, useSettingsStore } from '@/src/store';
import { ThemedView, ThemedText, GlowCard, PrimaryButton } from '@/src/components/ui';
import { identifyCard } from '@/src/api/claude';
import { fetchCardPrice } from '@/src/api/tcg';
import { TradingCard } from '@/src/types/card';
import { ClaudeCardResult } from '@/src/api/claude';
import { formatPrice } from '@/src/utils/pricing';
import 'react-native-get-random-values';
import { v4 as uuidv4 } from 'uuid';

type CardScanState = 'history' | 'scanning' | 'confirming' | 'fetching';

export default function CardsScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanState, setScanState] = useState<CardScanState>('scanning');
  const [scannedCard, setScannedCard] = useState<{ imageUri: string; result: ClaudeCardResult } | null>(null);
  const cameraRef = React.useRef<CameraView>(null);
  const { claudeApiKey } = useSettingsStore();
  const { cards, addCard, removeCard, toggleFavorite } = useCardStore();

  const handleCapture = async () => {
    if (!claudeApiKey) {
      Alert.alert('Kein API-Key', 'Bitte füge deinen Claude API-Key in den Einstellungen ein.');
      return;
    }
    if (!cameraRef.current) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    setScanState('scanning');

    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.8 });
      if (!photo?.uri) throw new Error('Kein Foto');

      const result = await identifyCard(claudeApiKey, photo.uri);
      setScannedCard({ imageUri: photo.uri, result });
      setScanState('confirming');
    } catch {
      setScanState('scanning');
      Alert.alert('Scan fehlgeschlagen');
    }
  };

  const handleSaveCard = async () => {
    if (!scannedCard) return;
    setScanState('fetching');

    const prices = await fetchCardPrice({
      game: scannedCard.result.game,
      name: scannedCard.result.name,
      setCode: scannedCard.result.setCode,
      cardNumber: scannedCard.result.cardNumber,
    });

    const card: TradingCard = {
      id: uuidv4(),
      game: scannedCard.result.game,
      name: scannedCard.result.name,
      setName: scannedCard.result.setName,
      setCode: scannedCard.result.setCode,
      cardNumber: scannedCard.result.cardNumber,
      rarity: scannedCard.result.rarity,
      condition: scannedCard.result.condition as TradingCard['condition'],
      imageUri: scannedCard.imageUri,
      isFavorite: false,
      scannedAt: new Date().toISOString(),
      prices: prices ?? undefined,
    };

    addCard(card);
    setScannedCard(null);
    setScanState('scanning');
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  if (!permission?.granted && scanState !== 'history') {
    requestPermission();
  }

  return (
    <ThemedView style={styles.container}>
      {/* Camera view */}
      {(scanState === 'scanning') && (
        <View style={{ flex: 1 }}>
          <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} facing="back" />

          {/* Card frame overlay */}
          <View style={[styles.cardFrame, { borderColor: theme.colors.primary }]} />

          {/* Header overlay */}
          <View style={[styles.cameraHeader, { paddingTop: insets.top + 12, backgroundColor: 'rgba(0,0,0,0.6)' }]}>
            <TouchableOpacity
              onPress={() => router.back()}
              style={styles.headerBackBtn}
              accessibilityLabel="Zurück"
            >
              <Text style={styles.headerBackText}>← Zurück</Text>
            </TouchableOpacity>

            <View style={styles.headerCenter}>
              <Text style={styles.headerBrandText}>PriceNinja</Text>
              <Text style={styles.headerSubText}>Card Scanner</Text>
            </View>

            <TouchableOpacity
              onPress={() => setScanState('history')}
              style={styles.headerRightBtn}
              accessibilityLabel="Kartenverlauf anzeigen"
            >
              <Text style={styles.headerRightText}>Verlauf</Text>
            </TouchableOpacity>
          </View>

          {/* Capture button */}
          <View style={[styles.cameraBottom, { paddingBottom: insets.bottom + 32 }]}>
            <TouchableOpacity
              onPress={handleCapture}
              style={[styles.captureBtn, { borderColor: theme.colors.primary }]}
              accessibilityLabel="Karte fotografieren"
            >
              <View style={[styles.captureInner, { backgroundColor: theme.colors.primary }]} />
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Confirming state */}
      {scanState === 'confirming' && scannedCard && (
        <View style={[styles.overlay, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 20 }]}>
          <GlowCard>
            <ThemedText weight="bold" size="xl">{scannedCard.result.name}</ThemedText>
            <ThemedText variant="secondary">{scannedCard.result.game.toUpperCase()}</ThemedText>
            {scannedCard.result.setName && <ThemedText variant="muted">Set: {scannedCard.result.setName}</ThemedText>}
            {scannedCard.result.cardNumber && <ThemedText variant="muted">Nr: {scannedCard.result.cardNumber}</ThemedText>}
          </GlowCard>
          <View style={{ flexDirection: 'row', gap: 12, marginTop: 16 }}>
            <PrimaryButton title="Speichern + Preis" onPress={handleSaveCard} style={{ flex: 1 }} />
            <PrimaryButton title="Abbrechen" variant="outline" onPress={() => setScanState('scanning')} style={{ flex: 1 }} />
          </View>
        </View>
      )}

      {/* Fetching prices */}
      {scanState === 'fetching' && (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 }}>
          <ActivityIndicator color={theme.colors.primary} size="large" />
          <ThemedText variant="secondary">Preis wird abgerufen...</ThemedText>
        </View>
      )}

      {/* History view */}
      {scanState === 'history' && (
        <View style={{ flex: 1 }}>
          {/* History header */}
          <View style={[styles.historyHeader, { paddingTop: insets.top + 12, borderBottomColor: theme.colors.border }]}>
            <TouchableOpacity
              onPress={() => setScanState('scanning')}
              style={styles.historyBackBtn}
              accessibilityLabel="Zurück zum Scanner"
            >
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
                    <ThemedText variant="secondary" size="sm">{item.game.toUpperCase()} · {item.setName ?? 'Unbekanntes Set'}</ThemedText>
                    {item.prices?.cardmarketLow && (
                      <ThemedText style={{ color: theme.colors.primary, fontWeight: 'bold' }}>
                        ab {formatPrice(item.prices.cardmarketLow)}
                      </ThemedText>
                    )}
                  </View>
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <TouchableOpacity onPress={() => toggleFavorite(item.id)} accessibilityLabel={item.isFavorite ? 'Von Favoriten entfernen' : 'Zu Favoriten hinzufügen'}>
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

          {/* FAB — Neue Karte scannen */}
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
  // Capture
  cameraBottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  captureBtn: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  captureInner: { width: 54, height: 54, borderRadius: 27 },
  // Confirming
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
