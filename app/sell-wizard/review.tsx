import React, { useState } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Image,
  ActivityIndicator,
  Linking,
  Text,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/src/theme';
import { ThemedView, ThemedText, GlowCard, PrimaryButton } from '@/src/components/ui';
import { useEbayStore } from '@/src/store/useEbayStore';
import { uploadImageToEbay, createEbayListing, EbayListingRequest } from '@/src/api/ebay';

const EBAY_FEE_RATE = 0.139;

function parseShipping(shipping: string): number {
  if (!shipping || shipping === 'Kostenlos') return 0;
  return parseFloat(shipping.replace(',', '.').replace(' €', '')) || 0;
}

export default function SellWizardReview() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const { activeAccountType, ownAccount, getPermissions } = useEbayStore();
  const [submitting, setSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<string>('');
  const [resultUrl, setResultUrl] = useState<string | null>(null);

  const params = useLocalSearchParams<{
    title: string;
    description: string;
    condition: string;
    price: string;
    shipping: string;
    duration: string;
    listingType: string;
    startPrice: string;
    photoUris: string;
  }>();

  const {
    title = '',
    description = '',
    condition = '',
    price = '',
    shipping = '',
    duration = '',
    listingType = 'Festpreis',
    startPrice = '',
    photoUris = '[]',
  } = params;

  const photos: string[] = (() => {
    try { return JSON.parse(photoUris) as string[]; }
    catch { return []; }
  })();

  const priceNum = parseFloat(price) || 0;
  const shippingNum = parseShipping(shipping);
  const ebayFee = (priceNum + shippingNum) * EBAY_FEE_RATE;
  const netEarnings = priceNum - ebayFee;

  const handleCancel = () => {
    Alert.alert(
      'Abbrechen',
      'Möchtest du den Verkauf wirklich abbrechen?',
      [
        { text: 'Weiter bearbeiten', style: 'cancel' },
        { text: 'Abbrechen', style: 'destructive', onPress: () => router.dismissAll() },
      ]
    );
  };

  const handleSubmit = async () => {
    const permissions = getPermissions();

    if (!ownAccount || activeAccountType !== 'own' || !permissions.canCreateListings) {
      Alert.alert(
        'Eigener eBay-Account benötigt',
        'Du brauchst deinen eigenen eBay-Account zum Verkaufen. Jetzt verbinden?',
        [
          { text: 'Abbrechen', style: 'cancel' },
          { text: 'Verbinden', onPress: () => router.push('/ebay-wizard/account-type') },
        ]
      );
      return;
    }

    setSubmitting(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      // ── 1. Fotos hochladen ──
      const hostedUrls: string[] = [];
      const localPhotos = photos.filter(p => p.startsWith('file://') || p.startsWith('content://'));
      const externalPhotos = photos.filter(p => p.startsWith('http'));

      // External eBay URLs direkt verwenden
      hostedUrls.push(...externalPhotos);

      // Lokale Fotos zu eBay Picture Services hochladen
      for (let i = 0; i < localPhotos.length; i++) {
        setSubmitStatus(`Foto ${i + 1}/${localPhotos.length} wird hochgeladen...`);
        try {
          const url = await uploadImageToEbay(ownAccount, localPhotos[i]);
          hostedUrls.push(url);
        } catch {
          // Foto-Upload fehlgeschlagen → überspringen, nicht abbrechen
          console.warn(`Foto ${i + 1} konnte nicht hochgeladen werden`);
        }
      }

      // ── 2. Angebot erstellen ──
      setSubmitStatus('Angebot wird bei eBay erstellt...');

      const req: EbayListingRequest = {
        title,
        description,
        condition,
        price: priceNum,
        listingType: listingType as 'Festpreis' | 'Auktion',
        startPrice: startPrice ? parseFloat(startPrice) : undefined,
        shippingCost: shippingNum,
        duration: duration as '7 Tage' | '10 Tage' | '30 Tage',
        imageUrls: hostedUrls.slice(0, 12),
      };

      const result = await createEbayListing(ownAccount, req);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setResultUrl(result.listingUrl);
      setSubmitStatus('');
    } catch (e) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Fehler', String(e));
    } finally {
      setSubmitting(false);
    }
  };

  // ── Erfolg ──
  if (resultUrl) {
    return (
      <ThemedView style={[styles.container, { paddingTop: insets.top }]}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 20 }}>
          <Text style={{ fontSize: 72 }}>🎉</Text>
          <ThemedText weight="bold" size="xxl" style={{ textAlign: 'center' }}>
            Angebot erstellt!
          </ThemedText>
          <ThemedText variant="secondary" style={{ textAlign: 'center', lineHeight: 22 }}>
            Dein Artikel ist jetzt auf eBay live. Tippe auf den Link um das Angebot anzusehen.
          </ThemedText>

          <TouchableOpacity
            onPress={() => Linking.openURL(resultUrl)}
            style={[styles.linkBtn, { borderColor: theme.colors.primary + '66', backgroundColor: theme.colors.surface }]}
            accessibilityLabel="Angebot auf eBay öffnen"
          >
            <ThemedText style={{ color: theme.colors.primary }} weight="semibold">
              Angebot auf eBay öffnen →
            </ThemedText>
          </TouchableOpacity>

          <PrimaryButton
            title="Fertig"
            size="lg"
            onPress={() => router.dismissAll()}
            style={{ width: '100%', marginTop: 12 }}
            accessibilityLabel="Wizard schließen"
          />
        </View>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={[styles.container, { paddingTop: insets.top }]}>
      <View style={[styles.header, { borderBottomColor: theme.colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} accessibilityLabel="Zurück">
          <ThemedText variant="secondary">← Zurück</ThemedText>
        </TouchableOpacity>
        <View style={{ alignItems: 'center' }}>
          <ThemedText weight="bold" size="lg">Überprüfen</ThemedText>
          <ThemedText variant="muted" size="xs">Schritt 3 von 3</ThemedText>
        </View>
        <View style={{ width: 80 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>

        {/* ── Fotos ── */}
        {photos.length > 0 && (
          <>
            <ThemedText weight="semibold" style={styles.sectionLabel}>
              Fotos ({photos.length})
            </ThemedText>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 10, paddingVertical: 4, marginBottom: 4 }}
            >
              {photos.map((uri, i) => (
                <View key={uri + i} style={styles.photoThumb}>
                  <Image source={{ uri }} style={styles.photoThumbImg} resizeMode="cover" />
                  {i === 0 && (
                    <View style={[styles.photoBadge, { backgroundColor: theme.colors.primary }]}>
                      <Text style={{ color: '#000', fontSize: 9, fontWeight: '700' }}>TITEL</Text>
                    </View>
                  )}
                </View>
              ))}
            </ScrollView>
          </>
        )}

        {/* ── Zusammenfassung ── */}
        <ThemedText weight="semibold" style={styles.sectionLabel}>Zusammenfassung</ThemedText>
        <GlowCard>
          <SummaryRow label="Titel" value={title || '—'} />
          <SummaryRow label="Zustand" value={condition || '—'} />
          <SummaryRow label="Angebotsart" value={listingType || '—'} />
          {listingType === 'Auktion' && startPrice ? (
            <SummaryRow label="Startpreis" value={`€ ${startPrice}`} />
          ) : null}
          <SummaryRow
            label={listingType === 'Auktion' ? 'Sofortkauf' : 'Preis'}
            value={price ? `€ ${price}` : '—'}
          />
          <SummaryRow label="Versand" value={shipping || '—'} />
          <SummaryRow label="Laufzeit" value={duration || '—'} isLast />
        </GlowCard>

        {/* ── Gebühren ── */}
        {priceNum > 0 && (
          <>
            <ThemedText weight="semibold" style={styles.sectionLabel}>Gebühren (geschätzt)</ThemedText>
            <GlowCard style={{ gap: 8 }}>
              <View style={styles.feeRow}>
                <ThemedText variant="secondary" size="sm">Verkaufspreis</ThemedText>
                <ThemedText weight="semibold">€ {priceNum.toFixed(2)}</ThemedText>
              </View>
              {shippingNum > 0 && (
                <View style={styles.feeRow}>
                  <ThemedText variant="secondary" size="sm">+ Versand</ThemedText>
                  <ThemedText>€ {shippingNum.toFixed(2)}</ThemedText>
                </View>
              )}
              <View style={[styles.feeRow, { paddingTop: 8, borderTopWidth: 1, borderTopColor: theme.colors.border }]}>
                <ThemedText variant="secondary" size="sm">eBay Gebühr (13,9%)</ThemedText>
                <ThemedText style={{ color: theme.colors.error }}>- € {ebayFee.toFixed(2)}</ThemedText>
              </View>
              <View style={[styles.feeRow, { paddingTop: 4 }]}>
                <ThemedText weight="bold">Nettoerlös</ThemedText>
                <ThemedText weight="bold" size="lg" style={{ color: netEarnings >= 0 ? theme.colors.success : theme.colors.error }}>
                  € {netEarnings.toFixed(2)}
                </ThemedText>
              </View>
            </GlowCard>
          </>
        )}

        {/* ── Account-Hinweise ── */}
        {activeAccountType === 'papa' && (
          <GlowCard glowColor={theme.colors.warning} style={{ marginTop: 16 }}>
            <ThemedText variant="secondary" size="sm" style={{ color: theme.colors.warning }}>
              Du nutzt aktuell Papa eBay (nur Preisabfragen). Zum Verkaufen brauchst du deinen eigenen eBay-Account.
            </ThemedText>
          </GlowCard>
        )}
        {!ownAccount && activeAccountType !== 'papa' && (
          <GlowCard glowColor={theme.colors.warning} style={{ marginTop: 16 }}>
            <ThemedText variant="secondary" size="sm">
              Kein eBay-Account verbunden. Verbinde deinen eigenen Account um Angebote zu erstellen.
            </ThemedText>
          </GlowCard>
        )}

        {/* ── Upload-Status ── */}
        {submitting && (
          <GlowCard style={{ marginTop: 16, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <ActivityIndicator size="small" color={theme.colors.primary} />
            <ThemedText variant="secondary" size="sm" style={{ flex: 1 }}>
              {submitStatus || 'Wird verarbeitet...'}
            </ThemedText>
          </GlowCard>
        )}

        <PrimaryButton
          title={submitting ? 'Wird hochgeladen...' : 'Jetzt bei eBay einstellen'}
          size="lg"
          onPress={handleSubmit}
          disabled={submitting}
          loading={submitting}
          style={styles.submitButton}
          accessibilityLabel="Angebot bei eBay einstellen"
        />

        <PrimaryButton
          title="Abbrechen"
          variant="outline"
          size="lg"
          onPress={handleCancel}
          disabled={submitting}
          style={styles.cancelButton}
          accessibilityLabel="Verkauf abbrechen"
        />
      </ScrollView>
    </ThemedView>
  );
}

function SummaryRow({ label, value, isLast = false }: { label: string; value: string; isLast?: boolean }) {
  const { theme } = useTheme();
  return (
    <View style={[styles.summaryRow, !isLast && { borderBottomWidth: 1, borderBottomColor: theme.colors.border }]}>
      <ThemedText variant="secondary" size="sm">{label}</ThemedText>
      <ThemedText weight="semibold" size="sm" style={{ flex: 1, textAlign: 'right' }}>{value}</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1,
  },
  content: { paddingHorizontal: 20, paddingBottom: 40, gap: 8 },
  sectionLabel: { marginTop: 20, marginBottom: 12 },
  summaryRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 10, gap: 12,
  },
  feeRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  // Photos
  photoThumb: { width: 80, height: 80, borderRadius: 8, overflow: 'hidden', position: 'relative' },
  photoThumbImg: { width: '100%', height: '100%' },
  photoBadge: {
    position: 'absolute', bottom: 4, left: 4,
    paddingHorizontal: 5, paddingVertical: 2, borderRadius: 4,
  },
  // Submit
  submitButton: { marginTop: 28 },
  cancelButton: { marginTop: 12 },
  // Success
  linkBtn: {
    width: '100%', paddingVertical: 16, borderRadius: 12,
    borderWidth: 1, alignItems: 'center',
  },
});
