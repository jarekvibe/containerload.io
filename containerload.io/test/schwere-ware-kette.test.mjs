// Schwere Ware ueber zwei Container: die Empfehlung prueft gleiche Container, und der
// Gewichtsausgleich bleibt nicht bei der ersten Stufe stehen.
//
// Gemeldet mit Bild ("hae?"): 18 Kisten 110 x 95 x 176 cm a 1.483 kg = 26.694 kg, gewaehlt
// 40' HC (Zuladung 26.580 kg -- 114 kg zu wenig). Der Rechner zeigte:
//   - Kette 40' HC + 20' GP, und darin 8 Stueck im 40-Fuesser, 10 im angehaengten 20-Fuesser.
//     Der gewaehlte, groessere Container war der leerere ("Voll 19 %").
//   - "Verladen . C1 8 / 18" in Orange neben gruenem "Alles verladen . 2 Container".
//   - Keine Empfehlung, obwohl 2x 20' GP dieselbe Ladung tragen (je 9 Stueck, 13,3 t) --
//     gleich viele Container, 40 % weniger gebuchtes Volumen, und bei schwerer Ware der
//     uebliche Weg. Die Empfehlung kannte nur "Arbeitspferd zuerst, Rest hinten dran".
//
// node --test test/schwere-ware-kette.test.mjs
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
const { chainContainers, packCargo, suggestContainer, PRESETS, MAXCHAIN } = new Function(
  `var num=(v,d=0)=>Number.isFinite(+v)&&v!==""?+v:d;
   var applyCarrier=(p)=>p;
   ${cut("var PRESETS = {", (l) => l.includes("var panelsFor"))}
   ${cut("function makeFloorPacker", (l, i) => l.trim() === "}" && L[i - 1].includes("single: false"))}
   ${cut("function suggestEquipment", (l, i) => l.trim() === "}" && L[i - 1].includes("combo };"))}
   ${cut("var MAXCHAIN", (l, i) => l.trim() === "}" && L[i - 1].includes("return { chain, remainingBoxes"))}
   return { chainContainers, packCargo, suggestContainer, PRESETS, MAXCHAIN };`
)();

const vol = (n) => PRESETS[n].l * PRESETS[n].w * PRESETS[n].h;
const kette = (preset, cargo, ov = {}) => {
  const c0 = PRESETS[preset];
  return chainContainers(c0, preset, cargo, packCargo(c0, cargo, {}), ov, MAXCHAIN);
};
const kgJe = (ch, cargo) => ch.chain.map((c) => c.placed.reduce((s, b) => s + cargo[b.ti].weight, 0));
const GEMELDET = [{ name: "Kiste", l: 110, w: 95, h: 176, weight: 1483, qty: 18, stackable: true, stackMax: Infinity, rotatable: true }];

test("der gemeldete Fall: 9 / 9 statt 8 / 10, und der 40-Fuesser ist nicht mehr der leerere", () => {
  const ch = kette("40' HC", GEMELDET);
  assert.strictEqual(ch.remainingBoxes, 0);
  assert.deepStrictEqual(ch.chain.map((c) => c.name), ["40' HC", "20' GP"]);
  assert.deepStrictEqual(ch.chain.map((c) => c.placed.length), [9, 9],
    "Stufe 1 des Ausgleichs (8 / 10) darf nicht mehr gewinnen, wenn Stufe 2 genau aufgeht");
  const kg = kgJe(ch, GEMELDET);
  kg.forEach((k, i) => assert.ok(k <= +ch.chain[i].preset.payload + 0.5, `C${i + 1} ueberladen: ${k} kg`));
});

test("die Empfehlung lautet 2x 20' GP -- und die Kette dazu geht auf", () => {
  const s = suggestContainer(GEMELDET, "");
  assert.deepStrictEqual(s.combo, [{ name: "20' GP", count: 2 }],
    `erwartet 2x 20' GP, bekommen ${JSON.stringify(s.combo)}`);
  // Dieselbe Rangfolge wie empfBesser in app.html: gleich viele Container, weniger Volumen
  // als die Kette ab dem 40' HC -- also erscheint das Angebot mit Uebernehmen-Knopf.
  const k = kette("40' HC", GEMELDET);
  const kVol = k.chain.reduce((a, c) => a + vol(c.name), 0);
  assert.strictEqual(k.chain.length, 2);
  assert.ok(2 * vol("20' GP") < kVol - 1e-6, "2x 20' GP muessen weniger Volumen buchen als 40' HC + 20' GP");
  const ch = kette("20' GP", GEMELDET, { 1: "20' GP" });
  assert.strictEqual(ch.remainingBoxes, 0, "der Uebernehmen-Knopf verspraeche einen Plan, der nicht aufgeht");
  assert.deepStrictEqual(ch.chain.map((c) => c.placed.length), [9, 9]);
});

test("was die Empfehlung verspricht, haelt die Kette -- ueber Zufallsladungen", () => {
  let seed = 20261008;
  const rnd = () => ((seed = (seed * 1103515245 + 12345) & 2147483647) / 2147483647);
  const ri = (a, b) => a + Math.floor(rnd() * (b - a + 1));
  let geprueft = 0, gleiche = 0;
  for (let f = 0; f < 30; f++) {
    const cargo = Array.from({ length: ri(1, 2) }, (_, i) => ({ name: "S" + i, l: ri(60, 240), w: ri(50, 120), h: ri(40, 200),
      weight: ri(400, 2500), qty: ri(4, 24), stackable: rnd() < 0.7, stackMax: Infinity, rotatable: rnd() < 0.8 }));
    const s = suggestContainer(cargo, "");
    if (!s || s.type !== "multi") continue;
    geprueft++;
    if (s.combo.length === 1) gleiche++;
    const liste = [];
    s.combo.forEach((x) => { for (let i = 0; i < x.count; i++) liste.push(x.name); });
    const ov = {};
    for (let i = 1; i < liste.length; i++) ov[i] = liste[i];
    const ch = kette(liste[0], cargo, ov);
    assert.strictEqual(ch.remainingBoxes, 0, `Fall ${f}: ${JSON.stringify(s.combo)} laesst ${ch.remainingBoxes} liegen`);
    assert.ok(ch.chain.length <= liste.length, `Fall ${f}: ${JSON.stringify(s.combo)} braucht ${ch.chain.length} Container`);
  }
  assert.ok(geprueft >= 10 && gleiche >= 3, `zu wenig Faelle geprueft (${geprueft}, davon ${gleiche} gleiche Flotten)`);
});

test("der Vertrag im Quelltext", () => {
  // Die Empfehlung: gleiche Container als dritter Kandidat, gedeckelt und mit Untergrenze.
  assert.ok(roh.includes("const gleich = { used: { [o.name]: k }, offen: 0, n: k, vol: k * o.vol };"),
    "die Empfehlung prueft keine gleichen Container mehr");
  assert.ok(roh.includes("if (mindestens(o, rest) > kmax - k) break;"),
    "die Untergrenze fehlt -- dann packt die Empfehlung Flotten, die nie aufgehen koennen");
  // Der Ausgleich: weiter bis gut genug, frueher Abbruch ohne Gewinn bleibt.
  assert.ok(roh.includes("if (sp <= schwerstes + 1e-6) break;"),
    "der Ausgleich nimmt wieder die erste Stufe, die aufgeht");
  assert.ok(roh.includes("if (sp >= besteSpanne) break;"),
    "der fruehe Abbruch ohne Gewinn fehlt -- das kostet ein Drittel Rechenzeit");
  // Die Leiste: "Verladen . C1" orange nur, wenn wirklich etwas offen ist.
  assert.ok(roh.includes("accent: fokusSlot ? C.text : leer ? C.text : allFit ? C.good : planFit ? C.text : C.warn"),
    "'Verladen . C1' steht wieder orange neben 'Alles verladen'");
});
