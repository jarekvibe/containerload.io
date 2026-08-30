// Der Achslast-Richtwert fuer den Sattelzug.
//
// In jeder Fusszeile stand "keine Achslast-Garantie", und das war die ganze Antwort --
// dabei liegt alles Noetige laengst vor: die Laengsposition jedes Packstuecks und sein
// Gewicht. Jetzt rechnet achslasten() mit einer TYPISCHEN, offen ausgewiesenen Geometrie
// (ACHSEN) Stuetzlast und Aggregat-Last als Richtwert. Nur fuer den Sattelzug: fuer die
// uebrigen Fahrzeuge waere jede Geometrie geraten, also gibt es dort keine Zahl.
//
// Was dieser Test festhaelt: die STATIK ist exakt (die Naeherung steckt in den Konstanten,
// nicht in der Rechnung), die Konstanten ergeben die dokumentierte Groessenordnung, und
// die Oberflaeche liest die Sicht -- nicht den ersten Auflieger, wenn ein anderer im
// Fokus steht.
//
// node --test test/achslast.test.mjs
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
const { ACHSEN, achslasten } = new Function(
  cut("var ACHSEN = {", (l, i) => l.trim() === "}" && L[i - 1].includes("return { zapfen: m - aggregat"))
  + "\nreturn { ACHSEN, achslasten };"
)();

const A = ACHSEN["Planensattel"];
const w1 = () => 1000; // jedes Stueck 1 t

test("die Geometrie ist hinterlegt und traegt die dokumentierten Grenzen", () => {
  assert.ok(A, "kein Eintrag fuer den Planensattel");
  assert.strictEqual(A.zapfenMax, 11000, "EU-typische Sattellast");
  assert.strictEqual(A.aggregatMax, 24000, "Dreifachachse nach Par. 34 StVZO");
  assert.ok(A.zapfen < A.aggregat, "der Zapfen liegt vor dem Aggregat");
  // Zapfen ~1,6 m hinter der Front, Zapfen-zu-Heck hoechstens 12,0 m (96/53/EG):
  assert.ok(A.zapfen >= 150 && A.zapfen <= 175, `Zapfen bei ${A.zapfen} cm`);
  assert.ok(1362 - A.zapfen <= 1210, "Zapfen-zu-Heck ueber 12,0 m -- das faehrt so nicht");
});

test("leer kommt die Groessenordnung realer Auflieger heraus", () => {
  const r = achslasten([], w1, A);
  assert.strictEqual(r.gesamt, A.tara);
  assert.strictEqual(r.ladung, 0);
  // ~1,5 t Stuetzlast leer -- genau darauf ist taraSp gelegt, und diese Zusage haelt
  // der Test fest, damit niemand die Konstante verschiebt, ohne es zu merken.
  assert.ok(r.zapfen > 1200 && r.zapfen < 1900, `leere Stuetzlast ${Math.round(r.zapfen)} kg`);
  assert.ok(Math.abs(r.zapfen + r.aggregat - A.tara) < 1e-6, "Kraeftegleichgewicht leer");
});

test("die Statik ist exakt: Kraefte- und Momentengleichgewicht fuer jede Ladung", () => {
  let seed = 7;
  const rnd = () => ((seed = (seed * 1103515245 + 12345) & 2147483647) / 2147483647);
  for (let f = 0; f < 50; f++) {
    const placed = [], gew = [];
    for (let i2 = 0; i2 < 1 + Math.floor(rnd() * 12); i2++) {
      placed.push({ ti: i2, x: Math.floor(rnd() * 1200), dx: 60 + Math.floor(rnd() * 120) });
      gew.push(Math.floor(rnd() * 2000));
    }
    const wf = (ti) => gew[ti];
    const r = achslasten(placed, wf, A);
    // Summe der Stuetzkraefte = Gesamtgewicht.
    const soll = A.tara + gew.reduce((a2, b2) => a2 + b2, 0);
    assert.ok(Math.abs(r.zapfen + r.aggregat - soll) < 1e-6, `Fall ${f}: Kraefte`);
    // Momentengleichgewicht um das AGGREGAT (unabhaengig nachgerechnet -- die Funktion
    // selbst bilanziert um den Zapfen; stimmen beide, stimmt die Statik).
    let mom = A.tara * (A.aggregat - A.taraSp);
    placed.forEach((p) => { mom += gew[p.ti] * (A.aggregat - (p.x + p.dx / 2)); });
    assert.ok(Math.abs(r.zapfen * (A.aggregat - A.zapfen) - mom) < 1e-4, `Fall ${f}: Momente`);
  }
});

test("die Rechnung sagt das Richtige: vorne drueckt den Zapfen, hinten das Aggregat", () => {
  const vorn = achslasten([{ ti: 0, x: 0, dx: 100 }], () => 10000, A);
  const hinten = achslasten([{ ti: 0, x: 1260, dx: 100 }], () => 10000, A);
  assert.ok(vorn.zapfen > hinten.zapfen, "vorne muss mehr auf dem Zapfen liegen");
  assert.ok(hinten.aggregat > vorn.aggregat, "hinten muss mehr auf dem Aggregat liegen");
  // Ein Stueck GENAU ueber der Aggregat-Mitte laesst den Zapfen unberuehrt.
  const drauf = achslasten([{ ti: 0, x: A.aggregat - 50, dx: 100 }], () => 10000, A);
  const leer = achslasten([], w1, A);
  assert.ok(Math.abs(drauf.zapfen - leer.zapfen) < 1e-6, "Last ueber dem Aggregat aendert den Zapfen nicht");
  // Und weit hinter dem Aggregat wird der Zapfen NEGATIV -- das ist die Warnung, kein Fehler.
  const heck = achslasten(Array.from({ length: 8 }, (_, i2) => ({ ti: i2, x: 1250, dx: 100 })), () => 3000, A);
  assert.ok(heck.zapfen < leer.zapfen, "Hecklast entlastet den Zapfen");
});

// ── Der Vertrag im Quelltext ────────────────────────────────────────────────────────
test("die Oberflaeche liest die Sicht und zeigt die Annahmen sichtbar an", () => {
  assert.ok(/const achsGeo = domain === "road" \? ACHSEN\[fokusSlot \? fokusSlot\.name : preset\] : null;/.test(roh),
    "die Geometrie kommt nicht vom fokussierten Fahrzeug");
  assert.ok(/achslasten\(sichtPlaced,/.test(roh),
    "die Rechnung liest nicht die Sicht -- mit Fokus zeigte sie den falschen Auflieger");
  assert.ok(/T\.axleAssume/.test(roh), "die Annahmen stehen nicht sichtbar in der Oberflaeche");
  assert.ok(/achs\.zapfen < 0/.test(roh), "negative Stuetzlast wird nicht als Warnung gezeigt");
  for (const k of ["axleTitle", "axleKing", "axleGroup", "axleNeg", "axleAssume"]) {
    const n = (roh.match(new RegExp(`[{,\\n]\\s*${k}:`, "g")) || []).length;
    assert.strictEqual(n, 2, `${k} steht ${n}x in den Woerterbuechern, erwartet 2 (DE und EN)`);
  }
});
