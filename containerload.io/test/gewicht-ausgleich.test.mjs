// Das Gewicht ueber die Kette verteilen -- und trotzdem so wenige Container wie moeglich.
//
// Die gierige Kette fuellt Container 1 randvoll und laesst dem letzten den Rest: bei der
// gemeldeten Sendung 26.430 / 24.613 / 16.729 kg. Gebucht wird aber jeder Container einzeln,
// gewogen wird jeder einzeln, gefahren wird jeder einzeln -- drei annaehernd gleich schwere
// sind das, was man haben will.
//
// Beides zusammen geht als ZWEI STUFEN: Stufe 1 bestimmt N (die kleinste Zahl Container),
// Stufe 2 verteilt bei festem N neu und wird nur uebernommen, wenn danach immer noch alles in
// dieselben N Container passt. Der Ausgleich kann also nie einen Container kosten.
//
// node --test test/gewicht-ausgleich.test.mjs
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
const { chainContainers, packCargo, PRESETS, ketteAusgleichen, AUSGLEICH_LUFT } = new Function(
  `var num=(v,d=0)=>Number.isFinite(+v)&&v!==""?+v:d;
   var applyCarrier=(p)=>p;
   ${cut("var PRESETS = {", (l) => l.includes("var panelsFor"))}
   ${cut("function makeFloorPacker", (l, i) => l.trim() === "}" && L[i - 1].includes("single: false"))}
   ${cut("var MAXCHAIN", (l, i) => l.trim() === "}" && L[i - 1].includes("return { chain, remainingBoxes"))}
   return { chainContainers, packCargo, PRESETS, ketteAusgleichen, AUSGLEICH_LUFT };`
)();

// Die gemeldete Sendung, Hoehe und Gewicht je Palette wie in der Anfrage.
const G1 = [[49, 2220], [47, 2180], [47, 2180], [46, 2090], [45, 2030], [45, 2030], [45, 1915],
  [45, 1915], [42, 1795], [42, 1805], [45, 2173], [45, 2195], [45, 2175], [45, 2201], [45, 2199],
  [43, 1896], [43, 1919], [43, 1943], [47, 2295], [47, 2235], [47, 1942], [47, 2290], [46, 2150],
  [43, 1949], [45, 1940], [45, 2090], [45, 2085], [45, 2085], [44, 1885]];
const G2 = [[55, 1020], [55, 1020], [55, 1020], [55, 1025], [55, 1025], [55, 1025], [51, 915], [51, 915]];
const JAREK = [
  ...G1.map(([h, kg], i) => ({ name: "G1-" + i, l: 325, w: 218, h, weight: kg, qty: 1, stackable: true, stackH: 180, rotatable: true })),
  ...G2.map(([h, kg], i) => ({ name: "G2-" + i, l: 228, w: 110, h, weight: kg, qty: 1, stackable: true, stackH: 180, rotatable: true }))
];
const kette = (preset, cargo) => {
  const c0 = PRESETS[preset];
  const r0 = packCargo(c0, cargo, {}, false);
  return { r0, ch: chainContainers(c0, preset, cargo, r0, {}, 24) };
};
const kgJe = (ch, cargo) => ch.chain.map((c) => c.placed.reduce((s, b) => s + Math.max(0, cargo[b.ti] ? cargo[b.ti].weight : 0), 0));
const spanne = (k) => Math.max(...k) - Math.min(...k);

test("die gemeldete Sendung steht danach fast gleich schwer auf drei Containern", () => {
  const { ch } = kette("40' HC", JAREK);
  assert.strictEqual(ch.chain.length, 3, `${ch.chain.length} Container statt 3`);
  assert.strictEqual(ch.remainingBoxes, 0);
  const kg = kgJe(ch, JAREK);
  assert.strictEqual(Math.round(kg.reduce((a, b) => a + b, 0)), 67772, "unterwegs ist Gewicht verlorengegangen");
  // Gierig waren es 9.701 kg Unterschied zwischen dem schwersten und dem leichtesten.
  assert.ok(spanne(kg) < 2000, `Spanne ${Math.round(spanne(kg))} kg -- der Ausgleich hat nicht gegriffen (${kg.map(Math.round).join(" / ")})`);
});

test("kein Container traegt mehr, als er darf -- auch nach dem Ausgleich", () => {
  for (const preset of ["20' GP", "20' HC", "40' GP", "40' HC", "45' HC"]) {
    const { ch } = kette(preset, JAREK);
    ch.chain.forEach((c, i) => {
      const kg = c.placed.reduce((s, b) => s + JAREK[b.ti].weight, 0);
      const pay = +c.preset.payload || 0;
      if (pay > 0) assert.ok(kg <= pay + 0.5, `${preset} C${i + 1}: ${Math.round(kg)} kg auf ${pay} kg Zuladung`);
    });
  }
});

test("der Ausgleich kostet niemals einen Container und verliert kein Packstueck", () => {
  // Gegenprobe gegen die Stufe-1-Kette: ketteAusgleichen bekommt sie selbst zu sehen und darf
  // sie nur ersetzen, wenn dieselbe Zahl Container weiterhin ALLES aufnimmt.
  let seed = 20260821;
  const rnd = () => ((seed = (seed * 1103515245 + 12345) & 2147483647) / 2147483647);
  const ri = (a, b) => a + Math.floor(rnd() * (b - a + 1));
  const namen = Object.keys(PRESETS).filter((n) => PRESETS[n].l > 0 && !PRESETS[n].kind);
  let ausgeglichen = 0, geprueft = 0;
  for (let i = 0; i < 40; i++) {
    const cargo = [];
    for (let t = 0, n = ri(1, 3); t < n; t++) cargo.push({
      name: "T" + t, l: ri(60, 320), w: ri(60, 220), h: ri(40, 150), weight: ri(200, 1800),
      qty: ri(10, 60), stackable: rnd() < 0.85, rotatable: rnd() < 0.85
    });
    const preset = namen[ri(0, namen.length - 1)];
    const { ch } = kette(preset, cargo);
    if (ch.remainingBoxes > 0) continue;
    geprueft++;
    const stueck = ch.chain.reduce((s, c) => s + c.placed.length, 0);
    const gesamt = cargo.reduce((s, t) => s + t.qty, 0);
    assert.strictEqual(stueck, gesamt, `Fall ${i} (${preset}): ${stueck} von ${gesamt} Packstuecken in der Kette`);
    if (ch.slot0) {
      ausgeglichen++;
      // slot0 IST der erste Container der ausgeglichenen Kette -- sonst zeigt die Leiste
      // andere Zahlen als die Tabelle darunter.
      assert.strictEqual(ch.slot0.boxes, ch.chain[0].placed.length, `Fall ${i}: slot0 passt nicht zum ersten Container`);
    }
  }
  assert.ok(geprueft >= 20, `nur ${geprueft} auswertbare Faelle`);
  assert.ok(ausgeglichen > 0, "in 40 Faellen hat der Ausgleich kein einziges Mal gegriffen -- dann prueft der Test nichts");
});

test("bei nur einem Container gibt es nichts auszugleichen", () => {
  const klein = [{ name: "P", l: 120, w: 80, h: 100, weight: 300, qty: 6, stackable: true, rotatable: true }];
  const { ch } = kette("40' HC", klein);
  assert.strictEqual(ch.chain.length, 1);
  assert.ok(!ch.slot0, "eine einzelne Ladung darf gar nicht erst umgepackt werden");
});

test("ohne Gewichtsangaben bleibt die gierige Verteilung stehen", () => {
  // Alles 0 kg: es gibt kein Gewicht zu verteilen, und ein zweiter Packdurchgang waere reine
  // Rechenzeit -- schlimmer noch, er wuerde die Kette ohne jeden Gewinn umbauen.
  const ohne = JAREK.map((t) => ({ ...t, weight: 0 }));
  const { ch } = kette("40' HC", ohne);
  assert.ok(!ch.slot0, "ohne Gewichte darf der Ausgleich nicht anspringen");
});

test("die Stufenleiter faengt bei genau der Zielverteilung an", () => {
  assert.strictEqual(AUSGLEICH_LUFT[0], 1, "die erste Stufe muss das exakte Zielgewicht sein");
  for (let i = 1; i < AUSGLEICH_LUFT.length; i++) {
    assert.ok(AUSGLEICH_LUFT[i] > AUSGLEICH_LUFT[i - 1], "die Stufen muessen aufsteigen");
  }
  assert.ok(AUSGLEICH_LUFT[AUSGLEICH_LUFT.length - 1] <= 2,
    "ueber dem Doppelten des Zielgewichts ist es wieder die gierige Verteilung");
  assert.ok(AUSGLEICH_LUFT.length <= 5, "jede Stufe ist ein kompletter zweiter Packlauf ueber die ganze Kette");
});

test("ketteAusgleichen laesst Special Equipment in Ruhe", () => {
  // Open Top/Flat Rack packt packKind, nicht packCargo -- ein zweiter Durchgang ueber
  // packCargo wuerde die Uebermass-Stuecke stillschweigend fallenlassen.
  const stelle = roh.indexOf("function chainContainers(");
  const bis = roh.indexOf("function chainVehicles(", stelle);
  const block = roh.slice(stelle, bis);
  assert.ok(/ketteAusgleichen\(/.test(block), "chainContainers ruft den Ausgleich gar nicht auf");
  assert.ok(/container0\.kind \|\| "dry"\) === "dry"/.test(block),
    "der Ausgleich muss auf gewoehnliche Trockencontainer beschraenkt bleiben");
});
