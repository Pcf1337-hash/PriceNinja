import React, { useRef, useState } from 'react';
import { View, StyleSheet, TouchableOpacity, Text, ActivityIndicator, Alert } from 'react-native';
import { WebView, WebViewNavigation } from 'react-native-webview';
import type { WebViewErrorEvent, WebViewHttpErrorEvent } from 'react-native-webview/lib/WebViewTypes';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/src/theme';
import { ThemedView, ThemedText } from '@/src/components/ui';
import { getSelectedAccountType } from './account-type';
import { wizardApiKeys } from './api-keys';
import { exchangeAuthCode, saveEbayAccount } from '@/src/api/ebay';
import { useEbayStore } from '@/src/store/useEbayStore';
import { EbayAccount } from '@/src/types/ebay';
import {
  EBAY_SANDBOX_AUTH_URL,
  EBAY_AUTH_URL,
} from '@/src/utils/constants';

// REDIRECT_URI must be registered in eBay developer settings under "Auth accepted URL"
const REDIRECT_URI = 'priceninja://ebay-callback';
const USE_SANDBOX = false; // Production eBay — use production keys

export default function LoginScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const accountType = getSelectedAccountType();
  const { setPapaAccount, setOwnAccount, setActiveAccount } = useEbayStore();
  const [loading, setLoading] = useState(true);
  const [exchanging, setExchanging] = useState(false);

  const scope = accountType === 'papa'
    ? 'https://api.ebay.com/oauth/api_scope'
    : 'https://api.ebay.com/oauth/api_scope https://api.ebay.com/oauth/api_scope/sell.inventory';

  const baseAuthUrl = USE_SANDBOX ? EBAY_SANDBOX_AUTH_URL : EBAY_AUTH_URL;
  const authUrl = `${baseAuthUrl}?client_id=${wizardApiKeys.appId}&response_type=code&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&scope=${encodeURIComponent(scope)}`;

  const handleNavChange = async (nav: WebViewNavigation) => {
    const url = nav.url;
    if (!url.startsWith(REDIRECT_URI)) return;

    const urlObj = new URL(url);
    const code = urlObj.searchParams.get('code');
    if (!code) {
      router.back();
      return;
    }

    setExchanging(true);
    try {
      const tokens = await exchangeAuthCode(
        wizardApiKeys.appId,
        wizardApiKeys.certId,
        wizardApiKeys.clientSecret,
        code,
        REDIRECT_URI,
        USE_SANDBOX
      );

      const account: EbayAccount = {
        type: accountType,
        username: accountType === 'papa' ? 'Papa' : 'Mein Account',
        appId: wizardApiKeys.appId,
        certId: wizardApiKeys.certId,
        clientSecret: wizardApiKeys.clientSecret,
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
      console.error('Token exchange failed:', e);
      router.back();
    } finally {
      setExchanging(false);
    }
  };

  if (exchanging) {
    return (
      <ThemedView style={[styles.container, styles.centered, { paddingTop: insets.top }]}>
        <ActivityIndicator color={theme.colors.primary} size="large" />
        <ThemedText variant="secondary" style={{ marginTop: 16 }}>
          Account wird verbunden...
        </ThemedText>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} accessibilityLabel="Zurück">
          <Text style={{ color: theme.colors.textSecondary, fontSize: 16 }}>← Zurück</Text>
        </TouchableOpacity>
        <ThemedText variant="muted" size="sm">Schritt 4 von 5</ThemedText>
      </View>

      {loading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator color={theme.colors.primary} size="large" />
          <ThemedText variant="secondary" style={{ marginTop: 12 }}>
            eBay Login wird geladen...
          </ThemedText>
        </View>
      )}

      <WebView
        source={{ uri: authUrl }}
        onNavigationStateChange={handleNavChange}
        onShouldStartLoadWithRequest={(request) => {
          if (request.url.startsWith('priceninja://')) {
            // Intercept custom scheme — handle manually, prevent WebView error
            handleNavChange({ url: request.url } as WebViewNavigation);
            return false;
          }
          return true;
        }}
        onLoad={() => setLoading(false)}
        onError={(_e: WebViewErrorEvent) => {
          Alert.alert(
            'Fehler',
            'eBay konnte nicht geladen werden. Bitte prüfe deine Internetverbindung.',
            [{ text: 'OK', onPress: () => router.back() }]
          );
        }}
        onHttpError={(e: WebViewHttpErrorEvent) => {
          if (e.nativeEvent.statusCode >= 400) {
            Alert.alert(
              'Fehler',
              `eBay hat einen Fehler zurückgegeben (${e.nativeEvent.statusCode}). Bitte versuche es erneut.`,
              [{ text: 'OK', onPress: () => router.back() }]
            );
          }
        }}
        style={{ flex: 1 }}
        originWhitelist={['*']}
        accessibilityLabel="eBay Login WebView"
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16 },
  loadingOverlay: { position: 'absolute', top: '50%', left: 0, right: 0, alignItems: 'center', zIndex: 10 },
});
