// Regressionstest: Uebermaß-Ladung darf nicht durch geschlossene Seitenwaende ragen.
//
// Der Fehler entsteht aus zwei Stellen, die verschiedene Annahmen treffen:
//
//   Einstufung (in packKind):
//     const overW = Math.min(l, w) > CW
//   -> "zu breit" nur, wenn das Stueck in BEIDEN Ausrichtungen zu breit ist.
//      Die Einstufung setzt also stillschweigend voraus, dass gedreht wird.
//
//   Platzierung (placeOversize):
//     const dz = num(dims.w)
//   -> legt das Stueck mit seiner TATSAECHLICHEN Breite ab. Es wird nie gedreht.
//
// Solange die Seiten offen sind (Flat Rack, Platform), faellt das nicht auf:
// dort DARF Ladung seitlich ueberstehen, das ist der Sinn dieser Container.
//
// Beim Open Top aber sind die Seitenwaende geschlossen (EQUIP.opentop.sides = true).
// Ein Stueck 200 lang x 300 breit x 300 hoch wird dort so eingestuft:
//   overW = min(200,300) = 200 > 235 ?  nein  -> gilt als breitenkonform
//   overH = 300 > 239    ?  ja           -> Uebermaß nur nach OBEN, Dach ist offen
// Also wird es verladen — und dann mit dz = 300 abgelegt:
//   z = (235 - 300) / 2 = -32,5
// Es steht damit 32,5 cm links UND rechts durch massive Stahlwaende.
//
// Die 3D-Ansicht zeichnet das so. Gemeldet wird es nicht: computeOOG berechnet den
// Breitenueberstand nur bei OFFENEN Seiten. Beim Open Top erscheint also gar nichts.
//
// Richtig waere: das Stueck in der Ausrichtung ablegen, die die Einstufung
// unterstellt hat — quer, mit min(l,w) ueber die Breite.
import fs from "node:fs";
import assert from "node:assert";
import test from "node:test";
import { fileURLToPath } from "node:url";
import path from "node:path";

const dir = path.dirname(fileURLToPath(import.meta.url));
const L = fs.readFileSync(path.join(dir, "..", "app.html"), "utf8").split("\n");

// Gleiche Schneide-Mechanik wie test/oversize-overlap.test.mjs.
const cs = L.findIndex((l) => l.includes("var PRESETS = {"));
const ce = L.findIndex((l, i) => i > cs && l.includes("var panelsFor"));
const ps = L.findIndex((l) => l.includes("function makeFloorPacker"));
const pe = L.findIndex((l, i) => i > ps && l.trim() === "}" && L[i - 1].includes("layers: base.layers || 1"));

assert.ok(cs >= 0 && ce > cs && ps >= 0 && pe > ps, "Code-Ausschnitt aus app.html nicht gefunden — Anker geprueft?");

const { packKind } = new Function(
  `var num=(v,d=0)=>Number.isFinite(+v)&&v!==""?+v:d;
   ${L.slice(cs, ce + 1).join("\n")}
   ${L.slice(ps, pe + 1).join("\n")}
   return { packKind };`
)();

// Open Top 20': feste Seitenwaende, offenes Dach.
const OPENTOP = { n: "20' Open Top", l: 589, w: 235, h: 239, payload: 28100, kind: "opentop" };
// Flat Rack 20': offene Seiten — hier IST Ueberstand erlaubt und gewollt.
const FLATRACK = { n: "20' Flat Rack", l: 585, w: 244, h: 218, payload: 31000, kind: "flatrack" };

const num = (v, d = 0) => (Number.isFinite(+v) && v !== "" ? +v : d);
const TOL = 1e-6;

// Groesster seitlicher Ueberstand ueber die Containerbreite, links und rechts zusammen.
const seitlicherUeberstand = (placed, CW) => {
  let links = 0, rechts = 0;
  for (const p of placed) {
    links = Math.max(links, -p.z);
    rechts = Math.max(rechts, p.z + p.dz - CW);
  }
  return { links: Math.max(0, links), rechts: Math.max(0, rechts) };
};

// 1) DER FEHLERFALL: Beim Open Top sind die Seiten zu. Nichts darf seitlich herausragen.
test("Open Top: nichts ragt durch die geschlossenen Seitenwaende", () => {
  const r = packKind(OPENTOP, [
    // Zu hoch fuer den Container (Dach offen, also zulaessig), aber 300 cm breit.
    // Quer gelegt (200 cm ueber die Breite) passt es zwischen die Waende.
    { name: "Hochstueck", l: 200, w: 300, h: 300, weight: 900, qty: 1, stackable: false, rotatable: true },
  ], {});

  assert.ok(r.placed.length > 0, "das Stueck sollte auf einem Open Top verladbar sein (Dach ist offen)");

  const u = seitlicherUeberstand(r.placed, num(OPENTOP.w));
  assert.ok(
    u.links <= TOL && u.rechts <= TOL,
    `Ladung ragt ${u.links.toFixed(1)} cm links und ${u.rechts.toFixed(1)} cm rechts heraus — ` +
      `beim Open Top sind das massive Stahlwaende. Belegt: ${r.placed.map((p) => `z=${p.z.toFixed(1)} dz=${p.dz.toFixed(1)}`).join(", ")}`
  );
});

// 2) GEGENPROBE: Beim Flat Rack sind die Seiten offen. Dort MUSS Ueberstand moeglich
//    bleiben — sonst waere der Fehler dadurch "behoben", dass gar nichts mehr verladen wird.
test("Flat Rack: seitlicher Ueberstand bleibt erlaubt", () => {
  const r = packKind(FLATRACK, [
    // In BEIDEN Ausrichtungen breiter als der Container — Drehen hilft hier nicht.
    { name: "Breitgut", l: 300, w: 300, h: 100, weight: 900, qty: 1, stackable: false, rotatable: true },
  ], {});

  assert.ok(r.placed.length > 0, "auf einem Flat Rack muss ueberbreite Ladung verladbar bleiben");
  const u = seitlicherUeberstand(r.placed, num(FLATRACK.w));
  assert.ok(u.links + u.rechts > 0, "ein 300 cm breites Stueck auf 244 cm Deck MUSS ueberstehen");
});

// 3) GEGENPROBE: Normale Ladung auf dem Open Top bleibt unberuehrt.
test("Open Top: normale Ladung wird weiterhin verladen", () => {
  const r = packKind(OPENTOP, [
    { name: "Palette", l: 120, w: 80, h: 110, weight: 300, qty: 10, stackable: true, rotatable: true },
  ], {});
  assert.ok(r.placed.length >= 10, `alle 10 Paletten sollten passen, verladen wurden ${r.placed.length}`);
  const u = seitlicherUeberstand(r.placed, num(OPENTOP.w));
  assert.ok(u.links <= TOL && u.rechts <= TOL, "normale Ladung darf ohnehin nirgends herausragen");
});

console.log("oversize-breite: alle Tests gruen");
