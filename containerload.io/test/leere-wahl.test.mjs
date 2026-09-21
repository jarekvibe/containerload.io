// Die leere Wahl: passt NICHTS in den gewaehlten Container, gibt es keine Kette.
//
// Gemeldet per ?q=-Link (22 Stuecke a 600x60x80, Default 20' GP): die Kette
// buchte "3 Container", einer davon der leere 20er -- 600 cm gehen nicht in
// 590 cm Innenlaenge, die Auto-Folgecontainer schluckten alles, und niemand
// warf die leere Huelle wieder raus. Die Landfracht verhielt sich immer schon
// ehrlich (Folgefahrzeug = dasselbe Fahrzeug, die Kette traegt dort nie mehr
// als die Wahl); die Seefracht zieht nach.
//
// Die Zusage: traegt die Wahl kein einziges Packstueck, antwortet der Plan wie
// vor der Kette -- die gewaehlte Huelle, alles offen, und die Empfehlung
// darunter (die seit dem Kombi-Knopf fuer jeden Vorschlag einen Handgriff hat)
// uebernimmt. Nebenbefund, hier festgehalten: mit einer Zuweisung auf C2 und
// nichts Freiem fuer C1 gab bauen() null zurueck und die App stuerzte ab.
//
// node --test test/leere-wahl.test.mjs
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
const { chainContainers, packCargo, PRESETS, MAXCHAIN } = new Function(
  `var num=(v,d=0)=>Number.isFinite(+v)&&v!==""?+v:d;
   var applyCarrier=(p)=>p;
   ${cut("var PRESETS = {", (l) => l.includes("var panelsFor"))}
   ${cut("function makeFloorPacker", (l, i) => l.trim() === "}" && L[i - 1].includes("single: false"))}
   ${cut("var MAXCHAIN", (l, i) => l.trim() === "}" && L[i - 1].includes("return { chain, remainingBoxes"))}
   return { chainContainers, packCargo, PRESETS, MAXCHAIN };`
)();
const C20 = PRESETS["20' GP"];
const kette = (cargo) => chainContainers(C20, "20' GP", cargo, packCargo(C20, cargo, {}), {}, MAXCHAIN);

test("der gemeldete Fall: 600-cm-Stuecke, 20' GP -- kein leerer C1 mit vollen Folgecontainern", () => {
  const ch = kette([{ name: "B", l: 600, w: 60, h: 80, qty: 22, weight: 381 }]);
  assert.strictEqual(ch.chain.length, 1, "die Kette darf keine Folgecontainer um eine leere Wahl bauen");
  assert.strictEqual(ch.chain[0].placed.length, 0);
  assert.strictEqual(ch.remainingBoxes, 22, "alles bleibt offen -- die Empfehlung uebernimmt");
});

test("die Zuweisung auf C2 bei unpassender Wahl stuerzt nicht mehr ab", () => {
  // Vor dem Fang: bauen() -> null, erg.chain von null -> TypeError, weisse Seite.
  const ch = kette([{ name: "B", l: 600, w: 60, h: 80, qty: 22, weight: 381, slot: 1 }]);
  assert.strictEqual(ch.chain.length, 1);
  assert.strictEqual(ch.remainingBoxes, 22);
});

test("die Gegenprobe: traegt die Wahl etwas, laeuft die Kette wie immer", () => {
  const ch = kette([{ name: "A", l: 120, w: 80, h: 110, qty: 50, weight: 300 }]);
  assert.ok(ch.chain.length > 1, "eine tragende Wahl bekommt weiterhin ihre Folgecontainer");
  assert.ok(ch.chain[0].placed.length > 0);
  assert.strictEqual(ch.remainingBoxes, 0);
  assert.ok(ch.chain.every((c) => c.placed.length > 0), "kein Slot der Kette ist leer");
});

test("der Vertrag im Quelltext: App-Weiche und Fang in beiden Kettenfunktionen", () => {
  assert.ok(roh.includes("if ((r.boxes < r.totalBoxes || stoppsAktiv) && r.totalBoxes > 0 && r.boxes > 0)"),
    "die App baut die Kette wieder auch um eine leere Wahl herum");
  assert.ok(roh.includes("r.remainingBoxes = Math.max(0, r.totalBoxes - r.boxes);"),
    "der Sammelzweig meldet den Rest nicht mehr ehrlich (er traegt jetzt auch den Nichts-passt-Fall)");
  // Der Fang gegen bauen() -> null und der Rueckzug des gierigen Pfads bei leerem
  // slot0 -- je einmal in chainContainers UND chainVehicles.
  for (const [muster, wo] of [
    [/if \(!erg\) \{/g, "der null-Fang"],
    [/if \(!\(slot0\.placed \|\| \[\]\)\.length\) return null;/g, "der Rueckzug des gierigen Pfads"],
  ]) {
    const n = (roh.match(muster) || []).length;
    assert.strictEqual(n, 2, `${wo} steht ${n}x da statt zweimal (See- und Landfracht)`);
  }
});
