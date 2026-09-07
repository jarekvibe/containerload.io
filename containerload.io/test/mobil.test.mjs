// Drei Seiten liessen sich auf dem Telefon seitlich schieben.
//
// Gefunden mit einem echten Browser bei 390 px, festgehalten hier als das, was im
// Quelltext dafuer stehen muss — die CI hat keinen Browser, aber sie kann pruefen,
// ob die Vorkehrung noch da ist.
//
//   Startseite: .clh-stage hat min-height 380 px UND ein Seitenverhaeltnis. Beides
//     zusammen bestimmt die BREITE: 380 hoch bei 1,05 sind 399 breit — mehr, als ein
//     390 px schmales Telefon hergibt. Die Buehne hat die ganze Seite hinausgeschoben.
//   Container-Wissen: die Zahlenspalten stehen mit white-space:nowrap (richtig so, eine
//     Zahl darf nicht umbrechen). Die Tabelle wurde dadurch breiter als das Fenster.
//   Rechner: Marke, Sprachwahl, Planname, Speichern, Teilen und "…" brauchen zusammen
//     479 px in einer Zeile.
//   Startseite, Kopfzeile "Tool öffnen": bei 390 px reichte die rechte Kante des Knopfs
//     bis 410 px — die Nav-Elemente (Aussenabstand, Nav-Innenabstand, der Abstand vor dem
//     Burger und das Knopf-Polster) waren fuer ein schmales Telefon zu breit gerechnet.
//     Unter dem vorhandenen sm-Umbruch (640 px, dort schaltet ohnehin die Sprachwahl frei)
//     bekommen sie kleinere, aus der Abstandsreihe 4/8/12/16 stammende Werte; ab 640 px
//     bleiben es exakt die alten Werte (sm:-Variante).
//
// node --test test/mobil.test.mjs
import fs from "node:fs";
import assert from "node:assert";
import test from "node:test";
import { fileURLToPath } from "node:url";
import path from "node:path";

const dir = path.dirname(fileURLToPath(import.meta.url));
const lies = (...p) => fs.readFileSync(path.join(dir, "..", ...p), "utf8");

test("die Hero-Buehne gibt ihre Mindesthoehe auf schmalen Schirmen auf", () => {
  const s = lies("index.html");
  assert.match(s, /\.clh-stage\{[^}]*min-height:\s*380px/, "die Buehne hat keine Mindesthoehe mehr — dann ist dieser Test gegenstandslos");
  const m = s.match(/@media\(max-width:(\d+)px\)\{\.clh-stage\{min-height:0\}\}/);
  assert.ok(m, "es fehlt die Regel, die die Mindesthoehe auf schmalen Schirmen aufhebt");
  assert.ok(Number(m[1]) >= 440,
    `die Regel greift erst ab ${m[1]} px — die Buehne erzwingt aber schon bei rund 440 px eine zu grosse Breite`);
});

test("jede Tabelle im Container-Wissen scrollt in ihrem eigenen Kasten", () => {
  const css = lies("ratgeber", "wissen.css");
  assert.match(css, /\.tabelle\{[^}]*overflow-x:\s*auto/, "wissen.css kennt keinen scrollenden Tabellenkasten");
  // Beide Sprachbaeume, nicht nur der deutsche: die englischen Seiten tragen dieselben
  // Tabellen und haetten dieselbe Falle.
  for (const ordner of [["ratgeber"], ["en", "guide"]]) {
    for (const f of fs.readdirSync(path.join(dir, "..", ...ordner)).filter((x) => x.endsWith(".html"))) {
      const s = lies(...ordner, f);
      const tabellen = (s.match(/<table>/g) || []).length;
      const umschlossen = (s.match(/<div class="tabelle"><table>/g) || []).length;
      assert.strictEqual(umschlossen, tabellen, `${ordner.join("/")}/${f}: ${tabellen} Tabellen, davon ${umschlossen} im Kasten`);
    }
  }
});

test("die Kopfzeile des Container-Wissens bricht auf dem Telefon um", () => {
  // Mit dem Sprachumschalter stehen dort drei Gruppen nebeneinander. Gemessen bei 390 px:
  // 431 px Inhalt — die Seite liess sich seitlich schieben. Die Schaltflaeche geht deshalb
  // unter 560 px in eine eigene, volle Zeile.
  const css = lies("ratgeber", "wissen.css");
  const eng = css.slice(css.indexOf("@media(max-width:560px)"));
  assert.ok(eng.length > 50, "wissen.css hat keine Regel fuer schmale Schirme");
  const block = eng.slice(0, eng.indexOf("}", eng.indexOf("}") + 1) + 200);
  assert.match(block, /\.nav-in\{[^}]*flex-wrap:\s*wrap/, "die Kopfzeile darf auf dem Telefon nicht umbrechen");
  assert.match(block, /\.nav-in>\.btn\{[^}]*flex:\s*1 1 100%/, "die Schaltflaeche bekommt keine eigene Zeile");
});

test("die Kopfzeile des Rechners darf auf dem Telefon umbrechen", () => {
  const s = lies("app.html");
  assert.match(s, /"header", \{ className: "flex flex-wrap items-center/,
    "die Kopfzeile bricht nicht mehr um — auf 390 px passt sie nicht in eine Zeile");
  // Die Sprachwahl muss sich per Klasse ausblenden lassen. Stuende display:flex fest im
  // style-Attribut, koennte "hidden sm:flex" nichts ausrichten.
  const i = s.indexOf('["de", "en"].map((l)');
  const davor = s.slice(Math.max(0, i - 260), i);
  assert.match(davor, /className: "hidden sm:flex"/, "die Sprachwahl im Kopf laesst sich nicht mehr ausblenden");
  assert.ok(!/className: "hidden sm:flex", style: \{ display: "flex"/.test(davor),
    "display:flex steht wieder fest im style-Attribut und schlaegt die Klasse");
});

test('der Knopf "Tool öffnen" ragt auf dem Telefon nicht mehr ueber den Rand', () => {
  // Gemessen: rechte Kante bei 390 px reichte bis 410 px. Die Elemente vor dem Burger
  // (Aussenabstand der Nav-Leiste, Nav-Innenabstand rechts, Abstand vor dem Burger,
  // Knopf-Polster) bekommen deshalb unter dem vorhandenen sm-Umbruch (640 px) kleinere
  // Werte aus der Abstandsreihe 4/8/12/16 — ab 640 px exakt die alten Werte.
  const s = lies("index.html");

  const aussen = s.match(/<div class="fixed top-3 inset-x-0 z-50 ([^"]+)">\s*<nav id="nav"/);
  assert.ok(aussen, "der Nav-Aussenrahmen wurde nicht gefunden");
  assert.match(aussen[1], /\bpx-2 sm:px-3\b/, "der Aussenabstand der Nav-Leiste ist auf dem Telefon nicht verkleinert");

  const nav = s.match(/<nav id="nav" class="([^"]+)">/);
  assert.ok(nav, "die Nav-Leiste wurde nicht gefunden");
  assert.match(nav[1], /\bpr-1 sm:pr-2\b/, "der rechte Nav-Innenabstand ist auf dem Telefon nicht verkleinert");

  const i = s.indexOf('data-i18n="nav_open"');
  assert.ok(i > -1, 'der Knopf "Tool öffnen" wurde nicht gefunden');
  const zeile = s.slice(Math.max(0, i - 700), i + 200);
  assert.match(zeile, /class="flex items-center gap-1 sm:gap-2"/,
    "der Abstand vor dem Burger ist auf dem Telefon nicht verkleinert");
  assert.match(zeile, /class="btn btn-primary text-\[13px\] px-2 sm:px-4 py-2"/,
    "das Knopf-Polster ist auf dem Telefon nicht verkleinert");
});

test("im Rechner steht auf dem Telefon die 3D-Ansicht vor der Seitenleiste", () => {
  // Gemessen bei 390x844: die 3D-Ansicht begann erst bei ~1070 px Dokumenttiefe — wer
  // einen geteilten Plan an der Rampe oeffnete, sah zuerst Container-Wahl und die ganze
  // Ladungsliste und musste anderthalb Bildschirme scrollen, um den Plan zu SEHEN.
  // Die order-Klassen drehen die Reihenfolge nur unter lg; ab lg (Spalten) gilt wieder
  // die Dokument-Reihenfolge. Wer sie entfernt, holt das alte Problem zurueck.
  const s = lies("app.html");
  assert.match(s, /"aside", \{ className: "order-2 lg:order-none w-full lg:w-\[360px\]/,
    "die Seitenleiste rueckt auf dem Telefon nicht mehr hinter die 3D-Ansicht");
  assert.match(s, /"main", \{ className: "order-1 lg:order-none flex-1 min-w-0 min-h-0 flex flex-col"/,
    "die 3D-Spalte steht auf dem Telefon nicht mehr zuerst");
  // Und die 3D-Ansicht behaelt ihre Mindesthoehe — ohne sie faellt der Viewport im
  // gestapelten Layout in sich zusammen.
  assert.match(s, /min-h-\[380px\] lg:min-h-0/,
    "die 3D-Ansicht hat auf dem Telefon keine Mindesthoehe mehr");
});

test("Anfassflaechen wachsen auf dem Telefon auf mindestens 40 px", () => {
  // Die Btn-Varianten polstern 4-12 px um 11,5-13,5 px Schrift — am Schreibtisch genug,
  // mit dem Finger nicht. Die Regel haengt an min-height (steht nirgends inline) und
  // greift nur unter lg, deshalb bleibt der Desktop pixelgleich.
  const s = lies("app.html");
  assert.match(s, /@media \(max-width: 1023px\)\{button\.transition\{min-height:40px\}\}/,
    "die Mindesthoehe fuer Knoepfe auf dem Telefon fehlt");
});

test("zwei Finger zoomen die 3D-Ansicht auf dem Telefon", () => {
  // Auf dem Telefon gibt es kein Mausrad; ohne Pinch kommt der Empfaenger eines
  // geteilten Plans nicht an die Positionen heran. Der Pinch nutzt dieselben
  // Radius-Grenzen wie das Rad (2.5 / 95) und darf im manuellen Modus keine Kiste
  // setzen (nach dem Pinch kein handleManualClick).
  const s = lies("app.html");
  assert.ok(s.includes("pinchR0 * pinchD0 / d"), "der Pinch skaliert den Kameraradius nicht mehr");
  assert.match(s, /sph\.r = Math\.max\(2\.5, Math\.min\(95, pinchR0 \* pinchD0 \/ d\)\);/,
    "der Pinch haelt die Radius-Grenzen des Rads nicht ein");
  assert.ok(/if \(pinchte\) \{[\s\S]{0,300}?return;[\s\S]{0,50}?\}\s*\n\s*const warSchieben = schiebt;/.test(s),
    "nach einem Pinch wuerde der letzte Finger im manuellen Modus eine Kiste setzen");
  assert.ok(s.includes('window.addEventListener("pointercancel", up);'),
    "ohne pointercancel bleibt nach einer Systemgeste ein Finger in der Zeiger-Karte haengen");
});
