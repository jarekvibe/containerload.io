// Der Palettenrechner (/ratgeber/palettenrechner, /en/guide/pallet-calculator).
//
// Die Seite verspricht: dieselbe Zahl wie im 3D-Rechner, und ein Klick auf "3D →" oeffnet
// genau diese Ladung. Dieser Test haelt das Versprechen fest:
//   * beide Dateien sind GENAU das, was werkzeug/palettenrechner.mjs aus app.html macht
//     (Packer, Masse, Tabellen und Zahlen im Text ziehen mit, wenn app.html sich aendert)
//   * der Packer der Seite ist woertlich der aus app.html, die Laderaeume sind PRESETS/VEHICLES
//   * palRechnen (der Rechenkern der Seite, wirklich ausgefuehrt) == packCargo im Rechner
//   * der 3D-Link wird vom Import-Parser der App zu genau dieser Ladung gelesen, und die
//     Deeplink-Schluessel stehen in den Whitelists der App
//
// node --test test/palettenrechner.test.mjs
import fs from "node:fs";
import assert from "node:assert";
import test from "node:test";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { palettenSeiten, packerQuelle, raeume } from "../../werkzeug/palettenrechner.mjs";

const dir = path.dirname(fileURLToPath(import.meta.url));
const wurzel = path.join(dir, "..");
const lies = (p) => fs.readFileSync(path.join(wurzel, p), "utf8");
const app = lies("app.html");
const de = lies("ratgeber/palettenrechner.html"), en = lies("en/guide/pallet-calculator.html");

const L = app.split("\n");
const block = (anfang, ende) => {
  const a = L.findIndex((l) => l.includes(anfang));
  const e = L.findIndex((l, i) => i > a && ende(l, i));
  assert.ok(a >= 0 && e > a, `${anfang} nicht gefunden`);
  return L.slice(a, e + 1).join("\n");
};
const M = new Function(
  'var num=(v,d=0)=>Number.isFinite(+v)&&v!==""?+v:d;\n'
  + block("var PRESETS = {", (l) => l.trim() === "};") + "\n"
  + block("var VEHICLES = {", (l) => l.trim() === "};") + "\n"
  + block("function makeFloorPacker", (l, i) => l.trim() === "}" && L[i - 1].includes("return { placed, perType"))
  + "\nreturn { packCargo, PRESETS, VEHICLES };"
)();
const pv = L.findIndex((l) => l.includes("var PALLET_PRESETS = ["));
const pb = L.findIndex((l, i) => i > pv && l.includes("var hexA"));
const { parseCargoText } = new Function(L.slice(pv, pb).join("\n") + "\nreturn { parseCargoText };")();

const schnitt = (html, von, bis) => {
  const a = html.indexOf(von), b = html.indexOf(bis);
  assert.ok(a > 0 && b > a, `Marker ${von}…${bis} nicht gefunden`);
  return html.slice(a, b + bis.length);
};
// Der Rechenkern der deutschen Seite, wirklich ausgefuehrt
const kern = new Function(schnitt(de, "// PAL_CALC_START", "// PAL_CALC_END") + "\nreturn { palRechnen, RAEUME, makeFloorPacker };")();

test("beide Seiten sind genau das, was der Generator aus app.html macht", () => {
  const s = palettenSeiten(app);
  assert.ok(de === s.de, "ratgeber/palettenrechner.html veraltet oder von Hand geaendert -- node werkzeug/palettenrechner.mjs");
  assert.ok(en === s.en, "en/guide/pallet-calculator.html veraltet oder von Hand geaendert -- node werkzeug/palettenrechner.mjs");
});

test("Rechenkern und Oberflaeche sind auf beiden Seiten woertlich gleich, der Packer ist der aus app.html", () => {
  for (const [a, b] of [["// PAL_CALC_START", "// PAL_CALC_END"], ["// PAL_UI_START", "// PAL_UI_END"]]) {
    assert.strictEqual(schnitt(de, a, b), schnitt(en, a, b), `${a} weicht ab`);
  }
  assert.ok(de.includes("\n" + packerQuelle(app) + "\n"), "der Packer der Seite ist nicht woertlich der aus app.html");
  // Die Laderaeume: Masse und Zuladung aus PRESETS / VEHICLES
  const NAME = { "20gp": ["P", "20' GP"], "40gp": ["P", "40' GP"], "40hc": ["P", "40' HC"], "45hc": ["P", "45' HC"],
    sattel: ["V", "Planensattel"], wb: ["V", "Wechselbrücke"], mw: ["V", "Motorwagen"], "75t": ["V", "7,5-Tonner"], sprinter: ["V", "Sprinter"] };
  assert.strictEqual(kern.RAEUME.length, Object.keys(NAME).length);
  for (const r of kern.RAEUME) {
    const [q, n] = NAME[r.k], m = (q === "P" ? M.PRESETS : M.VEHICLES)[n];
    assert.deepStrictEqual([r.l, r.w, r.h, r.kg], [m.l, m.w, m.h, m.payload], `${r.k}: Masse weichen von app.html ab`);
  }
  assert.deepStrictEqual(kern.RAEUME, raeume(app));
});

test("palRechnen == packCargo: dieselbe Zahl wie der 3D-Rechner", () => {
  // Stichprobe ueber Paletten, Hoehen, stapelbar und Gewicht (die volle Probe mit 720
  // Faellen lief beim Bau; hier genug, dass eine Aenderung an einer Seite auffaellt).
  let n = 0;
  for (const r of kern.RAEUME) for (const [l, w] of [[120, 80], [120, 100], [122, 102]]) for (const [h, st, kg] of [[110, false, 0], [110, true, 0], [130, true, 0], [100, true, 600], [150, false, 300]]) {
    const e = kern.palRechnen(l, w, h, st, kg, r);
    const R = { l: r.l, w: r.w, h: r.h, payload: r.kg };
    const p = M.packCargo(R, [{ l, w, h, qty: e.boden * Math.max(1, e.lagen) + 3, weight: kg, stackable: st }], {});
    assert.strictEqual(e.n, p.boxes, `${r.k} ${l}x${w} h${h} ${st ? "stapelbar" : "flach"} ${kg}kg: Seite ${e.n}, Rechner ${p.boxes}`);
    n++;
  }
  assert.ok(n >= 120);
  // Gegenproben der Sonderfaelle
  const gp = kern.RAEUME.find((r) => r.k === "20gp");
  assert.deepStrictEqual(kern.palRechnen(120, 80, 250, true, 0, gp), { boden: 11, lagen: 0, n: 0, zuHoch: true, kgGrenze: false, hoch: true }, "hoeher als der Container");
  assert.strictEqual(kern.palRechnen(120, 80, "", true, 0, gp).lagen, 1, "stapelbar ohne Hoehe: eine Lage, nichts erfunden");
  assert.strictEqual(kern.palRechnen(120, 80, 119, true, 0, gp).n, 22);
  assert.strictEqual(kern.palRechnen(120, 80, 120, true, 0, gp).n, 11, "120 cm: zwei Lagen sind 240 > 239");
  const spr = kern.RAEUME.find((r) => r.k === "sprinter");
  const kgFall = kern.palRechnen(120, 80, 100, false, 250, spr);
  assert.ok(kgFall.kgGrenze && kgFall.n === Math.floor(spr.kg / 250) && kgFall.n < kgFall.boden, "Transporter: das Gewicht begrenzt");
  assert.strictEqual(kern.palRechnen(0, 80, 100, false, 0, gp), null);
});

test("der 3D-Link: die App liest genau diese Ladung, in genau diesem Laderaum", () => {
  const ui = schnitt(de, "// PAL_UI_START", "// PAL_UI_END");
  // So baut die Oberflaeche den Text (Menge, Masse, Gewicht, ggf. "nicht stapelbar")
  assert.ok(ui.includes("var q = e.n + 'x ' + Number(fl.value) + 'x' + Number(fw.value) + 'x' + Number(fh.value) + (Number(fkg.value) > 0 ? ' ' + Number(fkg.value) + 'kg' : '') + (fst.checked ? '' : palCfg.flach);"));
  assert.ok(ui.includes("if (e && e.hoch && e.n > 0)"), "ohne Hoehe darf es keinen 3D-Link geben");
  for (const [flach, stapelbar] of [[" nicht stapelbar", false], ["", true], [" not stackable", false]]) {
    const r = parseCargoText("22x 120x80x110 400kg" + flach);
    assert.strictEqual(r.length, 1);
    const z = r[0];
    assert.deepStrictEqual([z.qty, z.l, z.w, z.h, z.weight], [22, 120, 80, 110, 400], `Parser liest "${flach}" anders`);
    assert.strictEqual(z.stackable !== false, stapelbar, `"${flach}": stapelbar falsch gelesen`);
  }
  assert.ok(de.includes("flach: ' nicht stapelbar'") && en.includes("flach: ' not stackable'"));
  // Deeplink-Schluessel: jeder steht in der Whitelist der App
  const qcont = block("var QCONT = (() => {", (l) => l.trim() === "})();");
  const qfz = block("var QFZ = (() => {", (l) => l.trim() === "})();");
  for (const r of kern.RAEUME) {
    if (r.cont) assert.ok(qcont.includes(`"${r.cont}":`), `cont=${r.cont} kennt die App nicht`);
    else assert.ok(qfz.includes(`"${r.fz}":`), `fz=${r.fz} kennt die App nicht`);
  }
  assert.ok(de.includes("(r.cont ? '&cont=' + r.cont : '&d=road&fz=' + r.fz)") && en.includes("+ '&lang=en'; }"));
});

test("ohne JavaScript und fuer die Suche: die Tabelle steht schon im HTML", () => {
  for (const [name, html] of [["DE", de], ["EN", en]]) {
    const body = html.match(/<tbody id="palRows">([\s\S]*?)<\/tbody>/)[1];
    const zeilen = [...body.matchAll(/<tr>([\s\S]*?)<\/tr>/g)];
    assert.strictEqual(zeilen.length, kern.RAEUME.length, `${name}: Zeilenzahl`);
    zeilen.forEach((z, i) => {
      const zahlen = [...z[1].matchAll(/<td class="num">(?:<b>)?([\d.,]+)/g)].map((m) => Number(m[1].replace(/[.,]/g, "")));
      const soll = kern.makeFloorPacker(120, 80, true)(kern.RAEUME[i].l, kern.RAEUME[i].w).count;
      assert.deepStrictEqual(zahlen, [soll, soll], `${name} ${kern.RAEUME[i].k}: Erstbelegung stimmt nicht`);
    });
  }
  // Langsame Masse: in Schritten rechnen, Eingabe abwarten, unter 40 cm nicht rechnen
  const ui = schnitt(de, "// PAL_UI_START", "// PAL_UI_END");
  assert.ok(ui.includes("setTimeout(weiter, 0)") && ui.includes("if (meinLauf !== lauf) return;"), "Zeile fuer Zeile mit Abbruch");
  assert.ok(ui.includes("warte = setTimeout(zeichnen, 250)") && ui.includes("if (!(L >= 40) || !(W >= 40))"));
});

test("Kopf, Text und FAQ: Suchbegriff vorne, Zahlen vom Packer, Schema = sichtbar", () => {
  const Z = palettenSeiten(app).zahlen;
  assert.deepStrictEqual([Z.eur20, Z.eur40, Z.eurSattel, Z.us20, Z.us40, Z.max2Gp, Z.max2Hc], [11, 25, 34, 9, 20, 119, 135], "Packer oder Masse haben sich geaendert -- Texte pruefen");
  for (const [name, html, url, begriff] of [
    ["DE", de, "https://containerload.io/ratgeber/palettenrechner", /^Palettenrechner: Wie viele Paletten/],
    ["EN", en, "https://containerload.io/en/guide/pallet-calculator", /^Pallet calculator: how many pallets fit/]
  ]) {
    const titel = html.match(/<title>([^<]+)<\/title>/)[1];
    const desc = html.match(/<meta name="description" content="([^"]+)"/)[1];
    assert.ok(begriff.test(titel) && titel.length <= 60, `${name}-Titel (${titel.length}): ${titel}`);
    assert.ok(desc.length <= 155, `${name}-Beschreibung ${desc.length}`);
    assert.ok(html.includes(`<link rel="canonical" href="${url}" />`) && html.includes(`<meta property="og:url" content="${url}" />`));
    assert.ok(html.includes('<link rel="alternate" hreflang="de" href="https://containerload.io/ratgeber/palettenrechner" />'));
    assert.ok(html.includes('<link rel="alternate" hreflang="en" href="https://containerload.io/en/guide/pallet-calculator" />'));
    const ld = JSON.parse(html.match(/<script type="application\/ld\+json">(.*?)<\/script>/s)[1]);
    assert.strictEqual(ld["@type"], "FAQPage");
    for (const q of ld.mainEntity) assert.ok(html.includes(`<p><b>${q.name}</b><br>${q.acceptedAnswer.text}</p>`), `${name}: "${q.name}" nicht sichtbar`);
    assert.ok(/\b11\b/.test(html.match(/<div class="answer">[\s\S]*?<\/div>/)[0]), `${name}: Antwort ohne die 11`);
  }
});

test("eingebunden: Sitemap, Indexseiten, Startseite, Nachbarseiten", () => {
  const sm = lies("sitemap.xml");
  assert.ok(sm.includes("<loc>https://containerload.io/ratgeber/palettenrechner</loc>") && sm.includes("<loc>https://containerload.io/en/guide/pallet-calculator</loc>"));
  assert.ok(lies("ratgeber/index.html").includes('href="/ratgeber/palettenrechner"'));
  assert.ok(lies("en/guide/index.html").includes('href="/en/guide/pallet-calculator"'));
  assert.ok(lies("index.html").includes('<a href="/ratgeber/palettenrechner">'), "Startseite verlinkt den Palettenrechner nicht");
  assert.ok(lies("index.html").includes("'/ratgeber/palettenrechner':'/en/guide/pallet-calculator'"), "GUIDE-Tabelle ohne Palettenrechner");
  assert.ok(lies("ratgeber/stellplaetze-container.html").includes('href="/ratgeber/palettenrechner"'));
  assert.ok(lies("en/guide/container-floor-positions.html").includes('href="/en/guide/pallet-calculator"'));
});
