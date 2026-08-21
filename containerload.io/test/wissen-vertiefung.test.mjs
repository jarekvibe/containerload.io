// Die neuen Zahlen der vertieften Wissens-Seiten — GERECHNET, nicht abgeschrieben.
//
// Beim Vertiefen der drei meistgesehenen Seiten (Container-Volumen, Zuladung, Gitterboxen)
// und den zwei neuen Seiten (Stellplätze, Stauplan) sind Tabellen dazugekommen, die genau
// das tun, was auf diesen Seiten am gefährlichsten ist: Zahlen behaupten. Dieser Test liest
// sie AUS DEM HTML und vergleicht sie mit dem, was app.html rechnet.
//
// Denn eine Wissens-Seite, die eine andere Zahl nennt als der Rechner, in den ihr eigener
// Knopf führt, zerstört genau das Vertrauen, das das Produkt ausmacht.
//
// node --test test/wissen-vertiefung.test.mjs
import fs from "node:fs";
import assert from "node:assert";
import test from "node:test";
import { fileURLToPath } from "node:url";
import path from "node:path";

const dir = path.dirname(fileURLToPath(import.meta.url));
const L = fs.readFileSync(path.join(dir, "..", "app.html"), "utf8").split("\n");
const pStart = L.findIndex((l) => l.includes("var PRESETS = {"));
const pEnd = L.findIndex((l, i) => i > pStart && l.trim() === "};");
const ps = L.findIndex((l) => l.includes("function makeFloorPacker"));
const pe = L.findIndex((l, i) => i > ps && l.trim() === "}" && L[i - 1].includes("return { placed, perType"));
const { makeFloorPacker, packCargo, PRESETS } = new Function(
  'var num=(v,d=0)=>Number.isFinite(+v)&&v!==""?+v:d;\n'
  + L.slice(pStart, pEnd + 1).join("\n") + "\n" + L.slice(ps, pe + 1).join("\n")
  + "\nreturn { makeFloorPacker, packCargo, PRESETS };")();

const lies = (p) => fs.readFileSync(path.join(dir, "..", p), "utf8");
// Alle Tabellenzeilen einer Seite als Liste von Zellen (Auszeichnung entfernt).
const zeilen = (html) => [...html.matchAll(/<tr>((?:(?!<\/tr>)[\s\S])*)<\/tr>/g)]
  .map((m) => [...m[1].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/g)]
    .map((c) => c[1].replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim()));
const zahl = (s) => Number(String(s).replace(/[^\d]/g, ""));
const stellplaetze = (preset, l, w, rot = true) => makeFloorPacker(l, w, rot)(PRESETS[preset].l, PRESETS[preset].w).count;

// ── Stellplätze-Seite ────────────────────────────────────────────────────────
// [Grundflaeche in der Tabelle (de/en), Packstueckmass]
const EINHEITEN = [
  [["120 × 80 cm"], [120, 80]],
  [["120 × 100 cm"], [120, 100]],
  [["124 × 83 cm"], [124, 83]],
  [["114 × 114 cm"], [114, 114]],
  [["80 × 60 cm"], [80, 60]]
];
for (const [datei, sprache] of [["ratgeber/stellplaetze-container.html", "deutsch"], ["en/guide/container-floor-positions.html", "englisch"]]) {
  test(`Stellplätze (${sprache}): jede Zeile stimmt mit dem Packer überein`, () => {
    const rows = zeilen(lies(datei));
    let geprueft = 0;
    for (const [namen, [l, w]] of EINHEITEN) {
      const r = rows.find((z) => z.length >= 5 && namen.includes(z[1]));
      assert.ok(r, `${datei}: keine Zeile fuer ${l}×${w} cm`);
      for (const [spalte, preset] of [[2, "20' GP"], [3, "40' GP"], [4, "45' HC"]]) {
        const echt = stellplaetze(preset, l, w);
        assert.strictEqual(zahl(r[spalte]), echt,
          `${datei}: ${l}×${w} cm im ${preset} — die Seite nennt ${r[spalte]}, der Packer rechnet ${echt}`);
        geprueft++;
      }
    }
    assert.strictEqual(geprueft, 15, `nur ${geprueft} Zahlen geprueft`);
  });

  test(`Stellplätze (${sprache}): der Dreh-Gewinn ist nachgerechnet`, () => {
    // Die Aussage "8 ohne Drehung, 11 mit" ist das Kernargument der Seite. Sie stammt aus
    // demselben Packer, einmal mit und einmal ohne erlaubte 90°-Drehung.
    const rows = zeilen(lies(datei));
    for (const [name, preset] of [["20′ Standard", "20' GP"], ["40′ Standard", "40' GP"]]) {
      const r = rows.find((z) => z.length === 4 && z[0] === name && zahl(z[3]) > 0 && /\+/.test(z[3]));
      assert.ok(r, `${datei}: keine Dreh-Vergleichszeile fuer ${name}`);
      const ohne = stellplaetze(preset, 120, 80, false), mit = stellplaetze(preset, 120, 80, true);
      assert.strictEqual(zahl(r[1]), ohne, `${datei}: ${name} ohne Drehung — Seite ${r[1]}, Packer ${ohne}`);
      assert.strictEqual(zahl(r[2]), mit, `${datei}: ${name} gemischt — Seite ${r[2]}, Packer ${mit}`);
      assert.strictEqual(zahl(r[3]), mit - ohne, `${datei}: ${name} Gewinn — Seite ${r[3]}, gerechnet ${mit - ohne}`);
    }
  });
}

// ── Zuladung: Brutto − Tara = die Zuladung aus app.html ──────────────────────
const CONT_ZEILEN = [["20′ Standard", "20' GP"], ["20′ High Cube", "20' HC"],
  ["40′ Standard", "40' GP"], ["40′ High Cube", "40' HC"], ["45′ High Cube", "45' HC"]];
for (const [datei, sprache] of [["ratgeber/container-zuladung-gewicht.html", "deutsch"], ["en/guide/container-payload-weight.html", "englisch"]]) {
  test(`Zuladung (${sprache}): Brutto minus Tara ergibt genau die Zuladung des Rechners`, () => {
    // Die Seite erklaert die Zuladung als Differenz. Wenn die drei Zahlen nicht aufgehen,
    // widerlegt sich die Tabelle selbst — und die dritte Spalte widerspricht dem Rechner.
    const rows = zeilen(lies(datei));
    for (const [name, preset] of CONT_ZEILEN) {
      const r = rows.find((z) => z.length >= 4 && z[0] === name && /kg/.test(z[1]));
      assert.ok(r, `${datei}: keine Zuladungszeile fuer ${name}`);
      const brutto = zahl(r[1]), tara = zahl(r[2]), zul = zahl(r[3]);
      assert.strictEqual(brutto - tara, zul, `${datei}: ${name} — ${brutto} − ${tara} ≠ ${zul}`);
      assert.strictEqual(zul, PRESETS[preset].payload,
        `${datei}: ${name} — die Seite nennt ${zul} kg, app.html rechnet mit ${PRESETS[preset].payload} kg`);
    }
  });
}

// ── Gitterboxen: Lagen und das Gewichtslimit ────────────────────────────────
const GB = { l: 124, w: 83, h: 97, kg: 1070 };
for (const [datei, sprache] of [["ratgeber/gitterboxen-container.html", "deutsch"], ["en/guide/wire-mesh-pallets-container.html", "englisch"]]) {
  test(`Gitterboxen (${sprache}): eine und zwei Lagen stimmen`, () => {
    const rows = zeilen(lies(datei));
    for (const [name, preset] of CONT_ZEILEN.filter(([n]) => /20′ Standard|20′ High Cube|40′ Standard|40′ High Cube/.test(n))) {
      const r = rows.find((z) => z.length === 4 && z[0] === name && /cm$/.test(z[1]));
      assert.ok(r, `${datei}: keine Lagenzeile fuer ${name}`);
      const eine = stellplaetze(preset, GB.l, GB.w);
      const lagen = Math.floor(PRESETS[preset].h / GB.h);
      assert.strictEqual(zahl(r[2]), eine, `${datei}: ${name} eine Lage — Seite ${r[2]}, Packer ${eine}`);
      assert.strictEqual(zahl(r[3]), eine * lagen, `${datei}: ${name} zwei Lagen — Seite ${r[3]}, gerechnet ${eine * lagen}`);
      assert.strictEqual(lagen, 2, `${name}: der Text behauptet zwei Lagen, gerechnet sind es ${lagen}`);
    }
  });

  test(`Gitterboxen (${sprache}): das Gewichtslimit ist mit dem Packer gerechnet`, () => {
    // Die Pointe der Seite: im 40-Fuss ist nach 24 statt 46 Boxen Schluss, weil die
    // Zuladung erreicht ist. Genau das rechnet packCargo mit demselben Gewicht nach.
    const rows = zeilen(lies(datei));
    for (const [name, preset] of [["20′ Standard", "20' GP"], ["40′ Standard", "40' GP"]]) {
      const r = rows.find((z) => z.length === 4 && z[0] === name && /kg$/.test(z[3]));
      assert.ok(r, `${datei}: keine Gewichtszeile fuer ${name}`);
      const res = packCargo(PRESETS[preset], [{ name: "GB", l: GB.l, w: GB.w, h: GB.h, weight: GB.kg, qty: 200, stackable: true, rotatable: true }], {});
      const ohneGewicht = packCargo(PRESETS[preset], [{ name: "GB", l: GB.l, w: GB.w, h: GB.h, weight: 0, qty: 200, stackable: true, rotatable: true }], {});
      assert.strictEqual(zahl(r[1]), ohneGewicht.boxes, `${datei}: ${name} Platz fuer — Seite ${r[1]}, Packer ${ohneGewicht.boxes}`);
      assert.strictEqual(zahl(r[2]), res.boxes, `${datei}: ${name} bei ${GB.kg} kg — Seite ${r[2]}, Packer ${res.boxes}`);
      assert.strictEqual(zahl(r[3]), Math.round(res.weight), `${datei}: ${name} Gewicht — Seite ${r[3]}, Packer ${Math.round(res.weight)}`);
      assert.ok(res.weight <= PRESETS[preset].payload + 0.5, `${name}: die Seite zeigt eine Ueberladung`);
    }
  });
}

// ── Volumen: die High-Cube-Lagentabelle ─────────────────────────────────────
for (const [datei, sprache] of [["ratgeber/container-volumen-cbm.html", "deutsch"], ["en/guide/container-volume-cbm.html", "englisch"]]) {
  test(`Container-Volumen (${sprache}): die High-Cube-Lagen sind eine Division, keine Behauptung`, () => {
    // Das Argument der Seite ("13 % mehr Volumen heissen nicht 13 % mehr Ladung") steht und
    // faellt mit dieser Tabelle. Die Innenhoehen kommen aus app.html.
    const gp = PRESETS["40' GP"].h, hc = PRESETS["40' HC"].h;
    const rows = zeilen(lies(datei));
    let geprueft = 0;
    for (const h of [90, 110, 130]) {
      const r = rows.find((z) => z.length === 4 && zahl(z[0]) === h && /(Lagen|Lage|tiers?)/.test(z[1]));
      assert.ok(r, `${datei}: keine Zeile fuer ${h} cm Bauhoehe`);
      assert.strictEqual(zahl(r[1]), Math.floor(gp / h), `${datei}: ${h} cm im 40′ GP (${gp} cm) — Seite ${r[1]}, gerechnet ${Math.floor(gp / h)}`);
      assert.strictEqual(zahl(r[2]), Math.floor(hc / h), `${datei}: ${h} cm im 40′ HC (${hc} cm) — Seite ${r[2]}, gerechnet ${Math.floor(hc / h)}`);
      geprueft++;
    }
    assert.strictEqual(geprueft, 3);
    // Und der Kern: bei 110 cm bringt der High Cube NICHTS. Wäre das nicht so, wäre der
    // ganze Abschnitt falsch.
    assert.strictEqual(Math.floor(gp / 110), Math.floor(hc / 110), "bei 110 cm müssten Standard und High Cube gleich viele Lagen fassen");
  });
}

// ── Der Planensattel-Wert, der auf der Gitterbox-Seite behauptet wird ───────
test("die 32 Gitterboxen auf dem Planensattel sind gerechnet", () => {
  const echt = makeFloorPacker(GB.l, GB.w, true)(1362, 248).count;
  assert.strictEqual(echt, 32, `der Packer rechnet ${echt} Gitterboxen auf 1362×248 cm`);
  for (const datei of ["ratgeber/gitterboxen-container.html", "en/guide/wire-mesh-pallets-container.html"])
    assert.ok(new RegExp(`\\b${echt}\\b`).test(lies(datei)), `${datei}: die Zahl ${echt} steht nicht auf der Seite`);
});
