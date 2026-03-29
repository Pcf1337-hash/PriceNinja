import React, { useState } from 'react';
import {
  View, StyleSheet, TextInput, ScrollView, TouchableOpacity,
  Text, ActivityIndicator, Alert, Linking,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/src/theme';
import { ThemedView, ThemedText, GlowCard, PrimaryButton } from '@/src/components/ui';
import { getSelectedAccountType } from './account-type';

// Shared API keys for wizard flow
export let wizardApiKeys = { appId: '', certId: '', ruName: '' };

export default function ApiKeysScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const [appId, setAppId] = useState('');
  const [certId, setCertId] = useState('');
  const [ruName, setRuName] = useState('');
  const [validating, setValidating] = useState(false);
  const accountType = getSelectedAccountType();

  const isValid = appId.trim().length > 10 && certId.trim().length > 10 && ruName.trim().length > 5;

  const handleNext = async () => {
    wizardApiKeys = { appId: appId.trim(), certId: certId.trim(), ruName: ruName.trim() };
    router.push('/ebay-wizard/login');
  };

  const inputStyle = [
    styles.input,
    {
      backgroundColor: theme.colors.surfaceAlt,
      color: theme.colors.text,
      borderColor: theme.colors.border,
      borderRadius: theme.radius.md,
    },
  ];

  return (
    <ThemedView style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} accessibilityLabel="Zurück">
          <Text style={{ color: theme.colors.textSecondary, fontSize: 16 }}>← Zurück</Text>
        </TouchableOpacity>
        <ThemedText variant="muted" size="sm">Schritt 3 von 5</ThemedText>
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, gap: 16, paddingBottom: insets.bottom + 80 }}>
        <ThemedText weight="bold" size="xxl">API Keys</ThemedText>
        <ThemedText variant="secondary" style={{ lineHeight: 22 }}>
          Du brauchst einen kostenlosen eBay Developer Account. Die Keys bekommst du in der eBay Developer Console.
        </ThemedText>

        <TouchableOpacity
          onPress={() => Linking.openURL('https://developer.ebay.com/my/keys')}
          accessibilityLabel="eBay Developer Console öffnen"
        >
          <ThemedText style={{ color: theme.colors.primary, textDecorationLine: 'underline' }}>
            → eBay Developer Console öffnen
          </ThemedText>
        </TouchableOpacity>

        <GlowCard style={{ gap: 16 }}>
          <View>
            <ThemedText weight="semibold" style={{ marginBottom: 6 }}>App ID (Client ID)</ThemedText>
            <TextInput
              value={appId}
              onChangeText={setAppId}
              placeholder="EmioTrad-EmioApp-PRD-..."
              placeholderTextColor={theme.colors.textMuted}
              style={inputStyle}
              autoCapitalize="none"
              autoCorrect={false}
              accessibilityLabel="App ID eingabe"
            />
          </View>

          <View>
            <ThemedText weight="semibold" style={{ marginBottom: 6 }}>Cert ID (Client Secret)</ThemedText>
            <TextInput
              value={certId}
              onChangeText={setCertId}
              placeholder="PRD-..."
              placeholderTextColor={theme.colors.textMuted}
              style={inputStyle}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              accessibilityLabel="Cert ID eingabe"
            />
          </View>

          <View>
            <ThemedText weight="semibold" style={{ marginBottom: 6 }}>RuName (Redirect URI Name)</ThemedText>
            <TextInput
              value={ruName}
              onChangeText={setRuName}
              placeholder="DeinName-PriceNin-PRD-xxxxxxxx"
              placeholderTextColor={theme.colors.textMuted}
              style={inputStyle}
              autoCapitalize="none"
              autoCorrect={false}
              accessibilityLabel="RuName eingabe"
            />
          </View>
        </GlowCard>

        <GlowCard style={{ borderColor: theme.colors.info + '44' }}>
          <ThemedText variant="muted" size="sm" style={{ lineHeight: 20 }}>
            💡 Den RuName findest du unter: eBay Developer Console → Application Keys → [deine App] → User Tokens → "Get a Token from eBay via Your Application". Der RuName sieht aus wie: DeinName-PriceNin-PRD-xxxxxxxx
          </ThemedText>
        </GlowCard>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
        <PrimaryButton
          title={validating ? 'Wird geprüft...' : 'Weiter: eBay Login'}
          onPress={handleNext}
          disabled={!isValid || validating}
          loading={validating}
          style={{ width: '100%' }}
        />
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16 },
  input: { padding: 12, borderWidth: 1, fontSize: 14, fontFamily: 'monospace' },
  footer: { paddingHorizontal: 20, paddingTop: 16 },
});
