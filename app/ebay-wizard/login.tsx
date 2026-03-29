import React, { useState } from 'react';
import { View, StyleSheet, TouchableOpacity, Text, ActivityIndicator, Alert } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/src/theme';
import { ThemedView, ThemedText, GlowCard } from '@/src/components/ui';
import { getSelectedAccountType } from './account-type';
import { wizardApiKeys } from './api-keys';
import { exchangeAuthCode, saveEbayAccount } from '@/src/api/ebay';
import { useEbayStore } from '@/src/store/useEbayStore';
import { EbayAccount } from '@/src/types/ebay';
import { EBAY_SANDBOX_AUTH_URL, EBAY_AUTH_URL } from '@/src/utils/constants';

// HTTPS Relay auf Vercel — diese URL wird als Accept URL im eBay RuName eingetragen
// Das Relay leitet weiter zu priceninja://ebay-callback (deep link)
const VERCEL_RELAY_URL = 'https://priceninja-auth-relay.vercel.app/api/ebay-callback';
// Die native App-URL die WebBrowser.openAuthSessionAsync abfängt
const CALLBACK_SCHEME = 'priceninja://ebay-callback';
const USE_SANDBOX = false;

export default function LoginScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const accountType = getSelectedAccountType();
  const { setPapaAccount, setOwnAccount, setActiveAccount } = useEbayStore();
  const [loading, setLoading] = useState(false);

  const scope = accountType === 'papa'
    ? 'https://api.ebay.com/oauth/api_scope'
    : 'https://api.ebay.com/oauth/api_scope https://api.ebay.com/oauth/api_scope/sell.inventory';

  const handleLogin = async () => {
    const { appId, certId, ruName } = wizardApiKeys;

    if (!appId || !certId || !ruName) {
      Alert.alert('Fehler', 'App ID, Cert ID und RuName müssen ausgefüllt sein.');
      return;
    }

    const baseAuthUrl = USE_SANDBOX ? EBAY_SANDBOX_AUTH_URL : EBAY_AUTH_URL;
    // eBay: redirect_uri im Auth-URL muss der RuName sein (nicht die callback URL)
    const authUrl =
      `${baseAuthUrl}?client_id=${appId}` +
      `&response_type=code` +
      `&redirect_uri=${encodeURIComponent(ruName)}` +
      `&scope=${encodeURIComponent(scope)}` +
      `&prompt=login`;

    setLoading(true);
    try {
      const result = await WebBrowser.openAuthSessionAsync(authUrl, CALLBACK_SCHEME);

      if (result.type === 'cancel' || result.type === 'dismiss') {
        return;
      }

      if (result.type !== 'success' || !result.url) {
        Alert.alert('Fehler', 'eBay Login abgebrochen oder fehlgeschlagen.');
        return;
      }

      const url = new URL(result.url);
      const code = url.searchParams.get('code');
      if (!code) {
        Alert.alert('Fehler', 'Kein Autorisierungscode erhalten. Bitte prüfe den RuName.');
        return;
      }

      const tokens = await exchangeAuthCode(appId, certId, ruName, code, USE_SANDBOX);

      const account: EbayAccount = {
        type: accountType,
        username: accountType === 'papa' ? 'Papa' : 'Mein Account',
        appId,
        certId,
        ruName,
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        tokenExpiresAt: tokens.expiresAt,
        connectedAt: new Date().toISOString(),
        isSandbox: USE_SANDBOX,
      };

      await saveEbayAccount(account);

      if (accountType === 'papa') {
        setPapaAccount(account);
      } else {
        setOwnAccount(account);
      }
      setActiveAccount(accountType);

      router.replace('/ebay-wizard/done');
    } catch (e) {
      console.error('eBay Login Fehler:', e);
      Alert.alert(
        'Login fehlgeschlagen',
        'Token-Austausch fehlgeschlagen. Bitte prüfe App ID, Cert ID und RuName.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <ThemedView style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} accessibilityLabel="Zurück">
          <Text style={{ color: theme.colors.textSecondary, fontSize: 16 }}>← Zurück</Text>
        </TouchableOpacity>
        <ThemedText variant="muted" size="sm">Schritt 4 von 5</ThemedText>
      </View>

      <View style={styles.content}>
        <ThemedText weight="bold" size="xxl" style={{ marginBottom: 12 }}>
          eBay Login
        </ThemedText>
        <ThemedText variant="secondary" style={{ lineHeight: 22, marginBottom: 32 }}>
          Tippe auf den Button um dich mit deinem eBay-Account anzumelden. Der sichere Browser öffnet sich und schließt sich nach dem Login automatisch.
        </ThemedText>

        <TouchableOpacity
          style={[
            styles.loginButton,
            {
              backgroundColor: theme.colors.primary,
              borderRadius: theme.radius.md,
              opacity: loading ? 0.6 : 1,
            },
          ]}
          onPress={handleLogin}
          disabled={loading}
          accessibilityLabel="Mit eBay anmelden"
        >
          {loading ? (
            <ActivityIndicator color="#000" />
          ) : (
            <Text style={styles.loginButtonText}>Mit eBay anmelden</Text>
          )}
        </TouchableOpacity>

        <GlowCard style={{ marginTop: 24, borderColor: theme.colors.info + '44' }}>
          <ThemedText variant="muted" size="sm" style={{ lineHeight: 20 }}>
            ℹ️ Der RuName muss in der eBay Developer Console als Accept URL eingetragen sein:{'\n'}
            https://priceninja-auth-relay.vercel.app/api/ebay-callback
          </ThemedText>
        </GlowCard>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  content: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
  },
  loginButton: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  loginButtonText: {
    color: '#000',
    fontSize: 16,
    fontWeight: '700',
  },
});
