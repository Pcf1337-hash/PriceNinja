import { EbaySoldListing } from '@/src/types/item';

export function calculatePriceStats(soldListings: EbaySoldListing[]): {
  avg: number;
  min: number;
  max: number;
  count: number;
} {
  if (soldListings.length === 0) {
    return { avg: 0, min: 0, max: 0, count: 0 };
  }

  const prices = soldListings.map((l) => l.price);
  const sum = prices.reduce((a, b) => a + b, 0);

  return {
    avg: Math.round((sum / prices.length) * 100) / 100,
    min: Math.min(...prices),
    max: Math.max(...prices),
    count: prices.length,
  };
}

export function suggestedSellingPrice(
  ebaySoldAvg: number,
  geizhalsCheapest?: number
): number {
  if (geizhalsCheapest && geizhalsCheapest < ebaySoldAvg) {
    // If you can buy it cheaper new, price slightly above geizhals
    return Math.round(geizhalsCheapest * 1.1 * 100) / 100;
  }
  // Price 10% below eBay avg for quick sale
  return Math.round(ebaySoldAvg * 0.9 * 100) / 100;
}

export function formatPrice(price: number, currency = 'EUR'): string {
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency,
  }).format(price);
}

export function priceTrend(
  currentPrice: number,
  previousPrice: number
): 'up' | 'down' | 'stable' {
  const diff = ((currentPrice - previousPrice) / previousPrice) * 100;
  if (diff > 2) return 'up';
  if (diff < -2) return 'down';
  return 'stable';
}

// Exchange rates relative to EUR (base = 1)
export const EXCHANGE_RATES: Record<string, number> = {
  EUR: 1,
  USD: 1.087,
  GBP: 0.857,
  CHF: 0.955,
  JPY: 163.5,
};

export function convertPrice(amountEur: number, targetCurrency: string): number {
  return amountEur * (EXCHANGE_RATES[targetCurrency] ?? 1);
}

export function formatPriceCurrency(amountEur: number, currency: string): string {
  const converted = convertPrice(amountEur, currency);
  const symbols: Record<string, string> = { EUR: '€', USD: '$', GBP: '£', CHF: 'CHF ', JPY: '¥' };
  const symbol = symbols[currency] ?? currency + ' ';
  if (currency === 'JPY') return symbol + Math.round(converted).toLocaleString('de-DE');
  return symbol + converted.toFixed(2).replace('.', ',');
}
