# CLAUDE.md

Diese Datei wird von Claude Code automatisch gelesen, bevor an diesem Projekt gearbeitet wird. Sie enthält die Regeln, die **immer** gelten: was ContainerLoad ist, was damit erreicht werden soll, und was beim Arbeiten nicht kippen darf.

Die **Begründungen** zu einzelnen Themen — Auslöser, Abwägung, gemessene Zahlen, zuständige Tests — stehen in [`docs/entscheidungen.md`](docs/entscheidungen.md). Abschnitt 8 ist der Wegweiser dorthin. **Vor einer Änderung an einem Thema erst den zugehörigen Abschnitt dort lesen.**

> **Diese Datei bleibt kurz.** Bis November 2026 stand alles hier; die Datei war 230 KB groß und ließ sich nicht mehr in einem Stück einlesen — was hinter dem ersten Fünftel stand, sah eine Sitzung nur, wenn sie gezielt weiterblätterte. Neue Entscheidungen gehören als Abschnitt ins Protokoll. Hierher kommt nur, was **jede** Sitzung wissen muss, und dann als eine Zeile, nicht als Geschichte.

---

## 1. Das Ziel hinter dem Projekt

ContainerLoad gibt Exporteuren, Spediteuren und der Allgemeinheit ein einfaches Werkzeug, um die Beladung von Containern zu berechnen — kostenlos, ohne Account, direkt im Browser. Die Vision: der grauen, traditionellen Speditionswelt (die heute oft mit Excel und Schätzung arbeitet) ein modernes, sofort nutzbares Tool entgegensetzen, das die Ladeberechnung sichtbar, schnell und zugänglich macht.

Drei Funktionen tragen das Produkt:
1. **Interaktiver 3D-Rechner** — Packstückmaße frei eingeben, Ergebnis live in 3D danebenstehen sehen.
2. **Teilen-Link** — eine eingegebene Ladung in einen Link kodieren und weitergeben; Empfänger sehen sie sofort, ohne Login.
3. **Ladevorschlag-PDF mit QR-Code** — druckbares Dokument, dessen QR-Code zurück auf den interaktiven 3D-Plan führt.

Langfristig soll das Projekt wachsen und auch monetarisierbare Funktionen tragen — aber der Kern bleibt: **schnell, ehrlich, ohne Hürden.**

**Leitprinzip bei jeder Änderung:** Macht es das Tool für jemanden an der Rampe oder am Schreibtisch klarer, schneller oder vertrauenswürdiger? Wenn nein, ist es wahrscheinlich die falsche Änderung.

**Arbeitsweise (seit 28.09.2026, von Jarek so erteilt):** Claude priorisiert selbst, was wichtig ist, und setzt es um — datengetrieben (GSC, Admin-Dashboard), im Zweifel entlang des Leitprinzips und des erklärten Ziels: ContainerLoad soll unter Spediteuren vom Geheimtipp zum Praxis-Werkzeug werden. Unverändert gilt: **Merges in main nur auf Jareks Zusage** (Push auf main deployt live), Rechtsseiten-Texte nur mit Rücksprache, und die Ehrlichkeitslinie ist nicht verhandelbar. Größere Richtungswechsel (neue Produktkapitel, Monetarisierung, Auftritt nach außen unter Jareks Namen) werden weiterhin vorgeschlagen, nicht vollzogen.

---

## 2. Technische Grundregeln (nicht verhandelbar ohne Rücksprache)

- **Kein Build-Schritt.** Reines statisches HTML. Kein Bundler, kein Framework-Build, nichts, was beim Deploy erst entstehen muss. Jede Datei muss durch bloßes Öffnen im Browser funktionieren. **Führe keine Build-Toolchain ein**, ohne dass der Projektinhaber das ausdrücklich will.
  - Die `package.json` an der Repo-Wurzel existiert **nur** für die Abhängigkeiten der Netlify Functions (`@netlify/blobs`, `@anthropic-ai/sdk`). Die Seite selbst braucht sie nicht.
  - Was generiert wird, ist **eingecheckt** (Abschnitt 7). Ein Generator in `werkzeug/` ist ein Werkzeug für den, der etwas ändert — kein Schritt, den die Seite zum Laufen braucht.
- **Die Seite liefert alles selbst aus** (Jareks Entscheidung, 10.11.26 — vorher kamen Tailwind, React, Three.js und die Schriften von drei fremden Servern):
  - **Tailwind CSS** als feste Datei `tailwind.css`, erzeugt von `werkzeug/tailwind/bauen.mjs`. **Nach jeder neuen Utility-Klasse in `app.html` oder `index.html` den Generator laufen lassen** — `test/tailwind-css.test.mjs` fällt sonst und nennt die Klasse. Arbitrary values funktionieren weiter. Die Zeile steht als **letztes** Stylesheet im `<head>` (dort hängte die frühere Laufzeit ihr `<style>` ein; weiter oben wäre es eine andere Kaskade).
  - **React 18.3.1** (UMD, production) und **Three.js r128** unter `vendor/`, unverändert aus den npm-Paketen (`werkzeug/bibliotheken/holen.mjs`, mit Prüfsumme). **Achtung:** r128-Einschränkungen beachten (z. B. kein `THREE.CapsuleGeometry`, OrbitControls nicht im Core). Version nicht ungefragt anheben.
  - **Schriften** unter `schrift/`: Archivo und JetBrains Mono für die Oberfläche, Manrope und Space Grotesk für den Ladevorschlag.
  - `qrcode-generator` ist **vendored** (MIT, K. Arase) in `app.html` als `window.__QRLIB`. Nicht durch ein npm-Paket ersetzen.
- **Kein fremder Server ohne Rücksprache.** Übrig ist genau einer: der Besucherzähler (`gc.zgo.at`). Jede weitere fremde Quelle sieht die IP-Adresse jedes Besuchers; sie gehört vorher in die Datenschutzerklärung und in `containerload.io/_headers` (Content-Security-Policy — was dort fehlt, blockiert der Browser stillschweigend). `test/eigene-dateien.test.mjs` hält die Liste fest.
- **Keine zusätzlichen Abhängigkeiten** ohne guten Grund und ohne Rücksprache. Jede neue Abhängigkeit ist Angriffsfläche und Ladezeit.

---

## 3. Dateien & Verantwortlichkeiten

Veröffentlicht wird der Ordner **`containerload.io/`** (Netlify, `netlify.toml`). **Alles darin ist öffentlich abrufbar** — interne Notizen, Entwürfe und Prototypen gehören nicht hinein. Einzige Ausnahme ist `containerload.io/test/`: Die Tests liegen neben `app.html`, weil sie daraus schneiden, und werden beim Deploy entfernt.

| Pfad | Rolle |
|---|---|
| `containerload.io/app.html` | **Herzstück.** Der React+Three.js-Rechner, alles in einer Datei (rund 11.000 Zeilen): Presets, Pack-/Stau-Algorithmus, Text-Import, Teilen-Kodierung, QR-Bibliothek, Druckvorlage (`LV_DOC`), beide Wörterbücher. Der Code ist kompiliertes JSX (`React.createElement`) und wird in dieser Form gepflegt. Hier mit Bedacht arbeiten. |
| `containerload.io/index.html` | Landingpage (DE/EN): Hero-Animation, Showcases, CBM-Rechner, FAQ. Bindet den Rechner **nicht** per iframe ein. |
| `containerload.io/share.html` | Branded Zwischenseite. Reicht den Query-String nach ~450 ms unverändert an `/app` weiter. |
| `containerload.io/admin.html` | Dashboard der Nutzungsstatistik (`/admin`, Token-Pflicht, `noindex`). |
| `containerload.io/impressum.html`, `datenschutz.html` | Rechtsseiten. **Inhaltliche Änderungen nur mit Rücksprache.** |
| `containerload.io/ratgeber/`, `en/guide/`, `nl/gids/` | Container-Wissen (DE, EN, NL) — statische Seiten mit gemeinsamer `ratgeber/wissen.css`. Die Zahlen darin sind an den Packer gekoppelt (Tests). |
| `containerload.io/karte/`, `welt-karte.js` | Hafenkarte und Admin-Weltkarte. `haefen.js`, `land.js`, `welt-karte.js` sind **generiert** (`werkzeug/`) — nie von Hand ändern. |
| `containerload.io/tailwind.css`, `vendor/`, `schrift/` | Tailwind-CSS, React + Three.js und die Schriften — selbst ausgeliefert und **generiert** bzw. unverändert übernommen (`werkzeug/`). Nie von Hand ändern. |
| `containerload.io/_headers`, `_redirects`, `sitemap.xml`, `robots.txt` | Netlify-Header (CSP), saubere Pfade, Suchmaschinen. |
| `containerload.io/test/` | Regressionstests (`node --test`, ohne npm), Messstand unter `test/bench/`. |
| `netlify/functions/` | `beacon` + `statistik` + `aufraeumen` (anonyme Nutzungsstatistik; `aufraeumen` läuft geplant und löscht nach zwölf Monaten), `ki-import` / `ki-brief` / `ki-chat` (KI-Funktionen, mit Limit je Client). Reine Logik liegt in `lib/` und ist ohne installierte Abhängigkeit testbar. |
| `werkzeug/` | Generatoren für die generierten Dateien (Karten, `tailwind.css`, `vendor/`, `schrift/`). Nicht deployt. |
| `docs/entscheidungen.md` | Das Entscheidungsprotokoll (siehe Abschnitt 8). |

---

## 4. Verträge, die nicht brechen dürfen

Vor Änderungen daran erst nachfragen.

### Adressen (der „Vertrag" zwischen den Seiten und mit allem, was schon verschickt wurde)

- **`?c=<kompakt>`** — die geteilte Ladung im aktuellen Format (`compactEncode` / `compactDecode`). Die Code-Tabelle (`V2_PRESET_CODES`) ist **stabil**: Codes nie umbelegen oder löschen, nur neue Buchstaben ergänzen.
- **`?p=<base64>`** — das alte Format (`{ pr, co:{l,w,h,p}, it:[{n,l,w,h,wt,q,s,r}] }` als URL-sicheres base64-JSON). Es wird nicht mehr erzeugt, aber **für immer dekodiert**: alte Links und gedruckte QR-Codes müssen weiter öffnen.
- **`?q=<text>`** — Ladung als Text (`parseCargoText`), z. B. „20 Europaletten 120x80x110 stapelbar". Dazu `&cont=` (Bauart aus einer festen Liste) und `&d=road`. Alle Ratgeber-Seiten führen über `?q=` in den Rechner.
- **`?lang=en`** — Englisch. Der Teilen-Link trägt es mit.
- **`&id=`** (Plan-Kennung) und **`&ok=`** (Verladen-Meldung) hängen am Teilen-Link, **`?rampe=1`** öffnet den Rampen-Modus.
- `share.html` und `app.html` müssen dieselben Parameter verstehen; `share.html` reicht den Query-String unverändert durch.

Wer ein Kodierungsschema ändert, macht **alle bereits geteilten Links und gedruckten QR-Codes ungültig.** Das ist eine bewusste, schwerwiegende Entscheidung — niemals beiläufig.

### Container-Presets (Maße in cm, Zuladung in kg)

| Preset | L | B | H | Zuladung |
|---|---|---|---|---|
| 20' GP | 590 | 235 | 239 | 28200 |
| 20' HC | 590 | 235 | 270 | 28150 |
| 40' GP | 1203 | 235 | 239 | 26600 |
| 40' HC | 1203 | 235 | 270 | 26580 |
| 45' HC | 1355 | 235 | 270 | 27600 |

Dazu Special Equipment (Open Top, Flat Rack, Platform, Reefer), die Landfracht-Fahrzeuge und „Custom". Diese Werte sind real und mit den Speditionstabellen abgeglichen — **nicht ohne Quelle ändern**. Die Wissensseiten rechnen mit denselben Zahlen; Tests koppeln beide.

**Reederei-Presets** (`CARRIERS`) überschreiben nur die Geometrie, nie die Zuladung; fehlt ein Typ bei einer Reederei, sagt die Oberfläche das; neue Werte nur mit Quelle. Einzelheiten im Protokoll.

### Was im Browser gespeichert wird

Schlüssel in `localStorage` (`cl_theme`, `cl_lang`, `cl_unit`, `containerload.draft.v1`, `containerload.plans.v1`, `containerload.carrier.v1`, `cl-fassungen-v1`, `cl-rampe-v1:` …) stehen teils **namentlich in der Datenschutzerklärung**. Wer einen neuen Speicher oder ein neues übertragenes Feld einführt, klärt zuerst den Text dort — und der ändert sich nur mit Rücksprache.

---

## 5. Ehrlichkeit

**Nicht mehr behaupten, als das Tool weiß.** Das gilt für UI-Texte, Marketing, Wissensseiten und den Ladevorschlag.

- Der Kern ist eine **geometrische Stauung**. Was darüber hinausgeht, ist ein **Richtwert und heißt auch so**: die Gewichtsverteilung, die Achslast (nur für den Sattelzug, mit sichtbar danebenstehenden Annahmen), das Straßenlimit je Land, der Sicherungs-Check (er nennt **Orte, keine Mittel**).
- Nichts davon ist eine Garantie, und nichts ersetzt die fachliche Prüfung der Ladungssicherung. Die bestehenden „unverbindlich"- und „keine Achslast-Garantie"-Hinweise nicht entfernen oder abschwächen.
- **Lieber keine Zahl als eine geratene.** Wo die Grundlage fehlt (Achsgeometrie anderer Fahrzeuge, Zuladung je Reederei-Baureihe), steht nichts.
- **Der Rechner rät nicht still.** Eine unsichere Lesart (mm statt cm) wird als Verdacht gemeldet und erst nach Bestätigung umgerechnet.
- **Die KI liest, formuliert und bedient — sie rechnet nicht.** Jede Ergebniszahl kommt aus dem Packer. Importierte Positionen bestätigt ein Mensch in der Prüf-Tabelle; Stevies Änderungen laufen über dieselben Stellschrauben wie von Hand und lassen sich zurücknehmen.

---

## 6. Regelwerk der Oberfläche (gilt für `app.html` wie für `index.html`)

`containerload.io/test/design-system.test.mjs` hält fest, dass die Marken die vereinbarten Werte tragen **und** dass daneben keine Zahl im Markup steht. Wer eine Stufe wirklich braucht, trägt sie oben in `app.html` ein und passt den Test an; dann ist es eine Entscheidung und kein Versehen.

Die Skala steht als erstes im Modul, noch vor `var C`:

```js
var FS   = { label: 11.5, small: 12.5, body: 13.5, lead: 15, h3: 17, h2: 20 };
var FW   = { label: 500, body: 500, semi: 600, bold: 700 };
var NUMS = { s: 15, m: 20, l: 26 };      // Kennzahlen, Monospace, tabular-nums
var R    = { s: 8, l: 16 };              // ZWEI Radien, mehr nicht
var SP   = { xs: 4, s: 8, m: 12, l: 16, xl: 24, xxl: 32 };
var ICO  = { s: 16, m: 20, sw: 1.5 };
```

| | |
|---|---|
| Flächen | **sechs Stufen**, Grundton `#0E1116` (dunkel) bzw. `#EEF1F6` (hell) |
| Radien | **zwei**: `R.s` (8) für alles, was man anfasst — Knopf, Feld, Pille; `R.l` (16) für Flächen, auf denen etwas steht — Karte, Dialog. Dazu `999` für die echte Pille und `"50%"` für den Kreis |
| Schriftgrößen | nur `FS.*` / `NUMS.*`, **keine Zahl im Markup**. Nichts unter 11,5 px |
| Gewichte | nur `FW.*`, bis **700**, nicht darüber |
| Abstände | **4 · 8 · 12 · 16 · 24 · 32**, nichts dazwischen — als `SP.*` inline und als Tailwind-Klasse (`p-1/2/3/4/6/8`, **kein `p-5`**, das sind 20) |
| Symbole | **eine** Linienstärke (`ICO.sw` = 1,5) und zwei Größen (16 / 20). Nichts darunter |
| Monospace | **nur an Zahlen** (ab `FS.small`) und am Teilen-Link. Ziffern bleiben untereinander stehen — als Kleintext ist sie Kostüm |
| Farbe | **ein** Akzent (`C.accent` = `C.hint`) · neutral = eine Zahl · grün = passt · orange = wird knapp · rot = Grenze überschritten · Akzentblau = Auswahl, **nie** eine Kennzahl |
| Fläche | **ein Ton**, kein Verlauf. Verläufe nur dort, wo ein Bild entsteht: hinter der 3D-Bühne und als Vignette darüber |
| Zahlen | über `nf()` / `fmtDE()`, nie `toFixed()` in der Anzeige — sonst steht in der deutschen Oberfläche „0.03 m" |
| Emoji | keine. Linien-SVG oder das Wort |

**Die Druckvorlage (`LV_ROW` … `LV_DOC`) ist ausgenommen.** Sie ist ein eigenes Dokument: A4, weißes Papier, andere Schrift.

Was darüber hinaus immer gilt (Herleitung jeweils im Protokoll):

- **Alle Farben fließen durch `C`** (Oberfläche) und `B` (3D-Bühne), je ein dunkler und ein heller Satz mit denselben Schlüsseln. Voreinstellung ist die Systemeinstellung, die Hand-Wahl liegt unter `cl_theme` und gilt für Startseite, Rechner, Wissens- und Randseiten gemeinsam (die letzten beiden lesen sie nur). Die Kontrast-Wache rechnet WCAG 4,5:1 für beide Sätze nach.
- **Die Falle dabei: Modul-Ebene friert ein.** Eine Modul-Konstante, die `C.*` als *Wert* liest (Objekt-Literal), behält den Satz vom Laden. Komponenten und Getter sind sicher.
- **Wiederkehrende Muster sind Komponenten mit festen Varianten:** `Btn` (primary / accent / ghost / quiet), `Card`, `Seg`, `Kpi`, `Lbl`. Auswahlreihen sind Raster (`segGrid`), keine umbrechenden Reihen.
- **Getrennt wird über die Fläche, nicht über eine Linie.** Ein Rahmen bleibt dem vorbehalten, was ausgewählt ist oder warnt.
- **Es gibt genau eine Ergebnisanzeige** — die Leiste an der 3D-Ansicht. Wer eine neue Kennzahl einbaut, baut sie dort ein. Zahlen groß in Monospace, Beschriftung klein darüber.
- **Zweisprachig, immer beide:** Jeder sichtbare Text braucht DE und EN (`I18N` in `app.html`, `data-i18n` + `EN` in `index.html`). Tests prüfen Parität und melden unbenutzte Schlüssel.
- **Das Telefon nicht kaputtmachen.** Desktop ist der Komfort-Fall, aber das Tool muss im mobilen Browser nutzbar bleiben; keine Seite darf sich seitlich schieben lassen.

---

## 7. Arbeitsweise

- **Auf einem Branch arbeiten, niemals direkt auf `main` committen.** Push auf `main` deployt live. Änderungen als Branch/Pull-Request anlegen, damit Jarek sie über die Netlify-Vorschau prüfen kann.
- **Kleine, nachvollziehbare Commits** mit klaren Beschreibungen — auf Deutsch ist völlig in Ordnung.
- **Tests:** `node --test test/*.mjs` im Ordner `containerload.io/` (ohne npm, rund 30 Sekunden). Die CI führt dasselbe bei jedem Pull Request aus.
  - Viele Tests schneiden Funktionen an Textankern aus `app.html` (`new Function`). Wer Code verschiebt oder umbenennt, sucht vorher nach dem Namen in `test/`.
  - Neue Tests prüfen nach Möglichkeit **Verhalten** (Funktion ausführen, Ergebnis vergleichen). Ein Textvergleich am Quelltext ist die Notlösung für das, was sich ohne Browser nicht ausführen lässt.
- **Wer an `emsSearch` oder `emsPackOnce` etwas ändert, misst vorher und nachher:** `node test/bench/fuellgrad.mjs app.html` über 300 deterministische Ladungen. Verladene Packstücke und belegtes Volumen dürfen nicht sinken.
- **Im Browser ansehen**, wenn am Rechner gearbeitet wurde: 3D-Ansicht lädt, eine Ladung lässt sich eingeben, der Teilen-Link öffnet sie korrekt, der Ladevorschlag druckt sauber, DE↔EN schaltet um — in Hell **und** Dunkel, am Schreibtisch **und** auf dem Telefon.
  - **Lokal sieht man dasselbe wie live** — auch ohne Netz, seit nichts mehr von einem CDN kommt. Wer eine Ressource hinzufügt, liefert die Seite zum Ansehen einmal **mit** der Policy aus `_headers` aus: eine blockierte Datei macht keinen Lärm, sie fehlt einfach.
  - **Die Tailwind-Falle:** eine neue Utility-Klasse ohne Generator-Lauf hat keine Regel. Der Test meldet es; wer ihn nicht laufen lässt, sieht ein Layout, das an genau dieser Stelle bricht.
- **Performance im Blick behalten:** keine schweren Abhängigkeiten, Bilder klein halten, schneller erster Eindruck.
- **Generierte Dateien** (`tailwind.css`, `vendor/`, `schrift/`, `karte/haefen.js`, `karte/land.js`, `welt-karte.js`, die Top-50-Tabellen zwischen `HK_TOP50_START/ENDE`) entstehen aus `werkzeug/` — Generator ändern und laufen lassen, nie die Ausgabe. Die Befehle stehen in `werkzeug/README.md`.
- Bei Unsicherheit über eine produktbezogene Entscheidung (Feature-Verhalten, Texte, Presets) **lieber kurz nachfragen**, statt zu raten.

---

## 8. Wegweiser ins Protokoll

`docs/entscheidungen.md` ist nach Themen gegliedert; die Namen unten sind die Überschriften dort (suchen statt blättern). **Erst lesen, dann ändern** — fast jeder Abschnitt nennt eine Falle, die schon einmal zugeschnappt ist, und den Test, der sie bewacht.

| Wenn du arbeitest an … | lies dort |
|---|---|
| **Packer, Stapeln, Stauen** | Füllreihenfolge im Einzeltyp-Pfad · Kein Überstand · Stufe 3: ordentlich stauen · `makeFloorPacker` · Was `stackMax` bedeutet · Die zweite Stapelgrenze (`stackH`) · „Nicht stapelbar" heißt beides · Übermaß ohne Drehen-Erlaubnis · Der Ladeweg je Bauart · Karton auf Palette |
| **mehreren Containern** | Zwei Ziele, zwei Stufen · Gleiche Ware in denselben Container · Die Container-Kette · Mehr als ein Container ist ein Entschluss · Weiterpacken auf einer Vorbelegung · Die Zuweisung je Position · Der manuelle Modus je Container · Der Fokus · Volumen und Gewicht je Container |
| **Gewicht, Straße, Sicherung** | Straßenlimit je Land · Achslasten für den Sattelzug · Die Gewichtsanzeige und die Überladung · Der Ladungssicherungs-Check · VGM-Vorbereitung und Gefahrgut-Kennzeichnung · Multi-Stopp |
| **Oberfläche des Rechners** | Layout des Rechners · Das Regelwerk · Hell und Dunkel (Phasen 1–3, Bühnen-Palette, Startseite) · Die Ergebnisleiste zeigt vier Zahlen · Das Empfehlungsbanner · Die Empfehlung rechnet auch rückwärts · Auf dem Telefon · Der Fehlerschirm |
| **3D-Ansicht** | Die 3D-Ansicht steht still · Die Kamera darf ihren Mittelpunkt verlassen · Die „Warum?"-Animation der Türprüfung · Die 3D-Ansicht zeigt kein Türblatt mehr · Positionsnummern in 3D |
| **Ladevorschlag, Export, Rampe** | Ladevorschlag und CSV je Container · Die Belade-Reihenfolge im Ladevorschlag · Der Rampen-Modus · Das Rampen-Blatt · Der Bildexport rahmt die ganze Reihe · Die Vorschaubilder beim Teilen |
| **Teilen, Entwurf, Zusammenarbeit** | Der Entwurf, das Rückgängig und der leere Start · Der Teilen-Anstoß · Der Empfänger-Hinweis auf geteilten Plänen · Zusammenarbeit über den Link · Reederei-Presets |
| **Import und KI** | Der Import-Parser rät nicht still · Maßangaben im Fließtext · Der KI-Import — Stufen 1–4 (Import, Foto, Brief, Stevie) |
| **Messen und Rückmeldung** | Messen und melden: die zwei Rückkanäle · Anonyme Nutzungsstatistik und das Admin-Dashboard · Leere Aufrufe stehen getrennt · Die Feedback-Frage fragt Wiederkehrer · Limit je Client vor der KI und der Fehlerzähler · Aufbewahrung: zwölf Monate |
| **Startseite** | Die Startseite verkauft, der Rechner bedient · Die Startseite atmet · Die Hero-Animation · Die Startseiten-Snippets · Der CBM-Rechner |
| **Wissensseiten und Suche** | Container-Wissen (`/ratgeber/`) · Die zwei Top-Seiten · Die vertieften Seiten · Der Container Guide (`/en/guide/`) · Die Sichtbarkeits-Wellen (im Abschnitt „Gleiche Ware …") · Der Lademeter-Rechner · Die Hafenkarte · Hell und Dunkel auf Wissens-, Rechts- und Teilen-Seiten |
| **Sprachen, Schrift, Randseiten** | Zweisprachigkeit (DE/EN) · Zwischen den Sprachen darf nichts liegenbleiben · Die Font-CSS lädt asynchron · Randseiten · Die Seite liefert alles selbst aus |
| **Deploy und Functions** | Deploy: Lockfile, Publish-Verzeichnis, Statistik-Abruf · Die Seite liefert alles selbst aus · Limit je Client vor der KI und der Fehlerzähler · Aufbewahrung: zwölf Monate · Anonyme Nutzungsstatistik und das Admin-Dashboard · Der KI-Import — Stufen 1–4 |

---

## 9. Offene Punkte

- **`app.html` ist eine Datei.** Die reine Logik (Packer, Parser, Link-Kodierung, Presets) in eigene Skriptdateien zu legen, wäre ohne Build-Schritt möglich und würde Tests, Caching und einen Web Worker für den Packer erlauben. Noch nicht entschieden; bis dahin gilt die Anker-Regel aus Abschnitt 7.
- **Die Datenschutzerklärung nennt noch die drei früheren Dienste** (Google Fonts, Tailwind-CDN, cdnjs) und kennt Limit je Client, Fehlerzähler und Aufbewahrungsfrist noch nicht. Der Text ändert sich nur mit Jareks Zusage; der Vorschlag steht im Pull Request [#158](https://github.com/jarekvibe/containerload.io/pull/158). Diesen Punkt streichen, sobald der Text steht.

---

## 10. Kurz gesagt

Statisches HTML, kein Build, alles vom eigenen Server, zweisprachig, ehrlich in der Genauigkeit. Auf einem Branch arbeiten, die Adress-Verträge respektieren, vor Änderungen den Abschnitt im Protokoll lesen — und die Vision im Kopf behalten: **die Ladeberechnung für alle einfach, schnell und vertrauenswürdig machen.**
