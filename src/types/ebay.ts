export type EbayAccountType = 'papa' | 'own';

export interface EbayAccount {
  type: EbayAccountType;
  username: string;
  appId: string;
  certId: string;
  devId?: string;
  ruName: string;
  accessToken: string;
  refreshToken: string;
  tokenExpiresAt: string;
  connectedAt: string;
  isSandbox: boolean;
}

export interface EbayPermissions {
  canLookupPrices: boolean;
  canCreateListings: boolean;
}

export interface EbaySearchResult {
  itemId: string;
  title: string;
  price: number;
  currency: string;
  condition: string;
  imageUrl?: string;
  itemUrl: string;
  soldDate?: string;
}

export interface EbayListingDraft {
  title: string;
  description: string;
  categoryId: string;
  price: number;
  currency: string;
  condition: string;
  imageUrls: string[];
  quantity: number;
}
