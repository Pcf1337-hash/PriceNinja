import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View,
  StyleSheet,
  Text,
  TouchableOpacity,
  Alert,
  ScrollView,
  ActivityIndicator,
  TextInput,
  Image,
  Linking,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/src/theme';
import { useItemStore, useSettingsStore } from '@/src/store';
import { ThemedView, ThemedText, GlowCard, PrimaryButton } from '@/src/components/ui';
import { identifyItem, ClaudeAlternative } from '@/src/api/claude';
import { fetchSoldListingsPublic } from '@/src/api/ebay';
import { fetchGeizhalsPrice } from '@/src/api/geizhals';
import { calculatePriceStats, formatPrice } from '@/src/utils/pricing';
import { SCAN_RATE_LIMIT } from '@/src/utils/constants';
import { TrackedItem, EbaySoldListing } from '@/src/types/item';
import { ClaudeItemResult } from '@/src/api/claude';
import 'react-native-get-random-values';
import { v4 as uuidv4 } from 'uuid';

type ScanState = 'idle' | 'scanning' | 'confirming' | 'fetching-prices' | 'prices-ready';

interface ScanResult {
  imageUri: string;
  claudeResult: ClaudeItemResult;
  soldListings: EbaySoldListing[];
  ebaySoldAvg?: number;
  ebaySoldMin?: number;
  ebaySoldMax?: number;
  geizhalsCheapest?: number;
  geizhalsUrl?: string;
}

function ImageCarousel({ images }: { images: string[] }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const { theme } = useTheme();
  const CARD_WIDTH = 280;

  return (
    <View style={{ marginVertical: 4 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, paddingHorizontal: 2 }}>
        <Text style={{ color: theme.colors.textMuted, fontSize: 11, fontWeight: '600', letterSpacing: 1 }}>
          PRODUKTBILDER
        </Text>
        <Text style={{ color: theme.colors.textMuted, fontSize: 11 }}>
          {activeIndex + 1} / {images.length}
        </Text>
      </View>
      <ScrollView
        horizontal
        pagingEnabled={false}
        showsHorizontalScrollIndicator={false}
        snapToInterval={CARD_WIDTH + 10}
        decelerationRate="fast"
        contentContainerStyle={{ gap: 10, paddingHorizontal: 2 }}
        onScroll={(e) => {
          const idx = Math.round(e.nativeEvent.contentOffset.x / (CARD_WIDTH + 10));
          setActiveIndex(Math.min(idx, images.length - 1));
        }}
        scrollEventThrottle={16}
      >
        {images.map((uri, i) => (
          <Image
            key={i}
            source={{ uri }}
            style={{
              width: CARD_WIDTH,
              height: 200,
              borderRadius: 12,
              backgroundColor: theme.colors.surface,
            }}
            resizeMode="contain"
            accessibilityLabel={`Produktbild ${i + 1}`}
          />
        ))}
      </ScrollView>
      {/* Dot indicator */}
      <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: 8 }}>
        {images.map((_, i) => (
          <View
            key={i}
            style={{
              width: i === activeIndex ? 16 : 6,
              height: 6,
              borderRadius: 3,
              backgroundColor: i === activeIndex ? theme.colors.primary : theme.colors.border,
            }}
          />
        ))}
      </View>
    </View>
  );
}

export default function ScanScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanState, setScanState] = useState<ScanState>('idle');
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [flash, setFlash] = useState<'off' | 'on'>('off');
  const [textMode, setTextMode] = useState(false);
  const [textQuery, setTextQuery] = useState('');
  const [editedName, setEditedName] = useState('');
  const [editedSearchQuery, setEditedSearchQuery] = useState('');
  const [barcodeScanning, setBarcodeScanning] = useState(false);
  const [lastScannedBarcode, setLastScannedBarcode] = useState<string | null>(null);
  const [scannedItemName, setScannedItemName] = useState<string | null>(null);
  const cameraRef = useRef<CameraView>(null);
  const { claudeApiKey, scanStats, incrementScanCount } = useSettingsStore();
  const { addItem } = useItemStore();
  const params = useLocalSearchParams<{ textQuery?: string }>();

  const canScan = scanStats.scansToday < SCAN_RATE_LIMIT;
  const remainingScans = Math.max(0, SCAN_RATE_LIMIT - scanStats.scansToday);

  useEffect(() => {
    if (params.textQuery) {
      setTextMode(true);
      setTextQuery(params.textQuery);
    }
  }, []);

  const processImage = useCallback(async (uri: string) => {
    if (!canScan) {
      Alert.alert('Limit erreicht', `Maximal ${SCAN_RATE_LIMIT} Scans pro Stunde. Bitte warte etwas.`);
      return;
    }
    if (!claudeApiKey) {
      Alert.alert('Kein API-Key', 'Bitte füge deinen Claude API-Key in den Einstellungen ein.');
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    setScanState('scanning');

    try {
      const claudeResult = await identifyItem(claudeApiKey, uri);
      incrementScanCount();

      setScanResult({
        imageUri: uri,
        claudeResult,
        soldListings: [],
      });
      setEditedName(claudeResult.name);
      setEditedSearchQuery(claudeResult.searchQuery);
      setScanState('confirming');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      setScanState('idle');
      Alert.alert('Scan fehlgeschlagen', String(error));
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  }, [canScan, claudeApiKey, incrementScanCount]);

  const handleCapture = useCallback(async () => {
    if (!cameraRef.current) return;
    try {
      const photo = await cameraRef.current.takePictureAsync({
        base64: false,
        quality: 0.8,
        mute: true,
      });
      if (!photo?.uri) throw new Error('Kein Foto aufgenommen');
      await processImage(photo.uri);
    } catch (error) {
      setScanState('idle');
      Alert.alert('Scan fehlgeschlagen', String(error));
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  }, [processImage]);

  const handleGalleryPick = useCallback(async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      await processImage(result.assets[0].uri);
    }
  }, [processImage]);

  const handleTextSearch = useCallback(() => {
    if (!textQuery.trim()) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    const fakeClaudeResult: ClaudeItemResult = {
      name: textQuery.trim(),
      brand: undefined,
      model: undefined,
      category: 'Sonstiges',
      confidence: 1,
      searchQuery: textQuery.trim(),
      description: textQuery.trim(),
    };

    setScanResult({
      imageUri: '',
      claudeResult: fakeClaudeResult,
      soldListings: [],
    });
    setScanState('fetching-prices');

    // Immediately trigger price fetch
    fetchPricesForResult(fakeClaudeResult);
  }, [textQuery]);

  const fetchPricesForResult = useCallback(async (claudeResult: ClaudeItemResult) => {
    try {
      let soldListings: EbaySoldListing[] = [];
      let ebaySoldAvg: number | undefined;
      let ebaySoldMin: number | undefined;
      let ebaySoldMax: number | undefined;

      const rawListings = await fetchSoldListingsPublic(claudeResult.searchQuery, 10);
      soldListings = rawListings.filter(l => l.price > 0);
      const stats = calculatePriceStats(soldListings);
      ebaySoldAvg = stats.avg > 0 ? stats.avg : undefined;
      ebaySoldMin = stats.min > 0 ? stats.min : undefined;
      ebaySoldMax = stats.max > 0 ? stats.max : undefined;

      const geizhals = await fetchGeizhalsPrice(claudeResult.searchQuery);

      setScanResult((prev) =>
        prev
          ? {
              ...prev,
              soldListings,
              ebaySoldAvg,
              ebaySoldMin,
              ebaySoldMax,
              geizhalsCheapest: geizhals?.cheapestPrice,
              geizhalsUrl: geizhals?.url,
            }
          : null
      );
      setScanState('prices-ready');
    } catch {
      setScanState('confirming');
      Alert.alert('Preisabfrage fehlgeschlagen', 'Preise konnten nicht abgerufen werden.');
    }
  }, []);

  const handleConfirm = useCallback(async () => {
    if (!scanResult) return;
    // Apply any name edits before fetching prices
    const updatedResult = {
      ...scanResult.claudeResult,
      name: editedName.trim() || scanResult.claudeResult.name,
      searchQuery: editedSearchQuery.trim() || scanResult.claudeResult.searchQuery,
    };
    setScanResult((prev) => prev ? { ...prev, claudeResult: updatedResult } : null);
    setScanState('fetching-prices');
    await fetchPricesForResult(updatedResult);
  }, [scanResult, editedName, editedSearchQuery, fetchPricesForResult]);

  const handleSelectAlternative = useCallback((alt: ClaudeAlternative) => {
    setEditedName(alt.name);
    setEditedSearchQuery(alt.searchQuery);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  const handleAddToDashboard = useCallback(() => {
    if (!scanResult) return;
    const now = new Date().toISOString();
    const firstPoint = (scanResult.ebaySoldAvg || scanResult.geizhalsCheapest)
      ? [{
          timestamp: now,
          ebaySoldAvg: scanResult.ebaySoldAvg ?? 0,
          geizhalsCheapest: scanResult.geizhalsCheapest,
        }]
      : [];
    const item: TrackedItem = {
      id: uuidv4(),
      name: scanResult.claudeResult.name,
      brand: scanResult.claudeResult.brand,
      model: scanResult.claudeResult.model,
      category: scanResult.claudeResult.category,
      imageUri: scanResult.imageUri,
      confidence: scanResult.claudeResult.confidence,
      ebaySoldAvg: scanResult.ebaySoldAvg,
      ebaySoldMin: scanResult.ebaySoldMin,
      ebaySoldMax: scanResult.ebaySoldMax,
      ebaySoldCount: scanResult.soldListings.length,
      geizhalsCheapest: scanResult.geizhalsCheapest,
      geizhalsUrl: scanResult.geizhalsUrl,
      lastPriceUpdate: now,
      refreshInterval: 6,
      isFavorite: false,
      addedAt: now,
      updatedAt: now,
      priceHistory: firstPoint,
    };
    addItem(item);
    setScanState('idle');
    setScanResult(null);
    setTextMode(false);
    setTextQuery('');
    router.dismissAll();
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, [scanResult, addItem]);

  const handleDismiss = useCallback(() => {
    setScanState('idle');
    setScanResult(null);
    setEditedName('');
    setEditedSearchQuery('');
    if (textMode) {
      setTextMode(false);
      setTextQuery('');
    }
  }, [textMode]);

  const handleBarcodeScanned = useCallback(({ data, type }: { data: string; type: string }) => {
    if (lastScannedBarcode === data) return; // Debounce: gleichen Code nicht 2x auslösen
    setLastScannedBarcode(data);

    // EAN/UPC direkt als eBay GTIN-Suche verwenden
    const isEan = type === 'ean13' || type === 'ean8' || type === 'upc_a' || type === 'upc_e';
    if (isEan) {
      // Speichere den Barcode für die Preissuche — wird wie ein searchQuery behandelt
      setScannedItemName(`Barcode: ${data}`);
      // Kurz vibrieren
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      // Barcode-Scanning pausieren damit nicht ständig gescannt wird
      setBarcodeScanning(false);
      setTimeout(() => setLastScannedBarcode(null), 3000); // Reset nach 3s
    }
  }, [lastScannedBarcode]);

  if (!permission) {
    return <ThemedView style={styles.container} />;
  }

  if (!permission.granted && !textMode) {
    return (
      <ThemedView style={[styles.container, styles.centered, { paddingTop: insets.top }]}>
        <Text style={{ fontSize: 48 }}>📷</Text>
        <ThemedText weight="bold" size="xl" style={{ marginTop: 16 }}>
          Kamera-Zugriff nötig
        </ThemedText>
        <ThemedText variant="secondary" style={{ marginTop: 8, textAlign: 'center', paddingHorizontal: 32 }}>
          PriceNinja benötigt Kamera-Zugriff um Artikel zu scannen
        </ThemedText>
        <PrimaryButton
          title="Zugriff erlauben"
          onPress={requestPermission}
          style={{ marginTop: 24 }}
        />
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      {/* Text search mode */}
      {textMode && scanState === 'idle' && (
        <View style={[styles.textModeContainer, { paddingTop: insets.top }]}>
          {/* Header */}
          <View style={[styles.textModeHeader, { backgroundColor: 'rgba(0,0,0,0.85)', paddingTop: 16, paddingBottom: 12 }]}>
            <TouchableOpacity
              onPress={handleDismiss}
              style={styles.headerBackBtn}
              accessibilityLabel="Schließen"
            >
              <Text style={styles.headerBackText}>← Schließen</Text>
            </TouchableOpacity>
            <View style={styles.headerCenter}>
              <Text style={styles.headerBrandText}>PriceNinja</Text>
              <Text style={styles.headerSubText}>Loot Scanner</Text>
            </View>
            <View style={{ width: 90 }} />
          </View>

          <View style={styles.textSearchContent}>
            <ThemedText weight="bold" size="xl" style={{ marginBottom: 8 }}>Textsuche</ThemedText>
            <ThemedText variant="secondary" style={{ marginBottom: 24 }}>
              Artikel direkt nach Namen suchen
            </ThemedText>
            <TextInput
              value={textQuery}
              onChangeText={setTextQuery}
              placeholder="z.B. iPhone 14 Pro, Nintendo Switch..."
              placeholderTextColor={theme.colors.text + '66'}
              style={[
                styles.textInput,
                {
                  color: theme.colors.text,
                  borderColor: theme.colors.border,
                  backgroundColor: theme.colors.surface,
                },
              ]}
              autoFocus
              returnKeyType="search"
              onSubmitEditing={handleTextSearch}
              accessibilityLabel="Artikelname eingeben"
            />
            <PrimaryButton
              title="Preise suchen"
              onPress={handleTextSearch}
              style={{ marginTop: 16 }}
            />
            <PrimaryButton
              title="Kamera öffnen"
              variant="outline"
              onPress={() => { setTextMode(false); }}
              style={{ marginTop: 12 }}
            />
          </View>
        </View>
      )}

      {/* Camera view */}
      {!textMode && (scanState === 'idle' || scanState === 'scanning') && (
        <View style={styles.cameraContainer}>
          <CameraView
            ref={cameraRef}
            style={StyleSheet.absoluteFill}
            facing="back"
            flash={flash}
            barcodeScannerSettings={{
              barcodeTypes: ['ean13', 'ean8', 'upc_a', 'qr'],
            }}
            onBarcodeScanned={barcodeScanning ? handleBarcodeScanned : undefined}
          />

          {/* Scan overlay */}
          <View style={[styles.scanOverlay, { borderColor: theme.colors.primary }]} />

          {/* Header overlay — replaces old topBar */}
          <View style={[styles.cameraHeader, { paddingTop: insets.top + 12, backgroundColor: 'rgba(0,0,0,0.6)' }]}>
            <TouchableOpacity
              onPress={() => router.back()}
              style={styles.headerBackBtn}
              accessibilityLabel="Schließen"
            >
              <Text style={styles.headerBackText}>← Schließen</Text>
            </TouchableOpacity>

            <View style={styles.headerCenter}>
              <Text style={styles.headerBrandText}>PriceNinja</Text>
              <Text style={styles.headerSubText}>Loot Scanner</Text>
            </View>

            <TouchableOpacity
              onPress={() => setFlash(flash === 'off' ? 'on' : 'off')}
              style={[styles.flashButton, { backgroundColor: theme.colors.surface + 'cc' }]}
              accessibilityLabel="Blitz umschalten"
            >
              <Text style={{ fontSize: 20 }}>{flash === 'off' ? '🔦' : '💡'}</Text>
            </TouchableOpacity>
          </View>

          {/* Remaining scans badge */}
          <View style={[styles.remainingBadge, { backgroundColor: theme.colors.surface + 'cc', top: insets.top + 72 }]}>
            <ThemedText size="xs" weight="semibold">
              {remainingScans} Scans übrig
            </ThemedText>
          </View>

          {/* Bottom bar: gallery left, capture center */}
          <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 32 }]}>
            {/* Gallery button */}
            <TouchableOpacity
              onPress={handleGalleryPick}
              style={[styles.sideButton, { backgroundColor: theme.colors.surface + 'cc' }]}
              accessibilityLabel="Bild aus Galerie wählen"
            >
              <Text style={{ fontSize: 22 }}>🖼️</Text>
            </TouchableOpacity>

            {/* Capture button */}
            <TouchableOpacity
              onPress={handleCapture}
              disabled={scanState === 'scanning' || !canScan}
              style={[
                styles.captureButton,
                { borderColor: theme.colors.primary },
                (!canScan || scanState === 'scanning') && { opacity: 0.5 },
              ]}
              accessibilityLabel="Foto aufnehmen und scannen"
            >
              {scanState === 'scanning' ? (
                <ActivityIndicator color={theme.colors.primary} size="large" />
              ) : (
                <View style={[styles.captureInner, { backgroundColor: theme.colors.primary }]} />
              )}
            </TouchableOpacity>

            {/* Barcode toggle button */}
            <TouchableOpacity
              onPress={() => {
                setBarcodeScanning((prev) => !prev);
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }}
              accessibilityLabel={barcodeScanning ? 'Barcode-Scan deaktivieren' : 'Barcode-Scan aktivieren'}
              style={[
                styles.sideButton,
                { backgroundColor: barcodeScanning ? theme.colors.primary + 'cc' : theme.colors.surface + 'cc' },
              ]}
            >
              <Ionicons name={barcodeScanning ? 'barcode' : 'barcode-outline'} size={24} color="white" />
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Confirmation / Price Card */}
      {(scanState === 'confirming' || scanState === 'fetching-prices' || scanState === 'prices-ready') && scanResult && (
        <ScrollView
          contentContainerStyle={[styles.resultContainer, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 16 }]}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header */}
          <View style={styles.resultHeader}>
            <TouchableOpacity onPress={handleDismiss} style={styles.headerBackBtn} accessibilityLabel="Zurück">
              <Text style={styles.headerBackText}>← Zurück</Text>
            </TouchableOpacity>
            <View style={styles.headerCenter}>
              <Text style={styles.headerBrandText}>PriceNinja</Text>
              <Text style={[styles.headerSubText, { color: theme.colors.text }]}>Ergebnis</Text>
            </View>
            <View style={{ width: 90 }} />
          </View>

          {/* Confidence badge */}
          <View style={[styles.confidenceBadge, { backgroundColor: theme.colors.primary + '22', borderColor: theme.colors.primary + '55' }]}>
            <ThemedText size="xs" weight="semibold" style={{ color: theme.colors.primary }}>
              KI-Sicherheit: {Math.round(scanResult.claudeResult.confidence * 100)}%
            </ThemedText>
          </View>

          {/* Editable product name card */}
          {scanState === 'confirming' && (
            <GlowCard style={styles.resultCard}>
              <ThemedText variant="muted" size="sm" style={{ marginBottom: 6 }}>
                Ist das richtig? Passe den Namen an:
              </ThemedText>
              <TextInput
                value={editedName}
                onChangeText={setEditedName}
                style={[
                  styles.nameInput,
                  {
                    color: theme.colors.text,
                    borderColor: theme.colors.primary + '66',
                    backgroundColor: theme.colors.surfaceAlt,
                  },
                ]}
                placeholderTextColor={theme.colors.textMuted}
                placeholder="Produktname..."
                accessibilityLabel="Produktname bearbeiten"
              />
              {scanResult.claudeResult.brand && (
                <ThemedText variant="secondary" size="sm" style={{ marginTop: 4 }}>
                  {scanResult.claudeResult.brand}{scanResult.claudeResult.model ? ` · ${scanResult.claudeResult.model}` : ''}
                </ThemedText>
              )}
              <ThemedText variant="muted" size="xs" style={{ marginTop: 2 }}>
                Kategorie: {scanResult.claudeResult.category}
              </ThemedText>

              {/* Alternatives */}
              {(scanResult.claudeResult.alternatives?.length ?? 0) > 0 && (
                <View style={styles.altSection}>
                  <ThemedText variant="muted" size="xs" style={{ marginBottom: 8 }}>
                    Oder meintest du:
                  </ThemedText>
                  <View style={styles.altChips}>
                    {scanResult.claudeResult.alternatives!.map((alt, i) => (
                      <TouchableOpacity
                        key={i}
                        onPress={() => handleSelectAlternative(alt)}
                        style={[
                          styles.altChip,
                          {
                            backgroundColor: editedName === alt.name
                              ? theme.colors.primary + '33'
                              : theme.colors.surfaceAlt,
                            borderColor: editedName === alt.name
                              ? theme.colors.primary
                              : theme.colors.border,
                          },
                        ]}
                        accessibilityLabel={`Alternative: ${alt.name}`}
                      >
                        <ThemedText size="xs" weight={editedName === alt.name ? 'bold' : 'normal'}>
                          {alt.name}
                        </ThemedText>
                        <ThemedText size="xs" variant="muted" style={{ marginTop: 1 }}>
                          {Math.round(alt.confidence * 100)}%
                        </ThemedText>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              )}
            </GlowCard>
          )}

          {/* Confirmed name + image (read-only after price fetch started) */}
          {(scanState === 'fetching-prices' || scanState === 'prices-ready') && (
            <GlowCard style={styles.resultCard}>
              {/* Image preview */}
              {!!scanResult.imageUri && (
                <Image
                  source={{ uri: scanResult.imageUri }}
                  style={styles.resultImage}
                  resizeMode="cover"
                  accessibilityLabel="Gescanntes Bild"
                />
              )}
              <ThemedText weight="bold" size="xl" style={{ marginTop: scanResult.imageUri ? 12 : 0 }}>
                {scanResult.claudeResult.name}
              </ThemedText>
              {scanResult.claudeResult.brand && (
                <ThemedText variant="secondary">
                  {scanResult.claudeResult.brand}{scanResult.claudeResult.model ? ` · ${scanResult.claudeResult.model}` : ''}
                </ThemedText>
              )}
              <View style={styles.tagRow}>
                <View style={[styles.tag, { backgroundColor: theme.colors.primary + '22', borderColor: theme.colors.primary + '55' }]}>
                  <ThemedText size="xs" style={{ color: theme.colors.primary }}>{scanResult.claudeResult.category}</ThemedText>
                </View>
                <View style={[styles.tag, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
                  <ThemedText size="xs" variant="muted">KI {Math.round(scanResult.claudeResult.confidence * 100)}%</ThemedText>
                </View>
              </View>
              {!!scanResult.claudeResult.description && (
                <ThemedText variant="muted" size="sm" style={{ marginTop: 6, lineHeight: 20 }}>
                  {scanResult.claudeResult.description}
                </ThemedText>
              )}
            </GlowCard>
          )}

          {scanState === 'fetching-prices' && (
            <GlowCard style={[styles.resultCard, styles.loadingCard]}>
              <ActivityIndicator color={theme.colors.primary} />
              <ThemedText variant="secondary" style={{ marginTop: 8 }}>
                Preise werden abgerufen...
              </ThemedText>
            </GlowCard>
          )}

          {scanState === 'prices-ready' && (
            <>
              {/* ── Price Comparison Hero ── */}
              <View style={[styles.priceCompareRow, { gap: 10 }]}>
                {/* eBay block */}
                <View style={[
                  styles.priceCompareBlock,
                  {
                    backgroundColor: theme.colors.surface,
                    borderColor: scanResult.ebaySoldAvg ? theme.colors.primary + '55' : theme.colors.border,
                    flex: 1,
                  },
                ]}>
                  <View style={[styles.priceSourceTag, { backgroundColor: theme.colors.primary + '22' }]}>
                    <ThemedText size="xs" weight="bold" style={{ color: theme.colors.primary }}>eBay VERKAUFT</ThemedText>
                  </View>
                  {scanResult.ebaySoldAvg ? (
                    <>
                      <ThemedText weight="bold" style={[styles.priceCompareValue, { color: theme.colors.primary }]}>
                        {formatPrice(scanResult.ebaySoldAvg)}
                      </ThemedText>
                      <ThemedText variant="muted" size="xs">Ø Verkaufspreis</ThemedText>
                      {(scanResult.ebaySoldMin || scanResult.ebaySoldMax) && (
                        <ThemedText variant="muted" size="xs" style={{ marginTop: 3 }}>
                          {formatPrice(scanResult.ebaySoldMin ?? 0)} – {formatPrice(scanResult.ebaySoldMax ?? 0)}
                        </ThemedText>
                      )}
                    </>
                  ) : (
                    <ThemedText variant="muted" size="xs" style={{ marginTop: 6 }}>Kein Account</ThemedText>
                  )}
                </View>

                {/* Geizhals block */}
                <View style={[
                  styles.priceCompareBlock,
                  {
                    backgroundColor: theme.colors.surface,
                    borderColor: scanResult.geizhalsCheapest ? theme.colors.success + '55' : theme.colors.border,
                    flex: 1,
                  },
                ]}>
                  <View style={[styles.priceSourceTag, { backgroundColor: theme.colors.success + '22' }]}>
                    <ThemedText size="xs" weight="bold" style={{ color: theme.colors.success }}>GEIZHALS</ThemedText>
                  </View>
                  {scanResult.geizhalsCheapest ? (
                    <>
                      <ThemedText weight="bold" style={[styles.priceCompareValue, { color: theme.colors.success }]}>
                        {formatPrice(scanResult.geizhalsCheapest)}
                      </ThemedText>
                      <ThemedText variant="muted" size="xs">Günstigster Neupreis</ThemedText>
                      {scanResult.geizhalsUrl && (
                        <TouchableOpacity
                          onPress={() => scanResult.geizhalsUrl && Linking.openURL(scanResult.geizhalsUrl)}
                          accessibilityLabel="Auf Geizhals öffnen"
                          style={{ marginTop: 4 }}
                        >
                          <ThemedText size="xs" style={{ color: theme.colors.success }}>→ geizhals.at</ThemedText>
                        </TouchableOpacity>
                      )}
                    </>
                  ) : (
                    <ThemedText variant="muted" size="xs" style={{ marginTop: 6 }}>Keine Daten</ThemedText>
                  )}
                </View>
              </View>

              {/* ── Price Range Bar ── */}
              {scanResult.ebaySoldAvg && scanResult.ebaySoldMin && scanResult.ebaySoldMax && scanResult.ebaySoldMin !== scanResult.ebaySoldMax && (
                <GlowCard style={styles.resultCard}>
                  <ThemedText variant="muted" size="xs" weight="semibold" style={{ marginBottom: 10, letterSpacing: 1 }}>
                    PREISSPANNE
                  </ThemedText>
                  <View style={styles.rangeBar}>
                    <View style={[styles.rangeTrack, { backgroundColor: theme.colors.border }]} />
                    {(() => {
                      const min = scanResult.ebaySoldMin!;
                      const max = scanResult.ebaySoldMax!;
                      const avg = scanResult.ebaySoldAvg!;
                      const range = max - min;
                      const avgPos = range > 0 ? ((avg - min) / range) * 100 : 50;
                      return (
                        <View
                          style={[
                            styles.rangeIndicator,
                            {
                              left: `${Math.max(2, Math.min(avgPos, 96))}%` as any,
                              backgroundColor: theme.colors.primary,
                              shadowColor: theme.colors.primary,
                            },
                          ]}
                        />
                      );
                    })()}
                  </View>
                  <View style={styles.rangeLabels}>
                    <ThemedText size="xs" variant="muted">{formatPrice(scanResult.ebaySoldMin)}</ThemedText>
                    <ThemedText size="xs" weight="semibold" style={{ color: theme.colors.primary }}>
                      Ø {formatPrice(scanResult.ebaySoldAvg)}
                    </ThemedText>
                    <ThemedText size="xs" variant="muted">{formatPrice(scanResult.ebaySoldMax)}</ThemedText>
                  </View>
                </GlowCard>
              )}

              {/* ── Bild-Carousel aus eBay-Listings ── */}
              {scanResult.soldListings.filter(l => l.imageUrl).length > 0 && (
                <ImageCarousel
                  images={scanResult.soldListings
                    .filter(l => l.imageUrl)
                    .slice(0, 5)
                    .map(l => l.imageUrl as string)}
                />
              )}

              {/* ── Recent sold listings ── */}
              {scanResult.soldListings.length > 0 && (
                <GlowCard style={styles.resultCard}>
                  <View style={[styles.sectionHeader, { marginBottom: 8 }]}>
                    <ThemedText variant="muted" size="xs" weight="semibold" style={{ letterSpacing: 1 }}>
                      LETZTE VERKÄUFE
                    </ThemedText>
                    <ThemedText variant="muted" size="xs">{scanResult.soldListings.length} gefunden</ThemedText>
                  </View>
                  {scanResult.soldListings.slice(0, 6).map((listing, i) => (
                    <View
                      key={i}
                      style={[
                        styles.listingRow,
                        { borderTopColor: theme.colors.border },
                        i === 0 && { borderTopWidth: 0 },
                      ]}
                    >
                      <View style={styles.listingDot}>
                        <View style={[styles.listingDotInner, { backgroundColor: theme.colors.success }]} />
                      </View>
                      <ThemedText size="xs" variant="secondary" style={{ flex: 1 }} numberOfLines={1}>
                        {listing.title}
                      </ThemedText>
                      <View style={[styles.listingPriceBadge, {
                        backgroundColor: theme.colors.success + '18',
                        borderColor: theme.colors.success + '44',
                      }]}>
                        <ThemedText size="xs" weight="bold" style={{ color: theme.colors.success }}>
                          {formatPrice(listing.price)}
                        </ThemedText>
                      </View>
                    </View>
                  ))}
                </GlowCard>
              )}
            </>
          )}

          <View style={styles.actionButtons}>
            {scanState === 'confirming' && (
              <PrimaryButton
                title="Preise abrufen →"
                onPress={handleConfirm}
                style={{ flex: 1 }}
              />
            )}
            {scanState === 'prices-ready' && (
              <PrimaryButton
                title="Zum Dashboard hinzufügen"
                onPress={handleAddToDashboard}
                style={{ flex: 1 }}
              />
            )}
            {scanState !== 'fetching-prices' && (
              <PrimaryButton
                title="Abbrechen"
                variant="outline"
                onPress={handleDismiss}
                style={{ flex: 1 }}
              />
            )}
          </View>
        </ScrollView>
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { alignItems: 'center', justifyContent: 'center' },
  // Camera
  cameraContainer: { flex: 1, position: 'relative' },
  scanOverlay: {
    position: 'absolute',
    top: '20%',
    left: '10%',
    right: '10%',
    bottom: '30%',
    borderWidth: 2,
    borderRadius: 12,
  },
  // Shared header styles (used in camera and text mode)
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
  headerBackBtn: { width: 90, alignItems: 'flex-start' },
  headerBackText: { color: 'white', fontSize: 15, fontWeight: '500' },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerBrandText: { color: '#00ff88', fontWeight: 'bold', fontSize: 18 },
  headerSubText: { color: 'white', fontSize: 12, letterSpacing: 2 },
  flashButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  remainingBadge: {
    position: 'absolute',
    left: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  // Bottom bar
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 40,
  },
  sideButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  captureButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  captureInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
  },
  // Results
  resultContainer: {
    padding: 16,
    gap: 12,
  },
  resultHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  confidenceBadge: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 4,
    marginBottom: 4,
  },
  resultCard: {
    gap: 8,
  },
  loadingCard: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  resultImage: {
    width: '100%',
    height: 200,
    borderRadius: 10,
  },
  tagRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 6,
  },
  tag: {
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  priceHighlight: {
    paddingVertical: 8,
    gap: 2,
  },
  listingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
    borderTopWidth: StyleSheet.hairlineWidth,
    marginTop: 4,
  },
  nameInput: {
    borderWidth: 1.5,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    fontWeight: '600',
  },
  altSection: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(128,128,128,0.3)',
  },
  altChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  altChip: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    maxWidth: '47%',
  },
  // Price compare
  priceCompareRow: {
    flexDirection: 'row',
  },
  priceCompareBlock: {
    borderWidth: 1.5,
    borderRadius: 14,
    padding: 14,
  },
  priceSourceTag: {
    alignSelf: 'flex-start',
    borderRadius: 5,
    paddingHorizontal: 7,
    paddingVertical: 3,
    marginBottom: 8,
  },
  priceCompareValue: {
    fontSize: 26,
    lineHeight: 30,
    fontWeight: '800',
    marginBottom: 2,
  },
  // Price range bar
  rangeBar: {
    height: 20,
    position: 'relative',
    justifyContent: 'center',
    marginBottom: 6,
  },
  rangeTrack: {
    position: 'absolute',
    left: 0, right: 0,
    height: 4,
    borderRadius: 2,
  },
  rangeIndicator: {
    position: 'absolute',
    width: 16,
    height: 16,
    borderRadius: 8,
    marginLeft: -8,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 6,
    elevation: 4,
  },
  rangeLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  // Listing rows
  listingDot: {
    width: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  listingDotInner: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  listingPriceBadge: {
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginLeft: 8,
  },
  // Text mode
  textModeContainer: { flex: 1 },
  textModeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  textSearchContent: {
    flex: 1,
    padding: 24,
    paddingTop: 32,
  },
  textInput: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
  },
});
