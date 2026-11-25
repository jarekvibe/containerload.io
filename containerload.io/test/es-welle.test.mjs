// Die ES-Welle: vier spanische Wissensseiten plus Uebersicht (es/guia/), nach dem Muster der
// NL-Welle. Ohne sie stuende fuer Spanisch nur EINE Seite in der Suche (die Startseite /es/).
// Dieselben Regeln wie immer: jede Zahl kommt aus dem Packer bzw. aus PRESETS, die Draufsicht
// zeichnet exakt die Stellplaetze, der Knopf laedt genau die genannte Menge -- und das
// hreflang-Netz ist ein sauberes VIERER-Cluster (de/en/nl/es + x-default) auf allen Fassungen.
//
// Anders als die NL-Seiten fuehren diese in einen Rechner in IHRER Sprache (?lang=es).
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

const CLUSTER = [
  ["ratgeber/europaletten-20-fuss-container", "en/guide/euro-pallets-20ft-container", "nl/gids/europallets-20ft-container", "es/guia/europalets-contenedor-20-pies"],
  ["ratgeber/europaletten-40-fuss-container", "en/guide/euro-pallets-40ft-container", "nl/gids/europallets-40ft-container", "es/guia/europalets-contenedor-40-pies"],
  ["ratgeber/container-volumen-cbm", "en/guide/container-volume-cbm", "nl/gids/cbm-container", "es/guia/metros-cubicos-contenedor"],
  ["ratgeber/container-masse-innenmasse", "en/guide/container-internal-dimensions", "nl/gids/container-afmetingen", "es/guia/medidas-contenedor"],
];
const ES = CLUSTER.map((c) => c[3]);

test("die Palettenzahlen der ES-Seiten kommen aus dem Packer -- und der Knopf laedt genau sie", () => {
  const C20 = PRESETS["20' GP"], C40 = PRESETS["40' GP"];
  const faelle = [
    ["es/guia/europalets-contenedor-20-pies.html", C20, 11, 8, 22, null],
    ["es/guia/europalets-contenedor-40-pies.html", C40, 25, 20, 50, "40gp"],
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
    const links = [...s.matchAll(/href="\/app\?lang=es&q=([^"&]+)(?:&cont=([a-z0-9]+))?"/g)];
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

test("die Kubikmeter sind aus den PRESETS gerechnet (eine Nachkommastelle)", () => {
  const s = lese("es/guia/metros-cubicos-contenedor.html");
  for (const name of ["20' GP", "40' GP", "40' HC", "45' HC"]) {
    const P = PRESETS[name];
    const m3 = (P.l * P.w * P.h / 1e6).toFixed(1).replace(".", ",");
    assert.ok(s.includes(`${m3} m³`), `metros-cubicos: ${name} = ${m3} m³ fehlt`);
    assert.ok(s.includes(`${P.l} × ${P.w} × ${P.h} cm`), `metros-cubicos: Innenmass ${name} fehlt`);
  }
});

test("die Mass-Tabellen tragen die PRESETS-Innenmasse und -Tueren", () => {
  const s = lese("es/guia/medidas-contenedor.html");
  for (const name of ["20' GP", "20' HC", "40' GP", "40' HC", "45' HC"]) {
    const P = PRESETS[name];
    for (const v of [P.l, P.w, P.h]) assert.ok(new RegExp(`\\b${v} cm\\b`).test(s), `medidas: ${name} — ${v} cm fehlt`);
    assert.ok(s.includes(`${Math.round(P.door.w)} × ${Math.round(P.door.h)} cm`), `medidas: Tuer ${name} fehlt`);
  }
  // Aussenmasse sind ISO-668-Normwerte
  for (const t of ["606 × 244 × 259 cm", "1219 × 244 × 259 cm", "1219 × 244 × 290 cm", "1372 × 244 × 290 cm"]) assert.ok(s.includes(t), `medidas: ${t} fehlt`);
});

test("jedes Cluster ist ein sauberes Vierer-Netz: hreflang und Sprachknopf auf allen vier Fassungen", () => {
  for (const c of CLUSTER) {
    const [de, en, nl, es] = c;
    for (const f of c) {
      const s = lese(f + ".html");
      for (const [k, ziel] of [["de", de], ["en", en], ["nl", nl], ["es", es], ["x-default", de]]) {
        assert.ok(s.includes(`<link rel="alternate" hreflang="${k}" href="${B}/${ziel}" />`), `${f}: hreflang ${k} fehlt`);
      }
      assert.strictEqual((s.match(/<link rel="alternate" hreflang=/g) || []).length, 5, `${f}: nicht genau fuenf hreflang-Zeilen`);
      // Der Sprachumschalter zeigt auf die Uebersetzung DIESER Seite, in allen vier Sprachen
      const schalter = /<div class="lang"[^>]*>([\s\S]*?)<\/div>/.exec(s)[1];
      for (const [k, ziel] of [["de", de], ["en", en], ["nl", nl], ["es", es]]) assert.ok(schalter.includes(`href="/${ziel}" hreflang="${k}"`), `${f}: ${k.toUpperCase()} fehlt im Sprachumschalter`);
      assert.strictEqual((schalter.match(/class="on"/g) || []).length, 1, `${f}: nicht genau eine aktive Sprache`);
    }
    const sEs = lese(es + ".html");
    assert.ok(sEs.includes(`<link rel="canonical" href="${B}/${es}" />`));
    assert.ok(sEs.includes('<html lang="es">') && /<a class="on" href="\/es\/guia\/[^"]*" hreflang="es" title="Español">ES<\/a>/.test(sEs));
  }
});

test("Sitemap: ES-Seiten gelistet, jeder Block der vier Themen traegt die es-Zeile", () => {
  const sm = lese("sitemap.xml");
  for (const c of CLUSTER) {
    const es = c[3];
    for (const pfad of c) {
      const i = sm.indexOf(`<loc>${B}/${pfad}</loc>`);
      assert.ok(i > 0, `Sitemap: ${pfad} fehlt`);
      const block = sm.slice(i, sm.indexOf("</url>", i));
      assert.ok(block.includes(`hreflang="es" href="${B}/${es}"`), `Sitemap-Block ${pfad}: es-Zeile fehlt`);
      assert.strictEqual((block.match(/hreflang="/g) || []).length, 5, `Sitemap-Block ${pfad}: nicht genau fuenf Sprachzeilen`);
    }
  }
  assert.ok(sm.includes(`<loc>${B}/es/guia/</loc>`), "Sitemap: ES-Uebersicht fehlt");
  assert.strictEqual((sm.match(/<loc>/g) || []).length, new Set(sm.match(/<loc>[^<]*<\/loc>/g)).size, "doppelte Adresse in der Sitemap");
});

test("Suchergebnis: Titel mit Zahl oder Thema, Laengen im Schnitt, og/twitter gleichlautend", () => {
  for (const f of [...ES, "es/guia/index"]) {
    const s = lese(f + ".html");
    const titel = /<title>(.*?)<\/title>/.exec(s)[1], desc = /<meta name="description" content="([^"]*)"/.exec(s)[1];
    assert.ok(titel.length <= 60, `${f}: Titel ${titel.length} Zeichen`);
    assert.ok(desc.length >= 110 && desc.length <= 155, `${f}: Beschreibung ${desc.length} Zeichen`);
    for (const m of ['property="og:title"', 'name="twitter:title"']) assert.ok(s.includes(`<meta ${m} content="${titel.replace(/&/g, "&amp;")}" />`), `${f}: ${m} weicht vom Titel ab`);
    for (const m of ['property="og:description"', 'name="twitter:description"']) assert.ok(s.includes(`<meta ${m} content="${desc}" />`), `${f}: ${m} weicht ab`);
    assert.ok(s.includes('<meta property="og:locale" content="es_ES" />'));
    assert.ok(s.includes('<link rel="stylesheet" href="/ratgeber/wissen.css" />'), `${f}: eigene Gestaltung statt der gemeinsamen`);
  }
  // FAQ-Schema: gueltig, und die Antwort nennt die Zahl der Seite
  for (const [f, zahl] of [["es/guia/europalets-contenedor-20-pies", "11"], ["es/guia/europalets-contenedor-40-pies", "25"], ["es/guia/metros-cubicos-contenedor", "33,1"], ["es/guia/medidas-contenedor", "590"]]) {
    const ld = JSON.parse(/<script type="application\/ld\+json">(.*?)<\/script>/s.exec(lese(f + ".html"))[1]);
    assert.strictEqual(ld["@type"], "FAQPage");
    assert.ok(ld.mainEntity.length >= 2 && ld.mainEntity[0].acceptedAnswer.text.includes(zahl), `${f}: die erste Antwort nennt ${zahl} nicht`);
  }
});

test("die Seiten sind spanisch, fuehren in den spanischen Rechner und nie in den deutschen Baum", () => {
  for (const f of [...ES, "es/guia/index"]) {
    const s = lese(f + ".html");
    const koerper = s.slice(s.indexOf("<body"));
    const text = koerper.replace(/<svg[\s\S]*?<\/svg>/g, " ").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ");
    const fremd = text.match(/\b(passen|hoeveel|de calculator|niet|één|und|nicht|Paletten|pallets passen|how many|the|with)\b/gi) || [];
    assert.deepStrictEqual([...new Set(fremd)], [], `${f}: fremde Woerter im Text`);
    assert.ok(!/ingl[eé]s o alem[aá]n/i.test(text), `${f}: behauptet, den Rechner gebe es nur auf Englisch oder Deutsch`);
    const links = [...koerper.matchAll(/<a\b[^>]*href="([^"]*)"[^>]*>/g)].map((m) => m);
    for (const [tag, h] of links) {
      if (/hreflang=/.test(tag)) continue;                                   // Sprachumschalter
      if (/^\/app/.test(h)) assert.ok(/^\/app\?lang=es(&|$)/.test(h), `${f}: Rechner-Link ohne lang=es: ${h}`);
      else assert.ok(/^\/es\/|^\/en\/guide\/$|^\/impressum$|^\/datenschutz$/.test(h), `${f}: Link aus dem spanischen Baum heraus: ${h}`);
    }
  }
  // Uebersicht und Rueckweg
  const ix = lese("es/guia/index.html");
  for (const es of ES) {
    assert.ok(ix.includes(`href="/${es}"`), `ES-Uebersicht verlinkt ${es} nicht`);
    assert.ok(lese(es + ".html").includes('href="/es/guia/"'), `${es}: Rueckweg zur Uebersicht fehlt`);
  }
  // Die spanische Startseite fuehrt auf diese Seiten statt auf die englischen
  const start = lese("es/index.html");
  for (const es of ES) assert.ok(start.includes(`href="/${es}"`), `die spanische Startseite verlinkt ${es} nicht`);
  assert.ok(start.includes('href="/es/guia/"'));
});
