import * as ImageManipulator from 'expo-image-manipulator';
import {
  CLAUDE_API_URL,
  CLAUDE_MODEL,
  CLAUDE_MAX_TOKENS,
  IMAGE_MAX_WIDTH,
  IMAGE_QUALITY,
} from '@/src/utils/constants';

export interface ClaudeAlternative {
  name: string;
  category: string;
  confidence: number;
  searchQuery: string;
}

export interface ClaudeLegoInfo {
  setNumber?: string;     // z.B. "75257"
  theme?: string;         // z.B. "Star Wars"
  subtheme?: string;      // z.B. "Ultimate Collector Series"
  year?: number;          // Erscheinungsjahr
  pieceCount?: number;    // Teileanzahl
  minifigs?: string[];    // enthaltene Figuren
  type?: 'set' | 'minifig' | 'moc'; // was wurde erkannt
}

export interface ClaudeItemResult {
  name: string;
  brand?: string;
  model?: string;
  category: string;
  confidence: number;
  description: string;
  searchQuery: string;           // primary (specifisch: "Samsung Galaxy S24 Ultra 256GB")
  alternativeQueries?: string[]; // 2-3 alternative Formulierungen
  broadQuery?: string;           // generisch: "Samsung Galaxy S24"
  categoryId?: string;           // eBay Kategorie-ID wenn erkennbar
  alternatives?: ClaudeAlternative[];
  isLegoOrBricks?: boolean;      // LEGO oder Klemmbausteine erkannt
  lego?: ClaudeLegoInfo;
}

export interface ClaudeCardResult {
  game: 'pokemon' | 'yugioh' | 'magic' | 'wwe' | 'baseball' | 'basketball' | 'football' | 'soccer' | 'hockey' | 'ufc' | 'other';
  name: string;
  setName?: string;
  setCode?: string;
  cardNumber?: string;
  rarity?: string;
  condition?: string;
  confidence: number;
  searchQuery: string;
}

async function compressImage(imageUri: string): Promise<string> {
  const result = await ImageManipulator.manipulateAsync(
    imageUri,
    [{ resize: { width: IMAGE_MAX_WIDTH } }],
    { compress: IMAGE_QUALITY, format: ImageManipulator.SaveFormat.JPEG, base64: true }
  );
  return result.base64 ?? '';
}

async function callClaude(
  apiKey: string,
  base64Image: string,
  prompt: string
): Promise<string> {
  const response = await fetch(CLAUDE_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: CLAUDE_MODEL,
      max_tokens: CLAUDE_MAX_TOKENS,
      temperature: 0,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: 'image/jpeg',
                data: base64Image,
              },
            },
            {
              type: 'text',
              text: prompt,
            },
          ],
        },
      ],
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Claude API error ${response.status}: ${error}`);
  }

  const data = await response.json();
  return data.content[0]?.text ?? '';
}

export async function identifyItem(
  apiKey: string,
  imageUri: string
): Promise<ClaudeItemResult> {
  const base64 = await compressImage(imageUri);

  const prompt = `Du bist ein Experte für Produkterkennung und LEGO/Klemmbausteine. Analysiere dieses Bild systematisch.

SCHRITT 1 - Beobachte: Was siehst du genau?
- Welche Texte, Logos, Markennamen sind sichtbar?
- Welche Modellnummern oder Produktcodes erkennst du?
- Welche physischen Merkmale (Farbe, Form, Größe, Material)?
- Sind LEGO-Steine, LEGO-Sets, LEGO-Verpackungen, LEGO-Figuren oder andere Klemmbausteine sichtbar?

SCHRITT 2 - Identifiziere: Basiere die Identifikation NUR auf den Beobachtungen aus Schritt 1. Erfinde keine Details.

SCHRITT 3 - Falls LEGO/Klemmbausteine erkannt:
- Setze isLegoOrBricks: true
- Identifiziere das Set (Setname, Setnummer wie "75257", Theme wie "Star Wars")
- Schätze Erscheinungsjahr, Teileanzahl und enthaltene Figuren aus deinem Wissen
- Für searchQuery verwende: "LEGO {Setnummer} {Setname}" für bessere eBay-Treffer

SCHRITT 4 - Erstelle Suchanfragen:
- searchQuery: 3-6 Keywords, spezifisch (Marke + Modell + Schlüsselspezifikation). KEINE Adjektive.
- alternativeQueries: 2-3 alternative Formulierungen (kürzer, anders betont)
- broadQuery: Nur Marke + Kategorie, ohne Modelldetails

Antworte NUR mit diesem JSON (kein Markdown, kein Text):
{
  "name": "vollständiger Produktname",
  "brand": "Marke oder null",
  "model": "Modellnummer oder null",
  "category": "Kategorie",
  "confidence": 0.95,
  "description": "kurze Beschreibung auf Deutsch",
  "searchQuery": "Marke Modell Spezifikation",
  "alternativeQueries": ["alternative 1", "alternative 2"],
  "broadQuery": "Marke Kategorie",
  "categoryId": "eBay Kategorie-ID wenn sicher erkennbar, sonst null",
  "alternatives": [
    { "name": "alternative 1", "category": "Kategorie", "confidence": 0.7, "searchQuery": "query 1" },
    { "name": "alternative 2", "category": "Kategorie", "confidence": 0.5, "searchQuery": "query 2" }
  ],
  "isLegoOrBricks": false,
  "lego": null
}
Falls LEGO/Klemmbausteine erkannt, ersetze die letzten zwei Felder:
  "isLegoOrBricks": true,
  "lego": {
    "setNumber": "75257",
    "theme": "Star Wars",
    "subtheme": "null oder Unterthema",
    "year": 2019,
    "pieceCount": 1351,
    "minifigs": ["Han Solo", "Chewbacca", "Rey Skywalker"],
    "type": "set"
  }
Für Einzelfiguren type="minifig", für selbst gebaute MOCs type="moc" (dann setNumber null).
Wenn du das Produkt nicht sicher identifizieren kannst, setze confidence < 0.5.`;

  const rawResponse = await callClaude(apiKey, base64, prompt);

  const jsonMatch = rawResponse.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('Claude returned no valid JSON');
  }

  const result = JSON.parse(jsonMatch[0]) as ClaudeItemResult;
  return result;
}

export async function identifyCard(
  apiKey: string,
  imageUri: string
): Promise<ClaudeCardResult> {
  const base64 = await compressImage(imageUri);

  const prompt = `You are a trading card expert. Analyze this trading card image carefully.

═══ STEP 1: DETERMINE THE CARD TYPE ═══
Look at the card carefully and pick EXACTLY ONE value for "game":

TCG (has HP / attack costs / game mechanics printed on the card):
  "pokemon"    → Pokémon TCG (Nintendo/Game Freak)
  "yugioh"     → Yu-Gi-Oh! (Konami) — has ATK/DEF numbers, "Effect Monster" etc.
  "magic"      → Magic: The Gathering (Wizards of the Coast) — has mana symbols

Sports Cards (shows a real athlete photo, produced by Topps/Panini/Upper Deck/Donruss/Bowman):
  "wwe"        → WWE wrestling or AEW cards
  "baseball"   → MLB baseball (Topps, Bowman, Donruss, Fleer, Upper Deck)
  "basketball" → NBA basketball (Topps, Panini Prizm, Select, Hoops, Donruss)
  "football"   → NFL/college football cards
  "soccer"     → Soccer/Fußball — including Panini stickers (FIFA WC, Champions League, Bundesliga, Adrenalyn XL)
  "hockey"     → NHL hockey cards
  "ufc"        → UFC, boxing, MMA trading cards

  "other"      → any other trading card type not listed above

═══ STEP 2: RULES ═══
1. Card number is usually at the BOTTOM (e.g. "006/165", "#45", "RC-1", "AXL-123").
2. For Sports Cards: read athlete name, year (usually top-left or copyright line), set/product line, card number, and any parallel/variant like "Prizm Silver /199", "Gold /50", "Autograph", "Rookie".
3. If non-English card (German "Glurak"=Charizard, "Relaxo"=Snorlax, "Bisaflor"=Venusaur, "Glumanda"=Charmander, "Schiggy"=Squirtle, "Turtok"=Blastoise, "Gengar"=Gengar): put ENGLISH name in "name", original in "localName".
4. searchQuery for Sports Cards → eBay-optimized: "YEAR BRAND SET ATHLETE VARIANT" e.g. "2024 Panini Select WWE Roman Reigns Silver Prizm /199"
5. searchQuery for TCG → Cardmarket-optimized: "NAME SETNAME" e.g. "Charizard Obsidian Flames"

═══ STEP 3: RESPOND WITH JSON ═══
Return ONLY valid JSON — no markdown fences, no explanation text around it.
Replace every <placeholder> with the real value you identified. Do NOT copy placeholder text.

{
  "game": "<one of: pokemon | yugioh | magic | wwe | baseball | basketball | football | soccer | hockey | ufc | other>",
  "name": "<English name of the card/athlete>",
  "localName": "<name as printed on card if non-English, otherwise null>",
  "setName": "<full set or product name as printed, or null>",
  "setCode": "<TCG set code like sv3 or base1; for sports cards put the year like 2024; or null>",
  "cardNumber": "<card number exactly as printed, or null>",
  "rarity": "<TCG: Common|Uncommon|Rare|Holo Rare|Ultra Rare|Secret Rare — Sports: Base|Rookie|Prizm|Silver|Gold /50|Autograph|Patch|1/1 etc. — or null>",
  "condition": "<M | NM | LP | MP | HP>",
  "confidence": <0.0–1.0>,
  "searchQuery": "<optimized search string as described in rule 4 or 5>"
}

Condition codes: M=Mint, NM=Near Mint, LP=Lightly Played, MP=Moderately Played, HP=Heavily Played.`;

  const rawResponse = await callClaude(apiKey, base64, prompt);

  const jsonMatch = rawResponse.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('Claude returned no valid JSON for card');
  }

  const parsed = JSON.parse(jsonMatch[0]) as ClaudeCardResult & { localName?: string };

  // If Claude returned a localized name but also an English name, prefer the English name
  // for DB lookups but preserve display info
  const result: ClaudeCardResult = {
    game: parsed.game,
    name: parsed.name,
    setName: parsed.setName ?? undefined,
    setCode: parsed.setCode ?? undefined,
    cardNumber: parsed.cardNumber ?? undefined,
    rarity: parsed.rarity ?? undefined,
    condition: parsed.condition ?? undefined,
    confidence: parsed.confidence,
    searchQuery: parsed.searchQuery,
  };

  return result;
}

// ─── eBay Listing Generator ──────────────────────────────────────────────────

export interface EbayListingDraft {
  title: string;
  shortDescription: string;
  mediumDescription: string;
  longDescription: string;
  suggestedKeywords: string[];
  categoryHint: string;
}

export async function generateEbayListing(
  apiKey: string,
  itemName: string,
  brand: string | undefined,
  model: string | undefined,
  category: string,
  ebaySoldAvg: number | undefined,
  condition: string,
): Promise<EbayListingDraft> {
  const prompt = `Du bist ein eBay-Listing-Experte. Erstelle ein professionelles deutsches eBay-Angebot für:

Artikel: ${itemName}
${brand ? `Marke: ${brand}` : ''}
${model ? `Modell: ${model}` : ''}
Kategorie: ${category}
Zustand: ${condition}
${ebaySoldAvg ? `Durchschnittlicher eBay-Verkaufspreis: ${ebaySoldAvg.toFixed(2)} €` : ''}

Antworte NUR mit diesem JSON (kein Markdown, kein Text darum):
{
  "title": "eBay Titel max 80 Zeichen, präzise mit Marke/Modell/Zustand",
  "shortDescription": "2-3 Sätze, das Wichtigste",
  "mediumDescription": "5-7 Sätze, Zustand + Lieferumfang + Hinweise",
  "longDescription": "Ausführliche Beschreibung mit allen Details, Privatverkauf-Hinweis, Versandinfos",
  "suggestedKeywords": ["keyword1", "keyword2", "keyword3"],
  "categoryHint": "passende eBay-Kategorie"
}`;

  const response = await fetch(CLAUDE_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!response.ok) throw new Error(`Claude API error: ${response.status}`);
  const data = await response.json();
  const text: string = data.content?.[0]?.text ?? '';
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('No JSON in response');
  return JSON.parse(jsonMatch[0]) as EbayListingDraft;
}
