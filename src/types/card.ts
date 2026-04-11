export type CardGame =
  // TCG — Cardmarket + TCGPlayer
  | 'pokemon' | 'yugioh' | 'magic'
  // Sports Cards — eBay Browse API
  | 'wwe' | 'baseball' | 'basketball' | 'football' | 'soccer' | 'hockey' | 'ufc'
  // Generic
  | 'other';

export type CardCategory = 'tcg' | 'sports' | 'other';

export function getCardCategory(game: CardGame): CardCategory {
  if (['pokemon', 'yugioh', 'magic'].includes(game)) return 'tcg';
  if (['wwe', 'baseball', 'basketball', 'football', 'soccer', 'hockey', 'ufc'].includes(game)) return 'sports';
  return 'other';
}

export function getCardEmoji(game: CardGame): string {
  const map: Record<CardGame, string> = {
    pokemon: '⚡',
    yugioh: '👁',
    magic: '⚔️',
    wwe: '🤼',
    baseball: '⚾',
    basketball: '🏀',
    football: '🏈',
    soccer: '⚽',
    hockey: '🏒',
    ufc: '🥊',
    other: '🃏',
  };
  return map[game] ?? '🃏';
}

export function getCardLabel(game: CardGame): string {
  const map: Record<CardGame, string> = {
    pokemon: 'Pokémon',
    yugioh: 'Yu-Gi-Oh!',
    magic: 'Magic: The Gathering',
    wwe: 'WWE / AEW Wrestling',
    baseball: 'Baseball (MLB)',
    basketball: 'Basketball (NBA)',
    football: 'Football (NFL)',
    soccer: 'Fußball / Soccer',
    hockey: 'Hockey (NHL)',
    ufc: 'UFC / Boxen / MMA',
    other: 'Trading Card',
  };
  return map[game] ?? 'Trading Card';
}

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
  // TCG (Pokémon, Yu-Gi-Oh, Magic)
  cardmarketLow?: number;
  cardmarketMid?: number;
  cardmarketTrend?: number;
  tcgplayerLow?: number;
  tcgplayerMid?: number;
  cardmarketUrl?: string;
  cardImageUrl?: string;
  // Sports Cards (WWE, Baseball etc.) — eBay active listings
  ebayAvgPrice?: number;
  ebayMinPrice?: number;
  ebayUrl?: string;
  // Common
  currency: string;
  updatedAt: string;
}
