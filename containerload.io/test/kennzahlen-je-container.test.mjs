// Volumen und Gewicht JE CONTAINER.
//
// Die Leiste nennt immer nur C1 (sie sagt es auch dazu), das Bild nennt die Summe. Was
// dazwischen fehlte, war die Frage, die beim Buchen zaehlt: "wie voll ist eigentlich der
// zweite?" Jeder Container hat seine eigene Zuladung und wird einzeln gestellt.
//
// Die Tabelle steht in der Details-Schublade und rechnet aus derselben Quelle wie das Bild:
// den placed-Listen der Kette. Dieser Test haelt fest, dass die Summen zusammenpassen —
// eine Tabelle, die etwas anderes sagt als die Leiste darueber, waere schlimmer als keine.
//
// node --test test/kennzahlen-je-container.test.mjs
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

const G1 = [[49, 2220], [47, 2180], [47, 2180], [46, 2090], [45, 2030], [45, 2030], [45, 1915],
  [45, 1915], [42, 1795], [42, 1805], [45, 2173], [45, 2195], [45, 2175], [45, 2201], [45, 2199],
  [43, 1896], [43, 1919], [43, 1943], [47, 2295], [47, 2235], [47, 1942], [47, 2290], [46, 2150],
  [43, 1949], [45, 1940], [45, 2090], [45, 2085], [45, 2085], [44, 1885]];
const G2 = [[55, 1020], [55, 1020], [55, 1020], [55, 1025], [55, 1025], [55, 1025], [51, 915], [51, 915]];
const cargo = [
  ...G1.map(([h, kg], i) => ({ name: "G1-" + i, l: 325, w: 218, h, weight: kg, qty: 1, stackable: true, stackH: 180, rotatable: true })),
  ...G2.map(([h, kg], i) => ({ name: "G2-" + i, l: 228, w: 110, h, weight: kg, qty: 1, stackable: true, stackH: 180, rotatable: true }))
];

// Dieselbe Rechnung wie in der Oberflaeche (slotRows).
const jeContainer = (chain) => chain.map((c2) => {
  const cp = c2.preset || {};
  let vol = 0, kg = 0;
  (c2.placed || []).forEach((b) => {
    vol += b.dx * b.dy * b.dz / 1e6;
    const it = cargo[b.ti];
    if (it) kg += Math.max(0, it.weight);
  });
  return { stueck: (c2.placed || []).length, vol, kg, pay: +cp.payload || 0,
           cVol: (+cp.l) * (+cp.w) * (+cp.h) / 1e6 };
});
const ketteVon = (preset) => {
  const c0 = PRESETS[preset];
  const r0 = packCargo(c0, cargo, {}, false);
  return chainContainers(c0, preset, cargo, r0, {}, 24);
};

test("die Zeilen summieren sich auf die Gesamtladung", () => {
  const ch = ketteVon("40' HC");
  const zeilen = jeContainer(ch.chain);
  const stueck = zeilen.reduce((s, z) => s + z.stueck, 0);
  const kg = Math.round(zeilen.reduce((s, z) => s + z.kg, 0));
  const gesamtKg = cargo.reduce((s, c) => s + c.weight * c.qty, 0);
  assert.strictEqual(stueck, 37, `Summe der Zeilen: ${stueck} statt 37`);
  assert.strictEqual(kg, gesamtKg, `Summe der Gewichte: ${kg} statt ${gesamtKg}`);
  // Die Zahl aus der Anfrage — sie steht so in der Tabelle des Kunden.
  assert.strictEqual(gesamtKg, 67772);
});

test("kein Container traegt mehr, als er darf", () => {
  for (const preset of ["20' GP", "40' GP", "40' HC", "45' HC"]) {
    for (const z of jeContainer(ketteVon(preset).chain)) {
      if (z.pay > 0) assert.ok(z.kg <= z.pay + 0.5, `${preset}: ${Math.round(z.kg)} kg auf ${z.pay} kg Zuladung`);
    }
  }
});

test("kein Container ist voller als er gross ist", () => {
  for (const z of jeContainer(ketteVon("40' HC").chain)) {
    assert.ok(z.vol <= z.cVol + 1e-6, `${z.vol.toFixed(1)} m3 in einem Container mit ${z.cVol.toFixed(1)} m3`);
  }
});

test("die erste Zeile ist genau das, was die Leiste als C1 zeigt", () => {
  // Sonst stuenden zwei verschiedene Zahlen fuer denselben Container uebereinander.
  //
  // Seit dem Gewichtsausgleich ist der erste Container NICHT mehr der, den packCargo allein
  // gerechnet hat -- er gibt Gewicht an die folgenden ab. Genau deshalb liefert die Kette
  // slot0 zurueck, und genau deshalb uebernimmt die Oberflaeche es in r (siehe den Effekt in
  // app.html). Der Test macht denselben Schritt: ohne ihn zeigt die Leiste 17 Stueck und die
  // Tabelle darunter 15.
  for (const preset of ["40' HC", "20' GP", "45' HC"]) {
    const c0 = PRESETS[preset];
    const r0 = packCargo(c0, cargo, {}, false);
    const ch = chainContainers(c0, preset, cargo, r0, {}, 24);
    const leiste = ch.slot0 || r0;
    const z0 = jeContainer(ch.chain)[0];
    assert.strictEqual(z0.stueck, leiste.boxes, `${preset}: Tabelle ${z0.stueck} vs. Leiste ${leiste.boxes}`);
    assert.ok(Math.abs(z0.vol - leiste.usedVol) < 1e-6, `${preset}: Volumen ${z0.vol} vs. ${leiste.usedVol}`);
    assert.ok(Math.abs(z0.kg - leiste.weight) < 0.5, `${preset}: Gewicht ${z0.kg} vs. ${leiste.weight}`);
  }
});

test("die Oberflaeche uebernimmt slot0 auch wirklich", () => {
  // Die Kette kann den ersten Container neu packen -- wenn der Effekt das Ergebnis nicht in r
  // uebernimmt, merkt es niemand ausser dem Kunden, der zwei Zahlen sieht.
  const eff = roh.slice(roh.indexOf("r.perTypeAll = ch.perType;"));
  const block = eff.slice(0, eff.indexOf("setResult(r)"));
  assert.ok(/if \(ch\.slot0\)/.test(block), "der Effekt fragt ch.slot0 gar nicht ab");
  for (const feld of ["placed", "perType", "usedVol", "util", "weight", "boxes", "layers"]) {
    assert.ok(block.includes(`r.${feld} = ch.slot0.${feld}`), `r.${feld} wird beim Ausgleich nicht mitgezogen`);
  }
});

// ── Was die Oberflaeche daraus macht ────────────────────────────────────────
test("die Tabelle steht in der Schublade und nur bei mehr als einem Container", () => {
  assert.ok(/const slotRows = \(result\.chain \|\| \[\]\)\.map\(/.test(roh), "slotRows fehlt");
  assert.ok(/slotRows\.length > 1 && \/\* @__PURE__ \*\/ React\.createElement\("div", null,/.test(roh),
    "die Tabelle darf bei einem einzelnen Container nicht erscheinen - da sagt es die Leiste schon");
  assert.ok(/domain === "road" \? T\.slotsTitleRoad : T\.slotsTitle/.test(roh));
  for (const k of ["slotsTitle", "slotsTitleRoad", "slotsEmpty"]) {
    const n = (roh.match(new RegExp(`[{,]\\s*${k}:`, "g")) || []).length;
    assert.strictEqual(n, 2, `${k} steht ${n}x in den Woerterbuechern, erwartet 2 (DE und EN)`);
  }
});

test('"Voll" meint dasselbe wie in der Leiste - auf der Strasse Lademeter', () => {
  assert.ok(/vollPct: domain === "road"\s*\n\s*\? \(ldmT > 0 \? ldmB \/ ldmT \* 100 : 0\)\s*\n\s*: \(cVol > 0 \? vol \/ cVol \* 100 : 0\)/.test(roh),
    "die Spalte 'Voll' zeigt auf der Strasse wieder Volumen statt Lademeter");
});

test("die Schublade schneidet nicht mehr still ab", () => {
  // Mit der Tabelle passt der Inhalt nicht mehr in die alten 360 px. Abgeschnitten wurde
  // ausgerechnet die Gewichtsverteilung ganz unten - ohne jede Andeutung, dass da noch
  // etwas ist. Scrollen ist ehrlich, Schlucken nicht.
  assert.ok(/maxHeight: cogOpen \? "min\(460px, 50vh\)" : "0px", overflowX: "hidden", overflowY: cogOpen \? "auto" : "hidden"/.test(roh),
    "die Details-Schublade hat wieder eine feste Hoehe ohne Scrollen");
});
