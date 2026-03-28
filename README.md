# PriceNinja

**KI-gestützter Preisscanner für Artikel & Sammelkarten**

Scanne einen Artikel mit der Kamera — PriceNinja erkennt ihn via KI und ruft sofort die aktuellen Marktpreise von eBay und Geizhals ab.

---

## Download

**[Neueste APK herunterladen](https://github.com/Pcf1337-hash/PriceNinja/releases/latest)**

1. APK-Datei herunterladen
2. Auf Android öffnen und installieren
3. Falls nötig: Einstellungen → Sicherheit → Unbekannte Quellen erlauben

Mindestanforderung: Android 7.0 (API 24)

---

## Features

- KI-Bilderkennung — Foto aufnehmen, Artikel wird automatisch erkannt (Claude Vision)
- eBay Verkaufspreise — Durchschnitt aus echten Verkäufen (Browse API)
- Geizhals Neupreis — Günstigster Händlerpreis in Deutschland
- Sammelkarten — Pokémon, Yu-Gi-Oh!, Magic: The Gathering erkennen & bewerten
- Preisverlauf — Lokaler Chart mit eigener Preisentwicklung
- Dashboard — Alle getrackten Artikel im Überblick
- Themes — Futuristic Dark, Cyberpunk, Anime Neon, Minimal Clean u.v.m.
- Auto-Update — App prüft beim Start auf neue Versionen über GitHub Releases

---

## App einrichten

Nach der Installation in den Einstellungen konfigurieren:

| Einstellung | Beschreibung |
|---|---|
| Claude API Key | Für KI-Bilderkennung — console.anthropic.com |
| eBay Verbindung | Papa eBay (nur Preise) oder eigener Account (+ Verkaufen) |
| Aktualisierungsintervall | 1h / 2h / 6h / 12h / 24h |

---

## Tech Stack

React Native · Expo SDK 52 · TypeScript · NativeWind v5 · Zustand · Claude Haiku Vision · eBay Browse API · Geizhals.de

---

## Release erstellen

```bash
git tag v1.0.1
git push origin v1.0.1
```

GitHub Actions baut automatisch die APK und veröffentlicht sie als Release.
