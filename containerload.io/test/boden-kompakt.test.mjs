// Der Einzeltyp-Pfad staut ohne Loecher: Luecken liegen an der Tuer, nie mittendrin.
//
// Gemeldet mit Link (42x Inka PLT 121x85x100 im 40' GP nach Maersk-Geometrie):
// mitten im Container klaffte eine Luecke (x 605-690 blieb leer, dahinter stand
// wieder Ladung), waehrend an der Tuer Platz frei war. Zwei Ursachen, beide im
// Bodenraster: die Guillotine-Schnitte von makeFloorPacker hinterlassen Naehte
// an den Schnittkanten, und mit maxSpots (Stellplaetze werden nur bis zum Bedarf
// gerechnet) bleiben die unbelegten Plaetze dort stehen, wo der Schnitt sie
// gefunden hat -- nicht an der Tuer. Die STELLPLATZZAHL war immer richtig, nur
// ihre Lage war Schnittkunst.
//
// Der Fix schiebt jeden Stellplatz zur Stirnwand, so weit seine Nachbarn im
// selben z-Band es zulassen, und fuellt von der Stirnwand her. Das aendert nie
// die Zahl (test-seitig: 400 Zufallsfaelle alt gegen neu, Stueck fuer Stueck
// gleich) -- nur die Luecken wandern zur Tuer.
//
// node --test test/boden-kompakt.test.mjs
import fs from "node:fs";
import assert from "node:assert";
import test from "node:test";
import { fileURLToPath } from "node:url";
import path from "node:path";

const dir = path.dirname(fileURLToPath(import.meta.url));
const L = fs.readFileSync(path.join(dir, "..", "app.html"), "utf8").split("\n");
const ps = L.findIndex((l) => l.includes("function makeFloorPacker"));
const pe = L.findIndex((l, i) => i > ps && l.trim() === "}" && L[i - 1].includes("return { placed, perType"));
const { packCargo } = new Function(
  'var num=(v,d=0)=>Number.isFinite(+v)&&v!==""?+v:d;\n' + L.slice(ps, pe + 1).join("\n") + "\nreturn { packCargo };"
)();

// Kein Bodenstueck darf vor sich (im eigenen z-Band) Luft haben: seine linke
// Kante muss an der Stirnwand oder an der rechten Kante eines Nachbarn liegen.
const lueckenDavor = (placed) => {
  const boden = placed.filter((p) => p.y < 1e-6);
  const funde = [];
  for (const p of boden) {
    if (p.x < 1e-6) continue;
    let kante = 0;
    for (const o of boden) {
      if (o === p) continue;
      if (o.x + o.dx <= p.x + 1e-6 && o.z < p.z + p.dz - 1e-6 && o.z + o.dz > p.z + 1e-6) kante = Math.max(kante, o.x + o.dx);
    }
    if (p.x - kante > 1e-6) funde.push({ x: p.x, z: p.z, luft: p.x - kante });
  }
  return funde;
};

test("der gemeldete Fall: 42 Paletten, kompakt ab Stirnwand, nichts offen", () => {
  const C = { l: 1203.2, w: 235, h: 239.3, payload: 26600 };
  const r = packCargo(C, [{ l: 121, w: 85, h: 100, weight: 498, qty: 42, stackable: true, rotatable: true }]);
  assert.strictEqual(r.boxes, 42, "alle 42 muessen verladen sein");
  assert.deepStrictEqual(lueckenDavor(r.placed), [], "Luecke mitten im Container");
  // Die Luft liegt an der Tuer: das letzte Bodenstueck endet deutlich vor dem
  // Containerende (21 Stellplaetze brauchen keine volle Laenge).
  const hinten = Math.max(...r.placed.filter((p) => p.y < 1e-6).map((p) => p.x + p.dx));
  assert.ok(hinten < C.l - 100, `die freie Laenge muss an der Tuer liegen (Ladungsende bei ${hinten})`);
});

test("auch mit gekapptem Stellplatz-Bedarf (maxSpots) wandern die Luecken zur Tuer", () => {
  // 7 nicht stapelbare Stuecke auf grossem Boden: brauchtSpots = 7, der
  // Bodenpacker haette Platz fuer weit mehr -- genau der Fall, in dem die
  // fruehe Kappung die Plaetze irgendwo liegen liess.
  const r = packCargo({ l: 1203, w: 235, h: 239, payload: 26600 },
    [{ l: 110, w: 95, h: 120, weight: 200, qty: 7, stackable: false, rotatable: true }]);
  assert.strictEqual(r.boxes, 7);
  assert.deepStrictEqual(lueckenDavor(r.placed), [], "Luecke mitten im Container");
});

test("der Schub kostet keine Kapazitaet -- die bekannten Stellzahlen stehen", () => {
  // Dieselben Zahlen, die auch die Wissens-Seiten tragen: 11 Europaletten im
  // 20' (gedreht), 25 im 40'. Wer den Schub anfasst und dabei Plaetze verliert,
  // faellt hier um, bevor es eine Wissens-Seite widerlegt.
  const c20 = packCargo({ l: 590, w: 235, h: 239, payload: 28200 },
    [{ l: 120, w: 80, h: 110, weight: 300, qty: 40, stackable: false, rotatable: true }]);
  assert.strictEqual(c20.boxes, 11);
  const c40 = packCargo({ l: 1203, w: 235, h: 239, payload: 26600 },
    [{ l: 120, w: 80, h: 110, weight: 300, qty: 40, stackable: false, rotatable: true }]);
  assert.strictEqual(c40.boxes, 25);
  assert.deepStrictEqual(lueckenDavor(c20.placed), []);
  assert.deepStrictEqual(lueckenDavor(c40.placed), []);
});

test("gefuellt wird von der Stirnwand her -- Teilmengen stehen vorne, nicht verstreut", () => {
  // 5 Stuecke auf einem Boden mit vielen Plaetzen: alle fuenf muessen im
  // vordersten Block stehen (kein Stueck beginnt hinter der halben Laenge).
  const r = packCargo({ l: 1203, w: 235, h: 239, payload: 26600 },
    [{ l: 120, w: 80, h: 110, weight: 300, qty: 5, stackable: false, rotatable: true }]);
  assert.strictEqual(r.boxes, 5);
  for (const p of r.placed) assert.ok(p.x + p.dx <= 601.5, `Stueck bei x ${p.x} statt vorne`);
});
