// Die Zahlen im Container-Wissen muessen dem Rechner entsprechen, in den sie verlinken.
//
// Vorgeschichte: Auf den Seiten standen Stellzahlen, die der eigene Packer widerlegt —
// "25–26 Europaletten" im 40-Fuss (26 ist geometrisch unmoeglich), "9–10"
// Industriepaletten im 20-Fuss (es sind 9), "rund 21" im 40-Fuss (es sind 22) und
// "24–25" Gitterboxen (mit den echten 124x83 cm sind es 23). Jede dieser Seiten hat
// einen Knopf "Im 3D-Rechner ansehen". Wer dort klickt und eine andere Zahl sieht,
// weiss nicht mehr, welcher Angabe er glauben soll — und genau das Vertrauen ist das
// Produkt.
//
// Dieser Test schreibt die Zahlen nicht ab, sondern RECHNET sie mit demselben Packer
// nach, den der Rechner benutzt. Aendert sich der Packer, faellt der Test auf.
import fs from "node:fs";
import assert from "node:assert";
import test from "node:test";
import { fileURLToPath } from "node:url";
import path from "node:path";

const dir = path.dirname(fileURLToPath(import.meta.url));
const app = fs.readFileSync(path.join(dir, "..", "app.html"), "utf8");
const L = app.split("\n");
// Die Containermasse kommen ebenfalls aus app.html — auch sie werden hier nicht
// abgeschrieben, sonst waere der Test die naechste Kopie, die wegdriftet.
const pStart = L.findIndex((l) => l.includes("var PRESETS = {"));
const pEnd = L.findIndex((l, i) => i > pStart && l.trim() === "};");
const ps = L.findIndex((l) => l.includes("function makeFloorPacker"));
const pe = L.findIndex((l, i) => i > ps && l.trim() === "}" && L[i - 1].includes("return { placed, perType"));
const { makeFloorPacker, PRESETS } = new Function(
  'var num=(v,d=0)=>Number.isFinite(+v)&&v!==""?+v:d;\n'
  + L.slice(pStart, pEnd + 1).join("\n") + "\n"
  + L.slice(ps, pe + 1).join("\n") + "\nreturn { makeFloorPacker, PRESETS };"
)();

const seite = (f) => fs.readFileSync(path.join(dir, "..", "ratgeber", f), "utf8");
const stellplaetze = (preset, l, w) => {
  const C = PRESETS[preset];
  return makeFloorPacker(l, w, true)(C.l, C.w).count;
};

// [Datei, Beschreibung, Preset, Packstueckmass, wie die Zahl auf der Seite steht]
const FAELLE = [
  ["europaletten-20-fuss-container.html", "Europaletten im 20'", "20' GP", [120, 80], 11],
  ["europaletten-40-fuss-container.html", "Europaletten im 40'", "40' GP", [120, 80], 25],
  ["industriepaletten-container.html", "Industriepaletten im 20'", "20' GP", [120, 100], 9],
  ["industriepaletten-container.html", "Industriepaletten im 40'", "40' GP", [120, 100], 22],
  ["gitterboxen-container.html", "Gitterboxen im 20'", "20' GP", [124, 83], 11],
  ["gitterboxen-container.html", "Gitterboxen im 40'", "40' GP", [124, 83], 23]
];

test("die genannten Stellzahlen stimmen mit dem Packer ueberein", () => {
  for (const [, was, preset, [l, w], behauptet] of FAELLE) {
    const echt = stellplaetze(preset, l, w);
    assert.strictEqual(behauptet, echt, `${was}: die Seite nennt ${behauptet}, der Packer rechnet ${echt}`);
  }
});

test("die Zahl steht auch wirklich auf der jeweiligen Seite", () => {
  for (const [datei, was, , , behauptet] of FAELLE) {
    assert.ok(new RegExp(`\\b${behauptet}\\b`).test(seite(datei)), `${datei}: ${was} — die Zahl ${behauptet} kommt gar nicht vor`);
  }
});

// Die englische Fassung nennt DIESELBEN Zahlen — sie kommen aus demselben Packer. Eine
// Uebersetzung, in der eine Zahl anders steht, ist schlimmer als keine: dann widerspricht
// sich die Seite je nach Sprache, und der Knopf daneben oeffnet in beiden Faellen denselben
// Rechner. Auch die Beispielmenge im ?q=-Link gehoert dazu.
const enSeite = (f) => fs.readFileSync(path.join(dir, "..", "en", "guide", f), "utf8");
const EN_FAELLE = [
  ["euro-pallets-20ft-container.html", "Euro pallets in 20'", "20' GP", [120, 80], 11],
  ["euro-pallets-40ft-container.html", "Euro pallets in 40'", "40' GP", [120, 80], 25],
  ["industrial-pallets-container.html", "Industrial pallets in 20'", "20' GP", [120, 100], 9],
  ["industrial-pallets-container.html", "Industrial pallets in 40'", "40' GP", [120, 100], 22],
  ["wire-mesh-pallets-container.html", "Mesh pallets in 20'", "20' GP", [124, 83], 11],
  ["wire-mesh-pallets-container.html", "Mesh pallets in 40'", "40' GP", [124, 83], 23]
];

test("die englische Fassung nennt dieselben gerechneten Zahlen", () => {
  for (const [datei, was, preset, [l, w], behauptet] of EN_FAELLE) {
    assert.strictEqual(behauptet, stellplaetze(preset, l, w), `${was}: der Packer rechnet anders`);
    assert.ok(new RegExp(`\\b${behauptet}\\b`).test(enSeite(datei)), `${datei}: ${was} — die Zahl ${behauptet} kommt gar nicht vor`);
  }
});

test("die Beispielladung hinter dem Knopf passt zur genannten Zahl", () => {
  // Der ?q=-Link laedt den Rechner vor. Stuende dort eine andere Menge, wuerde der
  // Rechner die Zahl im Text im selben Moment widerlegen, in dem jemand draufklickt.
  const erwartet = { "euro-pallets-20ft-container.html": 11, "euro-pallets-40ft-container.html": 25,
    "industrial-pallets-container.html": 22, "wire-mesh-pallets-container.html": 11,
    "truck-trailer-load-calculation.html": 34 };
  for (const [datei, menge] of Object.entries(erwartet)) {
    const m = enSeite(datei).match(/href="\/app\?lang=en&q=([^"]+)"/);
    assert.ok(m, `${datei}: kein ?q=-Link`);
    const txt = decodeURIComponent(m[1]);
    assert.ok(new RegExp(`^${menge}\\b`).test(txt), `${datei}: der Link laedt "${txt}", der Text nennt ${menge}`);
  }
});

test("keine der widerlegten Angaben ist zurueckgekommen", () => {
  const raus = ["25–26", "24–25", "9–10", "rund 21 ", "fast identisch"];
  const treffer = [];
  for (const f of fs.readdirSync(path.join(dir, "..", "ratgeber")).filter((x) => x.endsWith(".html")))
    for (const r of raus) if (seite(f).includes(r)) treffer.push(`${f}: ${r}`);
  assert.deepStrictEqual(treffer, [], `widerlegte Angabe wieder da:\n${treffer.join("\n")}`);
});

test("26 Europaletten sind im 40-Fuss geometrisch unmoeglich", () => {
  // Der Kern der Korrektur, als Rechnung statt als Behauptung: das beste Muster belegt
  // 1200 x 200 cm. Uebrig bleiben ein Streifen von 35 cm Breite und 3 cm Laenge —
  // in keinen davon passt eine Palette, die in jeder Richtung mindestens 80 cm braucht.
  const C = PRESETS["40' GP"];
  const r = makeFloorPacker(120, 80, true)(C.l, C.w);
  assert.strictEqual(r.count, 25);
  const restBreite = C.w - Math.max(...r.rects.map((q) => q.z + q.dz));
  const restLaenge = C.l - Math.max(...r.rects.map((q) => q.x + q.dx));
  assert.ok(restBreite < 80, `${restBreite} cm Restbreite — da ginge doch noch eine Palette`);
  assert.ok(restLaenge < 80, `${restLaenge} cm Restlaenge — da ginge doch noch eine Palette`);
});

// Die Startseite hat genau denselben Fehler getragen und ist beim ersten Mal
// durchgerutscht, weil oben nur der Ordner ratgeber/ durchsucht wurde. Die
// Uebersichtskarte verlinkt aber auf die Seite, der sie widersprochen hat — und die
// englische Fassung im EN-Woerterbuch gleich mit. Deshalb steht die Startseite jetzt
// mit im Netz.
test("auch die Startseite traegt keine widerlegte Angabe mehr", () => {
  const start = fs.readFileSync(path.join(dir, "..", "index.html"), "utf8");
  const raus = ["25–26", "25-26", "24–25", "9–10"];
  const treffer = raus.filter((r) => start.includes(r));
  assert.deepStrictEqual(treffer, [], `index.html nennt wieder: ${treffer.join(", ")}`);
});

// Und die Karte muss die Zahl nennen, die auch der Packer rechnet — nicht bloss
// keine falsche. Sonst haette ein Loeschen des Satzes den Test schon zufriedengestellt.
test("die Uebersichtskarten der Startseite nennen die gerechneten Zahlen", () => {
  const start = fs.readFileSync(path.join(dir, "..", "index.html"), "utf8");
  // [i18n-Schluessel der Karte, Preset, Packstueckmass]
  const KARTEN = [["rg1_p", "20' GP", [120, 80]], ["rg2_p", "40' GP", [120, 80]]];
  for (const [key, preset, [l, w]] of KARTEN) {
    const echt = stellplaetze(preset, l, w);
    const de = start.match(new RegExp(`data-i18n="${key}"[^>]*>([^<]*)<`));
    const en = start.match(new RegExp(`"${key}": "([^"]*)"`));
    assert.ok(de && en, `${key}: deutsche oder englische Fassung nicht gefunden`);
    for (const [was, txt] of [["deutsch", de[1]], ["englisch", en[1]]])
      assert.ok(new RegExp(`\\b${echt}\\b`).test(txt),
        `Karte ${key} (${was}) sagt "${txt.trim()}", der Packer rechnet ${echt}`);
  }
});

// Der Beweis-Satz der Startseite: "11 EUR-Paletten statt 8". Die 11 stand immer, die
// Vergleichszahl war erfunden — sie soll das Ergebnis OHNE Erkennung gedrehter Muster
// nennen, und das sind 8, nicht 9. Ausgerechnet der Satz, mit dem das Werkzeug seine
// Genauigkeit belegt, war die einzige Zahl auf der Seite, die niemand nachrechnen
// konnte. Beide Zahlen kommen jetzt aus demselben Packer, mit und ohne Drehung.
test("die Vergleichszahl im Merkmal 'palettengenau' stimmt", () => {
  const start = fs.readFileSync(path.join(dir, "..", "index.html"), "utf8");
  const C = PRESETS["20' GP"];
  const mit = makeFloorPacker(120, 80, true)(C.l, C.w).count;
  const ohne = makeFloorPacker(120, 80, false)(C.l, C.w).count;
  assert.ok(mit > ohne, "ohne Drehung duerfte nicht mehr passen als mit");
  for (const [was, txt] of [
    ["deutsch", (start.match(/data-i18n="f2_p"[^>]*>(.*?)<\/p>/s) || [])[1]],
    ["englisch", (start.match(/"f2_p": "(.*?)", "f3_h"/s) || [])[1]]
  ]) {
    assert.ok(txt, `${was}: Merkmal f2_p nicht gefunden`);
    const zahlen = (txt.match(/\d+/g) || []).map(Number);
    assert.ok(zahlen.includes(mit), `${was}: die gerechnete Zahl ${mit} fehlt in "${txt}"`);
    assert.ok(zahlen.includes(ohne), `${was}: die Vergleichszahl muesste ${ohne} sein — im Text steht ${zahlen.join(", ")}`);
  }
});
