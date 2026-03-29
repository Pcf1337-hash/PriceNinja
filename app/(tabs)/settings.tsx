import React, { useState, useCallback } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Alert,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import * as FileSystem from 'expo-file-system';
import * as IntentLauncher from 'expo-intent-launcher';
import { useTheme } from '@/src/theme';
import { useSettingsStore, CurrencyCode } from '@/src/store/useSettingsStore';
import { useEbayStore } from '@/src/store/useEbayStore';
import { ThemedView, ThemedText, GlowCard, PrimaryButton } from '@/src/components/ui';
import { themes } from '@/src/theme/themes';
import { ThemeId } from '@/src/theme/types';
import { clearCache, getCacheSize } from '@/src/utils/cache';
import { formatPrice } from '@/src/utils/pricing';
import { checkForUpdate, GitHubRelease } from '@/src/api/github-updates';
import { APP_VERSION } from '@/src/utils/constants';

function SectionHeader({ title }: { title: string }) {
  const { theme } = useTheme();
  return (
    <ThemedText
      weight="bold"
      variant="accent"
      size="sm"
      style={{ paddingHorizontal: 20, paddingTop: 24, paddingBottom: 8, textTransform: 'uppercase', letterSpacing: 1 }}
    >
      {title}
    </ThemedText>
  );
}

function ThemeSelector() {
  const { theme, themeId, setTheme } = useTheme();
  const { setTheme: updateSettings } = useSettingsStore();

  const handleSelect = (id: ThemeId) => {
    setTheme(id);
    updateSettings(id);
  };

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, gap: 12 }}>
      {Object.values(themes).map((t) => (
        <TouchableOpacity
          key={t.id}
          onPress={() => handleSelect(t.id)}
          accessibilityLabel={`Theme ${t.name} auswählen`}
          style={[
            styles.themeChip,
            {
              backgroundColor: t.colors.background,
              borderColor: themeId === t.id ? t.colors.primary : t.colors.border,
              borderWidth: themeId === t.id ? 2 : 1,
            },
          ]}
        >
          <View style={[styles.themePreview, { backgroundColor: t.colors.surface }]}>
            <View style={[{ width: 12, height: 12, borderRadius: 6, backgroundColor: t.colors.primary }]} />
            <View style={[{ width: 8, height: 8, borderRadius: 4, backgroundColor: t.colors.accent }]} />
          </View>
          <ThemedText size="xs" style={{ color: t.colors.text, textAlign: 'center' }}>
            {t.name}
          </ThemedText>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}

// ── Update Section ────────────────────────────────────────────────────────────
type UpdateStatus = 'idle' | 'checking' | 'up-to-date' | 'available' | 'downloading' | 'ready';

function UpdateSection() {
  const { theme } = useTheme();
  const [status, setStatus] = useState<UpdateStatus>('idle');
  const [update, setUpdate] = useState<GitHubRelease | null>(null);
  const [progress, setProgress] = useState(0);
  const [localApkUri, setLocalApkUri] = useState<string | null>(null);

  const handleCheck = useCallback(async () => {
    setStatus('checking');
    setUpdate(null);
    setLocalApkUri(null);
    const result = await checkForUpdate();
    if (result) {
      setUpdate(result);
      setStatus('available');
    } else {
      setStatus('up-to-date');
    }
  }, []);

  const handleDownload = useCallback(async () => {
    if (!update) return;
    setStatus('downloading');
    setProgress(0);

    const destUri = FileSystem.cacheDirectory + `PriceNinja-${update.version}.apk`;

    const downloadResumable = FileSystem.createDownloadResumable(
      update.apkUrl,
      destUri,
      {},
      ({ totalBytesWritten, totalBytesExpectedToWrite }) => {
        if (totalBytesExpectedToWrite > 0) {
          setProgress(totalBytesWritten / totalBytesExpectedToWrite);
        }
      },
    );

    try {
      const result = await downloadResumable.downloadAsync();
      if (result?.uri) {
        setLocalApkUri(result.uri);
        setStatus('ready');
      } else {
        throw new Error('Download fehlgeschlagen');
      }
    } catch {
      setStatus('available');
      Alert.alert('Download fehlgeschlagen', 'Bitte versuche es erneut.');
    }
  }, [update]);

  const handleInstall = useCallback(async () => {
    if (!localApkUri) return;
    try {
      const contentUri = await FileSystem.getContentUriAsync(localApkUri);
      await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
        data: contentUri,
        flags: 1, // FLAG_GRANT_READ_URI_PERMISSION
        type: 'application/vnd.android.package-archive',
      });
    } catch {
      Alert.alert('Installation fehlgeschlagen', 'Öffne die APK-Datei manuell aus dem Download-Ordner.');
    }
  }, [localApkUri]);

  const progressPct = Math.round(progress * 100);

  return (
    <GlowCard>
      {/* Version row */}
      <View style={styles.statRow}>
        <ThemedText variant="secondary">Aktuelle Version</ThemedText>
        <ThemedText weight="bold">v{APP_VERSION}</ThemedText>
      </View>

      {/* Update available info */}
      {update && (
        <View style={[styles.updateBanner, { backgroundColor: theme.colors.primary + '18', borderColor: theme.colors.primary + '44' }]}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <ThemedText weight="bold" style={{ color: theme.colors.primary }}>
              🚀 Update verfügbar
            </ThemedText>
            <ThemedText weight="bold" style={{ color: theme.colors.primary }}>
              {update.version}
            </ThemedText>
          </View>
          {update.releaseNotes ? (
            <ThemedText variant="muted" size="xs" style={{ marginTop: 4 }} numberOfLines={4}>
              {update.releaseNotes.replace(/#{1,3} /g, '').trim()}
            </ThemedText>
          ) : null}
          {update.apkSize > 0 && (
            <ThemedText variant="muted" size="xs" style={{ marginTop: 2 }}>
              {(update.apkSize / 1024 / 1024).toFixed(1)} MB
            </ThemedText>
          )}
        </View>
      )}

      {/* Download progress bar */}
      {status === 'downloading' && (
        <View style={[styles.progressBar, { backgroundColor: theme.colors.border }]}>
          <View
            style={[
              styles.progressFill,
              { backgroundColor: theme.colors.primary, width: `${progressPct}%` as `${number}%` },
            ]}
          />
        </View>
      )}
      {status === 'downloading' && (
        <ThemedText variant="muted" size="xs" style={{ textAlign: 'center', marginTop: 4 }}>
          Lade herunter... {progressPct}%
        </ThemedText>
      )}

      {/* Status text */}
      {status === 'up-to-date' && (
        <ThemedText variant="success" size="sm" style={{ marginTop: 8, textAlign: 'center' }}>
          ✓ App ist aktuell
        </ThemedText>
      )}
      {status === 'ready' && (
        <ThemedText size="sm" style={{ marginTop: 8, textAlign: 'center', color: theme.colors.primary }}>
          ✓ Download abgeschlossen — tippe Installieren
        </ThemedText>
      )}

      {/* Action buttons */}
      <View style={{ marginTop: 12, gap: 8 }}>
        {(status === 'idle' || status === 'up-to-date') && (
          <PrimaryButton
            title="Nach Updates suchen"
            variant="outline"
            onPress={handleCheck}
          />
        )}
        {status === 'checking' && (
          <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 10, paddingVertical: 8 }}>
            <ActivityIndicator size="small" color={theme.colors.primary} />
            <ThemedText variant="secondary" size="sm">Suche nach Updates...</ThemedText>
          </View>
        )}
        {status === 'available' && (
          <PrimaryButton
            title={`⬇ Herunterladen (${update ? (update.apkSize / 1024 / 1024).toFixed(1) + ' MB' : '...'})`}
            onPress={handleDownload}
          />
        )}
        {status === 'downloading' && (
          <PrimaryButton title="Wird heruntergeladen..." variant="outline" onPress={() => {}} />
        )}
        {status === 'ready' && (
          <PrimaryButton title="📦 Installieren" onPress={handleInstall} />
        )}
        {(status === 'available' || status === 'ready') && (
          <PrimaryButton
            title="Nochmal prüfen"
            variant="outline"
            size="sm"
            onPress={handleCheck}
            style={{ opacity: 0.6 }}
          />
        )}
      </View>
    </GlowCard>
  );
}

export default function SettingsScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const {
    claudeApiKey,
    setClaudeApiKey,
    scanStats,
    cacheSize,
    setCacheSize,
    primaryCurrency,
    secondaryCurrency,
    setPrimaryCurrency,
    setSecondaryCurrency,
  } = useSettingsStore();
  const { papaAccount, ownAccount, activeAccountType, disconnectAccount, setActiveAccount } = useEbayStore();
  const [apiKeyInput, setApiKeyInput] = useState(claudeApiKey);

  const handleSaveApiKey = () => {
    setClaudeApiKey(apiKeyInput.trim());
    Alert.alert('Gespeichert', 'API-Key wurde gespeichert.');
  };

  const handleClearCache = async () => {
    Alert.alert('Cache leeren', 'Alle gecachten Preisdaten werden gelöscht.', [
      { text: 'Abbrechen', style: 'cancel' },
      {
        text: 'Leeren',
        style: 'destructive',
        onPress: async () => {
          await clearCache();
          const newSize = await getCacheSize();
          setCacheSize(newSize);
        },
      },
    ]);
  };

  const handleDisconnectAccount = (type: 'papa' | 'own') => {
    const name = type === 'papa' ? 'Papa eBay' : 'Mein eBay';
    Alert.alert(`${name} trennen`, `Möchtest du ${name} wirklich trennen?`, [
      { text: 'Abbrechen', style: 'cancel' },
      {
        text: 'Trennen',
        style: 'destructive',
        onPress: () => disconnectAccount(type),
      },
    ]);
  };

  return (
    <ThemedView style={[styles.container, { paddingTop: insets.top }]}>
      <View style={[styles.header, { borderBottomColor: theme.colors.border }]}>
        <ThemedText weight="bold" size="xxl">Einstellungen</ThemedText>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Themes */}
        <SectionHeader title="Design" />
        <ThemeSelector />

        {/* Currency */}
        <SectionHeader title="Währung" />
        <View style={{ paddingHorizontal: 20 }}>
          <GlowCard>
            {/* Primary */}
            <View style={styles.currencyRow}>
              <ThemedText size="xs" variant="muted" style={styles.currencyLabel}>PRIMÄR</ThemedText>
              <View style={styles.currencyChips}>
                {(['EUR', 'USD', 'GBP', 'CHF', 'JPY'] as CurrencyCode[]).map((c) => (
                  <TouchableOpacity
                    key={c}
                    onPress={() => setPrimaryCurrency(c)}
                    accessibilityLabel={`Primärwährung ${c}`}
                    style={[
                      styles.currencyChip,
                      primaryCurrency === c
                        ? { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary }
                        : { backgroundColor: 'transparent', borderColor: theme.colors.border },
                    ]}
                  >
                    <ThemedText
                      size="xs"
                      weight={primaryCurrency === c ? 'bold' : 'normal'}
                      style={{ color: primaryCurrency === c ? theme.colors.background : theme.colors.textSecondary }}
                    >
                      {c}
                    </ThemedText>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Divider */}
            <View style={[styles.currencyDivider, { backgroundColor: theme.colors.border }]} />

            {/* Secondary */}
            <View style={styles.currencyRow}>
              <ThemedText size="xs" variant="muted" style={styles.currencyLabel}>ZWEIT</ThemedText>
              <View style={styles.currencyChips}>
                {(['–', 'EUR', 'USD', 'GBP', 'CHF', 'JPY'] as (CurrencyCode | '–')[]).map((c) => {
                  const isSelected = c === '–' ? secondaryCurrency === null : secondaryCurrency === c;
                  return (
                    <TouchableOpacity
                      key={c}
                      onPress={() => setSecondaryCurrency(c === '–' ? null : c)}
                      accessibilityLabel={`Zweitwährung ${c}`}
                      style={[
                        styles.currencyChip,
                        isSelected
                          ? { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary }
                          : { backgroundColor: 'transparent', borderColor: theme.colors.border },
                      ]}
                    >
                      <ThemedText
                        size="xs"
                        weight={isSelected ? 'bold' : 'normal'}
                        style={{ color: isSelected ? theme.colors.background : theme.colors.textSecondary }}
                      >
                        {c}
                      </ThemedText>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          </GlowCard>
        </View>

        {/* eBay Accounts */}
        <SectionHeader title="eBay Konten" />
        <View style={{ paddingHorizontal: 20, gap: 12 }}>
          {/* Papa Account */}
          <GlowCard>
            <View style={styles.accountRow}>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <ThemedText weight="semibold">Papa eBay</ThemedText>
                  <ThemedText size="xs" style={{ color: theme.colors.warning }}>🔒 Nur Preise</ThemedText>
                </View>
                <ThemedText variant="secondary" size="sm">
                  {papaAccount ? `Verbunden als ${papaAccount.username}` : 'Nicht verbunden'}
                </ThemedText>
              </View>
              {papaAccount ? (
                <View style={{ gap: 8 }}>
                  {activeAccountType !== 'papa' && (
                    <PrimaryButton title="Aktivieren" size="sm" onPress={() => setActiveAccount('papa')} />
                  )}
                  {activeAccountType === 'papa' && (
                    <ThemedText variant="success" size="sm" weight="semibold">✓ Aktiv</ThemedText>
                  )}
                  <PrimaryButton title="Trennen" size="sm" variant="danger" onPress={() => handleDisconnectAccount('papa')} />
                </View>
              ) : (
                <PrimaryButton
                  title="Verbinden"
                  size="sm"
                  onPress={() => router.push('/ebay-wizard/welcome?accountType=papa')}
                />
              )}
            </View>
          </GlowCard>

          {/* Own Account */}
          <GlowCard>
            <View style={styles.accountRow}>
              <View style={{ flex: 1 }}>
                <ThemedText weight="semibold">Mein eBay</ThemedText>
                <ThemedText variant="secondary" size="sm">
                  {ownAccount ? `Verbunden als ${ownAccount.username}` : 'Nicht verbunden'}
                </ThemedText>
                <ThemedText variant="muted" size="xs">Preise + Verkaufen</ThemedText>
              </View>
              {ownAccount ? (
                <View style={{ gap: 8 }}>
                  {activeAccountType !== 'own' && (
                    <PrimaryButton title="Aktivieren" size="sm" onPress={() => setActiveAccount('own')} />
                  )}
                  {activeAccountType === 'own' && (
                    <ThemedText variant="success" size="sm" weight="semibold">✓ Aktiv</ThemedText>
                  )}
                  <PrimaryButton title="Trennen" size="sm" variant="danger" onPress={() => handleDisconnectAccount('own')} />
                </View>
              ) : (
                <PrimaryButton
                  title="Verbinden"
                  size="sm"
                  onPress={() => router.push('/ebay-wizard/welcome?accountType=own')}
                />
              )}
            </View>
          </GlowCard>
        </View>

        {/* Claude API Key */}
        <SectionHeader title="Claude API" />
        <View style={{ paddingHorizontal: 20, gap: 12 }}>
          <GlowCard>
            <ThemedText size="sm" variant="secondary" style={{ marginBottom: 8 }}>
              API-Key für Bild-Erkennung (Claude Sonnet)
            </ThemedText>
            <TextInput
              value={apiKeyInput}
              onChangeText={setApiKeyInput}
              placeholder="sk-ant-..."
              placeholderTextColor={theme.colors.textMuted}
              secureTextEntry
              style={[styles.apiKeyInput, {
                backgroundColor: theme.colors.surfaceAlt,
                color: theme.colors.text,
                borderColor: theme.colors.border,
                borderRadius: theme.radius.md,
              }]}
              accessibilityLabel="Claude API Key eingabe"
            />
            <PrimaryButton
              title="Speichern"
              size="sm"
              onPress={handleSaveApiKey}
              style={{ marginTop: 8, alignSelf: 'flex-end' }}
            />
          </GlowCard>
        </View>

        {/* Scan Stats */}
        <SectionHeader title="Statistiken" />
        <View style={{ paddingHorizontal: 20, gap: 12 }}>
          <GlowCard>
            <ThemedText weight="semibold" size="sm" style={{ marginBottom: 8 }}>Artikel Scanner</ThemedText>
            <View style={styles.statRow}>
              <ThemedText variant="secondary">Scans heute</ThemedText>
              <ThemedText weight="bold">{scanStats.scansToday}</ThemedText>
            </View>
            <View style={styles.statRow}>
              <ThemedText variant="secondary">Gesamte Scans</ThemedText>
              <ThemedText weight="bold">{scanStats.totalScans}</ThemedText>
            </View>
          </GlowCard>
          <GlowCard>
            <ThemedText weight="semibold" size="sm" style={{ marginBottom: 8 }}>Karten Scanner</ThemedText>
            <View style={styles.statRow}>
              <ThemedText variant="secondary">Card Scans heute</ThemedText>
              <ThemedText weight="bold">{scanStats.cardScansToday}</ThemedText>
            </View>
            <View style={styles.statRow}>
              <ThemedText variant="secondary">Gesamte Card Scans</ThemedText>
              <ThemedText weight="bold">{scanStats.totalCardScans}</ThemedText>
            </View>
          </GlowCard>
          <GlowCard>
            <View style={styles.statRow}>
              <ThemedText variant="secondary">Geschätzte API-Kosten heute</ThemedText>
              <ThemedText weight="bold">{formatPrice(scanStats.estimatedCostToday, 'USD')}</ThemedText>
            </View>
          </GlowCard>
        </View>

        {/* App Update */}
        <SectionHeader title="App Update" />
        <View style={{ paddingHorizontal: 20 }}>
          <UpdateSection />
        </View>

        {/* Cache */}
        <SectionHeader title="Cache" />
        <View style={{ paddingHorizontal: 20, marginBottom: 40 }}>
          <GlowCard>
            <View style={styles.statRow}>
              <ThemedText variant="secondary">Cache-Größe</ThemedText>
              <ThemedText weight="bold">{Math.round(cacheSize / 1024)} KB</ThemedText>
            </View>
            <PrimaryButton
              title="Cache leeren"
              variant="outline"
              onPress={handleClearCache}
              style={{ marginTop: 12 }}
            />
          </GlowCard>
        </View>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  themeChip: {
    padding: 12,
    borderRadius: 12,
    alignItems: 'center',
    width: 90,
    gap: 8,
  },
  themePreview: {
    width: 48,
    height: 32,
    borderRadius: 6,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  accountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  apiKeyInput: {
    padding: 12,
    borderWidth: 1,
    fontSize: 14,
    fontFamily: 'monospace',
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  currencyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
  },
  currencyLabel: {
    width: 44,
    letterSpacing: 0.5,
  },
  currencyChips: {
    flexDirection: 'row',
    flex: 1,
    flexWrap: 'wrap',
    gap: 6,
  },
  currencyChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1,
  },
  currencyDivider: {
    height: StyleSheet.hairlineWidth,
    marginVertical: 8,
  },
  updateBanner: {
    marginTop: 10,
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
  },
  progressBar: {
    height: 6,
    borderRadius: 3,
    marginTop: 10,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
});
