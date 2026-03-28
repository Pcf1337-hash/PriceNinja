import React from 'react';
import { View, StyleSheet, Text } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useEffect } from 'react';
import { useTheme } from '@/src/theme';
import { ThemedView, ThemedText, GlowCard, PrimaryButton } from '@/src/components/ui';
import { getSelectedAccountType } from './account-type';

export default function DoneScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const accountType = getSelectedAccountType();
  const isPapa = accountType === 'papa';

  useEffect(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, []);

  return (
    <ThemedView style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.content}>
        <Text style={{ fontSize: 80, textAlign: 'center' }}>🎉</Text>

        <ThemedText weight="bold" size="xxl" style={{ textAlign: 'center', marginTop: 24 }}>
          Verbunden!
        </ThemedText>

        <GlowCard style={{ marginTop: 32, alignItems: 'center', gap: 8 }} glowColor={isPapa ? theme.colors.warning : theme.colors.primary} intensity="high">
          <Text style={{ fontSize: 40 }}>{isPapa ? '🔒' : '⭐'}</Text>
          <ThemedText weight="bold" size="lg">
            {isPapa ? 'Papa eBay verbunden' : 'Mein eBay verbunden'}
          </ThemedText>
          <View style={[styles.statusBadge, { backgroundColor: (isPapa ? theme.colors.warning : theme.colors.primary) + '33' }]}>
            <Text style={{ color: isPapa ? theme.colors.warning : theme.colors.primary, fontWeight: 'bold', fontSize: 12 }}>
              {isPapa ? '✓ NUR PREISABFRAGE' : '✓ PREISE + VERKAUFEN'}
            </Text>
          </View>
        </GlowCard>

        {isPapa && (
          <GlowCard style={{ marginTop: 16, borderColor: theme.colors.warning + '44' }} glowColor={theme.colors.warning}>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Text>ℹ️</Text>
              <ThemedText variant="secondary" style={{ flex: 1, lineHeight: 20 }}>
                Mit Papa eBay kannst du Preise für alle deine Artikel checken. Um Artikel zu verkaufen, verbinde deinen eigenen eBay-Account in den Einstellungen.
              </ThemedText>
            </View>
          </GlowCard>
        )}

        {!isPapa && (
          <GlowCard style={{ marginTop: 16 }}>
            <View style={{ gap: 8 }}>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <Text style={{ color: theme.colors.primary }}>✓</Text>
                <ThemedText variant="secondary">Marktpreise abrufen</ThemedText>
              </View>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <Text style={{ color: theme.colors.primary }}>✓</Text>
                <ThemedText variant="secondary">Artikel auf eBay verkaufen</ThemedText>
              </View>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <Text style={{ color: theme.colors.primary }}>✓</Text>
                <ThemedText variant="secondary">Listings direkt aus der App erstellen</ThemedText>
              </View>
            </View>
          </GlowCard>
        )}
      </View>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
        <PrimaryButton
          title="Zurück zu den Einstellungen"
          onPress={() => router.replace('/(tabs)/settings')}
          style={{ width: '100%' }}
        />
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { flex: 1, paddingHorizontal: 20, justifyContent: 'center' },
  statusBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  footer: { paddingHorizontal: 20, paddingTop: 16 },
});
