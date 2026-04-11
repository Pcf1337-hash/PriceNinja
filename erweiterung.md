# PriceNinja: APIs, Datenbanken & Preisquellen für Sports Cards und Collectibles

**Kein einzelner API-Anbieter deckt alle geplanten Kategorien ab.** Für die Erweiterung von PriceNinja auf WWE Cards, Panini Fußball, weitere Sports Cards und Collectibles benötigt man mindestens 3–4 verschiedene Datenquellen — und für mehrere Kategorien existiert schlicht kein programmatischer Zugang. Die beste Gesamtstrategie kombiniert **CardHedger oder SportsCardsPro als Pricing-Backend**, die **eBay Browse API für aktive Listings**, **BrickLink für LEGO** und **On-Device-OCR via ML Kit/Apple Vision** als Scanner-Engine. Kritischer Engpass: eBay hat den Zugang zu Sold-Listings-Daten seit Februar 2025 massiv eingeschränkt, was die Preisverfolgung für alle Kategorien erschwert.

---

## 1. Sports Cards: Die API-Landschaft ist dünn, aber nutzbar

### SportsCardsPro / PriceCharting API — Beste Allround-Lösung

Die zuverlässigste Datenquelle für Sports Cards aller Kategorien ist die **PriceCharting-API** (Sports-Cards-Ableger: SportsCardsPro). Sie deckt Wrestling/WWE, Basketball, Football, Baseball, Soccer, Hockey, UFC, Boxing, Golf, Racing und Tennis ab.

- **Base URL:** `https://www.sportscardspro.com/api/product` oder `https://www.pricecharting.com/api/product`
- **Dokumentation:** https://www.sportscardspro.com/api-documentation
- **Auth:** Token-basiert (40-Zeichen-Token als `?t=`-Parameter)
- **Kosten:** Bezahltes Abo erforderlich (Legendary-Tier für CSV-Downloads)
- **Rate Limits:** Max. **1 Request/Sekunde**, CSV-Downloads 1x pro 10 Minuten
- **Endpoints:** `/api/product` (Einzelkarte per ID, UPC oder Textsuche), `/api/products` (bis 20 Ergebnisse)
- **Response-Beispiel:**
```json
{
  "status": "success",
  "id": "72584",
  "product-name": "Michael Jordan #57",
  "console-name": "Basketball Cards 1986 Fleer",
  "loose-price": 225500,
  "cib-price": 413800,
  "new-price": 602295
}
```
Preise werden in **Cent** zurückgegeben (225500 = $2.255,00). Die drei Preisstufen entsprechen ungraded, PSA-graded und BGS-graded.

### CardHedger API — Enterprise-Grade mit Computer Vision

**CardHedger** ist der umfangreichste einzelne Anbieter für Sports-Card-Daten und bietet zusätzlich eine **Computer-Vision-API** für Kartenidentifikation.

- **Base URL:** `https://api.cardhedger.com/`
- **Auth:** Bearer Token (`Authorization: Bearer YOUR_API_KEY`)
- **Kosten:** Ab **$49/Monat** (7-Tage-Trial); Enterprise-Tier auf Anfrage
- **Datenumfang:** 2,7M+ Karten, **40M+ wöchentlich analysierte Verkäufe** aus eBay, Fanatics, Heritage Auctions
- **Besondere Features:** Fuzzy-Search nach Spieler/Jahr/Set/Grade, PSA/BGS/SGC/CGC Grading-Preise, Population-Daten, **Slab-Erkennung per Foto** (liest Grade, Cert-Nummer, Grading-Company), historische Preisdaten, OpenAPI-3.0-Spec
- **30+ Kategorien:** Baseball, Football, Basketball, Hockey, Soccer, Wrestling, Pokemon, Yu-Gi-Oh, Star Wars, Marvel
- **MCP-Integration** vorhanden (Claude, Cursor)

Für PriceNinja ist CardHedger besonders interessant, weil die Computer-Vision-Endpoints direkt in den Scanner-Workflow integriert werden können — Upload eines Kartenfotos → Identifikation → Pricing in einem API-Call.

### Zyla Labs Sports Card API — Schnelleinstieg

- **URL:** https://zylalabs.com/api-marketplace/sports/sports+card+and+trading+card+api/2511
- **Auth:** Bearer Token über Zyla API Hub
- **Kosten:** 7-Tage-Trial (50 Calls), danach Monatsabo
- **Endpoints:** Card Search (Fuzzy), Get Card Prices (Zeitreihe per card_id + Grade)
- **Response enthält:** `player`, `set`, `number`, `variant`, `category`, `image`, `price`, `closing_date`, `Grade`

### Ximilar Visual AI — Kartenidentifikation per Foto

- **URL:** `https://api.ximilar.com/collectibles/v2/`
- **Endpoints:** `card_ocr_id` (OCR + LLM-Identifikation), `sport_id`, Card Grading, Card Centering
- **Auth:** API Token
- **Kosten:** Business-Plan erforderlich (ab 100K-Plan für Pricing-Features)
- **Besonderheit:** Kombiniert OCR-Texterkennung mit GPT-basierter Kartenidentifikation — liest alle Texte auf der Karte und identifiziert dann Athlete + Set + Variante

---

## 2. WWE Trading Cards: Identifikation und Datenstruktur

WWE-Karten werden über die Kombination **Jahr + Hersteller + Produktlinie + Kartennummer + Wrestler + Parallel/Variante** identifiziert. Beispiel: `2024 Panini Select WWE #45 Roman Reigns Silver Prizm`.

### Aktuelle Lizenzlage (Stand 2025/26)

**Topps** hat im Januar 2025 die WWE-Lizenz zurückgewonnen (langfristiger Deal mit Fanatics). **Panini** hielt die Lizenz 2022–2024 und produziert Restbestände. **Upper Deck** hält die AEW-Exklusivlizenz. Diese Lizenzverschiebung betrifft die App: Ältere Sets sind Panini-branded, neue Sets Topps-branded, aber alle benötigen Preisdaten.

### Kartennummern-Formate

| Typ | Format | Beispiel |
|-----|--------|----------|
| Base Set | Sequentiell `#1–200` | `#45 Roman Reigns` |
| Insert/Subset | Präfix + Nummer | `RC-1` (Rookie), `A-15` (Autograph) |
| Parallel | Base-Nummer + Variante | `#45 Silver Prizm /199` |
| Serial Numbered | Nummer + Auflage | `#45 Gold /50` |
| Autograph | Eigener Präfix | `FSA-DA` (Five Star Autographs) |

### Verfügbare Datenquellen für WWE

SportsCardsPro und CardHedger decken **WWE/Wrestling explizit ab**. Beckett hat umfangreiche WWE-Daten, bietet aber **keine API** und schützt seine Daten aggressiv (Klage gegen COMC 2014). COMC hat 46M+ Karten im Inventar, darunter WWE, aber ebenfalls **keine öffentliche API**. Cardboard Connection bietet redaktionelle Checklisten ohne API-Zugang.

---

## 3. Panini Fußball: Sticker ≠ Trading Cards

### Sticker vs. Trading Cards — grundlegender Unterschied

**Panini-Sticker** (FIFA World Cup, Champions League, Bundesliga): Kleiner als Standardkarten, zum Einkleben in ein Album. Nummern entsprechen den Album-Seiten und sind sequentiell innerhalb der Kollektion (`#1–670` für FIFA WC 2022). Format: `[Jahr] [Wettbewerb] Stickers #[Nummer]`.

**Panini Adrenalyn XL**: Standardkartengröße, Sammelkartenspiel mit Stats/Gameplay. Eingeführt 2009. Alphanumerische Nummern mit Präfixen (z.B. `AXL-123`). Die 2026 FIFA WC Adrenalyn XL hat 630 Karten.

**Panini Prizm/Select Soccer**: Premium-Chromium-Karten im US-Sports-Card-Format, komplett andere Nummernstruktur als Sticker.

### Aktuelle Panini-Fußball-Lizenzen

FIFA World Cup, UEFA Nations League, Copa América, La Liga, Serie A, EFL (ab 2025-26), Argentine Primera División, Croatian League.

### Datenquellen — Die große Lücke

**Es existiert keine API speziell für Panini-Fußball-Sticker.** Die beste Checklist-Datenbank ist **Trading Card Database (TCDB)** unter https://www.tcdb.com mit umfangreicher Abdeckung von FIFA WC Stickern, Champions League, Premier League, FIFA 365. TCDB hat jedoch **keine öffentliche API** — Daten müssten gescraped werden. Footballstickipedia (https://www.footballstickipedia.com) ist eine weitere Nischen-Ressource ohne API.

**Cardmarket unterstützt Panini-Sticker NICHT** — nur TCGs (Magic, Pokemon, Yu-Gi-Oh, Lorcana etc.). Für europäische Panini-Sticker-Preise ist **eBay** (ebay.co.uk, ebay.de, ebay.it) die primäre Quelle mit 1,5M+ Panini-Soccer-Listings und 54K+ Sticker-Singles. SportsCardsPro deckt Panini Soccer Prizm/Select ab, aber nicht die klassischen Album-Sticker.

### Empfohlene Strategie für Panini Fußball

1. **Checklisten:** TCDB scrapen oder eigene Datenbank aufbauen
2. **Sticker-Preise:** eBay Browse API (nur aktive Listings) + eigenes Sold-Data-Aggregation
3. **Prizm/Select Soccer Preise:** SportsCardsPro API oder CardHedger

---

## 4. Weitere Panini Sports Cards und die Fanatics-Umwälzung

### Wichtiger Kontext: Lizenzverluste

**Panini verliert systematisch alle großen US-Sport-Lizenzen an Fanatics/Topps:** MLB bereits bei Topps, NBA im Übergang zu Fanatics, NFL erwartet bei Topps/Fanatics (laufende Rechtsstreitigkeiten). Panini wird zukünftig **unlizenzierte Produkte** für Sportarten produzieren, bei denen sie die Rechte verloren haben. Für PriceNinja bedeutet das: Bestehende Panini-Sets (Prizm, Select, Mosaic, Donruss, National Treasures, Hoops) bleiben relevant als Sammelobjekte, aber neue Releases kommen zunehmend von Topps/Fanatics.

### Multi-Sport-APIs

Alle unter Punkt 1 genannten APIs decken Panini-Produkte markenübergreifend ab. SportsCardsPro hat Preise für Prizm Basketball, Donruss Football, Select Soccer etc. CardHedger trackt 30+ Kategorien inklusive aller Panini-Linien. **Es gibt keine Panini-eigene API** — Panini bietet weder für Händler noch Entwickler programmatischen Zugang zu ihren Produktdaten.

### TCGPlayer für Sports Cards

TCGPlayer hat 2023 angekündigt, den Marketplace für Sports Cards zu öffnen. Allerdings ist die **TCGPlayer API aktuell für neue Entwickler geschlossen** ("We are no longer granting new API access at this time"). Alternativen: **TCGCSV** (https://tcgcsv.com) bietet TCGPlayer-Daten als JSON/CSV-Downloads (täglich aktualisiert, kostenlos/Patreon), deckt aber primär TCGs ab. **TCGAPIs** (https://tcgapis.com) ist ein Drittanbieter-Wrapper mit Plänen von Free bis Enterprise.

---

## 5. Collectibles: LEGO stark, Funko mittel, Rest schwach

### LEGO — Beste API-Abdeckung aller Collectible-Kategorien

**BrickLink API** (im Besitz von LEGO) ist die stärkste Einzelquelle:

- **Base URL:** `https://api.bricklink.com/api/store/v1`
- **Auth:** OAuth 1.0 (Consumer Key/Secret + Token Key/Secret)
- **Kosten:** **Kostenlos**
- **Rate Limit:** **5.000 Requests/Tag**
- **Daten:** Katalog (Sets, Parts, Minifigures), **Price Guide** (aktuelle Durchschnittspreise, Verkaufsdurchschnitte der letzten 6 Monate), Farben, Kategorien
- **Item Types:** `SET`, `PART`, `MINIFIG`, `BOOK`, `GEAR`
- **JS/TS:** `bricklink-api` npm-Package existiert (TypeScript-Support), aber veraltet (2017). Alternativ: `oauth-1.0a` npm für manuelle OAuth-1.0-Signierung.

```typescript
import OAuth from 'oauth-1.0a';
import crypto from 'crypto';

const oauth = new OAuth({
  consumer: { key: CONSUMER_KEY, secret: CONSUMER_SECRET },
  signature_method: 'HMAC-SHA1',
  hash_function: (base, key) =>
    crypto.createHmac('sha1', key).update(base).digest('base64'),
});

const request = {
  url: 'https://api.bricklink.com/api/store/v1/items/MINIFIG/sw0001/price',
  method: 'GET',
};
const headers = oauth.toHeader(oauth.authorize(request, token));
```

**Rebrickable API** ergänzt BrickLink mit kostenlosem Katalogzugang:

- **URL:** `https://rebrickable.com/api/v3/`
- **Auth:** API Key (`Authorization: key YOUR_KEY`)
- **Kosten:** **Kostenlos**
- **Daten:** Kompletter LEGO-Katalog (Sets, Parts, Minifigs, Themes), **aber keine Preisdaten**
- **Bulk-Downloads:** CSV-Dateien unter https://rebrickable.com/downloads/ (täglich aktualisiert)
- **OpenAPI-Spec** verfügbar für SDK-Autogenerierung

**BrickEconomy API** liefert Marktdaten und Preistrends:

- **URL:** `https://www.brickeconomy.com/api/v1/`
- **Auth:** API Key via `x-apikey` Header
- **Kosten:** **Premium-Mitgliedschaft** erforderlich (kostenpflichtig)
- **Rate Limit:** **100 Requests/Tag**
- **Daten:** Marktpreise, historische Trends, Retirement-Prognosen, Deals von eBay/StockX/BrickLink

### Funko Pop — Begrenzte Optionen

Die **hobbyDB/Pop Price Guide API** ist die einzige strukturierte Datenquelle, aber teuer und schwer zugänglich:

- **Zugang:** Nicht öffentlich. Erfordert Projektantrag mit URL, Timeline, Value Proposition. **Setup-Gebühr ab $1.200 + monatliche Kosten**, sofern das Projekt keinen signifikanten Traffic für hobbyDB generiert.
- **Datenumfang:** 800.000+ Items, **6M+ Preispunkte** aus 82 Quellen (eBay, Mercari, Shopify-Stores)
- **Abdeckung:** Funko Pop, Hot Wheels, diverse Collectibles

**Open-Source-Alternative:** Das GitHub-Repository `kennymkchan/funko-pop-data` enthält **23.000+ Funko-Einträge** im JSON/CSV-Format (MIT-Lizenz) mit Handle, Image-URL, Title und Series. Keine Preisdaten — müssten über eBay ergänzt werden. **FunkyPriceGuide.com** bietet kostenlose, auf eBay-Verkäufen basierende Preise, hat aber keine API.

Funko-Pops werden identifiziert über **Serie + Box-Nummer + Character + Variante** (Chase, Flocked, GITD, Metallic, Store-Exclusive). Wichtig: Chase-Pieces teilen sich **dieselbe Box-Nummer UND denselben UPC** mit der Standard-Version — visuelle Erkennung ist zwingend nötig.

### Action Figures, Hot Wheels, Beanie Babies — Keine APIs

**Für Action Figures existiert keine einzige öffentliche API.** Die besten Web-Quellen sind ActionFigure411.com (Preisguides basierend auf eBay), Galactic Collector (Vintage Star Wars), und Wheeljack's Lab (195.100+ Toy-Verkäufe, kostenlos). Alle erfordern Scraping.

**Hot Wheels** hat ebenfalls keine API. South Texas Diecast (28.000+ Autos, eBay-basierte Preise) und HWPriceGuide.com sind die besten Web-Quellen. Hot Wheels sind schwer über Barcodes zu identifizieren, da sich UPCs über mehrere Produkte teilen. Identifikation läuft über Collector Number + Casting Name + Series + Year + Base Code (Bodenstempel).

**Beanie Babies** haben nur Web-basierte Price Guides (beaniebabiespriceguide.com, Beaniepedia). Keine API. Identifikation über Style-Nummer + Hang-Tag-Generation (1.–20.).

Für alle drei Kategorien ist **eBay als universelle Pricing-Quelle** der einzige skalierbare Ansatz.

---

## 6. Grading-Datenbanken: PSA hat die einzige API

### PSA Public API — Einzige offizielle Grading-API

- **URL:** `https://api.psacard.com/publicapi/`
- **Dokumentation:** https://www.psacard.com/publicapi/documentation
- **Swagger:** https://api.psacard.com/publicapi/swagger
- **Auth:** OAuth 2.0 (Password Grant → Bearer Token)
- **Kosten:** **Kostenlos** (100 Calls/Tag). Höhere Limits auf Anfrage (api@psacard.com)
- **Endpoint:** `GET /cert/GetByCertNumber/{certNumber}`
- **Response:** Grade, Kartenbeschreibung, Jahr, Set, Kartennummer, **Population-Daten**, Bilder (für nach Oktober 2021 gegradete Karten), Validierungsstatus
- **Einschränkung:** Nur Cert Verification — kein Batch-Zugang zu Population Reports oder Auction Prices Realized. Die **Population Reports** (https://www.psacard.com/pop) und **Auction Prices Realized** sind nur als Web-Interface verfügbar.

PSA hat **50M+ Karten** seit 1991 gegraded. Ein Apify-Scraper für PSA Pop Reports existiert (https://apify.com/lulzasaur/psa-pop-scraper).

### BGS (Beckett) — Keine API, kein Entwicklerzugang

Beckett bietet **keinerlei öffentliche API**. Graded-Card-Lookup und Population Reports sind nur über die Website (Abo: ~$25–45/Monat). Beckett hat COMC wegen Datenmissbrauch verklagt — Scraping ist rechtlich hochriskant.

### CGC Cards — Keine API

CGC hat 2020 den Trading-Card-Bereich betreten. **Keine öffentliche API**, aber Cert Verification unter https://www.cgccards.com/CERTLOOKUP/ (kostenlos, mit QR-Code-Scanning). CGC nutzt Halbgrade und einen konservativeren Maßstab (CGC 9.5 ≈ PSA 10).

### Integration-Pattern für Grading-Daten

Die meisten erfolgreichen Apps nutzen diesen Workflow: **Slab-Barcode scannen → PSA API für Cert Verification → Grade + Kartendaten erhalten → Cross-Reference mit Pricing-API** (CardHedger oder SportsCardsPro). CardHedger bietet zusätzlich eine Slab-Detection per Computer Vision, die Grade, Cert-Nummer und Grading-Company automatisch aus einem Foto liest.

---

## 7. eBay als universelle Preisquelle — mit kritischen Einschränkungen

Die **eBay Browse API** ist für aktive Listings gut nutzbar, aber **Sold-Listings-Daten sind seit Februar 2025 praktisch unzugänglich** für unabhängige Entwickler.

- **Browse API:** `https://api.ebay.com/buy/browse/v1/` — Active Listings, Keyword/Category/Image-Search
- **Auth:** OAuth 2.0 (Client Credentials für öffentliche Daten)
- **Kosten:** Kostenlos (eBay Developers Program)
- **Rate Limit:** Default 5.000 Calls/Tag (erweiterbar)
- **Kategorie-IDs Sports Cards:** 108765 (Sports Trading Cards), 215 (Football), 213 (Baseball), 214 (Basketball)
- **TypeScript SDK:** `ebay-api` npm Package (v9.5.1, aktiv maintained, MIT-Lizenz) — **bestes verfügbares SDK** aller recherchierten APIs

```typescript
import eBayApi from 'ebay-api';

const eBay = new eBayApi({
  appId: process.env.EBAY_APP_ID,
  certId: process.env.EBAY_CERT_ID,
  sandbox: false,
  siteId: eBayApi.SiteId.EBAY_US,
});

// Aktive Listings suchen (funktioniert)
const results = await eBay.buy.browse.search({
  q: '2024 Panini Prizm WWE Roman Reigns',
  category_ids: '108765',
  limit: 25,
});
```

**Kritisches Problem:** Die Finding API (`findCompletedItems`) wurde am **5. Februar 2025 abgeschaltet**. Die Marketplace Insights API (Sold Data) ist auf **zugelassene Partner beschränkt** — unabhängige Entwickler berichten, keinen Zugang zu erhalten. Workarounds:

- **SoldComps** (https://sold-comps.com/): Liefert bis zu 240 Sold Listings per Query. Free-Plan: 25 Requests/Monat. Kein eBay-Developer-Account nötig.
- **130point.com**: Aggregiert Sold Data von eBay, Goldin, Heritage Auctions, Pristine Auctions, MySlabs (15M+ Sold Items). **Keine API** — nur Web/App.
- **CardHedger**: Aggregiert eBay-Sold-Data intern und stellt sie über die eigene API bereit.

---

## 8. OCR- und Erkennungsstrategien für Sports Cards

### Sports Cards haben keine Barcodes

**Einzelne Sports Cards tragen grundsätzlich keine Barcodes oder QR-Codes.** UPC-Codes finden sich nur auf versiegelter Verpackung (Hobby Boxes, Blaster Boxes). Einzige Ausnahme: Panini-Points-Karten in Hobby Boxes haben QR-Codes als Redemption-Codes. Grading-Slabs (PSA, CGC) tragen Barcodes/QR-Codes auf dem Holder, nicht auf der Karte selbst.

### Visuell fundamentale Unterschiede zu TCG-Karten

TCG-Karten haben **standardisierte Templates** (jede Pokemon-Karte hat Name oben, HP rechts, Nummer unten). Sports Cards variieren extrem nach Set, Jahr und Hersteller. Die **Kartennummer** befindet sich typischerweise in der oberen Ecke der Rückseite, **Jahr/Copyright** am unteren Rand der Rückseite, der **Spielername** ist auf der Vorderseite variabel positioniert. Reflektierende Oberflächen (Prizm, Chrome Refractors) erschweren OCR erheblich.

### Empfohlene Multi-Layer-Erkennung

**Layer 1 — Visual Image Recognition (primär):** Deep-Learning-Modelle oder Perceptual Hashing gegen eine Referenzdatenbank. CollX nutzt Modelle gegen 20M+ Karten. Ludex erreicht 98% First-Scan-Accuracy.

**Layer 2 — On-Device OCR (ergänzend):** Für Textextraktion (Spielername, Kartennummer, Copyright). Beste React-Native-Option:

```typescript
// @bear-block/vision-camera-ocr — Android: ML Kit, iOS: Apple Vision
import { useFrameProcessor } from 'react-native-vision-camera';
import { performOcr } from '@bear-block/vision-camera-ocr';

const frameProcessor = useFrameProcessor((frame) => {
  'worklet';
  const result = performOcr(frame, {
    includeBoxes: true,
    recognitionLevel: 'accurate',
    recognitionLanguages: ['en-US'],
  });
}, []);
```

**Layer 3 — Cloud AI (Fallback):** Google Cloud Vision API (1.000/Monat kostenlos, dann $1,50/1K) oder Ximilar OCR+LLM-Endpoint für Kartenidentifikation.

### React Native Libraries für Card Scanning

| Package | Zweck | Kosten |
|---------|-------|--------|
| `react-native-vision-camera` | Kamera + Frame Processing | Kostenlos |
| `@bear-block/vision-camera-ocr` | On-Device OCR (ML Kit / Apple Vision) | Kostenlos |
| `react-native-executorch` | On-Device ML mit useOCR Hook | Kostenlos |
| `react-native-document-scanner-plugin` | Karten-Edge-Detection + Crop | Kostenlos |
| `expo-ocr` | OCR via Expo Modules | Kostenlos |

### Dual-Scan-Workflow empfohlen

Die zuverlässigsten Identifikationsdaten stehen auf der **Kartenrückseite** (Nummer, Jahr, Set, Copyright). Empfehlung: **Vorderseite** für Visual Matching (Spielerfoto, Design), **Rückseite** für OCR-Textextraktion. Die schwierigste Herausforderung ist die Parallel-Erkennung (z.B. Green vs. Sonar Green Refractor) — subtile visuelle Unterschiede, die selbst erfahrene Sammler verwirren.

---

## 9. Gesamtübersicht: Kosten, Auth und TypeScript-SDKs

### Authentifizierungsmethoden im Vergleich

| Service | Auth-Methode | Token-Lifetime | TypeScript SDK |
|---------|-------------|---------------|----------------|
| eBay Browse API | OAuth 2.0 (Client Credentials) | 2h (Refresh: 18 Monate) | ✅ `ebay-api` npm |
| PSA Public API | OAuth 2.0 (Password Grant) | Session-basiert | ❌ Custom REST |
| BrickLink | OAuth 1.0 | Persistent | ⚠️ `bricklink-api` (veraltet) |
| PriceCharting/SportsCardsPro | API Token (Query-Param) | Persistent | ❌ Custom REST |
| CardHedger | Bearer Token | Persistent | ❌ Custom REST |
| Rebrickable | API Key (Header) | Persistent | ❌ OpenAPI-Spec verfügbar |
| BrickEconomy | API Key (`x-apikey` Header) | Persistent | ❌ Custom REST |
| Google Cloud Vision | API Key oder Service Account | Persistent / 1h | ✅ `@google-cloud/vision` |

### Kostenmatrix

| Service | Free Tier | Paid | Rate Limit (Free) |
|---------|-----------|------|--------------------|
| eBay Browse API | ✅ | — | 5.000/Tag |
| PSA API | ✅ | Kontakt für höhere Limits | **100/Tag** |
| BrickLink | ✅ | — | 5.000/Tag |
| Rebrickable | ✅ | — | Throttled |
| ML Kit / Apple Vision | ✅ (On-Device) | — | Unbegrenzt |
| Google Cloud Vision | ✅ (1.000/Monat) | $1,50/1K | 1.000/Monat |
| SportsCardsPro | ❌ | Abo (Legendary) | 1/Sekunde |
| CardHedger | 7-Tage-Trial | Ab $49/Monat | Kontaktabhängig |
| BrickEconomy | ❌ | Premium-Abo | 100/Tag |
| hobbyDB (Funko/HW) | ❌ | $1.200+ Setup + monatlich | Kontaktabhängig |
| TCGPlayer | ❌ **Geschlossen** für neue Entwickler | — | — |

---

## Empfohlene Integrationsarchitektur für PriceNinja

### Priorität 1 — Sofort implementieren

- **Scanner-Engine:** `react-native-vision-camera` + `@bear-block/vision-camera-ocr` für On-Device-OCR (kostenlos, offline)
- **Sports Card Pricing:** SportsCardsPro API (günstiger Einstieg) ODER CardHedger (umfangreicher, mit Computer Vision)
- **Aktive Listings:** eBay Browse API via `ebay-api` npm (kostenlos, bestes TypeScript-SDK)
- **Grading-Verification:** PSA Public API (kostenlos, 100/Tag)

### Priorität 2 — Kategorien mit guten APIs

- **LEGO:** BrickLink API (Preise) + Rebrickable API (Katalog) — beides kostenlos
- **Sold-Price-Daten:** SoldComps API (25 Free Requests/Monat) oder CardHedger (aggregiert eBay Sold Data)

### Priorität 3 — Kategorien mit eingeschränktem Zugang

- **Funko Pop:** Open-Source-Dataset (GitHub, 23K Items) + eBay-Pricing-Ergänzung
- **Panini Fußball-Sticker:** Eigene Checklist-DB aufbauen (TCDB als Referenz) + eBay für Preise
- **Hot Wheels / Action Figures:** eBay als einzige skalierbare Preisquelle; hobbyDB wenn Budget vorhanden ($1.200+)

### Kritische Lücken, die eigene Lösungen erfordern

1. **eBay Sold Data:** Kein einfacher API-Zugang mehr. Entweder CardHedger nutzen, SoldComps integrieren, oder eigene Aggregation aufbauen.
2. **Panini-Sticker-Checklisten:** Keine API existiert. Datenbank muss selbst aufgebaut oder von TCDB adaptiert werden.
3. **Action Figures / Hot Wheels / Beanie Babies:** Keine APIs. Nur über eBay-basiertes Pricing oder hobbyDB-Partnerschaft lösbar.
4. **BGS/CGC Grading:** Kein programmatischer Zugang — nur PSA bietet eine API. Für BGS/CGC: Web-Scraping oder manuelle Eingabe.

## Fazit

Die Sports-Card- und Collectibles-Welt ist **API-technisch weit hinter dem TCG-Ökosystem** (wo Scryfall, pokemontcg.io und Cardmarket kostenlose APIs bieten). Kein einzelner Anbieter deckt alles ab. Die pragmatischste Strategie für PriceNinja: **CardHedger oder SportsCardsPro als zentrale Pricing-Engine** für alle Sports Cards (WWE, Panini, NBA, NFL, MLB), **BrickLink für LEGO**, **eBay als universelles Fallback**, und **On-Device-OCR + Cloud-Vision als Scanner-Stack**. Die kostenintensivsten Kategorien für API-Zugang sind Funko/Hot Wheels (hobbyDB: $1.200+) und die Sold-Data-Lücke bei eBay. Der größte technische Aufwand liegt im Aufbau einer eigenen Kartenreferenz-Datenbank für Panini-Fußball-Sticker und in der visuellen Erkennung von Parallel-Varianten bei Sports Cards.