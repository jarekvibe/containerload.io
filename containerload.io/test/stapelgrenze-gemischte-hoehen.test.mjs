// Gemeldeter Fehler: 39 Paletten, jede einzeln erfasst, jede "1x stapelbar" —
// der Rechner stapelte fuenf hoch.
//
// Alle 39 haben dieselbe Grundflaeche (325 x 218 cm) und fast dieselbe Hoehe: 41 bis
// 52 cm. Genau daran ist die Grenze gescheitert. Sie zaehlte den Turm nur ueber Stuecke
// GLEICHER BAUHOEHE — ein Behelf fuer "gleiche Sorte". Bei 39 Positionen mit je eigener
// Hoehe war keine zwei gleich hoch, der Turm blieb bei 1, und die Grenze griff nie.
//
// Die Semantik dahinter war schon vorher im Auswahlfeld festgehalten: "1x stapelbar"
// heisst EINE zusaetzliche Lage obendrauf. Das ist eine Tragfaehigkeit — sie sagt, was
// auf dem Stueck stehen darf, und nicht, welcher Sorte das angehoert.
//
// node --test test/stapelgrenze-gemischte-hoehen.test.mjs
import fs from "node:fs";
import assert from "node:assert";
import test from "node:test";
import { fileURLToPath } from "node:url";
import path from "node:path";

const dir = path.dirname(fileURLToPath(import.meta.url));
const L = fs.readFileSync(path.join(dir, "..", "app.html"), "utf8").split("\n");
const ps = L.findIndex((l) => l.includes("function makeFloorPacker"));
const pe = L.findIndex((l, i) => i > ps && l.trim() === "}" && L[i - 1].includes("return { placed, perType"));
const pS = L.findIndex((l) => l.includes("var PRESETS = {"));
const pE = L.findIndex((l, i) => i > pS && l.includes("var panelsFor"));
const { packCargo, PRESETS } = new Function(
  'var num=(v,d=0)=>Number.isFinite(+v)&&v!==""?+v:d;\n'
  + L.slice(pS, pE + 1).join("\n") + "\n" + L.slice(ps, pe + 1).join("\n")
  + "\nreturn { packCargo, PRESETS };"
)();

// Die Hoehen aus der Meldung, in Zentimetern. Die Gewichte spielen fuer die Grenze
// keine Rolle und sind hier gleichmaessig angesetzt.
const HOEHEN = [44, 43, 44, 44, 43, 43, 52, 51, 50, 43, 43, 43, 42, 44, 44, 44, 42, 41, 44, 44,
                44, 43, 49, 47, 47, 47, 48, 48, 48, 48, 48, 48, 46, 46, 46, 46, 49, 49, 49];
const CAP = 2;   // "1x stapelbar" = eine Lage obendrauf
const ladung = HOEHEN.map((h, i) => ({
  name: "Palette " + (i + 1), l: 325, w: 218, h, weight: 2000,
  qty: 1, stackable: true, stackMax: CAP, rotatable: true
}));

// Wie viele Stuecke stehen unmittelbar ueber diesem, in derselben Saeule?
const darueber = (p, alle) => alle.filter((q) =>
  q.y > p.y + 1e-3 &&
  Math.min(p.x + p.dx, q.x + q.dx) - Math.max(p.x, q.x) > 1e-6 &&
  Math.min(p.z + p.dz, q.z + q.dz) - Math.max(p.z, q.z) > 1e-6).length;

const saeulen = (placed) => {
  const m = new Map();
  for (const p of placed) {
    const k = Math.round(p.x) + "|" + Math.round(p.z);
    m.set(k, (m.get(k) || 0) + 1);
  }
  return [...m.values()];
};

test("39 Paletten mit 41 bis 52 cm: keine Saeule hoeher als die Stapelgrenze", () => {
  for (const name of ["20' GP", "40' GP", "40' HC", "45' HC"]) {
    const r = packCargo(PRESETS[name], ladung, {}, false);
    const hoch = saeulen(r.placed).filter((n) => n > CAP);
    assert.deepStrictEqual(hoch, [],
      `${name}: Saeule(n) mit ${hoch.join(", ")} Paletten uebereinander, erlaubt sind ${CAP}`);
  }
});

test("keine Palette traegt mehr, als sie darf", () => {
  const r = packCargo(PRESETS["40' HC"], ladung, {}, false);
  for (const p of r.placed) {
    const oben = darueber(p, r.placed);
    assert.ok(oben <= CAP - 1, `Palette bei y=${p.y} traegt ${oben} Stueck, erlaubt ist ${CAP - 1}`);
  }
});

test("die Grenze wurde begrenzt, nicht die Ladung abgewuergt", () => {
  // 325 cm lang: drei nebeneinander in einen 40-Fuss (1203 cm), 218 breit: eine je Reihe.
  // Mal zwei Lagen sind sechs je Container — das muss der Packer auch finden.
  const r = packCargo(PRESETS["40' HC"], ladung, {}, false);
  assert.strictEqual(r.boxes, 6, `erwartet 6 Paletten im 40' HC, verladen wurden ${r.boxes}`);
  assert.strictEqual(r.totalBoxes, 39, "die Mengenbilanz muss alle 39 kennen");
});

test("ohne Grenze stapelt der Packer weiterhin so hoch, wie es passt", () => {
  // Gegenprobe: waere die Grenze einfach abgeschafft, faellt dieser Test nicht auf.
  const frei = ladung.map((c) => ({ ...c, stackMax: Infinity }));
  const r = packCargo(PRESETS["40' HC"], frei, {}, false);
  assert.ok(Math.max(...saeulen(r.placed)) > CAP,
    "ohne Stapelgrenze muessten deutlich mehr als zwei uebereinander stehen");
});
