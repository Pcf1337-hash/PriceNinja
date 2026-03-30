import { getCache, setCache } from '@/src/utils/cache';

const CACHE_TTL = 60 * 60 * 1000; // 1h

export interface BricklinkResult {
  name: string;
  minPrice: number;
  avgPrice: number;
  newAvgPrice?: number;
  itemId: string;
  type: string;
  url: string;
}

export interface BricklinkListing {
  sellerName: string;
  price: number;
  currency: string;
  condition: string;
  qty: number;
  location: string;
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
// Parst BrickLink Preisstrings wie "EUR 4.00" oder "USD 5.50" → Zahl
function parseBlPrice(s: string | undefined | null): number {
  if (!s) return 0;
  const match = s.match(/[\d]+(?:[.,]\d+)?/);
  if (!match) return 0;
  return parseFloat(match[0].replace(',', '.'));
}

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
          type?: string;
          items?: Array<{
            idItem?: number;
            strItemNo?: string;
            strItemName?: string;
            typeItem?: string;
            n4UsedQty?: number;
            n4NewQty?: number;
            mUsedMinPrice?: string;
            mUsedMaxPrice?: string;
            mNewMinPrice?: string;
            mNewMaxPrice?: string;
          }>;
        }>;
      };
    };

    const typeList = data.result?.typeList ?? [];
    if (typeList.length === 0) return null;

    // Set-Typ bevorzugen ("S"), sonst erstes verfügbares
    const setGroup = typeList.find(t => t.type === 'S');
    const group = setGroup ?? typeList[0];
    const items = group?.items ?? [];
    if (items.length === 0) return null;

    const item = items[0];
    const itemNo = item.strItemNo ?? '';
    const itemId = item.idItem;
    if (!itemNo) return null;

    const itemType = (item.typeItem ?? group?.type ?? 'S') as string;

    // Preise aus String-Feldern parsen (API liefert "EUR 4.00" statt Zahlen)
    const usedMin = parseBlPrice(item.mUsedMinPrice);
    const usedMax = parseBlPrice(item.mUsedMaxPrice);
    const newMin = parseBlPrice(item.mNewMinPrice);
    const newMax = parseBlPrice(item.mNewMaxPrice);

    const hasUsed = (item.n4UsedQty ?? 0) > 0;
    const hasNew = (item.n4NewQty ?? 0) > 0;

    const minPrice = hasUsed && usedMin > 0 ? usedMin : (hasNew ? newMin : 0);
    const avgPrice = hasUsed && usedMin > 0 && usedMax > 0
      ? Math.round(((usedMin + usedMax) / 2) * 100) / 100
      : (hasNew && newMin > 0 && newMax > 0 ? Math.round(((newMin + newMax) / 2) * 100) / 100 : 0);
    const newAvgPrice = hasNew && newMin > 0 && newMax > 0
      ? Math.round(((newMin + newMax) / 2) * 100) / 100
      : undefined;

    // URL: interne ID ist zuverlässiger als Set-Nummer
    const itemUrl = itemId
      ? `https://www.bricklink.com/v2/catalog/catalogitem.page?id=${itemId}`
      : `https://www.bricklink.com/v2/catalog/catalogitem.page?${itemType}=${itemNo}`;

    return {
      name: item.strItemName ?? searchTerm,
      avgPrice,
      minPrice,
      newAvgPrice,
      itemId: itemNo,
      type: itemType,
      url: itemUrl,
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
  const cacheKey = `bricklink3_${query.toLowerCase().replace(/\s+/g, '_')}`;
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

// Holt Marktangebote von BrickLink via searchproduct.ajax (st=1 = Stores)
// Gibt Gebraucht/Neu als je eine Zeile zurück (Preisrange + Anzahl Anbieter)
export async function fetchBricklinkListings(
  itemNo: string,
  itemType: string = 'S',
  _itemId?: string,
): Promise<BricklinkListing[]> {
  const cacheKey = `bllist4_${itemType}_${itemNo}`;
  const cached = await getCache<BricklinkListing[]>(cacheKey);
  if (cached) return cached;

  try {
    // st=1 = Store-Suche (aktive Angebote), liefert Qty + Preisrange pro Zustand
    const url = `https://www.bricklink.com/ajax/clone/search/searchproduct.ajax?q=${encodeURIComponent(itemNo)}&st=1&cond=&type=${itemType}&cat=&yf=0&yt=0&loc=&reg=0&ca=0&ss=0&pmt=&nmp=0&color=-1&min=0&max=0&minqty=0&nosale=0&showempty=1&rpp=5&pi=1&ci=0`;
    const res = await fetch(url, { headers: BROWSER_HEADERS });
    if (!res.ok) return [];
    const text = await res.text();
    if (!text.trim().startsWith('{') && !text.trim().startsWith('[')) return [];

    const data = JSON.parse(text) as {
      result?: {
        typeList?: Array<{
          type?: string;
          items?: Array<{
            strItemNo?: string;
            n4UsedQty?: number;
            n4UsedSellerCnt?: number;
            mUsedMinPrice?: string;
            mUsedMaxPrice?: string;
            n4NewQty?: number;
            n4NewSellerCnt?: number;
            mNewMinPrice?: string;
            mNewMaxPrice?: string;
          }>;
        }>;
      };
    };

    const typeList = data.result?.typeList ?? [];
    const group = typeList.find(t => t.type === itemType) ?? typeList[0];
    const item = group?.items?.[0];
    if (!item) return [];

    const listings: BricklinkListing[] = [];

    const usedQty = item.n4UsedQty ?? 0;
    const usedMin = parseBlPrice(item.mUsedMinPrice);
    const usedMax = parseBlPrice(item.mUsedMaxPrice);
    if (usedQty > 0 && usedMin > 0) {
      listings.push({
        sellerName: `${item.n4UsedSellerCnt ?? '?'} Anbieter`,
        price: usedMin,
        currency: 'EUR',
        condition: 'Gebraucht',
        qty: usedQty,
        location: usedMax > usedMin ? `bis ${usedMax.toFixed(2).replace('.', ',')} €` : '',
      });
    }

    const newQty = item.n4NewQty ?? 0;
    const newMin = parseBlPrice(item.mNewMinPrice);
    const newMax = parseBlPrice(item.mNewMaxPrice);
    if (newQty > 0 && newMin > 0) {
      listings.push({
        sellerName: `${item.n4NewSellerCnt ?? '?'} Anbieter`,
        price: newMin,
        currency: 'EUR',
        condition: 'Neu',
        qty: newQty,
        location: newMax > newMin ? `bis ${newMax.toFixed(2).replace('.', ',')} €` : '',
      });
    }

    if (listings.length > 0) {
      await setCache(cacheKey, listings, CACHE_TTL);
    }
    return listings;
  } catch {
    return [];
  }
}
