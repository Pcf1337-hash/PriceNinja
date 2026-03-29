# PriceNinja Scanner-Systeme: Konkrete Verbesserungen

**Die wichtigste Erkenntnis zuerst: Cardmarket HTML-Scraping ist ab sofort überflüssig.** Die Pokémon TCG API, Scryfall und YGOPRODeck liefern alle bereits Cardmarket-Preise in ihren Responses – kostenlos und stabil. Dazu unterstützt die bereits eingesetzte ML Kit Library CJK-Sprachen out-of-the-box, und expo-camera hat Barcode-Scanning bereits eingebaut. Viele der größten Probleme der App lassen sich also mit vergleichsweise einfachen Änderungen lösen.

Dieser Bericht listet **17 priorisierte Verbesserungen** mit konkreten Umsetzungshinweisen, geordnet nach System und Schwierigkeitsgrad.

---

## CardScan: Cardmarket-Preise ohne Scraping über bestehende APIs

**Schwierigkeitsgrad: einfach | Dateien: services/pokemonTcgApi.ts, services/scryfallApi.ts, services/ygoprodeckApi.ts**

Das Cardmarket-Scraping ist der fragiltste Teil der App und gleichzeitig am einfachsten zu ersetzen. Alle drei Spiel-APIs liefern Cardmarket-Preisdaten bereits im Standard-Response:

Die **Pokémon TCG API** enthält im Card-Objekt ein `cardmarket`-Feld mit `trendPrice`, `averageSellPrice`, `avg1`, `avg7`, `avg30`, `lowPrice` und `suggestedPrice` – alles in EUR. **Scryfall** liefert für Magic-Karten `prices.eur` und `prices.eur_foil` (basierend auf Cardmarket Trend/Average). **YGOPRODeck** gibt im `card_prices`-Array `cardmarket_price` in EUR zurück, dazu sogar `ebay_price` und `amazon_price`.

Die Implementierung ist trivial: Statt nach dem API-Lookup einen separaten Cardmarket-Scraping-Call zu machen, werden die Preise direkt aus dem API-Response extrahiert. Das eliminiert den instabilsten Teil der App komplett, spart einen Netzwerk-Request pro Karte und macht die App robuster gegen Cardmarket-Layout-Änderungen. Die offizielle Cardmarket-API akzeptiert derzeit **keine neuen Anträge** – diese Lösung ist also auch die einzig realistische.

---

## CardScan: Pokémon TCG API mit Key auf 20.000 Requests/Tag upgraden

**Schwierigkeitsgrad: einfach | Datei: services/pokemonTcgApi.ts**

Ein kostenloser API-Key unter **dev.pokemontcg.io** hebt das Limit von **1.000 auf 20.000 Requests pro Tag** – eine 20-fache Steigerung ohne Kosten. Der Key wird als Header `X-Api-Key` mitgesendet. Das Throttle-Limit bleibt bei 30 Requests/Minute, kann aber per Discord/Email beim Team erhöht werden.

Die API nutzt eine Lucene-ähnliche Query-Syntax mit mächtigen Suchoptionen. Für die Kartensuche nach Set und Nummer ist der effizienteste Weg der direkte ID-Lookup: `GET /v2/cards/{set_id}-{number}` (z.B. `/v2/cards/sv1-25`). Alternativ per Query: `q=set.id:sv1 number:25`. Wildcards (`name:char*`), Range-Suchen (`nationalPokedexNumbers:[1 TO 151]`) und AND/OR/NOT-Logik sind verfügbar. Pagination erfolgt über `page` und `pageSize` (max 250).

Für Offline-Nutzung und schnellere Lookups empfiehlt sich ein lokaler Cache: Alle Sets per `GET /v2/sets` abrufen, dann pro Set alle Karten mit `pageSize=250` paginiert laden und in einer lokalen SQLite-Datenbank speichern.

---

## CardScan: CJK-Spracherkennung durch ML Kit Script-Konfiguration aktivieren

**Schwierigkeitsgrad: einfach bis mittel | Dateien: services/ocrService.ts, app.json**

Die bereits eingesetzte `@react-native-ml-kit/text-recognition` unterstützt Japanisch, Koreanisch und Chinesisch nativ über das `TextRecognitionScript`-Enum – es muss lediglich das richtige Script übergeben werden:

```typescript
import TextRecognition, { TextRecognitionScript } from '@react-native-ml-kit/text-recognition';

// Japanisch
const result = await TextRecognition.recognize(imageURL, TextRecognitionScript.JAPANESE);
// Koreanisch
const result = await TextRecognition.recognize(imageURL, TextRecognitionScript.KOREAN);
// Chinesisch
const result = await TextRecognition.recognize(imageURL, TextRecognitionScript.CHINESE);
```

Auf Android müssen die entsprechenden ML Kit Dependencies in `build.gradle` eingebunden werden (`com.google.mlkit:text-recognition-japanese:16.0.0` etc.). Jedes Sprachmodell vergrößert die App um **ca. 10–15 MB**. Eine sinnvolle Strategie: Latin und Japanese bundled ausliefern (deckt DE/FR/ES/JP ab), Chinese und Korean per On-Demand-Download.

Die Alternative **`rn-mlkit-ocr`** bietet einen Expo Config Plugin mit selektivem Model Loading – man wählt per `app.json` exakt welche Sprachen eingebunden werden. Für Expo SDK 52 ist auch **`expo-text-extractor`** interessant: Es nutzt ML Kit auf Android und Apple Vision auf iOS (das oft besser bei CJK performt) und bietet eine minimale API.

Für den Hybrid-Ansatz: Wenn das On-Device-Ergebnis unzureichend ist (confidence < 0.6), fällt die App auf **Google Cloud Vision API** zurück. Diese erkennt **80+ Sprachen gleichzeitig** in einem Request (keine Script-Auswahl nötig), kostet **$1,50 pro 1.000 Bilder** nach den ersten 1.000 kostenlosen pro Monat, und liefert deutlich höhere Genauigkeit bei gemischtsprachigem Text.

---

## CardScan: Set-Code-Extraktion durch strukturierte Regex-Patterns

**Schwierigkeitsgrad: mittel | Datei: services/cardParser.ts**

Set-Codes stehen an definierten Positionen und folgen klaren Formaten pro Spiel. Die Claude-Halluzination von Set-Codes lässt sich eliminieren, indem die Regex-Extraktion dem Vision-Fallback vorgeschaltet wird:

**Pokémon (modern, ab Scarlet & Violet):** Bottom-right, Format `KartenNr/SetGröße SetCode` – z.B. `13/198 SVI`. Regex: `/(\d{1,4})\s*\/\s*(\d{1,4})\s+([A-Z]{2,4})/`. Set-Codes sind sprachübergreifend identisch (DE, FR, ES verwenden denselben Code wie EN).

**Yu-Gi-Oh!:** Center-right unter der Illustration, Format `SETID-REGION###` – z.B. `ROTD-DE001`. Regex: `/\b([A-Z]{2,5}\d?)-([A-Z]{2})(\d{3,4})\b/`. Der Regionscode (`DE`, `EN`, `FR`, `JP`) identifiziert gleichzeitig die Sprache. Zusätzlich existiert ein 8-stelliger Passcode unten links, der über alle Printings identisch ist.

**Magic: The Gathering (modern):** Unter der Text-Box, Format `R 0034 • FDN • EN`. Regex: `/([CRUMSLT])\s+(\d{4})\s*[•★]\s*([A-Z]{3})\s*[•★]\s*([A-Z]{2})/`. Älteres Format: `120/280 MID EN R`.

Die empfohlene Pipeline: OCR → Regex-Extraktion aller Patterns → API-Validierung (Pokémon TCG API per Set-ID + Nummer, Scryfall per `set:fdn cn:34`, YGOPRODeck per Set-Code). Erst wenn kein Regex-Match gefunden wird, sollte Claude Vision als Fallback genutzt werden – mit der expliziten Instruktion, **nur den erkannten Text zu interpretieren** und keine Set-Codes zu erfinden.

---

## CardScan: ML-basierte Spielerkennung mit TensorFlow Lite

**Schwierigkeitsgrad: komplex | Neue Dateien: models/gameClassifier.tflite, services/gameDetection.ts**

Die regelbasierte Keyword-Erkennung ist unzuverlässig, besonders bei fremdsprachigen Karten. Ein **MobileNetV2-Classifier für 3 Klassen** (Pokémon, Yu-Gi-Oh!, Magic) löst das Problem dauerhaft. Die Library **`react-native-fast-tflite`** (von mrousavy) ist Expo-kompatibel via Config Plugin, nutzt C++ mit shared ArrayBuffers und unterstützt GPU-Delegates (CoreML auf iOS, NNAPI auf Android).

Erwartete Modellgröße: **3–5 MB** (quantisiert, INT8). Inferenzzeit: **5–15ms** auf modernen Smartphones, mit GPU-Delegate sogar **2–8ms**. Für das Training reichen **100–300 Bilder pro Klasse** mit Transfer Learning auf Google Colab. Kartenrücken sind das stärkste Unterscheidungsmerkmal – jedes TCG hat ein einzigartiges Design. Aber auch die Vorderseiten unterscheiden sich deutlich: Pokémon hat HP oben rechts, Magic hat Mana-Kosten, Yu-Gi-Oh! hat Sternlevel.

**Pragmatischere Alternative:** Claude Vision direkt als primären Game-Detector nutzen (statt nur als Fallback). Die Erkennung ist >99% zuverlässig und liefert gleich Set und Kartennamen mit. Nachteil: Kosten (~$0,01–0,03 pro Bild) und Latenz (1–3 Sekunden). Für die erste Iteration ist Claude Vision der schnellere Weg, TFLite das langfristige Upgrade bei steigendem Volumen.

---

## CardScan: Alternative Preis-APIs als Backup-Strategie

Über die drei Haupt-APIs hinaus existieren spezialisierte Alternativen für Grenzfälle:

- **Cardtrader API** (`api.cardtrader.com/api/v2/`): EU-fokussierter Marketplace mit Bearer-Token-Auth, unterstützt alle drei TCGs, Preise in EUR mit Condition-Angabe, **1–10 Requests/Sekunde**
- **PokéWallet** (`pokewallet.io`): GraphQL & REST, TCGPlayer + Cardmarket-Preise, Free Tier mit **10.000 Requests/Monat**
- **JustTCG** (`justtcg.com`): Multi-TCG mit condition-spezifischen Preisen, Free Tier verfügbar
- **PokeTrace** (`poketrace.com`): Free Tier **250/Tag**, WebSocket für Live-Preise

Die TCGPlayer API akzeptiert keine neuen Anmeldungen mehr. Für die meisten Fälle reichen Pokémon TCG API + Scryfall + YGOPRODeck vollständig aus.

---

## LootScan: Claude Vision mit Structured Outputs und optimiertem Prompt

**Schwierigkeitsgrad: mittel | Datei: services/productRecognition.ts**

Drei Verbesserungen machen die Produkterkennung deutlich zuverlässiger. Erstens: **Structured Outputs** (GA für Haiku 4.5) garantieren valide JSON-Ausgaben über ein Schema in `output_config`. Statt freien Text zu parsen, definiert man ein Schema mit `productName`, `brand`, `model`, `searchQuery`, `alternativeQueries`, `confidence` und `condition`. Das eliminiert JSON-Parsing-Fehler komplett.

Zweitens: **Evidenz-basiertes Prompting** reduziert Halluzinationen. Der Prompt sollte Claude instruieren, zuerst alle sichtbaren Texte, Logos und physischen Merkmale zu beschreiben und die Identifikation nur darauf zu basieren. Eine explizite „I don't know"-Erlaubnis senkt die confidence bei unsicheren Erkennungen statt falsche Produktnamen zu halluzinieren.

Drittens: **Mehrere searchQuery-Varianten** generieren. Claude sollte eine `primaryQuery` (spezifisch: „Samsung Galaxy S24 Ultra 256GB"), 2–3 `alternativeQueries` (kürzer/anders formuliert) und eine `broadQuery` (generisch: „Samsung Galaxy S24") liefern. Die App sucht zuerst spezifisch und fällt bei <5 Ergebnissen auf breitere Queries zurück.

Haiku 4.5 ist die richtige Wahl für diesen Use Case – **3x günstiger** als Sonnet bei vergleichbarer Vision-Qualität für Produkterkennung. Temperature 0 verwenden für deterministische Ergebnisse.

Empfohlener System-Prompt-Kern:
```
Du bist ein Experte für Produkterkennung. Beschreibe zuerst alle sichtbaren 
Logos, Texte und Modellnummern. Basiere die Identifikation NUR auf diesen 
Beobachtungen. Die searchQuery soll 3-6 Keywords enthalten: Marke + Modell + 
Schlüsselspezifikation. Vermeide Adjektive und Zustandsbeschreibungen im Query.
Wenn du das Produkt nicht sicher identifizieren kannst, setze confidence < 0.5.
```

---

## LootScan: eBay Browse API mit Kategorie-Filtern und searchByImage

**Schwierigkeitsgrad: mittel | Datei: services/ebayApi.ts**

Die eBay Browse API bietet zwei unterschätzte Features. **Kategorie-IDs** (`category_ids`-Parameter) verbessern die Relevanz massiv – ohne Kategorie liefert „Apple" Obst und Elektronik gemischt. Claude sollte im Structured Output auch eine `category_id` vorschlagen. **`searchByImage`** (`POST /item_summary/search_by_image`) nimmt ein Base64-Bild entgegen und findet visuell ähnliche Artikel – das kann parallel zur Keyword-Suche laufen.

Wichtige Filter für realistische Preise: `conditions:{USED}` oder `{NEW}` trennt Zustände sauber, `buyingOptions:{FIXED_PRICE}` filtert Auktionen heraus, `sort=price` sortiert aufsteigend. Das Standard-Rate-Limit liegt bei **5.000 Calls/Tag**, erweiterbar über den Application Growth Check.

**Kritisch:** Zugriff auf verkaufte Artikel (Sold Items) ist über die Browse API nicht möglich. Die Marketplace Insights API ist Limited Release für ausgewählte Partner. Als Workaround: Median und Durchschnitt der aktiven Fixed-Price-Listings berechnen, Ausreißer (>2σ) filtern.

Die Finding API wurde im **Februar 2025 deprecated und decommissioned** – falls noch Referenzen im Code existieren, müssen diese migriert werden. Die eBay-spezifische OR-Syntax nutzt Klammern mit Komma: `(iPhone 14 Pro, iPhone14Pro)`.

---

## LootScan: Barcode-Scanning über expo-camera aktivieren

**Schwierigkeitsgrad: einfach | Dateien: app.json, screens/LootScanScreen.tsx**

Da die App bereits `expo-camera` nutzt, ist Barcode-Scanning ohne zusätzliche Dependency verfügbar. In `app.json` muss lediglich `barcodeScannerEnabled: true` im Config Plugin gesetzt werden. Die CameraView erhält `barcodeScannerSettings` mit den relevanten Formaten (`ean13`, `ean8`, `upc_a`, `qr`) und einen `onBarcodeScanned`-Callback.

Das alte `expo-barcode-scanner`-Package wurde in **SDK 51 deprecated und in SDK 52 komplett entfernt**. Die Migration zu `expo-camera` ist die einzige Option.

Für die Barcode-zu-Preis-Pipeline: EAN scannen → Produktname über **Open Food Facts** (kostenlos, 4 Mio.+ Produkte) oder **Go-UPC** (ab ~$9/Monat, 1 Mrd.+ Produkte) ermitteln → Preissuche über billiger.de API oder eBay per EAN. Die eBay Browse API unterstützt direkte **GTIN-Suche** über den `gtin`-Parameter – ein EAN-13-Code kann also direkt als Suchparameter verwendet werden, ohne Produktnamen-Lookup.

Falls die expo-camera-Performance nicht ausreicht: **`react-native-vision-camera` v4.7.3** bietet über seinen eingebauten Code-Scanner bessere Scan-Zuverlässigkeit, Autofokus und Pinch-to-Zoom, erfordert aber einen Development Build (kein Expo Go).

---

## LootScan: billiger.de Partner-API als Geizhals-Ersatz

**Schwierigkeitsgrad: mittel | Datei: services/priceComparison.ts**

Die **billiger.de Partner-API** (betrieben von solute GmbH) ist die robusteste kostenlose Alternative zu Geizhals-Scraping für den DACH-Markt. Der Zugang erfolgt über das Partner-Programm (`partner@solute.de`), ist kostenlos für Traffic-Partner und wird per CPC monetarisiert. Die API unterstützt Suche per **Keyword, EAN und ASIN**, wird in Echtzeit aktualisiert (wenige Minuten Verzögerung) und liefert strukturierte JSON-Daten statt fragiles HTML.

Geizhals selbst hat **keine öffentliche API**. Zugang gibt es nur über das Affiliate-Programm nach Qualitätsprüfung der eigenen Website – für eine App ist das unrealistisch.

Weitere Optionen nach Budget:

- **SerpAPI Google Shopping** (`serpapi.com`): Google-Shopping-Ergebnisse als JSON, Free Tier mit **100 Suchen/Monat**, kostenpflichtig ab ~$50/Monat. Parameter `gl=de` und `hl=de` für deutsche Ergebnisse
- **Keepa API** (€19/Monat): Ausschließlich Amazon, aber mit Preis-Historie über **900 Mio. Produkte**, Suche per ASIN oder EAN
- **PriceAPI.com** (ab €499/Monat): All-in-one für Geizhals, idealo, billiger.de, Amazon, Google Shopping – für professionelle Anwendungen

---

## Übersicht aller Verbesserungen nach Priorität

| # | System | Verbesserung | Schwierigkeit | Impact |
|---|--------|-------------|---------------|--------|
| 1 | CardScan | Cardmarket-Preise aus bestehenden APIs extrahieren | Einfach | **Sehr hoch** |
| 2 | CardScan | Pokémon TCG API-Key registrieren (20K req/Tag) | Einfach | Hoch |
| 3 | LootScan | Barcode-Scanning via expo-camera aktivieren | Einfach | Hoch |
| 4 | LootScan | Claude Structured Outputs + optimierter Prompt | Mittel | **Sehr hoch** |
| 5 | CardScan | CJK-Sprachsupport im OCR konfigurieren | Einfach–Mittel | Hoch |
| 6 | CardScan | Strukturierte Regex-Patterns für Set-Codes | Mittel | Hoch |
| 7 | LootScan | eBay-Suche mit Kategorie-Filtern + Multi-Query | Mittel | Hoch |
| 8 | LootScan | billiger.de Partner-API statt Geizhals-Scraping | Mittel | Hoch |
| 9 | LootScan | eBay searchByImage parallel zur Keyword-Suche | Mittel | Mittel |
| 10 | CardScan | Claude Vision als primärer Game-Detector | Einfach | Mittel |
| 11 | CardScan | Lokaler Karten-Cache mit SQLite | Mittel | Mittel |
| 12 | LootScan | EAN → GTIN-Direktsuche bei eBay | Einfach | Mittel |
| 13 | CardScan | Google Cloud Vision als OCR-Fallback für CJK | Mittel | Mittel |
| 14 | LootScan | Confidence-Validierung mit Schwellenwert-Logik | Einfach | Mittel |
| 15 | CardScan | Cardtrader API als Backup-Preisquelle | Mittel | Niedrig |
| 16 | CardScan | TFLite-Classifier für Spielerkennung | Komplex | Mittel |
| 17 | LootScan | SerpAPI Google Shopping als Preis-Fallback | Mittel | Niedrig |

## Die drei Quick Wins, die sofort umgesetzt werden sollten

Die Verbesserungen #1, #2 und #3 erfordern jeweils weniger als einen Tag Arbeit und lösen die größten Schmerzpunkte. Cardmarket-Scraping eliminieren kostet nur das Refactoring des Preis-Lookups auf bereits vorhandene API-Felder. Den Pokémon TCG API-Key zu registrieren dauert Minuten. Und Barcode-Scanning über expo-camera ist eine Config-Änderung plus ein `onBarcodeScanned`-Handler. Zusammen transformieren diese drei Änderungen die Stabilität und den Feature-Umfang der App fundamental – ohne neue Dependencies, ohne Kosten, ohne komplexe ML-Pipelines.