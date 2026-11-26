// Die Sprach-Wellen: je Sprache vier Wissensseiten plus Uebersicht (es/guia/, fr/guide/), nach
// dem Muster der NL-Welle. Ohne sie stuende fuer die Sprache nur EINE Seite in der Suche (die
// Startseite). Dieselben Regeln wie immer: jede Zahl kommt aus dem Packer bzw. aus PRESETS,
// die Draufsicht zeichnet exakt die Stellplaetze, der Knopf laedt genau die genannte Menge --
// und das hreflang-Netz ist ein sauberes FUENFER-Cluster (de/en/nl/es/fr + x-default) auf
// allen Fassungen.
//
// Anders als die NL-Seiten fuehren diese in einen Rechner in IHRER Sprache (?lang=es / fr).
//
// Eine weitere Welle = ein Eintrag in WELLEN und eine Spalte in CLUSTER; die Zahl der
// hreflang-Zeilen rechnet der Test aus der Spaltenzahl.
import fs from "node:fs";
import assert from "node:assert";
import test from "node:test";
import { fileURLToPath } from "node:url";
import path from "node:path";

const dir = path.dirname(fileURLToPath(import.meta.url));
const app = fs.readFileSync(path.join(dir, "..", "app.html"), "utf8");
const L = app.split("\n");
const pStart = L.findIndex((l) => l.includes("var PRESETS = {"));
const pEnd = L.findIndex((l, i) => i > pStart && l.trim() === "};");
const ps = L.findIndex((l) => l.includes("function makeFloorPacker"));
const pe = L.findIndex((l, i) => i > ps && l.trim() === "}" && L[i - 1].includes("return { placed, perType"));
const { makeFloorPacker, PRESETS } = new Function(
  'var num=(v,d=0)=>Number.isFinite(+v)&&v!==""?+v:d;\n'
  + L.slice(pStart, pEnd + 1).join("\n") + "\n"
  + L.slice(ps, pe + 1).join("\n") + "\nreturn { makeFloorPacker, PRESETS };"
)();
const pa = L.findIndex((l) => l.includes("var PALLET_PRESETS = [")), pb = L.findIndex((l, i) => i > pa && l.includes("var hexA"));
const { parseCargoText } = new Function(L.slice(pa, pb).join("\n") + "\nreturn { parseCargoText };")();
const lese = (p) => fs.readFileSync(path.join(dir, "..", p), "utf8");
const B = "https://containerload.io";

// Spalten: de, en, nl, es, fr. Zeilen: 20-Fuss-Paletten, 40-Fuss-Paletten, Kubikmeter, Masse.
const SPALTEN = ["de", "en", "nl", "es", "fr"];
const NAMEN = { de: "Deutsch", en: "English", nl: "Nederlands", es: "Español", fr: "Français" };
const CLUSTER = [
  ["ratgeber/europaletten-20-fuss-container", "en/guide/euro-pallets-20ft-container", "nl/gids/europallets-20ft-container", "es/guia/europalets-contenedor-20-pies", "fr/guide/europalettes-conteneur-20-pieds"],
  ["ratgeber/europaletten-40-fuss-container", "en/guide/euro-pallets-40ft-container", "nl/gids/europallets-40ft-container", "es/guia/europalets-contenedor-40-pies", "fr/guide/europalettes-conteneur-40-pieds"],
  ["ratgeber/container-volumen-cbm", "en/guide/container-volume-cbm", "nl/gids/cbm-container", "es/guia/metros-cubicos-contenedor", "fr/guide/volume-conteneur-m3"],
  ["ratgeber/container-masse-innenmasse", "en/guide/container-internal-dimensions", "nl/gids/container-afmetingen", "es/guia/medidas-contenedor", "fr/guide/dimensions-conteneur"],
];
// Je Welle: Ordner, og:locale, und woran man erkennt, dass fremder Text stehengeblieben ist.
// Die Fremdwort-Liste nennt nur Woerter, die es in der Sprache der Seite NICHT gibt.
const WELLEN = {
  // Die aelteste Welle (26.10.26). Bis 26.11.26 fuehrte sie in den ENGLISCHEN Rechner, weil es
  // keinen niederlaendischen gab -- seitdem gelten fuer sie dieselben Regeln wie fuer die anderen.
  nl: {
    ordner: "nl/gids", locale: "nl_NL",
    fremd: /\b(und|nicht|Paletten|how many|the|with|combien|avec|conteneur|cuántos|caben|palets|contenedor)\b/gi,
    nurEnDe: /in het Engels of Duits/i,
  },
  es: {
    ordner: "es/guia", locale: "es_ES",
    fremd: /\b(passen|hoeveel|de calculator|niet|één|und|nicht|Paletten|pallets passen|how many|the|with|combien|avec|conteneur)\b/gi,
    nurEnDe: /ingl[eé]s o alem[aá]n/i,
  },
  fr: {
    ordner: "fr/guide", locale: "fr_FR",
    fremd: /\b(passen|hoeveel|de calculator|niet|één|und|nicht|Paletten|pallets passen|how many|the|with|cuántos|caben|palets|contenedor)\b/gi,
    nurEnDe: /(qu’|uniquement |seulement )en anglais (ou|et) en allemand/i,
  },
};
// Themen, die es NICHT in allen fuenf Sprachen gibt, bilden ihr eigenes, kleineres Netz -- mit
// denselben Regeln (hreflang auf allen Fassungen, Menue ab drei Sprachen, Sitemap). Die Palette
// 48 x 40 Zoll (Nordamerika; in Mexiko "tarima"): Deutsch, Englisch, Spanisch.
const TEIL_CLUSTER = [
  { spalten: ["de", "en", "es"], seiten: ["ratgeber/us-paletten-20-fuss-container", "en/guide/pallets-20ft-container", "es/guia/pallets-48x40-contenedor-20-pies"] },
  { spalten: ["de", "en", "es"], seiten: ["ratgeber/us-paletten-40-fuss-container", "en/guide/pallets-40ft-container", "es/guia/pallets-48x40-contenedor-40-pies"] },
  // CBM berechnen ("cubicaje" -- so heisst die Rechnung in Lateinamerika), mit dem CBM-Rechner
  { spalten: ["de", "en", "es"], seiten: ["ratgeber/cbm-berechnen", "en/guide/how-to-calculate-cbm", "es/guia/calcular-cubicaje-cbm"] },
];
const NETZE = [...CLUSTER.map((c) => ({ spalten: SPALTEN, seiten: c })), ...TEIL_CLUSTER];
const spalte = (k) => SPALTEN.indexOf(k);
const seiten = (k) => CLUSTER.map((c) => c[spalte(k)]);
// Was eine Welle ueber ihre vier Themen hinaus traegt (in der Reihenfolge von TEIL_CLUSTER).
const mehr = (k) => TEIL_CLUSTER.filter((n) => n.spalten.includes(k)).map((n) => n.seiten[n.spalten.indexOf(k)]);

for (const [k, W] of Object.entries(WELLEN)) {
  const [s20, s40, sM3, sMass] = seiten(k);
  const K = k.toUpperCase();

  test(`${K}: die Palettenzahlen kommen aus dem Packer -- und der Knopf laedt genau sie`, () => {
    const C20 = PRESETS["20' GP"], C40 = PRESETS["40' GP"];
    const faelle = [
      [s20 + ".html", C20, 11, 8, 22, null],
      [s40 + ".html", C40, 25, 20, 50, "40gp"],
    ];
    for (const [f, C, lage, ohne, zwei, cont] of faelle) {
      assert.strictEqual(makeFloorPacker(120, 80, true)(C.l, C.w).count, lage);
      assert.strictEqual(makeFloorPacker(120, 80, false)(C.l, C.w).count, ohne);
      assert.strictEqual(zwei, 2 * lage);
      const s = lese(f);
      for (const z of [lage, ohne, zwei]) assert.ok(new RegExp(`\\b${z}\\b`).test(s), `${f}: die Zahl ${z} fehlt`);
      // Das SVG zeichnet exakt die Stellplaetze der ersten Lage plus den Umriss.
      const m = s.match(/<figure class="stau">([\s\S]*?)<\/figure>/);
      assert.ok(m, `${f}: keine Draufsicht`);
      assert.strictEqual((m[1].match(/<rect /g) || []).length, lage + 1, `${f}: SVG-Stellplaetze`);
      // Der Knopf: durch den echten Parser genau die genannte Menge Europaletten, im richtigen Container
      const links = [...s.matchAll(new RegExp(`href="/app\\?lang=${k}&q=([^"&]+)(?:&cont=([a-z0-9]+))?"`, "g"))];
      assert.ok(links.length >= 2, `${f}: Rechner-Knoepfe fehlen`);
      for (const [, q, c] of links) {
        const rows = parseCargoText(decodeURIComponent(q));
        assert.strictEqual(rows.length, 1);
        assert.deepStrictEqual([rows[0].qty, rows[0].l, rows[0].w], [lage, 120, 80], `${f}: der Knopf laedt eine andere Ladung`);
        assert.strictEqual(c || null, cont, `${f}: der Knopf waehlt den falschen Container vor`);
      }
    }
    // Das Container-Kuerzel gibt es im Rechner
    assert.ok(/QCONT[\s\S]{0,400}40gp/.test(app), "40gp ist im Rechner kein bekanntes Kuerzel");
  });

  test(`${K}: die Kubikmeter sind aus den PRESETS gerechnet (eine Nachkommastelle)`, () => {
    const s = lese(sM3 + ".html");
    for (const name of ["20' GP", "40' GP", "40' HC", "45' HC"]) {
      const P = PRESETS[name];
      const m3 = (P.l * P.w * P.h / 1e6).toFixed(1).replace(".", ",");
      assert.ok(s.includes(`${m3} m³`), `${sM3}: ${name} = ${m3} m³ fehlt`);
      assert.ok(s.includes(`${P.l} × ${P.w} × ${P.h} cm`), `${sM3}: Innenmass ${name} fehlt`);
    }
  });

  test(`${K}: die Mass-Tabellen tragen die PRESETS-Innenmasse und -Tueren`, () => {
    const s = lese(sMass + ".html");
    for (const name of ["20' GP", "20' HC", "40' GP", "40' HC", "45' HC"]) {
      const P = PRESETS[name];
      for (const v of [P.l, P.w, P.h]) assert.ok(new RegExp(`\\b${v} cm\\b`).test(s), `${sMass}: ${name} — ${v} cm fehlt`);
      assert.ok(s.includes(`${Math.round(P.door.w)} × ${Math.round(P.door.h)} cm`), `${sMass}: Tuer ${name} fehlt`);
    }
    // Aussenmasse sind ISO-668-Normwerte
    for (const t of ["606 × 244 × 259 cm", "1219 × 244 × 259 cm", "1219 × 244 × 290 cm", "1372 × 244 × 290 cm"]) assert.ok(s.includes(t), `${sMass}: ${t} fehlt`);
  });

  test(`${K}: Suchergebnis -- Titel mit Zahl oder Thema, Laengen im Schnitt, og/twitter gleichlautend`, () => {
    for (const f of [...seiten(k), ...mehr(k), W.ordner + "/index"]) {
      const s = lese(f + ".html");
      const titel = /<title>(.*?)<\/title>/.exec(s)[1], desc = /<meta name="description" content="([^"]*)"/.exec(s)[1];
      assert.ok(titel.length <= 60, `${f}: Titel ${titel.length} Zeichen`);
      assert.ok(desc.length >= 110 && desc.length <= 155, `${f}: Beschreibung ${desc.length} Zeichen`);
      for (const m of ['property="og:title"', 'name="twitter:title"']) assert.ok(s.includes(`<meta ${m} content="${titel.replace(/&/g, "&amp;")}" />`), `${f}: ${m} weicht vom Titel ab`);
      for (const m of ['property="og:description"', 'name="twitter:description"']) assert.ok(s.includes(`<meta ${m} content="${desc}" />`), `${f}: ${m} weicht ab`);
      assert.ok(s.includes(`<meta property="og:locale" content="${W.locale}" />`), `${f}: og:locale`);
      assert.ok(s.includes(`<html lang="${k}">`), `${f}: lang-Attribut`);
      assert.ok(s.includes('<link rel="stylesheet" href="/ratgeber/wissen.css" />'), `${f}: eigene Gestaltung statt der gemeinsamen`);
    }
    // FAQ-Schema: gueltig, und die Antwort nennt die Zahl der Seite
    for (const [f, zahl] of [[s20, "11"], [s40, "25"], [sM3, "33,1"], [sMass, "590"]]) {
      const ld = JSON.parse(/<script type="application\/ld\+json">(.*?)<\/script>/s.exec(lese(f + ".html"))[1]);
      assert.strictEqual(ld["@type"], "FAQPage");
      assert.ok(ld.mainEntity.length >= 2 && ld.mainEntity[0].acceptedAnswer.text.includes(zahl), `${f}: die erste Antwort nennt ${zahl} nicht`);
    }
  });

  test(`${K}: die Seiten stehen in ihrer Sprache, fuehren in ihren Rechner und nie in den deutschen Baum`, () => {
    // Hinaus fuehren nur: der englische Guide (fuer alles, was es in der Sprache nicht gibt) und
    // die englischen Rechtsseiten -- die deutschen sind fuer nicht-deutsche Seiten tabu
    // (test/rechtsseiten-en).
    const baum = new RegExp(`^/${k}/|^/en/guide/$|^/en/imprint$|^/en/privacy$`);
    for (const f of [...seiten(k), ...mehr(k), W.ordner + "/index"]) {
      const s = lese(f + ".html");
      const koerper = s.slice(s.indexOf("<body"));
      // Skripte sind kein sichtbarer Text (der CBM-Rechner traegt deutsche Kommentare und
      // steht auf jeder Seite woertlich gleich -- test/cbm-widget).
      const text = koerper.replace(/<details class="langmenu">[\s\S]*?<\/details>/, " ").replace(/<svg[\s\S]*?<\/svg>/g, " ").replace(/<script[\s\S]*?<\/script>/g, " ")
        .replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ");
      const fremd = text.match(W.fremd) || [];
      assert.deepStrictEqual([...new Set(fremd)], [], `${f}: fremde Woerter im Text`);
      assert.ok(!W.nurEnDe.test(text), `${f}: behauptet, den Rechner gebe es nur auf Englisch oder Deutsch`);
      for (const [tag, h] of koerper.matchAll(/<a\b[^>]*href="([^"]*)"[^>]*>/g)) {
        if (/hreflang=/.test(tag)) continue;                                   // Sprachumschalter
        if (/^\/app/.test(h)) assert.ok(new RegExp(`^/app\\?lang=${k}(&|$)`).test(h), `${f}: Rechner-Link ohne lang=${k}: ${h}`);
        else assert.ok(baum.test(h), `${f}: Link aus dem eigenen Baum heraus: ${h}`);
      }
    }
    // Uebersicht und Rueckweg
    const ix = lese(W.ordner + "/index.html");
    for (const p of [...seiten(k), ...mehr(k)]) {
      assert.ok(ix.includes(`href="/${p}"`), `${K}-Uebersicht verlinkt ${p} nicht`);
      assert.ok(lese(p + ".html").includes(`href="/${W.ordner}/"`), `${p}: Rueckweg zur Uebersicht fehlt`);
    }
    // Die Startseite der Sprache fuehrt auf diese Seiten statt auf die englischen
    const start = lese(`${k}/index.html`);
    for (const p of seiten(k)) assert.ok(start.includes(`href="/${p}"`), `die Startseite /${k}/ verlinkt ${p} nicht`);
    assert.ok(start.includes(`href="/${W.ordner}/"`), `die Startseite /${k}/ verlinkt die Uebersicht nicht`);
    // ... und der Rueckweg aus dem Rechner geht auf die Startseite der Sprache
    assert.ok(lese(`sprache/${k}.js`).includes(`start: "/${k}/"`), `sprache/${k}.js: Rueckweg auf die Startseite fehlt`);
  });
}

// ── Die Palette 48 x 40 Zoll auf Spanisch ──────────────────────────────────────────────────
// Dritte Fassung der US-Seiten (test/wissen-zahlen rechnet die deutsche und die englische).
// Der eigene Kern der spanischen: mit "palet americano" ist in Spanien oft die Palette
// 1200 x 1000 mm gemeint -- im 20-Fuss ergibt das dieselbe Zahl, im 40-Fuss 22 statt 20.
// Beide Zahlen kommen aus dem Packer; der Namensgebrauch selbst ist nicht gerechnet.
test("ES: die Seiten zur Palette 48 x 40 Zoll -- Packer, Draufsicht, Knopf und der Vergleich mit 1200 x 1000", () => {
  const PL = 121.92, PW = 101.6;
  assert.deepStrictEqual([48 * 2.54, 40 * 2.54], [PL, PW]);
  const [s20, s40] = mehr("es");
  const faelle = [
    [s20, "20' GP", "20' HC", 9, 8, 18, null, 9],
    [s40, "40' GP", "40' HC", 20, 18, 40, "40gp", 22],
  ];
  for (const [f, gp, hc, lage, ohne, zwei, cont, iso] of faelle) {
    const C = PRESETS[gp], H = PRESETS[hc];
    assert.strictEqual(makeFloorPacker(PL, PW, true)(C.l, C.w).count, lage);
    assert.strictEqual(makeFloorPacker(PL, PW, false)(C.l, C.w).count, ohne);
    assert.strictEqual(makeFloorPacker(PL, PW, true)(H.l, H.w).count, lage, "High Cube: derselbe Boden");
    assert.strictEqual(makeFloorPacker(120, 100, true)(C.l, C.w).count, iso, "die Palette 1200 x 1000");
    assert.strictEqual(zwei, 2 * lage);
    const s = lese(f + ".html");
    for (const z of [lage, ohne, zwei]) assert.ok(new RegExp(`<b>${z}( (pallets|huecos)[^<]*)?</b>`).test(s), `${f}: die Zahl ${z} steht nicht hervorgehoben im Text`);
    // Das genaue Mass, nicht die Rundung auf ganze Zentimeter
    assert.ok(/121,92&nbsp;×&nbsp;101,6&nbsp;cm/.test(s) && !/122&nbsp;×&nbsp;102/.test(s), `${f}: das genaue Mass fehlt`);
    // Tabelle: Innenmass aus PRESETS, Stellzahl, und zwei Lagen passen wirklich unter die Decke
    const zeilen = [...s.matchAll(/<tr><td>([^<]*)<\/td><td class="num">(\d+) × (\d+) cm<\/td><td class="num">(\d+)<\/td><td class="num">(\d+) cm por pallet<\/td><\/tr>/g)];
    assert.strictEqual(zeilen.length, 2, `${f}: Tabelle`);
    zeilen.forEach((z, i) => {
      const P = i ? H : C;
      assert.deepStrictEqual([+z[2], +z[3], +z[4]], [P.l, P.w, lage], `${f}: Tabellenzeile ${z[1]}`);
      assert.ok(2 * +z[5] <= P.h, `${f}: zwei Lagen zu ${z[5]} cm passen nicht in ${P.h} cm`);
      assert.ok(s.includes(`<b>${z[5]}&nbsp;cm (`), `${f}: die Hoehe ${z[5]} cm steht nicht im Text`);
    });
    // Draufsicht: ein Rechteck je Stellplatz plus Umriss
    const m = s.match(/<figure class="stau">([\s\S]*?)<\/figure>/);
    assert.ok(m, `${f}: keine Draufsicht`);
    assert.strictEqual((m[1].match(/<rect /g) || []).length, lage + 1, `${f}: SVG-Stellplaetze`);
    // Der Knopf: durch den echten Parser genau diese Ladung, metrisch geoeffnet, im richtigen Container
    const links = [...s.matchAll(/href="\/app\?lang=es&q=([^"&]+)(?:&cont=([a-z0-9]+))?"/g)];
    assert.strictEqual(links.length, 2, `${f}: Rechner-Knoepfe`);
    for (const [, q, c] of links) {
      const rows = parseCargoText(decodeURIComponent(q));
      assert.strictEqual(rows.length, 1);
      assert.deepStrictEqual([rows[0].qty, rows[0].l, rows[0].w], [lage, PL, PW], `${f}: der Knopf laedt eine andere Ladung`);
      assert.ok(rows[0].weight > 0 && 2 * rows[0].h > C.h, `${f}: die Beispielladung ginge in zwei Lagen -- der Rechner zeigte eine andere Zahl`);
      assert.strictEqual(c || null, cont, `${f}: der Knopf waehlt den falschen Container vor`);
    }
    assert.ok(!/href="\/app\?[^"]*u=in/.test(s) && s.includes("selector «in»"), `${f}: metrisch oeffnen, mit Hinweis auf den Schalter`);
    // FAQ-Schema: gueltig, die erste Antwort nennt die Zahl der Seite
    const ld = JSON.parse(/<script type="application\/ld\+json">(.*?)<\/script>/s.exec(s)[1]);
    assert.ok(ld["@type"] === "FAQPage" && ld.mainEntity.length >= 2 && new RegExp(`^${lage} pallets`).test(ld.mainEntity[0].acceptedAnswer.text), `${f}: die erste Antwort beginnt nicht mit ${lage}`);
    assert.ok(/\d/.test(/<title>(.*?)<\/title>/.exec(s)[1]), `${f}: Titel ohne Zahl`);
  }
  // Warum nicht 10: die Rechnung der 20-Fuss-Seite
  const C20 = PRESETS["20' GP"], C40 = PRESETS["40' GP"], t20 = lese(s20 + ".html"), t40 = lese(s40 + ".html");
  assert.ok(5 * PL > C20.l && 2 * PL > C20.w, "zehn passten doch");
  for (const z of [Math.round(5 * PL), C20.l, Math.round(2 * PL), C20.w]) assert.ok(t20.includes(`<b>${z}&nbsp;cm</b>`), `${s20}: ${z} cm fehlt in der Rechnung`);
  assert.ok(t20.includes("también 9"), `${s20}: der Vergleich mit 1200 × 1000 fehlt`);
  // 20 gegen 22: die Rechnung der 40-Fuss-Seite
  assert.deepStrictEqual([Math.floor(C40.l / PW), Math.floor(C40.l / PL), Math.floor(C40.l / 100), Math.floor(C40.l / 120)], [11, 9, 12, 10]);
  assert.ok(t40.includes("<b>12 atravesados y 10 a lo largo, 22</b>") && t40.includes("<b>11 y 9, 20</b>") && t40.includes("11 pallets atravesados junto a una pared y 9 a lo largo"), `${s40}: die zwei Muster`);
  assert.strictEqual(C40.l - 12 * 100, 3);
  assert.ok(t40.includes("<b>3&nbsp;cm</b>"), `${s40}: der knappe Rest der 22 fehlt`);
  assert.ok(t40.includes(`${Math.round(12 * PW)} cm y el interior mide ${C40.l} cm`), `${s40}: warum keine 12 quer`);
  assert.deepStrictEqual([Math.round(PL * 10 - 1200), Math.round(PW * 10 - 1000)], [19, 16]);
  for (const t of [t20, t40]) assert.ok(/19&nbsp;mm más corto y 16&nbsp;mm más estrecho/.test(t), "der Unterschied in Millimetern");
  // Gewicht: Zuladung aus PRESETS, die US-Grenze umgerechnet
  assert.ok(t40.includes(`<b>${(C40.payload / 1000).toFixed(1).replace(".", ",")}&nbsp;t</b>`), `${s40}: Zuladung`);
  assert.ok(t40.includes(`(unas ${(80000 * 0.45359237 / 1000).toFixed(1).replace(".", ",")}&nbsp;t)`), `${s40}: 80.000 Pfund in Tonnen`);
  assert.ok(t20.includes(`${18 * 500 / 1000}&nbsp;t de unas ${Math.round(C20.payload / 1000)}&nbsp;t`), `${s20}: Gewichtsrechnung`);
  assert.strictEqual(PRESETS["40' HC"].h - C40.h, 31);
  assert.ok(t40.includes("31&nbsp;cm de más"), `${s40}: Mehrhoehe High Cube`);
  // Die Uebersicht verspricht den Stoff nicht mehr dem englischen Guide
  assert.ok(!/palets americanos/.test(lese("es/guia/index.html")), "die Uebersicht schickt fuer diese Palette noch auf den englischen Guide");
});

test("ES: die Seite zum Cubicaje (CBM) -- Beispielrechnung, Containervolumen aus PRESETS, Knopf durch den Parser", () => {
  const f = mehr("es")[2];
  assert.strictEqual(f, "es/guia/calcular-cubicaje-cbm");
  const s = lese(f + ".html");
  // Die Beispielrechnung: 10 Kartons 60 x 40 x 40 cm
  const je = 0.6 * 0.4 * 0.4, sp = (n, d) => n.toFixed(d).replace(".", ",");
  for (const t of [`<td class="num">0,6 × 0,4 × 0,4</td><td class="num">${sp(je, 3)} m³</td>`, `<td class="num">${sp(je, 3)} × 10</td><td class="num">${sp(je * 10, 2)} CBM</td>`]) assert.ok(s.includes(t), `${f}: Beispielrechnung — ${t}`);
  const ld = JSON.parse(/<script type="application\/ld\+json">(.*?)<\/script>/s.exec(s)[1]);
  assert.ok(ld["@type"] === "FAQPage" && ld.mainEntity.length >= 2 && ld.mainEntity[0].acceptedAnswer.text.includes(`${sp(je, 3)} m³ por caja × 10 = ${sp(je * 10, 2)} CBM`), `${f}: die erste Antwort rechnet anders als die Seite`);
  // Containervolumen: dieselben Zahlen wie die spanische Volumen-Seite, aus PRESETS
  for (const name of ["20' GP", "40' GP", "40' HC"]) {
    const P = PRESETS[name], m3 = sp(P.l * P.w * P.h / 1e6, 1);
    assert.ok(s.includes(`${m3}&nbsp;m³`), `${f}: ${name} = ${m3} m³ fehlt`);
    assert.ok(lese("es/guia/metros-cubicos-contenedor.html").includes(`${m3} m³`), "die Volumen-Seite nennt eine andere Zahl");
  }
  assert.ok(ld.mainEntity[2].acceptedAnswer.text.includes("33,1 m³") && ld.mainEntity[2].acceptedAnswer.text.includes("67,6 m³"));
  // Der Knopf laedt genau das Beispiel
  const links = [...s.matchAll(/href="\/app\?lang=es&q=([^"&]+)"/g)];
  assert.strictEqual(links.length, 2, `${f}: Rechner-Knoepfe`);
  for (const [, q] of links) {
    const rows = parseCargoText(decodeURIComponent(q));
    assert.strictEqual(rows.length, 1);
    assert.deepStrictEqual([rows[0].qty, rows[0].l, rows[0].w, rows[0].h], [10, 60, 40, 40], `${f}: der Knopf laedt ein anderes Beispiel`);
  }
  // Die Uebersicht, die Volumen-Seite und die Startseite fuehren hierher
  for (const p of ["es/guia/index.html", "es/guia/metros-cubicos-contenedor.html", "es/index.html"]) assert.ok(lese(p).includes(`href="/${f}"`), `${p} verlinkt die Seite nicht`);
});

test("jedes Cluster ist ein sauberes Netz: hreflang auf ALLEN Fassungen, in beide Richtungen", () => {
  for (const { spalten: SPALTEN, seiten: c } of NETZE) {
    const zeilen = SPALTEN.length + 1;                                         // jede Sprache + x-default
    for (const f of c) {
      const s = lese(f + ".html");
      for (const [k, ziel] of [...SPALTEN.map((k, i) => [k, c[i]]), ["x-default", c[0]]]) {
        assert.ok(s.includes(`<link rel="alternate" hreflang="${k}" href="${B}/${ziel}" />`), `${f}: hreflang ${k} fehlt`);
      }
      assert.strictEqual((s.match(/<link rel="alternate" hreflang=/g) || []).length, zeilen, `${f}: nicht genau ${zeilen} hreflang-Zeilen`);
      assert.ok(s.includes(`<link rel="canonical" href="${B}/${f}" />`), `${f}: canonical zeigt nicht auf sich selbst`);
    }
  }
});

test("die Sprachwahl dieser Seiten ist ein Aufklapp-Menue -- und zeigt auf die Uebersetzung DIESER Seite", () => {
  // Fuenf Kuerzel nebeneinander lasen sich wie ein Code (Jarek zur Reihe im Rechner: "sieht
  // ultra weird aus ... am besten waere doch ein Drop-down"). Ein Knopf zeigt das Kuerzel der
  // aktuellen Sprache, darunter stehen die vollen Namen.
  for (const { spalten: SPALTEN, seiten: c } of NETZE) {
    c.forEach((f, i) => {
      const s = lese(f + ".html");
      const m = /<details class="langmenu"><summary aria-label="[^"]+">[\s\S]*?<span class="langcur">([A-Z]{2})<\/span>[\s\S]*?<\/summary><div class="lang" role="group" aria-label="[^"]+">([\s\S]*?)<\/div><\/details>/.exec(s);
      assert.ok(m, `${f}: kein Sprach-Menue`);
      assert.strictEqual(m[1], SPALTEN[i].toUpperCase(), `${f}: der Knopf zeigt nicht die Sprache der Seite`);
      const links = [...m[2].matchAll(/<a (class="on" )?href="([^"]*)" hreflang="([a-z]{2})" title="([^"]*)">([^<]*)<\/a>/g)];
      assert.deepStrictEqual(links.map((l) => [l[3], l[2]]), SPALTEN.map((k, j) => [k, "/" + c[j]]), `${f}: die Liste zeigt nicht auf die Uebersetzungen dieser Seite`);
      for (const l of links) assert.ok(l[5] === NAMEN[l[3]] && l[4] === NAMEN[l[3]], `${f}: ${l[3]} steht nicht mit vollem Namen im Menue`);
      assert.deepStrictEqual(links.filter((l) => l[1]).map((l) => l[3]), [SPALTEN[i]], `${f}: aktiv ist nicht genau die eigene Sprache`);
      assert.strictEqual((s.match(/<div class="lang"/g) || []).length, 1, `${f}: zwei Sprachwahlen`);
    });
  }
});

test("Menue ab drei Sprachen, Reihe bei zweien -- auf JEDER Wissensseite, und das Menue geht wieder zu", () => {
  let menues = 0, reihen = 0;
  for (const ordner of ["ratgeber", "en/guide", "nl/gids", "es/guia", "fr/guide"]) {
    for (const f of fs.readdirSync(path.join(dir, "..", ordner)).filter((x) => x.endsWith(".html"))) {
      const s = lese(`${ordner}/${f}`);
      const m = /<div class="lang"[^>]*>([\s\S]*?)<\/div>/.exec(s);
      if (!m) continue;
      const n = (m[1].match(/<a /g) || []).length, menue = s.includes('<details class="langmenu">');
      assert.strictEqual(menue, n >= 3, `${ordner}/${f}: ${n} Sprachen, ${menue ? "aber ein Menue" : "aber eine Reihe"}`);
      assert.strictEqual(s.includes('<script src="/ratgeber/langmenu.js" defer></script>'), menue, `${ordner}/${f}: Menue und Schliess-Skript gehoeren zusammen`);
      if (menue) menues++; else reihen++;
    }
  }
  assert.ok(menues >= NETZE.reduce((n, x) => n + x.seiten.length, 0) && reihen > 0, `Menues ${menues}, Reihen ${reihen}`);
  // Die Uebersichten der drei Wellen zeigen aufeinander
  for (const [f, k] of [["nl/gids/index.html", "nl"], ["es/guia/index.html", "es"], ["fr/guide/index.html", "fr"]]) {
    const s = lese(f);
    for (const [kk, h] of [["de", "/ratgeber/"], ["en", "/en/guide/"], ["nl", "/nl/gids/"], ["es", "/es/guia/"], ["fr", "/fr/guide/"]]) {
      assert.ok(s.includes(`href="${h}" hreflang="${kk}"`), `${f}: ${kk} fehlt in der Sprachwahl`);
    }
    assert.ok(new RegExp(`<span class="langcur">${k.toUpperCase()}</span>`).test(s), `${f}: Knopf zeigt nicht ${k}`);
  }
  // Gestaltung und Skript
  const css = lese("ratgeber/wissen.css"), js = lese("ratgeber/langmenu.js");
  assert.match(css, /\.langmenu\{[^}]*position:\s*relative/);
  assert.match(css, /\.langmenu \.lang\{[^}]*position:\s*absolute[^}]*flex-direction:\s*column/, "die Liste klappt nicht nach unten auf");
  assert.match(css, /\.langmenu:not\(\[open\]\) \.lang\{display:none\}/, "die zugeklappte Liste ist nicht sicher verborgen");
  assert.match(css, /\.langmenu summary::-webkit-details-marker\{display:none\}/);
  assert.ok(js.includes('"Escape"') && js.includes("!d.contains(e.target)"), "Esc bzw. Klick daneben schliesst das Menue nicht");
  assert.ok(!/fetch|XMLHttpRequest|localStorage|cookie/.test(js), "das Menue-Skript tut mehr als auf- und zuklappen");
});

test("Sitemap: jede Fassung gelistet, jeder Block eines Netzes traegt alle seine Sprachzeilen", () => {
  const sm = lese("sitemap.xml");
  for (const { spalten: SPALTEN, seiten: c } of NETZE) {
    const zeilen = SPALTEN.length + 1;
    for (const pfad of c) {
      const i = sm.indexOf(`<loc>${B}/${pfad}</loc>`);
      assert.ok(i > 0, `Sitemap: ${pfad} fehlt`);
      const block = sm.slice(i, sm.indexOf("</url>", i));
      SPALTEN.forEach((k, j) => assert.ok(block.includes(`hreflang="${k}" href="${B}/${c[j]}"`), `Sitemap-Block ${pfad}: ${k}-Zeile fehlt`));
      assert.ok(block.includes(`hreflang="x-default" href="${B}/${c[0]}"`), `Sitemap-Block ${pfad}: x-default fehlt`);
      assert.strictEqual((block.match(/hreflang="/g) || []).length, zeilen, `Sitemap-Block ${pfad}: nicht genau ${zeilen} Sprachzeilen`);
    }
  }
  for (const W of Object.values(WELLEN)) assert.ok(sm.includes(`<loc>${B}/${W.ordner}/</loc>`), `Sitemap: Uebersicht ${W.ordner} fehlt`);
  assert.strictEqual((sm.match(/<loc>/g) || []).length, new Set(sm.match(/<loc>[^<]*<\/loc>/g)).size, "doppelte Adresse in der Sitemap");
});
