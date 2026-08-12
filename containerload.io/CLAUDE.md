# CLAUDE.md

Diese Datei wird von Claude Code automatisch gelesen, bevor an diesem Projekt gearbeitet wird. Sie beschreibt **was ContainerLoad ist, was damit erreicht werden soll, und welche Regeln beim Arbeiten gelten.**

---

## 1. Das Ziel hinter dem Projekt

ContainerLoad gibt Exporteuren, Spediteuren und der Allgemeinheit ein einfaches Werkzeug, um die Beladung von Containern zu berechnen — kostenlos, ohne Account, direkt im Browser. Die Vision: der grauen, traditionellen Speditionswelt (die heute oft mit Excel und Schätzung arbeitet) ein modernes, sofort nutzbares Tool entgegensetzen, das die Ladeberechnung sichtbar, schnell und zugänglich macht.

Drei Funktionen tragen das Produkt:
1. **Interaktiver 3D-Rechner** — Packstückmaße frei eingeben, Ergebnis live in 3D danebenstehen sehen.
2. **Teilen-Link** — eine eingegebene Ladung in einen Link kodieren und weitergeben; Empfänger sehen sie sofort, ohne Login.
3. **Ladevorschlag-PDF mit QR-Code** — druckbares Dokument, dessen QR-Code zurück auf den interaktiven 3D-Plan führt.

Langfristig soll das Projekt wachsen und auch monetarisierbare Funktionen tragen — aber der Kern bleibt: **schnell, ehrlich, ohne Hürden.**

**Leitprinzip bei jeder Änderung:** Macht es das Tool für jemanden an der Rampe oder am Schreibtisch klarer, schneller oder vertrauenswürdiger? Wenn nein, ist es wahrscheinlich die falsche Änderung.

---

## 2. Technische Grundregeln (nicht verhandelbar ohne Rücksprache)

- **Kein Build-Schritt.** Reines statisches HTML. Kein npm, kein Bundler, kein Framework-Build, kein PostCSS. Jede Datei muss durch bloßes Öffnen im Browser funktionieren. **Führe keine Build-Toolchain ein**, ohne dass der Projektinhaber das ausdrücklich will.
- **Bibliotheken kommen per CDN**, nicht aus node_modules:
  - Tailwind CSS — Runtime über `cdn.tailwindcss.com` (kein kompiliertes CSS; arbitrary values funktionieren, eine eigene Config nur inline via `tailwind.config = {…}`).
  - React **18.3.1** (UMD, production) von cdnjs.
  - Three.js **r128** von cdnjs. **Achtung:** r128-Einschränkungen beachten (z. B. kein `THREE.CapsuleGeometry`, OrbitControls nicht im Core). Version nicht ungefragt anheben.
  - `qrcode-generator` ist **vendored** (MIT, K. Arase) in `app.html` als `window.__QRLIB`. Nicht durch ein npm-Paket ersetzen.
- **Keine zusätzlichen Abhängigkeiten** ohne guten Grund und ohne Rücksprache. Jede neue externe Abhängigkeit ist Angriffsfläche und Ladezeit.

---

## 3. Dateien & Verantwortlichkeiten

| Datei | Rolle |
|---|---|
| `index.html` | Landingpage. Hero, Features, FAQ, CTA. Bindet `app.html` per iframe ein. Zweisprachig. |
| `app.html` | **Herzstück.** Der React+Three.js-Rechner. Enthält Container-Presets, Pack-/Stau-Algorithmus, Teilen-Kodierung, QR-Bibliothek, Text-Import. Mit Abstand die größte Datei (~1300 Zeilen) — hier mit Bedacht arbeiten. |
| `share.html` | Branded Zwischenseite. Liest den `?p=`-Parameter und leitet nach ~450 ms per `location.replace` auf `app.html` mit demselben Query-String weiter. |
| `Ladevorschlag-Render.html` | Druck-/PDF-Vorlage (`@media print`, `window.print()`). Enthält den QR-Code zurück zum 3D-Plan und mehrere Haftungs-Hinweise. |
| `impressum.html`, `datenschutz.html` | Rechtsseiten. Inhaltliche Änderungen nur mit Rücksprache. |
| `og.png`, `share-og.png` | Social-Vorschaubilder (1200×630). |

---

## 4. Mechanismen, die nicht brechen dürfen

Diese Verträge halten das Produkt zusammen. Vor Änderungen daran erst nachfragen.

### URL-Parameter (der „Vertrag" zwischen den Seiten)
- **`?p=<base64>`** — die geteilte Ladung. Das State-Objekt (`{ pr, co:{l,w,h,p}, it:[{n,l,w,h,wt,q,s,r}] }`) wird als JSON serialisiert, dann **URL-sicher base64-kodiert** (`+`→`-`, `/`→`_`, `=` entfernt). Decode macht den umgekehrten Weg. `share.html?p=…` und `app.html?p=…` müssen denselben Parameter verstehen.
- **`?q=<text>`** — natürlichsprachiger Ladungs-Import (`parseCargoText`), z. B. „20 Europaletten 120x80x110 stapelbar".
- **`?lang=en`** — schaltet auf Englisch.

Wer das Kodierungsschema ändert, macht **alle bereits geteilten Links und gedruckten QR-Codes ungültig.** Das ist eine bewusste, schwerwiegende Entscheidung — niemals beiläufig.

### Container-Presets (Maße in cm, Zuladung in kg)
| Preset | L | B | H | Zuladung |
|---|---|---|---|---|
| 20' GP | 590 | 235 | 239 | 28200 |
| 20' HC | 590 | 235 | 270 | 28150 |
| 40' GP | 1203 | 235 | 239 | 26600 |
| 40' HC | 1203 | 235 | 270 | 26580 |
| 45' HC | 1355 | 235 | 270 | 27600 |

Plus „Custom". Diese Werte sind real und mit den Speditionstabellen abgeglichen — nicht ohne Quelle ändern.

### Reederei-Presets (`CARRIERS` in `app.html`)
Über der Container-Auswahl steht eine Reederei-Wahl (Maersk, CMA CGM, COSCO, Hapag-Lloyd, ONE, Evergreen, HMM, Yang Ming). Sie überschreibt **nur die Geometrie** des gewählten Typs — Innenlänge/-breite/-höhe und Türöffnung, in cm mit einer Nachkommastelle (= Millimeter, so wie veröffentlicht).

Drei Regeln, die dabei nicht kippen dürfen:
- **Die Zuladung bleibt der Standardwert des Typs.** Die Reedereien geben sie je nach Baureihe und zulässigem Gesamtgewicht (24 t / 30,48 t / 32,5 t) an, teils als Spanne. Eine einzelne Zahl daraus wäre Schein-Genauigkeit.
- **Fehlt ein Typ bei einer Reederei, gilt der Standard — und die Oberfläche sagt das** (Hinweiszeile unter der Maßkarte). Nicht stillschweigend Standardwerte als Reederei-Werte ausgeben.
- **Quelle ist die offizielle Equipment-Seite der Reederei** (in `src` je Eintrag). Neue Werte nur mit Quelle, und `test/reederei-presets.test.mjs` fängt Einheiten- und Tippfehler ab.

Special Equipment (Open Top, Flat Rack, Platform) und „Custom" bleiben von der Reederei-Wahl unberührt. Die Wahl steckt **nicht** im `?c=`-Link — die Maße selbst reisen dort ohnehin mit; gemerkt wird sie lokal unter `containerload.carrier.v1`.

### Layout des Rechners (`app.html`)
Ab `lg` ist der Rahmen **genau ein Fenster hoch** (`lg:h-screen lg:overflow-hidden`): Kopfzeile, 3D-Ansicht, Statuszeile und Fußzeile stehen fest, gescrollt wird nur **innen** in der Seitenleiste (`lg:min-h-0 lg:overflow-y-auto`, **keine** feste `maxHeight`). Wer der Seitenleiste wieder eine eigene Höhe gibt oder dem äußeren Rahmen das `overflow-hidden` nimmt, holt sich das alte Problem zurück: die Seite wird höher als das Fenster und die Statuszeile rutscht darunter. Unter `lg` (Telefon) scrollt die Seite bewusst normal.

In der Ladungsliste ist **genau eine Position aufgeklappt** (`openCargo`); die übrigen stehen als einzeilige Zusammenfassung da (`cargoSummary`). Neu angelegte Positionen klappen automatisch auf.

### Zweisprachigkeit (DE/EN)
- **Deutsch ist die Ausgangssprache.** Texte stehen direkt im HTML mit `data-i18n="key"`-Attributen.
- Englisch wird über ein `EN = { key: … }`-Wörterbuch im Inline-JS überlagert. Sprachwahl in `localStorage` unter `cl_lang`.
- **Regel: Jeder neue sichtbare Text braucht einen `data-i18n`-Schlüssel und einen passenden EN-Eintrag.** Niemals nur eine Sprache hinzufügen — sonst bricht die Parität.

---

## 5. Arbeitsweise & Guardrails

- **Auf einem Branch arbeiten, niemals direkt auf `main` committen.** Änderungen als Branch/Pull-Request anlegen, damit der Projektinhaber sie über die Netlify-Vorschau prüfen kann, bevor sie live gehen.
- **Kleine, nachvollziehbare Commits** mit klaren Beschreibungen — auf Deutsch ist völlig in Ordnung.
- **Ehrlichkeit in allen Texten wahren.** Die Berechnung ist **rein geometrisch**. Schwerpunkt, Achslast und Ladungssicherung sind *nicht* enthalten. UI-Texte, Marketing und PDF dürfen **niemals** mehr Genauigkeit oder rechtliche Verbindlichkeit suggerieren, als das Tool liefert. Die bestehenden „unverbindlich"-Hinweise nicht entfernen oder abschwächen.
- **Testen ohne Server:** Datei im Browser öffnen. Wichtig zu prüfen, wenn am Rechner gearbeitet wurde: 3D-Ansicht lädt, eine Ladung lässt sich eingeben, Teilen-Link öffnet die Ladung korrekt, PDF/Druck sieht sauber aus, DE↔EN-Umschaltung funktioniert.
- **Das responsive Verhalten nicht kaputtmachen.** Desktop ist der Komfort-Fall, aber das Tool muss im mobilen Browser nutzbar bleiben.
- **Performance im Blick behalten:** keine schweren Abhängigkeiten, Bilder klein halten, schneller erster Eindruck.
- Bei Unsicherheit über eine produktbezogene Entscheidung (Feature-Verhalten, Texte, Presets) **lieber kurz nachfragen**, statt zu raten.

---

## 6. Bekannte Punkte / Backlog

- **OG-Image in `share.html`:** Vorschaubild und Referenz sind auf `share-og.png` (mit Bindestrich) vereinheitlicht; `share.html` (`og:image`/`twitter:image`) zeigt korrekt auf die tatsächlich im Repo vorhandene Datei `share-og.png`. (Frühere Doku nannte die Datei fälschlich `shareog.png` ohne Bindestrich — korrigiert.)
- **Netlify-Auto-Deploy:** Soll künftig aus diesem Repo deployen (statt manuellem Upload). Ggf. eine `netlify.toml` und/oder `_redirects` ergänzen — aber erst nach Rücksprache, da sich dadurch ändert, *wie* die Live-Seite gebaut wird.

---

## 7. Kurz gesagt

Statisches HTML, kein Build, CDN-Bibliotheken, zweisprachig, ehrlich in der Genauigkeit. Auf einem Branch arbeiten, die URL-Verträge respektieren, die Vision im Kopf behalten: **die Ladeberechnung für alle einfach, schnell und vertrauenswürdig machen.**
