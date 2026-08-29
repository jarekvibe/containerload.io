// Ordentlich stauen -- aber nur, solange es nichts kostet (Stufe 3 der Kette).
//
// Gemeldet: "die Ladung wird teilweise auch weird gestaut ... Ich weiss, dass es schwierig
// ist umzusetzen, dass nach Logik gestaut wird, aber vielleicht kann man das probieren?"
//
// Nachgemessen an genau der gemeldeten Sendung (9 flache Stuecke 250x80x30 nicht stapelbar
// + 22 Paletten): gleiche Ware lag an vier Stellen im Container, dazwischen einzelne Stuecke
// der anderen Sorte. Als Zahl -- Streuung, also die Summe der quadratischen Abstaende vom
// Schwerpunkt der eigenen Sorte -- waren das 266 m^2; Sorte fuer Sorte gelegt sind es 85.
//
// Die Ursache sind ausgerechnet die Zufalls-Neustarts in emsSearch. Die festen Sortierungen
// legen Sorte fuer Sorte; ein gemischter Wurf bringt hier 26 Packstuecke statt 24 unter, und
// dafuer steht jede Sorte hinterher an vier Stellen.
//
// Die Frage ist deshalb nicht "ordentlich ODER voll", sondern auf WELCHER Ebene bezahlt wird:
// zwei Packstuecke weniger im ersten Container sind kein Verlust, solange sie im zweiten
// mitfahren, den es ohnehin gibt. Gebucht und bezahlt werden Container, nicht Stellplaetze.
//
// Dieser Test vergleicht darum die echte Kette gegen dieselbe Kette OHNE Stufe 3 -- aus
// derselben Quelle gebaut, damit die Gegenprobe nicht veraltet.
//
// node --test test/ordentlich-stauen.test.mjs
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
const quelle = `var num=(v,d=0)=>Number.isFinite(+v)&&v!==""?+v:d;
   var applyCarrier=(p)=>p;
   ${cut("var PRESETS = {", (l) => l.includes("var panelsFor"))}
   ${cut("function makeFloorPacker", (l, i) => l.trim() === "}" && L[i - 1].includes("single: false"))}
   ${cut("var MAXCHAIN", (l, i) => l.trim() === "}" && L[i - 1].includes("return { chain, remainingBoxes"))}
   return { chainContainers, packCargo, slotKg, PRESETS, MAXCHAIN };`;
const MIT = new Function(quelle)();

// Die Gegenprobe: dieselbe Quelle, nur ohne Stufe 3. Wer die Zeile umbaut, faellt hier auf.
const AUS_MARKE = "const ord = bauen(erg.sortenrein, true);";
test("die Gegenprobe laesst sich ueberhaupt bauen", () => {
  assert.ok(roh.includes(AUS_MARKE), `Stufe 3 heisst im Quelltext nicht mehr "${AUS_MARKE}"`);
  assert.strictEqual(roh.split(AUS_MARKE).length - 1, 2,
    "Stufe 3 muss in BEIDEN Kettenfunktionen stehen (See- und Landfracht)");
});
const OHNE = new Function(quelle.split(AUS_MARKE).join("const ord = null;"))();

const streuung = (p) => {
  const sx = {}, sz = {}, qx = {}, qz = {}, k = {};
  for (const b of p) {
    const t = b.ti, cx = b.x + b.dx / 2, cz = b.z + b.dz / 2;
    sx[t] = (sx[t] || 0) + cx; qx[t] = (qx[t] || 0) + cx * cx;
    sz[t] = (sz[t] || 0) + cz; qz[t] = (qz[t] || 0) + cz * cz;
    k[t] = (k[t] || 0) + 1;
  }
  let v = 0;
  for (const t in k) v += qx[t] - sx[t] * sx[t] / k[t] + qz[t] - sz[t] * sz[t] / k[t];
  return v / 1e4;
};
const spanne = (M, chain, cargo) => {
  const kg = chain.map((c) => M.slotKg(c.placed, cargo));
  return kg.length ? Math.max(...kg) - Math.min(...kg) : 0;
};
const kette = (M, preset, cargo) => {
  const c0 = M.PRESETS[preset];
  const r0 = M.packCargo(c0, cargo, {});
  return M.chainContainers(c0, preset, cargo, r0, {}, M.MAXCHAIN);
};

// ── 1. Der gemeldete Fall ───────────────────────────────────────────────────────────
const GEMELDET = [
  { n: "Package", l: 250, w: 80, h: 30, qty: 9, weight: 300, stackable: false },
  { n: "Package", l: 120, w: 80, h: 110, qty: 22, weight: 300, stackMax: 3 },
];

test("der gemeldete Fall wird deutlich ordentlicher -- ohne einen Container mehr", () => {
  const mit = kette(MIT, "40' HC", GEMELDET), ohne = kette(OHNE, "40' HC", GEMELDET);
  assert.strictEqual(mit.remainingBoxes, 0, "es darf nichts liegenbleiben");
  assert.strictEqual(mit.chain.length, ohne.chain.length,
    `Stufe 3 hat die Kette von ${ohne.chain.length} auf ${mit.chain.length} Container verlaengert`);
  const sMit = streuung(mit.chain[0].placed), sOhne = streuung(ohne.chain[0].placed);
  assert.ok(sMit < sOhne / 2,
    `Streuung im ersten Container nur ${sMit.toFixed(1)} statt ${sOhne.toFixed(1)} m^2 -- kaum besser`);
  // Und die Sorten liegen wirklich getrennt: der zweite Container traegt nur noch EINE Sorte.
  const sorten = (c) => new Set(c.placed.map((b) => b.ti)).size;
  assert.strictEqual(sorten(mit.chain[1]), 1,
    "der zweite Container sollte die uebrigen flachen Stuecke am Stueck aufnehmen");
});

// ── 2. Die drei Zusagen, ueber Zufallsketten geprueft ───────────────────────────────
// Stufe 3 darf NICHTS kosten: keinen Container, kein Packstueck, keinen Gewichtsausgleich.
test("ueber 60 Zufallsketten kostet Stufe 3 weder Container noch Ladung noch Gewichtsausgleich", () => {
  let seed = 4711;
  const rnd = () => ((seed = (seed * 1103515245 + 12345) & 2147483647) / 2147483647);
  const ri = (a, b) => a + Math.floor(rnd() * (b - a + 1));
  const namen = Object.keys(MIT.PRESETS).filter((n) => !MIT.PRESETS[n].kind || MIT.PRESETS[n].kind === "dry");
  let besser = 0, geprueft = 0, mitKette = 0;
  for (let i = 0; i < 60; i++) {
    const preset = namen[ri(0, namen.length - 1)];
    const cargo = [];
    for (let t = 0; t < ri(1, 4); t++) {
      cargo.push({
        name: "T" + t, l: ri(40, 300), w: ri(30, 140), h: ri(20, 160), weight: ri(20, 900),
        qty: ri(3, 40), rotatable: rnd() < 0.85, stackable: rnd() < 0.75,
        ...(rnd() < 0.4 ? { stackMax: ri(2, 4) } : {})
      });
    }
    const mit = kette(MIT, preset, cargo), ohne = kette(OHNE, preset, cargo);
    geprueft++;
    if (mit.chain.length > 1) mitKette++;
    assert.ok(mit.chain.length <= ohne.chain.length,
      `Fall ${i} (${preset}): ${mit.chain.length} statt ${ohne.chain.length} Container`);
    assert.ok(mit.remainingBoxes <= ohne.remainingBoxes,
      `Fall ${i} (${preset}): ${mit.remainingBoxes} statt ${ohne.remainingBoxes} offen`);
    assert.ok(spanne(MIT, mit.chain, cargo) <= spanne(OHNE, ohne.chain, cargo) + 1e-6,
      `Fall ${i} (${preset}): Gewichtsspanne ${Math.round(spanne(MIT, mit.chain, cargo))} statt ${Math.round(spanne(OHNE, ohne.chain, cargo))} kg`);
    const sMit = mit.chain.reduce((s, c) => s + streuung(c.placed), 0);
    const sOhne = ohne.chain.reduce((s, c) => s + streuung(c.placed), 0);
    if (sMit < sOhne - 1e-6) besser++;
  }
  assert.ok(mitKette >= 20, `nur ${mitKette} Faelle mit mehr als einem Container -- Stufe 3 kam kaum zum Zug`);
  assert.ok(besser >= 5, `in ${geprueft} Faellen wurde nur ${besser}x ordentlicher gestaut -- greift Stufe 3 ueberhaupt?`);
});

// ── 3. Bei EINEM Container gilt weiter: so viel wie moeglich ────────────────────────
// Dort gibt es keine naechste Ladung, in die ein Packstueck ausweichen koennte. Ordentlich
// waere dann schlicht weniger Ladung -- und das ist nicht der Auftrag.
test("bei einem einzelnen Container wird weiterhin voll gepackt", () => {
  const eng = [
    { name: "A", l: 250, w: 80, h: 30, qty: 9, weight: 300, stackable: false },
    { name: "B", l: 120, w: 80, h: 110, qty: 22, weight: 300, stackMax: 3 },
  ];
  // Direkt gepackt (ohne Kette) -- so, wie die Leiste den einzelnen Container zeigt.
  const voll = MIT.packCargo(MIT.PRESETS["40' HC"], eng, {});
  const ordentlich = MIT.packCargo(MIT.PRESETS["40' HC"], eng, { ordentlich: true });
  assert.ok(voll.boxes > ordentlich.boxes,
    "in diesem Fall soll die volle Packung mehr unterbringen als die ordentliche");
  // Und die Kette darf den ersten Container nur dann kuerzen, wenn es einen zweiten gibt.
  const einzeln = [{ name: "A", l: 120, w: 80, h: 110, qty: 6, weight: 300, stackMax: 3 }];
  const k = kette(MIT, "40' HC", einzeln);
  assert.strictEqual(k.chain.length, 1);
  assert.strictEqual(k.chain[0].placed.length, 6, "eine kleine Ladung muss vollstaendig im ersten Container stehen");
});

// ── 4. Der Vertrag im Quelltext ─────────────────────────────────────────────────────
test("ordentlich heisst: keine Zufalls-Neustarts", () => {
  assert.ok(/const rs = ordentlich \? 0 :/.test(roh),
    "emsSearch schaltet die Neustarts nicht mehr ueber ordentlich ab -- dann mischt es weiter durch");
  // Die Signatur ist seit der Vorbelegung laenger -- geprueft wird die Stelle, nicht die Zahl
  // der Parameter dahinter.
  assert.ok(/function emsSearch\(C2, items, pay, restarts, ordentlich[,)]/.test(roh),
    "emsSearch nimmt ordentlich nicht mehr entgegen");
  assert.ok(/emsSearch\(\{ l: CL, w: CW, h: CH \}, valid, payFrei, restarts, opts\.ordentlich[,)]/.test(roh),
    "packCargo reicht opts.ordentlich nicht mehr durch");
  // Die drei Bedingungen der Uebernahme muessen alle drei dastehen.
  const stelle = roh.slice(roh.indexOf(AUS_MARKE), roh.indexOf(AUS_MARKE) + 1400);
  assert.ok(/ord\.totRem <= totRem/.test(stelle), "Stufe 3 prueft nicht mehr, ob sie mehr liegen laesst");
  assert.ok(/ord\.chain\.length <= chain\.length/.test(stelle), "Stufe 3 prueft nicht mehr, ob sie einen Container kostet");
  assert.ok(/spanne\(oChain\) <= spanne\(chain\)/.test(stelle), "Stufe 3 prueft nicht mehr die Gewichtsspanne");
});
