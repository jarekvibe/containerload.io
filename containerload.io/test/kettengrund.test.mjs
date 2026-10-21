// Warum mehrere Container? Gemeldet (25 IBC zu je 1.100 kg im 40'): der Plan teilte
// auf zwei Container, der erste sah halb leer aus -- und nichts sagte, dass das
// GEWICHT die Grenze war, nicht der Platz. Die Grund-Zeile unterm Ketten-Chip
// erklaert genau das, und nur das: ein raeumlich voller Container erklaert sich
// selbst und bekommt keine Zeile.
//
// node --test test/kettengrund.test.mjs
import fs from "node:fs";
import assert from "node:assert";
import test from "node:test";
import { fileURLToPath } from "node:url";
import path from "node:path";

const dir = path.dirname(fileURLToPath(import.meta.url));
const roh = fs.readFileSync(path.join(dir, "..", "app.html"), "utf8");
const L = roh.split("\n");
const cut = (von, bis) => {
  const s = L.findIndex((l) => l.includes(von));
  const e = L.findIndex((l, i) => i > s && bis(l, i));
  assert.ok(s >= 0 && e > s, `Ausschnitt nicht gefunden: ${von}`);
  return L.slice(s, e + 1).join("\n");
};
const { chainContainers, packCargo, PRESETS, kettenGrund } = new Function(
  `var num=(v,d=0)=>Number.isFinite(+v)&&v!==""?+v:d;
   var applyCarrier=(p)=>p;
   ${cut("var PRESETS = {", (l) => l.includes("var panelsFor"))}
   ${cut("function makeFloorPacker", (l, i) => l.trim() === "}" && L[i - 1].includes("single: false"))}
   ${cut("var MAXCHAIN", (l, i) => l.trim() === "}" && L[i - 1].includes("return { chain, remainingBoxes"))}
   return { chainContainers, packCargo, PRESETS, kettenGrund };`
)();

const kette = (preset, cargo) => {
  const c0 = PRESETS[preset];
  const r0 = packCargo(c0, cargo, {}, false);
  return chainContainers(c0, preset, cargo, r0, {}, 24);
};

test("der gemeldete Fall: die Zeile nennt die Zuladung als Grund", () => {
  const ibc = [{ name: "IBC", l: 120, w: 100, h: 116, weight: 1100, qty: 25, stackable: true, rotatable: true }];
  for (const preset of ["40' GP", "40' HC"]) {
    const ch = kette(preset, ibc);
    assert.ok(ch.chain.length >= 2, `${preset}: keine Kette, nichts zu erklaeren`);
    const g = kettenGrund(PRESETS[preset], ibc, ch.chain);
    assert.ok(g, `${preset}: die Grund-Zeile fehlt`);
    assert.strictEqual(g.kg, 26400, `${preset}: C1 traegt ${g.kg} statt 26400`);
    assert.strictEqual(g.pay, PRESETS[preset].payload, `${preset}: genannte Zuladung stimmt nicht`);
  }
});

test("teilt der PLATZ, gibt es keine Zeile -- ein voller Container erklaert sich selbst", () => {
  const leicht = [{ name: "Kartons", l: 100, w: 100, h: 100, weight: 10, qty: 100, stackable: true, rotatable: true }];
  const ch = kette("20' GP", leicht);
  assert.ok(ch.chain.length >= 2, "die leichte Ware muss den 20' raeumlich sprengen");
  assert.strictEqual(kettenGrund(PRESETS["20' GP"], leicht, ch.chain), null);
});

test("ein einzelner Container braucht keine Begruendung", () => {
  const klein = [{ name: "P", l: 120, w: 80, h: 100, weight: 300, qty: 5, stackable: true, rotatable: true }];
  const ch = kette("20' GP", klein);
  assert.strictEqual(ch.chain.length, 1);
  assert.strictEqual(kettenGrund(PRESETS["20' GP"], klein, ch.chain), null);
});

test("der Vertrag im Quelltext: Zeile am Chip, Texte in beiden Sprachen, nur Auto-Modus", () => {
  for (const key of ["kettenGrund:", "kettenGrundRoad:"])
    assert.strictEqual((roh.match(new RegExp(key, "g")) || []).length, 2, key + " fehlt in einer Sprache");
  assert.ok(roh.includes('(domain === "road" ? T.kettenGrundRoad : T.kettenGrund)(fmtDE(grund.kg), fmtDE(grund.pay))'),
    "die Grund-Zeile haengt nicht mehr am Ketten-Chip");
  assert.ok(roh.includes("manualMode || !result.chain || result.chain.length < 2 ? null : kettenGrund("),
    "die Zeile muss im manuellen Modus schweigen (von Hand gestaut ist von Hand begruendet)");
});
