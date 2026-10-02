// "Voll" zeigt die engere Grenze: Raum oder Gewicht.
//
// Vorher war "Voll" in der Seefracht schlicht die Volumenauslastung. Zwei Dinge daran
// waren falsch: Die Zahl wiederholte die Volumen-Kachel daneben ("Voll 44 %" neben
// "33,5 / 76,3 m3" -- dasselbe), und bei schwerer Ware log sie. Die Farbe kannte das
// Gewicht laengst (railHot = max(Raum, Gewicht)), die Zahl nicht: bei Stahl stand
// "Voll 15 %" in Orange, waehrend der Container vom Gewicht her fast voll war.
//
// Jetzt liefert vollGrenze() die Grenze, die zuerst erreicht ist, und Leiste, Balken,
// Tabelle je Container und PDF-Uebersicht lesen alle diese eine Funktion.
//
// node --test test/voll-engere-grenze.test.mjs
import fs from "node:fs";
import assert from "node:assert";
import test from "node:test";
import { fileURLToPath } from "node:url";
import path from "node:path";

const dir = path.dirname(fileURLToPath(import.meta.url));
const roh = fs.readFileSync(path.join(dir, "..", "app.html"), "utf8");

const schnitt = (von, bis) => {
  const a = roh.indexOf(von);
  assert.ok(a >= 0, `nicht gefunden: ${von}`);
  const b = roh.indexOf(bis, a);
  assert.ok(b > a, `Ende nicht gefunden: ${bis}`);
  return roh.slice(a, b + bis.length);
};
const numQ = schnitt("var num = (v, d = 0) =>", ";\n");
const vollQ = schnitt("var vollGrenze = (raumPct, gewPct) => {", "\n  };");
const vollGrenze = new Function(numQ + vollQ + "\nreturn vollGrenze;")();

test("leichte Ware: der Raum bindet, die Zahl bleibt die alte", () => {
  assert.deepStrictEqual(vollGrenze(44, 25), { pct: 44, nach: "raum" });
});

test("schwere Ware: das Gewicht bindet -- kein 'Voll 15 %' mehr bei fast vollem Gewicht", () => {
  // 20 Stahlcoils im 20': wenig Volumen, fast die ganze Zuladung.
  assert.deepStrictEqual(vollGrenze(15, 97.5), { pct: 97.5, nach: "gewicht" });
});

test("Gleichstand: der Raum gilt -- die Beschriftung springt nicht ohne Grund um", () => {
  assert.deepStrictEqual(vollGrenze(60, 60), { pct: 60, nach: "raum" });
});

test("leere oder kaputte Eingaben ergeben 0 % Raum, nie NaN", () => {
  assert.deepStrictEqual(vollGrenze(0, 0), { pct: 0, nach: "raum" });
  assert.deepStrictEqual(vollGrenze(NaN, undefined), { pct: 0, nach: "raum" });
  assert.deepStrictEqual(vollGrenze(-5, 10), { pct: 10, nach: "gewicht" });
});

test("ueber 100 % Gewicht bleibt sichtbar (manuell ueberladen)", () => {
  assert.strictEqual(vollGrenze(40, 104).pct, 104);
});

// ── Der Vertrag im Quelltext: alle Anzeigen lesen dieselbe Grenze ──────────────
test("die Leiste: Zahl, Farbe und Balken erzaehlen dieselbe Grenze", () => {
  assert.ok(roh.includes("const voll = vollGrenze(primaryMeter.pct, payPct);"),
    "die Leiste rechnet 'Voll' nicht mehr ueber vollGrenze");
  assert.ok(roh.includes("const railHot = voll.pct >= 90;"),
    "die Warnfarbe haengt nicht mehr an derselben Zahl, die angezeigt wird");
  assert.ok(roh.includes("value: `${Math.round(voll.pct)}`, sub: \"%\", accent: railColor"),
    "die Kachel zeigt nicht die engere Grenze");
  assert.ok(roh.includes("width: Math.min(100, voll.pct) + \"%\", background: railColor"),
    "der Balken unter der Leiste zeigt eine andere Zahl als die Kachel");
});

test("bindet das Gewicht, sagt die Beschriftung es -- in beiden Sprachen", () => {
  assert.ok(roh.includes('label: voll.nach === "gewicht" ? T.railFullKg : T.railFull'),
    "die Beschriftung nennt die bindende Grenze nicht");
  assert.ok(roh.includes('railFullKg: "Voll \\xB7 Gewicht"'), "deutsche Beschriftung fehlt");
  assert.ok(roh.includes('railFullKg: "Full \\xB7 weight"'), "englische Beschriftung fehlt");
  // Beide Werte stehen im title -- niemand soll rechnen muessen, wie weit die andere Grenze weg ist.
  assert.ok(roh.includes("title: T.railFullTitle(domain === \"road\", Math.round(primaryMeter.pct), Math.round(payPct))"),
    "der title nennt nicht beide Grenzen");
  assert.ok(roh.includes("title: s.title }"), "die Leiste reicht den title nicht an die Kachel durch");
});

test("Tabelle je Container und PDF-Uebersicht lesen dieselbe Funktion", () => {
  assert.ok(roh.includes("vollPct: vollGrenze(raumPct, pPct).pct,"),
    "slotRows rechnet 'Voll' anders als die Leiste");
  // Die PDF-Uebersicht bekommt slotRows -- sie erbt die Regel, statt sie nachzubauen.
  assert.ok(roh.includes("LV_UEBERSICHT(slotRows, LANG)"),
    "die PDF-Uebersicht liest nicht mehr slotRows");
});
