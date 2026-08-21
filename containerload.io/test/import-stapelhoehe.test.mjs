// Der Freitext-Import versteht "stapelbar bis 180 cm".
//
// Der Grund ist praktisch: wer 37 Paletten einzeln erfasst, will die Grenze nicht 37 Mal
// von Hand setzen. Die Zeilen kommen ohnehin so aus der Anfrage ("1 Palette 325x218x49cm
// 2220kg stapelbar bis 180cm") - dann sollen sie auch so eingelesen werden.
//
// Die Falle dabei: "max 100 kg" ist KEINE Hoehenangabe. Der Ausdruck ist deshalb an ein
// Schluesselwort UND an eine Laengeneinheit gebunden.
//
// node --test test/import-stapelhoehe.test.mjs
import fs from "node:fs";
import assert from "node:assert";
import test from "node:test";
import { fileURLToPath } from "node:url";
import path from "node:path";

const dir = path.dirname(fileURLToPath(import.meta.url));
const L = fs.readFileSync(path.join(dir, "..", "app.html"), "utf8").split("\n");
const at = (m) => L.findIndex((l) => l.includes(m));
const bis = (von, pred) => L.findIndex((l, i) => i > von && pred(l, i));
const pp = at("var PALLET_PRESETS");
const tn = at("var toNumDE");
const s = at("function parseCargoText");
const e = bis(s, (l, i) => l.trim() === "}" && L[i - 1].trim() === "return out;");
assert.ok(pp >= 0 && tn >= 0 && s >= 0 && e > s, "Ausschnitte nicht gefunden");
const { parseCargoText } = new Function([
  "var LAST_TSV_MAP = null; var parseTSV = () => [];",
  L.slice(pp, bis(pp, (l) => l.trim() === "];") + 1).join("\n"),
  L.slice(tn, bis(tn, (l) => l.trim() === "};") + 1).join("\n"),
  L.slice(s, e + 1).join("\n"),
  "return { parseCargoText };"
].join("\n"))();

const eine = (z) => {
  const r = parseCargoText(z);
  assert.strictEqual(r.length, 1, `eine Zeile erwartet fuer: ${z}`);
  return r[0];
};

test("die Schreibweisen aus der Praxis", () => {
  const faelle = [
    ["1 Palette 325x218x49cm 2220kg stapelbar bis 180cm", 180],
    ["1 Palette 325x218x47cm 2180kg stapelbar bis 180 cm", 180],
    ["29 Paletten 325x218x45, 2030 kg, stapelbar bis 1,8 m", 180],
    ["5 Paletten 120x80x100 stapelbar bis 1800 mm", 180],
    ["6 pallets 120x100x90, 500 kg, stackable up to 180 cm", 180],
    ["4 Paletten 120x80x100, maximal 220 cm stapelbar", 220]
  ];
  for (const [zeile, erwartet] of faelle) {
    const r = eine(zeile);
    assert.strictEqual(r.stackH, erwartet, `"${zeile}" -> stackH ${r.stackH}`);
    assert.strictEqual(r.stackable, true, `"${zeile}" muss stapelbar bleiben`);
  }
});

test("ohne Angabe bleibt es bei frei stapelbar", () => {
  assert.strictEqual(eine("8 Paletten 228x110x55, 1020 kg, stapelbar").stackH, null);
  assert.strictEqual(eine("18 Paletten 120x80x110, 300 kg").stackH, null);
});

test('"nicht stapelbar" gewinnt', () => {
  const r = eine("4 Kisten 240x110x95 800kg nicht stapelbar");
  assert.strictEqual(r.stackable, false);
  assert.strictEqual(r.stackH, null, "eine Hoehengrenze waere daneben bedeutungslos");
});

test("ein Gewicht ist keine Hoehe", () => {
  // Die Falle: "max 100 kg" darf nicht als Stapelhoehe durchgehen.
  const r = eine("10 Kartons 60x40x40, max 100 kg, stapelbar");
  assert.strictEqual(r.stackH, null, "aus 'max 100 kg' wurde eine Stapelhoehe");
  assert.strictEqual(r.weight, 100, "und das Gewicht muss trotzdem ankommen");
});

test("die Kantenlaengen bleiben unangetastet", () => {
  const r = eine("1 Palette 325x218x49cm 2220kg stapelbar bis 180cm");
  assert.deepStrictEqual([r.l, r.w, r.h], [325, 218, 49]);
  assert.strictEqual(r.weight, 2220);
  assert.strictEqual(r.qty, 1);
});

test("die Angabe landet nicht im Namen", () => {
  for (const z of ["10 Kartons 60x40x40, max 100 kg, stapelbar",
                   "5 Paletten 120x80x100 stapelbar bis 1800 mm"]) {
    const n = eine(z).name;
    assert.ok(!/\b(bis|max|maximal|up to|180|1800)\b/i.test(n), `Name traegt Reste: "${n}"`);
  }
});

test("die ganze Gruppe 1 auf einmal", () => {
  // So, wie die Zeilen aus der Anfrage kommen: 29 Positionen, jede einzeln.
  const hoehen = [49, 47, 47, 46, 45, 45, 45, 45, 42, 42, 45, 45, 45, 45, 45, 43, 43, 43, 47,
                  47, 47, 47, 46, 43, 45, 45, 45, 45, 44];
  const text = hoehen.map((h) => `1 Palette 325x218x${h}cm 2000kg stapelbar bis 180cm`).join("\n");
  const rows = parseCargoText(text);
  assert.strictEqual(rows.length, 29);
  assert.deepStrictEqual([...new Set(rows.map((r) => r.stackH))], [180],
    "jede Zeile muss die Grenze tragen");
  assert.deepStrictEqual(rows.map((r) => r.h), hoehen, "die Bauhoehen duerfen sich nicht verschieben");
});

test("die Uebernahme aus der Vorschau reicht die Grenze weiter", () => {
  const roh = fs.readFileSync(path.join(dir, "..", "app.html"), "utf8");
  assert.ok(/stackable: r\.stackable !== false, stackH: num\(r\.stackH\) > 0 \? num\(r\.stackH\) : null,/.test(roh),
    "applyImport laesst die erkannte Grenze fallen - sie stuende dann nur in der Vorschau");
});
