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
  searchQuery: string;
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

  const prompt = `Analysiere dieses Bild und identifiziere den Gegenstand.
Antworte NUR mit einem JSON-Objekt in diesem Format (kein Markdown, kein Text darum):
{
  "name": "vollständiger Produktname",
  "brand": "Marke oder null",
  "model": "Modellnummer oder null",
  "category": "Kategorie (z.B. Elektronik, Spielzeug, Kleidung)",
  "confidence": 0.95,
  "description": "kurze Beschreibung auf Deutsch",
  "searchQuery": "optimierter eBay-Suchbegriff",
  "alternatives": [
    { "name": "alternative Bezeichnung 1", "category": "Kategorie", "confidence": 0.7, "searchQuery": "eBay-Suchbegriff 1" },
    { "name": "alternative Bezeichnung 2", "category": "Kategorie", "confidence": 0.5, "searchQuery": "eBay-Suchbegriff 2" }
  ]
}
Gib immer 2 plausible Alternativen an, auch wenn du sehr sicher bist.`;

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

  const prompt = `Analysiere diese Sammelkarte (Trading Card).
Antworte NUR mit einem JSON-Objekt in diesem Format (kein Markdown):
{
  "game": "pokemon|yugioh|magic|other",
  "name": "Kartenname",
  "setName": "Set-Name oder null",
  "setCode": "Set-Code oder null",
  "cardNumber": "Kartennummer oder null",
  "rarity": "Seltenheit oder null",
  "condition": "mint|near-mint|excellent|good|light-played|played|poor",
  "confidence": 0.95,
  "searchQuery": "optimierter Cardmarket-Suchbegriff"
}`;

  const rawResponse = await callClaude(apiKey, base64, prompt);

  const jsonMatch = rawResponse.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('Claude returned no valid JSON for card');
  }

  const result = JSON.parse(jsonMatch[0]) as ClaudeCardResult;
  return result;
}
