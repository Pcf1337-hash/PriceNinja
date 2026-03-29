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

import TextRecognition, { TextRecognitionScript } from '@react-native-ml-kit/text-recognition';
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

// ── Game detection (EN + DE + FR + IT + ES + PT) ─────────────────────────────

function detectGame(text: string): CardGame | null {
  const t = text.toLowerCase();

  const isPokemon =
    // English
    (t.includes('hp') && (t.includes('weakness') || t.includes('retreat') || t.includes('pokémon') || t.includes('pokemon'))) ||
    t.includes('basic pokémon') || t.includes('stage 1') || t.includes('stage 2') ||
    // German
    (t.includes('kp') && (t.includes('schwäche') || t.includes('rückzug') || t.includes('pokémon'))) ||
    t.includes('basis-pokémon') || t.includes('basis pokémon') ||
    t.includes('phase 1') || t.includes('phase 2') ||
    // French
    t.includes('pokémon de base') || t.includes('faiblesse') ||
    // Spanish/Portuguese
    t.includes('pokémon básico') ||
    // Generic: card number pattern AND "pokémon" anywhere on the card
    (t.includes('pokémon') && /\d{1,3}\s*\/\s*\d{1,3}/.test(t));

  const isYugioh =
    t.includes('atk/') || t.includes('/atk') ||
    t.includes('effect monster') || t.includes('spell card') ||
    t.includes('trap card') || t.includes('fusion monster') ||
    t.includes('synchro monster') || t.includes('xyz monster') ||
    // German Yu-Gi-Oh
    t.includes('effektmonster') || t.includes('zauberkt') || t.includes('fallenkarte') ||
    // Card code pattern like "SDMA-DE001"
    /[a-z]{2,6}-[a-z]{2,3}\d{3}/.test(t);

  const isMagic =
    !isPokemon && !isYugioh &&
    (t.includes('enchantment') || t.includes('creature —') ||
      t.includes('instant') || t.includes('sorcery') ||
      t.includes('planeswalker') || (t.includes('land') && t.includes('mana')) ||
      // German MTG
      t.includes('verzauberung') || t.includes('spontanzauber') || t.includes('kreatur'));

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
    // Skip pure numbers, number/number patterns, very short strings, and known non-name lines
    if (
      clean.length < 3 ||
      /^\d+$/.test(clean) ||
      /^[\d/]+$/.test(clean) ||
      /^kp\s*\d+/i.test(clean) ||
      /^hp\s*\d+/i.test(clean) ||
      /^\d+\s*hp/i.test(clean) ||
      /^\d+\s*kp/i.test(clean)
    ) {
      continue;
    }
    return clean;
  }
  return null;
}

function extractCardNumber(text: string, game: CardGame): { cardNumber?: string; setCode?: string } {
  if (game === 'pokemon') {
    // Modern format (Scarlet & Violet+): "13/198 SVI" — card number + set code on same line
    const modernPattern = text.match(/(\d{1,4})\s*\/\s*(\d{1,4})\s+([A-Z]{2,4})/);
    if (modernPattern) {
      return {
        cardNumber: `${modernPattern[1]}/${modernPattern[2]}`,
        setCode: modernPattern[3].toLowerCase(),
      };
    }
    // Classic: e.g. "025/102" or "025 / 165"
    const m = text.match(/(\d{1,3})\s*\/\s*(\d{1,3})/);
    if (m) return { cardNumber: m[0].replace(/\s/g, '') };
    // Promo pattern e.g. "SWSH001"
    const promo = text.match(/[A-Z]{2,6}\d{3}/);
    if (promo) return { cardNumber: promo[0] };
  }
  if (game === 'yugioh') {
    // e.g. "SDMA-EN001", "LCKC-DE036"
    const m = text.match(/[A-Z]{2,6}-[A-Z]{2,3}\d{3}/i);
    if (m) {
      const parts = m[0].toUpperCase().split('-');
      return { setCode: parts[0], cardNumber: m[0].toUpperCase() };
    }
    // Passcode: 8-digit number in bottom-left corner (language/print-independent)
    const passcode = text.match(/\b(\d{8})\b/);
    if (passcode) return { cardNumber: passcode[1] };
  }
  if (game === 'magic') {
    // Modern collector number: "R 0034 • FDN • EN" or "C 0120 • MID • EN"
    const modernMagic = text.match(/([CRUMSLT])\s+(\d{4})\s*[•★]\s*([A-Z]{3})/);
    if (modernMagic) return { cardNumber: modernMagic[2], setCode: modernMagic[3].toLowerCase() };
    // Classic with set code: "120/280 MID EN R"
    const classic = text.match(/(\d{1,3})\s*\/\s*\d{1,3}\s+([A-Z]{3})/);
    if (classic) return { cardNumber: classic[1], setCode: classic[2].toLowerCase() };
    // Basic: collector number only
    const m = text.match(/(\d{1,3})\s*\/\s*\d{1,3}/);
    if (m) return { cardNumber: m[1] };
  }
  return {};
}

// ── Free card DB lookups ──────────────────────────────────────────────────────

interface PokemonApiCard {
  name: string;
  set?: { name: string; id: string };
  number?: string;
  rarity?: string;
}

async function lookupPokemon(
  name: string,
  cardNumber?: string,
  setCode?: string,
  pokemonApiKey?: string,
): Promise<Partial<OcrCardMatch> | null> {
  const authHeaders: Record<string, string> = {
    Accept: 'application/json',
    ...(pokemonApiKey ? { 'X-Api-Key': pokemonApiKey } : {}),
  };

  try {
    // Strategy 0: direct ID lookup when we have both setCode and cardNumber (fastest, most precise)
    if (setCode && cardNumber) {
      const raw = cardNumber.split('/')[0];
      const num = raw.replace(/^0+/, '') || raw;
      const directRes = await fetch(
        `https://api.pokemontcg.io/v2/cards/${setCode}-${num}`,
        { headers: authHeaders },
      );
      if (directRes.ok) {
        const directJson = (await directRes.json()) as { data?: PokemonApiCard };
        const card = directJson.data;
        if (card) {
          return {
            name: card.name,
            setName: card.set?.name,
            setCode: card.set?.id,
            cardNumber: card.number,
            rarity: card.rarity,
            confidence: 0.97,
          };
        }
      }
    }

    // Strategy 1: search by card number only (language-independent, most reliable)
    if (cardNumber) {
      const num = cardNumber.split('/')[0].replace(/^0+/, ''); // "006" → "6"
      const res = await fetch(
        `https://api.pokemontcg.io/v2/cards?q=${encodeURIComponent(`number:${num}`)}&pageSize=5`,
        { headers: authHeaders },
      );
      if (res.ok) {
        const json = (await res.json()) as { data?: PokemonApiCard[] };
        // Pick the card whose total matches (e.g. "006/165" → set with 165 total)
        const card = json.data?.[0];
        if (card) {
          return {
            name: card.name,
            setName: card.set?.name,
            setCode: card.set?.id,
            cardNumber: card.number,
            rarity: card.rarity,
            confidence: 0.93,
          };
        }
      }
    }

    // Strategy 2: search by name (English names only — OCR name may be localized)
    const q = cardNumber
      ? `name:"${name}" number:${cardNumber.split('/')[0]}`
      : `name:"${name}"`;
    const res = await fetch(
      `https://api.pokemontcg.io/v2/cards?q=${encodeURIComponent(q)}&pageSize=1`,
      { headers: authHeaders },
    );
    if (!res.ok) return null;
    const json = (await res.json()) as { data?: PokemonApiCard[] };
    const card = json.data?.[0];
    if (!card) return null;
    return {
      name: card.name,
      setName: card.set?.name,
      setCode: card.set?.id,
      cardNumber: card.number,
      rarity: card.rarity,
      confidence: 0.85,
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
 *
 * Runs two parallel OCR passes (Latin + Japanese) and picks whichever
 * returns more text — this transparently handles JP/Asian language cards.
 */
export async function identifyCardByOcr(
  imageUri: string,
  pokemonApiKey?: string,
): Promise<OcrCardMatch | null> {
  let ocrText: string;
  try {
    const [latinResult, japaneseResult] = await Promise.allSettled([
      TextRecognition.recognize(imageUri),
      TextRecognition.recognize(imageUri, TextRecognitionScript.JAPANESE),
    ]);

    const latinText = latinResult.status === 'fulfilled' ? latinResult.value.text : '';
    const japaneseText = japaneseResult.status === 'fulfilled' ? japaneseResult.value.text : '';
    // Use Japanese result when it contains significantly more content (20 % threshold)
    ocrText = japaneseText.length > latinText.length * 1.2 ? japaneseText : latinText;
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
  if (game === 'pokemon') dbMatch = await lookupPokemon(name, cardNumber, setCode, pokemonApiKey);
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
