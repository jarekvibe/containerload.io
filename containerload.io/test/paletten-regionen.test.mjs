// Die Paletten der Regionen im Paletten-Dialog: US 48 x 40 Zoll, Asien 1100 x 1100 (T11),
// Brasilien PBR -- neben Europalette und Industriepalette (27.11.26, Fahrplan Baustein 2).
//
// Bis dahin kannte der Dialog nur die zwei europaeischen Masse. Wer in Mexiko, den USA,
// Japan oder Brasilien Kartons auf Paletten rechnet, musste das Mass von Hand eintragen --
// und bekam Leergewicht und Tragfaehigkeit der Europalette dazu.
//
// Masse, Hoehe, Leergewicht und Tragfaehigkeit der drei neuen Paletten sind NACHGESCHLAGEN,
// nicht gerechnet (Quellen in CLAUDE.md, "Karton auf Palette"). Der Test haelt sie fest, damit
// eine Aenderung eine Entscheidung mit Quelle ist und kein Versehen.
//
// node --test test/paletten-regionen.test.mjs
import fs from "node:fs";
import assert from "node:assert";
import test from "node:test";
import { fileURLToPath } from "node:url";
import path from "node:path";

const dir = path.dirname(fileURLToPath(import.meta.url));
const wurzel = path.join(dir, "..");
const html = fs.readFileSync(path.join(wurzel, "app.html"), "utf8");
const L = html.split("\n");

const ps = L.findIndex((l) => l.includes("function makeFloorPacker"));
const pe = L.findIndex((l, i) => i > ps && l.trim() === "}" && L[i - 1].includes("return { placed, perType"));
const { palletize, palletizeMulti, PALLETS, PAL_WAHL, palVorwahl } = new Function(
  'var num=(v,d=0)=>Number.isFinite(+v)&&v!==""?+v:d;\n' + L.slice(ps, pe + 1).join("\n") + "\nreturn { palletize, palletizeMulti, PALLETS, PAL_WAHL, palVorwahl };"
)();

test("die nachgeschlagenen Werte: Mass, Hoehe, Leergewicht, Tragfaehigkeit", () => {
  // 48 x 40 Zoll, genau umgerechnet (1 in = 2,54 cm) -- dasselbe Mass, mit dem der Rechner Zoll liest.
  assert.deepStrictEqual(PALLETS.US, { l: 121.92, w: 101.6, h: 15, tare: 19, payload: 1000 });
  assert.ok(Math.abs(PALLETS.US.l - 48 * 2.54) < 1e-9 && Math.abs(PALLETS.US.w - 40 * 2.54) < 1e-9);
  assert.deepStrictEqual(PALLETS.T11, { l: 110, w: 110, h: 14.4, tare: 20, payload: 1000 });
  assert.deepStrictEqual(PALLETS.PBR, { l: 120, w: 100, h: 13.7, tare: 27, payload: 1200 });
  // Die beiden europaeischen bleiben, was sie waren.
  assert.deepStrictEqual(PALLETS.EUR, { l: 120, w: 80, h: 14.4, tare: 25, payload: 1500 });
  assert.deepStrictEqual(PALLETS.IND, { l: 120, w: 100, h: 14.4, tare: 30, payload: 1500 });
});

test("sechs Kacheln, jede Palette genau einmal, die Unterzeile nennt das Mass der Palette", () => {
  assert.deepStrictEqual(PAL_WAHL.map((k) => k[0]), ["EUR", "IND", "US", "T11", "PBR", "FREE"]);
  // Sechs gehen in Reihen zu zwei (Telefon) und zu drei auf -- keine Kachel steht allein.
  assert.strictEqual(PAL_WAHL.length % 2, 0);
  assert.strictEqual(PAL_WAHL.length % 3, 0);
  for (const [k, sub] of PAL_WAHL) {
    if (k === "FREE") { assert.strictEqual(sub, null); continue; }
    const p = PALLETS[k];
    assert.ok(p, `Kachel ${k} ohne Palette`);
    const m = /^(\d+) × (\d+)( in)?$/.exec(sub);
    assert.ok(m, `Unterzeile von ${k}: ${sub}`);
    const f = m[3] ? 2.54 : 1;
    const masse = [+m[1] * f, +m[2] * f].sort((a, b) => a - b);
    const soll = [p.l, p.w].sort((a, b) => a - b);
    assert.ok(Math.abs(masse[0] - soll[0]) < 1e-9 && Math.abs(masse[1] - soll[1]) < 1e-9, `${k}: Unterzeile ${sub} gegen ${p.l} x ${p.w}`);
  }
  // Jede Palette aus PALLETS hat auch eine Kachel.
  assert.deepStrictEqual(Object.keys(PALLETS).sort(), PAL_WAHL.map((k) => k[0]).filter((k) => k !== "FREE").sort());
});

test("die Vorwahl: Zoll heisst US-Palette, Portugiesisch heisst PBR, sonst Europalette", () => {
  assert.strictEqual(palVorwahl("de", "cm"), "EUR");
  assert.strictEqual(palVorwahl("en", "cm"), "EUR");
  assert.strictEqual(palVorwahl("es", "mm"), "EUR");
  assert.strictEqual(palVorwahl("zh", "cm"), "EUR");
  assert.strictEqual(palVorwahl("en", "in"), "US");
  assert.strictEqual(palVorwahl("es", "in"), "US");
  assert.strictEqual(palVorwahl("pt", "cm"), "PBR");
  assert.strictEqual(palVorwahl("pt", "in"), "US", "wer in Zoll arbeitet, bekommt die US-Palette, auch auf Portugiesisch");
  for (const lang of ["de", "en", "es", "fr", "zh", "nl", "pt"]) {
    for (const u of ["cm", "mm", "in"]) assert.ok(PALLETS[palVorwahl(lang, u)], `${lang}/${u}`);
  }
});

test("jede Palette rechnet: nichts ragt ueber, die Hoehe haelt, das Leergewicht faehrt mit", () => {
  const karton = { l: 40, w: 30, h: 25, weight: 8, qty: 400, rotatable: true };
  for (const k of ["EUR", "IND", "US", "T11", "PBR"]) {
    const p = PALLETS[k];
    const r = palletize(p, karton, { maxTotalH: 180 });
    assert.ok(r.perLayer > 0, `${k}: nichts in der Lage`);
    assert.ok(r.perLayer * karton.l * karton.w <= p.l * p.w + 1e-6, `${k}: mehr Karton als Palettenflaeche`);
    for (const q of r.rects) {
      assert.ok(q.x >= -1e-6 && q.z >= -1e-6 && q.x + q.dx <= p.l + 1e-6 && q.z + q.dz <= p.w + 1e-6, `${k}: ein Karton ragt ueber die Kante`);
    }
    assert.deepStrictEqual([r.outL, r.outW], [p.l, p.w], `${k}: ohne Ueberstand ist das Aussenmass das Palettenmass`);
    assert.ok(r.layers >= 1 && r.fullH <= 180 + 1e-6, `${k}: Bauhoehe ${r.fullH}`);
    assert.ok(Math.abs(r.fullH - (p.h + r.layers * karton.h)) < 1e-6, `${k}: Hoehe = Palette + Lagen`);
    assert.ok(Math.abs(r.fullKg - (p.tare + r.perPallet * karton.weight)) < 1e-6, `${k}: Gewicht = Leergewicht + Kartons`);
    assert.strictEqual(r.full * r.perPallet + r.rest, karton.qty, `${k}: unterwegs ist kein Karton verschwunden`);
  }
  // Gleiche Stellflaeche, andere Palette: PBR und Industriepalette legen dieselbe Lage,
  // aber die PBR ist niedriger und leichter.
  const ind = palletize(PALLETS.IND, karton, { maxTotalH: 180 }), pbr = palletize(PALLETS.PBR, karton, { maxTotalH: 180 });
  assert.strictEqual(pbr.perLayer, ind.perLayer);
  assert.ok(pbr.fullKg < ind.fullKg || pbr.layers > ind.layers);
});

test("die Tragfaehigkeit DIESER Palette begrenzt -- nicht pauschal 1.500 kg", () => {
  // 50 kg je Karton, niedrig: die Hoehe liesse viele Lagen zu, das Gewicht nicht.
  const schwer = { l: 40, w: 30, h: 10, weight: 50, qty: 500, rotatable: true };
  for (const k of ["EUR", "IND", "US", "T11", "PBR"]) {
    const p = PALLETS[k];
    const r = palletize(p, schwer, { maxTotalH: 180 });
    assert.strictEqual(r.cap, "weight", `${k}: Grund ist ${r.cap}`);
    assert.ok(r.perPallet * schwer.weight <= p.payload + 1e-6, `${k}: ${r.perPallet * schwer.weight} kg auf ${p.payload} kg Tragfaehigkeit`);
    assert.ok((r.perPallet + r.perLayer) * schwer.weight > p.payload, `${k}: eine Lage mehr waere noch gegangen`);
  }
  const us = palletize(PALLETS.US, schwer, { maxTotalH: 180 }), eur = palletize(PALLETS.EUR, schwer, { maxTotalH: 180 });
  assert.ok(us.perPallet * schwer.weight <= 1000 && eur.perPallet * schwer.weight > 1000,
    "die US-Palette traegt weniger als die Europalette -- sonst prueft der Fall nichts");
});

test("mehrere Kartontypen: auch auf den neuen Paletten verschwindet kein Karton", () => {
  const kartons = [
    { l: 50, w: 40, h: 30, weight: 12, qty: 37, rotatable: true },
    { l: 30, w: 20, h: 20, weight: 4, qty: 110, rotatable: true },
  ];
  for (const k of ["US", "T11", "PBR"]) {
    for (const mode of ["separate", "layered"]) {
      const e = palletizeMulti(PALLETS[k], kartons, { maxTotalH: 180, mode });
      const verladen = e.builds.reduce((s, b) => s + b.qty * b.layers.reduce((a, l) => a + l.count, 0), 0);
      assert.strictEqual(verladen + e.unplaced, 147, `${k}/${mode}: ${verladen} verladen + ${e.unplaced} offen`);
      assert.ok(e.builds.length > 0, `${k}/${mode}: kein Aufbau`);
      for (const b of e.builds) assert.ok(b.totalH > PALLETS[k].h && b.totalH <= 180 + 1e-6, `${k}/${mode}: Palette ${b.totalH} cm hoch`);
    }
  }
});

test("der Dialog: Raster in ganzen Reihen, Vorwahl, Rueckfall, und der Satz nennt die Zahl der Palette", () => {
  const dlg = html.slice(html.indexOf("function PalletDialog("), html.indexOf("function PalletDialog(") + 30000);
  assert.match(dlg, /className: "grid grid-cols-2 sm:grid-cols-3"[^\n]*\n\s*PAL_WAHL\.map\(/, "die Kacheln stehen nicht mehr im Raster zu zwei bzw. drei");
  assert.ok(!/flexWrap: "wrap" \} \},\s*\n\s*\[\["EUR"/.test(dlg), "die alte umbrechende Reihe ist zurueck");
  assert.match(dlg, /useState\(init \? init\.palKey : vorwahl \|\| "EUR"\)/);
  // Ein unbekannter Schluessel (Entwurf aus einer neueren Fassung) darf den Dialog nicht umwerfen.
  assert.match(dlg, /: PALLETS\[palKey\] \|\| PALLETS\.EUR;/);
  assert.match(dlg, /weight: T\.palCapWeight\(fmtDE\(pal\.payload\)\)/);
  assert.match(html, /React\.createElement\(PalletDialog, \{[^\n]*vorwahl: palVorwahl\(LANG, unit\)/);
  // Jede Kachel hat ihren Namen.
  for (const k of ["palEUR", "palIND", "palUS", "palT11", "palPBR", "palFree"]) assert.ok(dlg.includes("T." + k), `T.${k} fehlt im Dialog`);
});

test("alle sieben Sprachen: drei Namen, und die Tragfaehigkeit steht nicht mehr fest im Satz", () => {
  const quellen = { de: html.slice(html.indexOf("palTitle:"), html.indexOf("palTitle:", html.indexOf("palTitle:") + 20) + 6000) };
  const zweites = html.indexOf("palTitle:", html.indexOf("palTitle:") + 20);
  quellen.en = html.slice(zweites, zweites + 6000);
  for (const k of ["es", "fr", "zh", "nl", "pt"]) quellen[k] = fs.readFileSync(path.join(wurzel, "sprache", k + ".js"), "utf8");
  for (const [k, s] of Object.entries(quellen)) {
    for (const key of ["palUS", "palT11", "palPBR"]) {
      const m = new RegExp(key + ': "([^"]+)"').exec(s);
      assert.ok(m && m[1].length >= 3 && m[1].length <= 18, `${k}: ${key} fehlt oder ist zu lang fuer die Kachel (${m && m[1]})`);
    }
    const cap = /palCapWeight: \(kg\) => `([^`]*)`/.exec(s);
    assert.ok(cap, `${k}: palCapWeight ist keine Funktion der Tragfaehigkeit`);
    assert.ok(cap[1].includes("${kg} kg"), `${k}: der Satz nennt die Zahl nicht -- ${cap[1]}`);
    assert.ok(!/1[.,\s  ]?500/.test(cap[1]), `${k}: im Satz steht noch die feste Zahl der Europalette`);
  }
  // "Palet americano" heisst in Spanien 1200 x 1000 und in Lateinamerika 48 x 40 Zoll (siehe
  // es/guia) -- die Kachel nennt deshalb das Kuerzel GMA, auf Spanisch wie auf Portugiesisch.
  for (const k of ["es", "pt"]) {
    const m = /palUS: "([^"]+)"/.exec(quellen[k]);
    assert.ok(/GMA/.test(m[1]) && !/american/i.test(m[1]), `${k}: ${m[1]}`);
  }
});
