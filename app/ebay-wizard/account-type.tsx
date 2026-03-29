import React from 'react';
import { View, StyleSheet, TouchableOpacity, Text } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/src/theme';
import { ThemedView, ThemedText, GlowCard, PrimaryButton } from '@/src/components/ui';
import { useEbayStore } from '@/src/store/useEbayStore';

// Shared wizard state via module-level variable (simple, no extra deps)
let selectedAccountType: 'papa' | 'own' = 'papa';
export function getSelectedAccountType() { return selectedAccountType; }
export function setSelectedAccountType(type: 'papa' | 'own') { selectedAccountType = type; }

export default function AccountTypeScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const [selected, setSelected] = React.useState<'papa' | 'own' | null>(null);

  const handleSelect = (type: 'papa' | 'own') => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelected(type);
    selectedAccountType = type;
  };

  const handleNext = () => {
    if (!selected) return;
    router.push('/ebay-wizard/welcome');
  };

  return (
    <ThemedView style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} accessibilityLabel="Zurück">
          <Text style={{ color: theme.colors.textSecondary, fontSize: 16 }}>← Zurück</Text>
        </TouchableOpacity>
        <ThemedText variant="muted" size="sm">Schritt 1 von 5</ThemedText>
      </View>

      <View style={styles.content}>
        <ThemedText weight="bold" size="xxl" style={{ marginBottom: 8 }}>
          eBay verbinden
        </ThemedText>
        <ThemedText variant="secondary" style={{ marginBottom: 32 }}>
          Welchen Account möchtest du verbinden?
        </ThemedText>

        {/* Papa eBay Option */}
        <TouchableOpacity
          onPress={() => handleSelect('papa')}
          accessibilityLabel="Papa eBay Account wählen, nur Preisabfrage"
          activeOpacity={0.8}
        >
          <GlowCard
            style={[
              styles.optionCard,
              selected === 'papa' && { borderColor: theme.colors.warning, borderWidth: 2 },
            ]}
            glowColor={theme.colors.warning}
            intensity={selected === 'papa' ? 'medium' : 'low'}
          >
            <View style={styles.optionHeader}>
              <Text style={{ fontSize: 36 }}>🔒</Text>
              <View style={{ flex: 1 }}>
                <ThemedText weight="bold" size="lg">Papa eBay</ThemedText>
                <View style={[styles.badge, { backgroundColor: theme.colors.warning + '33' }]}>
                  <ThemedText size="xs" style={{ color: theme.colors.warning }} weight="semibold">
                    NUR PREISABFRAGE
                  </ThemedText>
                </View>
              </View>
              {selected === 'papa' && <Text style={{ fontSize: 24, color: theme.colors.warning }}>✓</Text>}
            </View>
            <ThemedText variant="secondary" size="sm" style={{ marginTop: 12, lineHeight: 20 }}>
              Verbinde Papas eBay-Account. Du kannst damit Marktpreise für deine Artikel checken.
              {'\n\n'}
              ⚠️ Listings erstellen ist mit diesem Account <ThemedText weight="bold" style={{ color: theme.colors.warning }}>nicht möglich</ThemedText>.
            </ThemedText>
          </GlowCard>
        </TouchableOpacity>

        {/* Own Account Option */}
        <TouchableOpacity
          onPress={() => handleSelect('own')}
          accessibilityLabel="Eigenen eBay Account wählen, Preise und Verkaufen"
          activeOpacity={0.8}
          style={{ marginTop: 16 }}
        >
          <GlowCard
            style={[
              styles.optionCard,
              selected === 'own' && { borderColor: theme.colors.primary, borderWidth: 2 },
            ]}
            glowColor={theme.colors.primary}
            intensity={selected === 'own' ? 'medium' : 'low'}
          >
            <View style={styles.optionHeader}>
              <Text style={{ fontSize: 36 }}>⭐</Text>
              <View style={{ flex: 1 }}>
                <ThemedText weight="bold" size="lg">Mein eBay</ThemedText>
                <View style={[styles.badge, { backgroundColor: theme.colors.primary + '33' }]}>
                  <ThemedText size="xs" style={{ color: theme.colors.primary }} weight="semibold">
                    PREISE + VERKAUFEN
                  </ThemedText>
                </View>
              </View>
              {selected === 'own' && <Text style={{ fontSize: 24, color: theme.colors.primary }}>✓</Text>}
            </View>
            <ThemedText variant="secondary" size="sm" style={{ marginTop: 12, lineHeight: 20 }}>
              Verbinde deinen eigenen eBay-Account für den vollen Funktionsumfang: Preise checken UND Artikel direkt zum Verkauf einstellen.
            </ThemedText>
          </GlowCard>
        </TouchableOpacity>
      </View>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
        <PrimaryButton
          title="Weiter"
          onPress={handleNext}
          disabled={!selected}
          style={{ width: '100%' }}
        />
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  optionCard: {
    padding: 20,
  },
  optionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    marginTop: 4,
    alignSelf: 'flex-start',
  },
  footer: {
    paddingHorizontal: 20,
    paddingTop: 16,
  },
});
