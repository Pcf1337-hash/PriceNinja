import React from 'react';
import {
  View, ScrollView, StyleSheet, TouchableOpacity, Text, Alert, useWindowDimensions
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/src/theme';
import { useItemStore } from '@/src/store';
import { ThemedView, ThemedText, GlowCard, PrimaryButton } from '@/src/components/ui';
import { formatPrice, priceTrend } from '@/src/utils/pricing';
import { useEbayPermissions } from '@/src/store/useEbayPermissions';
import { PriceChart } from '@/src/components/PriceChart';

export default function ItemDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();
  const chartWidth = screenWidth - 40 - 32; // screen - horizontal padding - card padding
  const { getItemById, removeItem, toggleFavorite } = useItemStore();
  const { canCreateListings, isPapaActive, isConnected } = useEbayPermissions();
  const item = getItemById(id);

  if (!item) {
    return (
      <ThemedView style={[styles.container, styles.centered]}>
        <ThemedText>Artikel nicht gefunden</ThemedText>
        <PrimaryButton title="Zurück" onPress={() => router.back()} style={{ marginTop: 16 }} />
      </ThemedView>
    );
  }

  const trend = item.ebaySoldAvg && item.priceHistory.length > 1
    ? priceTrend(item.ebaySoldAvg, item.priceHistory[1]?.ebaySoldAvg ?? item.ebaySoldAvg)
    : 'stable';

  const trendColor = { up: theme.colors.priceUp, down: theme.colors.priceDown, stable: theme.colors.priceStable }[trend];

  const handleDelete = () => {
    Alert.alert('Artikel löschen', `"${item.name}" wirklich löschen?`, [
      { text: 'Abbrechen', style: 'cancel' },
      { text: 'Löschen', style: 'destructive', onPress: () => { removeItem(id); router.back(); } },
    ]);
  };

  const handleEbaySell = () => {
    if (!canCreateListings) {
      if (isPapaActive) {
        Alert.alert('Papa eBay', 'Zum Verkaufen brauchst du deinen eigenen eBay-Account. Verbinde ihn in den Einstellungen.');
      } else {
        Alert.alert('Kein Account', 'Verbinde deinen eBay-Account in den Einstellungen.');
      }
      return;
    }
    // TODO: Navigate to eBay listing form
    Alert.alert('Bald verfügbar', 'eBay Listing wird in Kürze implementiert.');
  };

  return (
    <ThemedView style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: theme.colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} accessibilityLabel="Zurück">
          <Text style={{ color: theme.colors.textSecondary, fontSize: 16 }}>← Zurück</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => toggleFavorite(item.id)} accessibilityLabel={item.isFavorite ? 'Von Favoriten entfernen' : 'Zu Favoriten hinzufügen'}>
          <Text style={{ fontSize: 24 }}>{item.isFavorite ? '⭐' : '☆'}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, gap: 16, paddingBottom: insets.bottom + 80 }}>
        {/* Item info */}
        <GlowCard>
          <ThemedText weight="bold" size="xxl">{item.name}</ThemedText>
          {item.brand && <ThemedText variant="secondary">{item.brand} {item.model ?? ''}</ThemedText>}
          <ThemedText variant="muted" size="sm">{item.category}</ThemedText>
          <ThemedText variant="muted" size="xs" style={{ marginTop: 4 }}>
            Scanqualität: {Math.round(item.confidence * 100)}%
          </ThemedText>
        </GlowCard>

        {/* Prices */}
        <GlowCard>
          <ThemedText weight="bold" size="lg" style={{ marginBottom: 12 }}>Preisübersicht</ThemedText>

          {item.ebaySoldAvg ? (
            <>
              <View style={styles.priceRow}>
                <ThemedText variant="secondary">eBay verkauft (Ø)</ThemedText>
                <ThemedText weight="bold" size="xl" style={{ color: theme.colors.primary }}>
                  {formatPrice(item.ebaySoldAvg)}
                </ThemedText>
              </View>
              {item.ebaySoldMin && item.ebaySoldMax && (
                <View style={styles.priceRow}>
                  <ThemedText variant="muted" size="sm">Spanne</ThemedText>
                  <ThemedText variant="secondary" size="sm">
                    {formatPrice(item.ebaySoldMin)} – {formatPrice(item.ebaySoldMax)}
                  </ThemedText>
                </View>
              )}
              {item.ebaySoldCount && (
                <View style={styles.priceRow}>
                  <ThemedText variant="muted" size="sm">Verkäufe analysiert</ThemedText>
                  <ThemedText variant="secondary" size="sm">{item.ebaySoldCount}</ThemedText>
                </View>
              )}
            </>
          ) : (
            <ThemedText variant="muted">Keine eBay-Preisdaten</ThemedText>
          )}

          {item.geizhalsCheapest && (
            <View style={[styles.priceRow, { marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: theme.colors.border }]}>
              <ThemedText variant="secondary">Geizhals günstigst</ThemedText>
              <ThemedText weight="semibold">{formatPrice(item.geizhalsCheapest)}</ThemedText>
            </View>
          )}

          {item.lastPriceUpdate && (
            <ThemedText variant="muted" size="xs" style={{ marginTop: 8 }}>
              Stand: {new Date(item.lastPriceUpdate).toLocaleString('de-DE')}
            </ThemedText>
          )}
        </GlowCard>

        {/* Price history charts */}
        {item.ebaySoldAvg && (
          <GlowCard>
            <PriceChart
              data={item.priceHistory}
              label="eBay Preisverlauf"
              valueKey="ebaySoldAvg"
              width={chartWidth}
              height={160}
            />
          </GlowCard>
        )}
        {item.geizhalsCheapest && (
          <GlowCard>
            <PriceChart
              data={item.priceHistory}
              label="Geizhals Preisverlauf"
              valueKey="geizhalsCheapest"
              width={chartWidth}
              height={160}
            />
          </GlowCard>
        )}
      </ScrollView>

      {/* Action buttons */}
      <View style={[styles.footer, { paddingBottom: insets.bottom + 16, borderTopColor: theme.colors.border }]}>
        <TouchableOpacity
          onPress={handleEbaySell}
          disabled={!canCreateListings}
          style={[
            styles.sellBtn,
            {
              backgroundColor: canCreateListings ? theme.colors.primary : theme.colors.surfaceAlt,
              borderRadius: theme.radius.md,
              opacity: !isConnected ? 0.5 : 1,
            },
          ]}
          accessibilityLabel={canCreateListings ? 'Bei eBay verkaufen' : 'eBay Verkauf nicht verfügbar'}
        >
          <Text style={{ color: canCreateListings ? theme.colors.background : theme.colors.textMuted, fontWeight: 'bold', fontSize: 16 }}>
            {isPapaActive ? '🔒 Nur Preise (Papa eBay)' : 'Bei eBay verkaufen'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={handleDelete}
          style={[styles.deleteBtn, { borderColor: theme.colors.error, borderRadius: theme.radius.md }]}
          accessibilityLabel="Artikel löschen"
        >
          <Text style={{ color: theme.colors.error, fontWeight: 'semibold' }}>Löschen</Text>
        </TouchableOpacity>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1 },
  priceRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6 },
  footer: { padding: 20, borderTopWidth: 1, gap: 12 },
  sellBtn: { height: 52, alignItems: 'center', justifyContent: 'center' },
  deleteBtn: { height: 44, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
});
