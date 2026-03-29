# PriceNinja

Eine React Native / Expo App für Android, die Gegenstände und Sammelkarten per Kamera scannt, via KI identifiziert und Echtzeit-Marktpreise abruft.

---

## Was die App macht

**LootScan (Produkt-Scanner)**
Foto aufnehmen → Claude KI identifiziert das Produkt → eBay zeigt tatsächliche Verkaufspreise der letzten Tage → Geizhals zeigt günstigsten aktuellen Neupreis. Der Nutzer kann den erkannten Namen korrigieren und das Produkt zum Dashboard hinzufügen, wo Preise automatisch aktualisiert werden.

**CardScan (Karten-Scanner)**
Kamera hält eine Sammelkarte (Pokémon, Yu-Gi-Oh!, Magic) ins Bild → On-Device OCR versucht die Karte anhand von Text und Kartennummer zu identifizieren → bei Erfolg werden Preise von Cardmarket und TCGPlayer geladen → bei Misserfolg übernimmt Claude Vision. Karten werden mit Foto, Set-Infos und Preisen in einer Sammlung gespeichert.

---

## Tech Stack

| Bereich | Technologie |
|---------|-------------|
| Framework | React Native + Expo SDK 52, Expo Router v4 |
| Sprache | TypeScript (strict) |
| Styling | NativeWind v5 (Tailwind CSS v4) |
| State | Zustand + AsyncStorage (persist) |
| Datenbank | expo-sqlite (Schema vorhanden, Hauptpersistenz via AsyncStorage) |
| Kamera | expo-camera (Einzelfoto, kein Live-Stream) |
| OCR | @react-native-ml-kit/text-recognition (on-device, kostenlos) |
| KI Vision | Anthropic Claude API (claude-haiku-4-5-20251001) |
| Preise (Produkte) | eBay Browse API + Geizhals Web Scraping |
| Preise (Karten) | Pokémon TCG API, Scryfall, YGOPRODeck, Cardmarket Scraping |
| Updates | GitHub Releases API + expo-intent-launcher |

---

## App-Struktur

```
app/
├── (tabs)/
│   ├── index.tsx          Dashboard — verfolgte Artikel mit Preisen
│   ├── scan.tsx           LootScan — Produkt-Scanner (Tab-Route nach Chooser)
│   ├── cards.tsx          CardScan — Karten-Scanner
│   └── settings.tsx       Einstellungen (Themes, API-Keys, eBay)
├── scan.tsx               LootScan Screen (Modal)
├── item/[id].tsx          Artikel-Detailseite
├── card/[id].tsx          Karten-Detailseite
└── ebay-wizard/           eBay Account Setup Wizard (5 Schritte)

src/
├── api/
│   ├── claude.ts          Claude Vision — Produkt- und Karten-Erkennung
│   ├── cardOcr.ts         ML Kit OCR + freie Karten-APIs (Tier 1)
│   ├── tcg.ts             Karten-Preisabfrage (Pokemon/MTG/YGO/Cardmarket)
│   ├── ebay.ts            eBay OAuth2 + Browse API
│   └── geizhals.ts        Geizhals HTML Scraping
├── store/
│   ├── useItemStore.ts    Produkte (persist)
│   ├── useCardStore.ts    Karten (persist)
│   ├── useEbayStore.ts    eBay Accounts (Papa / Eigener)
│   └── useSettingsStore.ts Einstellungen (API-Key, Währung, Scan-Stats)
├── db/
│   ├── schema.ts          SQLite Tabellen (items, trading_cards, price_history)
│   └── queries.ts         Typisierte Query-Funktionen
├── theme/
│   ├── themes.ts          7 Themes (futuristic-dark, anime-neon, cyberpunk…)
│   └── ThemeContext.tsx   Theme Provider
└── utils/
    ├── constants.ts       APP_VERSION, API-URLs, Limits
    ├── pricing.ts         formatPrice(), calculatePriceStats(), priceTrend()
    └── cache.ts           AsyncStorage Cache mit TTL
```

---

## Haupt-Abläufe

### LootScan
1. Kamera öffnen (oder Textsuche)
2. Foto → komprimieren (1024px, JPEG 0.7) → Claude Haiku Vision
3. Produkt-Name/-Kategorie/-Confidence zurück (JSON)
4. User bestätigt oder korrigiert
5. eBay Browse API (`searchQuery`, 10 Verkäufe) + Geizhals HTML
6. Preise anzeigen (eBay Ø, Spanne, letzte Verkäufe, Geizhals Neupreis)
7. Optional: zum Dashboard hinzufügen

### CardScan
1. Kamera startet OCR-Loop (alle 1,5s ein Foto)
2. ML Kit OCR → Text → Spielerkennung → Kartennummer → API-Lookup
3. Bei Confidence ≥ 0.70: Karte erkannt (kostenlos)
4. Bei < 0.70 oder nach 6 Fehlversuchen: manueller Claude-Scan
5. Karte bestätigen → Preise laden (TCG APIs + Cardmarket)
6. In Sammlung speichern

### eBay Account System
- **Papa eBay:** Nur Preisabfrage, kein Listing erstellen
- **Mein eBay:** Voller Zugriff (Preise + Verkaufen)
- Setup über In-App-Wizard (OAuth2 Authorization Code Flow)

### Auto-Update
- App-Start → GitHub Releases API → neueste Version prüfen
- Wenn neuer als `APP_VERSION` (constants.ts): Update-Banner
- APK von GitHub Release Assets herunterladen + installieren (expo-intent-launcher)

---

## eBay Account-Typen

| Typ | Preisabfrage | Listings erstellen |
|-----|-------------|-------------------|
| Papa eBay | ✅ | ❌ (blockiert) |
| Mein eBay | ✅ | ✅ |
| Kein Account | ❌ | ❌ |

---

## Kosten-Kontrolle

- Nur Einzelfotos, kein Live-Stream zur API
- Max. 30 Scans/Stunde (hardcoded)
- Cache für alle Preisabfragen: 1 Stunde
- Tier-1 OCR ist kostenlos (on-device ML Kit)
- Claude-Scans nur als Fallback (CardScan) oder auf Auslöser (LootScan)
- Modell: Haiku (günstigste Vision-Option)

---

## Build

```bash
npx expo start                           # Dev-Server
npx expo run:android                     # Debug auf Emulator
cd android && ./gradlew assembleRelease  # Release APK
```

Target: Android 7.0+ (API 24), Architekturen: arm64-v8a, armeabi-v7a, x86_64
Kein EAS — alles lokal über Gradle.
