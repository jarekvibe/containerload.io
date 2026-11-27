// Der groesste Container ist nur dann die richtige Folge-Wahl, wenn er auch MEHR traegt.
//
// Gemeldet mit Bild (Jarek, 27.11.26): 34 Stueck 120 x 80 x 110 cm zu je 10.000 kg, gewaehlt
// der 20' GP. Jeder Container traegt zwei Stueck (ein drittes waere zu schwer) -- soweit
// richtig. Aber:
//   1. Die Kette stellte nach dem ersten 20-Fuesser fuenfzehn 40' HC hin, jeden mit zwei
//      Stueck. Regel bis dahin: "passt der Rest nicht in EINEN Container, nimm den groessten".
//      Der 40' HC hat das groesste Volumen, aber nicht die groesste Zuladung (26.580 kg
//      gegen 28.200 kg im 20' GP).
//   2. Die Empfehlung nannte "16 x 40' HC + 1 x 20' GP" -- dieselbe Zahl Container wie
//      17 x 20' GP, nur mehr als doppelt so viel gebuchter Raum.
//   3. Die Zeile "Das Gewicht teilt die Sendung" fehlte: zwei Stueck sind 71 % der Zuladung,
//      die Schwelle lag bei 90 %. Genau der Satz, der die Frage beantwortet haette.
//
// Die Gegenprobe kommt aus derselben Datei: app.html wird ein zweites Mal geladen, mit
// abgeschalteter Regel (kleinerReicht gibt null). So kann "kostet nie einen Container"
// nicht stillschweigend veralten.
//
// node --test test/folgecontainer-gewicht.test.mjs
import fs from "node:fs";
import assert from "node:assert";
import test from "node:test";
import { fileURLToPath } from "node:url";
import path from "node:path";

const dir = path.dirname(fileURLToPath(import.meta.url));
const roh = fs.readFileSync(path.join(dir, "..", "app.html"), "utf8");

const laden = (quelle) => {
  const L = quelle.split("\n");
  const cut = (von, bis) => {
    const s = L.findIndex((l) => l.includes(von));
    const e = L.findIndex((l, i) => i > s && bis(l, i));
    assert.ok(s >= 0 && e > s, `Ausschnitt nicht gefunden: ${von}`);
    return L.slice(s, e + 1).join("\n");
  };
  return new Function(
    `var num=(v,d=0)=>Number.isFinite(+v)&&v!==""?+v:d;
     var applyCarrier=(p)=>p;
     var suggestEquipment=()=>null;
     ${cut("var PRESETS = {", (l) => l.includes("var panelsFor"))}
     ${cut("function makeFloorPacker", (l, i) => l.trim() === "}" && L[i - 1].includes("single: false"))}
     ${cut("var MAXCHAIN", (l, i) => l.trim() === "}" && L[i - 1].includes("return { chain, remainingBoxes"))}
     ${cut("function suggestContainer", (l, i) => l.trim() === "}" && L[i - 1].includes('return { type: "multi", combo };'))}
     return { chainContainers, packCargo, PRESETS, kettenGrund, suggestContainer, kleinerReicht };`
  )();
};

// Die alte Regel: derselbe Quelltext, nur dass nie ein kuerzerer Container gefunden wird.
const AN = "function kleinerReicht(stdOrder, gross, r, packen) {\n    if (!r || !r.boxes) return null;";
const AUS = "function kleinerReicht(stdOrder, gross, r, packen) {\n    return null;";
assert.strictEqual(roh.split(AN).length - 1, 1, "der Anfang von kleinerReicht hat sich geaendert -- Gegenprobe anpassen");
const NEU = laden(roh);
const ALT = laden(roh.replace(AN, AUS));
const { PRESETS } = NEU;

const kette = (K, preset, cargo, overrides) => {
  const c0 = K.PRESETS[preset];
  const r0 = K.packCargo(c0, cargo, {});
  return K.chainContainers(c0, preset, cargo, r0, overrides || {}, 24);
};
const vol = (p) => p.l * p.w * p.h;
const mass = (ch) => ({ offen: ch.remainingBoxes, n: ch.chain.length, vol: ch.chain.reduce((s, c) => s + vol(c.preset), 0) });
const namen = (ch) => ch.chain.map((c) => c.name);
const stueck = (ch) => ch.chain.map((c) => c.placed.length);

// Die gemeldete Ladung.
const GEMELDET = [{ name: "Item", l: 120, w: 80, h: 110, weight: 10000, qty: 34, stackable: true, rotatable: true }];

test("der gemeldete Fall: 17 x 20 Fuss statt fuenfzehn 40-Fuesser mit je zwei Stueck", () => {
  const ch = kette(NEU, "20' GP", GEMELDET);
  assert.strictEqual(ch.remainingBoxes, 0);
  assert.strictEqual(ch.chain.length, 17);
  assert.deepStrictEqual(stueck(ch), Array(17).fill(2), "je Container zwei Stueck: 20 t, ein drittes waere zu schwer");
  assert.deepStrictEqual(namen(ch), Array(17).fill("20' GP"));
  // Die Gegenprobe zeigt den gemeldeten Stand -- sonst pruefte der Test oben nichts.
  const alt = kette(ALT, "20' GP", GEMELDET);
  assert.strictEqual(alt.chain.length, 17);
  assert.strictEqual(namen(alt).filter((n) => n === "40' HC").length, 15, "die alte Regel stellte fuenfzehn 40' HC hin");
  assert.ok(mass(ch).vol < mass(alt).vol / 2, "weniger als die Haelfte des gebuchten Raums");
});

test("die Empfehlung nennt dasselbe wie die Kette -- und nicht mehr 16 x 40' HC", () => {
  const e = NEU.suggestContainer(GEMELDET, "");
  assert.strictEqual(e.type, "multi");
  assert.deepStrictEqual(e.combo, [{ name: "20' GP", count: 17 }]);
  assert.deepStrictEqual(ALT.suggestContainer(GEMELDET, "").combo, [{ name: "40' HC", count: 16 }, { name: "20' GP", count: 1 }]);
  // Wer den 40' HC gewaehlt hat, behaelt ihn als ersten Container (die Wahl ist seine) --
  // die Folgecontainer sind 20-Fuesser, und die Empfehlung ist dann wirklich guenstiger.
  const ch = kette(NEU, "40' HC", GEMELDET);
  assert.deepStrictEqual(namen(ch), ["40' HC"].concat(Array(16).fill("20' GP")));
  const empfVol = e.combo.reduce((s, c) => s + c.count * vol(PRESETS[c.name]), 0);
  assert.ok(empfVol < mass(ch).vol, "die Empfehlung bucht weniger Raum als die Kette mit dem 40' HC vorn");
});

test("die hoehere Zuladung des 20-Fuessers zaehlt: weniger Container, nicht nur kleinere", () => {
  // 9 t je Stueck: der 20' GP traegt drei (27,0 t von 28,2 t), der 40' HC nur zwei
  // (das dritte waeren 27,0 t bei 26,58 t Zuladung).
  const cargo = [{ name: "Coil", l: 120, w: 80, h: 110, weight: 9000, qty: 34, stackable: false, rotatable: true }];
  assert.strictEqual(NEU.packCargo(PRESETS["20' GP"], cargo, {}).boxes, 3);
  assert.strictEqual(NEU.packCargo(PRESETS["40' HC"], cargo, {}).boxes, 2);
  const neu = kette(NEU, "20' GP", cargo), alt = kette(ALT, "20' GP", cargo);
  assert.strictEqual(neu.remainingBoxes, 0);
  assert.strictEqual(neu.chain.length, 12, `34 Stueck zu je drei: zwoelf Container, waren ${neu.chain.length}`);
  assert.strictEqual(alt.chain.length, 16, `die alte Regel brauchte 16 Container, waren ${alt.chain.length}`);
  assert.ok(namen(neu).every((n) => n === "20' GP"));
  const e = NEU.suggestContainer(cargo, "");
  assert.strictEqual(e.combo.reduce((s, c) => s + c.count, 0), 12, "die Empfehlung kommt auf dieselbe Zahl");
});

test("teilt der PLATZ, bleibt es beim 40' HC -- und ein 40' GP ersetzt ihn nie", () => {
  // 80 nicht stapelbare Paletten: der Rest passt nie in einen Container, jeder 40-Fuesser
  // ist raeumlich voll. Ein 40' GP truege dieselben 25 -- gleiche Laenge, gleicher Preis,
  // also kein Grund, vom High Cube abzuraten.
  const cargo = [{ name: "EUR", l: 120, w: 80, h: 100, weight: 300, qty: 80, stackable: false, rotatable: true }];
  const neu = kette(NEU, "40' HC", cargo), alt = kette(ALT, "40' HC", cargo);
  assert.deepStrictEqual(namen(neu), namen(alt));
  assert.deepStrictEqual(stueck(neu), stueck(alt));
  assert.strictEqual(namen(neu)[1], "40' HC");
  assert.ok(!namen(neu).slice(0, -1).includes("40' GP"), `ein 40' GP mitten in der Kette: ${namen(neu).join(", ")}`);
  assert.deepStrictEqual(NEU.suggestContainer(cargo, ""), ALT.suggestContainer(cargo, ""));
});

test("kleinerReicht: nur kuerzere Container, nur wenn sie von jeder Sorte mindestens dasselbe laden", () => {
  const order = Object.entries(PRESETS).filter(([n, p]) => (!p.kind || p.kind === "dry") && n !== "45' HC")
    .map(([name, p]) => ({ name, p, vol: vol(p) })).sort((a, b) => a.vol - b.vol);
  const gross = order[order.length - 1];
  assert.strictEqual(gross.name, "40' HC");
  let laeufe = 0;
  const mit = (cargo) => (p) => { laeufe++; return NEU.packCargo(p, cargo, { noHint: true }); };
  // Raeumlich voll: es wird gar nicht erst gepackt.
  const voll = [{ name: "EUR", l: 120, w: 80, h: 100, weight: 300, qty: 80, stackable: false, rotatable: true }];
  assert.strictEqual(NEU.kleinerReicht(order, gross, mit(voll)(gross.p), mit(voll)), null);
  assert.strictEqual(laeufe, 1, "fuer eine raeumlich volle Ladung darf die Frage keinen Packlauf kosten");
  // Gewicht teilt: der kleinste kuerzere Container, der dasselbe traegt.
  const r = mit(GEMELDET)(gross.p);
  const kl = NEU.kleinerReicht(order, gross, r, mit(GEMELDET));
  assert.ok(kl && kl.o.name === "20' GP" && kl.r.boxes === 2);
  // Zwei Lagen zu je 125 cm brauchen 250 cm Hoehe: der 20' GP (239 cm) faellt aus, der 20' HC nicht.
  const hoch = [{ name: "Hoch", l: 120, w: 80, h: 125, weight: 10000, qty: 9, stackable: true, rotatable: true }];
  const rh = mit(hoch)(gross.p);
  assert.strictEqual(rh.boxes, 2);
  const kh = NEU.kleinerReicht(order, gross, rh, mit(hoch));
  assert.ok(kh && kh.o.name.startsWith("20'"), "auch hier reicht ein 20-Fuesser");
  // Nichts geladen: nichts zu vergleichen.
  assert.strictEqual(NEU.kleinerReicht(order, gross, { boxes: 0, placed: [], perType: [], weight: 0 }, mit(GEMELDET)), null);
});

test("eine Wahl von Hand bleibt stehen", () => {
  const ch = kette(NEU, "20' GP", GEMELDET, { 1: "40' HC", 3: "40' GP" });
  assert.strictEqual(namen(ch)[1], "40' HC");
  assert.strictEqual(namen(ch)[3], "40' GP");
  assert.strictEqual(namen(ch)[2], "20' GP");
  assert.strictEqual(ch.remainingBoxes, 0);
});

test("ueber 80 Zufallsladungen: nie mehr offen, nie mehr Container, nie mehr gebuchter Raum", () => {
  // Deterministischer Zufall (mulberry32), schwere und leichte Ware gemischt.
  let a = 20261127;
  const rnd = () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  const zw = (lo, hi) => lo + Math.floor(rnd() * (hi - lo + 1));
  const START = ["20' GP", "20' HC", "40' GP", "40' HC"];
  let anders = 0, weniger = 0;
  for (let f = 0; f < 80; f++) {
    const schwer = rnd() < 0.6;
    const cargo = Array.from({ length: zw(1, 3) }, (_, i) => ({
      name: "P" + i, l: zw(4, 16) * 10, w: zw(4, 12) * 10, h: zw(3, 14) * 10,
      weight: schwer ? zw(8, 110) * 100 : zw(1, 40) * 10, qty: zw(3, 30),
      stackable: rnd() < 0.7, rotatable: rnd() < 0.8
    }));
    const preset = START[zw(0, START.length - 1)];
    const neu = kette(NEU, preset, cargo), alt = kette(ALT, preset, cargo);
    const mn = mass(neu), ma = mass(alt);
    const fall = `Fall ${f} (${preset}): neu ${namen(neu).join("+")} offen ${mn.offen} / alt ${namen(alt).join("+")} offen ${ma.offen}`;
    assert.ok(mn.offen <= ma.offen, `mehr offen -- ${fall}`);
    if (mn.offen === ma.offen) {
      assert.ok(mn.n <= ma.n, `mehr Container -- ${fall}`);
      if (mn.n === ma.n) assert.ok(mn.vol <= ma.vol + 1e-6, `mehr gebuchter Raum -- ${fall}`);
    }
    // Nichts verschwindet: verladen + offen = Ladung.
    const ges = cargo.reduce((s, t) => s + t.qty, 0);
    assert.strictEqual(stueck(neu).reduce((s, n) => s + n, 0) + mn.offen, ges, `Stueckzahl -- ${fall}`);
    // Der erste Container ist die Wahl des Nutzers.
    assert.strictEqual(namen(neu)[0], preset);
    if (namen(neu).join() !== namen(alt).join()) anders++;
    if (mn.offen === ma.offen && mn.n < ma.n) weniger++;
  }
  // Greift die Regel nie, prueft die Schleife nichts.
  assert.ok(anders >= 8, `nur ${anders} von 80 Ketten unterscheiden sich -- die Faelle treffen die Regel nicht`);
  assert.ok(weniger >= 1, "kein einziger Fall mit weniger Containern -- die hoehere Zuladung des 20-Fuessers kommt nicht vor");
});

test("die Grund-Zeile steht auch, wenn zwei schwere Stueck die Zuladung nur zu 71 % nutzen", () => {
  const ch = kette(NEU, "20' GP", GEMELDET);
  const g = NEU.kettenGrund(PRESETS["20' GP"], GEMELDET, ch.chain);
  assert.deepStrictEqual(g, { kg: 20000, pay: PRESETS["20' GP"].payload });
  assert.ok(g.kg < g.pay * 0.9, "der Fall liegt unter der alten 90-%-Schwelle -- sonst prueft er nichts Neues");
});

test("... aber nicht, wenn der Platz teilt und das naechste Stueck vom Gewicht her noch ginge", () => {
  // Zwei lange Stuecke zu je 5 t: im 20' GP steht eines (590 cm), das zweite waere leicht genug.
  const lang = [{ name: "Lang", l: 500, w: 200, h: 200, weight: 5000, qty: 2, stackable: false, rotatable: true }];
  const ch = kette(NEU, "20' GP", lang);
  assert.ok(ch.chain.length >= 2);
  assert.strictEqual(NEU.kettenGrund(PRESETS["20' GP"], lang, ch.chain), null);
  // Und ohne Gewichtsangabe gibt es nichts zu begruenden.
  const ohne = [{ name: "K", l: 100, w: 100, h: 100, weight: 0, qty: 100, stackable: true, rotatable: true }];
  const c2 = kette(NEU, "20' GP", ohne);
  assert.ok(c2.chain.length >= 2);
  assert.strictEqual(NEU.kettenGrund(PRESETS["20' GP"], ohne, c2.chain), null);
});

test("Kette und Empfehlung fragen dieselbe Funktion -- und beide beweisen sich gegen die alte Regel", () => {
  const kette0 = roh.slice(roh.indexOf("function chainContainers("), roh.indexOf("function chainVehicles("));
  const empf = roh.slice(roh.indexOf("function suggestContainer("), roh.indexOf("function suggestVehicles("));
  assert.match(kette0, /kleinerReicht\(stdOrder, workhorse, rr,/, "die Kette fragt kleinerReicht nicht mehr");
  assert.match(empf, /kleinerReicht\(stdOrder, workhorse, r, packen\)/, "die Empfehlung fragt kleinerReicht nicht mehr");
  assert.match(kette0, /const alt = bauenMit\(sortenrein, ordentlich, false\);\s*return !alt \|\| ketteBesser\(neu, alt\) \? neu : alt;/,
    "die Kette mit kuerzeren Folgecontainern tritt nicht mehr gegen die alte an");
  assert.match(empf, /const alt = kombiMit\(sortenrein, false\);\s*return besser\(neu, alt\) \? neu : alt;/,
    "die Empfehlung mit kuerzeren Containern tritt nicht mehr gegen die alte an");
  // Von Hand gewaehlte Folgecontainer fasst die Regel nicht an.
  assert.match(kette0, /if \(klein && !manual && pick === workhorse && rr\.boxes > 0\)/);
  // Die Landfracht kennt kein kleineres Fahrzeug: dort gibt es die Frage nicht.
  const strasse = roh.slice(roh.indexOf("function chainVehicles("), roh.indexOf("function chainVehicles(") + 12000);
  assert.ok(!strasse.includes("kleinerReicht("));
});
