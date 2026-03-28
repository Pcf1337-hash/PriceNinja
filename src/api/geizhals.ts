import { getCache, setCache } from '@/src/utils/cache';
import { GEIZHALS_BASE_URL, PRICE_CACHE_MIN_AGE } from '@/src/utils/constants';

export interface GeizhalsResult {
  productName: string;
  cheapestPrice: number;
  currency: string;
  url: string;
  priceRange: { min: number; max: number };
  shopCount: number;
}

const GEIZHALS_CACHE_PREFIX = 'geizhals_';
const GEIZHALS_CACHE_TTL = PRICE_CACHE_MIN_AGE;

function buildGeizhalsSearchUrl(query: string): string {
  const encoded = encodeURIComponent(query);
  // No sort=p — use relevance sort so the matching product appears first, not cheap accessories
  return `${GEIZHALS_BASE_URL}/?fs=${encoded}&in=&bl=1&v=e`;
}

function parseGeizhalsHTML(html: string, query: string): GeizhalsResult | null {
  // 1. Try JSON-LD structured data first (most reliable)
  const jsonLdMatches = html.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi);
  for (const ldMatch of jsonLdMatches) {
    try {
      const data = JSON.parse(ldMatch[1]);
      const items = Array.isArray(data) ? data : [data];
      for (const item of items) {
        const offers = item?.offers ?? item?.['@graph']?.[0]?.offers;
        if (offers) {
          const low = parseFloat(offers.lowPrice ?? offers.price ?? '0');
          if (low > 1) {
            const url = item.url ?? `${GEIZHALS_BASE_URL}/?fs=${encodeURIComponent(query)}`;
            return {
              productName: item.name ?? query,
              cheapestPrice: low,
              currency: offers.priceCurrency ?? 'EUR',
              url,
              priceRange: { min: low, max: parseFloat(offers.highPrice ?? String(low)) },
              shopCount: offers.offerCount ?? 1,
            };
          }
        }
      }
    } catch {
      // ignore malformed JSON-LD
    }
  }

  // 2. Try itemprop="price" (schema.org markup) — take the FIRST match (most relevant product)
  const itempropMatch = html.match(/content="([\d.]+)"[^>]*itemprop="price"|itemprop="price"[^>]*content="([\d.]+)"/i);
  if (itempropMatch) {
    const p = parseFloat(itempropMatch[1] ?? itempropMatch[2]);
    if (p >= 1) {
      return {
        productName: query,
        cheapestPrice: p,
        currency: 'EUR',
        url: `${GEIZHALS_BASE_URL}/?fs=${encodeURIComponent(query)}`,
        priceRange: { min: p, max: p },
        shopCount: 1,
      };
    }
  }

  // 3. Look for "ab € X,XX" patterns (Geizhals "from price" indicator for first result)
  const abPricePattern = /ab\s*€?\s*(\d{1,4}[.,]\d{2})|(\d{1,4}[.,]\d{2})\s*€.*?(?:ab|günstig)/gi;
  let abMatch;
  const abPrices: number[] = [];
  while ((abMatch = abPricePattern.exec(html)) !== null) {
    const raw = (abMatch[1] ?? abMatch[2]).replace(',', '.');
    const p = parseFloat(raw);
    if (p >= 5) abPrices.push(p);
  }
  if (abPrices.length > 0) {
    // Take median to avoid outliers, not minimum
    abPrices.sort((a, b) => a - b);
    const mid = abPrices[Math.floor(abPrices.length / 4)]; // first quartile → realistic cheapest
    const url = `${GEIZHALS_BASE_URL}/?fs=${encodeURIComponent(query)}`;
    return {
      productName: query,
      cheapestPrice: mid,
      currency: 'EUR',
      url,
      priceRange: { min: abPrices[0], max: abPrices[abPrices.length - 1] },
      shopCount: abPrices.length,
    };
  }

  // 3. Fallback: collect all prices >= 10€ from the page, take first quartile
  const pricePattern = /€\s*(\d{1,5}[.,]\d{2})|(\d{1,5}[.,]\d{2})\s*€/g;
  const prices: number[] = [];
  let match;
  while ((match = pricePattern.exec(html)) !== null) {
    const raw = (match[1] ?? match[2]).replace(',', '.');
    const p = parseFloat(raw);
    if (p >= 10 && p < 100000) prices.push(p);
  }

  if (prices.length === 0) return null;

  prices.sort((a, b) => a - b);
  // Use first quartile price — avoids picking up cheap games/accessories at the very bottom
  const cheapest = prices[Math.floor(prices.length * 0.25)] ?? prices[0];

  const urlMatch = html.match(/href="(\/[^"]+)"[^>]*class="[^"]*product[^"]*"/);
  const productUrl = urlMatch
    ? `${GEIZHALS_BASE_URL}${urlMatch[1]}`
    : `${GEIZHALS_BASE_URL}/?fs=${encodeURIComponent(query)}`;

  return {
    productName: query,
    cheapestPrice: cheapest,
    currency: 'EUR',
    url: productUrl,
    priceRange: { min: prices[0], max: prices[prices.length - 1] },
    shopCount: prices.length,
  };
}

export async function fetchGeizhalsPrice(
  query: string
): Promise<GeizhalsResult | null> {
  const cacheKey = GEIZHALS_CACHE_PREFIX + query.toLowerCase().replace(/\s+/g, '_');

  const cached = await getCache<GeizhalsResult>(cacheKey);
  if (cached) return cached;

  try {
    const url = buildGeizhalsSearchUrl(query);
    const response = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Android 14; Mobile; rv:109.0) Gecko/109.0 Firefox/109.0',
        Accept: 'text/html,application/xhtml+xml',
        'Accept-Language': 'de-DE,de;q=0.9',
      },
    });

    if (!response.ok) return null;

    const html = await response.text();
    const result = parseGeizhalsHTML(html, query);

    if (result) {
      await setCache(cacheKey, result, GEIZHALS_CACHE_TTL);
    }

    return result;
  } catch {
    return null;
  }
}
