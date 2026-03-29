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
  return `${GEIZHALS_BASE_URL}/?fs=${encoded}&in=&bl=1&v=e`;
}

function parseGeizhalsHTML(html: string, query: string): GeizhalsResult | null {
  // 1. JSON-LD — only @type "Product" with offers (skip WebSite, Organization, etc.)
  const jsonLdMatches = html.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi);
  for (const ldMatch of jsonLdMatches) {
    try {
      const raw = JSON.parse(ldMatch[1]) as Record<string, unknown>;
      // Support both flat objects and @graph arrays
      const nodes: Record<string, unknown>[] = raw['@graph']
        ? (raw['@graph'] as Record<string, unknown>[])
        : Array.isArray(raw)
          ? (raw as Record<string, unknown>[])
          : [raw];

      for (const node of nodes) {
        const type = node['@type'];
        if ((type === 'Product' || type === 'Offer') && node.offers) {
          const offers = node.offers as Record<string, unknown>;
          const low = parseFloat(String(offers.lowPrice ?? offers.price ?? '0'));
          if (low > 1) {
            return {
              productName: String(node.name ?? query),
              cheapestPrice: low,
              currency: String(offers.priceCurrency ?? 'EUR'),
              url: String(node.url ?? `${GEIZHALS_BASE_URL}/?fs=${encodeURIComponent(query)}`),
              priceRange: {
                min: low,
                max: parseFloat(String(offers.highPrice ?? low)),
              },
              shopCount: typeof offers.offerCount === 'number' ? (offers.offerCount as number) : 1,
            };
          }
        }
      }
    } catch {
      // ignore malformed JSON-LD
    }
  }

  // 2. schema.org itemprop="lowPrice" — Geizhals marks the cheapest price this way
  //    First match = first (most relevant) product in results
  const lowPriceMatch = html.match(
    /itemprop="lowPrice"[^>]*content="([\d.]+)"|content="([\d.]+)"[^>]*itemprop="lowPrice"/i
  );
  if (lowPriceMatch) {
    const p = parseFloat(lowPriceMatch[1] ?? lowPriceMatch[2]);
    if (p >= 1) {
      const nameMatch = html.match(/itemprop="name"[^>]*content="([^"]+)"|content="([^"]+)"[^>]*itemprop="name"/i);
      return {
        productName: nameMatch ? (nameMatch[1] ?? nameMatch[2] ?? query) : query,
        cheapestPrice: p,
        currency: 'EUR',
        url: `${GEIZHALS_BASE_URL}/?fs=${encodeURIComponent(query)}`,
        priceRange: { min: p, max: p },
        shopCount: 1,
      };
    }
  }

  // 3. First "ab X,XX €" pattern — Geizhals uses this for the cheapest price per result entry
  //    Take only the FIRST occurrence (first search result = most relevant)
  const abMatch = html.match(/\bab\s+(?:€\s*)?([\d]+[,.][\d]{2})(?:\s*€)?/);
  if (abMatch) {
    const p = parseFloat(abMatch[1].replace(',', '.'));
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

  // No reliable price found — return null rather than guessing
  return null;
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
