# CardScan — Karten-Scanner Dokumentation

## Übersicht

Der CardScan identifiziert Sammelkarten (Pokémon, Yu-Gi-Oh!, Magic: The Gathering) und ruft aktuelle Marktpreise von Cardmarket und TCGPlayer ab. Es gibt zwei unabhängige Erkennungs-Stufen: OCR (kostenlos, offline-fähig) als Tier 1, Claude Vision als Tier 2 Fallback.

---

## Erkennungs-Architektur

```
Kamera-Stream (alle 1,5 Sekunden ein Foto)
        │
        ▼
┌───────────────────────────────────────────┐
│  TIER 1: On-Device OCR (ML Kit)           │
│  Bibliothek: @react-native-ml-kit/text-recognition  │
│  Kosten: $0 — läuft lokal auf dem Gerät   │
└───────────────────┬───────────────────────┘
                    │
         ┌──────────┴──────────┐
         │                     │
    OCR Text                OCR fehlgeschlagen
    vorhanden               oder < 2 Zeilen
         │                     │
         ▼                     │
  [Game-Erkennung]             │
  Sprachregeln für             │
  EN + DE + FR + ES            │
         │                     │
    ┌────┴────┐                │
    │         │                │
  Spiel      Kein Spiel        │
  erkannt    erkannt           │
    │             └────────────┤
    ▼                          │
  [Karten-Name                 │
   extrahieren]                │
   (erste sinnvolle Zeile)     │
    │                          │
    ▼                          │
  [Kartennummer                │
   extrahieren]                │
   z.B. "006/165"              │
    │                          │
    ▼                          │
  [API-Lookup]                 │
  Pokemon TCG API /            │
  Scryfall / YGOPRODeck        │
    │                          │
    ├─ Treffer (conf ≥ 0.70)   │
    │   → OCR+DB Ergebnis      │
    │   → Scan-Loop stoppt     │
    │                          │
    └─ Kein Treffer            │
        (conf = 0.55)          │
        → unterhalb Threshold  │
        → weiter zu Tier 2 ────┘
                    │
                    ▼
┌───────────────────────────────────────────┐
│  TIER 2: Claude Vision (manueller Auslöser│
│  oder nach OCR-Fail ≥ 6 Versuche)        │
│  Modell: claude-haiku-4-5-20251001        │
│  Kosten: ~$0.0003–0.0008 pro Scan        │
└───────────────────┬───────────────────────┘
                    │
                    ▼
           [Claude identifiziert]
           Englischer Name (für API)
           + lokaler Name (Glurak etc.)
           + Kartennummer von der Karte
           + Set-Name + Set-Code
           + Seltenheit
           + Zustand (M/NM/LP/MP/HP)
                    │
                    ▼
           [Bestätigungs-Screen]
           User bestätigt oder verwirft
                    │
                    ▼
           [Karte speichern]
           → fetchCardPrice() für Preise
           → TradingCard in Store + AsyncStorage
```

---

## Tier 1: OCR-Erkennung

### `src/api/cardOcr.ts`

#### Schritt 1: Game-Erkennung (`detectGame`)

Regelbasiert anhand von Schlüsselwörtern im OCR-Text:

**Pokémon (EN):** `hp` + (`weakness` | `retreat` | `pokémon`), `basic pokémon`, `stage 1/2`
**Pokémon (DE):** `kp` + (`schwäche` | `rückzug`), `basis-pokémon`, `phase 1/2`
**Pokémon (generisch):** `pokémon` anywhere + Kartennummern-Muster `\d+/\d+`
**Yu-Gi-Oh! (EN/DE):** `effect monster`, `spell card`, `effektmonster`, Kartencode `SDMA-DE001`
**Magic (EN/DE):** `enchantment`, `creature —`, `instant`, `sorcery`, `verzauberung`

**Problem:** Karten in Fremdsprachen (JP, KR, CN) werden nicht erkannt → fallen durch zu Claude.

#### Schritt 2: Namens-Extraktion (`extractCardName`)

Nimmt die erste Zeile des OCR-Texts, die:
- ≥ 3 Zeichen hat
- keine reine Zahl ist
- nicht mit `HP 250` / `KP 250` anfängt

**Problem:** Bei schlechter Bildqualität oder gedrehten Karten steht der Name nicht in der ersten Zeile.

#### Schritt 3: Kartennummer-Extraktion (`extractCardNumber`)

- **Pokémon:** Regex `\d{1,3}/\d{1,3}` → z.B. `006/165`
- **Yu-Gi-Oh!:** Regex `[A-Z]{2,6}-[A-Z]{2,3}\d{3}` → z.B. `LCKC-DE036`
- **Magic:** Regex `\d{1,3}/\d{1,3}` → z.B. `123/300`

#### Schritt 4: API-Lookup

**Pokémon:**
- Strategie 1 (bevorzugt): Suche nach Kartennummer `number:6` → sprachunabhängig
- Strategie 2 (Fallback): Suche nach Name `name:"Charizard"`
- API: `https://api.pokemontcg.io/v2/cards`
- Kein API-Key nötig (kostenlos, Rate Limit: 1000 req/Tag ohne Key)

**Magic:**
- API: `https://api.scryfall.com/cards/named?fuzzy={name}`
- Kein API-Key nötig

**Yu-Gi-Oh!:**
- API: `https://db.ygoprodeck.com/api/v7/cardinfo.php?fname={name}`
- Kein API-Key nötig

#### Confidence-Schwelle

| Quelle | Confidence | Wird akzeptiert? |
|--------|-----------|-----------------|
| OCR + API-Treffer (Nummer) | 0.93 | ✅ ja (≥ 0.70) |
| OCR + API-Treffer (Name) | 0.85–0.92 | ✅ ja |
| OCR + API kein Treffer | 0.55 | ❌ nein → Claude |
| Keine Spielerkennung | — | ❌ nein → Claude |

#### OCR-Loop Konfiguration

| Parameter | Wert | Datei |
|-----------|------|-------|
| `OCR_INTERVAL_MS` | 1500ms | `cards.tsx` |
| `OCR_FAIL_THRESHOLD` | 6 Versuche | `cards.tsx` |
| `OCR_MIN_CONFIDENCE` | 0.70 | `cards.tsx` |
| Fotoqualität im Loop | 0.4 (niedrig) | `cards.tsx` |

---

## Tier 2: Claude Vision Fallback

### `src/api/claude.ts` — `identifyCard()`

Wird ausgelöst durch:
1. Manuellen Kamera-Auslöser (Capture-Button)
2. Nach 6 fehlgeschlagenen OCR-Versuchen → Button erscheint

**Bild-Komprimierung:** resize auf 1024px, JPEG quality 0.7, dann base64

**Prompt enthält:**
- Anweisung zur Kartennummer am unteren Rand
- Deutsch→Englisch Namenstabelle (20 häufigste Pokémon)
- Regel: Englischen Namen zurückgeben (Glurak → Charizard)
- Condition-Mapping: `M|NM|LP|MP|HP`
- Ausgabeformat: JSON mit `name`, `localName`, `setName`, `setCode`, `cardNumber`, `rarity`, `condition`, `confidence`, `searchQuery`

**Parsing:** Regex `{...}` extrahiert JSON aus Claude-Antwort

**Bekannte Schwächen des Prompts:**
- Claude sieht das Bild, hat aber keinen Zugang zur Pokémon-Datenbank → halluziniert Set-Codes manchmal
- Bei beschädigten oder teilweise verdeckten Karten sinkt die Treffsicherheit deutlich
- Doppelter Scan nötig: Claude identifiziert die Karte, danach ruft `fetchCardPrice()` die API auf — zwei separate Netzwerke-Anfragen

---

## Preisabfrage

### `src/api/tcg.ts` — `fetchCardPrice()`

Wird nach dem Speichern der Karte aufgerufen. Gibt `CardPrices` zurück.

**Strategie (Priorität):**

| Priorität | Spiel | Quelle | Daten |
|-----------|-------|--------|-------|
| 1 | Pokémon | Pokémon TCG API | Cardmarket low/avg/trend + TCGPlayer low/market |
| 1 | Magic | Scryfall | EUR + USD Preise |
| 1 | Yu-Gi-Oh! | YGOPRODeck | Cardmarket + TCGPlayer |
| 2 (Fallback) | Alle | Cardmarket HTML Scraping | low/mid/trend via Regex |

**Cache:** 1 Stunde (AsyncStorage, Key: `prices_{game}_{name}_{setCode}_{cardNumber}`)

**Cardmarket-Scraping (Fallback):**
- URL: `https://www.cardmarket.com/de/{Spiel}/Products/Search?searchString={name}`
- Parst `€` Preise via Regex `\d+[.,]\d+\s*€`
- Sortiert gefundene Preise, gibt low/mid/trend zurück
- **Sehr fehleranfällig:** Kein offizielles API

---

## Datenpersistenz

Karten werden in **Zustand + AsyncStorage** gespeichert (`priceninja-cards`).

```typescript
TradingCard {
  id: string           // UUID
  game: 'pokemon' | 'yugioh' | 'magic' | 'other'
  name: string         // englischer Name (für API)
  setName?: string
  setCode?: string
  cardNumber?: string  // z.B. "006/165"
  rarity?: string
  condition?: 'M'|'NM'|'LP'|'MP'|'HP'
  imageUri: string     // lokaler Pfad zum Foto
  isFavorite: boolean
  scannedAt: string    // ISO Datum
  prices?: CardPrices  // Markpreise
}
```

SQLite-Schema (`trading_cards` Tabelle) ist vorhanden und vollständig definiert, wird aber aktuell **nicht aktiv genutzt** — die App schreibt und liest über AsyncStorage-Persist.

---

## Bekannte Schwächen / Probleme

### OCR-Erkennung

| Problem | Ursache | Schweregrad |
|---------|---------|-------------|
| Deutsche Karten wurden nicht erkannt | Fehlende DE-Keywords in `detectGame()` | **behoben in v1.1.2** |
| Japanische/Koreanische/Chinesische Karten | Keine CJK-Zeichenerkennung in Regeln | hoch |
| Namens-Extraktion unzuverlässig | Erste Zeile ist manchmal HP-Wert oder Set-Logo | mittel |
| API Rate Limit Pokémon TCG API | 1000 Anfragen/Tag ohne Key, 20000/Tag mit Key | mittel |
| Kartennummer-Regex zu eng | z.B. keine Promo-Karten (SWSH045) erkannt | niedrig |

### Claude-Erkennung

| Problem | Ursache | Schweregrad |
|---------|---------|-------------|
| Falsche Karte erkannt (Giratina statt Glurak) | Prompt kannte keine DE→EN Übersetzung | **behoben in v1.1.2** |
| Set-Code halluziniert | Claude hat keinen echten Datenbankzugang | mittel |
| Kartennummer null | Prompt las Kartennummer nicht explizit | **behoben in v1.1.2** |
| Condition-Format falsch | Prompt gab `near-mint` statt `NM` zurück | **behoben in v1.1.2** |
| Falsche Rarity bei Spezialkarten (Rainbow, Alt Art) | Komplexe Rarity-Namen nicht im Prompt | niedrig |

### Preisabfrage

| Problem | Ursache | Schweregrad |
|---------|---------|-------------|
| Cardmarket-Scraping instabil | Kein offizielles API, HTML kann sich ändern | hoch |
| Keine Preishistorie für Karten | Nur ein Preis-Snapshot, kein Chart | mittel |
| TCGPlayer-Preise in USD | Keine Währungskonvertierung | niedrig |

### UX

| Problem | Ursache | Schweregrad |
|---------|---------|-------------|
| OCR-Loop läuft während der ganzen Session | Kein automatischer Stop nach Erfolg | mittel |
| Kein Hinweis welche Seite der Karte zu scannen | UI zeigt nur einen Rahmen | niedrig |
| Condition wird geschätzt, nicht abgefragt | Claude schätzt aus Bildrauschen | niedrig |

---

## Nicht implementiert (geplant)

- Pokémon TCG API Key für höheres Rate Limit
- Cardmarket offizielle API (benötigt Genehmigung)
- Preishistorie / Preischart für Karten
- Japanische / koreanische Karten-Erkennung
- Barcode-Scan als schnellerer Identifikationsweg
- Set-Auswahl manuell anpassbar
