import * as SecureStore from 'expo-secure-store';
import Constants from 'expo-constants';
import {
  EBAY_PROD_BASE_URL,
  EBAY_SANDBOX_BASE_URL,
  EBAY_TOKEN_URL,
  EBAY_SANDBOX_TOKEN_URL,
  EBAY_TOKEN_EXPIRY,
} from '@/src/utils/constants';
import { EbayAccount, EbaySearchResult, EbayListingDraft } from '@/src/types/ebay';
import { EbaySoldListing } from '@/src/types/item';

const _ENV = Constants.expoConfig?.extra ?? {};
const _ENV_APP_ID = _ENV.ebayAppId as string;
const _ENV_CERT_ID = _ENV.ebayCertId as string;

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

// ─── Application Token (client_credentials) — für Browse API, kein User-Login nötig ─

let _appTokenCache: { token: string; expiresAt: number } | null = null;

async function getApplicationToken(appId: string, certId: string, isSandbox: boolean): Promise<string> {
  const now = Date.now();
  if (_appTokenCache && now < _appTokenCache.expiresAt - 60_000) {
    return _appTokenCache.token;
  }

  const tokenUrl = isSandbox ? EBAY_SANDBOX_TOKEN_URL : EBAY_TOKEN_URL;
  const credentials = btoa(`${appId}:${certId}`);

  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${credentials}`,
    },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      scope: 'https://api.ebay.com/oauth/api_scope',
    }).toString(),
  });

  if (!response.ok) {
    throw new Error(`Application token fetch failed: ${response.status}`);
  }

  const data = await response.json();
  _appTokenCache = {
    token: data.access_token,
    expiresAt: now + (data.expires_in ?? 7200) * 1000,
  };
  return _appTokenCache.token;
}

// Für Browse API: Application Token reicht, kein User-Login nötig
async function getBrowseToken(account: EbayAccount): Promise<string> {
  return getApplicationToken(account.appId, account.certId, account.isSandbox);
}

// Für Sell API: User-OAuth-Token zwingend nötig
async function getSellToken(account: EbayAccount): Promise<string> {
  const expiresAt = account.tokenExpiresAt ? new Date(account.tokenExpiresAt).getTime() : 0;
  if (account.accessToken && Date.now() < expiresAt - 5 * 60 * 1000) {
    return account.accessToken;
  }
  if (!account.refreshToken) {
    throw new Error('Nicht mit eBay angemeldet. Bitte im Wizard einloggen.');
  }
  return refreshUserToken(account);
}

async function refreshUserToken(account: EbayAccount): Promise<string> {
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
  const token = await getBrowseToken(account);
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

// ─── Public Price Lookup — no user account needed, uses baked-in app credentials ─

export async function fetchSoldListingsPublic(
  searchQuery: string,
  limit = 10,
  categoryId?: string
): Promise<EbaySoldListing[]> {
  const token = await getApplicationToken(_ENV_APP_ID, _ENV_CERT_ID, false);
  const params = new URLSearchParams({
    q: searchQuery,
    limit: String(limit),
    filter: 'buyingOptions:{FIXED_PRICE|AUCTION},conditionIds:{3000|4000|5000|6000}',
  });
  if (categoryId) params.set('category_ids', categoryId);

  const response = await fetch(
    `${EBAY_PROD_BASE_URL}/buy/browse/v1/item_summary/search?${params}`,
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

// ─── Trading API helpers ───────────────────────────────────────────────────────

const TRADING_API_URL = 'https://api.ebay.com/ws/api.dll';
const TRADING_API_SANDBOX_URL = 'https://api.sandbox.ebay.com/ws/api.dll';

function tradingApiHeaders(
  account: EbayAccount,
  callName: string
): Record<string, string> {
  return {
    'X-EBAY-API-CALL-NAME': callName,
    'X-EBAY-API-SITEID': '77', // Germany
    'X-EBAY-API-COMPATIBILITY-LEVEL': '967',
    'X-EBAY-API-APP-NAME': account.appId,
    'X-EBAY-API-DEV-NAME': account.devId ?? account.appId,
    'X-EBAY-API-CERT-NAME': account.certId,
  };
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// ─── Upload Image to eBay Picture Services ────────────────────────────────────

export async function uploadImageToEbay(
  account: EbayAccount,
  localUri: string
): Promise<string> {
  const token = await getSellToken(account);
  const apiUrl = account.isSandbox ? TRADING_API_SANDBOX_URL : TRADING_API_URL;

  const xml = `<?xml version="1.0" encoding="utf-8"?>
<UploadSiteHostedPicturesRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <RequesterCredentials>
    <eBayAuthToken>${token}</eBayAuthToken>
  </RequesterCredentials>
  <PictureName>listing-photo</PictureName>
  <PictureSet>Supersize</PictureSet>
</UploadSiteHostedPicturesRequest>`;

  const formData = new FormData();
  // eBay requires the XML part to be named "XML Payload"
  formData.append('XML Payload', { uri: 'data:text/xml,' + encodeURIComponent(xml), type: 'text/xml', name: 'payload.xml' } as unknown as Blob);
  formData.append('image', { uri: localUri, type: 'image/jpeg', name: 'photo.jpg' } as unknown as Blob);

  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: tradingApiHeaders(account, 'UploadSiteHostedPictures'),
    body: formData,
  });

  if (!response.ok) {
    throw new Error(`Foto-Upload fehlgeschlagen: HTTP ${response.status}`);
  }

  const text = await response.text();
  const urlMatch = text.match(/<FullURL>(https?:\/\/[^<]+)<\/FullURL>/);
  if (!urlMatch?.[1]) {
    const errMatch = text.match(/<ShortMessage>([^<]+)<\/ShortMessage>/);
    throw new Error(`Foto-Upload fehlgeschlagen: ${errMatch?.[1] ?? 'Kein URL in Antwort'}`);
  }
  return urlMatch[1];
}

// ─── Sell API — Trading API AddFixedPriceItem ─────────────────────────────────

export interface EbayListingRequest {
  title: string;
  description: string;
  condition: string;       // 'Neu' | 'Wie Neu' | 'Sehr Gut' | 'Gut' | 'Akzeptabel'
  price: number;
  listingType: 'Festpreis' | 'Auktion';
  startPrice?: number;     // nur bei Auktion
  shippingCost: number;    // 0 für kostenlos
  duration: '7 Tage' | '10 Tage' | '30 Tage';
  imageUrls: string[];     // eBay-hosted or external public URLs
  categoryId?: string;
}

export async function createEbayListing(
  account: EbayAccount,
  req: EbayListingRequest
): Promise<{ listingId: string; listingUrl: string; estimatedFees?: number }> {
  if (account.type === 'papa') {
    throw new Error('Papa-Account kann keine Listings erstellen!');
  }

  const token = await getSellToken(account);
  const apiUrl = account.isSandbox ? TRADING_API_SANDBOX_URL : TRADING_API_URL;

  const conditionMap: Record<string, number> = {
    'Neu': 1000,
    'Wie Neu': 3000,
    'Sehr Gut': 3000,
    'Gut': 5000,
    'Akzeptabel': 6000,
  };
  const conditionId = conditionMap[req.condition] ?? 3000;

  const durationMap: Record<string, string> = {
    '7 Tage': 'Days_7',
    '10 Tage': 'Days_10',
    '30 Tage': 'GTC',
  };
  const listingDuration = durationMap[req.duration] ?? 'Days_7';

  const picturesXml = req.imageUrls.length > 0
    ? `<PictureDetails>\n      ${req.imageUrls.map(u => `<PictureURL>${escapeXml(u)}</PictureURL>`).join('\n      ')}\n    </PictureDetails>`
    : '';

  const shippingXml = req.shippingCost === 0
    ? `<ShippingDetails>
      <ShippingType>Free</ShippingType>
      <ShippingServiceOptions>
        <ShippingServicePriority>1</ShippingServicePriority>
        <ShippingService>DE_DHLPaket</ShippingService>
        <ShippingServiceCost>0.00</ShippingServiceCost>
        <FreeShipping>true</FreeShipping>
      </ShippingServiceOptions>
    </ShippingDetails>`
    : `<ShippingDetails>
      <ShippingType>Flat</ShippingType>
      <ShippingServiceOptions>
        <ShippingServicePriority>1</ShippingServicePriority>
        <ShippingService>DE_DHLPaket</ShippingService>
        <ShippingServiceCost>${req.shippingCost.toFixed(2)}</ShippingServiceCost>
      </ShippingServiceOptions>
    </ShippingDetails>`;

  const isAuction = req.listingType === 'Auktion';
  const startPrice = isAuction && req.startPrice ? req.startPrice : req.price;

  const xml = `<?xml version="1.0" encoding="utf-8"?>
<AddFixedPriceItemRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <RequesterCredentials>
    <eBayAuthToken>${token}</eBayAuthToken>
  </RequesterCredentials>
  <Item>
    <Title>${escapeXml(req.title.slice(0, 80))}</Title>
    <Description><![CDATA[${req.description}]]></Description>
    <PrimaryCategory>
      <CategoryID>${req.categoryId ?? '99'}</CategoryID>
    </PrimaryCategory>
    <StartPrice>${startPrice.toFixed(2)}</StartPrice>
    ${isAuction && req.price ? `<BuyItNowPrice>${req.price.toFixed(2)}</BuyItNowPrice>` : ''}
    <ConditionID>${conditionId}</ConditionID>
    <Country>DE</Country>
    <Currency>EUR</Currency>
    <DispatchTimeMax>3</DispatchTimeMax>
    <ListingDuration>${listingDuration}</ListingDuration>
    <ListingType>FixedPriceItem</ListingType>
    ${picturesXml}
    <Quantity>1</Quantity>
    <ReturnPolicy>
      <ReturnsAcceptedOption>ReturnsNotAccepted</ReturnsAcceptedOption>
    </ReturnPolicy>
    ${shippingXml}
    <Site>Germany</Site>
  </Item>
</AddFixedPriceItemRequest>`;

  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      ...tradingApiHeaders(account, 'AddFixedPriceItem'),
      'Content-Type': 'text/xml',
    },
    body: xml,
  });

  const text = await response.text();

  const ack = text.match(/<Ack>(.*?)<\/Ack>/)?.[1];
  const itemId = text.match(/<ItemID>(\d+)<\/ItemID>/)?.[1];
  const errMsg = text.match(/<ShortMessage>(.*?)<\/ShortMessage>/)?.[1];
  const feeStr = text.match(/<Fee>(\d+\.?\d*)<\/Fee>/)?.[1];

  if (ack === 'Failure' || (!itemId && !response.ok)) {
    throw new Error(errMsg ?? `Angebot konnte nicht erstellt werden (${response.status})`);
  }

  if (!itemId) {
    throw new Error(errMsg ?? 'Keine Item-ID in Antwort erhalten');
  }

  return {
    listingId: itemId,
    listingUrl: `https://www.ebay.de/itm/${itemId}`,
    estimatedFees: feeStr ? parseFloat(feeStr) : undefined,
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
  const token = await getBrowseToken(account);
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
