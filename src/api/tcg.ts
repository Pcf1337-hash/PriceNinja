/**
 * Trading card price fetching.
 *
 * Priority per game:
 *   Pokémon  → Pokémon TCG API (free, returns Cardmarket + TCGPlayer prices)
 *   MTG      → Scryfall (free, returns EUR + USD prices)
 *   Yu-Gi-Oh → YGOPRODeck (free, returns Cardmarket + TCGPlayer prices)
 *   Fallback → Cardmarket HTML scraping (last resort)
 */

import { getCache, setCache } from '@/src/utils/cache';
import { CardPrices, TradingCard } from '@/src/types/card';

const PRICE_CACHE_TTL = 60 * 60 * 1000; // 1 hour

// ── Pokémon TCG API ───────────────────────────────────────────────────────────

async function fetchPokemonPrices(
  name: string,
  setCode?: string,
  cardNumber?: string,
): Promise<CardPrices | null> {
  try {
    let q = `name:"${name}"`;
    if (setCode) q += ` set.id:${setCode}`;
    if (cardNumber) q += ` number:${cardNumber.split('/')[0]}`;

    const res = await fetch(
      `https://api.pokemontcg.io/v2/cards?q=${encodeURIComponent(q)}&pageSize=1`,
      { headers: { Accept: 'application/json' } },
    );
    if (!res.ok) return null;

    const json = (await res.json()) as {
      data?: Array<{
        cardmarket?: {
          prices?: {
            lowPrice?: number;
            averageSellPrice?: number;
            trendPrice?: number;
          };
        };
        tcgplayer?: {
          prices?: Record<
            string,
            { low?: number; market?: number } | undefined
          >;
        };
      }>;
    };

    const card = json.data?.[0];
    if (!card) return null;

    const cm = card.cardmarket?.prices;
    const tcgPrices = card.tcgplayer?.prices ?? {};
    const variant =
      tcgPrices['normal'] ??
      tcgPrices['holofoil'] ??
      tcgPrices['reverseHolofoil'] ??
      null;

    return {
      cardmarketLow: cm?.lowPrice ?? undefined,
      cardmarketMid: cm?.averageSellPrice ?? undefined,
      cardmarketTrend: cm?.trendPrice ?? undefined,
      tcgplayerLow: variant?.low ?? undefined,
      tcgplayerMid: variant?.market ?? undefined,
      currency: 'EUR',
      updatedAt: new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

// ── Scryfall (MTG) ────────────────────────────────────────────────────────────

async function fetchMagicPrices(name: string, setCode?: string): Promise<CardPrices | null> {
  try {
    const params = new URLSearchParams({ fuzzy: name });
    if (setCode) params.set('set', setCode.toLowerCase());
    const res = await fetch(
      `https://api.scryfall.com/cards/named?${params.toString()}`,
    );
    if (!res.ok) return null;

    const card = (await res.json()) as {
      object: string;
      prices?: { eur?: string; eur_foil?: string; usd?: string; usd_foil?: string };
    };
    if (card.object === 'error') return null;

    const eur = parseFloat(card.prices?.eur ?? '') || undefined;
    const usd = parseFloat(card.prices?.usd ?? '') || undefined;

    return {
      cardmarketLow: eur,
      cardmarketMid: eur,
      tcgplayerLow: usd,
      tcgplayerMid: usd,
      currency: 'EUR',
      updatedAt: new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

// ── YGOPRODeck (Yu-Gi-Oh) ────────────────────────────────────────────────────

async function fetchYugiohPrices(name: string): Promise<CardPrices | null> {
  try {
    const res = await fetch(
      `https://db.ygoprodeck.com/api/v7/cardinfo.php?name=${encodeURIComponent(name)}`,
    );
    if (!res.ok) return null;

    const json = (await res.json()) as {
      data?: Array<{
        card_prices?: Array<{
          cardmarket_price?: string;
          tcgplayer_price?: string;
        }>;
      }>;
    };
    const card = json.data?.[0];
    if (!card) return null;

    const p = card.card_prices?.[0];
    const cm = parseFloat(p?.cardmarket_price ?? '') || undefined;
    const tcp = parseFloat(p?.tcgplayer_price ?? '') || undefined;

    return {
      cardmarketLow: cm,
      cardmarketMid: cm,
      tcgplayerLow: tcp,
      tcgplayerMid: tcp,
      currency: 'EUR',
      updatedAt: new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

// ── Cardmarket scraping (fallback) ───────────────────────────────────────────

function buildCardmarketUrl(
  game: TradingCard['game'],
  name: string,
  setCode?: string,
): string {
  const gameMap: Record<TradingCard['game'], string> = {
    pokemon: 'Pokemon',
    yugioh: 'YuGiOh',
    magic: 'Magic',
    other: 'Pokemon',
  };
  const slug = gameMap[game];
  const q = encodeURIComponent(name);
  if (setCode) {
    return `https://www.cardmarket.com/de/${slug}/Products/Search?searchString=${q}&expansionName=${encodeURIComponent(setCode)}`;
  }
  return `https://www.cardmarket.com/de/${slug}/Products/Search?searchString=${q}`;
}

function parseCardmarketPrices(html: string): Pick<CardPrices, 'cardmarketLow' | 'cardmarketMid' | 'cardmarketTrend'> | null {
  const pattern = /(\d+[.,]\d+)\s*€/g;
  const prices: number[] = [];
  let m: RegExpExecArray | null;
  while ((m = pattern.exec(html)) !== null) {
    const p = parseFloat(m[1].replace(',', '.'));
    if (p > 0 && p < 10_000) prices.push(p);
  }
  if (prices.length === 0) return null;
  prices.sort((a, b) => a - b);
  return {
    cardmarketLow: prices[0],
    cardmarketMid: prices[Math.floor(prices.length / 2)],
    cardmarketTrend: prices[Math.floor(prices.length * 0.3)],
  };
}

async function fetchCardmarketPrices(
  card: Pick<TradingCard, 'game' | 'name' | 'setCode'>,
): Promise<CardPrices | null> {
  try {
    const url = buildCardmarketUrl(card.game, card.name, card.setCode);
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Android 14; Mobile; rv:109.0) Gecko/109.0 Firefox/109.0',
        Accept: 'text/html',
        'Accept-Language': 'de-DE,de;q=0.9',
      },
    });
    if (!res.ok) return null;
    const html = await res.text();
    const parsed = parseCardmarketPrices(html);
    if (!parsed) return null;
    return { ...parsed, currency: 'EUR', updatedAt: new Date().toISOString() };
  } catch {
    return null;
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function fetchCardPrice(
  card: Pick<TradingCard, 'game' | 'name' | 'setCode' | 'cardNumber'>,
): Promise<CardPrices | null> {
  const cacheKey = `prices_${card.game}_${card.name}_${card.setCode ?? ''}_${card.cardNumber ?? ''}`
    .toLowerCase()
    .replace(/\s+/g, '_');

  const cached = await getCache<CardPrices>(cacheKey);
  if (cached) return cached;

  let prices: CardPrices | null = null;

  if (card.game === 'pokemon') {
    prices = await fetchPokemonPrices(card.name, card.setCode, card.cardNumber);
  } else if (card.game === 'magic') {
    prices = await fetchMagicPrices(card.name, card.setCode);
  } else if (card.game === 'yugioh') {
    prices = await fetchYugiohPrices(card.name);
  }

  // Last resort: Cardmarket scraping
  if (!prices) {
    prices = await fetchCardmarketPrices(card);
  }

  if (prices) {
    await setCache(cacheKey, prices, PRICE_CACHE_TTL);
  }
  return prices;
}
