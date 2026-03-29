import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import * as FileSystem from 'expo-file-system';
import * as IntentLauncher from 'expo-intent-launcher';
import { useTheme } from '@/src/theme';
import { useItemStore } from '@/src/store';
import { useSettingsStore } from '@/src/store/useSettingsStore';
import { ThemedView, ThemedText, GlowCard, SkeletonCard, PriceNinjaLogo } from '@/src/components/ui';
import { formatPrice, priceTrend } from '@/src/utils/pricing';
import { TrackedItem } from '@/src/types/item';
import { checkForUpdate, GitHubRelease } from '@/src/api/github-updates';

function ItemCard({ item }: { item: TrackedItem }) {
  const { theme } = useTheme();
  const trend = item.ebaySoldAvg && item.priceHistory.length > 1
    ? priceTrend(item.ebaySoldAvg, item.priceHistory[1]?.ebaySoldAvg ?? item.ebaySoldAvg)
    : 'stable';

  const trendColor = {
    up: theme.colors.priceUp,
    down: theme.colors.priceDown,
    stable: theme.colors.priceStable,
  }[trend];

  const trendIcon = { up: '↑', down: '↓', stable: '→' }[trend];

  return (
    <TouchableOpacity
      onPress={() => router.push(`/item/${item.id}`)}
      accessibilityLabel={`${item.name}, eBay Preis ${item.ebaySoldAvg ? formatPrice(item.ebaySoldAvg) : 'nicht verfügbar'}`}
      activeOpacity={0.8}
    >
      <GlowCard style={styles.itemCard}>
        <View style={styles.itemRow}>
          {/* Image placeholder */}
          <View style={[styles.imagePlaceholder, { backgroundColor: theme.colors.surfaceAlt, borderRadius: theme.radius.md }]}>
            <Text style={{ color: theme.colors.textMuted, fontSize: 28 }}>📦</Text>
          </View>

          <View style={styles.itemInfo}>
            <ThemedText weight="semibold" size="md" numberOfLines={2}>
              {item.name}
            </ThemedText>
            {item.brand && (
              <ThemedText variant="secondary" size="sm">
                {item.brand}
              </ThemedText>
            )}

            <View style={styles.priceRow}>
              {item.ebaySoldAvg ? (
                <View style={styles.priceItem}>
                  <ThemedText variant="muted" size="xs">eBay Ø</ThemedText>
                  <ThemedText weight="bold" size="lg" style={{ color: theme.colors.primary }}>
                    {formatPrice(item.ebaySoldAvg)}
                  </ThemedText>
                </View>
              ) : null}

              {item.geizhalsCheapest ? (
                <View style={styles.priceItem}>
                  <ThemedText variant="muted" size="xs">Geizhals</ThemedText>
                  <ThemedText weight="semibold" size="md">
                    {formatPrice(item.geizhalsCheapest)}
                  </ThemedText>
                </View>
              ) : null}
            </View>
          </View>

          <View style={styles.trendBadge}>
            <Text style={{ color: trendColor, fontSize: 20, fontWeight: 'bold' }}>
              {trendIcon}
            </Text>
          </View>
        </View>

        {item.lastPriceUpdate && (
          <ThemedText variant="muted" size="xs" style={{ marginTop: 8 }}>
            Aktualisiert: {new Date(item.lastPriceUpdate).toLocaleDateString('de-DE')}
          </ThemedText>
        )}
      </GlowCard>
    </TouchableOpacity>
  );
}

function EmptyState() {
  const { theme } = useTheme();
  return (
    <View style={styles.emptyState}>
      <Text style={{ fontSize: 64 }}>📡</Text>
      <ThemedText weight="bold" size="xl" style={{ marginTop: 16, textAlign: 'center' }}>
        Noch keine Artikel
      </ThemedText>
      <ThemedText variant="secondary" style={{ marginTop: 8, textAlign: 'center' }}>
        Scanne deinen ersten Artikel um loszulegen
      </ThemedText>
      <TouchableOpacity
        onPress={() => router.push('/scan-chooser')}
        style={[styles.scanButton, { backgroundColor: theme.colors.primary, borderRadius: theme.radius.md }]}
        accessibilityLabel="Scanner öffnen"
      >
        <Text style={{ color: theme.colors.background, fontWeight: 'bold', fontSize: 16 }}>
          Jetzt scannen
        </Text>
      </TouchableOpacity>
    </View>
  );
}

function ApiCostBanner() {
  const { theme } = useTheme();
  const { scanStats } = useSettingsStore();

  if (scanStats.scansToday === 0) return null;

  const costEur = scanStats.estimatedCostToday * 0.92;
  const costFormatted = costEur.toLocaleString('de-DE', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 4,
    maximumFractionDigits: 4,
  });

  return (
    <GlowCard style={[styles.apiCostCard, { backgroundColor: theme.colors.surface }]}>
      <View style={styles.apiCostRow}>
        <View>
          <ThemedText weight="semibold" size="sm">
            API Kosten heute: {costFormatted}
          </ThemedText>
          <ThemedText variant="muted" size="xs" style={{ marginTop: 2 }}>
            {scanStats.scansToday} {scanStats.scansToday === 1 ? 'Scan' : 'Scans'} heute
          </ThemedText>
        </View>
        <Text style={{ fontSize: 20 }}>💡</Text>
      </View>
    </GlowCard>
  );
}

function UpdateBanner({ release, onDismiss }: { release: GitHubRelease; onDismiss: () => void }) {
  const { theme } = useTheme();
  const [downloading, setDownloading] = useState(false);
  const [progress, setProgress] = useState(0);

  const handleUpdate = async () => {
    setDownloading(true);
    try {
      const dest = `${FileSystem.cacheDirectory}PriceNinja-${release.version}.apk`;
      const dl = FileSystem.createDownloadResumable(
        release.apkUrl,
        dest,
        {},
        ({ totalBytesWritten, totalBytesExpectedToWrite }) => {
          if (totalBytesExpectedToWrite > 0) {
            setProgress(Math.round((totalBytesWritten / totalBytesExpectedToWrite) * 100));
          }
        },
      );
      const result = await dl.downloadAsync();
      if (!result?.uri) throw new Error('Download fehlgeschlagen');
      const contentUri = await FileSystem.getContentUriAsync(result.uri);
      await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
        data: contentUri,
        flags: 1, // FLAG_GRANT_READ_URI_PERMISSION
        type: 'application/vnd.android.package-archive',
      });
    } catch {
      Alert.alert('Update fehlgeschlagen', 'Bitte von GitHub herunterladen.');
    } finally {
      setDownloading(false);
      setProgress(0);
    }
  };

  return (
    <GlowCard style={[styles.updateBanner, { borderColor: theme.colors.primary }]}>
      <View style={{ flex: 1 }}>
        <ThemedText weight="bold" size="sm">🚀 Update verfügbar: {release.version}</ThemedText>
        <ThemedText variant="muted" size="xs" style={{ marginTop: 2 }}>
          {downloading ? `Herunterladen... ${progress}%` : 'Neue Version verfügbar'}
        </ThemedText>
      </View>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <TouchableOpacity
          onPress={handleUpdate}
          disabled={downloading}
          style={[styles.updateBtn, { backgroundColor: theme.colors.primary, opacity: downloading ? 0.7 : 1 }]}
          accessibilityLabel="Update installieren"
        >
          <Text style={{ color: theme.colors.background, fontWeight: 'bold', fontSize: 12 }}>
            {downloading ? `${progress}%` : 'Update'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={onDismiss} accessibilityLabel="Update schließen">
          <Text style={{ color: theme.colors.textMuted, fontSize: 18 }}>✕</Text>
        </TouchableOpacity>
      </View>
    </GlowCard>
  );
}

export default function DashboardScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const { items, isLoading } = useItemStore();
  const [updateRelease, setUpdateRelease] = useState<GitHubRelease | null>(null);

  useEffect(() => {
    checkForUpdate().then((release) => {
      if (release) setUpdateRelease(release);
    });
  }, []);

  const handleRefresh = useCallback(async () => {
    // Price refresh is triggered manually - never auto-fetch
    // TODO: implement batch price refresh via useRefreshPrices hook
  }, []);

  const itemCountLabel = `${items.length} ${items.length === 1 ? 'Artikel' : 'Artikel'} getrackt`;

  return (
    <ThemedView style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: theme.colors.border }]}>
        <View style={styles.headerLeft}>
          <PriceNinjaLogo size="md" variant="default" />
          <ThemedText
            variant="muted"
            size="xs"
            style={{ marginTop: 4 }}
          >
            {itemCountLabel}
          </ThemedText>
        </View>

        <TouchableOpacity
          onPress={() => router.push('/scan-chooser')}
          style={[
            styles.addButton,
            {
              backgroundColor: theme.colors.primary,
              borderRadius: 28,
            },
          ]}
          accessibilityLabel="Neuen Artikel scannen"
          activeOpacity={0.8}
        >
          <Text style={[styles.addButtonText, { color: theme.colors.background }]}>+</Text>
        </TouchableOpacity>
      </View>

      {/* Update banner */}
      {updateRelease && (
        <View style={styles.bannerContainer}>
          <UpdateBanner release={updateRelease} onDismiss={() => setUpdateRelease(null)} />
        </View>
      )}

      {/* API cost banner (only when there were scans today) */}
      <View style={styles.bannerContainer}>
        <ApiCostBanner />
      </View>

      {isLoading && items.length === 0 ? (
        <FlatList
          data={[1, 2, 3]}
          keyExtractor={(i) => String(i)}
          renderItem={() => <SkeletonCard />}
          contentContainerStyle={{ padding: 16 }}
        />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <ItemCard item={item} />}
          contentContainerStyle={[
            styles.listContent,
            items.length === 0 && styles.emptyContainer,
          ]}
          ListEmptyComponent={<EmptyState />}
          refreshControl={
            <RefreshControl
              refreshing={isLoading}
              onRefresh={handleRefresh}
              tintColor={theme.colors.primary}
              colors={[theme.colors.primary]}
            />
          }
          showsVerticalScrollIndicator={false}
        />
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  headerLeft: {
    flex: 1,
  },
  addButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 12,
  },
  addButtonText: {
    fontSize: 28,
    fontWeight: 'bold',
    lineHeight: 32,
    marginTop: -2,
  },
  bannerContainer: {
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  apiCostCard: {
    marginBottom: 0,
  },
  apiCostRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  listContent: {
    padding: 16,
    gap: 12,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  itemCard: {
    marginBottom: 0,
  },
  itemRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
  },
  imagePlaceholder: {
    width: 72,
    height: 72,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemInfo: {
    flex: 1,
    gap: 4,
  },
  priceRow: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 6,
  },
  priceItem: {
    gap: 2,
  },
  trendBadge: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 4,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 32,
  },
  scanButton: {
    marginTop: 24,
    paddingHorizontal: 28,
    paddingVertical: 14,
  },
  updateBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    marginBottom: 8,
  },
  updateBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
});
