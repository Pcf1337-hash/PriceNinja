import React from 'react';
import {
  View, ScrollView, StyleSheet, TouchableOpacity, Text, Alert
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/src/theme';
import { useCardStore } from '@/src/store';
import { ThemedView, ThemedText, GlowCard, PrimaryButton } from '@/src/components/ui';
import { formatPrice } from '@/src/utils/pricing';

export default function CardDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const { getCardById, removeCard, toggleFavorite } = useCardStore();
  const card = getCardById(id);

  if (!card) {
    return (
      <ThemedView style={[styles.container, styles.centered]}>
        <ThemedText>Karte nicht gefunden</ThemedText>
        <PrimaryButton title="Zurück" onPress={() => router.back()} style={{ marginTop: 16 }} />
      </ThemedView>
    );
  }

  const handleDelete = () => {
    Alert.alert('Karte löschen', `"${card.name}" wirklich löschen?`, [
      { text: 'Abbrechen', style: 'cancel' },
      { text: 'Löschen', style: 'destructive', onPress: () => { removeCard(id); router.back(); } },
    ]);
  };

  const gameEmoji: Record<string, string> = {
    pokemon: '⚡',
    yugioh: '🃏',
    magic: '🔮',
    other: '♦',
  };

  return (
    <ThemedView style={[styles.container, { paddingTop: insets.top }]}>
      <View style={[styles.header, { borderBottomColor: theme.colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} accessibilityLabel="Zurück">
          <Text style={{ color: theme.colors.textSecondary, fontSize: 16 }}>← Zurück</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => toggleFavorite(card.id)}
          accessibilityLabel={card.isFavorite ? 'Von Favoriten entfernen' : 'Zu Favoriten hinzufügen'}
        >
          <Text style={{ fontSize: 24 }}>{card.isFavorite ? '⭐' : '☆'}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, gap: 16, paddingBottom: insets.bottom + 80 }}>
        <GlowCard>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 8 }}>
            <Text style={{ fontSize: 36 }}>{gameEmoji[card.game] ?? '♦'}</Text>
            <View style={{ flex: 1 }}>
              <ThemedText weight="bold" size="xl">{card.name}</ThemedText>
              <ThemedText variant="secondary">{card.game.toUpperCase()}</ThemedText>
            </View>
          </View>
          {card.setName && (
            <View style={styles.infoRow}>
              <ThemedText variant="secondary">Set</ThemedText>
              <ThemedText>{card.setName}</ThemedText>
            </View>
          )}
          {card.cardNumber && (
            <View style={styles.infoRow}>
              <ThemedText variant="secondary">Nummer</ThemedText>
              <ThemedText>{card.cardNumber}</ThemedText>
            </View>
          )}
          {card.rarity && (
            <View style={styles.infoRow}>
              <ThemedText variant="secondary">Seltenheit</ThemedText>
              <ThemedText>{card.rarity}</ThemedText>
            </View>
          )}
          {card.condition && (
            <View style={styles.infoRow}>
              <ThemedText variant="secondary">Zustand</ThemedText>
              <ThemedText>{card.condition}</ThemedText>
            </View>
          )}
          <ThemedText variant="muted" size="xs" style={{ marginTop: 8 }}>
            Gescannt: {new Date(card.scannedAt).toLocaleDateString('de-DE')}
          </ThemedText>
        </GlowCard>

        {card.prices ? (
          <GlowCard>
            <ThemedText weight="bold" size="lg" style={{ marginBottom: 12 }}>Marktpreise</ThemedText>
            {card.prices.cardmarketLow && (
              <View style={styles.infoRow}>
                <ThemedText variant="secondary">Cardmarket ab</ThemedText>
                <ThemedText weight="bold" style={{ color: theme.colors.primary }}>
                  {formatPrice(card.prices.cardmarketLow)}
                </ThemedText>
              </View>
            )}
            {card.prices.cardmarketMid && (
              <View style={styles.infoRow}>
                <ThemedText variant="secondary">Cardmarket Mitte</ThemedText>
                <ThemedText>{formatPrice(card.prices.cardmarketMid)}</ThemedText>
              </View>
            )}
            {card.prices.cardmarketTrend && (
              <View style={styles.infoRow}>
                <ThemedText variant="secondary">Trend-Preis</ThemedText>
                <ThemedText>{formatPrice(card.prices.cardmarketTrend)}</ThemedText>
              </View>
            )}
            <ThemedText variant="muted" size="xs" style={{ marginTop: 8 }}>
              Stand: {new Date(card.prices.updatedAt).toLocaleDateString('de-DE')}
            </ThemedText>
          </GlowCard>
        ) : (
          <GlowCard>
            <ThemedText variant="muted">Keine Preisdaten verfügbar</ThemedText>
          </GlowCard>
        )}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 16, borderTopColor: theme.colors.border }]}>
        <TouchableOpacity
          onPress={handleDelete}
          style={[styles.deleteBtn, { borderColor: theme.colors.error, borderRadius: theme.radius.md }]}
          accessibilityLabel="Karte löschen"
        >
          <Text style={{ color: theme.colors.error, fontWeight: '600', fontSize: 16 }}>🗑️ Löschen</Text>
        </TouchableOpacity>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  footer: { padding: 20, borderTopWidth: 1 },
  deleteBtn: { height: 48, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
});
