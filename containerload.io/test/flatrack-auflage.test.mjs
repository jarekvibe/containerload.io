// Zwei gemeldete Fehler am Flat Rack, beide mit den Zahlen aus der Meldung nachgestellt.
//
// 1) Ladung ohne Auflage: Zwei 300 cm breite Stuecke auf einem 244 cm breiten Deck. Der Packer
//    legte das zweite vollstaendig NEBEN das Deck – im 3D-Bild schwebte es in der Luft.
//    Ueberstand ist am Flat Rack erlaubt, aufliegen muss die Ware trotzdem.
//
// 2) Luecke: Zwei 250 cm lange Stuecke standen mit 42,5 cm Abstand hintereinander, obwohl sie
//    buendig nebeneinander passen. Ursache war ein "Spreiz"-Platz vor den Nachbar-Kandidaten.
//
// node --test test/flatrack-auflage.test.mjs
import fs from "node:fs";
import assert from "node:assert";
import test from "node:test";
import { fileURLToPath } from "node:url";
import path from "node:path";

const dir = path.dirname(fileURLToPath(import.meta.url));
const L = fs.readFileSync(path.join(dir, "..", "app.html"), "utf8").split("\n");

const ps = L.findIndex((l) => l.includes("function makeFloorPacker"));
const pe = L.findIndex((l, i) => i > ps && l.trim() === "}" && L[i - 1].includes("layers: base.layers || 1"));
const presets = L.findIndex((l) => l.includes("var PRESETS = {"));
const equipEnd = L.findIndex((l, i) => i > presets && l.includes("var panelsFor"));
assert.ok(ps > 0 && pe > ps && presets > 0 && equipEnd > presets, "Code-Ausschnitte nicht gefunden");

const { packKind, PRESETS } = new Function(
  `var num=(v,d=0)=>Number.isFinite(+v)&&v!==""?+v:d;
   ${L.slice(presets, equipEnd + 1).join("\n")}
   ${L.slice(ps, pe + 1).join("\n")}
   return { packKind, PRESETS };`
)();

const RACK = PRESETS["20' Flat Rack"];   // 585 x 244 Deck, Stirnwaende 218
const stueck = (l, w, h, qty) => [{ name: "P", l, w, h, weight: 300, qty, stackable: true, rotatable: true }];

// Anteil der Standflaeche, der wirklich auf dem Deck liegt
const auflage = (p, Ct) => {
  const ux = Math.max(0, Math.min(p.x + p.dx, Ct.l) - Math.max(p.x, 0));
  const uz = Math.max(0, Math.min(p.z + p.dz, Ct.w) - Math.max(p.z, 0));
  return ux * uz / (p.dx * p.dz);
};

test("kein Packstueck liegt neben dem Deck", () => {
  const r = packKind(RACK, stueck(500, 300, 200, 2), {}, false);
  assert.ok(r.placed.length >= 1, "mindestens ein Stueck sollte liegen");
  for (const p of r.placed) {
    const a = auflage(p, RACK);
    assert.ok(a >= 0.5, `Stueck bei x=${p.x}, z=${p.z} liegt nur zu ${Math.round(a * 100)} % auf dem Deck`);
    const mz = p.z + p.dz / 2, mx = p.x + p.dx / 2;
    assert.ok(mx >= 0 && mx <= RACK.l, `Schwerpunkt laengs ausserhalb des Decks: ${mx}`);
    assert.ok(mz >= 0 && mz <= RACK.w, `Schwerpunkt quer ausserhalb des Decks: ${mz}`);
  }
});

test("was nicht getragen wird, wird ehrlich als offen gemeldet", () => {
  // Zwei 300 cm breite Stuecke passen quer NICHT nebeneinander auf 244 cm Deck. Eins geht,
  // das zweite nicht – und genau das muss die Zahl sagen, statt es schweben zu lassen.
  const r = packKind(RACK, stueck(500, 300, 200, 2), {}, false);
  assert.strictEqual(r.placed.length, 1, `erwartet 1 verladen, tatsaechlich ${r.placed.length}`);
  assert.strictEqual(r.totalBoxes, 2);
  assert.strictEqual(r.perType[0].loaded, 1);
});

test("zwei Stuecke stehen buendig, ohne Luecke", () => {
  const r = packKind(RACK, stueck(250, 300, 200, 2), {}, false);
  assert.strictEqual(r.placed.length, 2, "beide sollten liegen");
  const [a, b] = [...r.placed].sort((p, q) => p.x - q.x);
  const luecke = b.x - (a.x + a.dx);
  assert.ok(Math.abs(luecke) < 1e-6, `Luecke von ${luecke} cm zwischen den Stuecken`);
});

test("Ueberstand bleibt erlaubt – ein Flat Rack ist genau dafuer da", () => {
  const r = packKind(RACK, stueck(500, 300, 200, 1), {}, false);
  assert.strictEqual(r.placed.length, 1);
  const p = r.placed[0];
  const ueber = Math.max(0, -p.z) + Math.max(0, p.z + p.dz - RACK.w);
  assert.ok(ueber > 0, "das Stueck ist breiter als das Deck und muss ueberstehen duerfen");
  assert.ok(auflage(p, RACK) >= 0.5, "trotzdem liegt es mit dem groesseren Teil auf dem Deck");
});
