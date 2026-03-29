import React, { useMemo } from 'react';
import { View, StyleSheet, Text, TouchableOpacity } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/src/theme';
import { ThemedView, ThemedText, GlowCard, PrimaryButton } from '@/src/components/ui';
import { getSelectedAccountType, setSelectedAccountType } from './account-type';

export default function WelcomeScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ accountType?: string }>();

  // If arriving directly from Settings with a pre-selected type, apply it
  const accountType = useMemo(() => {
    if (params.accountType === 'papa' || params.accountType === 'own') {
      setSelectedAccountType(params.accountType);
      return params.accountType;
    }
    return getSelectedAccountType();
  }, [params.accountType]);

  const isPapa = accountType === 'papa';

  return (
    <ThemedView style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} accessibilityLabel="Zurück">
          <Text style={{ color: theme.colors.textSecondary, fontSize: 16 }}>← Zurück</Text>
        </TouchableOpacity>
        <ThemedText variant="muted" size="sm">{params.accountType ? 'Schritt 1 von 3' : 'Schritt 2 von 4'}</ThemedText>
      </View>

      <View style={styles.content}>
        <Text style={{ fontSize: 72, textAlign: 'center', marginBottom: 24 }}>
          {isPapa ? '🔒' : '⭐'}
        </Text>
        <ThemedText weight="bold" size="xxl" style={{ textAlign: 'center', marginBottom: 16 }}>
          {isPapa ? 'Papa eBay' : 'Mein eBay'}
        </ThemedText>
        <ThemedText variant="secondary" style={{ textAlign: 'center', marginBottom: 32, lineHeight: 24 }}>
          {isPapa
            ? 'Du verbindest Papas eBay-Account.\nDamit kannst du Marktpreise checken und einschätzen, wieviel deine Artikel wert sind.'
            : 'Du verbindest deinen eigenen eBay-Account.\nDamit kannst du Preise checken UND Artikel direkt auf eBay verkaufen.'}
        </ThemedText>

        <GlowCard>
          <ThemedText weight="bold" size="lg" style={{ marginBottom: 12 }}>
            Was du brauchst:
          </ThemedText>
          <View style={{ gap: 10 }}>
            <View style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}>
              <Text style={{ color: theme.colors.primary }}>✓</Text>
              <ThemedText variant="secondary">
                {isPapa ? 'Papas eBay Login-Daten' : 'Deine eBay Login-Daten'}
              </ThemedText>
            </View>
            <View style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}>
              <Text style={{ color: theme.colors.primary }}>✓</Text>
              <ThemedText variant="secondary">Fertig — keine API Keys nötig</ThemedText>
            </View>
          </View>
        </GlowCard>

        {isPapa && (
          <GlowCard style={{ marginTop: 16, borderColor: theme.colors.warning + '55' }} glowColor={theme.colors.warning}>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Text style={{ fontSize: 20 }}>⚠️</Text>
              <ThemedText variant="secondary" style={{ flex: 1, lineHeight: 20 }}>
                Dieser Account kann <ThemedText weight="bold" style={{ color: theme.colors.warning }}>keine Listings erstellen</ThemedText>.
                Dafür brauchst du deinen eigenen eBay-Account.
              </ThemedText>
            </View>
          </GlowCard>
        )}
      </View>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
        <PrimaryButton title="Weiter: eBay Login" onPress={() => router.push('/ebay-wizard/login')} style={{ width: '100%' }} />
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16 },
  content: { flex: 1, paddingHorizontal: 20, paddingTop: 8 },
  footer: { paddingHorizontal: 20, paddingTop: 16 },
});
