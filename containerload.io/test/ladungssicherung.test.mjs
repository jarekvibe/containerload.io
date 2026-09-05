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

test("Querluecken: jedes meldewuerdige Loch wird eine Zone, deckungsgleiche verschmelzen", () => {
  // Zwei Reihen nebeneinander mit 75 cm Loch in der Mitte.
  const s = sichAnalyse([box(0, 0, 120, 80), box(0, 155, 120, 80)], w0, CONT, "sea");
  assert.strictEqual(s.querZonen.length, 1);
  assert.ok(Math.abs(s.querZonen[0].zb - s.querZonen[0].za - 75) < 1e-9);
  // DER Fall aus Jareks Screenshot: ein 35-cm-Streifen an der Wand, der sich ueber
  // MEHRERE Reihen zieht, neben einer dickeren Luecke in einer einzelnen Reihe.
  // Frueher zaehlte nur das schlechteste Band und der Streifen fiel unter den Tisch.
  const lang = [
    box(0, 0, 120, 200, 0), box(120, 0, 120, 200, 0), box(240, 0, 120, 200, 0), // 35er-Streifen bei z=200..235
    box(360, 0, 120, 100, 1)                                                     // eine Reihe mit 135er-Luecke
  ];
  const s2 = sichAnalyse(lang, w0, CONT, "sea");
  assert.strictEqual(s2.querZonen.length, 2, "Streifen UND dicke Luecke muessen gemeldet werden");
  const streifen = s2.querZonen.find((q) => Math.abs(q.zb - q.za - 35) < 1e-9);
  assert.ok(streifen, "der 35er-Streifen fehlt");
  assert.ok(Math.abs(streifen.von - 0) < 1e-9 && Math.abs(streifen.bis - 360) < 1e-9, "der Streifen muss ueber alle drei Reihen verschmolzen sein");
  // Gegenproben: volle Breite meldet nichts, und ein 8-cm-Restspalt (Bandsumme unter
  // der CTU-Grenze) auch nicht -- kleine geometrische Restluecken sind kein Befund.
  assert.strictEqual(sichAnalyse([box(0, 0, 120, 235)], w0, CONT, "sea").querZonen.length, 0);
  assert.strictEqual(sichAnalyse([box(0, 0, 120, 227)], w0, CONT, "sea").querZonen.length, 0);
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
  // 40 cm liegen unter der Polster-Grenze (45): fuellen, nicht abstuetzen.
  assert.ok(arten.includes("laengs"), "die 40-cm-Luecke ist ein Fall fuers Staupolster");
  assert.strictEqual(SICH.POLSTER, 45, "die Polster-Grenze ist der gemeinsame Richtwert von Text und 3D-Vorschau");
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

test("jede Zone weiss, wer an ihr steht und ob eine Wand beteiligt ist", () => {
  // Laengsluecke zwischen zwei benannten Bloecken: beide Anrainer stehen in der Zone.
  const placed = [box(0, 0, 100, 235, 3), box(130, 0, 100, 235, 8)];
  const z = sichZonenBauen(sichAnalyse(placed, () => 500, CONT, "sea"), CONT, placed);
  const laengs = z.find((q) => q.art === "laengs");
  assert.ok(laengs, "Laengszone fehlt");
  assert.deepStrictEqual([...laengs.nachbarn].sort(), [3, 8], "beide Anrainer der Luecke");
  assert.strictEqual(laengs.luecke, 30);
  // Querluecke zur Wand traegt das Wand-Kennzeichen ...
  const wandLast = [box(0, 0, 120, 210, 1)];
  const zw = sichZonenBauen(sichAnalyse(wandLast, () => 500, CONT, "sea"), CONT, wandLast);
  const quer = zw.find((q) => q.art === "quer");
  assert.ok(quer && quer.wand, "Wandluecke muss als Wand erkannt werden");
  // ... eine Luecke ZWISCHEN zwei Reihen nicht.
  const mitte = [box(0, 0, 120, 80, 1), box(0, 155, 120, 80, 2)];
  const zm = sichZonenBauen(sichAnalyse(mitte, () => 500, CONT, "sea"), CONT, mitte);
  const querM = zm.find((q) => q.art === "quer");
  assert.ok(querM && !querM.wand, "Luecke zwischen Reihen ist keine Wandluecke");
  assert.deepStrictEqual([...querM.nachbarn].sort(), [1, 2]);
});

test("Karten und 3D-Plaketten zaehlen dieselbe Liste", () => {
  // Der Dialog baut seine Karten aus sichZonenAlle, der Viewport haengt Plakette zi+1
  // ueber Zone zi -- beide lesen dieselbe Reihenfolge. Ohne diese Kopplung muesste man
  // raten, welche Karte welche Luecke meint.
  assert.ok(roh.includes("const karten = sichZonenAlle.map((z, i) => {"), "Karten kommen nicht aus der Zonenliste");
  assert.ok(roh.includes("const sichZonen = sichZeige && sichZonenAlle.length ? sichZonenAlle : null;"), "Viewport liest eine andere Liste");
  assert.ok(roh.includes("const nr = plakette(zi + 1);"), "3D-Plakette traegt nicht die Zonen-Nummer");
  // Die Empfehlung folgt derselben Polster-Grenze wie die Moebel-Vorschau.
  assert.ok(roh.includes("z.luecke <= SICH.POLSTER ? T.sichEmpfKissen : T.sichEmpfVerband"), "Empfehlung haengt nicht an der gemeinsamen Grenze");
});

test("auf dem Planensattel sprechen die Texte Fahrzeug, nicht Container", () => {
  // Der erste Strassen-Testlauf zeigte "Kurven und Seegang", "Containerwand" und
  // "Luecke zur Tuer" auf einem Auflieger ohne Seegang, Wand und Tuer. Die betroffenen
  // Texte nehmen deshalb ein road-Flag; die Aufrufstellen muessen es durchreichen.
  assert.ok(roh.includes('const ROAD = domain === "road";'), "road-Flag fehlt im Dialog");
  for (const stelle of [
    "T.sichZoneMass[z.art](cF(z.luecke), ROAD)",
    "T.sichRichtungQ(ROAD)",
    "T.sichGrundTuer(ROAD)",
    "T.sichGrundWand(ROAD)",
    "T.sichTuerKlein(cF(s.tuer), ROAD)",
    "T.sichListeTuer(ROAD)",
    "T.sichOk(ROAD)",
  ]) assert.ok(roh.includes(stelle), "Aufrufstelle ohne road-Flag: " + stelle);
  // Und die Woerter selbst, in beiden Sprachen.
  assert.ok(roh.includes('road ? "quer (Kurven)" : "quer (Kurven und Seegang)"'), "DE Richtung ohne Strassen-Variante");
  assert.ok(roh.includes('road ? "sideways (curves)" : "sideways (curves and swell)"'), "EN Richtung ohne Strassen-Variante");
  assert.ok(roh.includes("L\\xFCcke zum Heck"), "DE Heck-Wort fehlt");
  assert.ok(roh.includes("Gap to the rear"), "EN Heck-Wort fehlt");
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
  // Breite Luecke (235 cm, laengs zur Stirnwand): Stauholz-Verband, vier Balken
  // in zwei Hoehen -- exakt so lang wie die Luecke tief ist (minus Spiel).
  // (Sechs waren es mal; der schlankere Verband kam mit dem Ghost-Restyle,
  // weil das dichte Gitter im transluzenten Orange wie Rauschen aussah.)
  const stirn = { x: 0, z: 0, dx: 235, dz: 248, dy: 200, richtung: "x" };
  const holz = sichMoebel(stirn);
  const balken = holz.filter((m) => m.typ === "balken"), pfosten = holz.filter((m) => m.typ === "pfosten");
  assert.strictEqual(balken.length, 4);
  assert.ok(balken.every((m) => Math.abs(m.laenge - 235 * 0.96) < 1e-9));
  assert.strictEqual(new Set(balken.map((m) => m.y)).size, 2, "Balken in zwei Hoehen");
  // Der Verband steht auf Pfosten an BEIDEN Lueckenflaechen -- frei schwebende Balken
  // sahen aus wie ein Rendering-Fehler.
  assert.strictEqual(pfosten.length, 4);
  assert.strictEqual(new Set(pfosten.map((m) => m.x)).size, 2, "Pfosten an beiden Flaechen der Luecke");
  // Tuer: zwei Sperrstangen quer ueber die volle Breite.
  const tuer = { x: 578, z: 0, dx: 12, dz: 235, dy: 200, tuer: true, richtung: "x" };
  const stangen = sichMoebel(tuer);
  assert.strictEqual(stangen.length, 2);
  assert.ok(stangen.every((m) => m.typ === "rohr" && Math.abs(m.laenge - 235 * 0.96) < 1e-9));
});
