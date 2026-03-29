import React, { useState, useCallback } from 'react';
import {
  View, ScrollView, StyleSheet, TouchableOpacity, Text, Alert,
  Image, ActivityIndicator, Dimensions,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/src/theme';
import { useCardStore } from '@/src/store';
import { ThemedView, ThemedText, GlowCard, PrimaryButton } from '@/src/components/ui';
import { formatPrice } from '@/src/utils/pricing';
import { fetchCardPrice } from '@/src/api/tcg';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const GAME_CONFIG: Record<string, { label: string; color: string; bg: string; emoji: string }> = {
  pokemon:  { label: 'Pokémon',   color: '#FFCB05', bg: '#3B4CCA', emoji: '⚡' },
  magic:    { label: 'Magic',     color: '#F9FAF4', bg: '#9C2B2E', emoji: '🔮' },
  yugioh:   { label: 'Yu-Gi-Oh!', color: '#C89B3C', bg: '#1A1A2E', emoji: '🃏' },
  other:    { label: 'Karte',     color: '#ffffff', bg: '#333333', emoji: '♦' },
};

const RARITY_COLORS: Record<string, string> = {
  common: '#aaaaaa',
  uncommon: '#44cc88',
  rare: '#4488ff',
  'ultra rare': '#cc44ff',
  secret: '#ffaa00',
  legendary: '#ff4444',
  mythic: '#ff6600',
  holo: '#00ccff',
};

function getRarityColor(rarity?: string, primary = '#00ff88'): string {
  if (!rarity) return primary;
  const key = rarity.toLowerCase();
  for (const [k, v] of Object.entries(RARITY_COLORS)) {
    if (key.includes(k)) return v;
  }
  return primary;
}

const CONDITION_LABELS: Record<string, string> = {
  M: 'Mint', NM: 'Near Mint', LP: 'Lightly Played',
  MP: 'Moderately Played', HP: 'Heavily Played',
};

export default function CardDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const { getCardById, removeCard, toggleFavorite, updateCard } = useCardStore();
  const card = getCardById(id);
  const [refreshing, setRefreshing] = useState(false);

  const handleRefreshPrices = useCallback(async () => {
    if (!card) return;
    setRefreshing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const prices = await fetchCardPrice({
        game: card.game,
        name: card.name,
        setCode: card.setCode,
        cardNumber: card.cardNumber,
      });
      if (prices) {
        updateCard(card.id, { prices });
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch {
      Alert.alert('Fehler', 'Preise konnten nicht aktualisiert werden.');
    } finally {
      setRefreshing(false);
    }
  }, [card, updateCard]);

  const handleDelete = useCallback(() => {
    Alert.alert('Karte löschen', `"${card?.name}" wirklich löschen?`, [
      { text: 'Abbrechen', style: 'cancel' },
      {
        text: 'Löschen', style: 'destructive',
        onPress: () => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          removeCard(id);
          router.back();
        },
      },
    ]);
  }, [card, removeCard, id]);

  if (!card) {
    return (
      <ThemedView style={[styles.container, styles.centered]}>
        <ThemedText>Karte nicht gefunden</ThemedText>
        <PrimaryButton title="Zurück" onPress={() => router.back()} style={{ marginTop: 16 }} />
      </ThemedView>
    );
  }

  const game = GAME_CONFIG[card.game] ?? GAME_CONFIG.other;
  const rarityColor = getRarityColor(card.rarity, theme.colors.primary);
  const hasImage = !!card.imageUri;
  const hasPrices = !!card.prices;
  const bestPrice = card.prices?.cardmarketMid ?? card.prices?.cardmarketLow;

  return (
    <ThemedView style={styles.container}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Hero Image ── */}
        <View style={styles.heroContainer}>
          {hasImage ? (
            <Image
              source={{ uri: card.imageUri }}
              style={styles.heroImage}
              resizeMode="cover"
              accessibilityLabel="Kartenvorschau"
            />
          ) : (
            <View style={[styles.heroPlaceholder, { backgroundColor: game.bg }]}>
              <Text style={styles.heroEmoji}>{game.emoji}</Text>
            </View>
          )}
          {/* Gradient overlay (simulated with layered views) */}
          <View style={styles.heroGradient} />

          {/* Back + Favorite buttons */}
          <View style={[styles.heroTopBar, { paddingTop: insets.top + 8 }]}>
            <TouchableOpacity
              onPress={() => router.back()}
              style={styles.heroBtn}
              accessibilityLabel="Zurück"
            >
              <Text style={styles.heroBtnText}>←</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => {
                toggleFavorite(card.id);
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }}
              style={styles.heroBtn}
              accessibilityLabel={card.isFavorite ? 'Von Favoriten entfernen' : 'Zu Favoriten hinzufügen'}
            >
              <Text style={styles.heroBtnText}>{card.isFavorite ? '⭐' : '☆'}</Text>
            </TouchableOpacity>
          </View>

          {/* Card info overlay at bottom of hero */}
          <View style={styles.heroOverlay}>
            {/* Game badge */}
            <View style={[styles.gameBadge, { backgroundColor: game.bg }]}>
              <Text style={[styles.gameBadgeText, { color: game.color }]}>
                {game.emoji} {game.label}
              </Text>
            </View>
            <ThemedText weight="bold" size="xxl" style={styles.heroCardName} numberOfLines={2}>
              {card.name}
            </ThemedText>
            {card.setName && (
              <ThemedText style={styles.heroSetName} numberOfLines={1}>
                {card.setName}{card.cardNumber ? `  ·  #${card.cardNumber}` : ''}
              </ThemedText>
            )}
          </View>
        </View>

        {/* ── Price Hero ── */}
        {hasPrices && bestPrice ? (
          <View style={[styles.priceHero, { backgroundColor: theme.colors.surface }]}>
            <View style={styles.priceHeroInner}>
              <ThemedText variant="secondary" size="sm" style={{ letterSpacing: 1 }}>MARKTWERT</ThemedText>
              <View style={styles.priceHeroRow}>
                <ThemedText weight="bold" style={[styles.priceHeroValue, { color: theme.colors.primary }]}>
                  {formatPrice(bestPrice)}
                </ThemedText>
                <View style={[styles.currencyBadge, { backgroundColor: theme.colors.primary + '22', borderColor: theme.colors.primary + '44' }]}>
                  <ThemedText size="xs" weight="bold" style={{ color: theme.colors.primary }}>EUR</ThemedText>
                </View>
              </View>
              {card.prices?.cardmarketTrend && (
                <ThemedText variant="muted" size="xs">
                  Trend: {formatPrice(card.prices.cardmarketTrend)}
                </ThemedText>
              )}
            </View>
            <TouchableOpacity
              onPress={handleRefreshPrices}
              disabled={refreshing}
              style={[styles.refreshBtn, { borderColor: theme.colors.border }]}
              accessibilityLabel="Preise aktualisieren"
            >
              {refreshing
                ? <ActivityIndicator size="small" color={theme.colors.primary} />
                : <Text style={{ fontSize: 18 }}>🔄</Text>
              }
            </TouchableOpacity>
          </View>
        ) : (
          <View style={[styles.priceHeroEmpty, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
            <ThemedText variant="muted">Keine Preisdaten</ThemedText>
            <TouchableOpacity
              onPress={handleRefreshPrices}
              disabled={refreshing}
              style={[styles.refreshBtnInline, { backgroundColor: theme.colors.primary + '22', borderColor: theme.colors.primary + '44' }]}
              accessibilityLabel="Preise laden"
            >
              {refreshing
                ? <ActivityIndicator size="small" color={theme.colors.primary} />
                : <ThemedText size="sm" weight="semibold" style={{ color: theme.colors.primary }}>Preise laden →</ThemedText>
              }
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.contentPad}>
          {/* ── Marketplace comparison ── */}
          {hasPrices && (
            <GlowCard style={styles.card}>
              <ThemedText weight="bold" style={{ marginBottom: 14, letterSpacing: 0.5 }}>MARKTPREISE</ThemedText>

              {/* Cardmarket */}
              <View style={[styles.marketplaceRow, { borderBottomColor: theme.colors.border }]}>
                <View style={styles.marketplaceLeft}>
                  <View style={[styles.marketplaceDot, { backgroundColor: '#007bff' }]} />
                  <ThemedText weight="semibold">Cardmarket</ThemedText>
                </View>
                <View style={styles.marketplacePrices}>
                  {card.prices?.cardmarketLow && (
                    <View style={styles.priceCell}>
                      <ThemedText variant="muted" size="xs">ab</ThemedText>
                      <ThemedText weight="bold" style={{ color: theme.colors.success }}>
                        {formatPrice(card.prices.cardmarketLow)}
                      </ThemedText>
                    </View>
                  )}
                  {card.prices?.cardmarketMid && (
                    <View style={styles.priceCell}>
                      <ThemedText variant="muted" size="xs">Ø</ThemedText>
                      <ThemedText weight="semibold">{formatPrice(card.prices.cardmarketMid)}</ThemedText>
                    </View>
                  )}
                  {card.prices?.cardmarketTrend && (
                    <View style={styles.priceCell}>
                      <ThemedText variant="muted" size="xs">Trend</ThemedText>
                      <ThemedText size="sm">{formatPrice(card.prices.cardmarketTrend)}</ThemedText>
                    </View>
                  )}
                </View>
              </View>

              {/* TCGPlayer */}
              {(card.prices?.tcgplayerLow || card.prices?.tcgplayerMid) && (
                <View style={[styles.marketplaceRow, { borderBottomWidth: 0 }]}>
                  <View style={styles.marketplaceLeft}>
                    <View style={[styles.marketplaceDot, { backgroundColor: '#e87722' }]} />
                    <ThemedText weight="semibold">TCGPlayer</ThemedText>
                  </View>
                  <View style={styles.marketplacePrices}>
                    {card.prices?.tcgplayerLow && (
                      <View style={styles.priceCell}>
                        <ThemedText variant="muted" size="xs">ab</ThemedText>
                        <ThemedText weight="bold" style={{ color: theme.colors.success }}>
                          {formatPrice(card.prices.tcgplayerLow)}
                        </ThemedText>
                      </View>
                    )}
                    {card.prices?.tcgplayerMid && (
                      <View style={styles.priceCell}>
                        <ThemedText variant="muted" size="xs">Market</ThemedText>
                        <ThemedText weight="semibold">{formatPrice(card.prices.tcgplayerMid)}</ThemedText>
                      </View>
                    )}
                  </View>
                </View>
              )}

              {card.prices?.updatedAt && (
                <ThemedText variant="muted" size="xs" style={{ marginTop: 10 }}>
                  Aktualisiert: {new Date(card.prices.updatedAt).toLocaleString('de-DE')}
                </ThemedText>
              )}
            </GlowCard>
          )}

          {/* ── Card details ── */}
          <GlowCard style={styles.card}>
            <ThemedText weight="bold" style={{ marginBottom: 14, letterSpacing: 0.5 }}>KARTEN-DETAILS</ThemedText>

            {card.setName && (
              <View style={styles.detailRow}>
                <ThemedText variant="muted" size="sm">Set</ThemedText>
                <ThemedText weight="semibold">{card.setName}</ThemedText>
              </View>
            )}
            {card.setCode && (
              <View style={styles.detailRow}>
                <ThemedText variant="muted" size="sm">Set-Code</ThemedText>
                <ThemedText>{card.setCode.toUpperCase()}</ThemedText>
              </View>
            )}
            {card.cardNumber && (
              <View style={styles.detailRow}>
                <ThemedText variant="muted" size="sm">Nummer</ThemedText>
                <ThemedText>#{card.cardNumber}</ThemedText>
              </View>
            )}

            {/* Rarity badge */}
            {card.rarity && (
              <View style={styles.detailRow}>
                <ThemedText variant="muted" size="sm">Seltenheit</ThemedText>
                <View style={[styles.rarityBadge, { backgroundColor: rarityColor + '22', borderColor: rarityColor + '66' }]}>
                  <View style={[styles.rarityDot, { backgroundColor: rarityColor }]} />
                  <ThemedText size="xs" weight="semibold" style={{ color: rarityColor }}>
                    {card.rarity}
                  </ThemedText>
                </View>
              </View>
            )}

            {/* Condition badge */}
            {card.condition && (
              <View style={styles.detailRow}>
                <ThemedText variant="muted" size="sm">Zustand</ThemedText>
                <View style={[styles.conditionBadge, { backgroundColor: theme.colors.surfaceAlt, borderColor: theme.colors.border }]}>
                  <ThemedText size="xs" weight="bold" style={{ color: theme.colors.text }}>
                    {card.condition}
                  </ThemedText>
                  <ThemedText size="xs" variant="muted"> · {CONDITION_LABELS[card.condition] ?? card.condition}</ThemedText>
                </View>
              </View>
            )}

            <View style={[styles.detailRow, { borderBottomWidth: 0 }]}>
              <ThemedText variant="muted" size="sm">Gescannt</ThemedText>
              <ThemedText size="sm">{new Date(card.scannedAt).toLocaleDateString('de-DE', {
                day: '2-digit', month: 'short', year: 'numeric',
              })}</ThemedText>
            </View>
          </GlowCard>
        </View>
      </ScrollView>

      {/* ── Footer Actions ── */}
      <View style={[styles.footer, {
        paddingBottom: insets.bottom + 12,
        backgroundColor: theme.colors.background,
        borderTopColor: theme.colors.border,
      }]}>
        <TouchableOpacity
          onPress={handleDelete}
          style={[styles.deleteBtn, { borderColor: theme.colors.error + '88', borderRadius: theme.radius.md }]}
          accessibilityLabel="Karte löschen"
        >
          <Text style={{ color: theme.colors.error, fontWeight: '600', fontSize: 15 }}>🗑  Löschen</Text>
        </TouchableOpacity>
        {!hasPrices && (
          <TouchableOpacity
            onPress={handleRefreshPrices}
            disabled={refreshing}
            style={[styles.priceBtn, { backgroundColor: theme.colors.primary, borderRadius: theme.radius.md }]}
            accessibilityLabel="Preise laden"
          >
            {refreshing
              ? <ActivityIndicator size="small" color={theme.colors.background} />
              : <Text style={{ color: theme.colors.background, fontWeight: 'bold', fontSize: 15 }}>💰 Preise laden</Text>
            }
          </TouchableOpacity>
        )}
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { alignItems: 'center', justifyContent: 'center' },

  // Hero
  heroContainer: { width: SCREEN_WIDTH, height: SCREEN_WIDTH * 1.1, position: 'relative' },
  heroImage: { width: '100%', height: '100%' },
  heroPlaceholder: { width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' },
  heroEmoji: { fontSize: 80 },
  heroGradient: { position: 'absolute', bottom: 0, left: 0, right: 0, height: '60%', backgroundColor: 'rgba(0,0,0,0.55)' },
  heroTopBar: {
    position: 'absolute', top: 0, left: 0, right: 0,
    flexDirection: 'row', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingBottom: 8,
  },
  heroBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center', justifyContent: 'center',
  },
  heroBtnText: { color: 'white', fontSize: 18 },
  heroOverlay: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    padding: 20, paddingBottom: 24,
  },
  gameBadge: {
    alignSelf: 'flex-start', borderRadius: 6,
    paddingHorizontal: 10, paddingVertical: 4, marginBottom: 8,
  },
  gameBadgeText: { fontSize: 12, fontWeight: '700', letterSpacing: 0.5 },
  heroCardName: { color: 'white', fontSize: 26, lineHeight: 30, marginBottom: 4 },
  heroSetName: { color: 'rgba(255,255,255,0.7)', fontSize: 14 },

  // Price hero
  priceHero: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 16,
  },
  priceHeroInner: { flex: 1 },
  priceHeroRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 4, marginBottom: 2 },
  priceHeroValue: { fontSize: 38, lineHeight: 42 },
  currencyBadge: {
    borderWidth: 1, borderRadius: 6,
    paddingHorizontal: 8, paddingVertical: 3,
    alignSelf: 'flex-end', marginBottom: 4,
  },
  priceHeroEmpty: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 18,
    borderTopWidth: 1, borderBottomWidth: 1,
  },
  refreshBtn: {
    width: 44, height: 44, borderRadius: 22, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center',
  },
  refreshBtnInline: {
    borderWidth: 1, borderRadius: 8,
    paddingHorizontal: 14, paddingVertical: 8,
  },

  // Content
  contentPad: { padding: 16, gap: 12 },
  card: {},

  // Marketplace
  marketplaceRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth,
  },
  marketplaceLeft: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  marketplaceDot: { width: 10, height: 10, borderRadius: 5 },
  marketplacePrices: { flexDirection: 'row', gap: 16 },
  priceCell: { alignItems: 'flex-end' },

  // Details
  detailRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(128,128,128,0.15)',
  },
  rarityBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    borderWidth: 1, borderRadius: 20,
    paddingHorizontal: 10, paddingVertical: 4,
  },
  rarityDot: { width: 7, height: 7, borderRadius: 4 },
  conditionBadge: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1, borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 4,
  },

  // Footer
  footer: {
    flexDirection: 'row', gap: 12, padding: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  deleteBtn: {
    flex: 1, height: 48,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1,
  },
  priceBtn: {
    flex: 2, height: 48,
    alignItems: 'center', justifyContent: 'center',
  },
});
