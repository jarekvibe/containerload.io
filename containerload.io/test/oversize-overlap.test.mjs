// Regressionstest fuer placeOversize: Uebermaß-Stücke duerfen sich NICHT mit anderen Stuecken durchdringen.
// Der Fehler: placeOversize legt Packstücke auf das Deck, OHNE zu pruefen, was dort bereits steht.
// Es wird also nicht gegen base.placed (die bereits platzierten Colli) getestet.
// node --test test/oversize-overlap.test.mjs
import fs from "node:fs";
import assert from "node:assert";
import test from "node:test";
import { fileURLToPath } from "node:url";
import path from "node:path";

const dir = path.dirname(fileURLToPath(import.meta.url));
const html = fs.readFileSync(path.join(dir, "..", "app.html"), "utf8");
const L = html.split("\n");

// Grosse Code-Extraktion: von makeFloorPacker (Zeile ~407) bis zum Ende von packKind (Zeile ~912)
// Das enthaelt alle abhaengigen Funktionen.
const ps = L.findIndex((l) => l.includes("function makeFloorPacker"));
const pe = L.findIndex((l, i) => i > ps && l.trim() === "}" && L[i - 1].includes("single: false"));

const codeSlice = L.slice(ps, pe + 1).join("\n");

// Benoetigte Konstanten und Helfer (vor makeFloorPacker)
const presets = L.findIndex((l) => l.includes("var PRESETS = {"));
const equip = L.findIndex((l) => l.includes("var EQUIP = {"));
const equipEnd = L.findIndex((l, i) => i > equip && l.includes("var panelsFor"));

const constantsSlice = L.slice(presets, equipEnd + 1).join("\n");

// Führe den extrahierten Code aus (inklusive PRESETS, EQUIP, panelsFor, packCargo, packKind, placeOversize)
const { packKind, boxesOverlap } = new Function(
  `var num=(v,d=0)=>Number.isFinite(+v)&&v!==""?+v:d;
   ${constantsSlice}
   ${codeSlice}
   return { packKind, boxesOverlap };`
)();

const TOL = 1e-6;

// Prüft, ob zwei Boxen sich in allen drei Achsen durchdringen (mit Toleranz)
function axis(a0, a1, b0, b1) {
  return Math.min(a1, b1) - Math.max(a0, b0);
}

function intersects(a, b) {
  const ox = axis(a.x, a.x + a.dx, b.x, b.x + b.dx);
  const oy = axis(a.y, a.y + a.dy, b.y, b.y + b.dy);
  const oz = axis(a.z, a.z + a.dz, b.z, b.z + b.dz);
  return ox > TOL && oy > TOL && oz > TOL ? Math.min(ox, oy, oz) : 0;
}

function assertNoOverlap(placed, label) {
  for (let i = 0; i < placed.length; i++) {
    for (let j = i + 1; j < placed.length; j++) {
      const d = intersects(placed[i], placed[j]);
      assert.ok(
        d === 0,
        `${label}: Kiste ${i} (ti=${placed[i].ti}) und ${j} (ti=${placed[j].ti}) ragen ${d.toFixed(6)} cm ineinander ` +
          `(A x${placed[i].x.toFixed(2)} y${placed[i].y.toFixed(2)} z${placed[i].z.toFixed(2)} ${placed[i].dx.toFixed(1)}x${placed[i].dy.toFixed(1)}x${placed[i].dz.toFixed(1)} | ` +
          `B x${placed[j].x.toFixed(2)} y${placed[j].y.toFixed(2)} z${placed[j].z.toFixed(2)} ${placed[j].dx.toFixed(1)}x${placed[j].dy.toFixed(1)}x${placed[j].dz.toFixed(1)})`
      );
    }
  }
}

// Test 1: Open Top mit normalen Colli + ein Uebermaß-Stueck (zu breit fuer normalen Container)
test("Open Top: normale Colli + Uebermaß-Stueck durchdringen sich nicht", () => {
  const Ct = { l: 589, w: 235, h: 239, payload: 28100, kind: "opentop" };
  const cargo = [
    // Normal: passen auf den Deck
    { name: "Europalette", l: 120, w: 80, h: 110, weight: 300, qty: 4, stackable: true, rotatable: true },
    // Uebermaß: zu BREIT fuer Open Top (Seiten sind zu, aber der Ueberstand ist erlaubt)
    // Open Top Breite = 235, aber wir geben ein Stueck mit 280 Breite -> ragt ueber die Seite hinaus
    { name: "Breitstaender", l: 150, w: 280, h: 100, weight: 500, qty: 1, stackable: false, rotatable: false }
  ];

  const r = packKind(Ct, cargo, {});

  // Verifiziere: es sollte Stücke geben
  assert.ok(r.placed.length > 0, "mindestens ein Stueck sollte verladen sein");

  // Verifiziere: keine Durchdringung
  assertNoOverlap(r.placed, "Open Top + Uebermaß");
});

// Test 2: Flat Rack mit normalen Colli + Uebermaß-Stueck (zu breit)
test("Flat Rack: normale Colli + Uebermaß durchdringen sich nicht", () => {
  const Ct = { l: 585, w: 244, h: 218, payload: 31000, kind: "flatrack" };
  const cargo = [
    // Normal: passen auf den Deck
    { name: "Kiste", l: 100, w: 100, h: 100, weight: 200, qty: 3, stackable: true, rotatable: true },
    // Uebermaß: zu breit fuer Flat Rack (Seiten offen, aber dieser Ueberstand wird trotzdem auf dem Deck platziert)
    { name: "Breit", l: 200, w: 300, h: 80, weight: 400, qty: 1, stackable: false, rotatable: false }
  ];

  const r = packKind(Ct, cargo, {});

  assert.ok(r.placed.length > 0, "mindestens ein Stueck sollte verladen sein");
  assertNoOverlap(r.placed, "Flat Rack + Uebermaß");
});

// Test 3: Flat Rack mit normalen Colli auf dem Deck + mehrere Uebermaß-Stücke nebeneinander
// Dieser Test versucht, die Durchdringung zu provozieren, weil placeOversize
// nicht gegen bereits platzierte Stücke prüft
test("Flat Rack: mehrere Uebermaß-Stücke platzieren sich nicht gegenseitig durchdringend", () => {
  const Ct = { l: 585, w: 244, h: 218, payload: 40000, kind: "flatrack" };
  const cargo = [
    // Ein normale Kiste auf dem Deck, um den Raum zu besetzen
    { name: "Basis", l: 200, w: 150, h: 80, weight: 300, qty: 1, stackable: false, rotatable: false },
    // Mehrere Uebermaß-Stücke, die vom Plazierungsalgorithmus auf dem Deck landen könnten
    { name: "Uebermaß1", l: 250, w: 280, h: 100, weight: 400, qty: 1, stackable: false, rotatable: false },
    { name: "Uebermaß2", l: 250, w: 280, h: 100, weight: 400, qty: 1, stackable: false, rotatable: false }
  ];

  const r = packKind(Ct, cargo, {});

  assert.ok(r.placed.length > 0, "mindestens ein Stueck sollte verladen sein");
  assertNoOverlap(r.placed, "Flat Rack + mehrere Uebermaß");
});

// Test 4: Open Top mit sehr dichtem Deck + Uebermaß
test("Open Top: dichter volles Deck + Uebermaß ueberschreitet sich nicht", () => {
  const Ct = { l: 589, w: 235, h: 239, payload: 28100, kind: "opentop" };
  const cargo = [
    // Viel im Deck: kleine Europaletten, dicht gepackt
    { name: "Palette", l: 120, w: 80, h: 110, weight: 300, qty: 20, stackable: true, rotatable: true },
    // Ein Uebermaß-Stück, das nicht auf ein normales Deck passt
    { name: "Gigant", l: 589, w: 300, h: 150, weight: 1000, qty: 1, stackable: false, rotatable: false }
  ];

  const r = packKind(Ct, cargo, {});

  assert.ok(r.placed.length > 0, "mindestens ein Stueck sollte verladen sein");
  assertNoOverlap(r.placed, "Open Top + Gigant");
});
