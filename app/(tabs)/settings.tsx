import React, { useState } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Alert,
  TextInput,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useTheme } from '@/src/theme';
import { useSettingsStore, CurrencyCode } from '@/src/store/useSettingsStore';
import { useEbayStore } from '@/src/store/useEbayStore';
import { ThemedView, ThemedText, GlowCard, PrimaryButton } from '@/src/components/ui';
import { themes } from '@/src/theme/themes';
import { ThemeId } from '@/src/theme/types';
import { clearCache, getCacheSize } from '@/src/utils/cache';
import { formatPrice } from '@/src/utils/pricing';

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
        <View style={{ paddingHorizontal: 20, gap: 16 }}>
          <View>
            <ThemedText size="sm" variant="secondary" style={{ marginBottom: 8 }}>
              Primärwährung
            </ThemedText>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
              {(['EUR', 'USD', 'GBP', 'CHF', 'JPY'] as CurrencyCode[]).map((c) => (
                <TouchableOpacity
                  key={c}
                  onPress={() => setPrimaryCurrency(c)}
                  accessibilityLabel={`Primärwährung ${c} wählen`}
                  style={[
                    styles.currencyChip,
                    {
                      backgroundColor: primaryCurrency === c ? theme.colors.surface : 'transparent',
                      borderColor: primaryCurrency === c ? theme.colors.primary : theme.colors.border,
                      borderWidth: primaryCurrency === c ? 2 : 1,
                    },
                  ]}
                >
                  <ThemedText
                    size="sm"
                    weight={primaryCurrency === c ? 'semibold' : 'normal'}
                    style={{ color: primaryCurrency === c ? theme.colors.primary : theme.colors.text }}
                  >
                    {c}
                  </ThemedText>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          <View>
            <ThemedText size="sm" variant="secondary" style={{ marginBottom: 8 }}>
              Zweitwährung
            </ThemedText>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
              {(['Keine', 'EUR', 'USD', 'GBP', 'CHF', 'JPY'] as (CurrencyCode | 'Keine')[]).map((c) => {
                const isSelected = c === 'Keine' ? secondaryCurrency === null : secondaryCurrency === c;
                return (
                  <TouchableOpacity
                    key={c}
                    onPress={() => setSecondaryCurrency(c === 'Keine' ? null : c)}
                    accessibilityLabel={`Zweitwährung ${c} wählen`}
                    style={[
                      styles.currencyChip,
                      {
                        backgroundColor: isSelected ? theme.colors.surface : 'transparent',
                        borderColor: isSelected ? theme.colors.primary : theme.colors.border,
                        borderWidth: isSelected ? 2 : 1,
                      },
                    ]}
                  >
                    <ThemedText
                      size="sm"
                      weight={isSelected ? 'semibold' : 'normal'}
                      style={{ color: isSelected ? theme.colors.primary : theme.colors.text }}
                    >
                      {c}
                    </ThemedText>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>

          <ThemedText variant="muted" size="xs">
            Preise werden in beiden Währungen angezeigt
          </ThemedText>
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
                  onPress={() => router.push('/ebay-wizard/account-type')}
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
                  onPress={() => router.push('/ebay-wizard/account-type')}
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
              API-Key für Bild-Erkennung (Claude Haiku)
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
        <View style={{ paddingHorizontal: 20 }}>
          <GlowCard>
            <View style={styles.statRow}>
              <ThemedText variant="secondary">Scans heute</ThemedText>
              <ThemedText weight="bold">{scanStats.scansToday}</ThemedText>
            </View>
            <View style={styles.statRow}>
              <ThemedText variant="secondary">Scans diese Stunde</ThemedText>
              <ThemedText weight="bold">{scanStats.scansThisHour} / 30</ThemedText>
            </View>
            <View style={styles.statRow}>
              <ThemedText variant="secondary">Gesamte Scans</ThemedText>
              <ThemedText weight="bold">{scanStats.totalScans}</ThemedText>
            </View>
            <View style={styles.statRow}>
              <ThemedText variant="secondary">Geschätzte API-Kosten heute</ThemedText>
              <ThemedText weight="bold">{formatPrice(scanStats.estimatedCostToday, 'USD')}</ThemedText>
            </View>
          </GlowCard>
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
  currencyChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 24,
  },
});
