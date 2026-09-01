// Die Belade-Reihenfolge im Ladevorschlag.
//
// Der Stauplan sagt, WO alles steht. An der Rampe braucht die Crew aber die andere
// Haelfte: in welcher REIHENFOLGE es hineinkommt. LV_SEQUENZ macht daraus eine
// nummerierte Liste -- Stirnwand zuerst, Tuer zuletzt, unten vor oben, aufeinander-
// folgende Stuecke derselben Sorte als EIN Schritt.
//
// node --test test/belade-reihenfolge.test.mjs
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
const { LV_SEQUENZ } = new Function(
  'var escHTML = (t) => String(t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", \'"\': "&quot;" })[c]);\n'
  + cut("var LV_SEQUENZ = (placed", (l, i) => l.trim() === "};" && L[i - 1].includes("</div>`;"))
  + "\nreturn { LV_SEQUENZ };"
)();

const CARGO = [{ name: "Palette" }, { name: "Flach" }];
const FARBEN = { 0: "#123456", 1: "#654321" };
// Absichtlich UNSORTIERT uebergeben: zwei Stapel Paletten vorne (x 0 und 120),
// dahinter zwei flache Stuecke. Die Funktion muss selbst ordnen.
const PLACED = [
  { ti: 1, x: 260, y: 0, z: 0, dx: 250 },
  { ti: 0, x: 120, y: 0, z: 0, dx: 120 },
  { ti: 0, x: 0, y: 110, z: 0, dx: 120 },
  { ti: 0, x: 0, y: 0, z: 0, dx: 120 },
  { ti: 1, x: 260, y: 0, z: 90, dx: 250 },
];

test("gruppiert nach Laeufen, sortiert von der Stirnwand zur Tuer", () => {
  const html = LV_SEQUENZ(PLACED, CARGO, "de", FARBEN);
  // Zwei Schritte: erst 3x Palette (x 0-240), dann 2x Flach (x 260-510).
  assert.ok(html.includes("3× Palette"), "die drei Paletten sind kein einzelner Schritt");
  assert.ok(html.includes("2× Flach"), "die zwei flachen Stuecke sind kein einzelner Schritt");
  assert.ok(html.indexOf("3× Palette") < html.indexOf("2× Flach"),
    "die Stirnwand-Gruppe muss VOR der Tuer-Gruppe stehen");
  assert.ok(html.includes("01") && html.includes("02"), "die Schritte sind nicht nummeriert");
  // Die Spannen in Metern, deutsches Komma: 0,0-2,4 m und 2,6-5,1 m.
  assert.ok(html.includes("0,0–2,4"), `Spanne der Paletten fehlt: ${html.slice(0, 400)}`);
  assert.ok(html.includes("2,6–5,1"), "Spanne der flachen Stuecke fehlt");
  assert.ok(html.includes("BELADE-REIHENFOLGE"));
});

test("englisch heisst englisch, mit Punkt als Dezimaltrenner", () => {
  const html = LV_SEQUENZ(PLACED, CARGO, "en", FARBEN);
  assert.ok(html.includes("LOADING SEQUENCE"));
  assert.ok(html.includes("0.0–2.4"), "englische Dezimalpunkte fehlen");
  assert.ok(!html.includes("Stirnwand"), "deutscher Text im englischen Dokument");
});

test("unten kommt vor oben -- ein Stapel ist EIN Schritt von unten her", () => {
  // Zwei Sorten abwechselnd im selben Stellplatz: unten Palette, oben Flach, daneben
  // dasselbe. Reihenfolge x, dann y: P(0,unten), F(0,oben), P(120,unten), F(120,oben)
  // -> VIER Schritte. Genau das soll die Liste sagen, nicht "2x P, dann 2x F".
  const stapel = [
    { ti: 1, x: 0, y: 110, z: 0, dx: 120 },
    { ti: 0, x: 0, y: 0, z: 0, dx: 120 },
    { ti: 1, x: 130, y: 110, z: 0, dx: 120 },
    { ti: 0, x: 130, y: 0, z: 0, dx: 120 },
  ];
  const html = LV_SEQUENZ(stapel, CARGO, "de", FARBEN);
  assert.strictEqual((html.match(/1× /g) || []).length, 4, "vier einzelne Schritte erwartet");
  const erste = html.indexOf("1× Palette"), zweite = html.indexOf("1× Flach");
  assert.ok(erste >= 0 && zweite > erste, "unten (Palette) muss vor oben (Flach) stehen");
});

test("eine lange Liste wird gekappt und sagt es", () => {
  const viele = Array.from({ length: 40 }, (_, i) => ({ ti: i % 2, x: i * 30, y: 0, z: 0, dx: 25 }));
  const html = LV_SEQUENZ(viele, CARGO, "de", FARBEN);
  assert.strictEqual((html.match(/border-bottom:1px solid #f0f1f4/g) || []).length, 16,
    "mehr als 16 Zeilen gezeichnet");
  assert.ok(/\+ 24 weitere Schritte/.test(html), "der Rest wird verschwiegen");
});

test("bei weniger als zwei Stuecken gibt es nichts zu ordnen", () => {
  assert.strictEqual(LV_SEQUENZ([], CARGO, "de", FARBEN), "");
  assert.strictEqual(LV_SEQUENZ([{ ti: 0, x: 0, y: 0, z: 0, dx: 100 }], CARGO, "de", FARBEN), "");
});

test("Namen werden escaped -- eine Position heisst, was jemand eintippt", () => {
  const html = LV_SEQUENZ(PLACED, [{ name: '<img src=x onerror=1>' }, { name: "B" }], "de", FARBEN);
  assert.ok(!html.includes("<img"), "der Positionsname landet ungefiltert im Dokument");
});

// ── Der Vertrag im Quelltext ────────────────────────────────────────────────────────
test("beide Blattsorten haengen die Reihenfolge an den Stauplan", () => {
  assert.ok(/: STOWAGE \+ LV_SEQUENZ\(placed, cargo, LANG, tiColor\),/.test(roh),
    "das einzelne Blatt traegt keine Reihenfolge");
  assert.ok(/chainLen: 1 \}\) \+ LV_SEQUENZ\(sp, cargo, LANG, tiC\),/.test(roh),
    "die Container-Blaetter tragen keine Reihenfolge");
});
