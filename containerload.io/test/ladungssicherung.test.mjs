// Der Ladungssicherungs-Check: aus der gepackten Geometrie wird abgeleitet, WO
// gesichert werden muss -- Luecken (CTU-Code), Kippgefahr, Schwergut. Bewusst
// NICHT womit: welches Material ein Lager nutzt, weiss der Rechner nicht.
// Alles Richtwerte mit sichtbaren Annahmen; dieser Test haelt die Geometrie fest.
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
const { SICH, sichAnalyse, sichBefunde, sichZonenBauen } = new Function(L.slice(von, bis).join("\n") + "\nreturn { SICH, sichAnalyse, sichBefunde, sichZonenBauen };")();

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

test("Schwergut ab 1,5 t je Stueck", () => {
  const gw = { 0: 1600, 1: 1400 };
  const s = sichAnalyse([box(0, 0, 100, 100, 0), box(100, 0, 100, 100, 1)], (ti) => gw[ti], CONT, "road");
  assert.deepStrictEqual(s.schwerTi, [0], "1.600 kg gemeldet, 1.400 kg nicht");
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
  assert.ok(arten.includes("laengs"), "die 40-cm-Luecke muss als Laengsluecke gemeldet werden");
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
});

test("der Check nennt Orte, keine Mittel -- und das bleibt so", () => {
  // Jareks Entscheidung: Zonen zeigen, aber keine Sicherungsmittel vorschlagen --
  // welches Material ein Lager nutzt, wissen wir nicht. Der fruehere Stand (Zurr-
  // Rechner nach EN 12195-1, Materialliste, 3D-Vorschau von Kissen und Stauholz)
  // liegt in der Git-Historie. Wer eine dieser Kennungen wieder einbaut, soll hier
  // bewusst vorbeimuessen.
  for (const kennung of ["sichGurte", "sichMoebel", "sichEmpf", "sichListe", "sichZurr", "sichSee"]) {
    assert.ok(!roh.includes(kennung), `Sicherungs-Vorschlag zurueck im Code: ${kennung}`);
  }
  // Und die Grenzwerte der Vorschlaege sind mit ihnen gegangen.
  assert.strictEqual(SICH.POLSTER, undefined);
  assert.strictEqual(SICH.STF, undefined);
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
  ]) assert.ok(roh.includes(stelle), "Aufrufstelle ohne road-Flag: " + stelle);
  // Und die Woerter selbst, in beiden Sprachen.
  assert.ok(roh.includes('road ? "quer (Kurven)" : "quer (Kurven und Seegang)"'), "DE Richtung ohne Strassen-Variante");
  assert.ok(roh.includes('road ? "sideways (curves)" : "sideways (curves and swell)"'), "EN Richtung ohne Strassen-Variante");
  assert.ok(roh.includes("L\\xFCcke zum Heck"), "DE Heck-Wort fehlt");
  assert.ok(roh.includes("Gap to the rear"), "EN Heck-Wort fehlt");
});

