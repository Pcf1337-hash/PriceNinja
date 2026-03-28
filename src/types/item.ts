export interface ScannedItem {
  id: string;
  name: string;
  brand?: string;
  model?: string;
  category: string;
  imageUri: string;
  imageBase64?: string;
  confidence: number;
  addedAt: string;
  updatedAt: string;
}

export interface TrackedItem extends ScannedItem {
  ebaySoldAvg?: number;
  ebaySoldMin?: number;
  ebaySoldMax?: number;
  ebaySoldCount?: number;
  geizhalsCheapest?: number;
  geizhalsUrl?: string;
  lastPriceUpdate?: string;
  refreshInterval: 1 | 2 | 6 | 12 | 24; // hours
  priceHistory: PricePoint[];
  isFavorite: boolean;
}

export interface PricePoint {
  timestamp: string;
  ebaySoldAvg: number;
  geizhalsCheapest?: number;
}

export interface EbaySoldListing {
  title: string;
  price: number;
  currency: string;
  soldDate: string;
  condition: string;
  url: string;
  imageUrl?: string;
}
