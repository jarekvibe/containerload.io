// Gleiche Ware gehoert in denselben Container — und Gewicht darf nur entscheiden, wo es bindet.
//
// GEMELDET, mit Bild: 8 grosse Packstuecke (600×220×100 cm) und 22 Europaletten, 300 kg je
// Stueck. Das Ergebnis waren drei 40-Fuss-Container mit je einem Gemisch aus beidem, und
// niemand konnte sagen, warum. Der Nutzer sah sofort, was richtig gewesen waere: die acht
// grossen Stuecke in zwei 40-Fuesser, die 22 Paletten in einen 20-Fuesser.
//
// Dahinter lagen ZWEI unabhaengige Fehler:
//
//  1. Der Gewichtsausgleich hat die Ladung auf 10/10/10 Stueck umverteilt — bei 9 Tonnen
//     auf drei Containern mit je 26,6 t Zuladung. Elf Prozent. Wo Gewicht nichts
//     entscheidet, darf es auch nichts entscheiden.
//  2. Die gierige Kette legte in den ersten Container 22 Paletten UND 2 grosse Stuecke,
//     weil das dort die meisten Stuecke sind (24 statt 22). Die uebrigen 6 grossen Stuecke
//     brauchten danach zwei weitere 40-Fuesser — der letzte fuer ganze zwei Stueck.
//
// node --test test/kette-sortenrein.test.mjs
import fs from "node:fs";
import assert from "node:assert";
import test from "node:test";
import { fileURLToPath } from "node:url";
import path from "node:path";

const dir = path.dirname(fileURLToPath(import.meta.url));
const L = fs.readFileSync(path.join(dir, "..", "app.html"), "utf8").split("\n");
const cut = (von, bis) => {
  const s = L.findIndex((l) => l.includes(von));
  const e = L.findIndex((l, i) => i > s && bis(l, i));
  assert.ok(s >= 0 && e > s, `Ausschnitt nicht gefunden: ${von}`);
  return L.slice(s, e + 1).join("\n");
};
const { chainContainers, packCargo, PRESETS, ketteBesser, sortenReihenfolge, AUSGLEICH_AB, suggestContainer } = new Function(
  `var num=(v,d=0)=>Number.isFinite(+v)&&v!==""?+v:d;
   var applyCarrier=(p)=>p;
   var suggestEquipment=()=>null;
   ${cut("var PRESETS = {", (l) => l.includes("var panelsFor"))}
   ${cut("function makeFloorPacker", (l, i) => l.trim() === "}" && L[i - 1].includes("single: false"))}
   ${cut("var MAXCHAIN", (l, i) => l.trim() === "}" && L[i - 1].includes("return { chain, remainingBoxes"))}
   ${cut("function suggestContainer", (l, i) => l.trim() === "}" && L[i - 1].includes('return { type: "multi", combo };'))}
   return { chainContainers, packCargo, PRESETS, ketteBesser, sortenReihenfolge, AUSGLEICH_AB, suggestContainer };`
)();

const kette = (preset, cargo) => {
  const c0 = PRESETS[preset];
  const r0 = packCargo(c0, cargo, {}, false);
  return { r0, ch: chainContainers(c0, preset, cargo, r0, {}, 24) };
};
const sortenJe = (ch, cargo) => ch.chain.map((c) => {
  const je = {};
  c.placed.forEach((b) => { const n = cargo[b.ti].name; je[n] = (je[n] || 0) + 1; });
  return je;
});

// Die gemeldete Ladung.
const HLS = [
  { name: "Gross", l: 600, w: 220, h: 100, weight: 300, qty: 8, stackable: true, rotatable: true },
  { name: "Palette", l: 120, w: 80, h: 110, weight: 300, qty: 22, stackable: true, rotatable: true }
];

test("der gemeldete Fall: 2× 40 Fuss fuer die grossen Stuecke, 1× 20 Fuss fuer die Paletten", () => {
  const { ch } = kette("40' HC", HLS);
  const je = sortenJe(ch, HLS);
  assert.strictEqual(ch.remainingBoxes, 0, "es bleibt Ladung liegen");
  assert.strictEqual(ch.chain.length, 3, `${ch.chain.length} Container statt 3: ${JSON.stringify(je)}`);
  // Jeder Container traegt GENAU EINE Sorte — das war der Kern der Meldung.
  je.forEach((z, i) => assert.strictEqual(Object.keys(z).length, 1,
    `C${i + 1} traegt ${Object.keys(z).length} Sorten: ${JSON.stringify(z)}`));
  // Und die Aufteilung ist die, die der Nutzer von Hand gesehen hat.
  const gross = je.filter((z) => z.Gross).map((z) => z.Gross).sort();
  const pal = je.filter((z) => z.Palette).map((z) => z.Palette);
  assert.deepStrictEqual(gross, [4, 4], `grosse Stuecke: ${JSON.stringify(gross)}`);
  assert.deepStrictEqual(pal, [22], `Paletten: ${JSON.stringify(pal)}`);
  // Der dritte Container darf kleiner sein — genau darin liegt das Geld.
  const namen = ch.chain.map((c) => c.name);
  assert.ok(namen.some((n) => n.startsWith("20'")), `kein 20-Fuesser in der Kette: ${namen.join(" + ")}`);
});

test("die Kette bucht weniger Containervolumen als die gierige Variante", () => {
  // 3× 40 Fuss waeren 220 m³ Containervolumen, 2× 40' + 1× 20' sind 186. Dieselbe
  // Containerzahl, ein Drittel weniger Miete fuer den letzten.
  const { ch } = kette("40' HC", HLS);
  const vol = ch.chain.reduce((s, c) => s + c.preset.l * c.preset.w * c.preset.h / 1e6, 0);
  assert.ok(vol < 200, `${vol.toFixed(1)} m³ Containervolumen — das sind wieder drei 40-Fuesser`);
});

test("das Gewicht wird nicht umverteilt, wo es gar nicht bindet", () => {
  // 30 × 300 kg = 9 t auf drei Containern à 26,6 t. Wuerde der Ausgleich hier greifen,
  // stuenden wieder 10/10/10 Stueck gemischt in drei Containern.
  const { ch } = kette("40' HC", HLS);
  const anteile = ch.chain.map((c) => c.placed.reduce((s, b) => s + HLS[b.ti].weight, 0) / c.preset.payload);
  assert.ok(Math.max(...anteile) < AUSGLEICH_AB,
    `der Fall ist nicht mehr der gemeldete: hoechste Zuladung ${(Math.max(...anteile) * 100).toFixed(0)} %`);
  const stueck = ch.chain.map((c) => c.placed.length).sort((a, b) => a - b);
  assert.notDeepStrictEqual(stueck, [10, 10, 10], "das Gewicht hat die Aufteilung wieder platt gemacht");
});

test("die Schwelle steht auf einem Anteil, nicht auf einer Kilogramm-Zahl", () => {
  assert.ok(AUSGLEICH_AB > 0 && AUSGLEICH_AB < 1, `AUSGLEICH_AB = ${AUSGLEICH_AB}`);
  assert.ok(AUSGLEICH_AB >= 0.4, "unter 40 % Zuladung ist Gewicht nicht die Grenze");
});

test("bei schwerer Ladung gleicht die Kette weiterhin aus", () => {
  // Die Gegenprobe zum Waechter: hier IST das Gewicht die Grenze (99 % Zuladung im
  // ersten Container), und dann soll er weiter greifen. Sonst haette der Waechter die
  // vorherige Verbesserung gleich wieder abgeschaltet.
  const schwer = [
    { name: "A", l: 325, w: 218, h: 45, weight: 2100, qty: 29, stackable: true, stackH: 180, rotatable: true },
    { name: "B", l: 228, w: 110, h: 55, weight: 1000, qty: 8, stackable: true, stackH: 180, rotatable: true }
  ];
  const { ch } = kette("40' HC", schwer);
  assert.strictEqual(ch.remainingBoxes, 0);
  const kg = ch.chain.map((c) => c.placed.reduce((s, b) => s + schwer[b.ti].weight, 0));
  const spanne = Math.max(...kg) - Math.min(...kg);
  const gesamt = kg.reduce((a, b) => a + b, 0);
  assert.ok(spanne < gesamt * 0.15,
    `Spanne ${Math.round(spanne)} kg bei ${Math.round(gesamt)} kg gesamt — der Ausgleich greift nicht mehr (${kg.map(Math.round).join(" / ")})`);
});

test("sortenrein kostet nie einen Container und laesst nie Ladung liegen", () => {
  // Die entscheidende Invariante. Die zweite Kette wird nur uebernommen, wenn sie nach
  // ketteBesser gewinnt — und dort steht "was liegenbleibt" vor "Zahl der Container" vor
  // allem anderen. Hier wird gegengerechnet, dass das auch wirklich haelt.
  let seed = 20260822;
  const rnd = () => ((seed = (seed * 1103515245 + 12345) & 2147483647) / 2147483647);
  const ri = (a, b) => a + Math.floor(rnd() * (b - a + 1));
  const NAMEN = ["20' GP", "20' HC", "40' GP", "40' HC", "45' HC"];
  let mehrfachSorten = 0, faelle = 0;
  for (let i = 0; i < 40; i++) {
    const cargo = [];
    for (let t = 0, n = ri(2, 4); t < n; t++) cargo.push({
      name: "T" + t, l: ri(50, 620), w: ri(50, 235), h: ri(40, 200), weight: ri(50, 900),
      qty: ri(2, 20), stackable: rnd() < 0.85, rotatable: rnd() < 0.85
    });
    const preset = NAMEN[ri(0, 4)];
    const { ch } = kette(preset, cargo);
    faelle++;
    const drin = ch.chain.reduce((s, c) => s + c.placed.length, 0);
    const gesamt = cargo.reduce((s, t) => s + t.qty, 0);
    assert.strictEqual(drin + ch.remainingBoxes, gesamt,
      `Fall ${i} (${preset}): ${drin} verladen + ${ch.remainingBoxes} offen ≠ ${gesamt} eingegeben`);
    for (const c of ch.chain) {
      const kg = c.placed.reduce((s, b) => s + cargo[b.ti].weight, 0);
      assert.ok(kg <= c.preset.payload + 0.5, `Fall ${i}: ${Math.round(kg)} kg auf ${c.preset.payload} kg Zuladung`);
    }
    if (ch.chain.some((c) => new Set(c.placed.map((b) => b.ti)).size > 1)) mehrfachSorten++;
  }
  assert.ok(faelle >= 40);
  // Gemischte Container sind ausdruecklich erlaubt — sortenrein ist eine Praeferenz beim
  // Gleichstand, keine Regel. Waere hier nie ein gemischter Container dabei, wuerde die
  // Kette Ladung verschenken.
  assert.ok(mehrfachSorten > 0, "kein einziger gemischter Container — sortenrein wurde zur Regel statt zur Praeferenz");
});

test("ketteBesser entscheidet in der richtigen Reihenfolge", () => {
  const k = (totRem, n, vol, sorten) => ({
    totRem, chain: Array.from({ length: n }, (_, i) => ({
      preset: { l: vol / n, w: 1e4, h: 1e2 },
      placed: Array.from({ length: sorten }, (_, j) => ({ ti: j }))
    }))
  });
  // 1. Liegengebliebenes schlaegt alles.
  assert.ok(ketteBesser(k(0, 5, 500, 3), k(2, 2, 100, 1)));
  // 2. Bei gleichem Rest gewinnt die kuerzere Kette.
  assert.ok(ketteBesser(k(0, 2, 900, 4), k(0, 3, 100, 1)));
  // 3. Bei gleicher Laenge das kleinere Containervolumen.
  assert.ok(ketteBesser(k(0, 3, 100, 4), k(0, 3, 200, 1)));
  // 4. Erst danach die Sortenstreuung.
  assert.ok(ketteBesser(k(0, 3, 100, 1), k(0, 3, 100, 2)));
  // Gleichstand ist keine Verbesserung — sonst wuerde ohne Gewinn umgebaut.
  assert.ok(!ketteBesser(k(0, 3, 100, 2), k(0, 3, 100, 2)));
});

test("die Sortenreihenfolge nimmt das groesste Stueck zuerst", () => {
  const rest = [
    { l: 100, w: 100, h: 100, qty: 5 },   // 1,0 m³
    { l: 200, w: 200, h: 100, qty: 2 },   // 4,0 m³
    { l: 50, w: 50, h: 50, qty: 9 },      // 0,125 m³
    { l: 300, w: 200, h: 100, qty: 0 }    // leer -> faellt raus
  ];
  assert.deepStrictEqual(sortenReihenfolge(rest), [1, 0, 2]);
});

test("die Empfehlung nennt dieselbe Kombination, die die Kette baut", () => {
  // Das Banner ueber der 3D-Ansicht rechnet unabhaengig von der Kette -- und hatte denselben
  // Greedy-Fehler. Es empfahl "2x 40' HC + 1x 40' GP", waehrend die Kette darunter einen
  // 20-Fuesser buchte. Zwei widerspruechliche Zahlen nebeneinander sind schlimmer als eine
  // ungenaue: der Nutzer weiss dann nicht mehr, welcher er glauben soll.
  const e = suggestContainer(HLS);
  assert.strictEqual(e.type, "multi", `Empfehlung ist ${e.type}`);
  const alsText = e.combo.map((c) => `${c.count}x ${c.name}`).join(" + ");
  assert.strictEqual(e.combo.reduce((s, c) => s + c.count, 0), 3, `Empfehlung: ${alsText}`);
  assert.ok(e.combo.some((c) => c.name.startsWith("20'")), `kein 20-Fuesser in der Empfehlung: ${alsText}`);

  // Und der Abgleich mit der Kette: dieselbe Zahl Container, dasselbe Containervolumen.
  const { ch } = kette("40' HC", HLS);
  const volEmpf = e.combo.reduce((s, c) => s + c.count * PRESETS[c.name].l * PRESETS[c.name].w * PRESETS[c.name].h, 0);
  const volKette = ch.chain.reduce((s, c) => s + c.preset.l * c.preset.w * c.preset.h, 0);
  assert.strictEqual(ch.chain.length, e.combo.reduce((s, c) => s + c.count, 0),
    `Kette ${ch.chain.length} Container, Empfehlung ${alsText}`);
  assert.strictEqual(volKette, volEmpf, `Kette und Empfehlung buchen verschieden viel Containervolumen`);
});
