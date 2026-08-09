// Regressionstest fuer die ausgewiesene Lagenzahl (result.layers).
//
// Hintergrund: Im Single-Typ-Pfad wurde layers frueher aus Containerhoehe / Stueckhoehe
// berechnet — also aus der Zahl der Lagen, die PASSEN WUERDEN, und zwar bevor ueberhaupt
// etwas platziert wurde. Bei einem einzigen Packstueck meldete die Oberflaeche dadurch
// "2 gestapelt", obwohl genau eine Kiste auf dem Boden stand. Der gemischte Pfad hat es
// immer richtig gemacht (belegte Hoehen zaehlen). Beide Pfade muessen dasselbe bedeuten.
//
// Invariante: result.layers === Anzahl verschiedener Hoehen in result.placed.
import fs from "node:fs";
import assert from "node:assert";
import test from "node:test";
import { fileURLToPath } from "node:url";
import path from "node:path";

const dir = path.dirname(fileURLToPath(import.meta.url));
const html = fs.readFileSync(path.join(dir, "..", "app.html"), "utf8");
const L = html.split("\n");

// --- packCargo herausschneiden (gleiche Slice-Mechanik wie die uebrigen Packer-Tests) ---
const ps = L.findIndex((l) => l.includes("function makeFloorPacker"));
const pe = L.findIndex((l, i) => i > ps && l.trim() === "}" && L[i - 1].includes("return { placed, perType"));
const { packCargo } = new Function('var num=(v,d=0)=>Number.isFinite(+v)&&v!==""?+v:d;\n' + L.slice(ps, pe + 1).join("\n") + "\nreturn { packCargo };")();

const GP20 = { n: "20' GP", l: 590, w: 235, h: 239, payload: 28200 };

// Zaehlt die tatsaechlich belegten Hoehen — das ist die Wahrheit, gegen die layers stimmen muss.
const belegteHoehen = (placed) => new Set(placed.map((p) => Math.round(p.y))).size;

// 1) DER FEHLERFALL: ein einziges Packstueck, stapelbar, Container hoch genug fuer 2 Lagen.
//    Frueher: layers = floor(239/110) = 2 -> "2 gestapelt" bei einer Kiste am Boden.
test("Ein einzelnes Packstueck ergibt genau 1 Lage, nicht 2", () => {
  const r = packCargo(GP20, [{ name: "Kiste", l: 120, w: 80, h: 110, weight: 300, qty: 1, stackable: true, rotatable: true }]);
  assert.strictEqual(r.boxes, 1, "genau eine Kiste verladen");
  assert.strictEqual(r.layers, 1, `eine Kiste am Boden = 1 Lage, gemeldet wurden ${r.layers}`);
  assert.strictEqual(r.layers, belegteHoehen(r.placed), "layers muss den belegten Hoehen entsprechen");
});

// 2) Genug Stueck fuer zwei volle Lagen -> dann sind 2 auch richtig.
test("Volle zweite Lage ergibt 2 Lagen", () => {
  const r = packCargo(GP20, [{ name: "Kiste", l: 120, w: 80, h: 110, weight: 50, qty: 100, stackable: true, rotatable: true }]);
  assert.strictEqual(r.layers, 2, `zwei belegte Lagen erwartet, gemeldet wurden ${r.layers}`);
  assert.strictEqual(r.layers, belegteHoehen(r.placed), "layers muss den belegten Hoehen entsprechen");
});

// 3) Leere Ladung -> 0 Lagen (keine Kiste, keine Lage).
test("Ohne Ladung sind es 0 Lagen", () => {
  const r = packCargo(GP20, [{ name: "Kiste", l: 120, w: 80, h: 110, weight: 50, qty: 0, stackable: true, rotatable: true }]);
  assert.strictEqual(r.boxes, 0, "nichts verladen");
  assert.strictEqual(r.layers, 0, `ohne Ladung 0 Lagen, gemeldet wurden ${r.layers}`);
});

// 4) Nicht stapelbar -> hoechstens 1 Lage, egal wie viel Platz nach oben waere.
test("Nicht stapelbare Ware bleibt bei 1 Lage", () => {
  const r = packCargo(GP20, [{ name: "Kiste", l: 120, w: 80, h: 110, weight: 50, qty: 100, stackable: false, rotatable: true }]);
  assert.strictEqual(r.layers, 1, `nicht stapelbar = 1 Lage, gemeldet wurden ${r.layers}`);
  assert.ok(r.placed.every((p) => Math.round(p.y) === 0), "keine Kiste liegt ueber dem Boden");
});

// 5) Die Invariante gilt auch im gemischten Pfad — beide Codepfade meinen jetzt dasselbe.
test("Gemischte Ladung: layers entspricht ebenfalls den belegten Hoehen", () => {
  const r = packCargo(GP20, [
    { name: "A", l: 120, w: 80, h: 100, weight: 40, qty: 12, stackable: true, rotatable: true },
    { name: "B", l: 100, w: 60, h: 70, weight: 25, qty: 12, stackable: true, rotatable: true },
  ], { intensive: true });
  assert.ok(r.boxes > 0, "es wurde etwas verladen");
  assert.strictEqual(r.layers, belegteHoehen(r.placed), "layers muss den belegten Hoehen entsprechen");
});

console.log("pack-layers: alle Tests gruen");
