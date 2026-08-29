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

### Kein Überstand: was oben liegt, muss unten auch stehen
Gemeldet mit Bild: der Packer stellte **längere Packstücke auf kürzere**, sodass sie an einer Kante in der Luft endeten. Die Abstütz-Regel war bis dahin eine reine **Flächenregel** — 70 % der Grundfläche mussten getragen sein (`SUPPORT_MIN`).

Ein Flächenanteil sagt aber nur, **wie viel** getragen wird, nicht **wo das Fehlende liegt.** Und genau daran hängt der Unterschied: 30 % Luft **mitten** unter der Kiste (zwei Paletten mit einer Lücke dazwischen) ist eine Brücke und in Ordnung. Dieselben 30 % an **einer Kante** sind ein Überhang — er kippt, er lässt sich nicht sichern, und niemand baut ihn so.

Seitdem gelten beide Hälften nebeneinander, geprüft in **einem** Durchgang über die Kisten darunter (`supportOk` — das ist die heißeste Schleife des Packers):
- **`SUPPORT_MIN` = 0,7** — Mindestanteil der getragenen Grundfläche, unverändert.
- **`OVERHANG_MAX` = 0 cm** — keine Kante darf über den **Umriss ihrer Träger** hinausstehen.

`supportRatio` gibt es nicht mehr; Auto-Packer (`emsPackOnce`) und manueller Pfad (`dropHeight`) fragen dieselbe Funktion. Die Zeile `var SUPPORT_MIN = 0.7;` bleibt **wörtlich so stehen** — fünf Test-Slices schneiden an ihr.

**Was es gekostet hat, und zwar bewusst:** über die 300 Ladungen des Messstands **62 von 15.189 Packstücken (0,4 %)** und **18,5 von 5.548 m³ (0,3 %)**. Das Regelwerk unten sagt, der Füllgrad dürfe nicht sinken — hier sinkt er absichtlich, weil die vorher gezählten Packstücke teilweise in der Luft standen. Volle Auflage (100 % statt „kein Überstand") hätte doppelt so viel gekostet (98 Packstücke) und dabei auch die legitimen Brücken verboten. Neuer Messstand:

```
{"szenarien":300,"verladen":15127,"volumen":5529.496,"mitEtagen":295,"ySumme":1051180}
```

`test/ueberhang.test.mjs` prüft gegen **null**, nicht gegen `OVERHANG_MAX` — sonst wüchse der Test stillschweigend mit, wenn jemand die Grenze wieder aufmacht.

### Zwei Ziele, zwei Stufen: wenige Container **und** gleiches Gewicht
„Verteil das Gewicht auf alle drei Container, aber brauch trotzdem so wenige wie möglich." Das klingt nach einem Zielkonflikt und ist keiner — es sind **zwei Stufen**:

1. **Stufe 1** (`chainContainers` / `chainVehicles`, unverändert) füllt gierig und bestimmt damit **N**, die kleinste Zahl Container, die die Ladung aufnimmt.
2. **Stufe 2** (`ketteAusgleichen`) verteilt bei **festem N** neu — und wird nur übernommen, wenn danach **immer noch alles in dieselben N Container passt.** Der Ausgleich kann also nie einen Container kosten; geht er nicht auf, bleibt die gierige Verteilung stehen.

Das Werkzeug dafür ist kein zweiter Algorithmus, sondern **eine andere Schranke**: jeder Container wird mit einer künstlich gesenkten Zuladung gepackt (dem Zielgewicht), nur der letzte mit seiner echten. Der Packer lässt dann von sich aus schwere Stücke für die nächsten liegen.

- **Das Zielgewicht ist anteilig zur Zuladung**, nicht stur der Durchschnitt. Bei gleichen Containern ist das dasselbe (der Normalfall); bei gemischten heißt „gleichmäßig verteilt" nicht „gleich viele Kilo", sondern „keiner prozentual voller als die anderen".
- **Ein Zielgewicht exakt auf dem Schnitt geht selten auf** — das nächste Stück passt immer knapp nicht mehr, und was vorne liegenbleibt, muss hinten zusätzlich hinein. Deshalb `AUSGLEICH_LUFT = [1, 1.08, 1.2, 1.45]`: die erste Stufe, die aufgeht **und die Spanne verkleinert**, gewinnt. Jede Stufe ist ein kompletter zweiter Packlauf über die ganze Kette — deshalb sind es vier und nicht zwanzig.
- **Gedeckelt** auf `AUSGLEICH_MAXSTK = 600` Packstücke und `MAXDRAW` Container. Gemessen: die gemeldete Sendung 84 → 142 ms, der schlimmste gedeckelte Fall (600 Kisten auf 8 Containern) 281 → 647 ms.
- **Special Equipment bleibt außen vor.** Open Top und Flat Rack packt `packKind`, nicht `packCargo`; ein zweiter Durchgang über `packCargo` ließe die Übermaß-Stücke stillschweigend fallen.

Bei der gemeldeten Sendung: **26.430 / 24.613 / 16.729 kg → 22.187 / 22.577 / 23.008 kg.**

**Die Falle dabei:** der erste Container ist danach **nicht mehr der**, den `packKind` oben allein gerechnet hat — er gibt Gewicht ab. Die Kette liefert deshalb `slot0` zurück, und der Effekt in `app.html` **muss es in `r` übernehmen** (`placed`, `perType`, `usedVol`, `util`, `weight`, `boxes`, `layers`). Ohne das sagt die Leiste „15 / 37" und die Tabelle direkt darunter etwas anderes — zwei Wahrheiten für denselben Container. `test/kennzahlen-je-container.test.mjs` prüft beides: die Zahlen **und** dass der Effekt die Übernahme überhaupt vornimmt.

### Gleiche Ware in denselben Container — und Gewicht nur, wo es bindet
Gemeldet, mit Bild: **8 große Packstücke** (600 × 220 × 100 cm) und **22 Europaletten**, je 300 kg. Heraus kamen drei 40-Fuß-Container mit je einem Gemisch aus beidem. Der Nutzer sah sofort, was richtig gewesen wäre — die acht großen Stücke in zwei 40-Füßer, die 22 Paletten in einen 20-Füßer — und der Rechner nicht.

Dahinter lagen **zwei unabhängige Fehler**, beide im selben Bild sichtbar.

**Fehler 1: der Gewichtsausgleich lief, wo Gewicht nichts entscheidet.** 30 × 300 kg sind 9 t auf drei Containern mit je 26,6 t Zuladung — **elf Prozent**. Trotzdem hat der Ausgleich (siehe oben) die Ladung auf 10/10/10 Stück umverteilt und damit jede sinnvolle Aufteilung zerlegt. Er tat genau das, was ihm gesagt wurde; gesagt war das Falsche.

`AUSGLEICH_AB = 0.6` — der Ausgleich greift erst, wenn **ein Container über 60 % seiner Zuladung** liegt. Bei der ursprünglich gemeldeten 37-Paletten-Sendung waren es 99 %; dort greift er weiterhin. Wo Gewicht nichts entscheidet, darf es auch nichts entscheiden.

**Fehler 2: gierig ist lokal optimal und global schlechter.** Die Kette packte in den ersten Container 22 Paletten **und** 2 der großen Stücke — weil das dort die meisten Stücke sind (24 statt 22). Die übrigen 6 großen Stücke brauchten danach **zwei weitere 40-Füßer**, den letzten für ganze zwei Stück.

Der Ausweg ist nicht, gierig abzuschaffen, sondern **eine zweite Kette danebenzustellen**:

| | |
|---|---|
| Kette A | gierig, alle Sorten gleichzeitig — wie bisher |
| Kette B | **sortenrein**: angeboten wird nur der Anfang der Sortenliste, bis einschließlich der ersten Sorte, die nicht mehr vollständig hineingeht (`packSortenrein`). Reihenfolge: größtes Stück zuerst (`sortenReihenfolge`) |

`ketteBesser(a, b)` entscheidet, in dieser Reihenfolge:
1. **was liegenbleibt** — eine Kette, die Ladung stehen lässt, gewinnt nie;
2. **Zahl der Container** — die Frage, mit der der Nutzer da ist;
3. **gebuchtes Containervolumen** — bei drei Containern ist 2× 40′ + 1× 20′ billiger als 3× 40′. Das ist der Unterschied, um den es ging, und es ist Geld;
4. **Sortenstreuung** — nur der Gleichstand-Entscheid, **nie** ein Grund für einen Container mehr.

Ergebnis für die gemeldete Ladung: **2× 40′ HC mit je 4 großen Stücken + 1× 20′ GP mit 22 Paletten.**

**Dieselbe Rangfolge gilt für die Empfehlung.** `suggestContainer` rechnet unabhängig von der Kette und hatte denselben Greedy-Fehler: Es empfahl „2× 40′ HC + 1× 40′ GP", während die Kette darunter einen 20-Füßer buchte. Zwei widersprüchliche Zahlen nebeneinander sind schlimmer als eine ungenaue — `test/kette-sortenrein.test.mjs` rechnet beide gegeneinander.

**Vier Wächter, damit der zweite Durchgang nicht zum Zeitfresser wird** — er kostet je Slot einen weiteren Packlauf, und die sortenreine Kette hat oft mehr Slots:
- nur bei **mehr als einer** Sorte und höchstens `SORTENREIN_MAX = 12` (bei 37 einzeln erfassten Paletten wäre jede Sorte ein Stück — da gibt es nichts zu trennen);
- nur, wenn die gierige Kette **vor dem letzten Container** überhaupt einen gemischten trägt (sonst ist nichts zu verbessern);
- nur bis `MAXDRAW` Container — darüber zeichnet die Ansicht ohnehin nicht mehr alle, und genau diese Ketten sind die teuren;
- nur beim gewöhnlichen Trockencontainer (Special Equipment packt `packKind`).

Der **Probelauf in `packSortenrein` ist reine Diagnose** und läuft deshalb `quick` (ohne Restarts); für den ersten Container wird der ohnehin gerechnete `slot0` durchgereicht. Ohne diese beiden Kniffe kostete der Umbau das Dreifache der Rechenzeit.

Gemessen über 200 zufällige Ketten: **kein einziger Fall braucht mehr Container oder lässt mehr liegen**, die Sortenstreuung sinkt von 2.456 auf 2.413, die Rechenzeit steigt um 9 % (18,2 → 19,9 s; schlimmster Einzelfall 467 → 720 ms). Der Füllgrad-Messstand ist unverändert — `packCargo` selbst wurde nicht angefasst.

> **Die Falle, die fünf Testdateien auf einmal umgeworfen hat:** Beim Umbau wurde aus `return { chain, remainingBoxes: … }` ein `const out = { … }; return out;`. Fünf Test-Slices schneiden das Ende von `chainContainers` an genau dieser Zeichenkette ab — sie liefen ins Leere, und die halbe Kette war nicht mehr getestet. Die Zeile beginnt jetzt in **beiden** Ketten-Funktionen wieder wörtlich mit `return { chain, remainingBoxes`, mit einem Kommentar darüber.

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

### Die vertieften Seiten und die zwei neuen (August 2026)
Aus der Search Console: 1.106 Impressionen in 28 Tagen bei **Ø-Position 35,8**. Das Problem war nicht die CTR — auf Seite 4 ist 1 % normal —, sondern die Rankings, und die hingen an zwei Dingen: **elf Seiten insgesamt**, und die drei meistgesehenen davon waren **163 bis 250 Wörter** lang.

**Vertieft wurden die drei mit den meisten Impressionen** (Container-Volumen 313, Zuladung 151, Gitterboxen 117) auf 680–800 Wörter. Nicht mit Füllmaterial, sondern mit Rechnungen, die man sonst selbst anstellen müsste:

- **Volumen:** die Herleitung aus den Innenmaßen, der Unterschied zu den Außenmaßen (38 m³ außen gegen 33 innen), und die High-Cube-Tabelle — 13 % mehr Volumen heißen bei 110 cm Bauhöhe **null** zusätzliche Paletten, bei 130 cm die doppelte Ladung. Es passen nur ganze Lagen hinein.
- **Zuladung:** Zuladung als **Differenz** (Brutto − Tara) statt als gegebene Zahl, die 40-/44-t-Grenze auf der Straße (ohne KV-Ausnahme ist die Straße mit ~24 t die schärfere Grenze, nicht der Container) und **VGM** nach SOLAS Kapitel VI Regel 2.
- **Gitterboxen:** Normmaße und Tara, warum im Container trotz 4.000 kg Stapellast **nur zwei Lagen** gehen (3 × 97 cm = 291 cm > 270 cm), und dass bei voll beladenen Boxen im 40-Fuß schon nach **24 statt 46** Schluss ist. Dazu der Abschnitt „Gitterbox, Gittercontainer, Gitterpalette — dasselbe?": die Suchanfrage *gittercontainer* (21 Impressionen) bekommt **keine eigene Seite**, sondern einen Synonym-Abschnitt. Zwei fast gleiche Seiten konkurrieren im Suchergebnis miteinander.

**Zwei neue Seiten**, beide aus sichtbaren Suchanfragen entstanden:

| Seite | Suchanfrage | Was sie kann |
|---|---|---|
| `/ratgeber/stellplaetze-container` · `/en/guide/container-floor-positions` | „stellplätze 20 fuss container" (21) | Alle Palettenarten in **einer** Tabelle, statt fünf Einzelseiten zu vergleichen. Kern: die **117,5 cm** (halbe Innenbreite) und der Dreh-Gewinn 8 → 11 |
| `/ratgeber/stauplan-container` · `/en/guide/container-stowage-plan` | „stauplan container" (20) | Die Seite, die das Werkzeug selbst beschreibt — was in einen Stauplan gehört, in vier Schritten dahin, und was er **nicht** ist (keine Ladungssicherungsplanung) |

**Die Startseite behält ihre SECHS Kacheln.** Das Raster ist `sm:grid-cols-2 lg:grid-cols-3`; nur ein Vielfaches von sechs geht in **beiden** Fällen in ganzen Reihen auf. Verlinkt werden die neuen Seiten stattdessen aus der Übersicht und aus den „Verwandte Fragen"-Blöcken der bestehenden Seiten.

**`test/wissen-vertiefung.test.mjs` liest die neuen Tabellen aus dem HTML und rechnet sie nach** — Zelle für Zelle, in beiden Sprachen:
- Jede Stellplatzzahl gegen `makeFloorPacker`, auch der Dreh-Vergleich (mit und ohne erlaubte 90°-Drehung).
- **Brutto − Tara = die Zuladung aus `PRESETS`.** Die Tabelle erklärt die Zuladung als Differenz; wenn die drei Zahlen nicht aufgehen, widerlegt sie sich selbst.
- Die Gitterbox-Lagen und das Gewichtslimit gegen `packCargo` mit demselben Stückgewicht.
- Die High-Cube-Lagentabelle als Division mit den Innenhöhen aus `PRESETS` — inklusive der Zusicherung, dass bei 110 cm **wirklich** kein Gewinn entsteht.

Beim Schreiben selbst widerlegt: „drei Europaletten quer nebeneinander" sind 240 cm und passen nicht in 235. Die richtige Aussage ist der **Wechsel** — eine längs, eine quer, 200 cm, 35 cm Rest. Genau daher kommen die 11 statt 8. Wer hier einen Satz ergänzt, rechnet ihn vorher nach; das ist auf diesen Seiten keine Formalie, sondern der Grund, warum ihnen jemand glaubt.

### Der Container Guide (`/en/guide/`) — das Container-Wissen auf Englisch
Aus der Search Console: **36 % der Impressionen kommen von außerhalb Deutschlands** (NL, UK, US, IN, PT, NO, CH), und die **meistgesehene Suchanfrage überhaupt** war niederländisch („hoeveel europallets in een 40ft container"). Für all das gab es neun deutsche Seiten und sonst nichts.

**Eigene Adressen, nicht `?lang=en`.** Es sind eigene Seiten mit eigenen Titeln, und der Titel *ist* die gesuchte Frage („How many euro pallets fit in a 40ft container?"). Verknüpft werden die beiden Fassungen über **hreflang**, nicht über den Pfad:

| | |
|---|---|
| Deutsch | `/ratgeber/<deutscher-slug>` — **unverändert**, die Adressen sind indexiert |
| Englisch | `/en/guide/<englischer-slug>` |
| Verknüpfung | `hreflang` **in beide Richtungen** plus `x-default` → Deutsch, auf jeder Seite und in der Sitemap |

Fünf Dinge, die dabei nicht kippen dürfen — `test/container-guide-en.test.mjs` hält jedes einzelne fest:

- **Die Paarigkeit.** Jede deutsche Seite hat genau eine englische und umgekehrt. Der Test schreibt die Paarliste **nicht ab**, sondern liest sie aus den `hreflang`-Angaben der Seiten selbst.
- **hreflang zeigt in beide Richtungen.** Eine Übersetzung, die nur von einer Seite aus verlinkt ist, wertet Google nicht — sie muss sich gegenseitig nennen, und jede Fassung muss die **volle** Liste tragen, auch sich selbst.
- **Eine Gestaltung für beide Bäume.** Die englischen Seiten laden dieselbe `/ratgeber/wissen.css`. Der Pfad heißt weiter `/ratgeber/`, weil die Datei dort liegt; eine Kopie unter `/en/` wäre genau die zweite Fassung, die wegdriftet — dieselbe Geschichte wie oben.
- **Dieselben Zahlen.** `test/wissen-zahlen.test.mjs` rechnet die englischen Seiten mit demselben `makeFloorPacker` nach, und zusätzlich die **Beispielmenge im `?q=`-Link**: stünde dort eine andere Zahl, widerlegte der Rechner den Text in dem Moment, in dem jemand draufklickt.
- **Kein englischer Link zeigt in den deutschen Baum** (außer dem Sprachumschalter, der gemeinsamen CSS-Datei und den Rechtsseiten, die es nur auf Deutsch gibt), und jeder Rechner-Link trägt `lang=en`.

**Der Sprachumschalter zeigt auf die Übersetzung DIESER Seite**, nicht auf die Startseite: wer die Frage auf Deutsch liest, will sie auf Englisch lesen und nicht von vorn anfangen. Er steht als `.lang`-Gruppe in der Kopfzeile — aktiv wird über die Fläche markiert, nicht über einen Rahmen, wie beim Umschalter im Rechner.

**Die Startseite hängt ihre Wissens-Links mit um.** Sie schaltet die Sprache ohne Neuladen; die Kartenlinks zeigen aber auf feste Adressen. Die Zuordnung steht als `GUIDE`-Tabelle in `index.html` neben `appHref` — derselbe Mechanismus, der `/app` zu `/app?lang=en` macht. Ohne sie schickt die englische Startseite ihre Besucher auf deutsche Seiten. Der englische Satz „These reference pages are written in German" ist damit auch weg — er stimmte nicht mehr.

**Die Kopfzeile bricht auf dem Telefon um.** Mit dem Umschalter stehen dort drei Gruppen nebeneinander; gemessen bei 390 px waren es **431 px Inhalt**, und die Seite ließ sich seitlich schieben — genau der Fehler, den `test/mobil.test.mjs` schon einmal eingefangen hat. Unter 560 px bekommt die Schaltfläche deshalb eine eigene, volle Zeile.

**Slugs sind übersetzt, nicht transkribiert:** `euro-pallets-40ft-container`, `wire-mesh-pallets-container`, `how-to-calculate-cbm`. Gesucht wird auf Englisch nach „40ft", nicht nach „40-fuss".

### Messen und melden: die zwei Rückkanäle
Bis August 2026 zählte GoatCounter **nur Seitenaufrufe**, und im Rechner gab es **keinen Weg, etwas zu melden**. Damit fehlten die zwei Signale, an denen jede Priorisierung hängt: ob nach dem Aufruf überhaupt etwas passiert, und ob etwas kaputt ist. Fünf Fehlermeldungen in einer Woche kamen alle als Bildschirmfoto, und jeder Fall musste erst von Hand nachgebaut werden.

**Die Ereigniszählung** (`zaehl(name)` in `app.html`) folgt drei Regeln, und `test/messen-und-melden.test.mjs` prüft alle drei:

| | |
|---|---|
| **Nur der Name geht mit** | Jeder Aufruf trägt eine **feste Zeichenkette** — nie eine Variable, nie eine Interpolation. Der Test liest alle `zaehl(…)`-Aufrufe und lässt nur `"[a-z0-9-]+"` durch. Ein einziges `zaehl("csv-" + preset)` würde die Zusage der Datenschutzseite brechen, ohne dass es auffiele |
| **Je Seitenaufruf höchstens einmal** | Sonst zählt jeder Tastendruck im Mengenfeld eine „Ladung eingegeben" |
| **Eingebettet zählt getrennt** | `demo/…` statt `app/…`. Jeder Startseiten-Besuch lädt den Rechner im iframe mit; ohne die Trennung wäre jede Zahl davon verwässert |

`count.js` lädt async — die Ereignisse **warten in einer Schlange**, bis der Zähler da ist. Ohne das ginge ausgerechnet das erste verloren, und das ist das wichtigste.

Die Liste der Ereignisse steht **im Test**, nicht nur im Code: wer eines ergänzt, fällt dort auf und muss sich dabei die Frage stellen, ob der Name wirklich nichts über die Ladung verrät. Sie bildet eine Kette ab — *Plan per Link geöffnet · Beispiel aus dem Container-Wissen · Ladung eingegeben · gerechnet · mehrere Container · passt nicht · geteilt · exportiert*. `beispiel-geoeffnet` ist dabei die Zahl, an der hängt, ob sich die Arbeit an den Wissens-Seiten in **Nutzung** übersetzt und nicht nur in Impressionen.

**Der Rückkanal** steht als Knopf **„Feedback"** in der Fußzeile des Rechners — genau dort, wo man hinsieht, wenn das Ergebnis daneben nicht stimmt: direkt unter der 3D-Ansicht, neben „geometrische Schätzung". Dazu kommt **einmal je Browser** die Frage „Hat der Plan gepasst?" — unten in der Mitte, dort, wo sonst der Hinweis steht.

Zwei Korrekturen nach der ersten Fassung, beide gemeldet:

- **Er hieß „Problem melden".** Das Formular nimmt Lob genauso entgegen wie Kritik — und wer etwas Nettes schreiben will, klickt nicht auf „Problem melden". Der Name ist irreführend, sobald das Formular mehr kann als Fehler.
- **Er war zu unscheinbar.** Als unterstrichene Textstelle in derselben Farbe wie die Fußzeile drumherum las er sich zwischen zwei grauen Sätzen wie eine Fußnote. Jetzt ein `ghost`-Knopf mit Umriss und Sprechblasen-Symbol. Kostet 10 px Fußzeilenhöhe (42 → 52); bei 1920 und 1440 px bleibt sie einzeilig, seitlich schiebbar wird nichts. Wer daran dreht, misst bei **390 px** nach — dort ist sie ohnehin zweizeilig.

**Es ist ein echtes Formular, ohne Server und ohne Build-Schritt.** Die erste Fassung war ein `mailto`; das verlangt aber ein eingerichtetes Mailprogramm und wirft den Absender aus dem Rechner heraus — an einem Arbeitsplatz mit Webmail passiert schlicht nichts. Möglich wird das Formular dadurch, dass die Seite bei **Netlify** liegt: Netlify erkennt beim Deploy ein statisches `<form data-netlify="true">` im ausgelieferten HTML und nimmt dafür POSTs entgegen.

| | |
|---|---|
| **Das versteckte Formular** steht statisch in `app.html` | Der sichtbare Dialog kommt aus React — Netlify erkennt Formulare aber beim **Deploy**, nicht zur Laufzeit. Ohne das statische Formular gäbe es keinen Endpunkt |
| **Die Feldnamen müssen übereinstimmen** | Weichen Dialog und Formular ab, verwirft Netlify die Eingabe **still**: keine Fehlermeldung, der Absender sieht „Danke", und die Rückmeldung ist weg. Der Test vergleicht beide Listen gegeneinander |
| **`application/x-www-form-urlencoded`**, nicht JSON | JSON wird ebenso stillschweigend verworfen |
| **Fehlschlag fällt auf das `mailto` zurück** | Datei lokal geöffnet, Formulare nicht aktiviert, offline — dann darf die Rückmeldung nicht verschluckt werden. Die Adresse wird **aus dem Impressum gelesen**, nicht abgeschrieben |

**Die Ladung geht nur mit, wenn das Kästchen steht.** Es ist sichtbar, beschriftet und abwählbar, und es ist standardmäßig angehakt — ohne den Plan-Link muss jeder Fall wieder von Hand nachgebaut werden. Die Datenschutzseite verspricht in Abschnitt 2, dass die Eingaben das Gerät **von selbst** nicht verlassen; dieses Formular ist die eine Ausnahme, und sie ist eine bewusste Handlung des Absenders. Der Satz dort wurde deshalb präzisiert — er behauptete vorher pauschal, es gehe nie etwas hinaus. `test/messen-und-melden.test.mjs` prüft genau diese Eingrenzung mit.

**Die Frage kommt einmal und dann nie wieder** (`containerload.feedback.v1`, gehört damit auch in die Datenschutzseite) — und erst, wenn jemand wirklich etwas vom Rechner hatte: nach dem ersten Weitergeben (Teilen, Bild, CSV, Ladevorschlag) oder nach einer Minute mit einem fertigen Plan. **Im eingebetteten Rechner der Startseite gar nicht:** dort schaut man sich um, man arbeitet nicht. Steht gerade ein Hinweis unten in der Mitte, wartet die Frage — zwei Kästen übereinander an derselben Stelle wären schlechter als gar keine Frage.

**Die Netlify-Einrichtung ist ein Deploy-Schritt, kein Laufzeit-Schalter.** Beim ersten Anlauf kam ein **404** auf den POST: Formularerkennung war aus. Der Weg, in dieser Reihenfolge — der mittlere Schritt wird gern übersehen:
1. Forms → **Enable form detection**
2. **Neu deployen** — Netlify erkennt Formulare beim Deploy, nicht rückwirkend
3. Forms → das Formular **`feedback`** muss dort auftauchen (noch ohne Einsendungen)
4. Notifications → **Email notification** auf *New form submission*

Wer die Felder ändert, muss deshalb **neu deployen**, sonst verwirft Netlify die unbekannten stillschweigend.

**Die Benachrichtigungs-Mail lässt sich nicht gestalten** — Netlify verschickt schmucklosen Text und schreibt den Wert des **ersten Feldes** in die Betreffzeile. Das erste Feld ist deshalb `zusammenfassung` (*„Passt nicht · 40′ HC · 3 Positionen"*): vorher stand im Posteingang „Form submission from feedback form: **gut**", was nichts sagt. Netlify stellt 36 Zeichen voran — die Zusammenfassung bleibt darum kurz und beginnt mit dem, was zählt.

Die übrigen Felder sind so zusammengefasst, dass die Mail **ohne Gestaltung lesbar** bleibt: neun Zeilen mit halb leeren Überschriften waren schlechter als sechs volle. Leere freiwillige Angaben tragen einen Gedankenstrich — eine Überschrift ohne Inhalt liest sich wie ein Fehler. **Der Inhalt ist deutsch, unabhängig von der Sprache der Oberfläche:** diese Mail liest der Projektinhaber, nicht der Absender. Deshalb steht dort auch kein `T`-Schlüssel — sichtbar ist davon im Rechner nichts.

> **Was außerhalb des Codes bleibt:** ob für die Formulardaten ein **Auftragsverarbeitungsvertrag mit Netlify** nötig ist.

**Die Datenschutzseite nennt beides namentlich** — dieselbe Ehrlichkeitsregel wie bei den Zahlen und beim Entwurf: was die Seite tut, steht dort auch.

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

**Der Knopf trägt ein Symbol** (Papierkorb, `ICO.s` / `ICO.sw`). Gemeldet als *„mir fehlt der Button, mit dem ich die Ladung zurücksetze"* — es gab ihn, genau dort im Kopf der Ladungsliste, aber als **reines Wort in der leisesten Variante** zwischen einer Trennlinie und dem cm/mm-Umschalter. Er las sich wie eine Beschriftung, nicht wie eine Handlung. Leise bleibt richtig; unsichtbar war es nicht.

**„Leeren" verwirft auch die manuell gesetzten Folgecontainer** (`chainOverride`). Sie gehörten zur alten Ladung: wer C2 für eine Sendung auf einen 20-Füßer gestellt, dann geleert und etwas ganz anderes eingetippt hat, bekam den 20-Füßer wieder vorgesetzt. Beim Laden eines gespeicherten Plans wurde genau deshalb längst geleert — beim Leeren fehlte es. Die manuell platzierten Stücke räumt `remapPlaced` von selbst ab; ohne Ladung gibt es keine `cid` mehr, auf die sie zeigen könnten.

**Der Rückgängig-Stapel hält deshalb `{ cargo, ov }`**, nicht mehr nur die Ladung. Ein Zurücknehmen, das die Ladung wiederbringt und die Container darunter auf „Auto" stehen lässt, wäre nur halb.

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

**Der Punkt unter dem Zeiger muss ein echter Punkt sein.** Gemeldet als *„beim Mausrad nach vorne werde ich teilweise teleportiert"* — und der Fehler saß in `punktUnterZeiger`. Es schnitt nur eine **unendliche** waagerechte Ebene auf Zielhöhe, und die trifft der Strahl auch dann, wenn der Zeiger neben der Ladung ins Leere zeigt. Gerechnet mit den echten Kamerawerten:

| Blick | Zeiger | Bodentreffer | ein Radschritt versetzt das Ziel um |
|---|---|---|---|
| Ruhelage (φ = 1,0) | Bildmitte | 0 m | 0 m |
| Ruhelage | oben links, leer | 18,9 m | **2,5 m** |
| flach (φ = 1,4, nach dem Drehen) | oberes Bilddrittel | 44,1 m | **5,8 m** |

Ein 40-Fuß-Container ist 12 m lang. Danach klemmt `zielKlemmen` das Ziel hart an den Rand der Reihe — genau das sieht aus wie ein Sprung. Derselbe Fehler steckte im Doppelklick.

Jetzt zwei Stufen: **erst auf die Kisten selbst schießen** (nur `isInstancedMesh` — Hüllen, Boden und Raster sind Linien und Flächen, die der Strahl weit außerhalb der Reihe trifft), und nur wenn das nichts trifft, auf die Bodenebene — und die auch nur, solange der Punkt zur Reihe gehört (`imRahmen`). Zeigt der Zeiger ins Leere, **passiert nichts**; das ist hier die richtige Antwort, denn der Nutzer hat auf nichts gezeigt.

`imRahmen` und `zielKlemmen` benutzen **denselben Auslauf** (`m = 2`). Zwei verschiedene Maße wären genau die Art Abweichung, die später niemand mehr erklären kann: das Ziel dürfte an eine Stelle springen, an der es nicht bleiben darf. `test/kamera-schieben.test.mjs` hält beides fest — den Vertrag im Quelltext **und** die Rechnung, die den Fehler erklärt (sie liest Bildwinkel, Ruhelage und Zoomschritt aus `app.html`, damit sie nicht stillschweigend veraltet).

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

**„Nicht stapelbar" ist etwas anderes** — siehe den eigenen Abschnitt gleich darunter.

### „Nicht stapelbar" heißt beides
Gemeldet mit Link (`?c=d~250x80x30w300q9snPackage~120x80x110w300q22y3nPackage`): 9 Packstücke 250 × 80 × 30, ausdrücklich **nicht stapelbar**, dazu 22 Paletten. Im Ergebnis trugen **sechs der acht** verladenen Stücke je zwei bis drei Paletten. Nachgestellt und Zeile für Zeile bestätigt.

Der Rechner hat die Angabe bis dahin **zur Hälfte** befolgt: „nicht stapelbar" hieß nur *„ich darf auf nichts stehen"* (`S.y > 1e-6` in `emsPackOnce`), nicht *„auf mir steht nichts"* — die Tragfähigkeit solcher Stücke stand ausdrücklich auf `Infinity`. Das war als fachliche Festlegung dokumentiert und ist trotzdem falsch, aus drei Gründen, die alle in dieselbe Richtung zeigen:

- **Das eigene Auswahlfeld sagt es anders.** Dort steht „nicht stapelbar / 1× / 2× / 3× stapelbar / bis Höhe … / frei stapelbar". Jede andere Stufe dieser Reihe begrenzt genau eine Sache — **was oben drauf darf**. Nur die erste meinte etwas anderes.
- **Der Aufkleber am Packstück sagt es anders.** „Stapelverbot" / „do not stack" ist eine Aussage über die Oberseite.
- **Der eigene Ladevorschlag sagte es anders** („Nicht stapelbare Positionen zuletzt bzw. oben verladen") — der Hinweis widersprach dem Bild daneben und ist jetzt mit angepasst.

Seitdem gilt **beides**: das Stück steht auf nichts *und* trägt nichts. Umgesetzt ohne Sonderweg — `stackCapOf` liefert für solche Stücke ohnehin 1, also ist ihre Tragfähigkeit einfach ihr `stackMax` wie bei jedem anderen Stück auch (`lim = pos` heißt: über dieser Lage geht in dieser Säule nichts mehr).

**Der manuelle Pfad zog nach, und dabei fiel ein zweiter Fehler auf.** `manualCandidate` prüfte die **eigene** Tragfähigkeit des gezogenen Stückes gegen die Turmhöhe. Bei gleicher Ware kommt dasselbe heraus, bei gemischter ist es die falsche Zahl: was ich tragen kann, sagt nichts darüber, was **unter** mir aushält. `towerCapLimit` rechnet jetzt dieselbe Grenze wie `lim` im Auto-Packer. Fehlt die Ladungsliste (ältere Aufrufer, Tests), fällt es auf die alte Annahme „unter mir steht dieselbe Ware" zurück.

**Was es gekostet hat, und zwar bewusst** — über die 300 Ladungen des Messstands **381 von 15.127 Packstücken (2,5 %)** und **136,7 von 5.529 m³ (2,5 %)**:

```
vorher   {"szenarien":300,"verladen":15127,"volumen":5529.496,"mitEtagen":295,"ySumme":1051180}
nachher  {"szenarien":300,"verladen":14746,"volumen":5392.790,"mitEtagen":290,"ySumme":933040}
```

Das ist der teuerste Einzelposten in diesem Rechner, und er ist trotzdem richtig: die vorher mitgezählten Packstücke standen auf Ware, die niemand belädt. Sichtbar wird es dort, wo beide Sorten gleich groß sind — in einem 20′ GP fallen 11 nicht stapelbare + 11 stapelbare Paletten von 22 auf 16 (die Rechnung dazu steht in `test/pack-order.test.mjs`).

`test/nicht-stapelbar.test.mjs` hält beide Hälften fest, in beiden Pfaden, mit **Gegenprobe**: dieselbe Ladung als stapelbar *muss* belastet werden, sonst prüfte der Test nur, dass der Packer gar nicht mehr stapelt.

> **Offen geblieben:** die Ladung wird weiterhin **verstreut** gestaut statt in Blöcken — im gemeldeten Fall liegen die flachen Stücke einzeln zwischen den Paletten, und über ihnen sind 240 cm Luft, die jetzt niemand mehr nutzen kann. Das ist kein Regelverstoß, sondern die Extrempunkt-Heuristik: sie maximiert Stückzahl und Volumen, nicht Ordnung. „Nach Logik stauen" (gleiche Sorte im Block, nicht stapelbares an einem Ende, Ladung nach vorn geschoben) wäre ein eigener Durchgang **nach** dem Packen, der an Anzahl und Volumen nichts ändern darf.

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
