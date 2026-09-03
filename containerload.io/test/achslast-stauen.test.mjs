// Achslast-bewusstes Stauen: liegt zu viel Gewicht auf dem Zapfen, setzt der Rechner die
// Ladung als GANZEN Block minimal nach hinten. Die Stauung selbst bleibt unangetastet --
// deshalb ist der Fuellgrad per Konstruktion unveraendert und dieser Test prueft nur die
// Verschiebung: Zielgenauigkeit, Minimalitaet, Deckelung, und dass die Anzeige die
// Verschiebung ausweist statt sie zu verschweigen.
//
// node --test test/achslast-stauen.test.mjs
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
const { ACHSEN, achslasten, achsShift } = new Function(
  cut("var ACHSEN = {", (l, i) => l.trim() === "}" && L[i - 1].includes("return dx > 0 ? dx : 0"))
  + "\nreturn { ACHSEN, achslasten, achsShift };"
)();

const A = ACHSEN["Planensattel"];
const LEN = 1362;
// k Reihen zu je zwei Stuecken (dx 120), Reihe fuer Reihe ab der Stirnwand -- genau so
// staut der Packer schwere Paletten.
const reihen = (k) => {
  const p = [];
  for (let i = 0; i < 2 * k; i++) p.push({ x: Math.floor(i / 2) * 120, dx: 120, ti: 0 });
  return p;
};
const nachhinten = (placed, dx) => placed.map((p) => ({ ...p, x: p.x + dx }));

test("ueberladener Zapfen: die Verschiebung bringt ihn unter die Grenze, minimal", () => {
  const placed = reihen(10);            // 20 Stueck auf 12 m Flaeche? nein: 10 Reihen = 12,0 m? 10*120 = 1200 cm
  const w = () => 1100;                 // 22 t Ladung, vorn gestaut
  const vorher = achslasten(placed, w, A);
  assert.ok(vorher.zapfen > A.zapfenMax, `Testfall muss ueberladen sein (${Math.round(vorher.zapfen)} kg)`);
  const dx = achsShift(placed, w, A, LEN);
  assert.ok(dx > 0, "es muss geschoben werden");
  assert.ok(dx <= LEN - 1200, "Verschiebung sprengt den Laderaum");
  const nachher = achslasten(nachhinten(placed, dx), w, A);
  assert.ok(nachher.zapfen <= A.zapfenMax + 1e-9, `nachher ${nachher.zapfen} kg auf dem Zapfen`);
  assert.ok(nachher.aggregat <= A.aggregatMax + 1e-9, "Aggregat darf dabei nicht ueberlaufen");
  // Minimalitaet: ein Zentimeter weniger, und der Zapfen laege wieder drueber. Mehr als
  // noetig zu schieben waere Abstand zur Stirnwand ohne Not.
  const knapper = achslasten(nachhinten(placed, dx - 1), w, A);
  assert.ok(knapper.zapfen > A.zapfenMax, "die Verschiebung ist nicht minimal");
});

test("unter der Grenze wird NICHT geschoben", () => {
  // Dieselbe Stauung, leichtere Ware: der Formschluss an der Stirnwand bleibt.
  const placed = reihen(10);
  assert.ok(achslasten(placed, () => 900, A).zapfen <= A.zapfenMax, "Gegenprobe braucht einen legalen Fall");
  assert.strictEqual(achsShift(placed, () => 900, A, LEN), 0);
  // Und ganz ohne Gewichte gibt es nichts zu rechnen.
  assert.strictEqual(achsShift(placed, () => 0, A, LEN), 0);
});

test("ohne Platz hinter der Ladung wird gedeckelt -- und ehrlich rot gelassen", () => {
  const placed = reihen(11); // 13,2 m belegt, 16,2 cm frei? 1362-1320 = 42 cm frei
  const w = () => 1100;
  const vorher = achslasten(placed, w, A);
  assert.ok(vorher.zapfen > A.zapfenMax, "Testfall muss ueberladen sein");
  const dx = achsShift(placed, w, A, LEN);
  assert.ok(dx > 0 && dx <= 42, `Deckel ist der freie Platz (${dx} cm)`);
  const nachher = achslasten(nachhinten(placed, dx), w, A);
  assert.ok(nachher.zapfen < vorher.zapfen, "auch gedeckelt muss es besser werden");
  // Bei vollem Laderaum (kein einziger cm frei) passiert nichts.
  const voll = [];
  for (let i = 0; i < 22; i++) voll.push({ x: Math.floor(i / 2) * 120, dx: i >= 20 ? 162 : 120, ti: 0 });
  assert.strictEqual(achsShift(voll, w, A, LEN), 0);
});

test("die Statik stimmt auch nach der Verschiebung: unabhaengige Momentenbilanz", () => {
  // 40 Zufallsladungen; die Bilanz wird NICHT mit achslasten() gerechnet, sondern mit
  // einer eigenen Momentensumme um das AGGREGAT -- ein anderer Drehpunkt als im Produkt.
  let rnd = 4242;
  const zufall = () => (rnd = rnd * 1103515245 + 12345 & 2147483647) / 2147483647;
  for (let fall = 0; fall < 40; fall++) {
    const n = 4 + Math.floor(zufall() * 14);
    const placed = [];
    const gw = [];
    for (let i = 0; i < n; i++) {
      placed.push({ x: Math.floor(zufall() * 800), dx: 60 + Math.floor(zufall() * 120), ti: i });
      gw.push(200 + Math.floor(zufall() * 1400));
    }
    const w = (ti) => gw[ti];
    const dx = achsShift(placed, w, A, LEN);
    const fertig = dx > 0 ? nachhinten(placed, dx) : placed;
    const a = achslasten(fertig, w, A);
    // Kraeftegleichgewicht:
    const gesamt = A.tara + gw.reduce((s, x) => s + x, 0);
    assert.ok(Math.abs(a.zapfen + a.aggregat - gesamt) < 1e-6, `Fall ${fall}: Kraefte`);
    // Momentenbilanz um das Aggregat: zapfen * D muss die Summe der Hebel treffen.
    let momAgg = A.tara * (A.aggregat - A.taraSp);
    for (const p of fertig) momAgg += w(p.ti) * (A.aggregat - (p.x + p.dx / 2));
    assert.ok(Math.abs(a.zapfen * (A.aggregat - A.zapfen) - momAgg) < 1e-6, `Fall ${fall}: Momente`);
  }
});

test("der Rechner wendet die Verschiebung nur auf der Strasse an und weist sie aus", () => {
  // Vertraege im Quelltext -- die React-App laeuft hier nicht.
  assert.ok(roh.includes('if (domain === "road" && r.chain) {'), "Anwendung ist nicht auf die Landfracht begrenzt");
  assert.ok(roh.includes("const dx = achsShift(slot.placed, wOf, A, L);"), "Kette wird nicht je Slot geschoben");
  assert.ok(roh.includes("slot.achsShift = dx;"), "die Verschiebung wird nicht am Slot vermerkt");
  assert.ok(roh.includes("new WeakSet()"), "ohne WeakSet wandern geteilte Objekte doppelt");
  // Die Anzeige sagt es dazu -- still verschoben saehe aus wie ein Packfehler.
  assert.ok(roh.includes("achsRuecke > 0 && /* @__PURE__ */ React.createElement"), "Anzeige-Zeile fehlt");
  assert.ok(roh.includes("nach hinten gesetzt, sonst l\\xE4ge zu viel Gewicht"), "deutscher Text fehlt");
  assert.ok(roh.includes("towards the rear, otherwise too much weight"), "englischer Text fehlt");
});
