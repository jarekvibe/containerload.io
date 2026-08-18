// Massangaben in Fliesstext kennen die Sprache.
//
// Vorgeschichte: Die zugeklappte Ladungszeile und die Zeilen der Druckvorlage bauten ihren
// Text mit `${num(it.l)} x ${num(it.w)} x ${num(it.h)}` — also mit der Rohzahl. Solange alle
// Masse ganze Zentimeter waren, fiel das nicht auf. Sobald ein Mass eine Nachkommastelle hat
// (Palettenhoehe 14,4 cm aus der Karton-auf-Palette-Vorstufe, Reederei-Innenmasse in mm),
// stand in der DEUTSCHEN Oberflaeche "120x80x164.4 cm".
//
// Der Test haelt zweierlei fest: dimDE formatiert richtig, und niemand baut wieder eine
// Massangabe aus einer Rohzahl zusammen.
import fs from "node:fs";
import assert from "node:assert";
import test from "node:test";
import { fileURLToPath } from "node:url";
import path from "node:path";

const dir = path.dirname(fileURLToPath(import.meta.url));
const app = fs.readFileSync(path.join(dir, "..", "app.html"), "utf8");

const line = app.split("\n").find((l) => l.includes("var dimDE ="));
assert.ok(line, "dimDE nicht gefunden");
const { dimDE } = new Function(
  'var num=(v,d=0)=>Number.isFinite(+v)&&v!==""?+v:d;var LOC=()=>"de-DE";\n' + line + "\nreturn { dimDE };"
)();

test("Nachkommastellen bekommen in der deutschen Oberflaeche ein Komma", () => {
  assert.strictEqual(dimDE(164.4), "164,4");
  assert.strictEqual(dimDE(14.4), "14,4");
  assert.strictEqual(dimDE(589.8), "589,8");
});

test("englisch bleibt der Punkt", () => {
  assert.strictEqual(dimDE(164.4, "en-US"), "164.4");
});

test("ganze Zahlen bekommen kein ueberfluessiges Nachkomma", () => {
  assert.strictEqual(dimDE(120), "120");
  assert.strictEqual(dimDE(80), "80");
});

test("Masse werden nicht in Tausendergruppen zerlegt", () => {
  // "1.203 x 235 x 239" liest sich schlechter als "1203 x 235 x 239" — und in Millimetern
  // wird jede Kantenlaenge vierstellig.
  assert.strictEqual(dimDE(1203), "1203");
  assert.strictEqual(dimDE(13620), "13620");
});

test("Unsinn faellt auf null zurueck statt NaN anzuzeigen", () => {
  assert.strictEqual(dimDE(""), "0");
  assert.strictEqual(dimDE(undefined), "0");
});

test("keine Massangabe wird mehr aus einer Rohzahl zusammengebaut", () => {
  const treffer = [];
  app.split("\n").forEach((z, i) => {
    // `${num(x)} × ${num(y)}` – das Muster, das den Punkt in die Oberflaeche gebracht hat.
    if (/\$\{num\([^)]*\)\}\s*(\\xD7|×|x)\s*\$\{num\(/.test(z)) treffer.push(`Zeile ${i + 1}`);
  });
  assert.deepStrictEqual(treffer, [], `Massangabe aus Rohzahlen — dimDE() nehmen:\n${treffer.join("\n")}`);
});

// --- Einzahl/Mehrzahl -------------------------------------------------------------
// Aufgefallen, als die Vorgabemenge im Palettier-Dialog von 100 auf 4 ging: das Ergebnis
// meldete "4 Kartons -> 1 Paletten". Ein Wortfehler in der Kopfzeile des Ergebnisses
// faellt mehr auf als eine falsche Nachkommastelle.
const pluLine = app.split("\n").find((l) => l.includes("var plu ="));
assert.ok(pluLine, "plu nicht gefunden");
const { plu } = new Function(
  'var num=(v,d=0)=>Number.isFinite(+v)&&v!==""?+v:d;var LOC=()=>"de-DE";var fmtDE=(n)=>Math.round(num(n,0)).toLocaleString(LOC());\n'
  + pluLine + "\nreturn { plu };"
)();

test("genau eins bekommt die Einzahl", () => {
  assert.strictEqual(plu(1, "Palette", "Paletten"), "1 Palette");
  assert.strictEqual(plu(1, "Karton", "Kartons"), "1 Karton");
});

test("alles andere bekommt die Mehrzahl — auch die Null", () => {
  assert.strictEqual(plu(0, "Palette", "Paletten"), "0 Paletten");
  assert.strictEqual(plu(2, "Palette", "Paletten"), "2 Paletten");
  assert.strictEqual(plu(9, "Karton", "Kartons"), "9 Kartons");
});

test("grosse Zahlen behalten ihre Tausenderpunkte", () => {
  assert.strictEqual(plu(1240, "Karton", "Kartons"), "1.240 Kartons");
});

test("kein Ergebnistext baut die Menge noch von Hand zusammen", () => {
  // Die Aufrufstellen muessen ROHE Zahlen uebergeben — kommt dort ein fertig formatierter
  // Text an, kann plu() die Einzahl nicht mehr erkennen und die Zahl steht doppelt.
  const treffer = [];
  app.split("\n").forEach((z, i) => {
    if (/T\.pal(Result|Left|Break)\(\s*fmtDE\(/.test(z)) treffer.push(`Zeile ${i + 1}`);
  });
  assert.deepStrictEqual(treffer, [], `formatierter Text an plu-Baustein uebergeben:\n${treffer.join("\n")}`);
});
