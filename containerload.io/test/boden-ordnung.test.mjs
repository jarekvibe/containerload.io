// Der Ordnungs-Tiebreaker im Boden-Packer und die Massgleich-Buendelung.
//
// Gemeldet mit Bild: 11 Packstuecke 120x80x110, nicht stapelbar, einzeln erfasst,
// im 20' -- alle 11 passen nur mit gemischter Ausrichtung (rein laengs waeren 9),
// aber der Packer legte quer und laengs wild verschachtelt, obwohl dieselben 11
// als "7 quer + 4 laengs" in zwei geschlossenen Reihen stehen koennen.
//
// Zwei Zusagen, beide hier festgehalten:
//  1) Bei GLEICHER Stueckzahl gewinnt im Boden-Packer die Loesung mit den
//     wenigsten Guillotine-Schnitten -- geschlossene Baender statt Flickwerk.
//     Die Stueckzahl entscheidet zuerst und darf nie sinken.
//  2) Massgleiche Einzelpositionen (jede Zeile Menge 1) werden gebuendelt und
//     laufen durch denselben Einzeltyp-Pfad wie EINE Zeile mit der Summenmenge --
//     zwei Erfassungsarten derselben Ladung ergeben dasselbe Bild.
//
// node --test test/boden-ordnung.test.mjs
import fs from "node:fs";
import assert from "node:assert";
import test from "node:test";
import { fileURLToPath } from "node:url";
import path from "node:path";

const dir = path.dirname(fileURLToPath(import.meta.url));
const roh = fs.readFileSync(path.join(dir, "..", "app.html"), "utf8");
const L = roh.split("\n");
const s = L.findIndex((l) => l.includes("function makeFloorPacker"));
const e = L.findIndex((l, i) => i > s && l.trim() === "}" && L[i - 1].includes("return { placed, perType"));
assert.ok(s >= 0 && e > s, "packCargo-Ausschnitt nicht gefunden");
const { makeFloorPacker, packCargo } = new Function(
  'var num = (v, d = 0) => Number.isFinite(+v) && v !== "" ? +v : d;\n'
  + L.slice(s, e + 1).join("\n")
  + "\nreturn { makeFloorPacker, packCargo };"
)();

const GP20 = { l: 590, w: 235, h: 239, payload: 28200 };
const PKG = { l: 120, w: 80, h: 110, weight: 300, qty: 1, stackable: false, rotatable: true };

// Baender: je Ausrichtung (dx) die Menge der z-Startwerte. Geschlossene Reihen
// heisst: jede Ausrichtung steht in EINEM z-Band, die Baender ueberlappen nicht.
const baender = (placed) => {
  const je = {};
  placed.forEach((b) => {
    const k = Math.round(b.dx);
    (je[k] = je[k] || { z0: Infinity, z1: -Infinity, n: 0 });
    je[k].z0 = Math.min(je[k].z0, b.z); je[k].z1 = Math.max(je[k].z1, b.z + b.dz); je[k].n++;
  });
  return je;
};

test("der gemeldete Fall: 11 Stueck stehen als 7 quer + 4 laengs in zwei Reihen", () => {
  const r = packCargo(GP20, [{ ...PKG, qty: 11 }], {});
  assert.strictEqual(r.boxes, 11, "die Stueckzahl darf der Tiebreaker nie kosten");
  const je = baender(r.placed);
  assert.strictEqual(je[80].n, 7, "7 quer");
  assert.strictEqual(je[120].n, 4, "4 laengs");
  // Zwei geschlossene Baender, kein Ueberlapp: verschachtelt waere genau das Bild.
  assert.ok(je[80].z1 <= je[120].z0 + 1e-6 || je[120].z1 <= je[80].z0 + 1e-6,
    "quer und laengs sind wieder verschachtelt statt in zwei Reihen");
  // Und jede Reihe ist von der Stirnwand her dicht (Kompaktierung aus dem
  // Boden-Kompakt-Umbau bleibt in Kraft).
  for (const k of [80, 120]) {
    const reihe = r.placed.filter((b) => Math.round(b.dx) === k).sort((a, b) => a.x - b.x);
    reihe.forEach((b, i) => assert.ok(Math.abs(b.x - i * k) < 1e-6, `Luecke in der ${k}er-Reihe`));
  }
});

test("der Tiebreaker aendert keine Stellzahl (die dokumentierten Werte halten)", () => {
  // Dieselben Zahlen, die Wissensseiten und boden-kompakt.test festhalten.
  assert.strictEqual(makeFloorPacker(120, 80, true)(590, 235).count, 11);
  assert.strictEqual(makeFloorPacker(120, 80, true)(1203, 235).count, 25);
  assert.strictEqual(makeFloorPacker(120, 100, true)(590, 235).count, 9);
  assert.strictEqual(makeFloorPacker(120, 100, true)(1203, 235).count, 22);
  // Ohne Drehung gibt es nur reine Raster -- 0 Schnitte, nichts zu entscheiden.
  assert.strictEqual(makeFloorPacker(120, 80, false)(590, 235).cuts, 0);
});

test("massgleiche Einzelpositionen ergeben dasselbe Bild wie eine Zeile mit Summenmenge", () => {
  const einzeln = packCargo(GP20, Array.from({ length: 11 }, (_, i) => ({ ...PKG, name: "P" + i })), {});
  const zeile = packCargo(GP20, [{ ...PKG, qty: 11 }], {});
  assert.strictEqual(einzeln.single, true, "die Buendelung nimmt nicht den Einzeltyp-Pfad");
  const koord = (r) => r.placed.map((b) => [b.x, b.y, b.z, b.dx, b.dz].map((v) => Math.round(v)).join(","))
    .sort().join(" | ");
  assert.strictEqual(koord(einzeln), koord(zeile), "zwei Erfassungsarten, zwei Bilder");
  // Jede Position genau einmal geladen, die Stellplaetze in Listenreihenfolge.
  einzeln.perType.forEach((p, i) => assert.strictEqual(p.loaded, 1, `Position ${i + 1}`));
});

test("passt nicht alles, bleibt die LETZTE Position der Liste offen -- und sagt es", () => {
  const r = packCargo(GP20, Array.from({ length: 12 }, (_, i) => ({ ...PKG, name: "P" + i })), {});
  assert.strictEqual(r.boxes, 11);
  assert.strictEqual(r.totalBoxes, 12);
  r.perType.forEach((p, i) => assert.strictEqual(p.loaded, i < 11 ? 1 : 0, `Position ${i + 1}`));
});

test("gebuendelt wird nur, was in ALLEM uebereinstimmt, das die Rechnung beruehrt", () => {
  // Ein abweichendes Gewicht entscheidet unter der Zuladung, WELCHE Stuecke fahren --
  // solche Listen gehoeren weiter in den gemischten Pfad. Dasselbe gilt fuer jede
  // Stapel-Eigenschaft.
  for (const anders of [{ weight: 301 }, { stackable: true }, { rotatable: false }, { h: 111 }]) {
    const r = packCargo(GP20, [{ ...PKG }, { ...PKG, ...anders }], {});
    assert.strictEqual(r.single, false, `gebuendelt trotz Abweichung ${JSON.stringify(anders)}`);
  }
  // Und mit Vorbelegung gilt weiter der gemischte Pfad (weiterpacken.test prueft
  // den Quelltext-Vertrag dazu).
  const vor = [{ x: 0, y: 0, z: 0, dx: 120, dy: 110, dz: 80, ti: 0 }];
  const r2 = packCargo(GP20, [{ ...PKG }, { ...PKG }], { vorbelegt: vor });
  assert.strictEqual(r2.single, false, "Buendelung ueberbaut die Vorbelegung");
});

test("der Vertrag im Quelltext: Stueckzahl zuerst, Schnitte nur als Gleichstand-Entscheid", () => {
  assert.ok(roh.includes("n > best.count || (n === best.count && n > 0 && c < best.cuts)"),
    "der Tiebreaker entscheidet nicht mehr NUR den Gleichstand");
});
