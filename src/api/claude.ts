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
}

export interface ClaudeCardResult {
  game: 'pokemon' | 'yugioh' | 'magic' | 'other';
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

  const prompt = `Du bist ein Experte für Produkterkennung. Analysiere dieses Bild systematisch.

SCHRITT 1 - Beobachte: Was siehst du genau?
- Welche Texte, Logos, Markennamen sind sichtbar?
- Welche Modellnummern oder Produktcodes erkennst du?
- Welche physischen Merkmale (Farbe, Form, Größe, Material)?

SCHRITT 2 - Identifiziere: Basiere die Identifikation NUR auf den Beobachtungen aus Schritt 1. Erfinde keine Details.

SCHRITT 3 - Erstelle Suchanfragen:
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
  ]
}
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

IMPORTANT RULES:
1. Read the card number printed at the BOTTOM of the card (e.g. "006/165", "025/102", "SWSH045"). This is the most reliable identifier.
2. Read the set name/logo printed at the bottom or near the card number.
3. If the card is in a non-English language (German: "Glurak"=Charizard, French, Spanish, etc.), return the ENGLISH name in the "name" field for database lookups. Put the localized name in "localName".
4. For Pokémon: The card number like "006/165" means card #6 of 165 cards in that set.
5. Look very carefully at the actual card name at the TOP — do not confuse artwork with card identity.

Common German→English Pokémon names: Glurak=Charizard, Bisaflor=Venusaur, Turtok=Blastoise, Pikachu=Pikachu, Arktos=Articuno, Zapdos=Zapdos, Lavados=Moltres, Mewtwo=Mewtwo, Mew=Mew, Sonambaule=Hypno, Dragoran=Dragonite, Raupy=Caterpie, Gengar=Gengar, Relaxo=Snorlax, Glumanda=Charmander, Glutexo=Charmeleon, Schiggy=Squirtle, Bisasam=Bulbasaur.

Respond ONLY with this JSON (no markdown, no extra text):
{
  "game": "pokemon",
  "name": "ENGLISH card name (for API lookup)",
  "localName": "name as printed on card if non-English, else null",
  "setName": "full set name as printed on card, or null",
  "setCode": "set code/ID (e.g. 'sv3', 'base1', 'swsh12'), or null",
  "cardNumber": "card number EXACTLY as printed (e.g. '006/165'), or null",
  "rarity": "Common|Uncommon|Rare|Rare Holo|Ultra Rare|Secret Rare|etc, or null",
  "condition": "M|NM|LP|MP|HP",
  "confidence": 0.95,
  "searchQuery": "English name + set for Cardmarket search"
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
