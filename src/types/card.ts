export type CardGame = 'pokemon' | 'yugioh' | 'magic' | 'other';
export type CardCondition = 'mint' | 'near-mint' | 'excellent' | 'good' | 'light-played' | 'played' | 'poor';

export interface TradingCard {
  id: string;
  game: CardGame;
  name: string;
  setName?: string;
  setCode?: string;
  cardNumber?: string;
  rarity?: string;
  condition?: CardCondition;
  imageUri: string;
  scannedAt: string;
  isFavorite: boolean;
  prices?: CardPrices;
}

export interface CardPrices {
  cardmarketLow?: number;
  cardmarketMid?: number;
  cardmarketTrend?: number;
  tcgplayerLow?: number;
  tcgplayerMid?: number;
  currency: string;
  updatedAt: string;
}
