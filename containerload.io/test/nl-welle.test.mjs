// Die NL-Welle: vier niederlaendische Seiten auf die Nachfrage, die die GSC
// dokumentiert hat ("hoeveel europallets in een 40ft container", Pos 74 ohne
// passende Seite). Dieselben Regeln wie immer: jede Zahl kommt aus dem Packer
// bzw. aus PRESETS, das SVG zeichnet exakt die Stellplaetze, und das
// hreflang-Netz ist ein sauberes DREIER-Cluster (de/en/nl + x-default) --
// auf den NL-Seiten UND auf den acht Bestands-Zwillingen.
//
// node --test test/nl-welle.test.mjs
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
const lese = (p) => fs.readFileSync(path.join(dir, "..", p), "utf8");

test("die Palettenzahlen der NL-Seiten kommen aus dem Packer", () => {
  const C20 = PRESETS["20' GP"], C40 = PRESETS["40' GP"];
  const faelle = [
    ["nl/gids/europallets-20ft-container.html", C20, 11, 8, 22],
    ["nl/gids/europallets-40ft-container.html", C40, 25, 20, 50],
  ];
  for (const [f, C, lage, ohne, zwei] of faelle) {
    assert.strictEqual(makeFloorPacker(120, 80, true)(C.l, C.w).count, lage);
    assert.strictEqual(makeFloorPacker(120, 80, false)(C.l, C.w).count, ohne);
    assert.strictEqual(zwei, 2 * lage);
    const s = lese(f);
    for (const z of [lage, ohne, zwei])
      assert.ok(new RegExp(`\\b${z}\\b`).test(s), `${f}: die Zahl ${z} fehlt`);
    // Das SVG zeichnet exakt die Stellplaetze der ersten Lage plus den Umriss.
    const m = s.match(/<figure class="stau">([\s\S]*?)<\/figure>/);
    assert.ok(m, `${f}: keine Draufsicht`);
    assert.strictEqual((m[1].match(/<rect /g) || []).length, lage + 1, `${f}: SVG-Stellplaetze`);
  }
});

test("die Kuub-Werte sind aus den PRESETS gerechnet (eine Nachkommastelle)", () => {
  const s = lese("nl/gids/cbm-container.html");
  for (const name of ["20' GP", "40' GP", "40' HC", "45' HC"]) {
    const P = PRESETS[name];
    const m3 = (P.l * P.w * P.h / 1e6).toFixed(1).replace(".", ",");
    assert.ok(s.includes(`${m3} m³`), `cbm-container: ${name} = ${m3} m³ fehlt`);
  }
});

test("die Afmetingen-Tabellen tragen die PRESETS-Innenmasse", () => {
  const s = lese("nl/gids/container-afmetingen.html");
  for (const name of ["20' GP", "20' HC", "40' GP", "40' HC", "45' HC"]) {
    const P = PRESETS[name];
    for (const v of [P.l, P.w, P.h])
      assert.ok(new RegExp(`\\b${v} cm\\b`).test(s), `afmetingen: ${name} — ${v} cm fehlt`);
  }
});

const CLUSTER = [
  ["ratgeber/europaletten-20-fuss-container", "en/guide/euro-pallets-20ft-container", "europallets-20ft-container"],
  ["ratgeber/europaletten-40-fuss-container", "en/guide/euro-pallets-40ft-container", "europallets-40ft-container"],
  ["ratgeber/container-volumen-cbm", "en/guide/container-volume-cbm", "cbm-container"],
  ["ratgeber/container-masse-innenmasse", "en/guide/container-internal-dimensions", "container-afmetingen"],
];

test("jedes Cluster ist ein sauberes Dreier-Netz: hreflang auf allen drei Fassungen", () => {
  for (const [de, en, nl] of CLUSTER) {
    const sNl = lese(`nl/gids/${nl}.html`);
    assert.ok(sNl.includes(`hreflang="de" href="https://containerload.io/${de}"`), `${nl}: de-Alternate fehlt`);
    assert.ok(sNl.includes(`hreflang="en" href="https://containerload.io/${en}"`), `${nl}: en-Alternate fehlt`);
    assert.ok(sNl.includes(`hreflang="x-default" href="https://containerload.io/${de}"`), `${nl}: x-default fehlt`);
    for (const f of [de, en]) {
      const s = lese(f + ".html");
      assert.ok(s.includes(`hreflang="nl" href="https://containerload.io/nl/gids/${nl}"`), `${f}: nl-Alternate fehlt`);
      assert.ok(s.includes(`href="/nl/gids/${nl}" hreflang="nl"`), `${f}: NL fehlt im Sprachumschalter`);
    }
  }
});

test("Sitemap: NL-Seiten gelistet, Bestands-Bloecke tragen die nl-Zeile", () => {
  const sm = lese("sitemap.xml");
  for (const [de, en, nl] of CLUSTER) {
    assert.ok(sm.includes(`<loc>https://containerload.io/nl/gids/${nl}</loc>`), `Sitemap: ${nl} fehlt`);
    for (const pfad of [de, en]) {
      const i = sm.indexOf(`<loc>https://containerload.io/${pfad}</loc>`);
      assert.ok(i > 0, `Sitemap: ${pfad} fehlt`);
      const block = sm.slice(i, sm.indexOf("</url>", i));
      assert.ok(block.includes(`hreflang="nl" href="https://containerload.io/nl/gids/${nl}"`),
        `Sitemap-Block ${pfad}: nl-Zeile fehlt`);
    }
  }
  assert.ok(sm.includes("<loc>https://containerload.io/nl/gids/</loc>"), "Sitemap: NL-Index fehlt");
});

test("die NL-Uebersicht verlinkt alle vier Seiten, die Seiten den Rueckweg", () => {
  const ix = lese("nl/gids/index.html");
  for (const [, , nl] of CLUSTER)
    assert.ok(ix.includes(`href="/nl/gids/${nl}"`), `NL-Index verlinkt ${nl} nicht`);
  for (const [, , nl] of CLUSTER)
    assert.ok(lese(`nl/gids/${nl}.html`).includes('href="/nl/gids/"'), `${nl}: Rueckweg zur Uebersicht fehlt`);
});
