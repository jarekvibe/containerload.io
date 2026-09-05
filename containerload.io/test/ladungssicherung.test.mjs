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
const bis = L.findIndex((l, i) => i > von && l.includes("// Indikative Laengs-Gewichtsverteilung"));
assert.ok(von > 0 && bis > von, "SICH-Ausschnitt nicht gefunden");
const { SICH, sichAnalyse, sichGurte, sichBefunde, sichZonenBauen, sichMoebel } = new Function(L.slice(von, bis).join("\n") + "\nreturn { SICH, sichAnalyse, sichGurte, sichBefunde, sichZonenBauen, sichMoebel };")();

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
  // EINE Quelle: Dialog, Aufplopp-Hinweis und 3D lesen dieselbe Analyse der Sicht.
  assert.ok(roh.includes("sichAnalyse(sichtPlaced, (ti) => num(cargo[ti] && cargo[ti].weight), sichtCont, domain)"), "Analyse liest nicht die Sicht");
  assert.ok(roh.includes("const sichB = sichErg ? sichBefunde(sichErg) : [];"), "Befunde kommen nicht aus der einen Quelle");
  assert.ok(roh.includes("onFokus: setFokus, sichZonen })"), "Viewport bekommt die Zonen nicht");
  // Der Hinweis ploppt nur bei echten Warnungen auf, nie ueber dem Empfehlungs-Banner.
  assert.ok(roh.includes("!manualMode && !zeigeBanner && sichWarnzahl > 0 && !sichBannerWeg && !sichZeige && !sichOpen &&"), "Aufplopp-Bedingung fehlt");
  // Die Annahmen stehen SICHTBAR im Dialog, in beiden Sprachen.
  assert.ok(roh.includes("sichAssume: \"Richtwerte: CTU-Code"), "deutsche Annahmen fehlen");
  assert.ok(roh.includes("sichAssume: \"Guide values: CTU Code"), "englische Annahmen fehlen");
});

test("die Befunde-Liste ist die eine Quelle und sortiert nach Schwere der Lesart", () => {
  const s = sichAnalyse([box(0, 0, 100, 235), box(140, 0, 100, 80, 7, 0, 190)], (ti) => ti === 7 ? 1600 : 500, CONT, "sea");
  const arten = sichBefunde(s).map((b) => b.art);
  assert.ok(arten.includes("laengsGross"), "die 40-cm-Luecke muss als grosse Laengsluecke gemeldet werden");
  assert.ok(arten.includes("laengsSumme") === (s.laengsSumme > SICH.SUMME), "Summenmeldung passt nicht zur Summe");
  assert.ok(arten.includes("tuer"), "Tuerluecke fehlt");
  assert.ok(arten.includes("kipp"), "Kippgefahr fehlt (190 cm auf 80er-Kante)");
  assert.ok(arten.includes("schwer"), "Schwergut fehlt");
  // Gegenprobe: die formschluessige Stauung meldet nichts als hoechstens die Tuer.
  const ok = sichBefunde(sichAnalyse([box(0, 0, 585, 235)], () => 500, CONT, "sea"));
  assert.deepStrictEqual(ok.filter((b) => b.art !== "tuerKlein" && b.art !== "tuer"), []);
});

test("die 3D-Zonen decken genau die Luecken ab", () => {
  const placed = [box(0, 0, 100, 235, 0, 0, 120), box(130, 0, 100, 80, 1, 0, 120)];
  const s = sichAnalyse(placed, () => 500, CONT, "sea");
  const z = sichZonenBauen(s, { ...CONT, h: 239 }, placed);
  // Laengsluecke 100-130 als Quader voller Breite, so hoch wie die Ladung.
  const laengs = z.find((q) => !q.tuer && q.x === 100);
  assert.ok(laengs, "Laengszone fehlt");
  assert.strictEqual(laengs.dx, 30);
  assert.strictEqual(laengs.dz, 235);
  assert.strictEqual(laengs.dy, 120, "Zone so hoch wie die Ladung, nicht bis unters Dach");
  // Tuerluecke als schmaler Balken am Ladungsende, nicht als Riesenblock.
  const tuer = z.find((q) => q.tuer);
  assert.ok(tuer, "Tuerzone fehlt");
  assert.ok(Math.abs(tuer.x - 230) < 1e-9, "Balken sitzt am Ladungsende");
  assert.ok(tuer.dx <= 12, "Tuerzone muss ein Balken sein, kein Block bis zur Tuer");
  // Gegenprobe: formschluessig -> keine Zonen ausser der Tuer.
  const dicht = [box(0, 0, 585, 235)];
  const z2 = sichZonenBauen(sichAnalyse(dicht, () => 500, CONT, "sea"), CONT, dicht);
  assert.deepStrictEqual(z2.filter((q) => !q.tuer), []);
});

test("die Vorschau stellt das passende Hilfsmittel in die Zone", () => {
  // Schmale Luecke (25 cm, quer): Luftkissen. Es muss IN die Luecke passen und
  // schmaler sein als sie -- ein Kissen, das die Ladung verdraengt, waere Unsinn.
  const quer = { x: 0, z: 210, dx: 220, dz: 25, dy: 220, richtung: "z" };
  const kissen = sichMoebel(quer);
  assert.ok(kissen.length >= 1 && kissen.every((m) => m.typ === "kissen"), "schmale Luecke braucht Kissen");
  for (const k of kissen) {
    assert.ok(k.dick < 25, `Kissen dicker als die Luecke (${k.dick})`);
    assert.ok(k.hoehe <= 220 * 0.85 + 1e-9, "Kissen hoeher als 85 % der Zone");
    assert.strictEqual(k.achse, "z", "der Bauch muss quer zeigen");
  }
  // Zwei Kissen, wenn die Luecke lang genug ist (220 cm entlang der Fahrt).
  assert.strictEqual(kissen.length, 2);
  // Breite Luecke (235 cm, laengs zur Stirnwand): Stauholz-Verband, sechs Balken
  // in zwei Hoehen -- exakt so lang wie die Luecke tief ist (minus Spiel).
  const stirn = { x: 0, z: 0, dx: 235, dz: 248, dy: 200, richtung: "x" };
  const holz = sichMoebel(stirn);
  assert.strictEqual(holz.length, 6);
  assert.ok(holz.every((m) => m.typ === "balken" && Math.abs(m.laenge - 235 * 0.96) < 1e-9));
  assert.strictEqual(new Set(holz.map((m) => m.y)).size, 2, "Balken in zwei Hoehen");
  // Tuer: zwei Sperrstangen quer ueber die volle Breite.
  const tuer = { x: 578, z: 0, dx: 12, dz: 235, dy: 200, tuer: true, richtung: "x" };
  const stangen = sichMoebel(tuer);
  assert.strictEqual(stangen.length, 2);
  assert.ok(stangen.every((m) => m.typ === "rohr" && Math.abs(m.laenge - 235 * 0.96) < 1e-9));
});
