/**
 * Tier-1 Card Identification: On-device ML Kit OCR + free card APIs
 *
 * Flow:
 *   takePicture → ML Kit OCR (free, offline) → parse game/name/number
 *     → query Pokémon TCG API / Scryfall / YGOPRODeck (free, no key)
 *     → return match  (confidence >= 0.7 → skip Claude)
 *
 * Falls back to Claude (Tier 2) when this returns null or confidence < 0.7.
 */

import TextRecognition from '@react-native-ml-kit/text-recognition';
import { CardGame } from '@/src/types/card';

export interface OcrCardMatch {
  game: CardGame;
  name: string;
  setName?: string;
  setCode?: string;
  cardNumber?: string;
  rarity?: string;
  condition?: string;
  confidence: number;
  source: 'ocr+db' | 'ocr-only';
  searchQuery: string;
}

// ── Game detection ────────────────────────────────────────────────────────────

function detectGame(text: string): CardGame | null {
  const t = text.toLowerCase();

  const isPokemon =
    (t.includes('hp') && (t.includes('weakness') || t.includes('retreat') || t.includes('pokémon') || t.includes('pokemon'))) ||
    t.includes('basic pokémon') ||
    t.includes('stage 1') ||
    t.includes('stage 2');

  const isYugioh =
    t.includes('atk/') ||
    t.includes('/atk') ||
    t.includes('effect monster') ||
    t.includes('spell card') ||
    t.includes('trap card') ||
    t.includes('fusion monster') ||
    t.includes('synchro monster') ||
    t.includes('xyz monster');

  const isMagic =
    !isPokemon &&
    !isYugioh &&
    (t.includes('enchantment') ||
      t.includes('creature —') ||
      t.includes('instant') ||
      t.includes('sorcery') ||
      t.includes('planeswalker') ||
      t.includes('land') && t.includes('mana'));

  if (isPokemon) return 'pokemon';
  if (isYugioh) return 'yugioh';
  if (isMagic) return 'magic';
  return null;
}

// ── Text extraction ───────────────────────────────────────────────────────────

function extractCardName(lines: string[]): string | null {
  // Card name is usually the first non-trivial line (not a number, not too short)
  for (const line of lines) {
    const clean = line.trim();
    if (clean.length >= 3 && !/^\d+$/.test(clean) && !/^[\d/]+$/.test(clean)) {
      return clean;
    }
  }
  return null;
}

function extractCardNumber(text: string, game: CardGame): { cardNumber?: string; setCode?: string } {
  if (game === 'pokemon') {
    // e.g. "025/102" or "SWSH001"
    const m = text.match(/(\d{1,3})\s*\/\s*(\d{1,3})/);
    if (m) return { cardNumber: m[0].replace(/\s/g, '') };
  }
  if (game === 'yugioh') {
    // e.g. "SDMA-EN001", "LCKC-DE036"
    const m = text.match(/[A-Z]{2,6}-[A-Z]{2,3}\d{3}/);
    if (m) {
      const parts = m[0].split('-');
      return { setCode: parts[0], cardNumber: m[0] };
    }
  }
  if (game === 'magic') {
    // Collector number at bottom right, e.g. "123/300" → take "123"
    const m = text.match(/(\d{1,3})\s*\/\s*\d{1,3}/);
    if (m) return { cardNumber: m[1] };
  }
  return {};
}

// ── Free card DB lookups ──────────────────────────────────────────────────────

async function lookupPokemon(
  name: string,
  cardNumber?: string,
): Promise<Partial<OcrCardMatch> | null> {
  try {
    const q = cardNumber
      ? `name:"${name}" number:${cardNumber.split('/')[0]}`
      : `name:"${name}"`;
    const res = await fetch(
      `https://api.pokemontcg.io/v2/cards?q=${encodeURIComponent(q)}&pageSize=1`,
      { headers: { Accept: 'application/json' } },
    );
    if (!res.ok) return null;
    const json = (await res.json()) as {
      data?: Array<{
        name: string;
        set?: { name: string; id: string };
        number?: string;
        rarity?: string;
      }>;
    };
    const card = json.data?.[0];
    if (!card) return null;
    return {
      name: card.name,
      setName: card.set?.name,
      setCode: card.set?.id,
      cardNumber: card.number,
      rarity: card.rarity,
      confidence: 0.92,
    };
  } catch {
    return null;
  }
}

async function lookupMagic(
  name: string,
  setCode?: string,
): Promise<Partial<OcrCardMatch> | null> {
  try {
    const params = new URLSearchParams({ fuzzy: name });
    if (setCode) params.set('set', setCode.toLowerCase());
    const res = await fetch(`https://api.scryfall.com/cards/named?${params.toString()}`);
    if (!res.ok) return null;
    const card = (await res.json()) as {
      object: string;
      name: string;
      set_name: string;
      set: string;
      collector_number: string;
      rarity: string;
    };
    if (card.object === 'error') return null;
    return {
      name: card.name,
      setName: card.set_name,
      setCode: card.set?.toUpperCase(),
      cardNumber: card.collector_number,
      rarity: card.rarity,
      confidence: 0.95,
    };
  } catch {
    return null;
  }
}

async function lookupYugioh(name: string): Promise<Partial<OcrCardMatch> | null> {
  try {
    const res = await fetch(
      `https://db.ygoprodeck.com/api/v7/cardinfo.php?fname=${encodeURIComponent(name)}`,
    );
    if (!res.ok) return null;
    const json = (await res.json()) as {
      data?: Array<{
        name: string;
        card_sets?: Array<{ set_name: string; set_code: string; set_rarity: string }>;
      }>;
    };
    const card = json.data?.[0];
    if (!card) return null;
    const set = card.card_sets?.[0];
    return {
      name: card.name,
      setName: set?.set_name,
      setCode: set?.set_code?.split('-')[0],
      cardNumber: set?.set_code,
      rarity: set?.set_rarity,
      confidence: 0.88,
    };
  } catch {
    return null;
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Identify a trading card image using on-device OCR + free card APIs.
 * Returns null if the card cannot be identified with sufficient confidence.
 * Caller should fall back to Claude Vision when this returns null.
 */
export async function identifyCardByOcr(imageUri: string): Promise<OcrCardMatch | null> {
  let ocrText: string;
  try {
    const result = await TextRecognition.recognize(imageUri);
    ocrText = result.text;
  } catch {
    return null;
  }

  const lines = ocrText.split('\n').map((l) => l.trim()).filter(Boolean);
  if (lines.length < 2) return null;

  const game = detectGame(ocrText);
  if (!game) return null;

  const name = extractCardName(lines);
  if (!name || name.length < 2) return null;

  const { cardNumber, setCode } = extractCardNumber(ocrText, game);

  // Query the matching free API
  let dbMatch: Partial<OcrCardMatch> | null = null;
  if (game === 'pokemon') dbMatch = await lookupPokemon(name, cardNumber);
  else if (game === 'magic') dbMatch = await lookupMagic(name, setCode);
  else if (game === 'yugioh') dbMatch = await lookupYugioh(name);

  if (dbMatch) {
    return {
      game,
      name: dbMatch.name ?? name,
      setName: dbMatch.setName,
      setCode: dbMatch.setCode ?? setCode,
      cardNumber: dbMatch.cardNumber ?? cardNumber,
      rarity: dbMatch.rarity,
      confidence: dbMatch.confidence ?? 0.85,
      source: 'ocr+db',
      searchQuery: dbMatch.name ?? name,
    };
  }

  // DB lookup failed — return OCR-only if we have a decent text result
  if (game !== 'other') {
    return {
      game,
      name,
      setCode,
      cardNumber,
      confidence: 0.55,
      source: 'ocr-only',
      searchQuery: name,
    };
  }

  return null;
}
