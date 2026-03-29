import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  Alert,
  Image,
  Modal,
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
          {/* Product image */}
          {item.imageUri ? (
            <Image
              source={{ uri: item.imageUri }}
              style={[styles.imagePlaceholder, { borderRadius: theme.radius.md }]}
              resizeMode="cover"
            />
          ) : (
            <View style={[styles.imagePlaceholder, { backgroundColor: theme.colors.surfaceAlt, borderRadius: theme.radius.md, alignItems: 'center', justifyContent: 'center' }]}>
              <Text style={{ color: theme.colors.textMuted, fontSize: 28 }}>📦</Text>
            </View>
          )}

          <View style={styles.itemInfo}>
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 6 }}>
              <ThemedText weight="semibold" size="md" numberOfLines={2} style={{ flex: 1 }}>
                {item.name}
              </ThemedText>
              {item.isLegoOrBricks && (
                <View style={{ backgroundColor: '#f5c518', borderRadius: 4, paddingHorizontal: 5, paddingVertical: 2, marginTop: 2 }}>
                  <Text style={{ color: '#000', fontSize: 9, fontWeight: '800' }}>LEGO</Text>
                </View>
              )}
            </View>
            {(item.brand || item.legoTheme || item.legoSetNumber) && (
              <ThemedText variant="secondary" size="sm">
                {item.legoTheme ?? item.brand}{item.legoSetNumber ? ` · Set ${item.legoSetNumber}` : ''}
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
              {item.bricklinkAvg && item.bricklinkAvg > 0 ? (
                <View style={styles.priceItem}>
                  <ThemedText variant="muted" size="xs" style={{ color: '#e3000b99' }}>BL Ø</ThemedText>
                  <ThemedText weight="semibold" size="md" style={{ color: '#e3000b' }}>
                    {formatPrice(item.bricklinkAvg)}
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

function UpdateModal({ release, onDismiss }: { release: GitHubRelease; onDismiss: () => void }) {
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
        flags: 1,
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
    <Modal transparent animationType="fade" visible onRequestClose={onDismiss}>
      <View style={modalStyles.backdrop}>
        <View style={[modalStyles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.primary }]}>
          <Text style={{ fontSize: 40, textAlign: 'center', marginBottom: 8 }}>🚀</Text>
          <Text style={{ color: theme.colors.text, fontWeight: 'bold', fontSize: 18, textAlign: 'center', marginBottom: 4 }}>
            Update verfügbar!
          </Text>
          <Text style={{ color: theme.colors.textMuted, fontSize: 14, textAlign: 'center', marginBottom: 20 }}>
            Version {release.version} ist bereit zum Installieren.
          </Text>
          <TouchableOpacity
            onPress={handleUpdate}
            disabled={downloading}
            style={[modalStyles.btn, { backgroundColor: theme.colors.primary, opacity: downloading ? 0.7 : 1 }]}
            accessibilityLabel="Update installieren"
          >
            <Text style={{ color: theme.colors.background, fontWeight: 'bold', fontSize: 15 }}>
              {downloading ? `Herunterladen... ${progress}%` : 'Jetzt updaten'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={onDismiss} style={[modalStyles.btn, { backgroundColor: 'transparent', marginTop: 8 }]}>
            <Text style={{ color: theme.colors.textMuted, fontSize: 14 }}>Später</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const modalStyles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', alignItems: 'center', justifyContent: 'center' },
  card: { width: '80%', borderRadius: 16, borderWidth: 1, padding: 24, alignItems: 'center' },
  btn: { width: '100%', paddingVertical: 13, borderRadius: 10, alignItems: 'center' },
});

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
  const [activeTab, setActiveTab] = useState<'items' | 'brix'>('items');

  useEffect(() => {
    checkForUpdate().then((release) => {
      if (release) setUpdateRelease(release);
    });
  }, []);

  const handleRefresh = useCallback(async () => {}, []);

  const itemsTab = items.filter(i => !i.isLegoOrBricks && !i.bricklinkUrl);
  const brixTab = items.filter(i => i.isLegoOrBricks || !!i.bricklinkUrl);
  const displayItems = activeTab === 'items' ? itemsTab : brixTab;

  return (
    <ThemedView style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: theme.colors.border }]}>
        <View style={styles.headerLeft}>
          <PriceNinjaLogo size="md" variant="default" />
          <ThemedText variant="muted" size="xs" style={{ marginTop: 4 }}>
            {activeTab === 'items'
              ? `${itemsTab.length} Artikel`
              : `${brixTab.length} Sets`}
          </ThemedText>
        </View>
        <TouchableOpacity
          onPress={() => router.push('/scan-chooser')}
          style={[styles.addButton, { backgroundColor: theme.colors.primary, borderRadius: 28 }]}
          accessibilityLabel="Neuen Artikel scannen"
          activeOpacity={0.8}
        >
          <Text style={[styles.addButtonText, { color: theme.colors.background }]}>+</Text>
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <View style={[styles.tabRow, { borderBottomColor: theme.colors.border }]}>
        <TouchableOpacity
          onPress={() => setActiveTab('items')}
          style={[styles.tab, activeTab === 'items' && { borderBottomColor: theme.colors.primary, borderBottomWidth: 2 }]}
          accessibilityLabel="Artikel Tab"
        >
          <ThemedText
            weight={activeTab === 'items' ? 'bold' : 'regular'}
            style={{ color: activeTab === 'items' ? theme.colors.primary : theme.colors.textSecondary }}
          >
            📦 Artikel
          </ThemedText>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setActiveTab('brix')}
          style={[styles.tab, activeTab === 'brix' && { borderBottomColor: '#f5c518', borderBottomWidth: 2 }]}
          accessibilityLabel="Brix Tab"
        >
          <ThemedText
            weight={activeTab === 'brix' ? 'bold' : 'regular'}
            style={{ color: activeTab === 'brix' ? '#b8940a' : theme.colors.textSecondary }}
          >
            🧱 Brix {brixTab.length > 0 && `(${brixTab.length})`}
          </ThemedText>
        </TouchableOpacity>
      </View>

      {/* Update modal */}
      {updateRelease && (
        <UpdateModal release={updateRelease} onDismiss={() => setUpdateRelease(null)} />
      )}

      {isLoading && items.length === 0 ? (
        <FlatList
          data={[1, 2, 3]}
          keyExtractor={(i) => String(i)}
          renderItem={() => <SkeletonCard />}
          contentContainerStyle={{ padding: 16 }}
        />
      ) : (
        <FlatList
          data={displayItems}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <ItemCard item={item} />}
          contentContainerStyle={[
            styles.listContent,
            displayItems.length === 0 && styles.emptyContainer,
          ]}
          ListEmptyComponent={
            activeTab === 'brix' ? (
              <View style={styles.emptyState}>
                <Text style={{ fontSize: 64 }}>🧱</Text>
                <ThemedText weight="bold" size="xl" style={{ marginTop: 16, textAlign: 'center' }}>
                  Noch keine LEGO-Sets
                </ThemedText>
                <ThemedText variant="secondary" style={{ marginTop: 8, textAlign: 'center' }}>
                  Scanne ein LEGO-Set oder eine Figur — der Scanner erkennt es automatisch
                </ThemedText>
              </View>
            ) : (
              <EmptyState />
            )
          }
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
  tabRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
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
