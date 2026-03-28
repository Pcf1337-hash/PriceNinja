# CLAUDE.md — Emio Trade

## Project Overview
**Emio Trade** is a React Native Expo app for scanning items and trading cards, identifying them via AI, and fetching real-time market prices from eBay (sold listings) and Geizhals (cheapest price). Built for Emil — futuristic, anime-ready, smooth.

## Tech Stack
- **Framework:** React Native + Expo SDK 52+ (Expo Router v4, file-based routing)
- **Language:** TypeScript (strict mode)
- **Navigation:** Expo Router with bottom tabs (`(tabs)` layout)
- **Styling:** NativeWind v5 (Tailwind CSS v4) + custom theme system
- **State Management:** Zustand (lightweight, no boilerplate)
- **Local Database:** expo-sqlite for item history, favorites, settings
- **Camera:** expo-camera (photo capture, NOT live stream — cost control)
- **Image Recognition:** Anthropic Claude API (Vision) via REST
- **Price Data:** eBay Browse API (sold/completed items), Geizhals web scraping
- **Trading Cards:** Claude Vision for card identification + TCGPlayer/Cardmarket API for pricing
- **Updates:** GitHub Releases + expo-updates or custom OTA via GitHub
- **CI/CD:** GitHub Actions (Gradle build → APK → Release Asset)

## Architecture Decisions

### Cost Control Strategy (CRITICAL)
- **Photo capture only** — never stream live camera to API. User takes ONE photo, gets ONE API call
- **Local caching** — once an item is identified, cache the result in SQLite. Re-scans of same item use cache first
- **Refresh intervals** — minimum 1 hour for price updates. User can set: 1h, 2h, 6h, 12h, 24h
- **Batch price updates** — update all dashboard items in one scheduled job, not individually
- **Claude API usage** — use `claude-haiku-4-5-20251001` for image recognition (cheapest vision model)
- **Rate limiting** — max 30 scans per hour hardcoded. Display remaining scans to user

### eBay Multi-Account System
- **Zwei Account-Typen:**
  - **Papa eBay** — Dennis' Account, NUR für Preisabfragen (Browse API). Kann KEINE Angebote erstellen. Wird über einen eigenen Button/Toggle in den Settings aktiviert ("Papa eBay verbinden"). Visuell klar gekennzeichnet (z.B. Schloss-Icon, "Nur Preise").
  - **Mein eBay** — Emils eigener Account (wenn er irgendwann einen hat). Kann Preise abfragen UND Angebote erstellen. Voller Funktionsumfang.
- **Rechte-Logik:**
  - Wenn aktiver Account = "Papa eBay" → "Bei eBay verkaufen" Button ist DISABLED/HIDDEN + Hinweis: "Zum Verkaufen brauchst du deinen eigenen eBay-Account"
  - Wenn aktiver Account = "Mein eBay" → Voller Zugriff auf Listing-Funktionen
  - Wenn KEIN Account verbunden → Preisabfrage nicht möglich, nur Claude-Erkennung + Geizhals
- **Account-Wechsel:** In Settings kann zwischen den Accounts gewechselt werden
- **Beide Accounts können gleichzeitig verbunden sein** — der aktive Account wird für API-Calls genutzt
- Theme context with `ThemeProvider` wrapping entire app
- Themes stored as JSON objects with color tokens
- Available themes: **Futuristic Dark** (default), **Futuristic Light**, **Anime Neon**, **Anime Pastel**, **Cyberpunk**, **Minimal Clean**
- Theme selection in Settings tab with live preview
- Each theme defines: `primary`, `secondary`, `accent`, `background`, `surface`, `text`, `border`, `success`, `warning`, `error`, `gradient` colors

### App Structure
```
app/
├── (tabs)/
│   ├── _layout.tsx          # Tab navigator (3 tabs)
│   ├── index.tsx            # Dashboard (tracked items + prices)
│   ├── scan.tsx             # Item Scanner (camera + AI recognition)
│   ├── cards.tsx            # Trading Card Scanner
│   └── settings.tsx         # Settings (themes, intervals, API keys)
├── _layout.tsx              # Root layout (ThemeProvider, fonts, splash)
├── item/[id].tsx            # Item detail view (price history, eBay listing)
├── card/[id].tsx            # Card detail view (price, set info)
└── ebay-wizard/
    ├── _layout.tsx          # Wizard stack layout
    ├── account-type.tsx     # Step 1: Papa eBay oder Mein eBay wählen
    ├── welcome.tsx          # Step 2: Willkommen (typ-spezifisch)
    ├── api-keys.tsx         # Step 3: eBay Developer Keys eingeben
    ├── login.tsx            # Step 4: eBay OAuth Login (WebView)
    └── done.tsx             # Step 5: Bestätigung
src/
├── api/
│   ├── claude.ts            # Claude Vision API calls
│   ├── ebay.ts              # eBay Browse API (sold listings)
│   ├── geizhals.ts          # Geizhals price scraping
│   ├── tcg.ts               # Trading card price APIs
│   └── github-updates.ts   # GitHub release check + update
├── components/
│   ├── ui/                  # Reusable UI components
│   ├── Scanner.tsx          # Camera component with capture
│   ├── ItemCard.tsx         # Dashboard item card
│   ├── TradingCardView.tsx  # Card display component
│   ├── PriceChart.tsx       # Price history visualization
│   └── EbayListingForm.tsx  # eBay listing creator
├── store/
│   ├── useItemStore.ts      # Zustand store for items
│   ├── useCardStore.ts      # Zustand store for trading cards
│   ├── useEbayStore.ts      # Zustand store for eBay accounts (papa/own)
│   └── useSettingsStore.ts  # Zustand store for settings
├── db/
│   ├── schema.ts            # SQLite schema
│   ├── migrations.ts        # DB migrations
│   └── queries.ts           # Typed query functions
├── theme/
│   ├── ThemeContext.tsx      # Theme provider
│   ├── themes.ts            # All theme definitions
│   └── types.ts             # Theme type definitions
├── utils/
│   ├── pricing.ts           # Price calculation helpers
│   ├── cache.ts             # Cache management
│   └── constants.ts         # App-wide constants
└── types/
    ├── item.ts              # Item type definitions
    ├── card.ts              # Trading card types
    └── ebay.ts              # eBay API types
```

## Key Workflows

### Item Scan Flow
1. User opens Scan tab → camera view appears
2. User takes photo → loading indicator
3. Photo sent to Claude Vision API → item identification
4. Show suggestion card: "Ist das ein [Artikelname]?" with image + details
5. User confirms → fetch eBay sold prices (last 5-10) + Geizhals cheapest
6. Display price overview card with breakdown
7. User can: Add to Dashboard / Create eBay Listing (nur mit eigenem Account) / Dismiss

### Trading Card Flow
1. User opens Cards tab → camera view with card frame overlay
2. User places card in frame → takes photo
3. Claude Vision identifies: card name, set, number, condition estimate
4. Fetch current price from TCGPlayer/Cardmarket
5. Display card info + current market value
6. User can: Add to Favorites (➕ button) / View in History
7. History: swipe left to delete, swipe right to edit, pull to refresh

### eBay Setup Wizard (First-Time, in-app)
1. App erkennt: eBay noch nicht eingerichtet → Hinweis in Settings
2. **Step 1 — Account-Typ wählen**: "Papa eBay (nur Preise)" oder "Mein eBay (Preise + Verkaufen)"
3. **Step 2 — Willkommen**: Erklärt was verbunden wird, je nach Typ unterschiedlicher Text
4. **Step 3 — eBay Developer Keys**: User gibt App ID, Cert ID, Client Secret ein (mit Anleitung + Link zur eBay Developer Console). Alternativ: OAuth-Flow direkt in WebView
5. **Step 4 — eBay Login**: OAuth2 Authorization Code Flow in WebView. User loggt sich ein, App erhält Auth-Token
6. **Step 5 — Bestätigung**: "Papa eBay verbunden ✓ (nur Preisabfrage)" bzw. "Mein eBay verbunden ✓"
7. Tokens + Account-Typ werden in expo-secure-store gespeichert
8. Wizard kann für JEDEN Account-Typ separat durchlaufen werden
9. In Settings: Account-Status anzeigen, wechseln, trennen

### eBay Listing Flow (nur mit "Mein eBay")
1. From item detail oder nach Scan → "Bei eBay verkaufen" Button
2. **GUARD**: Wenn aktiver Account = "Papa eBay" → Button disabled, Toast: "Nur mit eigenem eBay-Account möglich"
3. Pre-filled Listing-Formular: Titel, Beschreibung, Kategorie, Preisvorschlag (basierend auf Sold-Daten)
4. Fotos vom Scan automatisch angehängt
5. **Wenn "Mein eBay" verbunden**: Direktes Listing über eBay Sell API erstellen
6. **Wenn KEIN eigener Account**: Copy-Paste Export (formatierter Text + Deep Link zur eBay App/Website)
7. Nach erfolgreichem Listing → Link zum Live-Angebot anzeigen

### GitHub Auto-Update Flow
1. On app start → check GitHub Releases API for latest version
2. Compare with current app version
3. If update available → show update banner with changelog
4. User taps → download APK from GitHub release assets
5. Trigger install via expo-intent-launcher (Android)

## Coding Standards
- **TypeScript strict** — no `any`, no implicit types
- **Functional components only** — no class components
- **Custom hooks** for all business logic — keep components thin
- **Error boundaries** around every major section
- **Skeleton loaders** — never show empty states, always skeleton
- **Haptic feedback** on all interactive elements (expo-haptics)
- **Animations** — use react-native-reanimated for all transitions
- **Accessibility** — every interactive element needs accessibilityLabel

## API Keys & Config
Store in `.env` (never commit):
```
CLAUDE_API_KEY=sk-ant-...
EBAY_APP_ID=...
EBAY_CERT_ID=...
EBAY_CLIENT_SECRET=...
GITHUB_TOKEN=... (optional, for higher rate limits)
```

## Build & Test
```bash
npx expo start                    # Dev server
npx expo run:android              # Gradle build + run on emulator
cd android && ./gradlew assembleRelease   # Release APK build
cd android && ./gradlew assembleDebug     # Debug APK build
```

### Emulator
- User hat einen Android-Emulator installiert und konfiguriert
- IMMER den Emulator nutzen zum Testen während der Entwicklung
- `npx expo run:android` startet automatisch auf dem verfügbaren Emulator
- Vor jedem Feature-Abschluss: auf dem Emulator testen und verifizieren
- KEIN EAS Build — alles lokal über Gradle

## Important Rules
1. **NEVER** make API calls on component mount without user action (cost!)
2. **ALWAYS** check cache before making external API calls
3. **ALWAYS** show cost indicator to user (remaining scans today)
4. **NEVER** store API keys in code — always .env
5. **ALWAYS** handle offline gracefully — show cached data
6. Test on Android Emulator after EVERY feature — `npx expo run:android`
7. Target: `arm64-v8a` (gängigste Android-Architektur), aber universal APK ist auch ok
8. Minimum Android API level: 24 (Android 7.0)
9. **NUR Gradle builds** — kein EAS, kein Cloud-Build
10. eBay-Verbindung wird komplett in-app über Wizard gelöst — kein externes Setup
11. **Papa eBay = NUR Preisabfrage** — Listing-Funktionen MÜSSEN blockiert sein wenn Papa-Account aktiv
12. App-Größe ist egal — Funktionalität und UX haben Vorrang
