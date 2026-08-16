// Haelt das Regelwerk aus PR #57 im Rechner fest.
//
// Warum ein Test und keine Notiz: Eine Oberflaeche sieht nicht deshalb generiert aus, weil ein
// einzelner Wert falsch ist, sondern weil sich ueber viele kleine Aenderungen hinweg zwoelf
// Eckenradien, vierzehn Schriftgroessen und ein Dutzend fast gleicher Dunkelgraus ansammeln.
// Jede einzelne Entscheidung wirkt harmlos; die Summe ist der Fingerabdruck. Dieser Test macht
// die Summe sichtbar, bevor sie im Bild landet.
//
// Wer eine Stufe WIRKLICH braucht, traegt sie hier ein — dann ist es eine Entscheidung
// und kein Versehen. Genau das ist der Unterschied.
import fs from "node:fs";
import assert from "node:assert";
import test from "node:test";
import { fileURLToPath } from "node:url";
import path from "node:path";

const dir = path.dirname(fileURLToPath(import.meta.url));
const app = fs.readFileSync(path.join(dir, "..", "app.html"), "utf8");

// Werte, die absichtlich ausserhalb der Reihe stehen, mit Grund.
const AUSNAHMEN = new Set([
  "#0c1320", "#0b1119",                          // Strichfarben der Druckvorlage auf weissem Papier
  "#c50619", "#8e040f",                          // Markenakzent und die dunkle Wuerfelflaeche
  "#fff6f2",                                     // Text auf Akzent- bzw. Hinweisflaeche
  "#1a0f08",                                     // warmer Grund der Tuer-Warnung
  // Die 3D-Buehne: Verlaufsstops, Stahltoene und Kantenlinien des Containers. Sie sind keine
  // Flaechenstufen der Oberflaeche, sondern das Bild darin - eigene Treppe, eigener Zweck.
  "#14161a", "#17181c", "#0c1622", "#0d1726", "#08111c", "#1a1a1a", "#1b1b1b", "#202020", "#2d2d2d",
  "#3f3f3f", "#434343", "#444444", "#474747", "#4d4d4d",
  "#000000"
]);

test("es bleibt bei sechs Flaechenstufen", () => {
  const gezaehlt = new Set();
  for (const roh of app.match(/#[0-9A-Fa-f]{6}\b/g) || []) {
    const h = roh.toLowerCase();
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
    if ((r + g + b) / 3 >= 0x50) continue;      // nur dunkle Flaechen und Linien
    if (AUSNAHMEN.has(h)) continue;
    gezaehlt.add(h);
  }
  assert.ok(gezaehlt.size <= 6,
    `${gezaehlt.size} dunkle Werte statt hoechstens 6: ${[...gezaehlt].join(", ")}\n` +
    "Neue Zwischentoene sammeln sich an, bis kein Rahmen mehr etwas bedeutet. " +
    "Entweder eine bestehende Stufe nehmen oder hier bewusst eintragen.");
});

test("Eckenradien kommen aus einer Reihe: 8, 12, 16, Pille", () => {
  const erlaubt = new Set(["8", "12", "16", "999"]);
  const falsch = [...new Set((app.match(/borderRadius: [\d.]+/g) || []).map((m) => m.split(" ")[1]))]
    .filter((v) => !erlaubt.has(v));
  assert.deepStrictEqual(falsch, [], `Radien ausserhalb der Reihe: ${falsch.join(", ")} (8 klein, 12 Karte, 16 Dialog, 999 Pille)`);
});

test("Schriftgroessen kommen aus einer Reihe, und nichts ist kleiner als 11", () => {
  const erlaubt = new Set(["11", "12.5", "13.5", "15", "17", "23", "26"]);
  const werte = [...new Set((app.match(/fontSize: [\d.]+/g) || []).map((m) => m.split(" ")[1]))];
  const falsch = werte.filter((v) => !erlaubt.has(v));
  assert.deepStrictEqual(falsch, [], `Groessen ausserhalb der Reihe: ${falsch.join(", ")}`);
  const winzig = werte.filter((v) => parseFloat(v) < 11);
  assert.deepStrictEqual(winzig, [], `Text unter 11px liest niemand, er sieht nur technisch aus: ${winzig.join(", ")}`);
});

test("Schriftgewicht hoert bei 700 auf", () => {
  const schwer = app.match(/fontWeight: (800|900)|font-weight:\s*(800|900)/g) || [];
  assert.deepStrictEqual(schwer, [], `${schwer.length}× Gewicht ueber 700 — die Landingpage hoert bei 700 auf`);
});

test("Monospace nur an Zahlen, nicht als Kostuem", () => {
  // Monospace hat einen Zweck: Ziffern bleiben untereinander stehen. In kleinen Groessen steht
  // im Rechner aber Text — und der sieht in Schreibmaschinenschrift nur "technisch" aus.
  const paare = [...app.matchAll(/fontFamily: MONO[^}]*?fontSize: ([\d.]+)|fontSize: ([\d.]+)[^}]*?fontFamily: MONO/g)]
    .map((m) => parseFloat(m[1] || m[2]));
  const zuKlein = paare.filter((g) => g < 12.5);
  assert.deepStrictEqual(zuKlein, [], `Monospace in ${zuKlein.join(", ")}px — dort steht Text, kein Mass`);
});

test("keine Emoji in der Oberflaeche", () => {
  const treffer = app.match(/[\u{1F300}-\u{1FAFF}]/gu) || [];
  assert.deepStrictEqual(treffer, [], `Emoji gefunden: ${treffer.join(" ")} — Linien-SVG oder Wort statt Bildchen`);
});

test("angezeigte Zahlen kennen die Sprache", () => {
  // toFixed liefert immer den englischen Punkt. In einer deutschen Oberflaeche ist "0.03 m"
  // das erste, was auffaellt. Erlaubt bleibt es nur dort, wo die Zahl kein Anzeigetext ist.
  const erlaubt = [
    /FL\.toFixed\(1\)/,          // Schluessel im Packer, keine Anzeige
    /FW\.toFixed\(1\)/,          // dito
    /\.toFixed\(0\)/             // Prozentwerte: ohne Nachkomma gibt es kein Trennzeichen
  ];
  const zeilen = app.split("\n");
  const treffer = [];
  zeilen.forEach((z, i) => {
    for (const m of z.match(/[\w.()+\-*/ ]{0,40}\.toFixed\(\d\)/g) || []) {
      if (erlaubt.some((re) => re.test(m))) continue;
      treffer.push(`Zeile ${i + 1}: ${m.trim()}`);
    }
  });
  assert.deepStrictEqual(treffer, [], `toFixed in der Anzeige — nf()/fmtDE() nehmen:\n${treffer.join("\n")}`);
});
