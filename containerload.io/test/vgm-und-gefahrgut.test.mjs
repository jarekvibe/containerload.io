// VGM-Vorbereitung und Gefahrgut-Kennzeichnung im Ladevorschlag.
//
// VGM: Ladung + Container-Tara = Brutto, als RICHTWERT -- nie als "VGM"
// beschriftet, denn die Verified Gross Mass verlangt Verwiegung oder ein
// zertifiziertes Verfahren nach SOLAS VI/2. Das Tara-Feld ist editierbar
// (massgeblich ist das CSC-Schild des konkreten Containers), der typische
// Wert kommt aus TARA -- denselben Zahlen wie die Tabelle der Zuladungs-
// Wissensseite. Zwei Quellen, eine Wahrheit: dieser Test rechnet beide
// gegeneinander.
//
// Gefahrgut: NUR eine Kennzeichnung aus der Eingabe (Haken + optionale
// UN-Nummer) -- keine Pruefung, keine Trennregeln, und das steht als Satz
// unter der Tabelle. Die UN-Nummer ist an jeder Eintrittsstelle auf genau
// vier Ziffern gefiltert (UN 0004 hat fuehrende Nullen!).
//
// node --test test/vgm-und-gefahrgut.test.mjs
import fs from "node:fs";
import assert from "node:assert";
import test from "node:test";
import { fileURLToPath } from "node:url";
import path from "node:path";

const dir = path.dirname(fileURLToPath(import.meta.url));
const roh = fs.readFileSync(path.join(dir, "..", "app.html"), "utf8");
const L = roh.split("\n");
const zeile = (von) => { const i = L.findIndex((l) => l.includes(von)); assert.ok(i >= 0, `nicht gefunden: ${von}`); return i; };
const cutFn = (von) => {
  const i = zeile(von);
  const j = L.findIndex((l, k) => k > i && l.trim() === "};" && L[k - 1].includes("</div>`;"));
  assert.ok(j > i, `Funktionsende nicht gefunden: ${von}`);
  return L.slice(i, j + 1).join("\n");
};

const { LV_VGM } = new Function(cutFn("var LV_VGM = (placed") + "\nreturn { LV_VGM };")();

const CARGO = [{ weight: 300 }, { weight: 300 }];
const PLACED = [{ ti: 0, x: 0, dx: 100 }, { ti: 1, x: 100, dx: 100 }];

test("Ladung + Tara = Brutto, vorgerechnet und als Richtwert beschriftet", () => {
  const de = LV_VGM(PLACED, CARGO, 2280, "20' GP", "de");
  assert.ok(de.includes("BRUTTOMASSE (VGM-VORBEREITUNG) \xB7 RICHTWERT"), "die Richtwert-Plakette fehlt");
  assert.ok(de.includes("600 kg"), "Ladungsgewicht fehlt");
  assert.ok(de.includes(">2.280<") || de.includes(">2.280</span>"), `Tara nicht vorgefuellt: ${de.slice(0, 400)}`);
  assert.ok(de.includes("≈ 2.880 kg"), "Brutto nicht vorgerechnet");
  assert.ok(de.includes("typisch 20' GP") && de.includes("CSC-Schild"), "die Typisch/CSC-Einordnung fehlt");
  assert.ok(de.includes("Kein VGM-Ersatz") && de.includes("SOLAS VI/2"), "die Abgrenzung zur echten VGM fehlt");
  // NIE als "VGM: X kg" -- ein Feld, das wie eine VGM aussieht, waere
  // Schein-Amtlichkeit.
  assert.ok(!/VGM:\s*[\d.]/.test(de), "das Dokument behauptet eine VGM");
  const en = LV_VGM(PLACED, CARGO, 2280, "20' GP", "en");
  assert.ok(en.includes("GROSS MASS (VGM PREPARATION)") && en.includes("≈ 2,880 kg"), "englische Fassung falsch");
  assert.ok(!en.includes("Stirnwand") && !en.includes("Ladung "), "deutscher Text im englischen Dokument");
});

test("ohne bekannte Tara bleibt das Feld leer und das Brutto ein Strich", () => {
  const de = LV_VGM(PLACED, CARGO, null, "Custom", "de");
  assert.ok(de.includes("vom CSC-Schild am Container ablesen"), "der Ablese-Hinweis fehlt");
  assert.ok(de.includes(">—<") || de.includes(">—<"), "ohne Tara darf kein Brutto stehen");
});

test("die Gewichts-Ehrlichkeitsregel gilt auch hier", () => {
  assert.strictEqual(LV_VGM(PLACED, [{ weight: 300 }, {}], 2280, "20' GP", "de"), "");
  assert.strictEqual(LV_VGM([], CARGO, 2280, "20' GP", "de"), "");
});

test("das Tara-Feld traegt die Daten fuers Live-Nachrechnen, und LV_DOC rechnet", () => {
  const de = LV_VGM(PLACED, CARGO, 2280, "20' GP", "de");
  assert.ok(de.includes('data-vgm-tara data-kg="600"'), "das Feld kennt sein Ladungsgewicht nicht");
  assert.ok(de.includes('class="cl-feld" contenteditable="true"'), "das Tara-Feld ist nicht editierbar");
  assert.ok(roh.includes('t.getAttribute("data-vgm-tara")') && roh.includes('querySelector("[data-vgm-brutto]")'),
    "LV_DOC rechnet das Brutto beim Tippen nicht nach");
  assert.ok(roh.includes('String(t.textContent).replace(/[^0-9]/g,"")'),
    "die Eingabe wird nicht auf Ziffern gefiltert");
});

test("TARA und die Zuladungs-Wissensseite erzaehlen dieselben Zahlen", () => {
  // TARA aus app.html lesen.
  const tm = roh.match(/var TARA = (\{[^}]+\})/);
  assert.ok(tm, "TARA nicht gefunden");
  const TARA = new Function("return " + tm[1])();
  // PRESETS-Zuladungen aus app.html lesen.
  const payload = (name) => {
    const m = roh.match(new RegExp(`"${name.replace("'", "\\'")}": \\{ l: \\d+, w: \\d+, h: \\d+, payload: (\\d+)`));
    assert.ok(m, `PRESETS-Zuladung fuer ${name} nicht gefunden`);
    return +m[1];
  };
  // Die Tabelle der Wissensseite: Brutto / Tara / Zuladung je Typ.
  const seite = fs.readFileSync(path.join(dir, "..", "ratgeber", "container-zuladung-gewicht.html"), "utf8");
  const MAP = { "20′ Standard": "20' GP", "20′ High Cube": "20' HC", "40′ Standard": "40' GP", "40′ High Cube": "40' HC", "45′ High Cube": "45' HC" };
  for (const [seiteName, presetName] of Object.entries(MAP)) {
    const zm = seite.match(new RegExp(`<td>${seiteName}</td><td class="num">([\\d.]+) kg</td><td class="num">([\\d.]+) kg</td><td class="num">([\\d.]+) kg</td>`));
    assert.ok(zm, `Tabellenzeile fuer ${seiteName} nicht gefunden`);
    const [brutto, tara, zuladung] = [zm[1], zm[2], zm[3]].map((s) => +s.replace(/\./g, ""));
    assert.strictEqual(TARA[presetName], tara, `${presetName}: TARA weicht von der Wissensseite ab`);
    assert.strictEqual(brutto - tara, zuladung, `${seiteName}: die Seiten-Tabelle geht nicht auf`);
    assert.strictEqual(zuladung, payload(presetName), `${presetName}: Zuladung der Seite != PRESETS`);
  }
});

test("beide Blattsorten tragen den VGM-Block vor der Quittung", () => {
  assert.ok(roh.includes("+ LV_VGM(placed, cargo, TARA[preset] || null, preset, LANG) + LV_QUITTUNG"),
    "das einzelne Blatt traegt den VGM-Block nicht");
  assert.ok(roh.includes("+ LV_VGM(sp, cargo, TARA[slot.name] || null, slot.name || pl, LANG) + LV_QUITTUNG"),
    "die Container-Blaetter tragen den VGM-Block nicht");
});

// ── Gefahrgut ────────────────────────────────────────────────────────────────

const { LV_ROW } = new Function(
  'var num=(v,d=0)=>Number.isFinite(+v)&&v!==""?+v:d;\n'
  + 'var escHTML = (t) => String(t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", \'"\': "&quot;" })[c]);\n'
  + 'var dimDE = (v) => String(v); var fmtDE = (v) => String(v); var fmt1DE = (v) => String(v);\n'
  + L.slice(zeile("var LV_ROW = (it, i, lang, rank)"), L.findIndex((l, i) => i > zeile("var LV_ROW = (it, i, lang, rank)") && l.trim() === "};") + 1).join("\n")
  + "\nreturn { LV_ROW };"
)();

test("die Gefahrgut-Marke steht in der Positionstabelle -- als Kennzeichnung, mehr nicht", () => {
  const mit = LV_ROW({ name: "Fass", l: 120, w: 80, h: 110, weight: 300, qty: 4, gefahr: true, un: "1090" }, 1, "de", 1);
  assert.ok(mit.includes("GEFAHRGUT") && mit.includes("UN 1090"), "die Marke fehlt");
  const ohneUN = LV_ROW({ name: "Fass", l: 120, w: 80, h: 110, weight: 300, qty: 4, gefahr: true }, 1, "de", 1);
  assert.ok(ohneUN.includes("GEFAHRGUT") && !ohneUN.includes("UN "), "ohne UN-Nummer nur die Marke");
  const ohne = LV_ROW({ name: "Fass", l: 120, w: 80, h: 110, weight: 300, qty: 4 }, 1, "de", 1);
  assert.ok(!ohne.includes("GEFAHRGUT"), "unmarkierte Positionen tragen keine Marke");
  const en = LV_ROW({ name: "Drum", l: 120, w: 80, h: 110, weight: 300, qty: 4, gefahr: true, un: "1090" }, 1, "en", 1);
  assert.ok(en.includes("DG") && en.includes("UN 1090"), "englische Marke fehlt");
});

test("der Hinweis-Satz steht auf jedem Blatt mit markierten Positionen", () => {
  assert.ok(roh.includes("keine Gefahrgut-Pr\\xFCfung, keine Trenn- oder Stauvorschriften")
    || roh.includes("keine Gefahrgut-Prüfung, keine Trenn- oder Stauvorschriften"),
    "der Eingrenzungs-Satz fehlt");
  assert.ok(roh.includes("GEFAHR: gefahrHinweis(items),"), "das Einzelblatt/Deckblatt traegt den Hinweis nicht");
  assert.ok(roh.includes("GEFAHR: gefahrHinweis(zeilen.map((z) => z.it)),"), "die Container-Blaetter tragen den Hinweis nicht");
  assert.ok(roh.includes("${GEFAHR || \"\"}"), "LV_PAGE rendert den Hinweis nicht");
});

test("die UN-Nummer ist an jeder Eintrittsstelle auf Ziffern gefiltert", () => {
  // UI-Eingabe: nur Ziffern, hoechstens vier.
  assert.ok(roh.includes('e.target.value.replace(/\\D/g, "").slice(0, 4)'), "das UN-Feld filtert nicht");
  // ?p=-Decode: nur exakt vier Ziffern.
  assert.ok(roh.includes('un: typeof r.un === "string" && /^\\d{4}$/.test(r.un) ? r.un : null'), "decodePlanState klemmt die UN nicht");
});

// Teilen-Link: Tag G, mit und ohne UN, fuehrende Nullen bleiben.
const s = L.findIndex((l) => l.includes("// V2-ENCODE-BEGIN"));
const e2 = L.findIndex((l, i) => i > s && l.includes("// V2-ENCODE-END"));
const { compactEncode, compactDecode } = new Function(L.slice(s, e2 + 1).join("\n") + "\nreturn { compactEncode, compactDecode };")();

test("die Gefahrgut-Marke reist im Teilen-Link -- inklusive UN 0004", () => {
  const mk = (g, un) => ({ dm: "sea", pr: "Custom", co: { l: 590, w: 235, h: 239, p: 28200 }, it: [{ l: 120, w: 80, h: 110, wt: 0, q: 1, s: 1, r: 1, g, un }] });
  const mitUN = compactDecode(compactEncode(mk(1, "0004"), { presets: {}, vehicles: {} }));
  assert.strictEqual(mitUN.it[0].g, 1, "die Marke ging verloren");
  assert.strictEqual(mitUN.it[0].un, "0004", "die fuehrenden Nullen der UN-Nummer gingen verloren");
  const ohneUN = compactDecode(compactEncode(mk(1, void 0), { presets: {}, vehicles: {} }));
  assert.strictEqual(ohneUN.it[0].g, 1);
  assert.strictEqual(ohneUN.it[0].un, void 0);
  // Alt-Link ohne G-Tag: keine Marke erfunden.
  const alt = compactDecode("z" + "g590x235x239x28200" + "~120x80x110");
  assert.ok(!alt.it[0].g, "ein Alt-Link darf keine Gefahrgut-Marke erfinden");
});

test("Schalter und Pille: sichtbar im 01-Modus, eine markierte Position immer", () => {
  assert.ok(roh.includes("(zeigeNummern || c.gefahr === true) &&"),
    "der Gefahrgut-Schalter haengt nicht am 01-Modus (oder versteckt markierte Positionen)");
  assert.ok(roh.includes('c.un ? "UN " + c.un : T.gefahrLabel'), "die Pille in der zugeklappten Zeile fehlt");
});
