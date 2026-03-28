import { getCache, setCache } from '@/src/utils/cache';
import { CardPrices, TradingCard } from '@/src/types/card';

const CARDMARKET_CACHE_TTL = 60 * 60 * 1000; // 1 hour

export interface CardmarketPrice {
  low: number;
  mid: number;
  trend: number;
  currency: string;
}

// Cardmarket doesn't have a free API, so we use their public price guide pages
function buildCardmarketSearchUrl(game: TradingCard['game'], name: string, setCode?: string): string {
  const gameMap = {
    pokemon: 'Pokemon',
    yugioh: 'YuGiOh',
    magic: 'Magic',
    other: 'Pokemon', // fallback
  };
  const gameSlug = gameMap[game];
  const encodedName = encodeURIComponent(name);
  if (setCode) {
    return `https://www.cardmarket.com/de/${gameSlug}/Products/Search?searchString=${encodedName}&expansionName=${encodeURIComponent(setCode)}`;
  }
  return `https://www.cardmarket.com/de/${gameSlug}/Products/Search?searchString=${encodedName}`;
}

function parseCardmarketPrice(html: string): CardmarketPrice | null {
  // Parse price from Cardmarket search result HTML
  // Look for patterns like "0,25 €" in the price columns
  const pricePattern = /(\d+[.,]\d+)\s*€/g;
  const prices: number[] = [];
  let match;

  while ((match = pricePattern.exec(html)) !== null) {
    const price = parseFloat(match[1].replace(',', '.'));
    if (price > 0 && price < 10000) {
      prices.push(price);
    }
  }

  if (prices.length === 0) return null;
  prices.sort((a, b) => a - b);

  return {
    low: prices[0],
    mid: prices[Math.floor(prices.length / 2)],
    trend: prices[Math.floor(prices.length * 0.3)],
    currency: 'EUR',
  };
}

export async function fetchCardPrice(
  card: Pick<TradingCard, 'game' | 'name' | 'setCode' | 'cardNumber'>
): Promise<CardPrices | null> {
  const cacheKey = `cardmarket_${card.game}_${card.name}_${card.setCode ?? ''}`.toLowerCase().replace(/\s+/g, '_');

  const cached = await getCache<CardPrices>(cacheKey);
  if (cached) return cached;

  try {
    const url = buildCardmarketSearchUrl(card.game, card.name, card.setCode);
    const response = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Android 14; Mobile; rv:109.0) Gecko/109.0 Firefox/109.0',
        Accept: 'text/html',
        'Accept-Language': 'de-DE,de;q=0.9',
      },
    });

    if (!response.ok) return null;

    const html = await response.text();
    const price = parseCardmarketPrice(html);

    if (!price) return null;

    const prices: CardPrices = {
      cardmarketLow: price.low,
      cardmarketMid: price.mid,
      cardmarketTrend: price.trend,
      currency: 'EUR',
      updatedAt: new Date().toISOString(),
    };

    await setCache(cacheKey, prices, CARDMARKET_CACHE_TTL);
    return prices;
  } catch {
    return null;
  }
}
