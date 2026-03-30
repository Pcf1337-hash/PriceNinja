import React, { useState, useEffect } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Image,
  Text,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/src/theme';
import { ThemedView, ThemedText, GlowCard, PrimaryButton } from '@/src/components/ui';
import { generateEbayListing, EbayListingDraft } from '@/src/api/claude';
import { useSettingsStore } from '@/src/store';

type DetailLevel = 'kurz' | 'mittel' | 'ausführlich';
type Condition = 'Neu' | 'Wie Neu' | 'Sehr Gut' | 'Gut' | 'Akzeptabel';

const CONDITIONS: Condition[] = ['Neu', 'Wie Neu', 'Sehr Gut', 'Gut', 'Akzeptabel'];

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
      },
    });
  };

  const canProceed = condition !== null && title.trim().length > 0 && price.length > 0;

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
              mediumDescription: `Biete ${itemName}${itemBrand ? ` von ${itemBrand}` : ''} an.\n\nZustand: [bitte auswählen]\n\nPrivatverkauf – keine Garantie, keine Rücknahme.`,
              longDescription: `Biete ${itemName}${itemBrand ? ` von ${itemBrand}` : ''} an.\n\nZustand: [bitte auswählen]\nLieferumfang: [bitte ergänzen]\n\nPrivatverkauf – keine Garantie, keine Rücknahme.\nVersand nach Absprache.`,
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

        {/* Foto */}
        {imageUri ? (
          <View style={{ alignItems: 'center', marginBottom: 8 }}>
            <Image source={{ uri: imageUri }} style={{ width: 100, height: 100, borderRadius: 10 }} resizeMode="cover" />
          </View>
        ) : null}

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
        <ThemedText weight="semibold" style={styles.label}>Preis</ThemedText>
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
});
