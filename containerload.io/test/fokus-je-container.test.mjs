// Der Fokus: worueber die Oberflaeche gerade spricht.
//
// Gemeldet: "das Tool ist aktuell mehr darauf ausgelegt, die Darstellung fuer EINEN
// Container zu machen, wir sollten uns aber auch darum kuemmern, wie es ist wenn mehrere
// Container zustande kommen".
//
// Nachgesehen: neun Stellen im Rechner nahmen sich den erstbesten Container, weil es keinen
// Begriff dafuer gab, welcher gemeint ist. Der Fokus ist dieser Begriff -- eine einzige
// Zustandsvariable, "alle" oder ein Index.
//
// Die wichtigste Zusage dabei ist eine NEGATIVE: der Fokus aendert keine einzige Zahl. Er
// aendert nur, welche gezeigt wird. Deshalb prueft dieser Test zweierlei -- die Arithmetik
// der Sicht (gerechnet, gegen die echte Kette) und den Vertrag im Quelltext (dass app.html
// sie auch benutzt). Eine nachgebaute Rechnung allein sagt nichts darueber, was die
// Oberflaeche liest.
//
// node --test test/fokus-je-container.test.mjs
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
const { chainContainers, packCargo, PRESETS, MAXCHAIN } = new Function(
  `var num=(v,d=0)=>Number.isFinite(+v)&&v!==""?+v:d;
   var applyCarrier=(p)=>p;
   ${cut("var PRESETS = {", (l) => l.includes("var panelsFor"))}
   ${cut("function makeFloorPacker", (l, i) => l.trim() === "}" && L[i - 1].includes("single: false"))}
   ${cut("var MAXCHAIN", (l, i) => l.trim() === "}" && L[i - 1].includes("return { chain, remainingBoxes"))}
   return { chainContainers, packCargo, PRESETS, MAXCHAIN };`
)();

// Die gemeldete Sendung: 9 flache Stuecke "nicht stapelbar" + 22 Paletten -> 40' HC + 40' GP.
const CARGO = [
  { name: "Package", l: 250, w: 80, h: 30, qty: 9, weight: 300, stackable: false },
  { name: "Package", l: 120, w: 80, h: 110, qty: 22, weight: 300, stackMax: 3 },
];
const kette = (preset, cargo) => {
  const c0 = PRESETS[preset];
  const r0 = packCargo(c0, cargo, {});
  return { c0, r0, ch: chainContainers(c0, preset, cargo, r0, {}, MAXCHAIN) };
};

// Dieselben Formeln wie sichtPerType / slotRows in app.html.
const jeSorte = (slot, cargo) => cargo.map((t, i) => (slot.placed || []).filter((b) => b.ti === i).length);
const volKg = (slot, cargo) => {
  let vol = 0, kg = 0;
  (slot.placed || []).forEach((b) => { vol += b.dx * b.dy * b.dz / 1e6; kg += Math.max(0, +cargo[b.ti].weight || 0); });
  return { vol, kg };
};

test("die Sichten summieren sich auf den Plan -- der Fokus verliert nichts", () => {
  const { ch } = kette("40' HC", CARGO);
  assert.ok(ch.chain.length > 1, "fuer diesen Test braucht es eine Kette");

  const summeJeSorte = CARGO.map(() => 0);
  let summeStk = 0, summeVol = 0, summeKg = 0;
  ch.chain.forEach((slot) => {
    jeSorte(slot, CARGO).forEach((n, i) => { summeJeSorte[i] += n; });
    const { vol, kg } = volKg(slot, CARGO);
    summeStk += (slot.placed || []).length;
    summeVol += vol; summeKg += kg;
  });

  // 1) Stueckzahlen je Sorte = die Bilanz, die die Kette selbst fuehrt (kettenBilanz).
  ch.perType.forEach((pt, i) => {
    assert.strictEqual(summeJeSorte[i], pt.loaded,
      `Sorte ${i}: die Sichten zaehlen ${summeJeSorte[i]}, die Kettenbilanz ${pt.loaded}`);
  });
  // 2) Nichts geht verloren und nichts kommt dazu.
  const gesamt = CARGO.reduce((s, t) => s + t.qty, 0);
  assert.strictEqual(summeStk + ch.remainingBoxes, gesamt,
    `${summeStk} verladen + ${ch.remainingBoxes} offen sind nicht ${gesamt}`);
  // 3) Gewicht der Sichten = Gewicht der verladenen Ware.
  assert.strictEqual(Math.round(summeKg), summeStk * 300);
  assert.ok(summeVol > 0);
});

test("jede Sicht steht fuer sich: kein Stueck zaehlt in zwei Containern", () => {
  let seed = 31;
  const rnd = () => ((seed = (seed * 1103515245 + 12345) & 2147483647) / 2147483647);
  const ri = (a, b) => a + Math.floor(rnd() * (b - a + 1));
  const namen = Object.keys(PRESETS).filter((n) => !PRESETS[n].kind || PRESETS[n].kind === "dry");
  let mitKette = 0;
  for (let i = 0; i < 40; i++) {
    const preset = namen[ri(0, namen.length - 1)];
    const cargo = [];
    for (let t = 0; t < ri(1, 4); t++) {
      cargo.push({ name: "T" + t, l: ri(40, 300), w: ri(30, 140), h: ri(20, 160), weight: ri(20, 900),
        qty: ri(3, 40), rotatable: rnd() < 0.85, stackable: rnd() < 0.75 });
    }
    const { ch } = kette(preset, cargo);
    if (ch.chain.length > 1) mitKette++;
    const summe = cargo.map(() => 0);
    ch.chain.forEach((slot) => jeSorte(slot, cargo).forEach((n, k) => { summe[k] += n; }));
    ch.perType.forEach((pt, k) => {
      assert.strictEqual(summe[k], pt.loaded,
        `Fall ${i} (${preset}), Sorte ${k}: Sichten ${summe[k]} gegen Kettenbilanz ${pt.loaded}`);
    });
    cargo.forEach((t, k) => {
      assert.ok(summe[k] <= Math.floor(t.qty), `Fall ${i}: Sorte ${k} kommt oefter vor als eingegeben`);
    });
  }
  assert.ok(mitKette >= 15, `nur ${mitKette} Faelle mit mehr als einem Container`);
});

// ── Der Vertrag im Quelltext ────────────────────────────────────────────────────────
test("die Leiste liest die Sicht und nicht mehr das Ergebnis des ersten Containers", () => {
  const kpi = (name, muster) => {
    const m = roh.match(new RegExp(`const ${name} = [\\s\\S]{0,400}?;\\n`));
    assert.ok(m, `${name} nicht gefunden`);
    assert.ok(muster.test(m[0]), `${name} liest nicht die Sicht: ${m[0].trim().slice(0, 150)}`);
  };
  kpi("kpiLoaded", /sichtBoxes/);
  kpi("kpiWeight", /sichtKg[\s\S]*sichtCont\.payload/);
  kpi("kpiVol", /sichtVol[\s\S]*sichtContVol/);
  kpi("kpiLayers", /sichtLagen/);
  assert.ok(/const utilColor = sichtUtil > 80/.test(roh), "die Auslastungsfarbe haengt wieder am ersten Container");
  assert.ok(/const payPct = num\(sichtCont\.payload\) > 0 \? sichtKg/.test(roh), "die Zuladungsampel haengt wieder am ersten Container");
  assert.ok(/const cog = computeLongCog\(sichtPlaced,[\s\S]{0,120}?num\(sichtCont\.l\)\);/.test(roh), "der Schwerpunkt rechnet wieder gegen den ersten Container");
  // Seit Schritt 06 ohne Sonderweg fuer den manuellen Modus: dort ist result die von Hand
  // gestaute Kette, und sichtPlaced damit ohnehin der Container, um den es geht.
  assert.ok(/const doorPlaced = sichtPlaced;/.test(roh), "die Tuerpruefung prueft wieder den ersten Container");
});

test("ohne Fokus bleibt alles, wie es war", () => {
  // sichtCont/sichtPlaced fallen ohne Fokus auf genau das zurueck, was vorher dastand.
  assert.ok(/const sichtCont = fokusSlot \? fokusSlot\.preset : container;/.test(roh));
  assert.ok(/const sichtPlaced = fokusSlot \? fokusSlot\.placed \|\| \[\] : result\.placed \|\| \[\];/.test(roh));
  // Und die Marke "C1" verschwindet nur MIT Fokus -- ohne ihn ist sie weiterhin noetig,
  // weil die Leiste dann wieder nur den ersten Container zaehlt.
  assert.ok(/const slot1 = !fokusSlot && result\.chain && result\.chain\.length > 1/.test(roh),
    "die C1-Marke haengt nicht am Fokus");
});

test("der Fokus zeigt nie auf einen Container, den es nicht gibt", () => {
  const m = roh.match(/useEffect\(\(\) => \{\s*if \(fokus === "alle"\) return;[\s\S]{0,400}?\}, \[result, fokus\]\);/);
  assert.ok(m, "der Waechter fuer den Fokus fehlt");
  assert.ok(/result\.chain \? result\.chain\.length : 0/.test(m[0]), "der Waechter misst nicht die Kettenlaenge");
  assert.ok(/if \(!\(fokus < n\)\) setFokus\("alle"\)/.test(m[0]),
    "der Waechter faellt nicht auf 'alle' zurueck");
  // Der manuelle Modus stand hier bis Schritt 06 mit in der Bedingung -- er klappte die Kette
  // auf einen Container zusammen. Seit er selbst mehrere stellt, gilt fuer ihn dieselbe Regel.
  assert.ok(!/manualMode/.test(m[0]),
    "der Waechter wirft den Fokus im manuellen Modus weg -- der kennt seit Schritt 06 mehrere Container");
});

test("im Bild verschwindet die Ladung der anderen, nicht ihre Huelle", () => {
  const m = roh.match(/const fokusAnwenden = \(fk\) => \{[\s\S]{0,1200}?\n    \};/);
  assert.ok(m, "fokusAnwenden fehlt");
  const f = m[0];
  assert.ok(/bm\.inst\.visible = an/.test(f), "die Instanzsaetze der anderen Container werden nicht ausgeblendet");
  assert.ok(/o\.userData && o\.userData\.ladung/.test(f), "die Kantenlinien der Ladung bleiben stehen");
  assert.ok(!/matSide|matEndA|material\.opacity/.test(f),
    "an den Huellen-Materialien wird gedreht -- die sind zwischen gleich grossen Containern GETEILT");
  assert.ok(/camFit\(z\.hx, z\.hy, z\.hz/.test(f), "die Kamera passt nicht auf den fokussierten Container ein");
  assert.ok(/t\.frame\.slots/.test(f), "die Einpassung nimmt nicht die vorgerechneten Slot-Rahmen");
  // Und der Fokus baut die Szene NICHT neu -- sonst laeuft die Aufbau-Animation jedes Mal.
  assert.ok(/useEffect\(\(\) => \{ fokusAnwenden\(fokus\); \}, \[fokus, result\]\);/.test(roh),
    "der Fokuswechsel haengt nicht an einem eigenen Effekt");
});

test("beide Sprachen kennen die neuen Woerter", () => {
  for (const k of ["fokusAlle", "fokusAlleTitel", "fokusEinTitel"]) {
    const n = (roh.match(new RegExp("\\n\\s*" + k + ":", "g")) || []).length;
    assert.strictEqual(n, 2, `${k} steht ${n}x da statt zweimal (deutsch und englisch)`);
  }
});
