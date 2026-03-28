import React, { useState } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  TextInput,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/src/theme';
import { ThemedView, ThemedText, GlowCard, PrimaryButton } from '@/src/components/ui';

type Condition = 'Neu' | 'Wie Neu' | 'Sehr Gut' | 'Gut' | 'Akzeptabel';

const CONDITIONS: Condition[] = ['Neu', 'Wie Neu', 'Sehr Gut', 'Gut', 'Akzeptabel'];

export default function SellWizardIndex() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{
    itemName: string;
    itemBrand: string;
    itemModel: string;
    suggestedPrice: string;
  }>();

  const { itemName = '', itemBrand = '', itemModel = '', suggestedPrice = '' } = params;

  const defaultTitle = [itemName, itemBrand].filter(Boolean).join(' ');
  const defaultDescription = [
    `Biete hier ${itemName}${itemBrand ? ` von ${itemBrand}` : ''} an.`,
    'Zustand: [wird aus Auswahl übernommen]',
    itemModel ? `Modell: ${itemModel}` : '',
    '',
    'Privatverkauf - keine Garantie/Rücknahme.',
  ]
    .filter((line, idx, arr) => !(line === '' && arr[idx - 1] === ''))
    .join('\n');

  const [condition, setCondition] = useState<Condition | null>(null);
  const [title, setTitle] = useState(defaultTitle);
  const [description, setDescription] = useState(defaultDescription);

  const handleConditionSelect = (c: Condition) => {
    setCondition(c);
    // Update description condition line
    setDescription((prev) =>
      prev.replace(/Zustand: .*/, `Zustand: ${c}`)
    );
  };

  const handleNext = () => {
    if (!condition) return;
    router.push({
      pathname: '/sell-wizard/pricing',
      params: {
        itemName,
        itemBrand,
        itemModel,
        suggestedPrice,
        condition,
        title,
        description,
      },
    });
  };

  return (
    <ThemedView style={[styles.container, { paddingTop: insets.top }]}>
      <View style={[styles.header, { borderBottomColor: theme.colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} accessibilityLabel="Abbrechen">
          <ThemedText variant="secondary">← Abbrechen</ThemedText>
        </TouchableOpacity>
        <View style={{ alignItems: 'center' }}>
          <ThemedText weight="bold" size="lg">Bei eBay Verkaufen</ThemedText>
          <ThemedText variant="muted" size="xs">Schritt 1 von 3</ThemedText>
        </View>
        <View style={{ width: 80 }} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        {/* Condition selector */}
        <ThemedText weight="semibold" style={styles.label}>
          Zustand
        </ThemedText>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.conditionRow}
        >
          {CONDITIONS.map((c) => (
            <TouchableOpacity
              key={c}
              onPress={() => handleConditionSelect(c)}
              accessibilityLabel={`Zustand ${c} auswählen`}
              style={[
                styles.conditionChip,
                {
                  backgroundColor: condition === c ? theme.colors.surface : 'transparent',
                  borderColor: condition === c ? theme.colors.primary : theme.colors.border,
                  borderWidth: condition === c ? 2 : 1,
                },
              ]}
            >
              <ThemedText
                size="sm"
                weight={condition === c ? 'semibold' : 'normal'}
                style={{ color: condition === c ? theme.colors.primary : theme.colors.text }}
              >
                {c}
              </ThemedText>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Title field */}
        <ThemedText weight="semibold" style={styles.label}>
          Titel
        </ThemedText>
        <GlowCard style={styles.inputCard}>
          <TextInput
            value={title}
            onChangeText={(t) => setTitle(t.slice(0, 80))}
            placeholder="Artikeltitel..."
            placeholderTextColor={theme.colors.textMuted}
            maxLength={80}
            style={[styles.textInput, { color: theme.colors.text }]}
            accessibilityLabel="Artikeltitel eingeben"
          />
          <ThemedText
            variant="muted"
            size="xs"
            style={{ textAlign: 'right', marginTop: 4 }}
          >
            {title.length} / 80
          </ThemedText>
        </GlowCard>

        {/* Description textarea */}
        <ThemedText weight="semibold" style={styles.label}>
          Beschreibung
        </ThemedText>
        <GlowCard style={styles.inputCard}>
          <TextInput
            value={description}
            onChangeText={setDescription}
            placeholder="Beschreibung..."
            placeholderTextColor={theme.colors.textMuted}
            multiline
            numberOfLines={6}
            textAlignVertical="top"
            style={[styles.textArea, { color: theme.colors.text }]}
            accessibilityLabel="Artikelbeschreibung eingeben"
          />
        </GlowCard>

        <PrimaryButton
          title="Weiter"
          size="lg"
          disabled={!condition || title.trim().length === 0}
          onPress={handleNext}
          style={styles.nextButton}
          accessibilityLabel="Weiter zu Preis und Versand"
        />
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 40,
    gap: 8,
  },
  label: {
    marginTop: 20,
    marginBottom: 8,
  },
  conditionRow: {
    gap: 10,
    paddingVertical: 4,
  },
  conditionChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 24,
  },
  inputCard: {
    padding: 12,
  },
  textInput: {
    fontSize: 15,
    paddingVertical: 4,
  },
  textArea: {
    fontSize: 14,
    minHeight: 120,
    paddingTop: 4,
  },
  nextButton: {
    marginTop: 28,
  },
});
