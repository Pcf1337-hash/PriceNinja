# LootScan — Produkt-Scanner Dokumentation

## Übersicht

Der LootScan ist der Artikel-/Produkt-Scanner in PriceNinja. Ziel: Ein Foto eines beliebigen Gegenstands aufnehmen → KI identifiziert das Produkt → Marktpreise von eBay (tatsächliche Verkäufe) und Geizhals (Neupreis) werden abgerufen.

---

## Ablaufdiagramm

```
Benutzer öffnet Scan-Screen
        │
        ▼
  ┌─────────────┐        ┌──────────────────┐
  │ Kamera-Modus│        │  Textsuche-Modus  │
  │ Foto aufneh-│        │  (Name eingeben)  │
  │    men      │        └────────┬─────────┘
  └──────┬──────┘                 │
         │                        │ überspringt Claude
         ▼                        │
  [Rate-Limit prüfen]             │
  max. 30 Scans/Stunde            │
         │                        │
         ▼                        │
  [Bild komprimieren]             │
  resize → 1024px max             │
  JPEG quality: 0.7               │
         │                        │
         ▼                        │
  [Claude Haiku Vision]           │
  API: claude-haiku-4-5-20251001  │
  max_tokens: 1024                │
  Prompt: Deutsch, JSON-Format    │
         │                        │
         ▼                        ▼
  [Ergebnis: ClaudeItemResult]────────────────────▶
         │
         ├── name (Produktname)
         ├── brand / model
         ├── category
         ├── confidence (0–1)
         ├── description
         ├── searchQuery (optimiert für eBay)
         └── alternatives[] (2 Alternativen)
         │
         ▼
  [Bestätigungs-Screen]
  User kann Name/SearchQuery editieren
  User wählt ggf. Alternative
         │
         ▼
  [Preisabfrage parallel]
         ├── eBay Browse API (sold listings)
         │       └── fetchSoldListings(account, searchQuery, 10)
         │               → bis zu 10 abgeschlossene Verkäufe
         │               → min/avg/max berechnet
         │
         └── Geizhals Web Scraping
                 └── fetchGeizhalsPrice(searchQuery)
                         → HTML fetch geizhals.de
                         → JSON-LD → itemprop → Regex-Fallback
         │
         ▼
  [prices-ready Screen]
         ├── Side-by-Side: eBay Ø vs Geizhals Neupreis
         ├── Preisspanne-Balken (Min/Ø/Max)
         └── Letzte Verkäufe (bis 6 Einträge)
         │
         ▼
  [Zum Dashboard hinzufügen]
         └── TrackedItem in Zustand + AsyncStorage gespeichert
             + erster PriceHistory-Eintrag
```

---

## Komponenten

### `app/scan.tsx`
Der komplette Screen. Verwaltet folgende States:
- `idle` — Kamera oder Textsuche sichtbar
- `scanning` — Claude API-Call läuft
- `confirming` — Ergebnis editierbar, Alternativen wählbar
- `fetching-prices` — eBay + Geizhals werden abgefragt
- `prices-ready` — Ergebnisse sichtbar, Aktionen verfügbar

### `src/api/claude.ts` — `identifyItem()`
- Komprimiert Bild mit `expo-image-manipulator` (resize + JPEG)
- Sendet base64-Bild + Prompt an Claude API
- Parst JSON-Antwort mit Regex `{...}` Extraktion
- Rückgabe: `ClaudeItemResult`

**Prompt-Sprache:** Deutsch
**Modell:** `claude-haiku-4-5-20251001`
**Kosten:** ~$0.0002–0.0005 pro Scan (Haiku-Tarif)

### `src/api/ebay.ts` — `fetchSoldListings()`
- Nutzt eBay Browse API (OAuth2 Token)
- Filter: `buyingOptions:FIXED_PRICE`, `itemGroupType:SINGLE_ITEM`
- Suche in completed/sold listings
- Limit: 10 Einträge
- Gibt `EbaySoldListing[]` zurück mit title, price, soldDate, condition

**Voraussetzung:** Papa-eBay oder eigener eBay-Account verbunden

### `src/api/geizhals.ts` — `fetchGeizhalsPrice()`
- HTTP GET `geizhals.de/?fs={query}&in=&bl=1&v=e`
- Parsing-Strategie (Priorität):
  1. JSON-LD structured data (`<script type="application/ld+json">`)
  2. `itemprop="price"` Schema.org Markup
  3. `ab € X,XX` Regex-Pattern
  4. Fallback: alle €-Preise sammeln, erstes Quartil
- Cache: 1 Stunde (AsyncStorage)

### `src/utils/pricing.ts` — `calculatePriceStats()`
- Berechnet min/avg/max aus `EbaySoldListing[]`
- Filtert Ausreißer nicht (wird roh angezeigt)

---

## Konfiguration

| Konstante | Wert | Datei |
|-----------|------|-------|
| `SCAN_RATE_LIMIT` | 30/Stunde | `constants.ts` |
| `IMAGE_MAX_WIDTH` | 1024px | `constants.ts` |
| `IMAGE_QUALITY` | 0.7 | `constants.ts` |
| `CLAUDE_MODEL` | `claude-haiku-4-5-20251001` | `constants.ts` |
| `CLAUDE_MAX_TOKENS` | 1024 | `constants.ts` |
| `PRICE_CACHE_MIN_AGE` | 1 Stunde | `constants.ts` |

---

## Bekannte Schwächen / Probleme

### Identifikation
- **Kein Kontext-Limit im Prompt:** Claude bekommt kein Feedback ob eine vorherige Identifikation falsch war
- **searchQuery nicht immer optimal:** Claude generiert den eBay-Suchbegriff selbst — bei unbekannten Marken kann dieser zu weit oder zu eng sein
- **Confidence-Wert ungeprüft:** Der von Claude zurückgegebene Confidence-Wert (0–1) ist selbst-eingeschätzt und nicht durch einen zweiten Algorithmus validiert
- **Kein Barcode-Scan:** QR-/Barcodes werden nicht erkannt — rein visuelle KI-Erkennung
- **Kategorie-Mapping:** Die Kategorie wird frei formuliert von Claude zurückgegeben, nicht aus einem festen Katalog gewählt

### Preisabfrage eBay
- **eBay-Account Pflicht:** Ohne verbundenen Account keine eBay-Preise
- **Token-Refresh:** OAuth2 Token läuft nach 2 Stunden ab — Refresh-Logik vorhanden, aber bei gleichzeitigen Requests nicht race-condition-safe
- **Suchqualität:** Der `searchQuery` von Claude wird unverändert an eBay übergeben — keine Preprocessing (z.B. Einheiten, Modellnummern)
- **Nur abgeschlossene Verkäufe:** Aktive Listings werden nicht abgefragt
- **Markt:** Nur DE/AT eBay (marketplace ID `EBAY_DE`)

### Preisabfrage Geizhals
- **Web Scraping:** Keine offizielle API — HTML-Parsing bricht bei Layout-Änderungen
- **Bot-Detection:** Geizhals kann den mobilen User-Agent blockieren
- **Erste Quartil-Heuristik:** Preis-Extraktion aus Rohtext ist fehleranfällig bei Produkten mit vielen Varianten (z.B. RAM mit verschiedenen Kapazitäten)
- **Nur DACH-Preise:** Geizhals ist auf Deutschland/Österreich/Schweiz begrenzt

### UX
- **Keine Offline-Fallback-Anzeige:** Wenn kein Internet vorhanden, zeigt die App nur "Fehler"
- **Kein Bild in Textsuche-Modus:** Textsuche erzeugt kein Produktbild
- **Kein direkter eBay-Link** zu den gefundenen Listings (nur Preis + Titel)

---

## Datenpersistenz

Gescannte Artikel werden in **Zustand + AsyncStorage** gespeichert (`priceninja-items`).
Preishistorie wird als Array `PricePoint[]` im Item gespeichert (max. 30 Einträge).
SQLite-Schema für Items existiert (`trading_cards`, `items`-Tabellen), wird aber für Items aktuell **nicht** aktiv genutzt — AsyncStorage-Persist ist der aktive Mechanismus.
