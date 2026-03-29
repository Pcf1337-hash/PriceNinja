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

  try {
    // Bricklink catalog search (no auth needed)
    const searchUrl = `https://www.bricklink.com/ajax/clone/search/searchproduct.ajax?q=${encodeURIComponent(query)}&st=0&cond=&type=&cat=&yf=0&yt=0&loc=&reg=0&ca=0&ss=0&pmt=&nmp=0&color=-1&min=0&max=0&minqty=0&nosale=0&showempty=1&rpp=5&pi=1&ci=0`;
    const res = await fetch(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Android 14; Mobile; rv:109.0) Gecko/109.0 Firefox/109.0',
        Accept: 'application/json, text/javascript, */*',
        Referer: 'https://www.bricklink.com/',
      },
    });

    if (!res.ok) return null;
    const data = await res.json() as {
      result?: {
        typeList?: Array<{
          items?: Array<{
            strItemNo?: string;
            strItemName?: string;
            strItemType?: string;
            mSalesData?: {
              nAvgPrice?: number;
              nMinPrice?: number;
            };
          }>;
        }>;
      };
    };

    const items = data.result?.typeList?.flatMap(t => t.items ?? []) ?? [];
    if (items.length === 0) return null;

    const item = items[0];
    const itemNo = item.strItemNo ?? '';
    const itemType = item.strItemType ?? 'S';
    const minPrice = item.mSalesData?.nMinPrice ?? 0;
    const avgPrice = item.mSalesData?.nAvgPrice ?? 0;

    if (!itemNo) return null;

    const result: BricklinkResult = {
      name: item.strItemName ?? query,
      minPrice,
      avgPrice,
      itemId: itemNo,
      type: itemType,
      url: `https://www.bricklink.com/v2/catalog/catalogitem.page?${itemType}=${itemNo}`,
    };

    if (avgPrice > 0 || minPrice > 0) {
      await setCache(cacheKey, result, CACHE_TTL);
    }
    return (avgPrice > 0 || minPrice > 0) ? result : null;
  } catch {
    return null;
  }
}
