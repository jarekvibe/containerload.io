// Regressionstest: Uebermass ohne Drehen-Erlaubnis.
//
// Gemeldet mit Bild: 20' Flat Rack ausgewaehlt, ein Stueck 120 x 245 x 110 mit
// Drehen AUS. Das Deck blieb leer (0/1), und darunter stand die Empfehlung
// "40' Flat Rack" -- unter einem ausgewaehlten Flat Rack, auf den die Ladung
// laengst gehoert.
//
// Ursache: fitsDeck in packKind prueft die GEDREHTE Lage (w <= CL && l <= CW),
// ohne zu fragen, ob die Ware gedreht werden darf. Das Stueck galt als
// deckkonform, der normale Packer darf aber nicht drehen -- es blieb unverladen,
// und der Uebermass-Pfad (der den seitlichen Ueberstand aufs Flat Rack legt)
// wurde nie erreicht. Drehen ist eine Erlaubnis, keine Annahme.
//
// node --test test/uebermass-ohne-drehen.test.mjs
import fs from "node:fs";
import assert from "node:assert";
import test from "node:test";
import { fileURLToPath } from "node:url";
import path from "node:path";

const dir = path.dirname(fileURLToPath(import.meta.url));
const roh = fs.readFileSync(path.join(dir, "..", "app.html"), "utf8");
const L = roh.split("\n");

// Gleiche Schneide-Mechanik wie test/oversize-breite.test.mjs.
const cs = L.findIndex((l) => l.includes("var EQUIP = {"));
const ce = L.findIndex((l, i) => i > cs && l.includes("var KIND_ORDER"));
const ps = L.findIndex((l) => l.includes("function makeFloorPacker"));
const pe = L.findIndex((l, i) => i > ps && l.trim() === "}" && L[i - 1].includes("single: false"));
assert.ok(cs >= 0 && ce > cs && ps >= 0 && pe > ps, "Code-Ausschnitt nicht gefunden");
const { packKind } = new Function(
  'var num = (v, d = 0) => Number.isFinite(+v) && v !== "" ? +v : d;\n'
  + L.slice(cs, ce).join("\n") + "\n" + L.slice(ps, pe + 1).join("\n")
  + "\nreturn { packKind };"
)();

const FR20 = { l: 585, w: 244, h: 218, payload: 31000, kind: "flatrack", gauge: { l: 606, w: 244, h: 259 } };
const OT20 = { l: 589, w: 235, h: 239, payload: 28100, kind: "opentop", gauge: { l: 606, w: 244, h: 259 } };

test("der gemeldete Fall: 245 cm breit, Drehen aus, liegt MIT Ueberstand auf dem Flat Rack", () => {
  const r = packKind(FR20, [{ l: 120, w: 245, h: 110, weight: 300, qty: 1, rotatable: false }], {}, false);
  assert.strictEqual(r.boxes, 1, "das Stueck bleibt unverladen");
  const b = r.placed[0];
  // Lage wie eingegeben (nicht gedreht) und seitlich ueberstehend -- genau
  // dafuer sind die offenen Seiten des Flat Racks da.
  assert.strictEqual(b.dz, 245);
  assert.ok(b.z < -1e-9 || b.z + b.dz > FR20.w + 1e-9, "kein Ueberstand -- wo liegen die 245 cm?");
  // Und es liegt auf dem Deck, nicht daneben (Schwerpunkt-Regel von placeOversize).
  assert.ok(b.z + b.dz / 2 >= 0 && b.z + b.dz / 2 <= FR20.w, "Schwerpunkt neben dem Deck");
});

test("mit Drehen-Erlaubnis liegt dasselbe Stueck gedreht INNEN -- kein Ueberstand", () => {
  const r = packKind(FR20, [{ l: 120, w: 245, h: 110, weight: 300, qty: 1, rotatable: true }], {}, false);
  assert.strictEqual(r.boxes, 1);
  const b = r.placed[0];
  assert.strictEqual(b.dz, 120, "die guenstigere gedrehte Lage wurde nicht genutzt");
  assert.ok(b.z >= -1e-9 && b.z + b.dz <= FR20.w + 1e-9, "gedreht und trotzdem Ueberstand?");
});

test("Gegenprobe Open Top: geschlossene Seiten bleiben geschlossen", () => {
  // Ohne Drehen passt 245 quer nicht zwischen 235er-Waende -- das Stueck muss
  // OFFEN bleiben statt durch Stahl zu ragen.
  const r = packKind(OT20, [{ l: 120, w: 245, h: 110, weight: 300, qty: 1, rotatable: false }], {}, false);
  assert.strictEqual(r.boxes, 0, "245 cm stehen durch die Seitenwand");
  assert.strictEqual(r.perType[0].loaded, 0);
});

test("die OOG-Karte vermisst die Stauung, nicht die Rohmasse", () => {
  // Ein drehbares Stueck, das gedreht innen liegt, ist nicht ueberbreit. Die
  // Karte behauptete sonst "Ueberbreite + blockierte Slots" neben einem Plan
  // ohne jeden Ueberstand. Der Vertrag steht im Pack-Effekt: sind alle Stuecke
  // verladen, kommt md aus den gestauten Lagen (dx/dz, y+dy fuer Tuerme).
  assert.ok(roh.includes("if (r.boxes >= r.totalBoxes) {\n            (r.placed || []).forEach((b) => { md.l = Math.max(md.l, num(b.dx)); md.w = Math.max(md.w, num(b.dz)); md.h = Math.max(md.h, num(b.y) + num(b.dy)); });"),
    "die OOG-Vermessung nimmt nicht mehr die gestauten Lagen");
});

test("der Vertrag im Quelltext: Drehen ist eine Erlaubnis, keine Annahme", () => {
  assert.ok(roh.includes("const fitsDeck = (l <= CL && w <= CW || rot && w <= CL && l <= CW) && h <= CH;"),
    "fitsDeck unterstellt wieder die gedrehte Lage");
  assert.ok(roh.includes("const overW = rot ? Math.min(l, w) > CW : w > CW;"),
    "die Uebermass-Einstufung unterstellt wieder die gedrehte Lage");
});
