# Emio Trade — TODO

## Phase 0: Project Setup
- [ ] Initialize Expo project with TypeScript template
- [ ] Set up Expo Router v4 with tab navigation
- [ ] Configure NativeWind v5 (Tailwind CSS)
- [ ] Set up Zustand stores (items, cards, settings)
- [ ] Set up expo-sqlite with schema + migrations
- [ ] Create `.env` template with all required keys
- [ ] Run `npx expo run:android` → Gradle prebuild + verify Emulator läuft
- [ ] Initialize GitHub repo + .gitignore
- [ ] Create README.md with project description + screenshots placeholder
- [ ] Set up GitHub Actions workflow for Gradle APK builds
- [ ] Configure app.config.ts (name, icons, splash, versioning)

## Phase 1: Theme System
- [ ] Define theme type interface (colors, fonts, spacing, radius)
- [ ] Create ThemeContext + ThemeProvider
- [ ] Implement 6 themes:
  - [ ] Futuristic Dark (default)
  - [ ] Futuristic Light
  - [ ] Anime Neon (leuchtende Farben, Glow-Effekte)
  - [ ] Anime Pastel (weiche Farben, kawaii-style)
  - [ ] Cyberpunk (neon on dark, glitch-style accents)
  - [ ] Minimal Clean
- [ ] Theme persistence in AsyncStorage
- [ ] Theme preview in Settings
- [ ] Smooth theme transition animations

## Phase 2: Camera & Item Scanner
- [ ] Integrate expo-camera with photo capture
- [ ] Build Scanner component with capture button + flash toggle
- [ ] Implement Claude Vision API integration
  - [ ] Photo → base64 conversion
  - [ ] API call to claude-haiku-4-5 with vision
  - [ ] Parse response → extract item name, brand, model, category
- [ ] Build confirmation dialog ("Ist das ein [Artikel]?")
  - [ ] Show identified item with confidence
  - [ ] Allow manual correction of item name
  - [ ] Confirm / Retry / Cancel actions
- [ ] Implement scan rate limiter (max 30/hour)
- [ ] Show remaining scans counter in UI
- [ ] Add scan sound effect + haptic feedback

## Phase 3: Price Fetching
- [ ] **eBay Integration**
  - [ ] Set up eBay Browse API OAuth flow
  - [ ] Fetch completed/sold listings (last 5-10 sales)
  - [ ] Parse sold prices with dates
  - [ ] Calculate average, min, max sold price
  - [ ] Display price breakdown card
- [ ] **Geizhals Integration**
  - [ ] Research Geizhals API/scraping approach
  - [ ] Implement price fetching (cheapest offer)
  - [ ] Handle product matching (search → best match)
  - [ ] Display cheapest new price
- [ ] **Price Comparison View**
  - [ ] Side-by-side: eBay sold avg vs Geizhals cheapest
  - [ ] Price trend indicator (↑↓→)
  - [ ] "Empfohlener Verkaufspreis" calculation

## Phase 4: Dashboard
- [ ] Build Dashboard tab (main screen)
- [ ] Item card component with:
  - [ ] Product image (from scan)
  - [ ] Product name
  - [ ] Current eBay avg price
  - [ ] Geizhals cheapest price
  - [ ] Last updated timestamp
  - [ ] Price trend indicator
- [ ] Add item to dashboard after scan confirmation
- [ ] Remove item (swipe to delete with confirmation)
- [ ] Pull-to-refresh all prices
- [ ] Background price refresh based on interval setting
- [ ] Refresh interval selector per item: 1h, 2h, 6h, 12h, 24h
- [ ] Sort options: by price, by date added, by name
- [ ] Search/filter functionality
- [ ] Empty state with onboarding hint

## Phase 5: eBay Multi-Account System + Wizard
- [ ] **Account-Typ-System**
  - [ ] Datenmodell: `EbayAccount { type: 'papa' | 'own', tokens, username, connectedAt }`
  - [ ] Zustand Store: `useEbayStore` mit aktiver Account-Verwaltung
  - [ ] Rechte-Guard Hook: `useEbayPermissions()` → `{ canLookupPrices, canCreateListings }`
  - [ ] Papa-Account: `canLookupPrices: true, canCreateListings: false`
  - [ ] Eigener Account: `canLookupPrices: true, canCreateListings: true`
- [ ] **eBay Setup Wizard (in-app)**
  - [ ] Wizard-Route erstellen: `app/ebay-wizard/`
  - [ ] Step 1 — Account-Typ: "Papa eBay (nur Preise)" / "Mein eBay (Preise + Verkaufen)"
    - [ ] Klare visuelle Unterscheidung (Icons, Farben, Beschreibung)
  - [ ] Step 2 — Willkommen: Typ-spezifischer Text
    - [ ] Papa: "Du verbindest Papas eBay-Account. Damit kannst du Preise checken."
    - [ ] Eigener: "Verbinde deinen eigenen Account für Preise und Verkäufe."
  - [ ] Step 3 — API Keys: Input-Felder für App ID, Cert ID, Client Secret
    - [ ] Link/Anleitung zur eBay Developer Console
    - [ ] Validierung der eingegebenen Keys (Test-Call)
  - [ ] Step 4 — eBay Login: OAuth2 Flow in WebView
    - [ ] Authorization Code Flow implementieren
    - [ ] Token + Refresh-Token empfangen
  - [ ] Step 5 — Bestätigung: "Papa eBay verbunden ✓ (nur Preisabfrage)" bzw. "Mein eBay verbunden ✓"
  - [ ] Tokens + Typ sicher speichern (expo-secure-store)
  - [ ] Auto-Token-Refresh im Hintergrund (eBay Tokens laufen nach 2h ab)
- [ ] **Settings: Account-Verwaltung**
  - [ ] Status beider Accounts anzeigen (verbunden/nicht verbunden)
  - [ ] Aktiven Account wechseln (Toggle/Switch)
  - [ ] "Papa eBay verbinden" / "Mein eBay verbinden" Buttons
  - [ ] Account trennen mit Bestätigungs-Dialog
  - [ ] Papa-Account: Schloss-Icon + Label "Nur Preise"
- [ ] **eBay Listing erstellen (NUR mit eigenem Account)**
  - [ ] Guard: Bei Papa-Account → Button disabled + Hinweis-Toast
  - [ ] Pre-filled Formular aus Scan-Daten
  - [ ] Kategorie-Auswahl (auto-suggested via eBay API)
  - [ ] Preisvorschlag basierend auf Sold-Daten
  - [ ] Foto-Anhänge vom Scan
  - [ ] Submit via eBay Sell API
  - [ ] Bestätigung + Link zum Live-Listing
- [ ] **Fallback (kein eigener Account)**
  - [ ] Formatierter Listing-Text generieren
  - [ ] Copy-to-Clipboard Button
  - [ ] Deep Link zur eBay App/Website
- [ ] Emulator-Test: Beide Account-Typen durchspielen, Rechte-Guards verifizieren

## Phase 6: Trading Card Scanner
- [ ] Build Cards tab with camera view
- [ ] Card frame overlay (guide rectangle)
- [ ] Claude Vision card identification:
  - [ ] Card name, set, number
  - [ ] Game detection (Pokémon, Yu-Gi-Oh!, Magic, etc.)
  - [ ] Condition estimate (if visible)
- [ ] Price fetching:
  - [ ] TCGPlayer API integration (US prices)
  - [ ] Cardmarket API integration (EU prices, preferred)
  - [ ] Show price range (low, mid, high)
- [ ] **Favorites List**
  - [ ] Add to favorites with ➕ button
  - [ ] Favorites list view with card images
  - [ ] Total collection value calculation
  - [ ] Sort by: value, name, date added
- [ ] **Scan History**
  - [ ] Chronological list of all scanned cards
  - [ ] Swipe left → delete entry
  - [ ] Swipe right → edit entry
  - [ ] Tap → full card detail view
  - [ ] Clear history option

## Phase 7: Settings
- [ ] Theme selector with live previews
- [ ] Default refresh interval setting
- [ ] Claude API Key eingabe + Validierung
- [ ] **eBay Account-Verwaltung**
  - [ ] Papa eBay Status (verbunden/nicht, Schloss-Icon, "Nur Preise")
  - [ ] Mein eBay Status (verbunden/nicht)
  - [ ] Aktiven Account umschalten
  - [ ] "Verbinden" / "Trennen" Buttons pro Account
- [ ] Scan-Statistiken (total Scans, API-Calls heute)
- [ ] Kostenindikator (geschätzte API-Kosten)
- [ ] Cache-Verwaltung (Cache leeren, Cache-Größe)
- [ ] App-Info (Version, Build-Nummer, GitHub Link)
- [ ] Sprache (Deutsch default)
- [ ] About / Credits

## Phase 8: GitHub Integration
- [ ] Set up GitHub Actions release workflow
  - [ ] Trigger auf Tag-Push (v*)
  - [ ] `npx expo prebuild --platform android` im CI
  - [ ] `cd android && ./gradlew assembleRelease` für APK
  - [ ] APK als Release-Asset hochladen
  - [ ] Auto-Changelog aus Conventional Commits generieren
- [ ] In-App Update-Checker
  - [ ] GitHub Releases API abfragen bei App-Start
  - [ ] Semver-Vergleich mit aktueller Version
  - [ ] Update-Banner mit Changelog anzeigen
  - [ ] APK Download + Install-Flow (expo-intent-launcher)
- [ ] Modern README.md
  - [ ] App Logo/Banner
  - [ ] Feature-Übersicht mit Screenshots
  - [ ] Installations-Anleitung (APK download von Releases)
  - [ ] Tech-Stack Badges
  - [ ] Contributing Guide
  - [ ] License (MIT)

## Phase 9: Polish & Release
- [ ] App Icon Design (futuristisch, passt zu allen Themes)
- [ ] Splash Screen mit Animation
- [ ] Onboarding Flow (erster App-Start)
- [ ] Loading Skeletons für alle async States
- [ ] Error Handling für alle API-Fehler
- [ ] Offline-Modus (gecachte Daten zeigen, Scans queuen)
- [ ] Performance-Optimierung (FlashList, memo, lazy loading)
- [ ] Kompletter Emulator-Durchlauf: jedes Feature testen
- [ ] Gradle Release-Build erstellen + auf Emulator installieren
- [ ] GitHub Release v1.0.0 erstellen mit APK

---

## Review Notes
_Wird nach jedem Milestone aktualisiert._
