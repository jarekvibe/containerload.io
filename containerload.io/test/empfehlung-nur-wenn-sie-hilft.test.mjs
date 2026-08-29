// Das Empfehlungsbanner erscheint nur, wenn es etwas zu sagen hat.
//
// Gemeldet: "Wenn man mehrere Container hat, zum Beispiel 2x 20 GP, wird einem unten
// trotzdem noch irgendwas vorgeschlagen mit 'Du brauchst ca. 1x 40HC + 1x 20GP', obwohl
// man die Auswahl ja selbst bereits getroffen hat." Und daneben stand gleichzeitig
// "Alles verladen - 2 Container" in Gruen. Zwei Antworten auf dieselbe Frage.
//
// Ursache: das Banner hing an `unplaced` -- der Differenz im ERSTEN Container. Genau die
// halbe Wahrheit, die die Statuszeile schon einmal erzaehlt hat und die seither ueber
// `offenGesamt` laeuft (test/kette-ist-kein-fehler.test.mjs).
//
// Die Ausnahme, die bleibt: kommt die frei gerechnete Empfehlung mit WENIGER Equipment aus
// als die gewaehlte Kette, ist das Geld und gehoert gesagt -- dann aber als Angebot
// ("Es ginge auch mit ...") und nicht als Warnung.
//
// node --test test/empfehlung-nur-wenn-sie-hilft.test.mjs
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

// Dieselbe Rechnung wie in app.html: erst die Zahl der Container, dann das gebuchte Volumen.
const vol = (p) => p.l * p.w * p.h;
const kosten = (sug) => sug && sug.type === "multi" && sug.combo && sug.combo.length
  ? { n: sug.combo.reduce((a, x) => a + x.count, 0), vol: sug.combo.reduce((a, x) => a + x.count * vol(PRESETS[x.name]), 0) }
  : sug && sug.type === "single" ? { n: 1, vol: vol(PRESETS[sug.name]) } : null;

const plan = (preset, cargo) => {
  const c0 = PRESETS[preset];
  const r0 = packCargo(c0, cargo, {});
  const ch = chainContainers(c0, preset, cargo, r0, {}, MAXCHAIN);
  const sug = r0.boxes < r0.totalBoxes ? suggestContainer(cargo, "") : null;
  const k = { n: ch.chain.length, vol: ch.chain.reduce((a, c) => a + vol(c.preset), 0) };
  const s = kosten(sug);
  const besser = !!(ch.remainingBoxes === 0 && s && (s.n < k.n || (s.n === k.n && s.vol < k.vol - 1e-6)));
  return { ch, sug, kette: k, empf: s, besser, zeigen: ch.remainingBoxes > 0 || besser };
};

// ── Der gemeldete Fall ──────────────────────────────────────────────────────────────
// 9 Packstuecke 250x80x30 (nicht stapelbar) + 22 Paletten, gewaehlt: 40' HC.
const GEMELDET = [
  { n: "Package", l: 250, w: 80, h: 30, qty: 9, weight: 300, stackable: false },
  { n: "Package", l: 120, w: 80, h: 110, qty: 22, weight: 300, stackMax: 3 },
];

test("nimmt die Kette alles auf und ist nicht schlechter, schweigt das Banner", () => {
  const p = plan("40' HC", GEMELDET);
  assert.strictEqual(p.ch.remainingBoxes, 0, "die Kette sollte die ganze Ladung aufnehmen");
  assert.ok(p.ch.chain.length > 1, "und dafuer mehr als einen Container brauchen");
  assert.strictEqual(p.zeigen, false,
    `Banner wuerde erscheinen: Kette ${p.kette.n} Container, Empfehlung ${p.empf && p.empf.n}`);
});

// ── Gegenprobe 1: es bleibt etwas liegen -> das Banner ist die Antwort ───────────────
test("bleibt etwas liegen, erscheint das Banner weiterhin", () => {
  // Ein Stueck, das in keinen Standardcontainer passt.
  const p = plan("20' GP", [{ n: "Lang", l: 1400, w: 100, h: 100, qty: 2, weight: 500 }]);
  assert.ok(p.ch.remainingBoxes > 0, "hier muss etwas offen bleiben");
  assert.strictEqual(p.zeigen, true, "und genau dann gehoert das Banner hin");
});

// ── Gegenprobe 2: die Empfehlung kommt mit weniger aus -> das Banner bietet es an ────
test("kommt die Empfehlung mit weniger Equipment aus, sagt das Banner es", () => {
  // 25 Europaletten im 20' GP: 22 passen hinein, also zwei 20-Fuesser -- ein 40er reicht.
  const p = plan("20' GP", [{ n: "EUR", l: 120, w: 80, h: 110, qty: 25, weight: 300, stackMax: 3 }]);
  assert.strictEqual(p.ch.remainingBoxes, 0, "die Kette nimmt alles auf");
  assert.ok(p.kette.n >= 2, `erwartet mindestens zwei Container, waren ${p.kette.n}`);
  assert.strictEqual(p.besser, true,
    `Empfehlung ${p.empf && p.empf.n} sollte guenstiger sein als die Kette (${p.kette.n})`);
  assert.strictEqual(p.zeigen, true);
});

// ── Der Vertrag im Quelltext ────────────────────────────────────────────────────────
// Die Rechnung oben ist nachgebaut; dass app.html sie auch benutzt, muss der Quelltext sagen.
test("das Banner haengt an offenGesamt, nicht mehr am ersten Container", () => {
  assert.ok(/!manualMode && zeigeBanner &&/.test(roh),
    "die Anzeigebedingung des Empfehlungsbanners heisst nicht mehr zeigeBanner");
  assert.ok(!/!manualMode && unplaced > 0 &&/.test(roh),
    "das Banner haengt wieder an unplaced -- das zaehlt nur den ersten Container");
  const m = roh.match(/const zeigeBanner = ([^;]+);/);
  assert.ok(m, "zeigeBanner ist nicht mehr definiert");
  assert.ok(/offenGesamt > 0/.test(m[1]), `zeigeBanner fragt nicht nach offenGesamt: ${m[1]}`);
  assert.ok(/empfBesser/.test(m[1]), `zeigeBanner kennt den Ausnahmefall nicht: ${m[1]}`);
  assert.ok(/const empfBesser = [^;]*planFit/.test(roh),
    "empfBesser darf nur greifen, wenn der Plan die ganze Ladung haelt (planFit)");
});

test("der neue Text steht in beiden Sprachen", () => {
  const de = roh.indexOf('recBetter: (c) => /* @__PURE__ */ React.createElement(React.Fragment, null, "Es ginge auch mit "');
  const en = roh.indexOf('recBetter: (c) => /* @__PURE__ */ React.createElement(React.Fragment, null, "It would also fit in "');
  assert.ok(de > 0, "deutscher Text recBetter fehlt");
  assert.ok(en > 0, "englischer Text recBetter fehlt");
});
