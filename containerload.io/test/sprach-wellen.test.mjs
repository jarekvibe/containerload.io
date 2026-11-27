// Die Sprach-Wellen: je Sprache vier Wissensseiten plus Uebersicht (es/guia/, fr/guide/), nach
// dem Muster der NL-Welle. Ohne sie stuende fuer die Sprache nur EINE Seite in der Suche (die
// Startseite). Dieselben Regeln wie immer: jede Zahl kommt aus dem Packer bzw. aus PRESETS,
// die Draufsicht zeichnet exakt die Stellplaetze, der Knopf laedt genau die genannte Menge --
// und das hreflang-Netz ist ein sauberes Cluster (de/en/nl/es/fr/pt + x-default) auf
// allen Fassungen. Seit 26.11.26 mit Portugiesisch als sechster Spalte (pt/guia/).
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

// Spalten: de, en, nl, es, fr, pt. Zeilen: 20-Fuss-Paletten, 40-Fuss-Paletten, Kubikmeter, Masse.
const SPALTEN = ["de", "en", "nl", "es", "fr", "pt"];
const NAMEN = { de: "Deutsch", en: "English", nl: "Nederlands", es: "Español", fr: "Français", pt: "Português" };
const CLUSTER = [
  ["ratgeber/europaletten-20-fuss-container", "en/guide/euro-pallets-20ft-container", "nl/gids/europallets-20ft-container", "es/guia/europalets-contenedor-20-pies", "fr/guide/europalettes-conteneur-20-pieds", "pt/guia/paletes-conteiner-20-pes"],
  ["ratgeber/europaletten-40-fuss-container", "en/guide/euro-pallets-40ft-container", "nl/gids/europallets-40ft-container", "es/guia/europalets-contenedor-40-pies", "fr/guide/europalettes-conteneur-40-pieds", "pt/guia/paletes-conteiner-40-pes"],
  ["ratgeber/container-volumen-cbm", "en/guide/container-volume-cbm", "nl/gids/cbm-container", "es/guia/metros-cubicos-contenedor", "fr/guide/volume-conteneur-m3", "pt/guia/metros-cubicos-conteiner"],
  ["ratgeber/container-masse-innenmasse", "en/guide/container-internal-dimensions", "nl/gids/container-afmetingen", "es/guia/medidas-contenedor", "fr/guide/dimensions-conteneur", "pt/guia/medidas-conteiner"],
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
  // Brasilianisches Portugiesisch (26.11.26). Die Palettenseiten nennen NEBEN der Europalette
  // die PBR-Palette (1,00 x 1,20 m, das brasilianische Normmass) -- siehe den eigenen Test unten.
  pt: {
    ordner: "pt/guia", locale: "pt_BR",
    fremd: /\b(passen|hoeveel|niet|één|und|nicht|Paletten|how many|the|with|combien|avec|conteneur|cuántos|caben|palets|contenedor|contenedores|pies|ancho)\b/gi,
    nurEnDe: /(só|somente|apenas) em inglês (ou|e) (em )?alemão/i,
  },
};
// Themen, die es NICHT in allen fuenf Sprachen gibt, bilden ihr eigenes, kleineres Netz -- mit
// denselben Regeln (hreflang auf allen Fassungen, Menue ab drei Sprachen, Sitemap). Die Palette
// 48 x 40 Zoll (Nordamerika; in Mexiko "tarima"): Deutsch, Englisch, Spanisch.
const TEIL_CLUSTER = [
  { spalten: ["de", "en", "es"], seiten: ["ratgeber/us-paletten-20-fuss-container", "en/guide/pallets-20ft-container", "es/guia/pallets-48x40-contenedor-20-pies"] },
  { spalten: ["de", "en", "es"], seiten: ["ratgeber/us-paletten-40-fuss-container", "en/guide/pallets-40ft-container", "es/guia/pallets-48x40-contenedor-40-pies"] },
  // CBM berechnen ("cubicaje" -- so heisst die Rechnung in Lateinamerika), mit dem CBM-Rechner
  // Seit 26.11.26 mit Portugiesisch ("cubagem") als vierter Sprache
  { spalten: ["de", "en", "es", "pt"], seiten: ["ratgeber/cbm-berechnen", "en/guide/how-to-calculate-cbm", "es/guia/calcular-cubicaje-cbm", "pt/guia/calculo-cubagem-cbm"] },
  // Gewicht und Zuladung -- die meistgesehene deutsche Seite, mit dem Gewichts-Check
  { spalten: ["de", "en", "es"], seiten: ["ratgeber/container-zuladung-gewicht", "en/guide/container-payload-weight", "es/guia/peso-contenedor-carga-maxima"] },
  // Der Stauplan ("plan de estiba") -- die Seite, die das Werkzeug selbst beschreibt
  { spalten: ["de", "en", "es"], seiten: ["ratgeber/stauplan-container", "en/guide/container-stowage-plan", "es/guia/plan-de-estiba-contenedor"] },
  // Der Kuehlcontainer ("reefer") -- von Suedamerika faehrt Obst darin, auf Paletten 1,00 x 1,20 m
  { spalten: ["de", "en", "es"], seiten: ["ratgeber/reefer-container-masse", "en/guide/reefer-container-dimensions", "es/guia/contenedor-reefer-medidas"] },
  // Die Palette 1,00 x 1,20 m -- das uebliche Mass in Suedamerika ("parihuela", "estiba"); deutsch die Industriepalette
  { spalten: ["de", "en", "es"], seiten: ["ratgeber/industriepaletten-container", "en/guide/industrial-pallets-container", "es/guia/pallets-100x120-contenedor"] },
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
      // (Eine Seite darf daneben eine WEITERE Palette zeigen -- die portugiesische die PBR-Palette;
      // deren Knopf prueft der eigene Test weiter unten.)
      const links = [...s.matchAll(new RegExp(`href="/app\\?lang=${k}&q=([^"&]+)(?:&cont=([a-z0-9]+))?"`, "g"))].filter(([, q]) => !/pbr/i.test(decodeURIComponent(q)));
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

// ── Gewicht und Zuladung auf Spanisch ──────────────────────────────────────────────────────
// Dritte Fassung der Zuladungs-Seite. Den Gewichts-Check selbst haelt test/gewicht-check
// (Rechenkern woertlich gleich), die Tabelle Brutto - Tara = Zuladung test/wissen-vertiefung.
// Hier: jede Zahl im FLIESSTEXT gegen PRESETS und TARA, die Strassen-Rechnung, das Netz.
test("ES: die Seite zum Container-Gewicht -- Tara, Zuladung, Strasse und Dichte aus dem Rechner", () => {
  const f = mehr("es")[3];
  assert.strictEqual(f, "es/guia/peso-contenedor-carga-maxima");
  const s = lese(f + ".html");
  const TARA = new Function("return " + app.match(/var TARA = (\{[^}]+\})/)[1])();
  const kg = (n) => Math.round(n).toLocaleString("de-DE"), t1 = (n) => (n / 1000).toFixed(1).replace(".", ",");
  const P = (n) => PRESETS[n].payload, T = (n) => TARA[n];
  // Einleitung: Zuladung und Leergewicht
  const lead = /<p class="lead"[^>]*>([\s\S]*?)<\/p>/.exec(s)[1];
  for (const z of [`${Math.round(P("20' GP") / 1000)} toneladas`, `${t1(P("40' GP"))} toneladas`, `${t1(T("20' GP"))} toneladas`, `${t1(T("40' GP"))} toneladas`]) assert.ok(lead.includes(`<b>${z}</b>`), `${f}: "${z}" fehlt in der Einleitung`);
  // Leergewicht: Tonnen und Kilogramm je Typ, im Text und in der ersten FAQ-Antwort
  const ld = JSON.parse(/<script type="application\/ld\+json">(.*?)<\/script>/s.exec(s)[1]);
  assert.ok(ld["@type"] === "FAQPage" && ld.mainEntity.length >= 4);
  const leer = ld.mainEntity[0].acceptedAnswer.text;
  for (const n of ["20' GP", "40' GP", "40' HC"]) {
    const t = `${t1(T(n))} toneladas (${kg(T(n))} kg)`;
    assert.ok(leer.includes(t) && s.split(t).length - 1 >= 2, `${f}: Leergewicht ${n} -- "${t}" fehlt im Text oder im Schema`);
  }
  // Zuladung in den Antworten
  assert.ok(ld.mainEntity[1].acceptedAnswer.text.includes(`${t1(P("20' GP"))} toneladas: ${kg(P("20' GP") + T("20' GP"))} kg de peso bruto permitido menos unos ${kg(T("20' GP"))} kg de tara`), `${f}: die 20-Fuss-Antwort rechnet anders`);
  const a40 = ld.mainEntity[2].acceptedAnswer.text;
  for (const z of [t1(P("40' GP")), t1(P("40' HC")), t1(P("45' HC")), t1(T("40' GP") - T("20' GP"))]) assert.ok(a40.includes(`${z} toneladas`), `${f}: ${z} t fehlt in der 40-Fuss-Antwort`);
  // Warum der kleine mehr traegt: gleiches Brutto, 1,6 t mehr Stahl
  assert.strictEqual(P("20' GP") + T("20' GP"), P("40' GP") + T("40' GP"));
  assert.ok(s.includes(`(${kg(P("20' GP") + T("20' GP"))}&nbsp;kg)`) && s.includes(`<b>${t1(T("40' GP") - T("20' GP"))} toneladas</b> más de acero`), `${f}: die Erklaerung zum Bruttogewicht`);
  // Die Strasse: 40.000 / 44.000 - 12.000 - Tara 40' HC
  const frei = (zug) => zug - 12000 - T("40' HC");
  assert.ok(s.includes(`<td class="num">${kg(frei(40000))} kg</td><td class="num">${kg(frei(44000))} kg</td>`), `${f}: die Strassen-Rechnung`);
  assert.ok(s.includes(`unas ${Math.round(frei(40000) / 1000)} toneladas en lugar de ${t1(P("40' HC"))}`), `${f}: der Satz zur Strasse`);
  // Dichte: Zuladung / Volumen des 40-Fuss, zwei 20-Fuss gegen einen 40-Fuss
  const C40 = PRESETS["40' GP"], m3 = Math.round(C40.l * C40.w * C40.h / 1e6);
  assert.strictEqual(Math.round(P("40' GP") / m3 / 10) * 10, 390);
  assert.ok(s.includes(`<b>390 kg/m³</b> (${t1(P("40' GP"))}&nbsp;t ÷ ${m3} m³)`) && s.includes(`juntos cargan ${t1(2 * P("20' GP"))} toneladas; el de 40 pies, solo ${t1(P("40' GP"))}`), `${f}: die Dichte-Rechnung`);
  // Volumen-Spalte der Tabelle: gerundet aus PRESETS
  for (const n of ["20' GP", "20' HC", "40' GP", "40' HC", "45' HC"]) {
    const C = PRESETS[n];
    assert.ok(s.includes(`<td class="num">${kg(P(n))} kg</td><td class="num">≈ ${Math.round(C.l * C.w * C.h / 1e6)} m³</td>`), `${f}: ${n} -- Zuladung oder Volumen in der Tabelle`);
  }
  // Ehrlichkeit: die Summe ist noch keine VGM, und die Verantwortung bleibt beim Absender
  assert.ok(/<b>Todavía no es una VGM:<\/b>/.test(s) && /la responsabilidad de la declaración sigue siendo del expedidor/.test(s), `${f}: der VGM-Vorbehalt fehlt`);
  assert.ok(/no es asesoramiento jurídico/.test(s) && /lo vinculante es la placa CSC/.test(s), `${f}: der Hinweis ohne Gewaehr`);
  // Zahlen fuer einzelne Laender ausserhalb der EU stehen NICHT da (unbelegt)
  assert.ok(!/\b(Perú|México|Colombia|Chile|Argentina)\b/.test(s), `${f}: nennt ein Land, fuer das es keine belegte Grenze gibt`);
  // Die Uebersicht, die Nachbarseiten und die Startseite fuehren hierher
  for (const p of ["es/guia/index.html", "es/guia/metros-cubicos-contenedor.html", "es/guia/calcular-cubicaje-cbm.html", "es/index.html"]) assert.ok(lese(p).includes(`href="/${f}"`), `${p} verlinkt die Seite nicht`);
});

// ── Die PBR-Palette auf Portugiesisch ──────────────────────────────────────────────────────
// In Brasilien ist nicht die Europalette das uebliche Mass, sondern die PBR-Palette
// (1,00 x 1,20 m; Handbuch "Palete PBR-1" der ABRAS -- nachgeschlagen 26.11.26, nicht gerechnet).
// Die portugiesischen Palettenseiten nennen deshalb beide. Die Zahlen der PBR-Palette kommen
// aus dem Packer: 9 im 20-Fuss (nicht 10), 22 im 40-Fuss.
test("ES: die Seite zum Stauplan (plan de estiba) -- Dreh-Zahlen aus dem Packer, Beispiel durch die echte Rechnung, Ehrlichkeit", async () => {
  const f = "es/guia/plan-de-estiba-contenedor.html";
  const s = lese(f);
  const text = s.replace(/<script[\s\S]*?<\/script>/g, " ").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");

  // "11 europalets en lugar de 8": dieselben Zahlen wie auf der Europaletten-Seite, aus dem Packer.
  const C20 = PRESETS["20' GP"];
  const mit = makeFloorPacker(120, 80, true)(C20.l, C20.w).count, ohne = makeFloorPacker(120, 80, false)(C20.l, C20.w).count;
  assert.ok(text.includes(`caben ${mit} europalets en lugar de ${ohne}`), `${f}: der Dreh-Vergleich nennt nicht ${mit} gegen ${ohne}`);
  assert.ok(s.includes(`<a href="/es/guia/europalets-contenedor-20-pies">${mit} europalets en lugar de ${ohne}</a>`), `${f}: der Vergleich verweist nicht auf die Seite, die ihn herleitet`);

  // Der Beispiel-Knopf: was der Satz darunter verspricht (10 Paletten nicht stapelbar, 6 Kisten,
  // ein 20-Fuss-Container), liest der Parser -- und die Rechnung des Rechners bestaetigt es.
  const m = s.match(/<a class="btn btn-ghost" href="\/app\?lang=es&q=([^"&]+)">Ver un ejemplo en 3D<\/a>/);
  assert.ok(m, `${f}: der Beispiel-Knopf fehlt`);
  const q = decodeURIComponent(m[1]);
  const rows = parseCargoText(q);
  assert.deepStrictEqual(rows.map((r) => [r.qty, r.l, r.w, r.h, r.weight, r.stackable !== false]),
    [[10, 120, 80, 110, 300, false], [6, 60, 40, 40, 12, true]], `${f}: das Beispiel liest sich anders`);
  assert.ok(text.includes("El ejemplo abre 10 palets no apilables y 6 cajas en un contenedor de 20 pies"), `${f}: der Satz zum Beispiel fehlt`);
  const { planen } = await import("../../netlify/functions/lib/plan.mjs");
  const b = planen({ q, lang: "es" }).body;
  assert.strictEqual(b.ok, true);
  assert.strictEqual(b.plan.container.code, "20gp", "das Beispiel oeffnet nicht den 20-Fuss-Container");
  assert.deepStrictEqual([b.plan.fits_in_one, b.plan.pieces_loaded, b.plan.pieces_left], [true, 16, 0], `${f}: das Beispiel passt nicht in einen Container`);

  // Vier Schritte, drei Wege -- und jeder Weg, den die Seite nennt, heisst wie im spanischen Rechner.
  assert.strictEqual((s.match(/<tr><td>\d\. /g) || []).length, 4, `${f}: nicht vier Schritte`);
  const es = lese("sprache/es.js");
  for (const wort of ["Propuesta de carga", "no apilable", "apilable hasta "]) {
    assert.ok(es.includes(`"${wort}"`), `sprache/es.js kennt "${wort}" nicht mehr -- die Seite nennt es`);
    assert.ok(text.toLowerCase().includes(wort.trim().toLowerCase()), `${f}: "${wort}" fehlt`);
  }

  // Die Ehrlichkeitslinie: geometrisch, keine Ladungssicherung, kein Nachweis.
  assert.match(text, /estimación puramente geométrica/);
  assert.match(text, /No incluye comprobación de cargas por eje, centro de gravedad ni sujeción de la carga/);
  assert.match(text, /no es un justificante conforme al Código CTU/);
  assert.match(text, /plan de estiba geométrico no es: un plan de sujeción de la carga/);
  // Keine Behauptung ueber Pflichten einzelner Laender, keine deutsche Richtlinie auf einer spanischen Seite.
  assert.ok(!/VDI|aduana/i.test(text), `${f}: nennt VDI oder den Zoll -- beides ist fuer diese Leser unbelegt`);

  // Das FAQ-Schema sagt dasselbe wie die Seite (vier Fragen, keine davon ohne Antwort).
  const ld = JSON.parse(s.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1]);
  assert.strictEqual(ld["@type"], "FAQPage");
  assert.strictEqual(ld.mainEntity.length, 4);
  for (const e of ld.mainEntity) assert.ok(e.name.startsWith("¿") && e.acceptedAnswer.text.length > 80, "FAQ-Eintrag unvollstaendig: " + e.name);
  assert.ok(ld.mainEntity.some((e) => /no es un justificante conforme al Código CTU/.test(e.acceptedAnswer.text)), "das Schema verschweigt die Grenze des Plans");

  // Verlinkt von der Uebersicht und von der Gewichts-Seite; die Startseiten-Tabelle kennt sie.
  assert.ok(lese("es/guia/index.html").includes('href="/es/guia/plan-de-estiba-contenedor"'), "die spanische Uebersicht verlinkt die Seite nicht");
  assert.ok(lese("es/guia/peso-contenedor-carga-maxima.html").includes('href="/es/guia/plan-de-estiba-contenedor"'), "die Gewichts-Seite verlinkt sie nicht");
  const gen = fs.readFileSync(path.join(dir, "..", "..", "werkzeug", "sprachen", "es.mjs"), "utf8");
  assert.ok(gen.includes("'/ratgeber/stauplan-container': '/es/guia/plan-de-estiba-contenedor'"), "werkzeug/sprachen/es.mjs: guide-Eintrag fehlt");
});

// ── Cubagem (CBM) auf Portugiesisch ─────────────────────────────────────────────────────────
// Vierte Fassung der CBM-Seite. Den Rechner selbst haelt test/cbm-widget (Rechenkern woertlich
// gleich). Hier: die Beispielrechnung, der eigene Kern -- der "fator de cubagem" je
// Verkehrstraeger, danach wird in Brasilien gesucht --, die Containervolumen und der Knopf.
test("PT: die Seite zur Cubagem (CBM) -- Beispiel, Peso cubado je Verkehrstraeger, Volumen aus PRESETS, Knopf", () => {
  const f = mehr("pt")[0];
  assert.strictEqual(f, "pt/guia/calculo-cubagem-cbm");
  const s = lese(f + ".html");
  const text = s.replace(/<script[\s\S]*?<\/script>/g, " ").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ");
  const sp = (n, d) => n.toFixed(d).replace(".", ",");

  // Die Beispielrechnung: 10 Kartons 60 x 40 x 40 cm
  const je = 0.6 * 0.4 * 0.4, vol = je * 10;
  for (const t of [`<td class="num">0,6 × 0,4 × 0,4</td><td class="num">${sp(je, 3)} m³</td>`, `<td class="num">${sp(je, 3)} × 10</td><td class="num">${sp(vol, 2)} m³</td>`]) assert.ok(s.includes(t), `${f}: Beispielrechnung — ${t}`);
  const ld = JSON.parse(/<script type="application\/ld\+json">(.*?)<\/script>/s.exec(s)[1]);
  assert.ok(ld["@type"] === "FAQPage" && ld.mainEntity.length === 4);
  assert.ok(ld.mainEntity[0].acceptedAnswer.text.includes(`${sp(je, 3)} m³ por caixa × 10 = ${sp(vol, 2)} m³`), `${f}: die erste Antwort rechnet anders als die Seite`);

  // Peso cubado = Volumen x Faktor. Die Faktoren sind NACHGESCHLAGEN (Websuche 26.11.26), nicht
  // gerechnet -- wer sie aendert, braucht eine Quelle. Gerechnet ist, was daraus fuer das Beispiel folgt.
  const FAKTOR = [["Marítimo (LCL)", "1.000 kg por m³", 1000], ["Rodoviário", "300 kg por m³", 300], ["Aéreo", "166,7 kg por m³", 166.7]];
  const real = 10 * 15;
  for (const [modal, wort, faktor] of FAKTOR) {
    const zeile = `<tr><td>${modal}</td><td class="num">${wort}</td><td class="num">${Math.round(vol * faktor)} kg</td></tr>`;
    assert.ok(s.includes(zeile), `${f}: Zeile fehlt oder rechnet anders — ${zeile}`);
    assert.ok(vol * faktor > real, `${modal}: im Beispiel waere das wirkliche Gewicht groesser -- der Satz darunter stimmte nicht`);
  }
  assert.ok(text.includes(`As 10 caixas pesam ${real} kg (15 kg cada). Nos três modais o peso cubado é maior`), `${f}: der Satz zum Beispiel fehlt`);
  // Ehrlich: es sind uebliche Werte, kein Tarif -- und die Seite sagt, welche Regel ihr Rechner anwendet.
  assert.match(text, /cada transportadora define o seu/);
  assert.match(text, /confirme sempre na tabela de frete/);
  assert.match(text, /A calculadora acima usa a regra do marítimo, 1 m³ = 1\.000 kg/);
  const faq = ld.mainEntity.map((e) => e.acceptedAnswer.text).join(" ");
  assert.ok(/300 kg por m³/.test(faq) && /166,7 kg por m³/.test(faq) && /1\.000 kg por m³/.test(faq) && /Cada transportadora define o seu fator/.test(faq), "das FAQ-Schema nennt andere Faktoren als die Tabelle oder verschweigt den Vorbehalt");

  // Containervolumen: dieselben Zahlen wie die portugiesische Volumen-Seite, aus PRESETS
  for (const name of ["20' GP", "40' GP", "40' HC"]) {
    const P = PRESETS[name], m3 = sp(P.l * P.w * P.h / 1e6, 1);
    assert.ok(text.includes(`${m3} m³`), `${f}: ${name} = ${m3} m³ fehlt`);
    assert.ok(lese("pt/guia/metros-cubicos-conteiner.html").replace(/&nbsp;/g, " ").includes(`${m3} m³`), "die Volumen-Seite nennt eine andere Zahl");
  }
  assert.ok(ld.mainEntity[3].acceptedAnswer.text.includes("33,1 m³") && ld.mainEntity[3].acceptedAnswer.text.includes("67,6 m³"));

  // Der Knopf laedt genau das Beispiel -- in portugiesischen Worten, durch den echten Parser
  const links = [...s.matchAll(/href="\/app\?lang=pt&q=([^"&]+)"/g)];
  assert.strictEqual(links.length, 2, `${f}: Rechner-Knoepfe`);
  for (const [, q] of links) {
    const rows = parseCargoText(decodeURIComponent(q));
    assert.strictEqual(rows.length, 1);
    assert.deepStrictEqual([rows[0].qty, rows[0].l, rows[0].w, rows[0].h, rows[0].weight], [10, 60, 40, 40, 15], `${f}: der Knopf laedt ein anderes Beispiel`);
  }
  // Die Uebersicht, die Volumen-Seite und die Startseite fuehren hierher -- und die Startseite
  // sagt nicht mehr, die Erklaerung stehe auf Englisch.
  for (const p of ["pt/guia/index.html", "pt/guia/metros-cubicos-conteiner.html", "pt/index.html"]) assert.ok(lese(p).includes(`href="/${f}"`), `${p} verlinkt die Seite nicht`);
  assert.ok(!/calculo-cubagem-cbm"[^>]*>[^<]*ingl[êe]s/.test(lese("pt/index.html")), "die Startseite nennt die portugiesische Seite englisch");
});

test("PT: die PBR-Palette (1,00 x 1,20 m) -- Zahlen aus dem Packer, eigene Draufsicht, eigener Knopf", () => {
  const C20 = PRESETS["20' GP"], C40 = PRESETS["40' GP"];
  const [s20, s40] = seiten("pt");
  for (const [f, C, lage, ohne, zwei, cont, laengs] of [[s20, C20, 9, 8, 18, null, 8], [s40, C40, 22, 20, 44, "40gp", 10]]) {
    const r = makeFloorPacker(120, 100, true)(C.l, C.w);
    assert.strictEqual(r.count, lage, `${f}: PBR im Packer`);
    assert.strictEqual(makeFloorPacker(120, 100, false)(C.l, C.w).count, ohne);
    assert.strictEqual(zwei, 2 * lage);
    assert.ok(2 * 115 <= C.h, "zwei Lagen zu 115 cm passen nicht unter die Decke");
    assert.strictEqual(r.rects.filter((x) => x.dx > x.dz).length, laengs, `${f}: das Muster im Text stimmt nicht mit dem Packer`);
    const s = lese(f + ".html");
    const text = s.replace(/<svg[\s\S]*?<\/svg>/g, " ").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ");
    assert.ok(new RegExp(`<b>${lage} paletes PBR</b>`).test(s) && new RegExp(`<b>${zwei}( paletes PBR)?</b>`).test(s), `${f}: die PBR-Zahlen ${lage} und ${zwei} fehlen`);
    assert.ok(/padrão brasileiro/.test(text) && /1,00 × 1,20 m/.test(text), `${f}: die PBR-Palette ist nicht erklaert`);
    // Zwei Draufsichten: erst die Europalette (die prueft der Wellen-Test), dann die PBR-Palette
    const bilder = [...s.matchAll(/<figure class="stau">([\s\S]*?)<\/figure>/g)];
    assert.strictEqual(bilder.length, 2, `${f}: zwei Draufsichten erwartet`);
    assert.strictEqual((bilder[1][1].match(/<rect /g) || []).length, lage + 1, `${f}: die PBR-Draufsicht zeichnet nicht genau die Stellplaetze`);
    assert.strictEqual((bilder[1][1].match(/fill="#2E8FFF"/g) || []).length, laengs, `${f}: Farben der PBR-Draufsicht`);
    // Der Knopf: durch den echten Parser genau diese Menge PBR-Paletten, im richtigen Container
    const knopf = [...s.matchAll(/href="\/app\?lang=pt&q=([^"&]+)(?:&cont=([a-z0-9]+))?"/g)].filter(([, q]) => /pbr/i.test(decodeURIComponent(q)));
    assert.strictEqual(knopf.length, 1, `${f}: genau ein PBR-Knopf erwartet`);
    const rows = parseCargoText(decodeURIComponent(knopf[0][1]));
    assert.deepStrictEqual([rows.length, rows[0].qty, rows[0].l, rows[0].w, rows[0].stackable], [1, lage, 120, 100, true], `${f}: der PBR-Knopf laedt eine andere Ladung`);
    assert.strictEqual(knopf[0][2] || null, cont);
  }
  // Warum nicht 10 im 20-Fuss: zwei mit der 1,20-m-Seite quer brauchen 2,40 m
  assert.ok(2 * 120 > C20.w && 5 * 120 > C20.l && /precisariam de 2,40&nbsp;m, e a largura interna é de 2,35&nbsp;m/.test(lese(s20 + ".html")));
  // 40-Fuss: 12 quer + 10 laengs, und die Rechnung im Text
  assert.ok(12 * 100 <= C40.l && 13 * 100 > C40.l && 100 + 120 <= C40.w && /12&nbsp;×&nbsp;1,00&nbsp;m = 12,00&nbsp;m dos 12,03&nbsp;m internos/.test(lese(s40 + ".html")));
  // Der Parser kennt die Palette auch ohne Masse ("paletes PBR")
  assert.deepStrictEqual(parseCargoText("9 paletes PBR").map((r) => [r.qty, r.l, r.w]), [[9, 120, 100]]);
  // Die Uebersicht nennt dieselben Zahlen
  const ix = lese("pt/guia/index.html");
  assert.ok(/25 europaletes ou 22 paletes PBR/.test(ix) && /11 europaletes ou 9 paletes PBR/.test(ix) && /50 ou 44/.test(ix));
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
  for (const ordner of ["ratgeber", "en/guide", "nl/gids", "es/guia", "fr/guide", "pt/guia"]) {
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
  // Die Uebersichten der Wellen zeigen aufeinander
  for (const [f, k] of [["nl/gids/index.html", "nl"], ["es/guia/index.html", "es"], ["fr/guide/index.html", "fr"], ["pt/guia/index.html", "pt"]]) {
    const s = lese(f);
    for (const [kk, h] of [["de", "/ratgeber/"], ["en", "/en/guide/"], ["nl", "/nl/gids/"], ["es", "/es/guia/"], ["fr", "/fr/guide/"], ["pt", "/pt/guia/"]]) {
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

test("ES: die Reefer-Seite -- Masse aus PRESETS, Palettenzahlen aus dem Packer, die Tuer-Aussage aus der echten Rechnung", async () => {
  const f = "es/guia/contenedor-reefer-medidas.html";
  const s = lese(f);
  const text = s.replace(/<script[\s\S]*?<\/script>/g, " ").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ");
  const R20 = PRESETS["20' Reefer"], R40 = PRESETS["40' Reefer"], G20 = PRESETS["20' GP"], G40 = PRESETS["40' GP"];
  const zahl = (C, l, w, dreh = true) => makeFloorPacker(l, w, dreh)(C.l, C.w).count;
  const t1 = (kg) => (kg / 1000).toFixed(1).replace(".", ",");
  const m2 = (cm) => (cm / 100).toFixed(2).replace(".", ",");

  // Die Tabelle: Innenmasse, Tuer und Zuladung beider Reefer -- dieselben Werte wie im Rechner.
  const zeile = (name, a, b) => s.includes(`<tr><td>${name}</td><td class="num">${a}</td><td class="num">${b}</td></tr>`);
  assert.ok(zeile("Interior largo × ancho × alto", `${R20.l} × ${R20.w} × ${R20.h} cm`, `${R40.l} × ${R40.w} × ${R40.h} cm`), `${f}: Innenmasse`);
  assert.ok(zeile("Puerta ancho × alto", `${R20.door.w} × ${R20.door.h} cm`, `${R40.door.w} × ${R40.door.h} cm`), `${f}: Tuer`);
  assert.ok(zeile("Carga útil", `aprox. ${t1(R20.payload)} t`, `aprox. ${t1(R40.payload)} t`), `${f}: Zuladung`);
  // Die Stellzahlen: drei Paletten, zwei Laengen -- aus dem Packer.
  assert.ok(zeile("Pallets de 1,00 × 1,20 m por capa", zahl(R20, 120, 100), zahl(R40, 120, 100)), `${f}: Paletten 1,00 x 1,20`);
  assert.ok(zeile("Europalets (1,20 × 0,80 m) por capa", zahl(R20, 120, 80), zahl(R40, 120, 80)), `${f}: Europaletten`);
  assert.ok(zeile("Pallets de 48 × 40 pulgadas por capa", zahl(R20, 121.92, 101.6), zahl(R40, 121.92, 101.6)), `${f}: 48 x 40`);

  // "20 und nicht 22": der Vergleich mit dem Trockencontainer, Reihe fuer Reihe nachgerechnet.
  const n40 = zahl(R40, 120, 100), nGP = zahl(G40, 120, 100);
  assert.deepStrictEqual([n40, nGP, zahl(R40, 120, 100, false)], [20, 22, 18]);
  const quer = Math.floor(R40.l / 100), laengs = Math.floor(R40.l / 120);
  assert.strictEqual(quer + laengs, n40);
  assert.ok(text.includes(`caben ${nGP} pallets de 1,00 × 1,20 m por capa: ${Math.floor(G40.l / 100)} girados y ${Math.floor(G40.l / 120)} a lo largo`), `${f}: der Trockencontainer-Vergleich`);
  assert.ok(text.includes(`${G40.l - R40.l} cm de largo (${R40.l} en lugar de ${G40.l} cm) y ${G40.w - R40.w} cm de ancho`), `${f}: was dem Reefer innen fehlt`);
  assert.ok(text.includes(`${quer} girados (${quer} × 1,00 m = ${m2(quer * 100)} m de ${m2(R40.l)}) y ${laengs} a lo largo (${laengs} × 1,20 m = ${m2(laengs * 120)} m)`), `${f}: die zwei Reihen`);
  assert.ok(text.includes(`ocupan ${m2(220)} m de los ${m2(R40.w)} m de ancho`) && 120 + 100 <= R40.w, `${f}: die Breite`);
  assert.ok(text.includes(`solo caben ${zahl(R40, 120, 100, false)}`), `${f}: ohne Drehen`);
  // Europaletten: 10 / 23 im Reefer, 11 / 25 im Trockencontainer, 8 / 18 ohne Drehen.
  assert.ok(s.includes(`<a href="/es/guia/europalets-contenedor-20-pies">${zahl(G20, 120, 80)}</a> y <a href="/es/guia/europalets-contenedor-40-pies">${zahl(G40, 120, 80)}</a> europalets por capa`), `${f}: Europaletten im Trockencontainer`);
  assert.ok(text.includes(`${zahl(R20, 120, 80)} en el de 20 pies y ${zahl(R40, 120, 80)} en el de 40`), `${f}: Europaletten im Reefer`);
  assert.ok(text.includes(`son solo ${zahl(R20, 120, 80, false)} y ${zahl(R40, 120, 80, false)}`), `${f}: Europaletten ohne Drehen`);

  // Die Draufsicht zeichnet genau die 20 Stellplaetze: 11 quer (gruen), 9 laengs (blau), dazu der Umriss.
  const svg = s.match(/<figure class="stau">(<svg[\s\S]*?<\/svg>)/)[1];
  assert.strictEqual((svg.match(/<rect /g) || []).length, n40 + 1, `${f}: Rechtecke der Draufsicht`);
  assert.strictEqual((svg.match(/fill="#2FD8A0" fill-opacity/g) || []).length, quer, `${f}: quer`);
  assert.strictEqual((svg.match(/fill="#2E8FFF" fill-opacity/g) || []).length, laengs, `${f}: laengs`);
  assert.ok(text.includes(`Vista superior con ${R40.l} × ${R40.w} cm de medida interior`), `${f}: die Bildunterschrift nennt das Innenmass nicht`);

  // Der Knopf: 20 Paletten, 2,00 m hoch, im 40-Fuss-Reefer -- gelesen vom Parser, bestaetigt von der Rechnung.
  const knoepfe = [...s.matchAll(/href="(\/app\?lang=es&q=([^"&]+)&cont=40rf)"/g)];
  assert.strictEqual(knoepfe.length, 2, `${f}: Knopf oben und Beispiel-Knopf`);
  assert.strictEqual(knoepfe[0][1], knoepfe[1][1], `${f}: die beiden Knoepfe oeffnen Verschiedenes`);
  const q = decodeURIComponent(knoepfe[0][2]);
  assert.deepStrictEqual(parseCargoText(q).map((r) => [r.qty, r.l, r.w, r.h, r.weight, r.stackable !== false]), [[n40, 120, 100, 200, 1000, false]], `${f}: das Beispiel liest sich anders`);
  assert.ok(text.includes(`El ejemplo abre un reefer de 40 pies con ${n40} pallets de 1,00 × 1,20 m y 2,00 m de alto`), `${f}: der Satz zum Beispiel`);
  const { planen } = await import("../../netlify/functions/lib/plan.mjs");
  const b = planen({ q, cont: "40rf", lang: "es" }).body;
  assert.deepStrictEqual([b.plan.container.code, b.plan.fits_in_one, b.plan.pieces_loaded, b.plan.pieces_left], ["40rf", true, n40, 0], `${f}: das Beispiel passt nicht in einen Reefer`);
  assert.ok(!b.notes.some((n) => /door/i.test(n)), `${f}: das Beispiel geht nicht durch die Tuer`);
  // Die Tuer-Aussage: 2,30 m stehen innen (242 cm), gehen aber nicht durch die Tuer (219 cm) -- und der Rechner sagt es.
  assert.ok(text.replace(/ ([,.:;])/g, "$1").includes(`mide unos ${R40.door.w} × ${R40.door.h} cm, mientras que dentro hay ${R40.h} cm de altura. Un pallet de 2,30 m cabe dentro, pero no pasa por la puerta`), `${f}: die Tuer-Aussage`);
  assert.ok(230 <= R40.h && 230 > R40.door.h);
  const hoch = planen({ q: q.replace("x200 ", "x230 "), cont: "40rf", lang: "es" }).body;
  assert.strictEqual(hoch.plan.pieces_loaded, n40);
  assert.ok(hoch.notes.some((n) => /door/i.test(n)), "bei 2,30 m meldet die Rechnung die Tuer nicht -- die Seite behauptet es");

  // Gewicht je Palette, aus der Zuladung gerechnet.
  const nf = (x) => Math.round(x).toLocaleString("de-DE");
  assert.ok(text.includes(`${n40} pallets pueden pesar de media ${nf(R40.payload / n40)} kg cada uno, y ${zahl(R40, 120, 80)} europalets, unos ${nf(R40.payload / zahl(R40, 120, 80))} kg`), `${f}: Gewicht je Palette`);
  // Keine Strassengrenze einzelner Laender (unbelegt) -- nur der Hinweis, dass jedes Land seine hat.
  assert.match(text, /cada país tiene el suyo/);
  assert.ok(!/Per[uú]|M[eé]xico|Chile|Colombia|Ecuador|Argentina|Espa[nñ]a/.test(text), `${f}: nennt ein Land -- Grenzen einzelner Laender sind unbelegt`);
  // Die Ehrlichkeitslinie.
  assert.match(text, /valores orientativos \(cada serie de reefer es distinta\)/);
  assert.match(text, /no incluye la sujeción de la carga ni el reparto del peso/);
  assert.ok(lese("sprache/es.js").includes('ctAdjust: "Ajustar medidas"') && text.includes("«Ajustar medidas»"), `${f}: der Knopf im Rechner heisst anders als auf der Seite`);

  // Das FAQ-Schema sagt dasselbe wie die Seite.
  const ld = JSON.parse(s.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1]);
  assert.strictEqual(ld.mainEntity.length, 3);
  const alle = ld.mainEntity.map((e) => e.acceptedAnswer.text).join(" ");
  for (const teil of [`${R20.l} × ${R20.w} × ${R20.h} cm`, `${R40.l} × ${R40.w} × ${R40.h} cm`, `${t1(R20.payload)} t`, `${t1(R40.payload)} t`,
    `${n40} pallets de 1,00 × 1,20 m por capa (${quer} girados y ${laengs} a lo largo) o ${zahl(R40, 120, 80)} europalets`, `serían ${nGP} y ${zahl(G40, 120, 80)}`,
    `${G40.l - R40.l} cm de largo y ${G40.w - R40.w} cm de ancho`, `${R40.door.w} × ${R40.door.h} cm`, `(${R40.h} cm)`]) {
    assert.ok(alle.includes(teil), `${f}: das FAQ-Schema nennt nicht "${teil}"`);
  }

  // Verlinkt von der Uebersicht und von der Masse-Seite; die Startseiten-Tabelle kennt sie.
  assert.ok(lese("es/guia/index.html").includes('href="/es/guia/contenedor-reefer-medidas"'), "die spanische Uebersicht verlinkt die Seite nicht");
  assert.ok(lese("es/guia/medidas-contenedor.html").includes('href="/es/guia/contenedor-reefer-medidas"'), "die Masse-Seite verlinkt sie nicht");
  const gen = fs.readFileSync(path.join(dir, "..", "..", "werkzeug", "sprachen", "es.mjs"), "utf8");
  assert.ok(gen.includes("'/ratgeber/reefer-container-masse': '/es/guia/contenedor-reefer-medidas'"), "werkzeug/sprachen/es.mjs: guide-Eintrag fehlt");
});

// ── Die Palette 1,00 x 1,20 m auf Spanisch ─────────────────────────────────────────────────
// Dritte Fassung der Industriepaletten-Seiten (test/wissen-zahlen rechnet die deutsche und die
// englische). Anlass: die meiste gemessene Auslandsnutzung kommt aus Suedamerika, und dort ist
// 1,00 x 1,20 m das uebliche Mass. Der Kern der Seite: 9 und nicht 10 im 20-Fuss, 22 mit 3 cm
// Rest im 40-Fuss -- beides Reihe fuer Reihe nachgerechnet.
test("ES: die Seite zur Palette 1,00 x 1,20 m -- Packer, zwei Draufsichten, Knoepfe durch die echte Rechnung", async () => {
  const f = "es/guia/pallets-100x120-contenedor.html";
  const s = lese(f);
  const text = s.replace(/<script[\s\S]*?<\/script>/g, " ").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").replace(/ ([,.:;])/g, "$1");
  const G20 = PRESETS["20' GP"], G40 = PRESETS["40' GP"], H40 = PRESETS["40' HC"], H45 = PRESETS["45' HC"];
  const zahl = (C, l, w, dreh = true) => makeFloorPacker(l, w, dreh)(C.l, C.w).count;
  const m2 = (cm) => (cm / 100).toFixed(2).replace(".", ",");
  const n20 = zahl(G20, 120, 100), n40 = zahl(G40, 120, 100);
  assert.deepStrictEqual([n20, zahl(G20, 120, 100, false), n40, zahl(G40, 120, 100, false)], [9, 8, 22, 20]);

  // Die Antwort oben: beide Zahlen und ihre Verdopplung.
  assert.ok(text.includes(`caben ${n20} pallets de 1,00 × 1,20 m por capa; en uno de 40 pies, ${n40} pallets. Si la carga se puede apilar en dos capas, ${2 * n20} y ${2 * n40}.`), `${f}: die Antwort`);
  assert.ok(text.includes(`${G20.l} × ${G20.w} cm (20 pies) o ${G40.l} × ${G40.w} cm (40 pies): con esa base salen ${n20} y ${n40} huecos`), `${f}: Innenmasse im Text`);

  // Die Tabelle: Innenmass aus PRESETS, Stellzahl mit und ohne Drehen aus dem Packer, zwei Lagen passen unter die Decke.
  const zeilen = [...s.matchAll(/<tr><td>([^<]*)<\/td><td class="num">(\d+) × (\d+) cm<\/td><td class="num">(\d+)<\/td><td class="num">(\d+)<\/td><td class="num">(\d+) cm por pallet<\/td><\/tr>/g)];
  assert.deepStrictEqual(zeilen.map((z) => z[1]), ["20′ estándar", "40′ estándar", "40′ high cube", "45′ high cube"], `${f}: Tabelle`);
  [G20, G40, H40, H45].forEach((P, i) => {
    const z = zeilen[i];
    assert.deepStrictEqual([+z[2], +z[3], +z[4], +z[5]], [P.l, P.w, zahl(P, 120, 100), zahl(P, 120, 100, false)], `${f}: Tabellenzeile ${z[1]}`);
    assert.ok(2 * +z[6] <= P.h, `${f}: zwei Lagen zu ${z[6]} cm passen nicht in ${P.h} cm`);
  });
  // Der Fliesstext nennt dieselben Hoehen wie die Tabelle (Standard und High Cube).
  assert.ok(zeilen[0][6] === zeilen[1][6] && text.includes(`no pasa de unos ${zeilen[0][6]} cm y se puede apilar`), `${f}: die Hoehe der zweiten Lage (Standard) steht anders im Text`);
  assert.ok(zeilen[2][6] === zeilen[3][6] && text.includes(`admite la segunda capa hasta unos ${zeilen[2][6]} cm por pallet`), `${f}: die Hoehe der zweiten Lage (High Cube) steht anders im Text`);

  // "9 und nicht 10": fuenf laengs sind zu lang, zwei quer zu breit.
  assert.ok(5 * 120 > G20.l && 2 * 120 > G20.w, "zehn passten doch");
  assert.ok(text.includes(`medirían ${5 * 120} cm y el interior tiene ${G20.l} cm; y dos pallets girados, uno junto al otro, medirían ${2 * 120} cm en un ancho de ${G20.w} cm`), `${f}: warum nicht 10`);
  assert.ok(text.includes(`Sin girar ninguno caben ${zahl(G20, 120, 100, false)}.`), `${f}: 20 Fuss ohne Drehen`);
  // "22 mit 3 cm Rest": die zwei Reihen, Meter fuer Meter.
  const quer = Math.floor(G40.l / 100), laengs = Math.floor(G40.l / 120);
  assert.deepStrictEqual([quer, laengs, quer + laengs], [12, 10, n40]);
  assert.ok(text.includes(`${quer} pallets girados junto a una pared (${quer} × 1,00 m = ${m2(quer * 100)} m de ${m2(G40.l)}) y ${laengs} a lo largo junto a la otra (${laengs} × 1,20 m = ${m2(laengs * 120)} m)`), `${f}: die zwei Reihen`);
  assert.ok(text.includes(`ocupan ${m2(220)} m de los ${m2(G40.w)} m de ancho`) && 120 + 100 <= G40.w, `${f}: die Breite`);
  assert.ok(text.includes(`solo caben ${zahl(G40, 120, 100, false)}`) && text.includes(`les sobran ${G40.l - quer * 100} cm en todo el largo`), `${f}: ohne Drehen / der knappe Rest`);

  // Zwei Draufsichten, jede zeichnet genau ihre Stellplaetze (plus Umriss) -- laengs blau, quer gruen.
  const svgs = [...s.matchAll(/<figure class="stau">(<svg[\s\S]*?<\/svg>)<figcaption>([\s\S]*?)<\/figcaption>/g)];
  assert.strictEqual(svgs.length, 2, `${f}: zwei Draufsichten`);
  for (const [i, [n, blau, gruen, C]] of [[n20, 8, 1, G20], [n40, laengs, quer, G40]].entries()) {
    const svg = svgs[i][1];
    assert.strictEqual((svg.match(/<rect /g) || []).length, n + 1, `${f}: Rechtecke der Draufsicht ${i + 1}`);
    assert.strictEqual((svg.match(/fill="#2E8FFF" fill-opacity/g) || []).length, blau, `${f}: laengs in Draufsicht ${i + 1}`);
    assert.strictEqual((svg.match(/fill="#2FD8A0" fill-opacity/g) || []).length, gruen, `${f}: quer in Draufsicht ${i + 1}`);
    assert.ok(svgs[i][2].includes(`Vista superior con ${C.l}&nbsp;×&nbsp;${C.w}&nbsp;cm de medida interior`), `${f}: Bildunterschrift ${i + 1}`);
  }

  // Die Knoepfe: oben und Beispiel 40 Fuss sind derselbe Link; der dritte oeffnet den 20-Fuesser (Vorgabe des Links).
  const knoepfe = [...s.matchAll(/href="(\/app\?lang=es&q=([^"&]+)(?:&cont=([a-z0-9]+))?)"/g)];
  assert.strictEqual(knoepfe.length, 3, `${f}: drei Rechner-Knoepfe`);
  assert.strictEqual(knoepfe[0][1], knoepfe[1][1], `${f}: Knopf oben und Beispiel-Knopf oeffnen Verschiedenes`);
  const { planen } = await import("../../netlify/functions/lib/plan.mjs");
  for (const [k, n, cont, code] of [[knoepfe[1], n40, "40gp", "40gp"], [knoepfe[2], n20, undefined, "20gp"]]) {
    const q = decodeURIComponent(k[2]);
    assert.strictEqual(k[3], cont, `${f}: der Knopf waehlt den falschen Container vor`);
    assert.deepStrictEqual(parseCargoText(q).map((r) => [r.qty, r.l, r.w, r.h, r.weight, r.stackable !== false]), [[n, 120, 100, 150, 800, false]], `${f}: das Beispiel liest sich anders`);
    const b = planen({ q, cont, lang: "es" }).body;
    assert.deepStrictEqual([b.plan.container.code, b.plan.fits_in_one, b.plan.pieces_loaded, b.plan.pieces_left], [code, true, n, 0], `${f}: das Beispiel passt nicht in einen Container`);
    // ... und ein Stueck mehr passt nicht mehr hinein: die Zahl der Seite ist die Grenze.
    assert.strictEqual(planen({ q: q.replace(/^\d+/, String(n + 1)), cont, lang: "es" }).body.plan.fits_in_one, false, `${f}: ${n + 1} passen doch`);
  }
  assert.ok(text.includes("pallets de 1,00 × 1,20 m y 1,50 m de alto, de 800 kg cada uno, sin apilar"), `${f}: der Satz zum Beispiel`);
  // Zwei Lagen, wie behauptet: die echte Rechnung stellt sie in EINEN Container.
  for (const [n, h, cont] of [[2 * n40, 115, "40gp"], [2 * n40, 130, "40hc"], [2 * n20, 115, "20gp"]]) {
    const b = planen({ q: `${n} pallets 120x100x${h} 500 kg`, cont, lang: "es" }).body;
    assert.deepStrictEqual([b.plan.fits_in_one, b.plan.pieces_loaded], [true, n], `${f}: ${n} Paletten zu ${h} cm in ${cont}`);
  }
  assert.strictEqual(H40.h - G40.h, 31);
  assert.ok(text.includes("31 cm más de altura"), `${f}: Mehrhoehe High Cube`);

  // Gewicht je Palette, aus der Zuladung gerechnet -- abgerundet, nie mehr als der Container traegt.
  const t1 = (kg) => (kg / 1000).toFixed(1).replace(".", ",");
  const nf = (x) => Math.floor(x).toLocaleString("de-DE");
  assert.ok(text.includes(`admite unas ${t1(G40.payload)} t de carga útil: ${n40} pallets pueden pesar de media hasta ${nf(G40.payload / n40)} kg cada uno, y ${2 * n40} en dos capas, unos ${Math.floor(G40.payload / (2 * n40) / 100) * 100} kg`), `${f}: Gewicht je Palette`);
  assert.ok(text.includes(`El de 20 pies admite unas ${t1(G20.payload)} t`), `${f}: Zuladung 20 Fuss`);
  assert.match(text, /cada país tiene el suyo/);

  // Die anderen Paletten: verlinkt, mit den Zahlen aus dem Packer.
  const R20 = PRESETS["20' Reefer"], R40 = PRESETS["40' Reefer"];
  assert.ok(s.includes(`caben <a href="/es/guia/europalets-contenedor-20-pies">${zahl(G20, 120, 80)}</a> y <a href="/es/guia/europalets-contenedor-40-pies">${zahl(G40, 120, 80)}</a> por capa`), `${f}: Europaletten`);
  assert.ok(s.includes(`son <a href="/es/guia/pallets-48x40-contenedor-20-pies">${zahl(G20, 121.92, 101.6)}</a> y <a href="/es/guia/pallets-48x40-contenedor-40-pies">${zahl(G40, 121.92, 101.6)}</a>`), `${f}: 48 x 40 Zoll`);
  assert.strictEqual(n40 - zahl(G40, 121.92, 101.6), 2, "48 x 40 kostet im 40-Fuss nicht zwei Paletten");
  assert.ok(text.includes("cuestan dos pallets en el contenedor de 40 pies"), `${f}: der Unterschied zu 48 x 40`);
  assert.ok(text.includes(`caben ${zahl(R20, 120, 100)} y ${zahl(R40, 120, 100)} pallets de 1,00 × 1,20 m`), `${f}: Reefer`);

  // Die Woerter der Laender (belegt: Angebote "parihuela 120 x 100" in Peru, "estiba 120 x 100" in Kolumbien) --
  // aber keine Strassengrenze und keine Norm eines einzelnen Landes.
  for (const w of ["parihuela", "estiba", "tarima"]) assert.ok(text.includes(w), `${f}: das Wort ${w} fehlt`);
  assert.ok(!/NTC|ARLOG|INACAL|toneladas en carretera/i.test(text), `${f}: nennt eine Norm oder Grenze eines einzelnen Landes -- unbelegt`);
  // Die Ehrlichkeitslinie.
  assert.match(text, /valores geométricos orientativos/);
  assert.match(text, /del reparto del peso y de la sujeción de la carga/);

  // Das FAQ-Schema sagt dasselbe wie die Seite.
  const ld = JSON.parse(s.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1]);
  assert.strictEqual(ld["@type"], "FAQPage");
  assert.strictEqual(ld.mainEntity.length, 3);
  assert.ok(new RegExp(`^${n20} pallets`).test(ld.mainEntity[0].acceptedAnswer.text) && new RegExp(`^${n40} pallets`).test(ld.mainEntity[1].acceptedAnswer.text), `${f}: die Antworten beginnen nicht mit der Zahl`);
  const alle = ld.mainEntity.map((e) => e.acceptedAnswer.text).join(" ");
  for (const teil of [`Sin girar ninguno caben ${zahl(G20, 120, 100, false)}`, `medirían ${5 * 120} cm y el interior tiene ${G20.l} cm`, `son ${2 * n20}.`,
    `${quer} girados junto a una pared y ${laengs} a lo largo`, `solo ${G40.l - quer * 100} cm de margen`, `caben ${zahl(G40, 120, 100, false)}`, `En dos capas, ${2 * n40}.`,
    `caben ${n20} por capa en un contenedor de 20 pies y ${n40} en uno de 40 pies`, `${zahl(G20, 121.92, 101.6)} y ${zahl(G40, 121.92, 101.6)}; con europalets (1,20 × 0,80 m), ${zahl(G20, 120, 80)} y ${zahl(G40, 120, 80)}`]) {
    assert.ok(alle.includes(teil), `${f}: das FAQ-Schema nennt nicht "${teil}"`);
  }
  const titel = /<title>(.*?)<\/title>/.exec(s)[1];
  assert.ok(titel.includes(`${n20} y ${n40}`), `${f}: der Titel nennt die Zahlen nicht`);

  // Verlinkt von der Uebersicht und von den Nachbarseiten; die Startseiten-Tabelle kennt sie.
  for (const g of ["es/guia/index.html", "es/guia/pallets-48x40-contenedor-40-pies.html", "es/guia/pallets-48x40-contenedor-20-pies.html", "es/guia/europalets-contenedor-40-pies.html", "es/guia/europalets-contenedor-20-pies.html", "es/guia/contenedor-reefer-medidas.html"]) {
    assert.ok(lese(g).includes('href="/es/guia/pallets-100x120-contenedor"'), `${g} verlinkt die Seite nicht`);
  }
  const gen = fs.readFileSync(path.join(dir, "..", "..", "werkzeug", "sprachen", "es.mjs"), "utf8");
  assert.ok(gen.includes("'/ratgeber/industriepaletten-container': '/es/guia/pallets-100x120-contenedor'"), "werkzeug/sprachen/es.mjs: guide-Eintrag fehlt");
});
