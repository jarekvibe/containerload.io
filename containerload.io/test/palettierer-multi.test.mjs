// Mehrere Kartontypen auf Paletten — getrennt oder lagenweise gemischt.
//
// Die harte Invariante bei beiden Betriebsarten: es darf unterwegs kein Karton
// verschwinden und keiner dazukommen. Alles andere sind Komfortfragen; das hier ist
// die Zahl, die am Ende beim Kunden auf der Rechnung steht.
import fs from "node:fs";
import assert from "node:assert";
import test from "node:test";
import { fileURLToPath } from "node:url";
import path from "node:path";

const dir = path.dirname(fileURLToPath(import.meta.url));
const L = fs.readFileSync(path.join(dir, "..", "app.html"), "utf8").split("\n");
const ps = L.findIndex((l) => l.includes("function makeFloorPacker"));
const pe = L.findIndex((l, i) => i > ps && l.trim() === "}" && L[i - 1].includes("return { placed, perType"));
const { palletizeMulti, layerOrder, PALLETS } = new Function(
  'var num=(v,d=0)=>Number.isFinite(+v)&&v!==""?+v:d;\n' + L.slice(ps, pe + 1).join("\n") + "\nreturn { palletizeMulti, layerOrder, PALLETS };"
)();

const EUR = PALLETS.EUR;
const O = { maxTotalH: 180 };
// A: 60x40x40, 4/Lage · B: 40x30x20, 8/Lage · C: 120x80x25, 1/Lage
const A = { l: 60, w: 40, h: 40, weight: 10, qty: 32, rotatable: true };
const B = { l: 40, w: 30, h: 20, weight: 3, qty: 80, rotatable: true };
const C = { l: 120, w: 80, h: 25, weight: 40, qty: 6, rotatable: true };

const sumPlaced = (r) => r.perType.reduce((s, t) => s + t.placed, 0);
const sumInBuilds = (r) => r.builds.reduce((s, b) => s + b.qty * b.layers.reduce((x, l) => x + l.count, 0), 0);

test("getrennt: jeder Typ bekommt eigene Paletten", () => {
  const r = palletizeMulti(EUR, [A, B], { ...O, mode: "separate" });
  const tis = new Set(r.builds.map((b) => b.ti));
  assert.deepStrictEqual([...tis].sort(), [0, 1]);
  for (const b of r.builds) assert.ok(new Set(b.layers.map((l) => l.ti)).size === 1, "Palette mischt Typen, obwohl getrennt gerechnet wird");
});

test("getrennt: kein Karton geht verloren", () => {
  const r = palletizeMulti(EUR, [A, B, C], { ...O, mode: "separate" });
  assert.strictEqual(sumPlaced(r) + r.unplaced, 32 + 80 + 6);
  assert.strictEqual(sumInBuilds(r), sumPlaced(r));
});

test("lagenweise: eine Lage gehoert genau einem Typ", () => {
  // A mit 12 Stueck = 3 Lagen a 40 cm = 120 cm. Auf die restlichen 45,6 cm passen zwei
  // B-Lagen a 20 cm — erst dadurch entsteht ueberhaupt eine gemischte Palette. Fuellt ein
  // Typ die Palette genau aus, wird NICHT kuenstlich gemischt, und das ist richtig so.
  const r = palletizeMulti(EUR, [{ ...A, qty: 12 }, B], { ...O, mode: "layered" });
  for (const b of r.builds) for (const l of b.layers) assert.ok(Number.isInteger(l.ti), "Lage ohne eindeutigen Typ");
  assert.ok(r.builds.some((b) => new Set(b.layers.map((l) => l.ti)).size > 1), "keine einzige gemischte Palette entstanden");
});

test("lagenweise: kein Karton geht verloren", () => {
  const r = palletizeMulti(EUR, [A, B, C], { ...O, mode: "layered" });
  assert.strictEqual(sumPlaced(r) + r.unplaced, 32 + 80 + 6);
  assert.strictEqual(sumInBuilds(r), sumPlaced(r));
});

test("lagenweise: die Reihenfolge der Typen ist die Stapelreihenfolge", () => {
  const r = palletizeMulti(EUR, [C, A], { ...O, mode: "layered" });
  assert.strictEqual(r.builds[0].layers[0].ti, 0, "der erste Typ steht nicht unten");
});

test("lagenweise: keine Palette wird hoeher als erlaubt", () => {
  const r = palletizeMulti(EUR, [A, B, C], { maxTotalH: 140, mode: "layered" });
  for (const b of r.builds) assert.ok(b.totalH <= 140 + 1e-6, `Palette ist ${b.totalH} cm hoch, erlaubt sind 140`);
});

test("lagenweise: die Tragfaehigkeit wird eingehalten", () => {
  const schwer = { l: 60, w: 40, h: 20, weight: 90, qty: 40, rotatable: true }; // 360 kg je Lage
  const r = palletizeMulti(EUR, [schwer], { maxTotalH: 300, mode: "layered" });
  for (const b of r.builds) assert.ok(b.totalKg <= 1500 + 25 + 1e-6, `Palette wiegt ${b.totalKg} kg`);
});

test("lagenweise: eine Lage wird nicht zwischen zwei Paletten geteilt", () => {
  const r = palletizeMulti(EUR, [A, B], { maxTotalH: 120, mode: "layered" });
  const alle = r.builds.flatMap((b) => b.layers);
  for (const l of alle) assert.ok(l.count > 0 && l.count <= r.types[l.ti].perLayer, "Lage ist groesser als das Muster hergibt");
});

test("gleich aufgebaute Paletten werden gezaehlt, nicht aufgelistet", () => {
  // 12 Lagen a 4 Stueck, 4 Lagen je Palette -> 3 identische Paletten, EIN Aufbau.
  const r = palletizeMulti(EUR, [{ ...A, qty: 48 }], { ...O, mode: "layered" });
  assert.strictEqual(r.builds.length, 1);
  assert.strictEqual(r.builds[0].qty, 3);
  assert.strictEqual(r.totalPallets, 3);
});

test("ein Karton, der auf keine Palette passt, wird gemeldet statt verschluckt", () => {
  const zuGross = { l: 200, w: 90, h: 30, weight: 5, qty: 10, rotatable: true };
  const r = palletizeMulti(EUR, [A, zuGross], { ...O, mode: "separate" });
  assert.deepStrictEqual(r.noFit, [1]);
  assert.strictEqual(sumPlaced(r) + r.unplaced, 32 + 10);
});

test("die Reihenfolge-Empfehlung stellt die schwerste Lage nach unten", () => {
  // A: 4 x 10 = 40 kg/Lage · B: 8 x 3 = 24 kg/Lage · C: 1 x 40 = 40 kg/Lage
  const leicht = { l: 40, w: 30, h: 20, weight: 1, qty: 40, rotatable: true }; // 8 kg/Lage
  const ord = layerOrder(EUR, [leicht, A], O);
  assert.deepStrictEqual(ord, [1, 0], "die leichtere Lage steht unten");
});

test("ein einzelner Typ liefert dieselbe Aussage wie vorher", () => {
  const r = palletizeMulti(EUR, [{ ...A, qty: 30 }], { ...O, mode: "separate" });
  assert.strictEqual(r.builds.length, 2, "volle Paletten + Restpalette");
  assert.strictEqual(r.builds[0].qty, 1);
  assert.strictEqual(r.builds[1].rest, true);
  assert.strictEqual(sumPlaced(r), 30);
});

test("leere Eingabe stuerzt nicht ab", () => {
  for (const c of [[], [{ l: 0, w: 0, h: 0, qty: 0 }], null]) {
    for (const m of ["separate", "layered"]) {
      const r = palletizeMulti(EUR, c, { ...O, mode: m });
      assert.strictEqual(r.totalPallets, 0);
      assert.deepStrictEqual(r.builds, []);
    }
  }
});
