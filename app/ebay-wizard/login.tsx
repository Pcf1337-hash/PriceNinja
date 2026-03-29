import React, { useState } from 'react';
import { View, StyleSheet, TouchableOpacity, Text, ActivityIndicator, Alert } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { router } from 'expo-router';
import Constants from 'expo-constants';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/src/theme';
import { ThemedView, ThemedText, GlowCard } from '@/src/components/ui';
import { getSelectedAccountType } from './account-type';
import { exchangeAuthCode, saveEbayAccount } from '@/src/api/ebay';
import { useEbayStore } from '@/src/store/useEbayStore';
import { EbayAccount } from '@/src/types/ebay';
import { EBAY_SANDBOX_AUTH_URL, EBAY_AUTH_URL } from '@/src/utils/constants';

const USE_SANDBOX = false;
// HTTPS Relay leitet priceninja://ebay-callback weiter — als Accept URL im eBay RuName eingetragen
const CALLBACK_SCHEME = 'priceninja://ebay-callback';

// Credentials aus .env (eingebaut beim Build)
const ENV = Constants.expoConfig?.extra ?? {};
const APP_ID = ENV.ebayAppId as string;
const CERT_ID = ENV.ebayCertId as string;
const RU_NAME = ENV.ebayRuName as string;

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
    if (!APP_ID || !CERT_ID || !RU_NAME) {
      Alert.alert(
        'Konfigurationsfehler',
        'eBay API-Zugangsdaten fehlen im App-Build. Bitte den Entwickler kontaktieren.'
      );
      return;
    }

    const baseAuthUrl = USE_SANDBOX ? EBAY_SANDBOX_AUTH_URL : EBAY_AUTH_URL;
    const authUrl =
      `${baseAuthUrl}?client_id=${APP_ID}` +
      `&response_type=code` +
      `&redirect_uri=${encodeURIComponent(RU_NAME)}` +
      `&scope=${encodeURIComponent(scope)}` +
      `&prompt=login`;

    setLoading(true);
    try {
      const result = await WebBrowser.openAuthSessionAsync(authUrl, CALLBACK_SCHEME);

      if (result.type === 'cancel' || result.type === 'dismiss') return;

      if (result.type !== 'success' || !result.url) {
        Alert.alert('Fehler', 'eBay Login abgebrochen oder fehlgeschlagen.');
        return;
      }

      const url = new URL(result.url);
      const code = url.searchParams.get('code');
      if (!code) {
        Alert.alert('Fehler', 'Kein Autorisierungscode erhalten.');
        return;
      }

      const tokens = await exchangeAuthCode(APP_ID, CERT_ID, RU_NAME, code, USE_SANDBOX);

      const account: EbayAccount = {
        type: accountType,
        username: accountType === 'papa' ? 'Papa' : 'Mein Account',
        appId: APP_ID,
        certId: CERT_ID,
        ruName: RU_NAME,
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
      Alert.alert('Login fehlgeschlagen', 'Bitte versuche es erneut.');
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
        <ThemedText variant="muted" size="sm">Schritt 3 von 4</ThemedText>
      </View>

      <View style={styles.content}>
        <Text style={{ fontSize: 64, textAlign: 'center', marginBottom: 24 }}>🔑</Text>
        <ThemedText weight="bold" size="xxl" style={{ textAlign: 'center', marginBottom: 12 }}>
          Mit eBay anmelden
        </ThemedText>
        <ThemedText variant="secondary" style={{ textAlign: 'center', lineHeight: 22, marginBottom: 40 }}>
          Tippe auf den Button. Der sichere eBay-Browser öffnet sich — einfach einloggen, fertig.
        </ThemedText>

        <TouchableOpacity
          style={[
            styles.loginButton,
            { backgroundColor: theme.colors.primary, borderRadius: theme.radius.md, opacity: loading ? 0.6 : 1 },
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
