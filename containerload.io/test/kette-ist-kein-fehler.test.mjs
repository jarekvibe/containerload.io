// Mehr als ein Container ist ein ENTSCHLUSS, kein Fehler.
//
// Gemeldet: "im Tool wird das immer so angezeigt, dass ein paar Packstuecke nicht verladen
// sind, obwohl sie in der Preview angezeigt werden." Und genau so war es: Statuszeile,
// Mengenzaehler in der Ladungsliste und der Bildexport lasen alle nur den ERSTEN Container.
// Bei 37 Paletten auf drei Containern stand daneben "17 offen" in Orange, "0/1" an
// Packstuecken, die im zweiten Container liegen, und ein rotes "33.227 kg ueber Zuladung",
// das die Gesamtladung gegen die Zuladung EINES Containers rechnete.
//
// node --test test/kette-ist-kein-fehler.test.mjs
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
const { chainContainers, packCargo, PRESETS } = new Function(
  `var num=(v,d=0)=>Number.isFinite(+v)&&v!==""?+v:d;
   var applyCarrier=(p)=>p;
   ${cut("var PRESETS = {", (l) => l.includes("var panelsFor"))}
   ${cut("function makeFloorPacker", (l, i) => l.trim() === "}" && L[i - 1].includes("single: false"))}
   ${cut("var MAXCHAIN", (l, i) => l.trim() === "}" && L[i - 1].includes("return { chain, remainingBoxes"))}
   return { chainContainers, packCargo, PRESETS };`
)();

// Die gemeldete Sendung: 29 Paletten 325x218 (42-49 cm) plus 8 Paletten 228x110.
const G1 = [[49, 2220], [47, 2180], [47, 2180], [46, 2090], [45, 2030], [45, 2030], [45, 1915],
  [45, 1915], [42, 1795], [42, 1805], [45, 2173], [45, 2195], [45, 2175], [45, 2201], [45, 2199],
  [43, 1896], [43, 1919], [43, 1943], [47, 2295], [47, 2235], [47, 1942], [47, 2290], [46, 2150],
  [43, 1949], [45, 1940], [45, 2090], [45, 2085], [45, 2085], [44, 1885]];
const G2 = [[55, 1020], [55, 1020], [55, 1020], [55, 1025], [55, 1025], [55, 1025], [51, 915], [51, 915]];
const cargo = [
  ...G1.map(([h, kg], i) => ({ name: "G1-" + i, l: 325, w: 218, h, weight: kg, qty: 1, stackable: true, stackH: 180, rotatable: true })),
  ...G2.map(([h, kg], i) => ({ name: "G2-" + i, l: 228, w: 110, h, weight: kg, qty: 1, stackable: true, stackH: 180, rotatable: true }))
];
const kette = (preset) => {
  const c0 = PRESETS[preset];
  const r0 = packCargo(c0, cargo, {}, false);
  return { r0, ch: chainContainers(c0, preset, cargo, r0, {}, 24) };
};

test("die Kette nimmt die gemeldete Sendung vollstaendig auf", () => {
  const { ch } = kette("40' HC");
  assert.strictEqual(ch.remainingBoxes, 0, `offen geblieben: ${ch.remainingBoxes}`);
  assert.ok(ch.chain.length >= 2 && ch.chain.length <= 4, `unerwartete Kettenlaenge ${ch.chain.length}`);
});

test("die Bilanz zaehlt den ganzen Plan, nicht seinen ersten Container", () => {
  const { r0, ch } = kette("40' HC");
  assert.ok(Array.isArray(ch.perType), "die Kette muss eine Bilanz liefern");
  assert.strictEqual(ch.perType.length, cargo.length);
  const geladen = ch.perType.reduce((s, p) => s + p.loaded, 0);
  const gesamt = ch.perType.reduce((s, p) => s + p.total, 0);
  assert.strictEqual(gesamt, 37, "alle 37 muessen in der Bilanz stehen");
  assert.strictEqual(geladen, 37, `im ganzen Plan verladen: ${geladen} von 37`);
  // Und der Unterschied zum ersten Container ist genau der Punkt der Meldung.
  assert.ok(r0.boxes < 37, "Gegenprobe: der erste Container allein nimmt sie nicht auf");
  const nurC1 = r0.perType.reduce((s, p) => s + p.loaded, 0);
  assert.ok(nurC1 < geladen, `C1 zaehlt ${nurC1}, der Plan ${geladen} - genau diese Luecke las die Oberflaeche als Fehler`);
});

test("jedes Packstueck ist entweder ganz verladen oder ehrlich offen", () => {
  const { ch } = kette("20' GP");
  for (const p of ch.perType) {
    assert.ok(p.loaded >= 0 && p.loaded <= p.total, `Bilanz ausserhalb der Menge: ${p.loaded}/${p.total}`);
  }
  const geladen = ch.perType.reduce((s, p) => s + p.loaded, 0);
  const gesamt = ch.perType.reduce((s, p) => s + p.total, 0);
  assert.strictEqual(gesamt - geladen, ch.remainingBoxes,
    "Bilanz und remainingBoxes muessen dasselbe sagen - sonst widersprechen sich Zaehler und Statuszeile");
});

// ── Was die Oberflaeche daraus macht ────────────────────────────────────────
test("die Oberflaeche liest die Bilanz des Plans, nicht die des ersten Containers", () => {
  // Die Zeile las frueher direkt (result.perTypeAll || result.perType). Seit es den Fokus
  // gibt, laeuft sie ueber sichtPerType -- und dessen Rueckfall OHNE Fokus ist genau
  // dieselbe Bilanz. Geprueft wird deshalb beides: dass die Zeile die Sicht liest, und dass
  // die Sicht ohne Fokus die Kettenbilanz ist. Nur eins von beiden waere die halbe Zusage.
  assert.ok(/const pt = sichtPerType\[i\];/.test(roh),
    "die Ladungsliste liest nicht mehr die Sicht");
  assert.ok(/const sichtPerType = fokusSlot[\s\S]{0,320}?: \(result\.perTypeAll \|\| result\.perType\);/.test(roh),
    "ohne Fokus zaehlt die Ladungsliste wieder nur den ersten Container");
  assert.ok(/const planFit = offenGesamt <= 0 && result\.totalBoxes > 0;/.test(roh),
    "die Statuszeile bewertet wieder nur den ersten Container");
  assert.ok(/const offenGesamt = kette \? \(result\.remainingBoxes \|\| 0\) : unplaced;/.test(roh),
    "offen ist, was die ganze Kette nicht aufnimmt");
});

test("die Ueberladung rechnet gegen die Zuladung des PLANS", () => {
  assert.ok(/const planPayload = kette[\s\S]{0,260}?reduce\(\(s2, c2\) => s2 \+ Math\.max\(0, num\(c2\.preset && c2\.preset\.payload\)\)/.test(roh),
    "die Zuladung der Kette wird nicht aufsummiert - 67 t auf drei Containern sind keine Ueberladung");
  assert.ok(/const overweight = planPayload > 0 && totalWeight > planPayload \+ 0\.5;/.test(roh));
});

test("das Bild zeigt den ganzen Plan und beschriftet ihn auch so", () => {
  assert.ok(/const shotKette = !!\(result && result\.chain && result\.chain\.length > 1\);/.test(roh),
    "der Bildexport unterscheidet Kette und Einzelcontainer nicht");
  assert.ok(/chip\(String\(shotTitel\)\.toUpperCase\(\)/.test(roh),
    "die Kachel im Bild nennt weiterhin nur den ersten Containertyp");
});
