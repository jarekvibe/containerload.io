// Der Ladungssicherungs-Check: aus der gepackten Geometrie wird abgeleitet, WO
// gesichert werden muss -- Luecken (CTU-Code), Kippgefahr, Schwergut, Niederzurren
// (EN 12195-1). Alles Richtwerte mit sichtbaren Annahmen; dieser Test haelt die
// Geometrie und die Statik fest.
//
// node --test test/ladungssicherung.test.mjs
import fs from "node:fs";
import assert from "node:assert";
import test from "node:test";
import { fileURLToPath } from "node:url";
import path from "node:path";

const dir = path.dirname(fileURLToPath(import.meta.url));
const roh = fs.readFileSync(path.join(dir, "..", "app.html"), "utf8");
const L = roh.split("\n");
const von = L.findIndex((l) => l.includes("var SICH = {"));
const bis = L.findIndex((l, i) => i > von && l.trim() === "}" && L[i - 1].includes("gurte: Math.ceil"));
assert.ok(von > 0 && bis > von, "SICH-Ausschnitt nicht gefunden");
const { SICH, sichAnalyse, sichGurte } = new Function(L.slice(von, bis + 1).join("\n") + "\nreturn { SICH, sichAnalyse, sichGurte };")();

// Kleine Helfer: Quader bauen, Gewicht je ti nachschlagen.
const box = (x, z, dx, dz, ti = 0, y = 0, dy = 100) => ({ x, y, z, dx, dy, dz, ti });
const CONT = { l: 590, w: 235 };
const w0 = () => 500;

test("Laengsluecken und Tuerluecke kommen aus den echten Positionen", () => {
  // Zwei Bloecke mit 30 cm Loch dazwischen, danach 360 cm bis zur Tuer.
  const s = sichAnalyse([box(0, 0, 100, 235), box(130, 0, 100, 235)], w0, CONT, "sea");
  assert.strictEqual(s.laengs.length, 1);
  const [a, b] = s.laengs[0];
  assert.strictEqual(b - a, 30);
  assert.strictEqual(a, 100);
  assert.ok(Math.abs(s.tuer - 360) < 1e-9);
  // Gegenprobe: formschluessig gestaut meldet nichts.
  const ok = sichAnalyse([box(0, 0, 100, 235), box(100, 0, 100, 235)], w0, CONT, "sea");
  assert.strictEqual(ok.laengs.length, 0);
  assert.strictEqual(ok.laengsSumme, 0);
});

test("Querluecken werden je Laengszone gemessen, die schlechteste zaehlt", () => {
  // Zwei Reihen nebeneinander mit 75 cm Loch in der Mitte.
  const s = sichAnalyse([box(0, 0, 120, 80), box(0, 155, 120, 80)], w0, CONT, "sea");
  assert.ok(s.quer, "keine Querzone gefunden");
  assert.ok(Math.abs(s.quer.summe - 75) < 1e-9, `Quersumme ${s.quer.summe}`);
  assert.strictEqual(s.quer.loecher.length, 1);
  // Gegenprobe: volle Breite -> nichts zu melden.
  const voll = sichAnalyse([box(0, 0, 120, 235)], w0, CONT, "sea");
  assert.ok(!voll.quer || voll.quer.summe < SICH.EINZEL + 1e-9);
});

test("kippgefaehrdet ist, was hoeher als das Doppelte der schmalsten Kante steht", () => {
  const hoch = sichAnalyse([box(0, 0, 80, 60, 3, 0, 190)], w0, CONT, "sea");
  assert.deepStrictEqual(hoch.kippTi, [3], "190 cm auf 60 cm Kante muss gemeldet werden");
  // Gegenprobe: die gewoehnliche Palette nicht.
  const pal = sichAnalyse([box(0, 0, 120, 80, 3, 0, 100)], w0, CONT, "sea");
  assert.deepStrictEqual(pal.kippTi, []);
});

test("Schwergut ab 1,5 t je Stueck, Bodenstuecke fuer die Mattenzahl", () => {
  const gw = { 0: 1600, 1: 1400 };
  const s = sichAnalyse([box(0, 0, 100, 100, 0), box(100, 0, 100, 100, 1), box(100, 0, 100, 100, 1, 100)], (ti) => gw[ti], CONT, "road");
  assert.deepStrictEqual(s.schwerTi, [0], "1.600 kg gemeldet, 1.400 kg nicht");
  assert.strictEqual(s.boden, 2, "das gestapelte Stueck (y > 0) zaehlt nicht als Bodenstueck");
  assert.strictEqual(s.gewicht, 1600 + 1400 + 1400);
});

test("Niederzurren: die Statik geht exakt auf (unabhaengige Bilanz)", () => {
  // EN 12195-1: F = m*g*(0,8 - mu)/mu. Die Gegenrechnung ist das Kraeftegleichgewicht:
  // Reibung aus Gewicht PLUS Vorspannung muss die 0,8 g nach vorn exakt tragen:
  //   mu * (m*g + F) = 0,8 * m*g  -- fuer jedes mu, jedes Gewicht.
  for (const kg of [500, 1000, 7500, 24000]) {
    for (const mu of [0.2, 0.3, 0.45, 0.6]) {
      const z = sichGurte(kg, mu);
      const F = kg * 9.81 * (0.8 - mu) / mu;
      assert.ok(Math.abs(mu * (kg * 9.81 + F) - 0.8 * kg * 9.81) < 1e-6, `Bilanz kg=${kg} mu=${mu}`);
      assert.strictEqual(z.daN, Math.round(F / 10));
      assert.strictEqual(z.gurte, Math.ceil(F / 10 / (2 * SICH.STF)), "je Gurt zaehlt die doppelte STF");
    }
  }
  // Bekannter Tabellenfall: 1.000 kg, mu 0,3 -> 1.635 daN -> 3 Gurte; mit Matte 1 Gurt.
  assert.strictEqual(sichGurte(1e3, 0.3).gurte, 3);
  assert.strictEqual(sichGurte(1e3, 0.6).gurte, 1);
  // mu >= 0,8: rechnerisch null -- die Oberflaeche sagt die Mindestsicherung dazu.
  assert.strictEqual(sichGurte(1e3, 0.8).gurte, 0);
});

test("die Oberflaeche traegt den Check in beiden Sprachen und liest die Sicht", () => {
  assert.ok(roh.includes('sichBtn: "Sicherung pr\\xFCfen"'), "deutscher Knopf fehlt");
  assert.ok(roh.includes('sichBtn: "Check securing"'), "englischer Knopf fehlt");
  assert.ok(roh.includes('disabled: !sichtPlaced.length, onClick: () => setSichOpen(true) }, T.sichBtn)'), "Knopf haengt nicht an der Sicht");
  assert.ok(roh.includes("const s = sichAnalyse(sichtPlaced, sw, sichtCont, domain);"), "Dialog liest nicht die Sicht");
  // Die Annahmen stehen SICHTBAR im Dialog, in beiden Sprachen.
  assert.ok(roh.includes("sichAssume: \"Richtwerte: CTU-Code"), "deutsche Annahmen fehlen");
  assert.ok(roh.includes("sichAssume: \"Guide values: CTU Code"), "englische Annahmen fehlen");
});
