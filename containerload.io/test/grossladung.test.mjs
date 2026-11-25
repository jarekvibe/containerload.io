// Grosse Ladungen: schnell, und Kiste fuer Kiste dasselbe Ergebnis.
//
// Gemeldet am 23.11.26 aus der Nutzungsstatistik (Vietnam): 6 Positionen, 2.169 Packstuecke,
// und der Rechner stand rund 40 Sekunden. Nachgemessen ausserhalb des Browsers: 31 s reine
// Rechenzeit fuer Kette und Empfehlung, davon der Loewenanteil in der Auflage-Pruefung
// (8 Millionen Aufrufe, jeder ueber alle ~900 Kisten eines Containers).
//
// Seitdem vier Abkuerzungen, die alle dieselbe Zusage tragen -- das ERGEBNIS aendert sich
// nicht, nur die Zeit:
//   1. Ebenen-Verzeichnis in emsPackOnce: Auflage wird nur bei den Kisten der passenden
//      Oberkante gesucht, nicht bei allen.
//   2. Merker fuer Stuecke, die nicht passen: gleiche Ware wird nicht tausendmal neu gesucht.
//   3. Wertung zuerst: eine Stelle, die die bisher beste nicht schlagen kann, wird nicht geprueft.
//   4. passtAlles/sicherZuViel: was nach Volumen oder Gewicht sicher nicht in EINEN Container
//      geht, wird fuer die Frage "passt alles?" gar nicht erst gepackt.
//
// Dieser Test baut die ALTE Fassung aus derselben Datei (alle vier Abkuerzungen per
// Textersatz abgeschaltet) und vergleicht beide: jede Kiste, jede Kette, jede Empfehlung.
// Dazu der gemeldete Fall selbst, mit einer Arbeits-Obergrenze statt einer Stoppuhr.
//
// node --test test/grossladung.test.mjs
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
const QUELLE = `var num=(v,d=0)=>Number.isFinite(+v)&&v!==""?+v:d;
   var applyCarrier=(p)=>p;
   var suggestEquipment=()=>null;
   var __w = { auflage: 0, liste: 0, cargo: 0 };
   ${cut("var PRESETS = {", (l) => l.includes("var panelsFor"))}
   ${cut("function makeFloorPacker", (l, i) => l.trim() === "}" && L[i - 1].includes("single: false"))}
   ${cut("var MAXCHAIN", (l, i) => l.trim() === "}" && L[i - 1].includes("return { chain, remainingBoxes"))}
   ${cut("function suggestContainer", (l, i) => l.trim() === "}" && L[i - 1].includes('return { type: "multi", combo };'))}
   return { chainContainers, packCargo, PRESETS, suggestContainer, passtAlles, sicherZuViel, emsPackOnce, __w };`;
// Zaehler: wie oft die Auflage geprueft wird, ueber wie viele Kisten, und wie viele Packlaeufe
const ersetze = (s, alt, neu) => {
  assert.strictEqual(s.split(alt).length - 1, 1, `genau einmal erwartet: ${alt.slice(0, 70)}`);
  return s.replace(alt, () => neu);
};
const mitZaehlern = (s) => ersetze(ersetze(s,
  "function supportOk(px, pz, dx, dz, py, placed) {", "function supportOk(px, pz, dx, dz, py, placed) { __w.auflage++; __w.liste += placed.length;"),
  "function packCargo(Ct, types, opts = {}) {", "function packCargo(Ct, types, opts = {}) { __w.cargo++;");
// Die alte Fassung: jede Abkuerzung einzeln abgeschaltet -- faellt eine Zeile weg oder aendert
// sich, schlaegt `ersetze` an, statt dass der Vergleich still gegen sich selbst laeuft.
const ALT = [
  ["ebListe = ebeneBei(py);", "ebListe = placed;"],
  ["if (nie.has(u) || vorerst.has(u)) continue;", ""],
  ["if (best && !(score < best.score)) continue;", ""],
  ["if (soll >= alle && sicherZuViel(Ct, types)) return false;", ""]
];
const NEU = new Function(mitZaehlern(QUELLE))();
const ALTE = new Function(ALT.reduce((s, [a, b]) => ersetze(s, a, b), mitZaehlern(QUELLE)))();

let seed = 20261123;
const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
const ganz = (a, b) => a + Math.floor(rnd() * (b - a + 1));
const pick = (a) => a[Math.floor(rnd() * a.length)];
const CONT = ["20' GP", "20' HC", "40' GP", "40' HC", "45' HC"];
// Ladungen mit allem, was die Regeln beruehrt: krumme Masse (Gleitkomma!), Stapelverbot,
// Lagen- und Hoehengrenzen, nicht drehbar, schwere Ware gegen die Zuladung.
const ladung = (sorten, mengeMax, klein) => Array.from({ length: sorten }, (_, i) => {
  const krumm = rnd() < 0.35;
  const m = (a, b) => krumm ? Math.round((a + rnd() * (b - a)) * 10) / 10 : ganz(a, b);
  const st = rnd();
  return {
    name: "P" + (i + 1), qty: ganz(1, mengeMax),
    l: klein ? m(20, 70) : m(30, 240), w: klein ? m(15, 50) : m(30, 120), h: klein ? m(10, 40) : m(15, 130),
    weight: rnd() < 0.15 ? ganz(800, 2500) : m(2, 400),
    stackable: st > 0.15, stackMax: st > 0.75 ? ganz(2, 4) : Infinity,
    stackH: rnd() < 0.12 ? ganz(120, 220) : undefined,
    rotatable: rnd() > 0.2
  };
});
const kiste = (p) => [p.ti, p.x, p.y, p.z, p.dx, p.dy, p.dz, p.pos, p.lim, p.hlim].join(",");
const abdruck = (r) => r.placed.map(kiste).join(";") + `|${r.boxes}|${r.weight}|${r.usedVol}|${r.layers}|${JSON.stringify(r.perType)}`;

test("packCargo: jede Kiste steht, wo sie vorher stand (auch quick, ordentlich, mit Vorbelegung)", () => {
  let faelle = 0, gestapelt = 0;
  for (let i = 0; i < 40; i++) {
    const C = NEU.PRESETS[pick(CONT)];
    const T = ladung(ganz(2, 6), i % 8 === 0 ? 110 : 30, i % 3 === 0);
    const opts = [{}, { quick: true, noHint: true }, { ordentlich: true, noHint: true }][i % 3];
    const a = NEU.packCargo(C, T, opts), b = ALTE.packCargo(C, T, opts);
    assert.strictEqual(abdruck(a), abdruck(b), `Fall ${i}: Ergebnis weicht ab`);
    if (a.placed.some((p) => p.y > 0)) gestapelt++;
    // Weiterpacken auf dem, was steht: die Naht mit der Vorbelegung
    if (i % 4 === 0 && a.placed.length && a.placed.length < a.totalBoxes) {
      const rest = T.map((t, ti) => ({ ...t, qty: t.qty - a.perType[ti].loaded }));
      const C2 = { ...C, payload: 0 };
      assert.strictEqual(abdruck(NEU.packCargo(C2, rest, { vorbelegt: a.placed, noHint: true })), abdruck(ALTE.packCargo(C2, rest, { vorbelegt: a.placed, noHint: true })), `Fall ${i}: mit Vorbelegung weicht ab`);
    }
    faelle++;
  }
  assert.ok(faelle === 40 && gestapelt > 24, `zu wenig gestapelte Faelle (${gestapelt}) -- die Auflage-Pruefung waere kaum geprueft`);
});

test("Kette und Empfehlung: dieselben Container, dieselben Kisten", () => {
  const z0 = { ...NEU.__w }, a0 = { ...ALTE.__w };
  for (let i = 0; i < 8; i++) {
    const preset = pick(["20' GP", "40' GP", "40' HC"]);
    const C = NEU.PRESETS[preset];
    const T = ladung(ganz(2, 5), 70, i % 2 === 0);
    const lauf = (M) => {
      const r = M.packCargo(C, T, {});
      const ch = r.boxes > 0 && r.boxes < r.totalBoxes ? M.chainContainers(C, preset, T, r, {}, 24, "") : null;
      return abdruck(r) + "#" + (ch ? ch.chain.map((s) => s.name + ":" + s.placed.map(kiste).join(";")).join("|") + `|${ch.remainingBoxes}|${ch.gekappt}|${JSON.stringify(ch.perType)}` : "-")
        + "#" + JSON.stringify(M.suggestContainer(T, ""));
    };
    assert.strictEqual(lauf(NEU), lauf(ALTE), `Kette ${i} (${preset}) weicht ab`);
  }
  // Und es ist wirklich weniger Arbeit: weniger Packlaeufe, viel weniger durchgesehene Kisten.
  const neu = { liste: NEU.__w.liste - z0.liste, cargo: NEU.__w.cargo - z0.cargo };
  const alt = { liste: ALTE.__w.liste - a0.liste, cargo: ALTE.__w.cargo - a0.cargo };
  assert.ok(neu.cargo < alt.cargo, `Packlaeufe: neu ${neu.cargo}, alt ${alt.cargo}`);
  assert.ok(neu.liste * 4 < alt.liste, `durchgesehene Kisten: neu ${neu.liste}, alt ${alt.liste} -- erwartet weniger als ein Viertel`);
});

test("der Merker gilt nur bis zum naechsten Setzen: neue Auflage kann ein Stueck doch noch tragen", () => {
  // Der eine Fall, in dem ein gescheitertes Stueck spaeter passt -- gezielt gebaut, weil er in
  // Zufallsladungen kaum vorkommt (Gegenprobe: ohne `vorerst.clear()` blieben alle
  // Zufallsfaelle gruen). Raum 100 x 100 x 100:
  //   1. Sockel A (50 lang, 40 hoch) steht links am Boden.
  //   2. Platte B (100 lang) faende darueber Platz, haette aber nur 50 % Auflage -> scheitert.
  //   3. Der zweite Sockel A fuellt den Boden rechts. Jetzt liegt die Platte voll auf.
  //   4. Dieselbe Platte B noch einmal: sie MUSS jetzt gesetzt werden.
  const A = { ti: 0, l: 50, w: 100, h: 40, weight: 1, stackable: true, stackMax: Infinity, stackH: Infinity, rotatable: false };
  const B = { ti: 1, l: 100, w: 100, h: 20, weight: 1, stackable: true, stackMax: Infinity, stackH: Infinity, rotatable: false };
  const R = { l: 100, w: 100, h: 100 };
  for (const [name, M] of [["neu", NEU], ["alt", ALTE]]) {
    const r = M.emsPackOnce(R, [A, B, A, B], 0, Infinity, 3000);
    assert.deepStrictEqual(r.placed.map((p) => [p.ti, p.x, p.y, p.z]), [[0, 0, 0, 0], [0, 50, 0, 0], [1, 0, 40, 0]], `${name}: die Platte liegt nicht auf beiden Sockeln`);
  }
  // Und was schon nach den Massen nirgends hineingeht, wird nicht wieder gefragt -- aber
  // das Ergebnis bleibt dasselbe: ein 120er Stueck in einem 100er Raum, davor und danach Ware.
  const G = { ...A, ti: 2, l: 120 };
  for (const M of [NEU, ALTE]) assert.strictEqual(M.emsPackOnce(R, [G, A, G, A, G], 0, Infinity, 3000).placed.length, 2);
});

test("passtAlles: kuerzt nur ab, wo die Antwort feststeht", () => {
  const C = NEU.PRESETS["20' GP"];
  const O = { noHint: true, quick: true };
  const zaehl = (f) => { const v = NEU.__w.cargo; const r = f(); return [r, NEU.__w.cargo - v]; };
  // 40 m3 in 33 m3: nein, ohne zu packen
  const zuViel = [{ l: 100, w: 100, h: 100, qty: 40, weight: 10, stackable: true, rotatable: true }];
  assert.deepStrictEqual(zaehl(() => NEU.passtAlles(C, zuViel, O, 40)), [false, 0]);
  assert.strictEqual(ALTE.passtAlles(C, zuViel, O, 40), false);
  // 30 t auf 28,2 t Zuladung: nein, ohne zu packen
  const zuSchwer = [{ l: 100, w: 100, h: 100, qty: 10, weight: 3000, stackable: true, rotatable: true }];
  assert.deepStrictEqual(zaehl(() => NEU.passtAlles(C, zuSchwer, O, 10)), [false, 0]);
  assert.strictEqual(ALTE.passtAlles(C, zuSchwer, O, 10), false);
  // Passt: es wird gepackt, und die Antwort ist die des Packers
  const passt = [{ l: 120, w: 80, h: 100, qty: 11, weight: 300, stackable: false, rotatable: true }];
  assert.deepStrictEqual(zaehl(() => NEU.passtAlles(C, passt, O, 11)), [true, 1]);
  // Volumen reicht, Geometrie nicht (12 Europaletten am Boden): gepackt, nein
  assert.deepStrictEqual(zaehl(() => NEU.passtAlles(C, [{ ...passt[0], qty: 12 }], O, 12)), [false, 1]);
  // Wird weniger verlangt als die ganze Liste, gilt die Abkuerzung nicht -- dann wird gepackt
  assert.deepStrictEqual(zaehl(() => NEU.passtAlles(C, zuViel, O, 20)), [true, 1]);
  // Ungueltige Zeilen zaehlen nicht zum Volumen (wie in packCargo), ohne Zuladung kein Gewichtslimit
  assert.strictEqual(NEU.sicherZuViel(C, [{ l: 0, w: 100, h: 100, qty: 999, weight: 1 }, { l: 100, w: 100, h: 100, qty: 5, weight: -50 }]), false);
  assert.strictEqual(NEU.sicherZuViel({ ...C, payload: 0 }, zuSchwer), false);
  // Knapp ueber dem Containervolumen, aber innerhalb der Zugabe: nicht abkuerzen
  const voll = C.l * C.w * C.h;
  assert.strictEqual(NEU.sicherZuViel(C, [{ l: 1, w: 1, h: voll + 500, qty: 1, weight: 0 }]), false);
  assert.strictEqual(NEU.sicherZuViel(C, [{ l: 1, w: 1, h: voll + 5000, qty: 1, weight: 0 }]), true);
});

test("der gemeldete Fall: 2.169 Packstuecke, alles verladen, mit begrenzter Arbeit", () => {
  const T = [[131, 74, 54, 87, 186], [128, 77, 56, 97, 180], [350, 24, 20, 16, 1.8], [400, 24, 22, 15, 1.6], [500, 41, 28, 18, 4.2], [660, 35, 27, 12, 4.2]]
    .map(([qty, l, w, h, weight], i) => ({ name: "P" + (i + 1), qty, l, w, h, weight, stackable: true, stackMax: Infinity, rotatable: true }));
  const C = NEU.PRESETS["20' GP"];
  const v = { ...NEU.__w };
  const r = NEU.packCargo(C, T, {});
  const ch = NEU.chainContainers(C, "20' GP", T, r, {}, 24, "");
  const sug = NEU.suggestContainer(T, "");
  assert.strictEqual(r.totalBoxes, 2169);
  assert.strictEqual(ch.remainingBoxes, 0, "es bleibt etwas liegen");
  assert.strictEqual(ch.chain.reduce((s, c) => s + c.placed.length, 0), 2169, "die Kette traegt nicht jedes Stueck genau einmal");
  assert.ok(ch.chain.length >= 3 && ch.chain.length <= 4, `Container: ${ch.chain.length} (122 m3 brauchen mindestens drei)`);
  assert.strictEqual(sug.type, "multi");
  // Arbeit statt Stoppuhr (eine Stoppuhr haengt an der Maschine). Vor den Abkuerzungen:
  // 83 Packlaeufe und rund 9,7 Milliarden durchgesehene Kisten. Die Grenzen lassen Luft
  // fuer Aenderungen am Packer, aber nicht fuer den Rueckfall.
  const cargo = NEU.__w.cargo - v.cargo, liste = NEU.__w.liste - v.liste;
  assert.ok(cargo <= 60, `Packlaeufe: ${cargo}`);
  assert.ok(liste < 1.5e9, `durchgesehene Kisten: ${(liste / 1e9).toFixed(2)} Mrd.`);
});
