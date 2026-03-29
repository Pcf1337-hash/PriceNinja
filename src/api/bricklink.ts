import { getCache, setCache } from '@/src/utils/cache';

const CACHE_TTL = 60 * 60 * 1000; // 1h

export interface BricklinkResult {
  name: string;
  minPrice: number;
  avgPrice: number;
  itemId: string;
  type: string; // 'S' = set, 'P' = part, 'M' = minifig
  url: string;
}

export async function fetchBricklinkPrice(query: string): Promise<BricklinkResult | null> {
  const cacheKey = `bricklink_${query.toLowerCase().replace(/\s+/g, '_')}`;
  const cached = await getCache<BricklinkResult>(cacheKey);
  if (cached) return cached;

  // Extract LEGO set number if present (4-5 digit number) for more precise search
  const setNumberMatch = query.match(/\b(\d{4,5})\b/);
  const searchTerms: string[] = setNumberMatch
    ? [setNumberMatch[1], query]
    : [query];

  for (const searchTerm of searchTerms) {
    try {
      const searchUrl = `https://www.bricklink.com/ajax/clone/search/searchproduct.ajax?q=${encodeURIComponent(searchTerm)}&st=0&cond=&type=&cat=&yf=0&yt=0&loc=&reg=0&ca=0&ss=0&pmt=&nmp=0&color=-1&min=0&max=0&minqty=0&nosale=0&showempty=1&rpp=5&pi=1&ci=0`;
      const res = await fetch(searchUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'application/json, text/javascript, */*; q=0.01',
          'Accept-Language': 'de-DE,de;q=0.9,en;q=0.8',
          'Referer': 'https://www.bricklink.com/v2/search.page',
          'X-Requested-With': 'XMLHttpRequest',
          'Origin': 'https://www.bricklink.com',
        },
      });

      if (!res.ok) continue;

      const text = await res.text();
      // Guard: ensure response is JSON, not an HTML error/redirect page
      const trimmed = text.trim();
      if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) continue;

      const data = JSON.parse(trimmed) as {
        result?: {
          typeList?: Array<{
            items?: Array<{
              strItemNo?: string;
              strItemName?: string;
              strItemType?: string;
              mSalesData?: {
                nAvgPrice?: number;
                nMinPrice?: number;
                nMaxPrice?: number;
                nCurAvgPrice?: number;
                nCurMinPrice?: number;
                nNewAvgPrice?: number;
                nNewMinPrice?: number;
              };
            }>;
          }>;
        };
      };

      const items = data.result?.typeList?.flatMap(t => t.items ?? []) ?? [];
      if (items.length === 0) continue;

      const item = items[0];
      const itemNo = item.strItemNo ?? '';
      const itemType = item.strItemType ?? 'S';

      if (!itemNo) continue;

      // Check multiple price fields (API response varies)
      const sd = item.mSalesData;
      const avgPrice = sd?.nCurAvgPrice ?? sd?.nAvgPrice ?? sd?.nNewAvgPrice ?? 0;
      const minPrice = sd?.nCurMinPrice ?? sd?.nMinPrice ?? sd?.nNewMinPrice ?? 0;

      const result: BricklinkResult = {
        name: item.strItemName ?? query,
        minPrice,
        avgPrice,
        itemId: itemNo,
        type: itemType,
        url: `https://www.bricklink.com/v2/catalog/catalogitem.page?${itemType}=${itemNo}`,
      };

      await setCache(cacheKey, result, CACHE_TTL);
      return result;
    } catch {
      continue;
    }
  }

  return null;
}
