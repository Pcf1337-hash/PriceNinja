import React, { useState, useCallback, useRef } from 'react';
import {
  View, ScrollView, StyleSheet, TouchableOpacity, Text,
  useWindowDimensions, Image, ActivityIndicator, Linking, Alert,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/src/theme';
import { useItemStore } from '@/src/store';
import { ThemedView, ThemedText, GlowCard, PrimaryButton } from '@/src/components/ui';
import { formatPrice, priceTrend, calculatePriceStats } from '@/src/utils/pricing';
import { useEbayPermissions } from '@/src/store/useEbayPermissions';
import { PriceChart } from '@/src/components/PriceChart';
import { fetchSoldListingsPublic } from '@/src/api/ebay';
import { fetchGeizhalsPrice } from '@/src/api/geizhals';
import { fetchBricklinkPrice, fetchBricklinkListings, BricklinkListing } from '@/src/api/bricklink';
import { EbaySoldListing } from '@/src/types/item';
import { getDatabase, updateItemPrices, insertPricePoint } from '@/src/db';
import { EbaySalePoint } from '@/src/components/PriceChart';

export default function ItemDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();
  const chartWidth = screenWidth - 40 - 32;
  const { getItemById, removeItem, toggleFavorite, updateItem } = useItemStore();
  const { canCreateListings, isPapaActive, isConnected } = useEbayPermissions();
  const item = getItemById(id);

  const [soldListings, setSoldListings] = useState<EbaySoldListing[]>([]);
  const [blListings, setBlListings] = useState<BricklinkListing[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshMsg, setRefreshMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const refreshMsgTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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
  const trendArrow = { up: '↑', down: '↓', stable: '→' }[trend];

  const handleDelete = () => {
    Alert.alert('Artikel löschen', `"${item.name}" wirklich löschen?`, [
      { text: 'Abbrechen', style: 'cancel' },
      { text: 'Löschen', style: 'destructive', onPress: () => { removeItem(id); router.back(); } },
    ]);
  };

  const handleEbaySell = () => {
    if (!canCreateListings) {
      if (isPapaActive) {
        Alert.alert('Papa eBay', 'Zum Verkaufen brauchst du deinen eigenen eBay-Account.');
      } else {
        Alert.alert('Kein Account', 'Verbinde deinen eBay-Account in den Einstellungen.');
      }
      return;
    }
    Alert.alert('Bald verfügbar', 'eBay Listing wird in Kürze implementiert.');
  };

  const showRefreshMsg = useCallback((text: string, ok: boolean) => {
    if (refreshMsgTimer.current) clearTimeout(refreshMsgTimer.current);
    setRefreshMsg({ text, ok });
    refreshMsgTimer.current = setTimeout(() => setRefreshMsg(null), 3000);
  }, []);

  const handleRefreshPrices = useCallback(async () => {
    setRefreshing(true);
    try {
      const searchQuery = item.name;

      // Jede Quelle einzeln — ein Fehler blockiert nicht die anderen
      const [rawListings, geizhals, bricklink] = await Promise.all([
        fetchSoldListingsPublic(searchQuery, 10).catch(() => [] as import('@/src/types/item').EbaySoldListing[]),
        fetchGeizhalsPrice(searchQuery).catch(() => null),
        fetchBricklinkPrice(searchQuery).catch(() => null),
      ]);

      const listings = rawListings.filter(l => l.price > 0);
      setSoldListings(listings);

      // BrickLink-Einzellisten laden wenn Item bekannt
      if (bricklink?.itemId) {
        fetchBricklinkListings(bricklink.itemId, bricklink.type, undefined)
          .then(setBlListings)
          .catch(() => {});
      }

      const stats = calculatePriceStats(listings);
      const now = new Date().toISOString();

      const updatedPrices = {
        ebaySoldAvg: stats.avg > 0 ? stats.avg : item.ebaySoldAvg,
        ebaySoldMin: stats.min > 0 ? stats.min : item.ebaySoldMin,
        ebaySoldMax: stats.max > 0 ? stats.max : item.ebaySoldMax,
        ebaySoldCount: listings.length > 0 ? listings.length : item.ebaySoldCount,
        // Geizhals-Preis nur übernehmen wenn er plausibel ist (mind. 25% des eBay-Preises)
        // — verhindert dass Zubehör (z.B. Armband statt Uhr) übernommen wird
        geizhalsCheapest: (geizhals && stats.avg > 0 && geizhals.cheapestPrice < stats.avg * 0.25)
          ? item.geizhalsCheapest
          : (geizhals?.cheapestPrice ?? item.geizhalsCheapest),
        geizhalsUrl: (geizhals && stats.avg > 0 && geizhals.cheapestPrice < stats.avg * 0.25)
          ? item.geizhalsUrl
          : (geizhals?.url ?? item.geizhalsUrl),
        bricklinkAvg: bricklink?.avgPrice ?? item.bricklinkAvg,
        bricklinkMin: bricklink?.minPrice ?? item.bricklinkMin,
        bricklinkUrl: bricklink?.url ?? item.bricklinkUrl,
      };

      const newPricePoint = stats.avg > 0
        ? { timestamp: now, ebaySoldAvg: stats.avg, geizhalsCheapest: geizhals?.cheapestPrice }
        : null;

      updateItem(id, {
        ...updatedPrices,
        lastPriceUpdate: now,
        priceHistory: newPricePoint
          ? [newPricePoint, ...item.priceHistory].slice(0, 30)
          : item.priceHistory,
        updatedAt: now,
      });

      // Preise dauerhaft in SQLite speichern
      const db = await getDatabase();
      await updateItemPrices(db, id, updatedPrices);
      if (newPricePoint) {
        await insertPricePoint(db, id, newPricePoint);
      }

      const hasAny = listings.length > 0 || bricklink != null;
      showRefreshMsg(hasAny ? 'Preise aktualisiert ✓' : 'Keine neuen Preise gefunden', hasAny);
    } catch {
      showRefreshMsg('Aktualisierung fehlgeschlagen', false);
    } finally {
      setRefreshing(false);
    }
  }, [id, item, showRefreshMsg]);

  const displayListings = soldListings;
  const ebayChartPoints: EbaySalePoint[] = soldListings
    .filter(l => l.price > 0 && l.soldDate)
    .map(l => ({ price: l.price, soldDate: l.soldDate }));

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

      <ScrollView contentContainerStyle={{ padding: 20, gap: 14, paddingBottom: insets.bottom + 100 }}>

        {/* Product image + info */}
        <GlowCard style={{ padding: 0, overflow: 'hidden' }}>
          {item.imageUri ? (
            <Image
              source={{ uri: item.imageUri }}
              style={{ width: '100%', height: 220, borderTopLeftRadius: 14, borderTopRightRadius: 14 }}
              resizeMode="cover"
            />
          ) : null}
          <View style={{ padding: 16 }}>
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}>
              <View style={{ flex: 1, marginRight: 10 }}>
                <ThemedText weight="bold" size="xl" style={{ lineHeight: 26 }}>{item.name}</ThemedText>
                {(item.brand || item.model) && (
                  <ThemedText variant="secondary" style={{ marginTop: 2 }}>
                    {[item.brand, item.model].filter(Boolean).join(' · ')}
                  </ThemedText>
                )}
                <ThemedText variant="muted" size="sm" style={{ marginTop: 2 }}>{item.category}</ThemedText>
              </View>
              <View style={{ alignItems: 'flex-end', gap: 4 }}>
                <View style={[styles.badge, { backgroundColor: trendColor + '22', borderColor: trendColor + '55' }]}>
                  <Text style={{ color: trendColor, fontSize: 14, fontWeight: '700' }}>{trendArrow}</Text>
                </View>
                <View style={[styles.badge, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
                  <ThemedText size="xs" variant="muted">KI {Math.round(item.confidence * 100)}%</ThemedText>
                </View>
              </View>
            </View>
            {item.lastPriceUpdate && (
              <ThemedText variant="muted" size="xs" style={{ marginTop: 8 }}>
                Aktualisiert: {new Date(item.lastPriceUpdate).toLocaleString('de-DE')}
              </ThemedText>
            )}
          </View>
        </GlowCard>

        {/* Price comparison row: eBay + Geizhals */}
        <View style={[styles.priceCompareRow, { gap: 10 }]}>
          <View style={[
            styles.priceCompareBlock,
            {
              backgroundColor: theme.colors.surface,
              borderColor: item.ebaySoldAvg ? theme.colors.primary + '55' : theme.colors.border,
              flex: 1,
            },
          ]}>
            <View style={[styles.priceSourceTag, { backgroundColor: theme.colors.primary + '22' }]}>
              <ThemedText size="xs" weight="bold" style={{ color: theme.colors.primary }}>eBay VERKAUFT</ThemedText>
            </View>
            {item.ebaySoldAvg ? (
              <>
                <ThemedText weight="bold" style={[styles.priceCompareValue, { color: theme.colors.primary }]}>
                  {formatPrice(item.ebaySoldAvg)}
                </ThemedText>
                <ThemedText variant="muted" size="xs">Ø Verkaufspreis</ThemedText>
                {item.ebaySoldMin && item.ebaySoldMax && (
                  <ThemedText variant="muted" size="xs" style={{ marginTop: 3 }}>
                    {formatPrice(item.ebaySoldMin)} – {formatPrice(item.ebaySoldMax)}
                  </ThemedText>
                )}
                {item.ebaySoldCount && (
                  <ThemedText variant="muted" size="xs" style={{ marginTop: 2 }}>{item.ebaySoldCount} Verkäufe</ThemedText>
                )}
              </>
            ) : (
              <ThemedText variant="muted" size="xs" style={{ marginTop: 6 }}>Keine Daten</ThemedText>
            )}
          </View>

          <View style={[
            styles.priceCompareBlock,
            {
              backgroundColor: theme.colors.surface,
              borderColor: item.geizhalsCheapest ? theme.colors.success + '55' : theme.colors.border,
              flex: 1,
            },
          ]}>
            <View style={[styles.priceSourceTag, { backgroundColor: theme.colors.success + '22' }]}>
              <ThemedText size="xs" weight="bold" style={{ color: theme.colors.success }}>GEIZHALS</ThemedText>
            </View>
            {item.geizhalsCheapest ? (
              <>
                <ThemedText weight="bold" style={[styles.priceCompareValue, { color: theme.colors.success }]}>
                  {formatPrice(item.geizhalsCheapest)}
                </ThemedText>
                <ThemedText variant="muted" size="xs">Günstigster Neupreis</ThemedText>
                {item.geizhalsUrl && (
                  <TouchableOpacity onPress={() => item.geizhalsUrl && Linking.openURL(item.geizhalsUrl)} style={{ marginTop: 4 }}>
                    <ThemedText size="xs" style={{ color: theme.colors.success }}>→ geizhals.at</ThemedText>
                  </TouchableOpacity>
                )}
              </>
            ) : (
              <ThemedText variant="muted" size="xs" style={{ marginTop: 6 }}>Keine Daten</ThemedText>
            )}
          </View>
        </View>

        {/* Bricklink block */}
        {item.bricklinkUrl && (
          <TouchableOpacity onPress={() => Linking.openURL(item.bricklinkUrl!)} activeOpacity={0.7}>
            <View style={[styles.priceCompareBlock, { backgroundColor: theme.colors.surface, borderColor: '#e3000b44' }]}>
              <View style={[styles.priceSourceTag, { backgroundColor: '#e3000b22' }]}>
                <ThemedText size="xs" weight="bold" style={{ color: '#e3000b' }}>BRICKLINK</ThemedText>
              </View>
              {item.bricklinkAvg && item.bricklinkAvg > 0 ? (
                <>
                  <ThemedText weight="bold" style={[styles.priceCompareValue, { color: '#e3000b' }]}>
                    {formatPrice(item.bricklinkAvg)}
                  </ThemedText>
                  <ThemedText variant="muted" size="xs">Ø Marktpreis</ThemedText>
                  {item.bricklinkMin && item.bricklinkMin > 0 && (
                    <ThemedText variant="muted" size="xs" style={{ marginTop: 2 }}>ab {formatPrice(item.bricklinkMin)}</ThemedText>
                  )}
                  <ThemedText size="xs" style={{ color: '#e3000b', marginTop: 4 }}>→ bricklink.com</ThemedText>
                </>
              ) : (
                <ThemedText variant="muted" size="xs" style={{ marginTop: 6 }}>Gefunden – Keine Preisdaten</ThemedText>
              )}
            </View>
          </TouchableOpacity>
        )}

        {/* Price range bar */}
        {item.ebaySoldAvg && item.ebaySoldMin && item.ebaySoldMax && item.ebaySoldMin !== item.ebaySoldMax && (
          <GlowCard>
            <ThemedText variant="muted" size="xs" weight="semibold" style={{ marginBottom: 10, letterSpacing: 1 }}>
              PREISSPANNE
            </ThemedText>
            <View style={styles.rangeBar}>
              <View style={[styles.rangeTrack, { backgroundColor: theme.colors.border }]} />
              {(() => {
                const min = item.ebaySoldMin!;
                const max = item.ebaySoldMax!;
                const avg = item.ebaySoldAvg!;
                const range = max - min;
                const avgPos = range > 0 ? ((avg - min) / range) * 100 : 50;
                return (
                  <View
                    style={[
                      styles.rangeIndicator,
                      {
                        left: `${Math.max(2, Math.min(avgPos, 96))}%` as never,
                        backgroundColor: theme.colors.primary,
                        shadowColor: theme.colors.primary,
                      },
                    ]}
                  />
                );
              })()}
            </View>
            <View style={styles.rangeLabels}>
              <ThemedText size="xs" variant="muted">{formatPrice(item.ebaySoldMin)}</ThemedText>
              <ThemedText size="xs" weight="semibold" style={{ color: theme.colors.primary }}>
                Ø {formatPrice(item.ebaySoldAvg)}
              </ThemedText>
              <ThemedText size="xs" variant="muted">{formatPrice(item.ebaySoldMax)}</ThemedText>
            </View>
          </GlowCard>
        )}

        {/* Refresh prices button + sold listings */}
        <TouchableOpacity
          onPress={handleRefreshPrices}
          disabled={refreshing}
          style={[styles.refreshBtn, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}
          accessibilityLabel="Preise aktualisieren"
        >
          {refreshing ? (
            <ActivityIndicator color={theme.colors.primary} size="small" />
          ) : (
            <ThemedText size="sm" weight="semibold" style={{ color: theme.colors.primary }}>
              ↻ Preise & Verkäufe aktualisieren
            </ThemedText>
          )}
        </TouchableOpacity>

        {/* Inline Feedback */}
        {refreshMsg && (
          <View style={[styles.refreshMsg, { backgroundColor: refreshMsg.ok ? theme.colors.success + '22' : theme.colors.warning + '22', borderColor: refreshMsg.ok ? theme.colors.success : theme.colors.warning }]}>
            <ThemedText size="xs" style={{ color: refreshMsg.ok ? theme.colors.success : theme.colors.warning }}>
              {refreshMsg.text}
            </ThemedText>
          </View>
        )}

        {/* BrickLink Angebote */}
        {blListings.length > 0 && (
          <GlowCard>
            <View style={[styles.sectionHeader, { marginBottom: 8 }]}>
              <ThemedText variant="muted" size="xs" weight="semibold" style={{ letterSpacing: 1, color: '#e3000b' }}>
                BRICKLINK ANGEBOTE
              </ThemedText>
              <ThemedText variant="muted" size="xs">{blListings.reduce((s, l) => s + l.qty, 0)} verfügbar</ThemedText>
            </View>
            <ScrollView
              style={{ maxHeight: 5 * 44 }}
              nestedScrollEnabled
              showsVerticalScrollIndicator={false}
            >
              {blListings.map((listing, i) => (
                <View
                  key={i}
                  style={[styles.listingRow, { borderTopColor: theme.colors.border }, i === 0 && { borderTopWidth: 0 }]}
                >
                  <View style={{ flex: 1 }}>
                    <ThemedText size="sm" numberOfLines={1}>{listing.condition}</ThemedText>
                    <ThemedText variant="muted" size="xs">{listing.sellerName} · {listing.qty} Stück</ThemedText>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <ThemedText weight="bold" size="sm" style={{ color: '#e3000b' }}>
                      ab {listing.price.toFixed(2).replace('.', ',')} €
                    </ThemedText>
                    {listing.location ? (
                      <ThemedText variant="muted" size="xs">{listing.location}</ThemedText>
                    ) : null}
                  </View>
                </View>
              ))}
            </ScrollView>
            {item.bricklinkUrl && (
              <TouchableOpacity onPress={() => Linking.openURL(item.bricklinkUrl!)} style={{ marginTop: 8 }}>
                <ThemedText size="xs" style={{ color: '#e3000b', textAlign: 'center' }}>Alle Angebote auf BrickLink →</ThemedText>
              </TouchableOpacity>
            )}
          </GlowCard>
        )}

        {/* eBay sold listings */}
        {displayListings.length > 0 && (
          <GlowCard>
            <View style={[styles.sectionHeader, { marginBottom: 8 }]}>
              <ThemedText variant="muted" size="xs" weight="semibold" style={{ letterSpacing: 1 }}>
                LETZTE EBAY-VERKÄUFE
              </ThemedText>
              <ThemedText variant="muted" size="xs">{displayListings.length} gefunden</ThemedText>
            </View>
            <ScrollView
              style={{ maxHeight: 5 * 44 }}
              nestedScrollEnabled
              showsVerticalScrollIndicator={false}
            >
            {displayListings.map((listing, i) => (
              <TouchableOpacity
                key={i}
                onPress={() => listing.url && Linking.openURL(listing.url)}
                style={[styles.listingRow, { borderTopColor: theme.colors.border }, i === 0 && { borderTopWidth: 0 }]}
              >
                {listing.imageUrl ? (
                  <Image
                    source={{ uri: listing.imageUrl }}
                    style={{ width: 44, height: 44, borderRadius: 6, marginRight: 10, backgroundColor: theme.colors.surfaceAlt }}
                    resizeMode="cover"
                  />
                ) : (
                  <View style={[styles.listingDot, { marginRight: 10 }]}>
                    <View style={[styles.listingDotInner, { backgroundColor: theme.colors.success }]} />
                  </View>
                )}
                <ThemedText size="xs" variant="secondary" style={{ flex: 1 }} numberOfLines={2}>
                  {listing.title}
                </ThemedText>
                <View style={[styles.listingPriceBadge, { backgroundColor: theme.colors.success + '18', borderColor: theme.colors.success + '44' }]}>
                  <ThemedText size="xs" weight="bold" style={{ color: theme.colors.success }}>
                    {formatPrice(listing.price)}
                  </ThemedText>
                </View>
              </TouchableOpacity>
            ))}
            </ScrollView>
          </GlowCard>
        )}

        {/* eBay image gallery */}
        {displayListings.filter(l => l.imageUrl).length > 0 && (
          <GlowCard>
            <ThemedText variant="muted" size="xs" weight="semibold" style={{ letterSpacing: 1, marginBottom: 10 }}>
              ÄHNLICHE ANGEBOTE
            </ThemedText>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -4 }}>
              {displayListings.filter(l => l.imageUrl).slice(0, 8).map((listing, i) => (
                <TouchableOpacity
                  key={i}
                  onPress={() => listing.url && Linking.openURL(listing.url)}
                  style={{ marginHorizontal: 4, width: 90 }}
                  activeOpacity={0.7}
                >
                  <Image
                    source={{ uri: listing.imageUrl }}
                    style={{ width: 90, height: 90, borderRadius: 8, backgroundColor: theme.colors.surfaceAlt }}
                    resizeMode="cover"
                  />
                  <ThemedText size="xs" variant="muted" numberOfLines={2} style={{ marginTop: 4, lineHeight: 14 }}>
                    {listing.title}
                  </ThemedText>
                  <ThemedText size="xs" weight="bold" style={{ color: theme.colors.primary, marginTop: 2 }}>
                    {formatPrice(listing.price)}
                  </ThemedText>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </GlowCard>
        )}

        {/* Price history chart */}
        {item.priceHistory.length > 1 && (
          <>
            {item.ebaySoldAvg && (
              <GlowCard>
                <PriceChart
                  data={item.priceHistory}
                  soldListings={ebayChartPoints.length >= 2 ? ebayChartPoints : undefined}
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
          </>
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
          <Text style={{ color: theme.colors.error, fontWeight: '600' }}>Löschen</Text>
        </TouchableOpacity>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { alignItems: 'center', justifyContent: 'center' },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1,
  },
  badge: {
    borderWidth: 1, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4,
  },
  priceCompareRow: { flexDirection: 'row' },
  priceCompareBlock: { borderWidth: 1.5, borderRadius: 14, padding: 14 },
  priceSourceTag: {
    alignSelf: 'flex-start', borderRadius: 5,
    paddingHorizontal: 7, paddingVertical: 3, marginBottom: 8,
  },
  priceCompareValue: { fontSize: 26, lineHeight: 30, fontWeight: '800', marginBottom: 2 },
  rangeBar: { height: 20, position: 'relative', justifyContent: 'center' },
  rangeTrack: { height: 4, borderRadius: 2 },
  rangeIndicator: {
    position: 'absolute', width: 14, height: 14, borderRadius: 7,
    marginLeft: -7, shadowOpacity: 0.8, shadowRadius: 6, shadowOffset: { width: 0, height: 0 },
    elevation: 4,
  },
  rangeLabels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  refreshBtn: {
    height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1,
  },
  refreshMsg: {
    marginTop: 8, borderRadius: 8, paddingVertical: 8, paddingHorizontal: 12,
    borderWidth: 1, alignItems: 'center',
  },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  listingRow: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  listingDot: { width: 20, justifyContent: 'center', alignItems: 'center' },
  listingDotInner: { width: 6, height: 6, borderRadius: 3 },
  listingPriceBadge: {
    borderWidth: 1, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, marginLeft: 8,
  },
  footer: { padding: 20, borderTopWidth: 1, gap: 12 },
  sellBtn: { height: 52, alignItems: 'center', justifyContent: 'center' },
  deleteBtn: { height: 44, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
});
