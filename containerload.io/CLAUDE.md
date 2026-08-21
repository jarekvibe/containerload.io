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
**Drei Spalten ab 1440 px:** links Container und Werkzeuge, in der Mitte die 3D-Ansicht, rechts die Ladung. Darunter fällt es auf zwei Spalten zurück und die Ladung rückt unter den Container. Diese Entscheidung trifft **JavaScript** (`wide` per `matchMedia`), nicht ein Tailwind-Breakpoint — der Ladungsbereich wechselt die Spalte, und das kann CSS nur, wenn man ihn zweimal in die Seite schreibt. Deshalb liegt er als `cargoEl` in einer Variablen (dasselbe Muster wie `railEl`).

**Die Container-Spalte steht zusammengeklappt.** Sichtbar ist die Maßkarte; „Ändern" holt Typ, Länge, Höhe und Reederei zurück und lässt sie offen, bis man „Fertig" drückt. Grund: Der Container wird einmal je Plan gewählt, die Ladung dreißigmal bearbeitet. Nichts klappt von selbst zu, während jemand arbeitet.

**Es gibt genau eine Ergebnisanzeige** — die Leiste unter der 3D-Ansicht. Die früher darüber schwebende Karte zeigte dieselben Zahlen ein zweites Mal. Im 3D-Bild bleibt nur, was räumlich dazugehört: Tür-Warnung, Übermaß-Kasten, Empfehlungsbanner. Wer eine neue Kennzahl einbaut, baut sie in die Leiste.

### Das Regelwerk (gilt für `app.html` wie für `index.html`)
PR #57 hat die Landingpage entschlackt, PR #68 dieselben Regeln in den Rechner gezogen, und der Design-Durchgang vom August 2026 hat sie aus dem Markup in **Marken** geholt. `test/design-system.test.mjs` hält beides fest: dass die Marken die vereinbarten Werte tragen, **und** dass daneben keine Zahl im Markup steht. Wer eine Stufe wirklich braucht, trägt sie oben in `app.html` ein und passt den Test an; dann ist es eine Entscheidung und kein Versehen.

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
| Flächen | **sechs Stufen**, Grundton `#0E1116` (identisch mit der Landingpage — sie bindet den Rechner per iframe ein) |
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

**Die Druckvorlage (`LV_ROW` … `LV_DOC`) ist ausgenommen.** Sie ist ein eigenes Dokument: A4, weißes Papier, andere Schrift. Der Test überspringt diesen Bereich; wer dort arbeitet, arbeitet in dessen eigener Ordnung.

**Zahlen dominieren, Beschriftungen sind klein und ruhig.** Ein Ladungsrechner wird nach Zahlen gelesen. Deshalb steht bei einer Kennzahl die **Beschriftung oben und klein** (`Lbl`, `FS.label`) und die **Zahl darunter groß** in Monospace mit `tabular-nums` — dafür gibt es `Kpi`. Fließtext wird davon nicht größer.

**Getrennt wird über die Fläche, nicht über eine Linie.** Vor dem Durchgang lagen über hundert `1px solid`-Umrisse im Rechner — jeder Umschalter, jede Karte, jeder Knopf in seinem eigenen Kästchen. Das war der Hauptgrund, warum die Oberfläche wie ein Baukasten wirkte. Ein Rahmen bleibt jetzt dem vorbehalten, was **ausgewählt** ist (als `boxShadow: inset 0 0 0 1px`, damit er kein Layout verschiebt) oder was **warnt**. Ein Dialog darf eine Haarlinie behalten: er schwebt über fremdem Inhalt. Gestrichelte Rahmen gibt es nicht mehr.

**Wiederkehrende Muster sind Komponenten mit festen Varianten** — nicht jedes Mal frisch zusammengesetzte Utility-Ketten:

| | |
|---|---|
| `Btn` | `primary` (der eine Weg vorwärts) · `accent` (gleichrangige Wahl unter mehreren) · `ghost` (Nebenhandlung) · `quiet` (fast unsichtbar). Größen `s` / `m` / `l` |
| `Card` | Fläche **ohne** Rahmen; `tone` = surface / raised / field, `ring` nur für Ausgewähltes |
| `Seg` | Umschalter mit genau einem aktiven Zustand (See-/Landfracht, DE/EN, cm/mm) — aktiv wird durch die Fläche markiert |
| `Kpi` | Beschriftung oben, Zahl darunter groß in Monospace |
| `Lbl` | die kleine, ruhige Beschriftung |

**Auswahlreihen sind Raster, keine umbrechenden Reihen.** Fünf Kacheln in einer `flex-wrap`-Reihe ergaben oben drei und unten zwei, und die untere Reihe stand unter keiner Spalte. Deshalb `segGrid(n)` mit fester Spaltenzahl — und die Kachelzahl geht in **ganzen Reihen** auf: fünf Containertypen plus „Custom · eigene Maße" sind sechs, fünf Fahrzeuge plus „Custom" ebenso. `test/auswahlraster.test.mjs` rechnet das nach; wer einen sechsten Typ ergänzt, fällt dort auf die Nase und muss entscheiden, wie das Raster weitergeht. Nebeneffekt der Custom-Kachel: der Zustand „eigene Maße" war vorher nur über „Maße anpassen" erreichbar und in der Auswahl unsichtbar.

**Die Kennzahlen der Leiste stehen auf `NUMS.m`, nicht auf `NUMS.l`.** Mit 26 px passten in der Landfracht bei 1440 px vier Zahlen plus „Alles verladen" plus „Details" nicht mehr in eine Zeile — und einzeilig ist sie laut Regelwerk oben. 20 px über einer 11,5-px-Beschriftung dominieren immer noch deutlich. Wer daran dreht, misst bei **1440 px in beiden Domänen** nach.

**Keine Farbverläufe** (ein Markenton, siehe `C.accent`) und **keine winzige, weit gesperrte Monospace als Fließtext** — das ist der auffälligste Verräter einer schnell zusammengeklickten Oberfläche.

**In der Mitte der Kopfzeile steht der Name des Plans** (`planName`) — leer zeigt er die Einladung „Plan benennen". Er ist keine Dekoration: Er füllt den Vorschlag in „Meine Pläne", steht im Ladevorschlag neben der Referenznummer und bildet den Dateinamen von CSV- und Bild-Export (`planSlug()`). Bewusst **nicht** im `?c=`-Link — dafür bräuchte das Format ein neues Feld, und das ist eine eigene Entscheidung.

**In der Kopfzeile steht rechts nur „Teilen".** Alles andere (Ladevorschlag, Zur Seite, Export, Bild, Meine Pläne) liegt hinter „…". Die Einheit cm/mm sitzt im Kopf der Ladungsliste — dort, wo man Zahlen eintippt, nicht in der Kopfzeile. Die Reederei-Auswahl steht immer sichtbar, auch bei zugeklapptem Container: Sie wechselt öfter als der Containertyp.

Ab `lg` ist der Rahmen **genau ein Fenster hoch** (`lg:h-screen lg:overflow-hidden`): Kopfzeile, 3D-Ansicht, Statuszeile und Fußzeile stehen fest, gescrollt wird nur **innen** in der Seitenleiste (`lg:min-h-0 lg:overflow-y-auto`, **keine** feste `maxHeight`). Wer der Seitenleiste wieder eine eigene Höhe gibt oder dem äußeren Rahmen das `overflow-hidden` nimmt, holt sich das alte Problem zurück: die Seite wird höher als das Fenster und die Statuszeile rutscht darunter. Unter `lg` (Telefon) scrollt die Seite bewusst normal.

In der Ladungsliste ist **genau eine Position aufgeklappt** (`openCargo`); die übrigen stehen als einzeilige Zusammenfassung da (`cargoSummary`). Neu angelegte Positionen klappen automatisch auf.

### Füllreihenfolge im Einzeltyp-Pfad
Bei **genau einem** Packstücktyp füllt `packCargo` **Stellplatz zuerst, dann in die Höhe** — nicht erst den ganzen Boden. Die Kapazität ist in beiden Reihenfolgen dieselbe (Stellplätze × erlaubte Etagen); `test/stapeln-reihenfolge.test.mjs` prüft das über 180 Fälle in geschlossener Form. Der Unterschied zeigt sich nur bei wenigen Packstücken: vorher standen zwei stapelbare Paletten nebeneinander, obwohl jemand die Bauhöhe gerade auf zwei Etagen abgestimmt hatte.

Im **gemischten Pfad** (`emsSearch`, ab zwei Typen) entscheidet die **Höhensumme den Gleichstand** — erst wenn Anzahl *und* Volumen gleich sind. Die Suche läuft ohnehin viele Varianten; unter den gleich guten wird die gestapelte genommen. Das kostet per Konstruktion keinen Füllgrad, weil an Anzahl und Volumen nichts getauscht wird. Das Volumen wird dabei mit Toleranz verglichen: dieselbe Kistenmenge in anderer Reihenfolge aufsummiert ist in Gleitkomma nicht bitgleich, und ein Gleichstand, den die letzte Stelle verhindert, wäre keiner.

**Wer an `emsSearch` oder `emsPackOnce` etwas ändert, misst vorher und nachher** — `node test/bench/fuellgrad.mjs app.html` über 300 deterministische Ladungen. Verladene Packstücke und belegtes Volumen dürfen **nicht sinken**; alles andere ist Geschmack. Für den Gleichstand-Entscheid oben lag beides auf die dritte Nachkommastelle identisch (15.189 Packstücke, 5.547,979 m³), während die Ladungen mit mehr als einer Etage von 187 auf 295 von 300 stiegen. Der Messstand liegt bewusst außerhalb von `test/`, weil die CI dort mit `node --test test/*.mjs` greift und 30 Sekunden nicht in jeden Pull Request gehören.

### Karton auf Palette (Vorstufe)
`palletize()` in `app.html` rechnet **einen** Kartontyp auf **eine** Palette und liefert Lagenmuster, Lagenzahl und die fertigen Paletten. Der Dialog dahinter (`PalletDialog`) endet damit, dass Paletten in der Ladungsliste stehen — danach rechnet der bestehende Rechner weiter.

Vier Entscheidungen, die dabei nicht kippen dürfen:

- **Es ist ein Dialog, keine dritte Domain.** Eine eigene Domain hieße eine zweite Ergebnisleiste und ein zweites 3D-Bild — genau die Doppelung, die das Regelwerk oben abgeschafft hat.
- **Volle Paletten und Restpalette gehen als ZWEI Positionen** in die Ladung. Eine einzige wäre bequemer, aber dann rechnet der Container mit einer Restpalette, die so hoch und so schwer wäre wie eine volle — und daran hängt, ob der letzte Container noch zugeht.
- **Das Palettenleergewicht fährt mit** (EUR 25 kg, Industrie 30 kg). Bei 34 Paletten sind das über 800 kg, die sonst in der Zuladung fehlen.
- **Übergeben werden die tatsächlichen Außenmaße**, nicht das Palettenmaß. Ragt die Ware über die Kante, sieht der Container das, was wirklich ankommt.

**Der Knopf steht im Kopf der Ladungsliste**, als Geschwister von „+ Packstück". Beide legen eine Position an — die eine tippt man, die andere lässt man ausrechnen. In der linken Spalte stand er falsch: dort steht, **wohin** geladen wird, nicht **was**.

`PalletScene` ist eine **eigene, kleine Three.js-Szene**, nicht `Viewport`. Der große Blick hängt an Kette, Übermaß, Türprüfung und manuellem Modus — nichts davon gibt es hier, und ein zweiter Aufrufer hätte jede künftige Änderung dort zur Fallunterscheidung gemacht. Kamerawinkel, Dämpfung (0,12) und Leerlaufdrehung (nach 2,8 s) sind bewusst dieselben, damit sich der Dialog anfühlt wie der Rechner. **Der WebGL-Kontext wird beim Schließen ausdrücklich freigegeben** (`forceContextLoss`) — sonst hält jedes Öffnen einen weiteren fest und der Browser gibt nach einigen Malen keinen mehr her.

Das Lagenmuster kommt aus `makeFloorPacker` — demselben Guillotine-Packer, der im Container die Bodenlage legt. Er mischt Ausrichtungen (Kreuzverband); **echte Windmühlenmuster sind nicht guillotine-schneidbar und entstehen daher nicht.** Das ist eine bekannte Lücke, kein Fehler.

**Mehrere Kartontypen** rechnet `palletizeMulti()` in zwei Betriebsarten, weil es an der Rampe zwei verschiedene Vorgänge sind:

- **`separate`** — jeder Typ auf eigene Paletten. Der häufigere Fall und die Voreinstellung.
- **`layered`** — ein Stapel, aber **jede Lage gehört genau einem Typ**. So wird eine Mischpalette tatsächlich gebaut. Die Reihenfolge der Kartontypen *ist* die Stapelreihenfolge (erster Eintrag unten); `layerOrder()` schlägt sie nach Lagengewicht vor (schwerste unten) — das Lagengewicht, nicht das Stückgewicht, denn viele leichte Kartons können eine schwerere Lage ergeben als wenige schwere.

**Nicht gebaut, und zwar bewusst:** Kartons verschiedener Größe *innerhalb* einer Lage verschachteln. Das ergäbe Muster, die niemand nachbaut — und eine Zahl, der man an der Rampe nicht folgen kann, ist schlechter als keine Zahl.

Zwei Invarianten hält `test/palettierer-multi.test.mjs` fest: **es darf unterwegs kein Karton verschwinden** (verladen + übrig = eingegeben, auch wenn ein Typ auf die Palette gar nicht passt), und **eine Lage wird nie zwischen zwei Paletten geteilt** — sie ist die kleinste Einheit, die jemand am Stück baut. Gleich aufgebaute Paletten werden gezählt, nicht einzeln aufgelistet, sonst steht in der Ladung dreißigmal dasselbe Packstück.

**Die Palette bleibt im Container eine Palette.** Übergebene Positionen tragen einen Bauplan (`pal: { b, ly }` — Palettenhöhe und die Lagen mit ihrer Kennfarbe). Der Viewport zeichnet daraus je Lage ein eigenes Band plus die Holzpalette darunter, statt einer glatten Kiste; sonst verliert die Ladung beim Übernehmen genau das Bild, das man gerade gebaut hat. **Auf die Rechnung hat das keinen Einfluss** — die zählt weiter das Außenmaß. Die Bänder werden auf die tatsächliche Höhe der Position skaliert: wer sie in der Ladungsliste ändert, bekommt kein Band, das über die Kiste hinausragt.

**Eine übernommene Palette lässt sich nachbessern.** In der Ladungsliste steht danach nur noch „120 × 80 × 174,4 cm" — daraus ist nicht zurückzurechnen, ob darunter vier oder vierzig Kartons liegen. Wer merkt, dass die Kartons 2 cm höher sind, hätte die ganze Eingabe neu tippen müssen. Deshalb fährt der **Eingabestand des Dialogs** als `palSrc` an den erzeugten Positionen mit, der Dialog nimmt ihn über `init` wieder an, und „Palette bearbeiten" in der aufgeklappten Zeile öffnet ihn damit.

Beim Übernehmen einer Korrektur **ersetzen** die neuen Positionen die alten derselben `grp` an Ort und Stelle — sonst wüchse die Liste bei jeder Korrektur um einen Satz Paletten. Die Kennfarben bleiben, was sie waren: eine Korrektur soll die Ladung nicht umfärben. Die eigentliche Falle hält `test/palette-nachbessern.test.mjs` fest: wer dem Dialog ein neues Eingabefeld gibt und es in `onApply` mitschickt, aber nicht aus `init` liest, setzt es beim Nachbessern stillschweigend auf den Standardwert zurück — die Rechnung läuft durch, und niemand sieht es.

`pal` und `grp` bleiben **lokal** und stehen nicht im Teilen-Format. Ein geteilter Link zeigt die Palette also wieder als einfache Kiste — die Maße und die Kennfarbe (`cl`) reisen mit, der Aufbau nicht. Das im `?p=` zu ergänzen wäre eine eigene Entscheidung.

**Kennfarben bei der Übergabe:** Der Dialog liefert je Position einen `colorKey`. Gleiche Ware bekommt dieselbe Farbe (volle Paletten und Restpalette desselben Typs), verschiedene Ware verschiedene. Mischpaletten teilen sich einen Schlüssel — dort gibt es keinen einzelnen Typ mehr.

### Maßangaben im Fließtext
Ein Maß, das als **Text** erscheint, läuft über `dimDE()` — nie über die Rohzahl. `${num(it.l)} × ${num(it.w)}` schreibt in der deutschen Oberfläche „164.4" mit Punkt. Solange alle Maße ganze Zentimeter waren, fiel das nicht auf; die Palettenhöhe 14,4 cm hat es sichtbar gemacht (die Reederei-Innenmaße in Millimetern hätten es auch getan). `test/masszahlen.test.mjs` fängt das Muster ab.

### Container-Wissen (`/ratgeber/`)
Die neun Frageseiten und ihre Übersicht teilen sich **eine** Gestaltung: `ratgeber/wissen.css`. Vorher trug jede Seite ihre eigene Kopie derselben Regeln — sie mussten auseinanderlaufen, und sie taten es: eigener Grundton (`#070a0f` statt `#0E1116`), eigener Akzent (`#2f9bff` statt `#2E8FFF`), ein Türkis, das es im Produkt nicht mehr gibt, Inter statt Archivo, Gewicht 800 und Radien 10/14. Nah genug, um für dieselbe Marke gehalten zu werden — daneben genug, um fremd zu wirken.

Es gilt dort dasselbe Regelwerk wie im Rechner: ein Markenton, **keine Farbverläufe**, Radien aus der Reihe, Gewichte bis 700. `test/container-wissen.test.mjs` hält das fest und liest Akzent- und Textfarbe **aus `app.html`**, statt sie abzuschreiben — eine abgeschriebene Zahl wäre die nächste Kopie, die wegdriftet.

**Das Markenzeichen ist dasselbe wie auf der Startseite**: der isometrische Würfel (drei Flächen `#0A2B46` / `#165780` / `#0F3C60` — im Regelwerk als Ausnahmen geführt) auf Akzentgrund, daneben der Schriftzug mit „Load" im Markenton. Der Schriftzug ist **ein** Element: stünden „Container" und der `Load`-Span einzeln im Flex-Kasten der Marke, zöge dessen `gap` sie auseinander und aus ContainerLoad würde sichtbar „Container Load". Nebenbei: `grad-bg` und `grad-text` auf der Startseite sind **keine Verläufe** mehr — die Klassennamen stammen aus der Zeit davor, dahinter steht seit PR #57 der eine Markenton.

**Die Stellzahlen auf den Seiten müssen mit dem Rechner übereinstimmen**, in den sie verlinken. `test/wissen-zahlen.test.mjs` rechnet sie mit demselben `makeFloorPacker` nach und liest auch die Containermaße aus `app.html` — nichts davon wird im Test abgeschrieben. Jede Seite trägt einen Knopf „Im 3D-Rechner ansehen"; wer dort eine andere Zahl sieht als im Text, weiß nicht mehr, welcher Angabe er glauben soll, und genau dieses Vertrauen ist das Produkt. **Auch die Beispielmenge im `?q=`-Direktlink gehört dazu** — sie lädt den Rechner vor und würde eine falsche Zahl sonst bestätigen.

Beim Einbau korrigiert (alle vier vom Packer widerlegt): Europaletten im 40-Fuß **25** statt „25–26" (26 ist geometrisch unmöglich — das beste Muster belegt 1200 × 200 cm, übrig bleibt ein Streifen von 35 cm), Industriepaletten **9** statt „9–10" im 20-Fuß und **22** statt „rund 21" im 40-Fuß, Gitterboxen **23** statt „24–25" im 40-Fuß. Bei den Gitterboxen lag der Denkfehler tiefer: die Seite hielt 124 × 83 cm für „praktisch eine Europalette". Vier Zentimeter Länge und drei Breite kosten im 40-Fuß aber in beiden Reihen je eine Box.

**Der sichtbare Name ist „Container-Wissen"** (so hieß es in der Navigation der Startseite ohnehin schon). **Die Adressen bleiben `/ratgeber/…`** — sie sind indexiert, ein Umzug kostet Rankings und bräuchte 301-Weiterleitungen. Ebenso unangetastet: die Titel der Frageseiten (das sind die gesuchten Fragen), die Meta-Beschreibungen und die Canonicals.

### Der Entwurf, das Rückgängig und der leere Start
**Der Rechner startet leer.** Vorher stand beim Öffnen ein erfundenes Packstück (120 × 80 × 110, 300 kg) in der Liste, das jeder erst von Hand wegwerfen musste, bevor er die eigene Ladung eintippen konnte. `INIT_CARGO` ist jetzt `[]`, und weil es keine Position mehr geben muss, hängt das × einer Zeile an `cargo.length > 0` statt an `> 1` — sonst ließe sich die letzte nicht löschen.

**Der Arbeitsstand überlebt einen Reload** (`containerload.draft.v1`). Gemeldet von einem Spediteur: man tippt vierzig Positionen ein, drückt versehentlich F5 und fängt von vorne an. Bis dahin überlebte nichts davon — gemerkt wurden nur Sprache, Einheit, Reederei und die ausdrücklich gespeicherten Pläne.

Drei Dinge daran dürfen nicht kippen:
- **Rangfolge beim Start:** geteilter Link → `?q=`-Import → eigener Entwurf → leer. Der Link steht oben, sonst überschriebe der eigene Arbeitsstand den Plan, den jemand einem gerade geschickt hat.
- **Der erste Effektlauf speichert nicht.** Wer einen geteilten Link öffnet, soll damit nicht seinen eigenen Entwurf löschen, bevor er überhaupt etwas getan hat.
- **`stackMax` trägt `Infinity`, und JSON macht daraus `null`.** Ohne `draftIn`/`draftOut` würde aus „frei stapelbar" beim nächsten Öffnen „nicht stapelbar" — eine stille Änderung an der Rechnung, ausgelöst durch einen Reload.

Ein Entwurf ist **kein Plan**: ein Plan ist etwas, das jemand benennt und behalten will, ein Entwurf ist das, was ohnehin gerade dasteht. Deshalb ein eigener Schlüssel und nicht „Meine Pläne" — sonst flutet Halbfertiges die Liste.

**Rückgängig** (`hist`, Strg+Z und der Knopf im Hinweis) fängt nur **strukturelle** Änderungen ab: löschen, leeren, eine Liste einfügen, Paletten übernehmen, alles drehbar setzen. Nicht jeden Tastendruck in einem Zahlenfeld — dort gehört das Rückgängig dem Browser, und ein Stapel mit tausend Zwischenständen wäre für niemanden zu bedienen. Deshalb greift der Tastaturweg auch nicht, solange der Fokus in einem Eingabefeld steht.

**„Leeren" fragt nicht nach.** Ein Dialog, den man wegklickt, schützt niemanden; ein Rückgängig, das danebensteht, schon. Der Hinweis bleibt dafür 6 statt 2,6 Sekunden stehen.

> **Die Falle, die eine Stunde gekostet hat:** `setToastAct(fn)` liest React als **Updater** und **ruft `fn(bisherigerZustand)` auf**, statt `fn` zu speichern. Das Löschen machte sich dadurch sofort selbst rückgängig — ohne eine einzige Fehlermeldung, ohne Konsolenausgabe, ohne dass ein Render stattfand. Wer eine Funktion in einen Zustand legt, muss sie verpacken: `setToastAct(() => fn)`. `test/entwurf-und-undo.test.mjs` hält das fest.

**Die Datenschutzseite zählt namentlich auf, was lokal gespeichert wird.** Kommt ein neuer Schlüssel dazu, gehört er dort hinein — das ist kein Formalismus, sondern dieselbe Ehrlichkeitsregel wie bei den Zahlen.

### Die Container-Kette: zwei Grenzen, zwei Fragen
`MAXCHAIN = 24` wird **gerechnet**, `MAXDRAW = 8` wird **gezeichnet**. Vorher galt für beides 4 — an zwei Stellen unabhängig voneinander als Literal. Wer 39 Paletten eingab, sah vier Hüllen und darunter „15 offen · weitere Container nötig", ohne je zu erfahren, wie viele. Es sind sieben.

„Wie viele Container brauche ich" beantwortet man mit einer **Zahl**, „wie steht die Ladung" mit einem **Bild** — und ein Bild mit zwanzig Hüllen nebeneinander sagt nichts mehr. Deshalb steht die Zahl jetzt als erste Pille über der Slot-Liste, und gezeichnet werden die ersten acht.

Weiter zu rechnen kostet fast nichts, weil jeder Folgecontainer weniger Rest zu packen hat: gemessen **92 ms** für die 39 Paletten (bei Grenze 4 waren es 133 — es wird *schneller*) und **727 ms** im schlimmsten nachgestellten Fall, 1.900 Packstücke auf zehn Container.

**Die Kette und die Empfehlung antworten auf verschiedene Fragen** und dürfen deshalb verschiedene Zahlen nennen: die Kette beginnt beim **gewählten** Container und hängt Folgecontainer an, die Empfehlung rechnet die günstigste Kombination frei aus. Damit nicht zwei Zahlen unkommentiert nebeneinanderstehen, nennt die Pille ihre Grundlage: „6 Container · mit dieser Wahl".

### Mehr als ein Container ist ein Entschluss, kein Fehler
Statuszeile, Mengenzähler in der Ladungsliste und der Bildexport lasen alle nur den **ersten** Container. Bei 37 Paletten auf drei Containern stand daneben „17 offen" in Orange, „0/1" an Packstücken, die im zweiten Container liegen und im Bild daneben zu sehen sind, und ein rotes „33.227 kg über Zuladung", das die Gesamtladung gegen die Zuladung **eines** Containers rechnete.

Drei Stellen zählen deshalb jetzt den ganzen Plan:
- **`chainContainers`/`chainVehicles` liefern `perType`** (über `kettenBilanz`) — die Bilanz über alle Container. `result.perType` bleibt daneben stehen und meint weiterhin den ersten; die Leiste weist ihn ausdrücklich als `C1` aus.
- **Offen ist, was die ganze Kette nicht mehr aufnimmt** (`remainingBoxes`), nicht was neben dem ersten Container liegt. Grün heißt dann „Alles verladen · 3 Container".
- **Die Überladung rechnet gegen die Zuladung des Plans** (Summe über die Kette). 67 t auf drei Containern sind keine Überladung.

`kettenBilanz` steht bewusst **hinter `var MAXCHAIN` und vor `chainContainers`** — die Test-Slices schneiden genau diesen Bereich heraus.

### Die Kamera darf ihren Mittelpunkt verlassen
Die 3D-Ansicht kreiste um `t.target`, und das war die **Mitte der Reihe**. Zoomen hieß damit immer „in die Mitte hinein" — bei drei Containern also in die Lücke zwischen dem ersten und dem zweiten. An den ersten oder letzten Container kam man gar nicht heran. Drei Wege heraus, alle drei Standard in 3D-Betrachtern:

- **Rechte (oder mittlere) Maustaste, oder Shift, schiebt** das Ziel in der Bildebene. Ein Pixel Mauszug ist ein Pixel Bild (`proPixel` aus Bildwinkel, Entfernung und Leinwandhöhe) — sonst rutscht die Ladung unter dem Zeiger weg.
- **Das Rad zoomt dorthin, wo der Zeiger steht.** Das Ziel wandert zum Punkt unter dem Zeiger, und zwar **genau um den Anteil, um den die Entfernung schrumpft** (`target.lerp(p, 1 − r_neu/r_alt)`). Nur dieser Faktor lässt den Punkt unter dem Zeiger stehen; ein größerer zieht ihn weg (erst mit ×1,6 probiert — das überschoss sichtbar). Beim Heraus­zoomen bleibt das Ziel stehen, sonst zerrt es bei jedem Rückzug.
- **Doppelklick holt den Punkt unter dem Zeiger in die Mitte** — im manuellen Modus nicht, dort säße ein Doppelklick zwei Kisten.

Zwei Dinge halten das zusammen: `zielKlemmen()` begrenzt das Ziel auf die Reihe plus zwei Meter Auslauf (die Halbmaße stehen in `t.frame`) — sonst schiebt man sich mit zwei Handbewegungen ins Nichts und findet ohne „Ansicht zurücksetzen" nicht zurück. Und ein Schiebe-Zug setzt im manuellen Modus **keine** Kiste (`warSchieben` in `up`), sonst platziert jeder Rechtsklick eine.

Der sichtbare Hinweis bleibt kurz — daneben sitzt das Empfehlungsbanner, unter dem ein langer Text durchläuft. Das Ganze steht im `title`. Er stand übrigens fest auf Deutsch im Markup, obwohl `T.orbitHint` seit jeher existierte.

### Volumen und Gewicht je Container
Die Leiste nennt immer nur C1 (und sagt es dazu), das Bild nennt die Summe. Dazwischen fehlte die Frage, die beim Buchen zählt: *wie voll ist eigentlich der zweite?* Jeder Container hat seine eigene Zuladung und wird einzeln gestellt. In der Details-Schublade steht deshalb eine Zeile je Container: **Verladen · Volumen · Gewicht · Voll**, gerechnet aus derselben Quelle wie das Bild (den `placed`-Listen der Kette).

Zwei Dinge halten `test/kennzahlen-je-container.test.mjs` zusammen: die **Zeilen summieren sich auf die Gesamtladung** (37 Stück, 67.772 kg), und die **erste Zeile ist exakt das, was die Leiste als C1 zeigt** — zwei verschiedene Zahlen für denselben Container übereinander wären schlimmer als keine Tabelle. Die Spalte „Voll" meint dasselbe wie die Leiste: im Seeverkehr Volumen, auf der Straße **Lademeter**.

**Dieselben Zahlen stehen im Bild** — eine Kachel je Container, mit zwei Balken: Raum und Gewicht. Zwei, weil zwei Grenzen gelten und bei schwerer Ladung die zweite zuerst zuschlägt (bei der gemeldeten Sendung: 47 % Volumen, 99 % Zuladung). Das Bild ist das, was beim Kunden ankommt; die Frage stellt sich dort genauso. Die Kacheln rechnen **nicht selbst**, sondern lesen `slotRows` — sonst laufen Bild und Oberfläche auseinander. Bis zu **acht** Kacheln, danach „+N weitere" (mehr zeichnet auch die 3D-Ansicht nicht, `MAXDRAW`). Sie gehen in vollen Reihen auf, höchstens vier je Reihe: sechs Container sind 2×3, nicht 4+2 — dieselbe Regel wie bei der Typ-Auswahl.

**Zwei Anordnungen, umschaltbar im Bild-Dialog** (nur sichtbar, wenn es mehr als einen Container gibt):

- **Reihe** — alle Container nebeneinander, wie bisher. Gut für den Überblick.
- **Einzeln** — ein eigener Render je Container, jeder eng eingepasst, als Blatt mit einer Kachel je Container. In der Reihe teilen sich drei 40-Füßer die Bildbreite; darin ist keine Lage mehr zu erkennen.

Für die Einzelaufnahme nimmt `captureView` einen `slot` entgegen: es blendet alle Gruppen mit einer **anderen** `userData.slot` aus und passt auf den Rahmen dieses einen Containers ein (`t.frame.slots[i]`). Zwei Fallen dabei, beide erlebt:
1. `cg.userData = { … }` weiter unten **ersetzt** das Objekt komplett — die Slot-Marke muss **dort** stehen, sonst ist sie wieder weg und jede Kachel zeigt die ganze Reihe.
2. `theta`/`phi` werden in `captureView` **vor** der Entfernungsrechnung gebraucht. Wer sie darunter deklariert, bekommt eine TDZ-Referenz — die `try/catch` schluckt sie, und der Export liefert einfach nichts. Dieselbe Falle wie seinerzeit bei `leer`.

**Die Einzelkachel schaut flacher und seitlicher** (θ −1,17 / φ 1,17 statt −0,92 / 1). Die Neigung auf dem Schirm ist `cos(φ)·cos(θ)`; ein 12 m langer Container kippt bei der Übersichts-Ruhelage so stark ins Bild, dass die halbe Kachel leer bleibt. Flacher und seitlicher heißt weniger Neigung und damit rund 15 % mehr Container je Kachel — aber nicht so flach, dass die Deckflächen verschwinden, denn an denen zählt man die Lagen. `camFit` nimmt den Winkel deshalb als Parameter.

**Beide Bildvarianten rechnen ihre Höhe getrennt** (transparenter Glass-Balken, opake Chrome-Karte). Wer nur eine anpasst, schiebt in der anderen die Fußleiste über die Kacheln; `test/bild-je-container.test.mjs` prüft beide.

**Die Schublade scrollt, sie schneidet nicht ab.** Mit der Tabelle passt der Inhalt nicht mehr in die früheren festen 360 px — abgeschnitten wurde ausgerechnet die Gewichtsverteilung ganz unten, ohne jede Andeutung, dass da noch etwas ist. Jetzt `min(460px, 50vh)` mit `overflow-y: auto`: hoch genug für den Normalfall, gedeckelt auf die halbe Fensterhöhe, damit die 3D-Ansicht darüber nicht zusammengedrückt wird.

### Der Bildexport rahmt die ganze Reihe
Die Export-Kamera wurde auf die Maße des **gewählten** Containers eingepasst; bei einer Kette lag alles ab dem zweiten außerhalb des Bildes. Die Live-Ansicht rechnet die Halbmaße der ganzen Reihe längst aus — sie stehen jetzt in `t.frame` (`hx/hy/hz`), und `camFit` liegt auf Modulebene, damit **Live-Ansicht und Export dieselbe Einpassung benutzen**. Der Nebel wird für die größere Export-Entfernung mitgezogen (sonst verschwindet der hinterste Container im Dunst) und danach zurückgestellt.

**Das Bildformat folgt dem Motiv.** Ein 20-Fuß-Container ist ein kompakter Block und bleibt bei 16:10; eine Reihe aus drei 40-Fußern ist über 40 m lang und 2,7 m hoch — in 16:10 gepresst bleiben zwei leere Drittel übrig. Das Seitenverhältnis wächst deshalb stufenlos mit der Länge der Reihe, gedeckelt bei 16:7,3.

### Was `stackMax` bedeutet — und was nicht
**Es ist eine Tragfähigkeit.** Der Selektor sagt es wörtlich: „1× stapelbar" = *eine zusätzliche Lage obendrauf* (`stackMax` 2). Daraus folgen drei Dinge, die alle drei gelten müssen:

- Die Grenze zählt **ab dem Stück selbst nach oben**, nicht ab dem Containerboden. Sonst blockiert eine hohe fremde Kiste am Boden schon die erste eigene Lage darüber (`test/pack-stackmax-mixed.test.mjs`).
- Sie gilt für **jedes** Stück darunter, unabhängig von Sorte und Bauhöhe. Bis August 2026 zählte der Turm nur Stücke *gleicher Bauhöhe* mit — ein Behelf für „gleiche Sorte". Bei 39 Paletten von 41 bis 52 cm, jede einzeln erfasst und jede „1× stapelbar", war keine zwei gleich hoch: der Turm blieb bei 1, die Grenze griff nie, der Rechner stapelte fünf hoch. So gemeldet, so nachgestellt.
- Ein Stück ganz oben trägt nichts und verletzt deshalb nichts — auch wenn es auf Lage 3 liegt. Die frühere Fassung verbot das und ließ dafür Ladung liegen.

Umgesetzt ohne Suche: jedes gesetzte Stück trägt seine Lage im Turm (`pos`) und die höchste Lage, die sein Turm nach **allen** Trägern darunter erreichen darf (`lim = min(pos + Tragfähigkeit − 1)`). Beim Aufsetzen genügt der Vergleich mit dem unmittelbaren Untergrund. `towerAt` im manuellen Pfad folgt derselben Regel — `test/stackmax-manuell.test.mjs` verlangt, dass Ziehen von Hand und automatisches Packen dasselbe ergeben.

### Die zweite Stapelgrenze: „stapelbar bis 180 cm" (`stackH`)
An der Rampe wird nicht in Lagen gedacht, sondern in Zentimetern. Eine Lagenzahl ist dafür nur eine Näherung — und eine, die sich **nicht zusammensetzen lässt.** Bei Paletten von 42 bis 49 cm rechnet man sich aus: unter 45 cm gehen vier Lagen, darüber drei. Steht dann eine flache unten und drei hohe darauf, sind es vier Lagen (jede Einzelgrenze eingehalten) und **183 cm** — die eigentliche Grenze gerissen. Genau so gemeldet, und genau so in `test/stapelhoehe.test.mjs` festgehalten.

`stackH` ist deshalb eine Grenze in Zentimetern, **gemessen ab dem Containerboden** — so, wie die Angabe in der Anfrage gemeint ist. Umgesetzt parallel zu `lim`: jedes gesetzte Stück trägt `hlim`, die höchste Oberkante, die sein Turm nach allen Stücken darunter erreichen darf. Beide Grenzen gelten nebeneinander, die schärfere gewinnt.

Im Auswahlfeld schließen sie einander aus („bis Höhe …" **oder** „2× stapelbar"): wer in Zentimetern denkt, denkt nicht gleichzeitig in Lagen, und zwei Grenzen nebeneinander wären nur schwerer zu lesen. Im Teilen-Link trägt sie den Tag **`H`** — Großbuchstabe, weil die Codetabelle des `?c=`-Formats ausdrücklich nur **ergänzt** werden darf. Ohne den Tag verließe die Grenze den Link stillschweigend, und der Empfänger rechnete mit einer anderen Ladung als der Absender.

**Die Grenze fragt nicht nach Sorte oder Listenposition, nur danach, was unter ihr steht.** Das ist keine Feinheit, sondern genau der Punkt, an dem die Lagengrenze schon einmal gescheitert ist: sie zählte den Turm nur über Stücke *gleicher Bauhöhe*, und bei 39 einzeln erfassten Paletten war keine zwei gleich hoch. `test/stapelhoehe.test.mjs` prüft deshalb ausdrücklich den Fall **37 einzeln erfasste Positionen** — und den gemischten, in dem nur die Hälfte eine Grenze trägt: ein Stück ohne eigene Grenze, das auf einem mit Grenze steht, bleibt gebunden. Sonst ließe sich die Grenze durch eine fremde Kiste obendrauf aushebeln.

**Der Freitext-Import versteht die Angabe** („stapelbar bis 180 cm", „bis 1,8 m", „up to 180 cm"). Wer 37 Paletten einzeln erfasst, setzt die Grenze sonst 37 Mal von Hand — und die Zeilen kommen ohnehin so aus der Anfrage. Der Ausdruck ist an ein Schlüsselwort **und** an eine Längeneinheit gebunden: „max 100 kg" ist keine Stapelhöhe, und `test/import-stapelhoehe.test.mjs` hält genau das fest.

**Was dabei KEIN Fehler war:** die Meldung lautete „das Tool macht vier Lagen, obwohl ich nur 2× stapelbar gewählt habe". Das Stück mit „2× stapelbar" stand auf Lage 2 und trug zwei — genau das, was die Angabe bedeutet. Der Fehler lag eine Ebene darüber, in der Übersetzung der Vorgabe in Lagenzahlen. Vor dem Ändern nachrechnen, nicht dem ersten Eindruck folgen.

**„Nicht stapelbar" ist etwas anderes** und bleibt, wie es war: das Stück darf **auf nichts stehen** (`S.y > 1e-6` in `emsPackOnce`). Es trägt in diesem Rechner weiterhin — `test/pack-order.test.mjs` hält das fest (11 nicht stapelbare am Boden, 11 stapelbare darüber). Ob das dem Verständnis an der Rampe entspricht, ist eine **offene fachliche Frage** und nicht beiläufig zu ändern.

### Die Hero-Animation (drei Akte, `clh-*` in `index.html`)
Im Kopf der Startseite laufen **drei Szenen nacheinander**, dann fängt die erste wieder an:

1. **Re-Solve** — Ladung passt nicht in den 20′, der Rechner sucht, der 40′ passt.
2. **Überhöhe** — eine Maschine 240 × 220 × 300 cm. Kein Standardcontainer ist innen höher als 270 cm, also 30 cm zu hoch. Plane und Dachspriegel kommen ab, der Kran hebt von oben ein; im 20′ Open Top ragt sie 61 cm über den Rahmen.
3. **Palette** — 40 Kartons 45 × 30 × 30 cm. Sechs je Lage, vier längs und zwei quer, fünf Lagen, 164,4 cm, 295 kg, Rest auf eine zweite Palette.

**Ein Regisseur, drei Akte.** Renderer, Kamera, Statuszeile, Pillen und Fortschrittsleiste teilen sich alle; jeder Akt bringt eigene Phasen (`PH`), eigene Texte (`ACT_TEXT[i]`), eine eigene `build(root)` und ein eigenes `update(name, p, ct, t, FR)` mit. Der Akt schreibt Kamera und Drehung in `FR`, der Regisseur setzt sie. **Wer einen vierten Akt baut, baut ihn nach demselben Schema** — sonst fällt die Reihe auseinander, und genau das war der Auftrag.

Drei Punkte links in der Leiste sagen, dass es mehr als eine Szene gibt, und springen auf Klick. Ohne sie sieht niemand, der nach zwölf Sekunden weiterscrollt, dass es Akt 2 und 3 überhaupt gibt.

**Die Zahlen in den Texten sind keine Erfindung.** `test/hero-animation.test.mjs` ruft `suggestEquipment` und `palletize` aus `app.html` auf und rechnet jede einzelne nach — auch das Lagenmuster, Rechteck für Rechteck. Wer hier eine Zahl ändert, muss sie dort nachweisen können. Dieselbe Regel wie im Container-Wissen, aus demselben Grund.

Die Animation läuft **nicht** bei `prefers-reduced-motion` und **nicht** auf echten Telefonen (kleinere Viewport-Kante < 600) — dort steht das SVG-Standbild.

### Die Ergebnisleiste zeigt vier Zahlen, nicht sechs
Sechs Kennzahlen plus Statusblock brauchen rund 850 px. Im Dreispalten-Layout stehen der Gruppe 490 zur Verfügung — die Leiste war deshalb zwischen **1440 und 1800 px immer zweizeilig**, also auf den meisten Laptops. In der Leiste stehen jetzt **Voll · Verladen · Volumen · Gewicht** (Landfracht: Lademeter statt Volumen), die übrigen zwei in der Schublade „Details". Wer eine neue Kennzahl einbaut, entscheidet sich für eine der beiden Listen — `statCards` oder `detailCards` — und misst nach, ob die Leiste noch einzeilig ist.

Zwei Dinge, die die Leiste falsch erzählt hat und die nicht zurückkommen dürfen:
- **Grün heißt „alles ist drin".** Vorher hieß es nur „Gewicht und Auslastung sind in Ordnung" — der Punkt stand auf Grün, während daneben „30 offen" stand.
- **„Verladen 62 / 92" zählt den ersten Container**, das Bild darüber zeigt aber bis zu vier. Die Zahl trägt deshalb dieselbe Marke wie die Hülle im Bild (`C1` / `F1`), sobald es mehr als eine gibt.

### Die Gewichtsanzeige und die Überladung
Die Zuladungsanzeige misst `result.weight` — das Gewicht dessen, was in **diesem** Container liegt. Dafür ist sie richtig. Was sie nicht sagen kann: dass die **eingegebene** Ladung als Ganzes schwerer ist, als der Container tragen darf. Ein einzelnes 30-t-Stück auf einem 28,2-t-Container wird gar nicht erst platziert, `result.weight` bleibt 0, und die Anzeige stünde auf 0 %. Diesen Satz trägt jetzt die Statuszeile (`overweight` / `overKg` / `T.overCap`). **Beides zusammen ist vollständig, eines allein war es nicht.**

### `makeFloorPacker(l, w, rotatable, maxSpots)`
Der vierte Parameter ist optional und sagt, wie viele Stellplätze der Aufrufer **höchstens** belegen kann. Ohne ihn rechnet der Packer wie immer das echte Maximum; mit ihm hört er dort auf. Unter `maxSpots` bleibt das Ergebnis exakt, darüber heißt es „mindestens so viele" — was der Aufrufer ohnehin nicht unterscheiden kann, weil er nach `qty` abbricht.

Grund: das Bodenraster wurde immer vollständig aufgebaut, unabhängig von der Menge. Ein Packstück mit 3 mm Kante — beim Umschalten der Eingabe auf Millimeter schnell getippt — ergab auf einem 45′ HC 3,5 Millionen Rechtecke und ließ den Browser fünf bis zwölf Sekunden stehen. **`palletize` ruft weiterhin ohne `maxSpots` auf**, dort wird die echte Zahl gebraucht.

### Zwischen den Sprachen darf nichts liegenbleiben
Die Fahrzeug**schlüssel** in `VEHICLES` sind deutsch und bleiben es — sie stehen als `preset` im Teilen-Link. Angezeigt wird, was `VEHICLE_LABEL(T)` und `VEHICLE_META(T)` liefern, analog zu `KIND_LABEL(T)` bei den Containern. Vorher stand der ganze Landfracht-Modus auch bei `?lang=en` auf Deutsch da.

Der **Teilen-Link trägt die Sprache mit** (`&lang=en`, nur bei Englisch angehängt). `share.html` reicht den Query-String unverändert weiter und ist selbst zweisprachig. Ohne das öffnete ein englisch erstellter Plan beim Empfänger einen deutschen Rechner.

`test/i18n-tote-schluessel.test.mjs` meldet übersetzten Text, den niemand sehen kann. **Vorsicht bei der Prüfung:** ein Schlüssel kann auch dynamisch über eine Tabelle erreicht werden (`T[cogClassKey]`, `{ height: T.palCapHeight }`). Eine frühere Prüfung hatte das übersehen und hätte englischen Text gelöscht, der gebraucht wird.

### Auf dem Telefon
Alle drei Seiten ließen sich seitlich schieben; `test/mobil.test.mjs` hält die Vorkehrungen fest (die CI hat keinen Browser, aber sie kann prüfen, ob im Quelltext steht, was nötig ist):
- **`.clh-stage`** hat eine Mindesthöhe **und** ein Seitenverhältnis. Beides zusammen bestimmt nicht die Höhe, sondern die **Breite**: 380 hoch bei 1,05 sind 399 breit. Unter 560 px fällt die Mindesthöhe deshalb weg.
- **Tabellen im Container-Wissen** stehen in `<div class="tabelle">` und scrollen dort. Die Zahlenspalten tragen `white-space: nowrap` — richtig so, eine Zahl darf nicht umbrechen; nur darf sie nicht die Seite mitnehmen.
- **Die Kopfzeile des Rechners** darf umbrechen (`flex-wrap`); Planname und „Speichern" bekommen auf dem Telefon eine eigene Zeile, die Sprachwahl liegt unter `sm` im „…"-Menü.

### Randseiten
`impressum.html`, `datenschutz.html` und `share.html` waren die letzten Seiten mit eigenen Werten — eigener Grundton, eigene Stufen, Inter statt Archivo (und zwar **ohne die Schrift zu laden**), Gewicht 800, Radius 14, ein Türkis aus der Zeit davor. Selten besuchte Seiten driften am weitesten, weil niemand hinsieht. `test/randseiten.test.mjs` liest Grundton und Akzent **aus `app.html`** und prüft beide Seiten plus `site.webmanifest` dagegen. **Am Rechtstext ändert dort niemand etwas ohne Rücksprache** — der Test fasst ihn auch nicht an.

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
