import { getCache, setCache } from '@/src/utils/cache';

const CACHE_TTL = 60 * 60 * 1000; // 1h

export interface BricklinkResult {
  name: string;
  minPrice: number;
  avgPrice: number;
  newAvgPrice?: number;  // Neupreis-Durchschnitt (falls verfügbar)
  itemId: string;
  type: string; // 'S' = set, 'P' = part, 'M' = minifig
  url: string;
}

const BROWSER_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'application/json, text/javascript, */*; q=0.01',
  'Accept-Language': 'de-DE,de;q=0.9,en;q=0.8',
  'Referer': 'https://www.bricklink.com/v2/search.page',
  'X-Requested-With': 'XMLHttpRequest',
  'Origin': 'https://www.bricklink.com',
};

type Condition = 'U' | 'N' | '';

/**
 * Versucht Preise via internes Bricklink AJAX zu holen.
 * Felder nach Forschungsbericht-Prio: nCurAvgPrice > nAvgPrice > nNewAvgPrice
 */
async function fetchViaAjax(searchTerm: string, cond: Condition): Promise<BricklinkResult | null> {
  try {
    const url = `https://www.bricklink.com/ajax/clone/search/searchproduct.ajax?q=${encodeURIComponent(searchTerm)}&st=0&cond=${cond}&type=&cat=&yf=0&yt=0&loc=&reg=0&ca=0&ss=0&pmt=&nmp=0&color=-1&min=0&max=0&minqty=0&nosale=0&showempty=1&rpp=5&pi=1&ci=0`;

    const res = await fetch(url, { headers: BROWSER_HEADERS });
    if (!res.ok) return null;

    const text = await res.text();
    const trimmed = text.trim();
    if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) return null;

    const data = JSON.parse(trimmed) as {
      result?: {
        typeList?: Array<{
          items?: Array<{
            strItemNo?: string;
            strItemName?: string;
            strItemType?: string;
            mSalesData?: Record<string, number>;
          }>;
        }>;
      };
    };

    const items = data.result?.typeList?.flatMap(t => t.items ?? []) ?? [];
    if (items.length === 0) return null;

    const item = items[0];
    const itemNo = item.strItemNo ?? '';
    if (!itemNo) return null;

    const itemType = item.strItemType ?? 'S';
    const sd = item.mSalesData ?? {};

    // Prio aus Forschungsbericht: nCurAvgPrice (aktuell) > nAvgPrice (historisch) > neu/gebraucht variants
    const avgPrice =
      sd.nCurAvgPrice ?? sd.nAvgPrice ??
      sd.nUsedAvgPrice ?? sd.nNewAvgPrice ?? 0;
    const minPrice =
      sd.nCurPrice ?? sd.nCurMinPrice ??
      sd.nMinPrice ?? sd.nUsedMinPrice ?? sd.nNewMinPrice ?? 0;
    const newAvgPrice = sd.nNewAvgPrice ?? undefined;

    return {
      name: item.strItemName ?? searchTerm,
      avgPrice,
      minPrice,
      newAvgPrice: newAvgPrice !== undefined && newAvgPrice > 0 ? newAvgPrice : undefined,
      itemId: itemNo,
      type: itemType,
      url: `https://www.bricklink.com/v2/catalog/catalogitem.page?${itemType}=${itemNo}`,
    };
  } catch {
    return null;
  }
}

/**
 * HTML-Fallback: Bricklink Katalog-Suche (catalogsearch.asp).
 * Liefert keine Preise, aber Item-Name und URL — damit der Block zumindest erscheint.
 */
async function fetchViaCatalogSearch(query: string): Promise<BricklinkResult | null> {
  try {
    const url = `https://www.bricklink.com/catalogsearch.asp?q=${encodeURIComponent(query)}&colorID=0&searchType=S`;
    const res = await fetch(url, {
      headers: {
        'User-Agent': BROWSER_HEADERS['User-Agent'],
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'de-DE,de;q=0.9',
        'Referer': 'https://www.bricklink.com/',
      },
    });
    if (!res.ok) return null;

    const html = await res.text();

    // Ersten Set-Treffer aus HTML extrahieren
    // Bricklink listet Treffer als: <a href="/v2/catalog/catalogitem.page?S=75257-1">...</a>
    const setMatch = html.match(/catalogitem\.page\?S=([A-Za-z0-9-]+)/i);
    if (!setMatch) return null;

    const itemId = setMatch[1];

    // Itemname aus Link-Text extrahieren
    const nameMatch = html.match(new RegExp(`catalogitem\\.page\\?S=${itemId.replace(/-/g, '[-]')}"[^>]*>([^<]{3,80})<`, 'i'));
    const name = nameMatch ? nameMatch[1].trim() : query;

    return {
      name,
      avgPrice: 0,
      minPrice: 0,
      itemId,
      type: 'S',
      url: `https://www.bricklink.com/v2/catalog/catalogitem.page?S=${itemId}`,
    };
  } catch {
    return null;
  }
}

export async function fetchBricklinkPrice(query: string): Promise<BricklinkResult | null> {
  const cacheKey = `bricklink_${query.toLowerCase().replace(/\s+/g, '_')}`;
  const cached = await getCache<BricklinkResult>(cacheKey);
  if (cached) return cached;

  // Set-Nummern extrahieren — Forschungsbericht-Regex: \b(\d{1,5}(?:-\d+)?)\b
  // Filtert auf 3–5 Stellen (realistisch für LEGO-Setnummern)
  const setNumbers = (query.match(/\b(\d{3,5}(?:-\d+)?)\b/g) ?? [])
    .filter(n => n.length <= 7); // max "75257-1" Format

  // Suchreihenfolge: set-Nummer(n) zuerst (spezifisch), dann Volltext
  const searchTerms: string[] = [...new Set([
    ...setNumbers,
    ...(setNumbers.length > 0 ? [query] : [query]),
  ])];

  // Phase 1: AJAX — erst mit Gebraucht (U), dann Neu (N), dann ohne Filter
  for (const term of searchTerms) {
    for (const cond of ['U', 'N', ''] as Condition[]) {
      const result = await fetchViaAjax(term, cond);
      if (result && (result.avgPrice > 0 || result.minPrice > 0)) {
        await setCache(cacheKey, result, CACHE_TTL);
        return result;
      }
    }
  }

  // Phase 2: AJAX hat etwas gefunden (aber 0 Preis) — kurz cachen und zurückgeben
  for (const term of searchTerms) {
    const result = await fetchViaAjax(term, '');
    if (result) {
      await setCache(cacheKey, result, CACHE_TTL);
      return result;
    }
  }

  // Phase 3: Katalog-HTML-Fallback — findet zumindest den Item-Link
  const catalogResult = await fetchViaCatalogSearch(query);
  if (catalogResult) {
    await setCache(cacheKey, catalogResult, CACHE_TTL);
    return catalogResult;
  }

  return null;
}
