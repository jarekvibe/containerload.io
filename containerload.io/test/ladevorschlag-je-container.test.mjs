// Der Ladevorschlag: ein Deckblatt mit dem Plan, danach ein Blatt je Container.
//
// Bis dahin war er EIN Blatt. Die Stauplan-Zeichnung zeigte den ersten Container, darunter
// stand ein Hinweissatz "Zeichnung zeigt Container 1 von N". Wer drei Container buchte,
// bekam ein Dokument ueber einen davon -- und die Ladeliste darin nannte die eingegebene
// Menge, nicht die, die in dem gezeichneten Container liegt.
//
// Entschieden war (Entwurf, Frage 4): Deckblatt plus Seiten. Das Deckblatt ist das, was in
// die Buchung geht; die Blaetter danach sind das, was der Fahrer bekommt.
//
// node --test test/ladevorschlag-je-container.test.mjs
import fs from "node:fs";
import assert from "node:assert";
import test from "node:test";
import { fileURLToPath } from "node:url";
import path from "node:path";

const dir = path.dirname(fileURLToPath(import.meta.url));
const roh = fs.readFileSync(path.join(dir, "..", "app.html"), "utf8");
const L = roh.split("\n");
// Von "von" bis AUSSCHLIESSLICH "bis" -- die Endmarke ist der Anfang des naechsten Bausteins.
const schnitt = (von, bis) => {
  const s = L.findIndex((l) => l.includes(von));
  const e = L.findIndex((l, i) => i > s && l.includes(bis));
  assert.ok(s >= 0 && e > s, `Ausschnitt nicht gefunden: ${von}`);
  return L.slice(s, e).join("\n");
};
// Die reinen Bausteine der Druckvorlage plus die Formatierer, die sie brauchen.
const { LV_ROW, LV_UEBERSICHT, LV_PAGE, kettenLabelVor } = new Function(
  `var LANG = "de";
   var num=(v,d=0)=>Number.isFinite(+v)&&v!==""?+v:d;
   ${schnitt("var cmTxt =", "var makeQR =")}
   ${schnitt("var LV_ROW =", "  var LV_STOWAGE =")}
   ${schnitt("var LV_PAGE = (D) => {", "  var LV_UEBERSICHT =")}
   ${schnitt("var LV_UEBERSICHT =", "  var LV_DOC =")}
   ${schnitt("function kettenLabelVor", "  // CSV-Export der Ladeliste")}
   return { LV_ROW, LV_UEBERSICHT, LV_PAGE, kettenLabelVor };`
)();

test("die gebuchte Kombination wird nach Typ gezaehlt", () => {
  const k = (namen) => kettenLabelVor(namen.map((n) => ({ name: n })), "?");
  assert.strictEqual(k(["40' HC"]), "1× 40' HC");
  assert.strictEqual(k(["40' HC", "40' GP"]), "1× 40' HC + 1× 40' GP");
  assert.strictEqual(k(["40' HC", "40' HC", "20' GP"]), "2× 40' HC + 1× 20' GP");
  // Ohne Namen greift der Rueckfall -- sonst stuende "undefined" im Dokument.
  assert.strictEqual(kettenLabelVor([{}, {}], "Planensattel"), "2× Planensattel");
});

test("eine Zeile rechnet Gewicht und Volumen aus IHRER Menge", () => {
  // Auf einem Containerblatt steht die Menge, die dort liegt. Rechnete die Zeile weiter mit
  // der eingegebenen Menge, summierte sich das Blatt auf ein Gewicht, das nie im Container war.
  const it = { name: "Flach", l: 250, w: 80, h: 30, weight: 300, qty: 9, stackable: false };
  const ganz = LV_ROW(it, 0, "de", 1);
  const teil = LV_ROW({ ...it, qty: 2 }, 0, "de", 1);
  assert.ok(ganz.includes(">2.700<"), "9 x 300 kg fehlt in der vollen Zeile");
  assert.ok(teil.includes(">600<"), "2 x 300 kg fehlt in der Teilzeile");
  assert.ok(!teil.includes(">2.700<"), "die Teilzeile rechnet noch mit der eingegebenen Menge");
});

test("die Uebersicht des Deckblatts nennt jeden Container mit seinen Zahlen", () => {
  const reihen = [
    { marke: "C1", name: "40' HC", stueck: 24, vol: 24.4, cVol: 76.3, kg: 7200, pay: 26580, vollPct: 32 },
    { marke: "C2", name: "40' GP", stueck: 7, vol: 4.2, cVol: 67.6, kg: 2100, pay: 26600, vollPct: 6 },
  ];
  const html = LV_UEBERSICHT(reihen, "de");
  const zeilen = (html.match(/<tr /g) || []).length;
  assert.strictEqual(zeilen, 3, "Kopfzeile + zwei Container");
  ["C1", "C2", "40' HC", "40' GP", "24", "7", "24,4", "76,3", "7.200", "26.580", "32 %", "6 %"].forEach((t) => {
    assert.ok(html.includes(t), `"${t}" fehlt in der Uebersicht`);
  });
  const en = LV_UEBERSICHT(reihen, "en");
  assert.ok(en.includes("PER CONTAINER") && !en.includes("JE CONTAINER"), "die englische Fassung fehlt");
});

test("die Seitenzahl und die Kopfzeile lassen sich je Blatt setzen", () => {
  const D = {
    REF: "CL-1", DATUM: "29.08.2026", CONTAINER_LABEL: "C2 · 40' GP", INNENMASS: "1 × 1 × 1 cm",
    PAYLOAD: "1", POSCOUNT: 1, COLLI: 1, VOL: "1,0", VOLBAR: 1, VOLPCT: 1, WEIGHT: "1", WTBAR: 1, WTPCT: 1,
    PASSTIN: "C2", PASSTSUB: "Container 2 von 2", ROWS: "", SUMQTY: 1, SUMKG: "1", SUMVOL: "1,0",
    QR: "", QRURL: "", STOWAGE: "", LANG: "de"
  };
  assert.ok(LV_PAGE({ ...D, SEITE: "Seite 2 / 3" }).includes("Seite 2 / 3"), "SEITE wird nicht uebernommen");
  assert.ok(LV_PAGE(D).includes("Seite 1 / 1"), "ohne SEITE bleibt der alte Rueckfall");
  assert.ok(LV_PAGE({ ...D, MITTE_LABEL: "GEBUCHT" }).includes("GEBUCHT"), "MITTE_LABEL wird nicht uebernommen");
  assert.ok(LV_PAGE(D).includes("INNENMASS"), "ohne MITTE_LABEL bleibt die alte Beschriftung");
});

// ── Der Vertrag im Quelltext ────────────────────────────────────────────────────────
test("gebaut wird ein Deckblatt plus ein Blatt je Container -- bei einem Container nur eines", () => {
  assert.ok(/const mehrere = !!\(kette && kette\.length > 1\);/.test(roh),
    "die Unterscheidung Kette / Einzelcontainer fehlt");
  assert.ok(/const seitenZahl = mehrere \? kette\.length \+ 1 : 1;/.test(roh),
    "die Seitenzahl ist nicht Deckblatt + Container");
  assert.ok(/const blaetter = \[deck\];[\s\S]{0,80}?if \(mehrere\) \{[\s\S]{0,120}?kette\.forEach\(\(slot, ci\) => \{/.test(roh),
    "die Blaetter je Container werden nicht gebaut");
  assert.ok(/const pageHTML = blaetter\.join\(""\);/.test(roh), "die Blaetter werden nicht zusammengesetzt");
});

test("jedes Containerblatt zeigt nur seine Positionen, mit seiner Menge", () => {
  const m = roh.match(/const jeSorte = cargo\.map\(\(_, k\) => sp\.filter\(\(b\) => b\.ti === k\)\.length\);[\s\S]{0,3000}?SEITE: seitenText\(ci \+ 2\)/);
  assert.ok(m, "der Aufbau eines Containerblatts sieht anders aus als erwartet");
  const b = m[0];
  assert.ok(/\.filter\(\(z\) => z\.n > 0\)/.test(b), "Positionen ohne Stueck in diesem Container werden nicht weggelassen");
  assert.ok(/LV_ROW\(\{ \.\.\.z\.it, qty: z\.n \}/.test(b), "die Zeile bekommt nicht die Menge dieses Containers");
  assert.ok(/it: \{ \.\.\.cargo\[\+ti\], qty: jeSorte\[\+ti\] \}/.test(b),
    "die Legende der Zeichnung nennt wieder die eingegebene Menge statt der im Container");
  assert.ok(/chainLen: 1/.test(b),
    "der Hinweis 'Zeichnung zeigt Container 1 von N' steht wieder auf einem Blatt, das EIN Container ist");
});

test("das Deckblatt spricht ueber den Plan, nicht ueber den ersten Container", () => {
  assert.ok(/MITTE_LABEL: mehrere \?/.test(roh), "das mittlere Feld bleibt auf dem Deckblatt leer");
  assert.ok(/INNENMASS: mehrere \? fmt1DE\(planCVol\)/.test(roh), "das Deckblatt zeigt kein gebuchtes Gesamtvolumen");
  assert.ok(/PAYLOAD: mehrere \? \(planPayload > 0/.test(roh), "das Deckblatt zeigt die Zuladung eines Containers");
  assert.ok(/VOLPCT: Math\.round\(mehrere \? planVolPct : volPct\)/.test(roh), "die Auslastung des Deckblatts misst gegen einen Container");
  assert.ok(/STOWAGE: mehrere \? LV_UEBERSICHT\(slotRows, LANG\) : STOWAGE/.test(roh),
    "auf dem Deckblatt steht keine Uebersicht je Container");
  // Und "Passt in" nennt die gebuchte Kette, nicht eine Empfehlung, die davon abweichen kann.
  assert.ok(/if \(result && result\.chain && result\.chain\.length > 1 && planFit\) \{\s*\n\s*passtin = kettenLabelVor\(result\.chain\);/.test(roh),
    "das Deckblatt zeigt bei vollstaendigem Plan nicht die gebuchte Kette");
});

test("mehrere Blaetter brechen im Druck um und stehen am Bildschirm untereinander", () => {
  assert.ok(/\.page\{[^}]*break-after:page;page-break-after:always\}/.test(roh),
    "im Druck folgt kein Seitenumbruch zwischen den Blaettern");
  assert.ok(/\.page:last-of-type\{break-after:auto;page-break-after:auto\}/.test(roh),
    "hinter dem letzten Blatt steht ein Umbruch -- das ergibt eine leere Seite");
  assert.ok(/@media screen\{\.page\+\.page\{margin-top:24px\}\}/.test(roh),
    "am Bildschirm kleben die Blaetter aneinander");
});
