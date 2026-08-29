// Der manuelle Modus je Container.
//
// Schritt 06 und der letzte aus dem Mehr-Container-Entwurf: "Faellt danach fast von selbst
// ab: der Fokus sagt, welcher Container, die Vorbelegung traegt die gesetzten Kisten."
//
// Bis dahin war der manuelle Modus ein eigener Zustand OHNE Kette: er klappte die Ansicht
// auf einen Container zusammen, die Leiste zeigte daneben weiter die Zahlen des Automaten,
// und Ladevorschlag, CSV und Bildexport waren gesperrt. Jetzt stellt er selbst Container,
// jede gesetzte Kiste traegt ihren slot, und alles Uebrige liest aus derselben Quelle wie
// sonst -- weil result im manuellen Modus die von Hand gestaute Kette IST.
//
// Zwei Zusagen tragen das:
//   1. Setzen, drehen, schieben und loeschen spielen sich IM Slot ab. Eine Kiste in C2 darf
//      nicht auf einer Palette in C1 stehen -- die beiden stehen im Bild nebeneinander, in
//      der Rechnung aber im selben Koordinatensystem.
//   2. Die Mengengrenze gilt ueber ALLE Container. remapPlaced sieht immer nur einen; ohne
//      einen zweiten Durchgang stuenden 22 Paletten in C1 UND 22 in C2.
//
// node --test test/manueller-modus-je-container.test.mjs
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
const M = new Function(`var num=(v,d=0)=>Number.isFinite(+v)&&v!==""?+v:d;
   var applyCarrier=(p)=>p;
   ${cut("var PRESETS = {", (l) => l.includes("var panelsFor"))}
   ${cut("function makeFloorPacker", (l, i) => l.trim() === "}" && L[i - 1].includes("single: false"))}
   ${cut("var MAXCHAIN", (l, i) => l.trim() === "}" && L[i - 1].includes("return { chain, remainingBoxes"))}
   return { manuellBilanz, mengenGrenze, packCargo, chainContainers, PRESETS, MAXCHAIN };`)();

const HC40 = M.PRESETS["40' HC"];
const GP20 = M.PRESETS["20' GP"];
const CARGO = [
  { name: "Flach", l: 250, w: 80, h: 30, qty: 9, weight: 300, stackable: false },
  { name: "Palette", l: 120, w: 80, h: 110, qty: 22, weight: 300, stackMax: 3 },
];
// Eine von Hand gestaute Kette nachstellen: die Auto-Kette uebernehmen, wie es
// "Auto-Ergebnis uebernehmen" tut -- jede Kiste mit dem slot ihres Containers.
const vonHand = (cargo, presets) => {
  const c0 = M.PRESETS[presets[0]];
  const slot0 = M.packCargo(c0, cargo, { noHint: true });
  const ch = M.chainContainers(c0, presets[0], cargo, slot0, null, M.MAXCHAIN, null);
  const placed = [];
  ch.chain.forEach((c, i) => (c.placed || []).forEach((p) => placed.push({ ...p, slot: i })));
  const chain = ch.chain.map((c) => ({ name: c.name, preset: c.preset }));
  return { basis: slot0, chain, placed, auto: ch };
};

test("die Bilanz zaehlt, was steht -- nicht was der Packer vorschlaegt", () => {
  const { basis, chain, placed, auto } = vonHand(CARGO, ["40' HC"]);
  const r = M.manuellBilanz(basis, chain, placed, CARGO);
  assert.strictEqual(r.chain.length, chain.length, "jeder Container kommt in die Kette");
  // 1) Nichts geht verloren, nichts zaehlt zweimal.
  const summe = r.chain.reduce((s, c) => s + c.placed.length, 0);
  assert.strictEqual(summe, placed.length);
  assert.strictEqual(r.boxes + r.chain.slice(1).reduce((s, c) => s + c.placed.length, 0), placed.length,
    "boxes meint den ERSTEN Container, nicht den ganzen Plan");
  // 2) Die Bilanz je Sorte gilt fuer den ganzen Plan und stimmt mit der Auto-Kette ueberein.
  r.perTypeAll.forEach((pt, i) => {
    assert.strictEqual(pt.loaded, auto.perType[i].loaded, `Sorte ${i}`);
    assert.strictEqual(pt.total, Math.floor(CARGO[i].qty));
  });
  assert.strictEqual(r.remainingBoxes, auto.remainingBoxes);
  // 3) Volumen und Gewicht meinen den ersten Container.
  const c1 = placed.filter((b) => b.slot === 0);
  assert.ok(Math.abs(r.usedVol - c1.reduce((s, b) => s + b.dx * b.dy * b.dz / 1e6, 0)) < 1e-9);
  assert.strictEqual(r.weight, c1.length * 300);
});

test("was noch nicht steht, ist offen -- und die Kette ist weder gekappt noch gepinnt", () => {
  const { basis, chain } = vonHand(CARGO, ["40' HC"]);
  const leer = M.manuellBilanz(basis, chain, [], CARGO);
  assert.strictEqual(leer.boxes, 0);
  assert.strictEqual(leer.remainingBoxes, 31, "ohne eine einzige gesetzte Kiste ist alles offen");
  // Von Hand gestaut gibt es keine gekappte Kette und keine Zuweisung: wie viele Container
  // es gibt, hat der Mensch davor entschieden.
  assert.strictEqual(leer.gekappt, false);
  assert.strictEqual(leer.pinOffen, 0);
  // Und was am Container und an der Ladung haengt, bleibt aus dem Auto-Ergebnis stehen.
  assert.strictEqual(leer.totalBoxes, basis.totalBoxes);
  assert.strictEqual(leer.contVol, basis.contVol);
});

test("die Mengengrenze gilt ueber ALLE Container, nicht je Container", () => {
  // Zwei Container, in jedem 22 Paletten -- eingegeben sind 22. remapPlaced sieht immer nur
  // einen Container und laesst beide durch; erst mengenGrenze schneidet den Ueberhang ab.
  const doppelt = [];
  for (let s = 0; s < 2; s++) for (let i = 0; i < 22; i++) doppelt.push({ ti: 1, slot: s, x: 0, y: 0, z: 0, dx: 120, dy: 110, dz: 80 });
  const ok = M.mengenGrenze(doppelt, CARGO);
  assert.strictEqual(ok.length, 22, "es duerfen nur so viele bleiben, wie eingegeben sind");
  assert.ok(ok.every((b) => b.slot === 0), "was zuerst gesetzt wurde, bleibt stehen");
  // Und was in die Menge passt, kommt UNVERAENDERT zurueck (dieselbe Referenz, kein Re-Render).
  const knapp = doppelt.slice(0, 22);
  assert.strictEqual(M.mengenGrenze(knapp, CARGO), knapp);
});

// ── Der Vertrag im Quelltext ────────────────────────────────────────────────────────
test("die Kette wird im manuellen Modus nicht mehr zusammengeklappt", () => {
  assert.ok(!/if \(manualMode\) chain = \[\{ name: preset, preset: container, placed: \[\] \}\];/.test(roh),
    "der manuelle Modus klappt die Ansicht wieder auf EINEN Container zusammen");
  assert.ok(/if \(manualMode\) chain = chain\.map\(\(c\) => \(\{ \.\.\.c, placed: \[\] \}\)\);/.test(roh),
    "die Reihe muss stehenbleiben -- nur ohne Auto-Kisten, die werden einzeln gezeichnet");
  assert.ok(/const cgSlots = \[\];/.test(roh) && /cgSlots\[ci\] = cg;/.test(roh),
    "es gibt keine Gruppe je Slot mehr -- dann landen alle Kisten in C1");
  assert.ok(/const cgS = cgSlots\[Math\.min\(Math\.max\(0, \+b\.slot \|\| 0\), cgSlots\.length - 1\)\];/.test(roh),
    "die gesetzten Kisten haengen nicht in der Gruppe ihres eigenen Containers");
});

test("welcher Container gemeint ist, entscheidet der Klick", () => {
  const m = roh.match(/const manualFloorHit = \(e\) => \{[\s\S]{0,2000}?\n      \};/);
  assert.ok(m, "manualFloorHit fehlt");
  const f = m[0];
  assert.ok(/t\.frame\.slots/.test(f), "der Treffer wird nicht gegen die vorgerechneten Slot-Rahmen geprueft");
  assert.ok(/return \{ slot,/.test(f), "manualFloorHit liefert keinen Slot zurueck");
  // Erst der Container, in dem der Treffer WIRKLICH liegt, und nur dann der Rand. Sonst
  // schnappt der Rand des einen Containers dem anderen den Klick weg.
  assert.ok(/treffer\(0\)[\s\S]{0,80}?if \(slot < 0\) slot = treffer\(0\.8\);/.test(f),
    "der Rand wird nicht erst im zweiten Durchgang befragt");
  // Und die Koordinaten kommen lokal zurueck -- dort rechnet der Packer.
  assert.ok(/\(xM - \(slots\[slot\]\.cx - slots\[slot\]\.hx\)\) \* 100/.test(f),
    "der Treffer wird nicht in die lokalen Koordinaten seines Containers zurueckgerechnet");
});

test("ein unsichtbarer Ghost hinterlaesst keinen Kandidaten", () => {
  // Sonst setzt ein Klick neben die Reihe die Kiste dorthin, wo der Zeiger zuletzt GUELTIG
  // stand. Mit einem Container fiel das kaum auf, mit mehreren landet sie im falschen.
  assert.ok(/const ghostWeg = \(t\) => \{[\s\S]{0,200}?t\.ghostCandidate = null;/.test(roh),
    "es gibt keinen gemeinsamen Weg, den Ghost samt Kandidat wegzunehmen");
  const m = roh.match(/const updateGhost = \(e\) => \{[\s\S]{0,900}?const hit = manualFloorHit\(e\);\s*\n\s*if \(!hit\) \{\s*\n\s*([a-zA-Z]+)\(t\);/);
  assert.ok(m && m[1] === "ghostWeg", "ohne Treffer bleibt der alte Kandidat stehen");
  assert.ok(!/if \(!hit\) \{\s*\n\s*t\.ghost\.visible = false;\s*\n\s*return;/.test(roh),
    "der Ghost wird nur unsichtbar gemacht, der Kandidat bleibt");
});

test("gesetzt, gedreht, geschoben und geloescht wird IM Slot", () => {
  assert.ok(/const nachbarn = p\.manualPlaced\.filter\(\(b\) => \(\+b\.slot \|\| 0\) === sl\);/.test(roh),
    "der Ghost rechnet gegen alle Kisten statt gegen die seines Containers");
  assert.ok(/const res = manualCandidate\(cont, item, p\.manualRot, originX, originZ, nachbarn, weightUsed, p\.cargo\);/.test(roh),
    "der Kandidat wird nicht gegen den Container seines Slots geprueft");
  const m = roh.match(/const manualUmsetzen = \([\s\S]{0,900}?\n    \};/);
  assert.ok(m, "manualUmsetzen fehlt -- Drehen und Schieben teilen sich einen Weg");
  assert.ok(/manualChain\[sl\]\.preset/.test(m[0]), "Drehen/Schieben prueft nicht gegen den Container des Slots");
  assert.ok(/manualPush\(settleSlots\(next\)\)/.test(m[0]), "das Nachsacken laeuft nicht je Slot");
  // settlePlaced sackt Kisten auf ihre Auflage nach -- ueber Containergrenzen hinweg waere
  // das eine Kiste in C2, die auf einer Palette in C1 landet.
  assert.ok(/const gesetzt = settlePlaced\(manualChain\[i\]\.preset, idx\.map\(\(k\) => liste\[k\]\), cargo\);/.test(roh),
    "settleSlots sackt nicht je Container nach");
});

test("der Automat macht auf dem weiter, was von Hand steht", () => {
  const m = roh.match(/const manualAutoFill = \(\) => \{[\s\S]{0,1400}?\n    \};/);
  assert.ok(m, "manualAutoFill fehlt");
  const f = m[0];
  assert.ok(/packCargo\(manualChain\[i\]\.preset, rest, \{ noHint: true, vorbelegt: vor \}\)/.test(f),
    "der Fuellauf faengt bei null an, statt auf der Vorbelegung weiterzumachen (Schritt 04)");
  assert.ok(/const vor = imSlot\(i\)\.concat\(dazu\.filter\(\(b\) => b\.slot === i\)\)/.test(f),
    "die Vorbelegung enthaelt nicht, was dieser Lauf selbst schon dazugelegt hat");
  assert.ok(/rest = rest\.map\(\(t, k\) => \(\{ \.\.\.t, qty: t\.qty - \(r\.perType\[k\] \? r\.perType\[k\]\.loaded : 0\) \}\)\)/.test(f),
    "der Rest wird zwischen den Containern nicht fortgeschrieben -- dann steht dieselbe Ware zweimal");
});

test("die Oberflaeche liest im manuellen Modus dieselbe Quelle wie sonst", () => {
  assert.ok(/const \[rohResult, setResult\] = useState/.test(roh),
    "das Auto-Ergebnis heisst nicht mehr rohResult");
  assert.ok(/const result = manuellRes \|\| rohResult;/.test(roh),
    "result ist im manuellen Modus nicht die von Hand gestaute Kette");
  assert.ok(/manualMode && rohResult \? manuellBilanz\(rohResult, manualChain, manualPlaced, cargo\) : null/.test(roh),
    "manuellRes entsteht nicht aus der Bilanz");
  // Und damit fallen die Sonderwege weg: Bild, Kacheln und Blatt lesen ohne Fallunterscheidung.
  for (const muster of [
    /const slotsImBild = \(slotRows \|\| \[\]\)\.slice\(0, 8\);/,
    /const blatt = exportLayout === "blatt" && slotsImBild\.length > 1;/,
    /const doorPlaced = sichtPlaced;/,
  ]) assert.ok(muster.test(roh), `Sonderweg fuer den manuellen Modus steht wieder da: ${muster}`);
  // Ladevorschlag und CSV sind nicht mehr gesperrt -- sie lesen result, und das stimmt jetzt.
  assert.ok(/\{ label: T\.exportBtn, sub: T\.exportTitle, fn: doExportCSV \}/.test(roh),
    "die CSV ist im manuellen Modus wieder gesperrt");
  assert.ok(/\{ label: T\.pdfBtn, sub: T\.pdfTitle, fn: buildLadevorschlag \}/.test(roh),
    "der Ladevorschlag ist im manuellen Modus wieder gesperrt");
});

test("Container hinzunehmen und wegnehmen -- und die Texte in beiden Sprachen", () => {
  assert.ok(/const manualAddSlot = \(\) => setManualSlots\(\(n\) => Math\.min\(MAXDRAW, n \+ 1\)\);/.test(roh),
    "die Zahl der Container ist nicht auf MAXDRAW gedeckelt -- gezeichnet werden ohnehin nur acht");
  const m = roh.match(/const manualDropSlot = \(\) => \{[\s\S]{0,400}?\n    \};/);
  assert.ok(m, "manualDropSlot fehlt");
  assert.ok(/if \(manualSlots <= 1 \|\| imSlot\(manualSlots - 1\)\.length\) return;/.test(m[0]),
    "ein Container mit Ladung darf nicht weggenommen werden -- das loeschte gesetzte Kisten");
  for (const k of ["manualFill", "manualFillTitle", "manualFillNone", "manualAddSlot", "manualDropSlot", "manualDropTitle", "manualSlotsLbl", "manualSlotHint"]) {
    const n = (roh.match(new RegExp(`[{,\\n]\\s*${k}:`, "g")) || []).length;
    assert.strictEqual(n, 2, `${k} steht ${n}x in den Woerterbuechern, erwartet 2 (DE und EN)`);
  }
});

test("beim Einschalten stehen so viele Container da, wie der Automat vorschlaegt", () => {
  assert.ok(/if \(!manualMode\) setManualSlots\(Math\.max\(1, Math\.min\(MAXDRAW, \(rohResult && rohResult\.chain && rohResult\.chain\.length\) \|\| 1\)\)\);/.test(roh),
    "der manuelle Modus faengt bei einem Container an, obwohl der Rechner gerade mehrere nennt");
  // "Auto-Ergebnis uebernehmen" holt die GANZE Kette, nicht nur den ersten Container.
  const m = roh.match(/const manualLoadAuto = \(\) => \{[\s\S]{0,800}?\n    \};/);
  assert.ok(m, "manualLoadAuto fehlt");
  assert.ok(/ch\.forEach\(\(c, i\) => \(c\.placed \|\| \[\]\)\.forEach/.test(m[0]),
    "es wird nur der erste Container uebernommen -- der Rest verschwaende");
  assert.ok(/setManualSlots\(Math\.max\(1, ch\.length\)\)/.test(m[0]),
    "die Zahl der Container waechst nicht mit der uebernommenen Kette mit");
});
