import * as SecureStore from 'expo-secure-store';
import {
  EBAY_PROD_BASE_URL,
  EBAY_SANDBOX_BASE_URL,
  EBAY_TOKEN_URL,
  EBAY_SANDBOX_TOKEN_URL,
  EBAY_TOKEN_EXPIRY,
} from '@/src/utils/constants';
import { EbayAccount, EbaySearchResult, EbayListingDraft } from '@/src/types/ebay';
import { EbaySoldListing } from '@/src/types/item';

const SECURE_STORE_KEYS = {
  papa: 'ebay_papa_account',
  own: 'ebay_own_account',
};

// ─── Token Management ─────────────────────────────────────────────────────────

export async function saveEbayAccount(account: EbayAccount): Promise<void> {
  const key = SECURE_STORE_KEYS[account.type];
  await SecureStore.setItemAsync(key, JSON.stringify(account));
}

export async function loadEbayAccount(
  type: 'papa' | 'own'
): Promise<EbayAccount | null> {
  const raw = await SecureStore.getItemAsync(SECURE_STORE_KEYS[type]);
  if (!raw) return null;
  return JSON.parse(raw) as EbayAccount;
}

export async function deleteEbayAccount(type: 'papa' | 'own'): Promise<void> {
  await SecureStore.deleteItemAsync(SECURE_STORE_KEYS[type]);
}

async function getValidToken(account: EbayAccount): Promise<string> {
  const expiresAt = new Date(account.tokenExpiresAt).getTime();
  if (Date.now() < expiresAt - 5 * 60 * 1000) {
    return account.accessToken;
  }
  // Token expired — refresh it
  return refreshToken(account);
}

async function refreshToken(account: EbayAccount): Promise<string> {
  const tokenUrl = account.isSandbox ? EBAY_SANDBOX_TOKEN_URL : EBAY_TOKEN_URL;
  const credentials = btoa(`${account.appId}:${account.certId}`);

  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${credentials}`,
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: account.refreshToken,
      scope: 'https://api.ebay.com/oauth/api_scope',
    }).toString(),
  });

  if (!response.ok) {
    throw new Error(`Token refresh failed: ${response.status}`);
  }

  const data = await response.json();
  const newAccount: EbayAccount = {
    ...account,
    accessToken: data.access_token,
    tokenExpiresAt: new Date(Date.now() + EBAY_TOKEN_EXPIRY).toISOString(),
  };

  await saveEbayAccount(newAccount);
  return newAccount.accessToken;
}

// ─── Browse API (Price Lookup) ────────────────────────────────────────────────

export async function fetchSoldListings(
  account: EbayAccount,
  searchQuery: string,
  limit = 10,
  categoryId?: string
): Promise<EbaySoldListing[]> {
  const token = await getValidToken(account);
  const baseUrl = account.isSandbox ? EBAY_SANDBOX_BASE_URL : EBAY_PROD_BASE_URL;

  const params = new URLSearchParams({
    q: searchQuery,
    limit: String(limit),
    filter: 'buyingOptions:{FIXED_PRICE|AUCTION},conditionIds:{3000|4000|5000|6000}',
  });

  if (categoryId) params.set('category_ids', categoryId);

  const response = await fetch(
    `${baseUrl}/buy/browse/v1/item_summary/search?${params}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'X-EBAY-C-MARKETPLACE-ID': 'EBAY_DE',
        'Accept-Language': 'de-DE',
      },
    }
  );

  if (!response.ok) {
    throw new Error(`eBay Browse API error: ${response.status}`);
  }

  const data = await response.json();
  const items = data.itemSummaries ?? [];

  return items.map((item: Record<string, unknown>) => ({
    title: item.title as string,
    price: parseFloat((item.price as Record<string, string>)?.value ?? '0'),
    currency: (item.price as Record<string, string>)?.currency ?? 'EUR',
    soldDate: (item.itemEndDate as string) ?? new Date().toISOString(),
    condition: (item.condition as string) ?? 'Unknown',
    url: (item.itemWebUrl as string) ?? '',
    imageUrl: ((item.image as Record<string, string>)?.imageUrl) ?? undefined,
  }));
}

// ─── Exchange Auth Token ───────────────────────────────────────────────────────

export async function exchangeAuthCode(
  appId: string,
  certId: string,
  ruName: string,
  authCode: string,
  isSandbox: boolean
): Promise<{ accessToken: string; refreshToken: string; expiresAt: string }> {
  const tokenUrl = isSandbox ? EBAY_SANDBOX_TOKEN_URL : EBAY_TOKEN_URL;
  const credentials = btoa(`${appId}:${certId}`);

  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${credentials}`,
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code: authCode,
      redirect_uri: ruName, // eBay erwartet den RuName als redirect_uri
    }).toString(),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Auth code exchange failed: ${error}`);
  }

  const data = await response.json();
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: new Date(Date.now() + EBAY_TOKEN_EXPIRY).toISOString(),
  };
}

// ─── Sell API (Listings) ───────────────────────────────────────────────────────

export async function createEbayListing(
  account: EbayAccount,
  draft: EbayListingDraft
): Promise<{ listingId: string; listingUrl: string }> {
  if (account.type === 'papa') {
    throw new Error('Papa-Account kann keine Listings erstellen!');
  }

  const token = await getValidToken(account);
  const baseUrl = account.isSandbox ? EBAY_SANDBOX_BASE_URL : EBAY_PROD_BASE_URL;

  const body = {
    sku: `emio-${Date.now()}`,
    product: {
      title: draft.title,
      description: draft.description,
      imageUrls: draft.imageUrls,
    },
    condition: draft.condition,
    availability: {
      shipToLocationAvailability: {
        quantity: draft.quantity,
      },
    },
  };

  const response = await fetch(`${baseUrl}/sell/inventory/v1/inventory_item/emio-${Date.now()}`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Content-Language': 'de-DE',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(`eBay listing creation failed: ${response.status}`);
  }

  return {
    listingId: `emio-${Date.now()}`,
    listingUrl: `https://www.ebay.de/itm/emio-${Date.now()}`,
  };
}

// ─── Multi-Query Fallback ──────────────────────────────────────────────────────

export async function fetchSoldListingsWithFallback(
  account: EbayAccount,
  primaryQuery: string,
  alternativeQueries: string[],
  limit = 10,
  categoryId?: string
): Promise<EbaySoldListing[]> {
  // Versuche erst primaryQuery
  let results = await fetchSoldListings(account, primaryQuery, limit, categoryId);

  // Wenn < 5 Ergebnisse, versuche alternatives
  for (const altQuery of alternativeQueries) {
    if (results.length >= 5) break;
    const altResults = await fetchSoldListings(account, altQuery, limit, categoryId);
    // Merge ohne Duplikate (check by url)
    const existingUrls = new Set(results.map(r => r.url));
    const newResults = altResults.filter(r => !existingUrls.has(r.url));
    results = [...results, ...newResults];
  }

  return results.slice(0, limit);
}

// ─── Image Search ──────────────────────────────────────────────────────────────

export async function searchEbayByImage(
  account: EbayAccount,
  base64Image: string,
  limit = 10
): Promise<EbaySoldListing[]> {
  const token = await getValidToken(account);
  const baseUrl = account.isSandbox ? EBAY_SANDBOX_BASE_URL : EBAY_PROD_BASE_URL;

  const response = await fetch(
    `${baseUrl}/buy/browse/v1/item_summary/search_by_image?limit=${limit}`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'X-EBAY-C-MARKETPLACE-ID': 'EBAY_DE',
        'Accept-Language': 'de-DE',
      },
      body: JSON.stringify({ image: base64Image }),
    }
  );

  if (!response.ok) return [];

  const data = await response.json();
  const items = (data.itemSummaries ?? []) as Record<string, unknown>[];

  return items.map((item) => ({
    title: item.title as string,
    price: parseFloat((item.price as Record<string, string>)?.value ?? '0'),
    currency: (item.price as Record<string, string>)?.currency ?? 'EUR',
    soldDate: (item.itemEndDate as string) ?? new Date().toISOString(),
    condition: (item.condition as string) ?? 'Unknown',
    url: (item.itemWebUrl as string) ?? '',
    imageUrl: ((item.image as Record<string, string>)?.imageUrl) ?? undefined,
  }));
}
