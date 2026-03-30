import React, { useState } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  TextInput,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/src/theme';
import { ThemedView, ThemedText, GlowCard, PrimaryButton } from '@/src/components/ui';

type ShippingOption = 'Kostenlos' | '3,99 €' | '5,99 €' | '8,99 €';
type Duration = '7 Tage' | '10 Tage' | '30 Tage';
type ListingType = 'Festpreis' | 'Auktion';

const SHIPPING_OPTIONS: ShippingOption[] = ['Kostenlos', '3,99 €', '5,99 €', '8,99 €'];
const DURATIONS: Duration[] = ['7 Tage', '10 Tage', '30 Tage'];

// eBay DE Privatverkäufer-Gebühren (Stand 2024)
const EBAY_FEE_RATE = 0.139; // 13,9% vom Gesamtbetrag

function calcEbayFee(itemPrice: number, shippingCost: number): number {
  return (itemPrice + shippingCost) * EBAY_FEE_RATE;
}

export default function SellWizardPricing() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{
    itemName: string;
    itemBrand: string;
    itemModel: string;
    suggestedPrice: string;
    condition: string;
    title: string;
    description: string;
    photoUris: string;
  }>();

  const suggestedNum = parseFloat(params.suggestedPrice ?? '0') || 0;

  const [price, setPrice] = useState(
    suggestedNum > 0 ? suggestedNum.toFixed(2) : ''
  );
  const [shipping, setShipping] = useState<ShippingOption>('Kostenlos');
  const [duration, setDuration] = useState<Duration>('7 Tage');
  const [listingType, setListingType] = useState<ListingType>('Festpreis');
  const [startPrice, setStartPrice] = useState(
    suggestedNum > 0 ? (suggestedNum * 0.6).toFixed(2) : ''
  );

  const priceNum = parseFloat(price) || 0;
  const shippingNum = shipping === 'Kostenlos' ? 0
    : parseFloat(shipping.replace(',', '.').replace(' €', '')) || 0;
  const ebayFee = calcEbayFee(priceNum, shippingNum);
  const netEarnings = priceNum - ebayFee;

  const handleNext = () => {
    router.push({
      pathname: '/sell-wizard/review',
      params: {
        ...params,
        price,
        shipping,
        duration,
        listingType,
        startPrice: listingType === 'Auktion' ? startPrice : '',
        photoUris: params.photoUris ?? '[]',
      },
    });
  };

  const isValid = price.trim().length > 0 && parseFloat(price) > 0;

  return (
    <ThemedView style={[styles.container, { paddingTop: insets.top }]}>
      <View style={[styles.header, { borderBottomColor: theme.colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} accessibilityLabel="Zurück">
          <ThemedText variant="secondary">← Zurück</ThemedText>
        </TouchableOpacity>
        <View style={{ alignItems: 'center' }}>
          <ThemedText weight="bold" size="lg">Preis & Versand</ThemedText>
          <ThemedText variant="muted" size="xs">Schritt 2 von 3</ThemedText>
        </View>
        <View style={{ width: 80 }} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        {/* Listing type toggle */}
        <ThemedText weight="semibold" style={styles.label}>
          Angebotsart
        </ThemedText>
        <GlowCard style={styles.toggleCard}>
          <View style={styles.toggleRow}>
            {(['Festpreis', 'Auktion'] as ListingType[]).map((t) => (
              <TouchableOpacity
                key={t}
                onPress={() => setListingType(t)}
                accessibilityLabel={`Angebotsart ${t} wählen`}
                style={[
                  styles.toggleButton,
                  {
                    backgroundColor:
                      listingType === t ? theme.colors.primary : 'transparent',
                    borderRadius: theme.radius.md,
                  },
                ]}
              >
                <ThemedText
                  weight="semibold"
                  style={{
                    color:
                      listingType === t
                        ? theme.colors.background
                        : theme.colors.textSecondary,
                  }}
                >
                  {t}
                </ThemedText>
              </TouchableOpacity>
            ))}
          </View>
        </GlowCard>

        {/* Price field */}
        <ThemedText weight="semibold" style={styles.label}>
          {listingType === 'Festpreis' ? 'Verkaufspreis' : 'Sofortkaufpreis'}
        </ThemedText>
        <GlowCard style={styles.inputCard}>
          <View style={styles.priceRow}>
            <ThemedText weight="semibold" size="lg" style={{ color: theme.colors.primary }}>
              €
            </ThemedText>
            <TextInput
              value={price}
              onChangeText={setPrice}
              placeholder="0,00"
              placeholderTextColor={theme.colors.textMuted}
              keyboardType="decimal-pad"
              style={[styles.priceInput, { color: theme.colors.text }]}
              accessibilityLabel="Verkaufspreis eingeben"
            />
          </View>
          {suggestedNum > 0 && (
            <ThemedText variant="muted" size="xs" style={{ marginTop: 6 }}>
              Vorschlag basierend auf eBay-Verkäufen: €{suggestedNum.toFixed(2)}
            </ThemedText>
          )}
        </GlowCard>

        {/* Auction start price */}
        {listingType === 'Auktion' && (
          <>
            <ThemedText weight="semibold" style={styles.label}>
              Startpreis (Auktion)
            </ThemedText>
            <GlowCard style={styles.inputCard}>
              <View style={styles.priceRow}>
                <ThemedText weight="semibold" size="lg" style={{ color: theme.colors.primary }}>
                  €
                </ThemedText>
                <TextInput
                  value={startPrice}
                  onChangeText={setStartPrice}
                  placeholder="0,00"
                  placeholderTextColor={theme.colors.textMuted}
                  keyboardType="decimal-pad"
                  style={[styles.priceInput, { color: theme.colors.text }]}
                  accessibilityLabel="Auktions-Startpreis eingeben"
                />
              </View>
              <ThemedText variant="muted" size="xs" style={{ marginTop: 6 }}>
                Empfohlen: 60% des Verkaufspreises
              </ThemedText>
            </GlowCard>
          </>
        )}

        {/* Shipping options */}
        <ThemedText weight="semibold" style={styles.label}>
          Versandkosten
        </ThemedText>
        <View style={styles.chipRow}>
          {SHIPPING_OPTIONS.map((s) => (
            <TouchableOpacity
              key={s}
              onPress={() => setShipping(s)}
              accessibilityLabel={`Versand ${s}`}
              style={[
                styles.chip,
                {
                  backgroundColor:
                    shipping === s ? theme.colors.surface : 'transparent',
                  borderColor:
                    shipping === s ? theme.colors.primary : theme.colors.border,
                  borderWidth: shipping === s ? 2 : 1,
                },
              ]}
            >
              <ThemedText
                size="sm"
                weight={shipping === s ? 'semibold' : 'normal'}
                style={{
                  color: shipping === s ? theme.colors.primary : theme.colors.text,
                }}
              >
                {s}
              </ThemedText>
            </TouchableOpacity>
          ))}
        </View>

        {/* Duration */}
        <ThemedText weight="semibold" style={styles.label}>
          Laufzeit
        </ThemedText>
        <View style={styles.chipRow}>
          {DURATIONS.map((d) => (
            <TouchableOpacity
              key={d}
              onPress={() => setDuration(d)}
              accessibilityLabel={`Laufzeit ${d}`}
              style={[
                styles.chip,
                {
                  backgroundColor:
                    duration === d ? theme.colors.surface : 'transparent',
                  borderColor:
                    duration === d ? theme.colors.primary : theme.colors.border,
                  borderWidth: duration === d ? 2 : 1,
                },
              ]}
            >
              <ThemedText
                size="sm"
                weight={duration === d ? 'semibold' : 'normal'}
                style={{
                  color: duration === d ? theme.colors.primary : theme.colors.text,
                }}
              >
                {d}
              </ThemedText>
            </TouchableOpacity>
          ))}
        </View>

        {/* ── Geschätzte Gebühren ── */}
        {priceNum > 0 && (
          <>
            <ThemedText weight="semibold" style={styles.label}>
              Geschätzte Gebühren
            </ThemedText>
            <GlowCard style={[styles.inputCard, { gap: 8 }]}>
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
              <ThemedText variant="muted" size="xs" style={{ marginTop: 4 }}>
                Privatverkauf · Keine Angebotsgebühr (erste 250/Monat gratis)
              </ThemedText>
            </GlowCard>
          </>
        )}

        <PrimaryButton
          title="Weiter: Überprüfen"
          size="lg"
          disabled={!isValid}
          onPress={handleNext}
          style={styles.nextButton}
          accessibilityLabel="Weiter zur Übersicht"
        />
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 40,
    gap: 8,
  },
  label: {
    marginTop: 20,
    marginBottom: 8,
  },
  toggleCard: {
    padding: 6,
  },
  toggleRow: {
    flexDirection: 'row',
    gap: 4,
  },
  toggleButton: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inputCard: {
    padding: 12,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  priceInput: {
    flex: 1,
    fontSize: 22,
    fontWeight: '600',
    paddingVertical: 4,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 24,
  },
  nextButton: {
    marginTop: 28,
  },
  feeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
});
