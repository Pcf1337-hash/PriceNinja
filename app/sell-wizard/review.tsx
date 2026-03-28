import React from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/src/theme';
import { ThemedView, ThemedText, GlowCard, PrimaryButton } from '@/src/components/ui';
import { useEbayStore } from '@/src/store/useEbayStore';

export default function SellWizardReview() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const { activeAccountType, ownAccount, getPermissions } = useEbayStore();
  const params = useLocalSearchParams<{
    title: string;
    condition: string;
    price: string;
    shipping: string;
    duration: string;
    listingType: string;
    startPrice: string;
  }>();

  const {
    title = '',
    condition = '',
    price = '',
    shipping = '',
    duration = '',
    listingType = 'Festpreis',
    startPrice = '',
  } = params;

  const handleSubmit = () => {
    const permissions = getPermissions();

    if (!ownAccount || activeAccountType !== 'own' || !permissions.canCreateListings) {
      Alert.alert(
        'Eigener eBay-Account benötigt',
        'Du brauchst deinen eigenen eBay-Account zum Verkaufen. Jetzt verbinden?',
        [
          { text: 'Abbrechen', style: 'cancel' },
          {
            text: 'Verbinden',
            onPress: () => {
              router.push('/ebay-wizard/account-type');
            },
          },
        ]
      );
      return;
    }

    Alert.alert(
      'Angebot wird erstellt',
      'Feature kommt bald!',
      [{ text: 'OK' }]
    );
  };

  const handleCancel = () => {
    Alert.alert(
      'Abbrechen',
      'Möchtest du den Verkauf wirklich abbrechen? Alle Eingaben gehen verloren.',
      [
        { text: 'Weiter bearbeiten', style: 'cancel' },
        {
          text: 'Abbrechen',
          style: 'destructive',
          onPress: () => router.dismissAll(),
        },
      ]
    );
  };

  return (
    <ThemedView style={[styles.container, { paddingTop: insets.top }]}>
      <View style={[styles.header, { borderBottomColor: theme.colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} accessibilityLabel="Zurück">
          <ThemedText variant="secondary">← Zurück</ThemedText>
        </TouchableOpacity>
        <View style={{ alignItems: 'center' }}>
          <ThemedText weight="bold" size="lg">Überprüfen</ThemedText>
          <ThemedText variant="muted" size="xs">Schritt 3 von 3</ThemedText>
        </View>
        <View style={{ width: 80 }} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        <ThemedText weight="semibold" style={styles.sectionLabel}>
          Zusammenfassung
        </ThemedText>

        <GlowCard>
          <SummaryRow label="Titel" value={title || '—'} />
          <SummaryRow label="Zustand" value={condition || '—'} />
          <SummaryRow label="Angebotsart" value={listingType || '—'} />
          {listingType === 'Auktion' && startPrice ? (
            <SummaryRow label="Startpreis" value={`€ ${startPrice}`} />
          ) : null}
          <SummaryRow
            label={listingType === 'Auktion' ? 'Sofortkauf' : 'Preis'}
            value={price ? `€ ${price}` : '—'}
          />
          <SummaryRow label="Versand" value={shipping || '—'} />
          <SummaryRow label="Laufzeit" value={duration || '—'} isLast />
        </GlowCard>

        {/* Account status hint */}
        {activeAccountType === 'papa' && (
          <GlowCard glowColor={theme.colors.warning} style={{ marginTop: 16 }}>
            <ThemedText
              variant="secondary"
              size="sm"
              style={{ color: theme.colors.warning }}
            >
              Du nutzt aktuell Papa eBay (nur Preisabfragen). Zum Verkaufen brauchst du
              deinen eigenen eBay-Account.
            </ThemedText>
          </GlowCard>
        )}

        {!ownAccount && activeAccountType !== 'papa' && (
          <GlowCard glowColor={theme.colors.warning} style={{ marginTop: 16 }}>
            <ThemedText variant="secondary" size="sm">
              Kein eBay-Account verbunden. Verbinde deinen eigenen Account um Angebote
              zu erstellen.
            </ThemedText>
          </GlowCard>
        )}

        <PrimaryButton
          title="Jetzt bei eBay einstellen"
          size="lg"
          onPress={handleSubmit}
          style={styles.submitButton}
          accessibilityLabel="Angebot bei eBay einstellen"
        />

        <PrimaryButton
          title="Abbrechen"
          variant="outline"
          size="lg"
          onPress={handleCancel}
          style={styles.cancelButton}
          accessibilityLabel="Verkauf abbrechen"
        />
      </ScrollView>
    </ThemedView>
  );
}

function SummaryRow({
  label,
  value,
  isLast = false,
}: {
  label: string;
  value: string;
  isLast?: boolean;
}) {
  const { theme } = useTheme();
  return (
    <View
      style={[
        styles.summaryRow,
        !isLast && { borderBottomWidth: 1, borderBottomColor: theme.colors.border },
      ]}
    >
      <ThemedText variant="secondary" size="sm">
        {label}
      </ThemedText>
      <ThemedText weight="semibold" size="sm" style={{ flex: 1, textAlign: 'right' }}>
        {value}
      </ThemedText>
    </View>
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
  },
  sectionLabel: {
    marginTop: 20,
    marginBottom: 12,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    gap: 12,
  },
  submitButton: {
    marginTop: 28,
  },
  cancelButton: {
    marginTop: 12,
  },
});
