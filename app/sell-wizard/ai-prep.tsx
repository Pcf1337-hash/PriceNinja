import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Image,
  Text,
  Alert,
  FlatList,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { useTheme } from '@/src/theme';
import { ThemedView, ThemedText, GlowCard, PrimaryButton } from '@/src/components/ui';
import { generateEbayListing, EbayListingDraft } from '@/src/api/claude';
import { fetchSoldListingsPublic } from '@/src/api/ebay';
import { useSettingsStore } from '@/src/store';

type DetailLevel = 'kurz' | 'mittel' | 'ausführlich';
type Condition = 'Neu' | 'Wie Neu' | 'Sehr Gut' | 'Gut' | 'Akzeptabel';

const CONDITIONS: Condition[] = ['Neu', 'Wie Neu', 'Sehr Gut', 'Gut', 'Akzeptabel'];
const MAX_PHOTOS = 12;

export default function SellWizardAiPrep() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const { claudeApiKey } = useSettingsStore();

  const params = useLocalSearchParams<{
    itemName: string;
    itemBrand: string;
    itemModel: string;
    itemCategory: string;
    imageUri: string;
    suggestedPrice: string;
  }>();

  const { itemName = '', itemBrand = '', itemModel = '', itemCategory = '', imageUri = '', suggestedPrice = '' } = params;
  const suggestedNum = parseFloat(suggestedPrice) || 0;

  const [phase, setPhase] = useState<'generating' | 'review' | 'error'>('generating');
  const [draft, setDraft] = useState<EbayListingDraft | null>(null);
  const [errorMsg, setErrorMsg] = useState('');

  // User choices
  const [condition, setCondition] = useState<Condition | null>(null);
  const [detailLevel, setDetailLevel] = useState<DetailLevel>('mittel');
  const [title, setTitle] = useState('');
  const [price, setPrice] = useState(suggestedNum > 0 ? suggestedNum.toFixed(2) : '');

  // Photos
  const [photos, setPhotos] = useState<string[]>(imageUri ? [imageUri] : []);
  const [ebayImages, setEbayImages] = useState<string[]>([]);
  const [loadingImages, setLoadingImages] = useState(false);

  useEffect(() => {
    if (!claudeApiKey) {
      setErrorMsg('Kein Claude API-Key. Bitte in den Einstellungen eingeben.');
      setPhase('error');
      return;
    }
    generateEbayListing(
      claudeApiKey,
      itemName,
      itemBrand || undefined,
      itemModel || undefined,
      itemCategory || 'Sonstiges',
      suggestedNum > 0 ? suggestedNum : undefined,
      'Gebraucht',
    )
      .then(d => {
        setDraft(d);
        setTitle(d.title);
        setPhase('review');
      })
      .catch(e => {
        setErrorMsg(String(e));
        setPhase('error');
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fetch eBay image suggestions after entering review phase
  useEffect(() => {
    if (phase !== 'review' || !itemName) return;
    setLoadingImages(true);
    fetchSoldListingsPublic(`${itemBrand} ${itemName}`.trim(), 15)
      .then(listings => {
        const urls = listings
          .map(l => l.imageUrl)
          .filter((u): u is string => !!u && u.startsWith('http'));
        // Deduplicate
        setEbayImages([...new Set(urls)].slice(0, 12));
      })
      .catch(() => {})
      .finally(() => setLoadingImages(false));
  }, [phase, itemName, itemBrand]);

  const handleAddFromGallery = useCallback(async () => {
    if (photos.length >= MAX_PHOTOS) {
      Alert.alert('Limit', `Maximal ${MAX_PHOTOS} Fotos erlaubt.`);
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      quality: 0.85,
      selectionLimit: MAX_PHOTOS - photos.length,
    });
    if (!result.canceled) {
      const newUris = result.assets.map(a => a.uri);
      setPhotos(prev => [...prev, ...newUris].slice(0, MAX_PHOTOS));
    }
  }, [photos.length]);

  const handleAddEbayImage = useCallback((url: string) => {
    if (photos.includes(url)) {
      setPhotos(prev => prev.filter(p => p !== url));
    } else {
      if (photos.length >= MAX_PHOTOS) {
        Alert.alert('Limit', `Maximal ${MAX_PHOTOS} Fotos erlaubt.`);
        return;
      }
      setPhotos(prev => [...prev, url]);
    }
  }, [photos]);

  const handleRemovePhoto = useCallback((uri: string) => {
    setPhotos(prev => prev.filter(p => p !== uri));
  }, []);

  const getDescription = () => {
    if (!draft) return '';
    if (detailLevel === 'kurz') return draft.shortDescription;
    if (detailLevel === 'ausführlich') return draft.longDescription;
    return draft.mediumDescription;
  };

  const handleNext = () => {
    if (!draft || !condition) return;
    router.push({
      pathname: '/sell-wizard/pricing',
      params: {
        itemName,
        itemBrand,
        itemModel,
        suggestedPrice,
        condition,
        title,
        description: getDescription(),
        photoUris: JSON.stringify(photos),
      },
    });
  };

  const canProceed = condition !== null && title.trim().length > 0;

  // ── Generating ──
  if (phase === 'generating') {
    return (
      <ThemedView style={[styles.container, { paddingTop: insets.top }]}>
        <View style={[styles.header, { borderBottomColor: theme.colors.border }]}>
          <TouchableOpacity onPress={() => router.back()}>
            <ThemedText variant="secondary">← Abbrechen</ThemedText>
          </TouchableOpacity>
          <View style={{ alignItems: 'center' }}>
            <ThemedText weight="bold" size="lg">KI bereitet Angebot vor</ThemedText>
            <ThemedText variant="muted" size="xs">Schritt 1 von 3</ThemedText>
          </View>
          <View style={{ width: 80 }} />
        </View>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 20 }}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <ThemedText variant="secondary">Claude analysiert und schreibt das Angebot...</ThemedText>
          {imageUri ? (
            <Image source={{ uri: imageUri }} style={{ width: 120, height: 120, borderRadius: 10, opacity: 0.5 }} resizeMode="cover" />
          ) : null}
        </View>
      </ThemedView>
    );
  }

  // ── Error ──
  if (phase === 'error') {
    return (
      <ThemedView style={[styles.container, { paddingTop: insets.top }]}>
        <View style={[styles.header, { borderBottomColor: theme.colors.border }]}>
          <TouchableOpacity onPress={() => router.back()}>
            <ThemedText variant="secondary">← Zurück</ThemedText>
          </TouchableOpacity>
          <ThemedText weight="bold" size="lg">Fehler</ThemedText>
          <View style={{ width: 80 }} />
        </View>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 16 }}>
          <Text style={{ fontSize: 48 }}>⚠️</Text>
          <ThemedText weight="bold" style={{ textAlign: 'center' }}>KI-Generierung fehlgeschlagen</ThemedText>
          <ThemedText variant="muted" size="sm" style={{ textAlign: 'center' }}>{errorMsg}</ThemedText>
          <PrimaryButton title="Manuell ausfüllen" onPress={() => {
            setDraft({
              title: [itemBrand, itemName].filter(Boolean).join(' '),
              shortDescription: `Biete ${itemName} an. Privatverkauf.`,
              mediumDescription: `Biete ${itemName}${itemBrand ? ` von ${itemBrand}` : ''} an.\n\nPrivatverkauf – keine Garantie, keine Rücknahme.`,
              longDescription: `Biete ${itemName}${itemBrand ? ` von ${itemBrand}` : ''} an.\n\nPrivatverkauf – keine Garantie, keine Rücknahme.\nVersand nach Absprache.`,
              suggestedKeywords: [itemName, itemBrand ?? '', itemCategory ?? ''].filter(Boolean),
              categoryHint: itemCategory || 'Sonstiges',
            });
            setTitle([itemBrand, itemName].filter(Boolean).join(' ').slice(0, 80));
            setPhase('review');
          }} style={{ marginTop: 8 }} />
        </View>
      </ThemedView>
    );
  }

  // ── Review ──
  return (
    <ThemedView style={[styles.container, { paddingTop: insets.top }]}>
      <View style={[styles.header, { borderBottomColor: theme.colors.border }]}>
        <TouchableOpacity onPress={() => router.back()}>
          <ThemedText variant="secondary">← Abbrechen</ThemedText>
        </TouchableOpacity>
        <View style={{ alignItems: 'center' }}>
          <ThemedText weight="bold" size="lg">Angebot prüfen</ThemedText>
          <ThemedText variant="muted" size="xs">Schritt 1 von 3</ThemedText>
        </View>
        <View style={{ width: 80 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">

        {/* KI-Badge */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <View style={{ backgroundColor: theme.colors.primary + '22', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 }}>
            <ThemedText size="xs" style={{ color: theme.colors.primary }}>⚡ Von Claude generiert</ThemedText>
          </View>
          {draft?.categoryHint && (
            <ThemedText variant="muted" size="xs">{draft.categoryHint}</ThemedText>
          )}
        </View>

        {/* ── Fotos ── */}
        <ThemedText weight="semibold" style={styles.label}>
          Fotos ({photos.length}/{MAX_PHOTOS})
        </ThemedText>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingVertical: 4 }}>
          {photos.map((uri, i) => (
            <View key={uri + i} style={styles.photoThumb}>
              <Image source={{ uri }} style={styles.photoThumbImg} resizeMode="cover" />
              <TouchableOpacity
                onPress={() => handleRemovePhoto(uri)}
                style={styles.photoRemoveBtn}
                accessibilityLabel="Foto entfernen"
              >
                <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>✕</Text>
              </TouchableOpacity>
              {i === 0 && (
                <View style={[styles.photoBadge, { backgroundColor: theme.colors.primary }]}>
                  <Text style={{ color: '#000', fontSize: 9, fontWeight: '700' }}>TITEL</Text>
                </View>
              )}
            </View>
          ))}
          {photos.length < MAX_PHOTOS && (
            <TouchableOpacity
              onPress={handleAddFromGallery}
              style={[styles.addPhotoBtn, { borderColor: theme.colors.border, backgroundColor: theme.colors.surface }]}
              accessibilityLabel="Foto aus Galerie hinzufügen"
            >
              <Text style={{ color: theme.colors.primary, fontSize: 28 }}>＋</Text>
              <ThemedText variant="muted" size="xs" style={{ textAlign: 'center', marginTop: 4 }}>Galerie</ThemedText>
            </TouchableOpacity>
          )}
        </ScrollView>

        {/* ── eBay Bildvorschläge ── */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 16, marginBottom: 8 }}>
          <ThemedText weight="semibold">Bildvorschläge von eBay</ThemedText>
          {loadingImages && <ActivityIndicator size="small" color={theme.colors.primary} />}
        </View>
        {ebayImages.length > 0 ? (
          <FlatList
            horizontal
            data={ebayImages}
            keyExtractor={(u, i) => u + i}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 10, paddingVertical: 4 }}
            renderItem={({ item: url }) => {
              const selected = photos.includes(url);
              return (
                <TouchableOpacity
                  onPress={() => handleAddEbayImage(url)}
                  style={[
                    styles.ebayThumb,
                    {
                      borderColor: selected ? theme.colors.primary : theme.colors.border,
                      borderWidth: selected ? 2 : 1,
                    },
                  ]}
                  accessibilityLabel={selected ? 'Bild entfernen' : 'Bild hinzufügen'}
                >
                  <Image source={{ uri: url }} style={styles.ebayThumbImg} resizeMode="cover" />
                  {selected && (
                    <View style={[styles.ebaySelectedBadge, { backgroundColor: theme.colors.primary }]}>
                      <Text style={{ color: '#000', fontSize: 14, fontWeight: '700' }}>✓</Text>
                    </View>
                  )}
                </TouchableOpacity>
              );
            }}
          />
        ) : !loadingImages ? (
          <ThemedText variant="muted" size="sm">Keine Vorschläge gefunden</ThemedText>
        ) : null}
        <ThemedText variant="muted" size="xs" style={{ marginTop: 6 }}>
          Tippe auf ein Bild um es zu deinem Angebot hinzuzufügen
        </ThemedText>

        {/* Titel */}
        <ThemedText weight="semibold" style={styles.label}>Titel</ThemedText>
        <GlowCard style={styles.inputCard}>
          <TextInput
            value={title}
            onChangeText={t => setTitle(t.slice(0, 80))}
            placeholder="Artikeltitel..."
            placeholderTextColor={theme.colors.textMuted}
            maxLength={80}
            style={[styles.textInput, { color: theme.colors.text }]}
            accessibilityLabel="Artikeltitel eingeben"
          />
          <ThemedText variant="muted" size="xs" style={{ textAlign: 'right', marginTop: 4 }}>
            {title.length} / 80
          </ThemedText>
        </GlowCard>

        {/* Zustand */}
        <ThemedText weight="semibold" style={styles.label}>Zustand</ThemedText>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
          {CONDITIONS.map(c => (
            <TouchableOpacity
              key={c}
              onPress={() => setCondition(c)}
              accessibilityLabel={`Zustand ${c}`}
              style={[styles.chip, {
                backgroundColor: condition === c ? theme.colors.surface : 'transparent',
                borderColor: condition === c ? theme.colors.primary : theme.colors.border,
                borderWidth: condition === c ? 2 : 1,
              }]}
            >
              <ThemedText size="sm" weight={condition === c ? 'semibold' : 'normal'}
                style={{ color: condition === c ? theme.colors.primary : theme.colors.text }}>
                {c}
              </ThemedText>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Preis */}
        <ThemedText weight="semibold" style={styles.label}>Startpreis</ThemedText>
        <GlowCard style={styles.inputCard}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <ThemedText weight="bold" size="lg" style={{ color: theme.colors.primary }}>€</ThemedText>
            <TextInput
              value={price}
              onChangeText={setPrice}
              placeholder="0,00"
              placeholderTextColor={theme.colors.textMuted}
              keyboardType="decimal-pad"
              style={[styles.priceInput, { color: theme.colors.text }]}
              accessibilityLabel="Preis eingeben"
            />
          </View>
          {suggestedNum > 0 && (
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 6 }}>
              <ThemedText variant="muted" size="xs">eBay Ø: €{suggestedNum.toFixed(2)}</ThemedText>
              <TouchableOpacity onPress={() => setPrice(suggestedNum.toFixed(2))}>
                <ThemedText size="xs" style={{ color: theme.colors.primary }}>Übernehmen</ThemedText>
              </TouchableOpacity>
            </View>
          )}
        </GlowCard>

        {/* Beschreibungs-Detail */}
        <ThemedText weight="semibold" style={styles.label}>Beschreibung</ThemedText>
        <View style={[styles.chipRow, { marginBottom: 8 }]}>
          {(['kurz', 'mittel', 'ausführlich'] as DetailLevel[]).map(d => (
            <TouchableOpacity
              key={d}
              onPress={() => setDetailLevel(d)}
              accessibilityLabel={`Beschreibung ${d}`}
              style={[styles.chip, {
                backgroundColor: detailLevel === d ? theme.colors.primary : 'transparent',
                borderColor: detailLevel === d ? theme.colors.primary : theme.colors.border,
                borderWidth: 1,
              }]}
            >
              <ThemedText size="sm" weight={detailLevel === d ? 'semibold' : 'normal'}
                style={{ color: detailLevel === d ? theme.colors.background : theme.colors.text }}>
                {d.charAt(0).toUpperCase() + d.slice(1)}
              </ThemedText>
            </TouchableOpacity>
          ))}
        </View>
        <GlowCard style={styles.inputCard}>
          <ThemedText size="sm" style={{ color: theme.colors.text, lineHeight: 20 }}>
            {getDescription()}
          </ThemedText>
        </GlowCard>

        <PrimaryButton
          title="Weiter: Preis & Versand →"
          size="lg"
          disabled={!canProceed}
          onPress={handleNext}
          style={{ marginTop: 28 }}
          accessibilityLabel="Weiter zu Preis und Versand"
        />
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1,
  },
  content: { paddingHorizontal: 20, paddingBottom: 40, gap: 8 },
  label: { marginTop: 20, marginBottom: 8 },
  inputCard: { padding: 12 },
  textInput: { fontSize: 15, paddingVertical: 4 },
  priceInput: { flex: 1, fontSize: 22, fontWeight: '600', paddingVertical: 4 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  chip: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 24 },
  // Photos
  photoThumb: { width: 90, height: 90, borderRadius: 10, overflow: 'visible', position: 'relative' },
  photoThumbImg: { width: 90, height: 90, borderRadius: 10 },
  photoRemoveBtn: {
    position: 'absolute', top: -8, right: -8,
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: 'rgba(0,0,0,0.75)',
    alignItems: 'center', justifyContent: 'center',
    zIndex: 10,
  },
  photoBadge: {
    position: 'absolute', bottom: 4, left: 4,
    paddingHorizontal: 5, paddingVertical: 2, borderRadius: 4,
  },
  addPhotoBtn: {
    width: 90, height: 90, borderRadius: 10, borderWidth: 1,
    borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center',
  },
  ebayThumb: { width: 80, height: 80, borderRadius: 8, overflow: 'hidden', position: 'relative' },
  ebayThumbImg: { width: '100%', height: '100%' },
  ebaySelectedBadge: {
    position: 'absolute', inset: 0,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
});
