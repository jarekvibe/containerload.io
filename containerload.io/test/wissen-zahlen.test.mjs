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
