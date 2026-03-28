# Emio Trade — Lessons Learned

## Projekt-Spezifische Regeln

### API-Kosten (HÖCHSTE PRIORITÄT)
- **NIEMALS** API-Calls in useEffect ohne User-Aktion auslösen
- **IMMER** lokalen Cache prüfen bevor externer API-Call gemacht wird
- **IMMER** Rate-Limiting implementieren BEVOR der Feature-Code geschrieben wird
- Claude Haiku nutzen, NICHT Sonnet/Opus für Bild-Erkennung (10x billiger)
- Bilder vor dem API-Call komprimieren (max 1024px Breite, JPEG quality 0.7)
- Geizhals hat KEINE offizielle API → Scraping mit Caching (min. 1h Cache)

### React Native / Expo Patterns
- expo-camera: `takePictureAsync()` gibt base64 zurück → direkt an Claude API senden
- NativeWind v5: className-Props funktionieren NICHT auf allen RN-Komponenten → `styled()` wrapper nutzen
- Zustand: KEIN Provider nötig → direkt importieren und nutzen
- expo-sqlite: Synchrone Calls blockieren UI → IMMER async mit `useSQLiteContext`
- FlashList statt FlatList für Listen > 20 Items
- expo-secure-store für API-Keys und Tokens, NICHT AsyncStorage

### eBay API + Multi-Account + Wizard
- Browse API für Suche, Sell API für Listings → zwei verschiedene Auth-Flows
- Completed/Sold Items: Filter `buyingOptions: FIXED_PRICE,AUCTION` + `itemEndDate`
- eBay OAuth Tokens ablaufen nach 2h → Refresh-Token-Flow implementieren
- Sandbox-Modus zum Testen nutzen, NICHT Produktion
- **ZWEI Account-Typen**: Papa eBay (nur Preise) und Mein eBay (Preise + Verkaufen)
- **Papa eBay darf NIEMALS Listings erstellen** — Rechte-Guard in useEbayPermissions() Hook
- Listing-Button MUSS disabled/hidden sein wenn Papa-Account aktiv
- Beide Accounts können gleichzeitig verbunden sein, einer ist aktiv
- Wizard-Flow: Account-Typ → Welcome → API Keys → OAuth Login (WebView) → Done
- OAuth Authorization Code Flow in WebView: `react-native-webview` oder `expo-web-browser`
- NIEMALS eBay-Credentials in Klartext speichern → expo-secure-store
- Wizard muss jederzeit wiederholbar sein (Reconnect aus Settings)
- Wenn kein eigener eBay-Account: IMMER Copy-Paste Fallback anbieten, nie blocken

### Build & Emulator
- **NUR Gradle-Builds** — kein EAS, kein Cloud-Build
- `npx expo prebuild --platform android` erstellt den `android/` Ordner
- `npx expo run:android` baut und installiert auf dem Emulator
- Release-APK: `cd android && ./gradlew assembleRelease`
- Emulator ist lokal installiert und konfiguriert — IMMER nutzen zum Testen
- Nach JEDEM Feature: auf dem Emulator verifizieren bevor Task als done markiert wird
- GitHub Actions: Gradle-Build im CI, NICHT EAS Build
- Target-Architektur: `arm64-v8a` (Standard), universal APK ist auch ok — App-Größe ist egal

### Trading Cards
- Pokémon-Karten: Set-Symbol + Nummer sind der eindeutige Identifier
- Yu-Gi-Oh!: Passcode (8-stellig unten links) ist der beste Identifier
- Magic: Set-Code + Collector-Number
- Cardmarket API (EU) bevorzugen über TCGPlayer (US) → bessere Preise für DE

### GitHub Releases / Updates
- APK-Größe im Release-Asset-Namen inkludieren
- Semver strikt einhalten: MAJOR.MINOR.PATCH
- Changelog aus Conventional Commits generieren
- Update-Check: maximal 1x pro App-Start, NICHT im Hintergrund pollen
- GitHub Actions: `./gradlew assembleRelease` → APK als Release-Asset
- KEIN EAS Build im CI — alles über Gradle

### Theming
- Theme-Wechsel: ALLE Farben über Context → keine hardcoded Colors
- Anime-Themes: Glow-Effekte über `shadowColor` + `elevation` (Android) bzw. `shadow*` (iOS)
- Theme-Transition: `LayoutAnimation.configureNext()` für smooth Wechsel

## Allgemeine Entwicklungs-Regeln

### Aus Dennis' Projekten gelernt
- SQLite Crashes: IMMER DB-Connection prüfen bevor Queries laufen
- Android App Icons: Cache löschen nach Icon-Update (`adb shell pm clear`)  
- Media Uploads: Komprimierung VOR Upload, nicht nachher
- Supabase war für dieses Projekt evaluiert, aber SQLite + GitHub ist leichter und kostenlos
- expo-updates: Für GitHub-basierte Updates eigenen Update-Checker bauen statt EAS Updates

### Code Quality
- Keine `console.log` in Production → `__DEV__` guard oder Logger-Utility
- Jede API-Funktion braucht Error-Handling mit User-Feedback (Toast/Alert)
- Skeleton-Loader für JEDE async Operation — kein leerer Screen
- TypeScript: `as` casting vermeiden → Type Guards nutzen

## Fehler-Protokoll
_Hier werden konkrete Fehler dokumentiert sobald sie auftreten._

| Datum | Fehler | Root Cause | Fix | Regel |
|-------|--------|------------|-----|-------|
| — | — | — | — | — |
