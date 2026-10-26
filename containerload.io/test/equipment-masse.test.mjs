// Die Equipment-Seiten (Open Top, Flat Rack, Reefer) versprechen dieselben Werte,
// mit denen der Rechner plant -- also kommen die Werte hier aus PRESETS, nicht aus
// der Seite. Die Reefer-Palettenzahlen (10 und 23) rechnet der Packer nach, und die
// CTAs muessen den jeweiligen Container auch wirklich vorwaehlen (QCONT-Kuerzel).
//
// node --test test/equipment-masse.test.mjs
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
const PAARE = [
  ["ratgeber/open-top-container-masse.html", "en/guide/open-top-container-dimensions.html",
    ["20' Open Top", "40' Open Top"], "ot"],
  ["ratgeber/flat-rack-container-masse.html", "en/guide/flat-rack-container-dimensions.html",
    ["20' Flat Rack", "40' Flat Rack"], "fr"],
  ["ratgeber/reefer-container-masse.html", "en/guide/reefer-container-dimensions.html",
    ["20' Reefer", "40' Reefer"], "rf"],
];

test("die Masstabellen tragen exakt die PRESETS-Werte, in beiden Sprachen", () => {
  for (const [de, en, presets] of PAARE) {
    for (const f of [de, en]) {
      const s = lese(f);
      for (const name of presets) {
        const P = PRESETS[name];
        assert.ok(s.includes(`${P.l} × ${P.w}`), `${f}: ${name} — ${P.l} × ${P.w} fehlt`);
        if (P.door) assert.ok(s.includes(`${P.door.w} × ${P.door.h} cm`), `${f}: ${name} — Tür ${P.door.w} × ${P.door.h} fehlt`);
        if (P.roof) assert.ok(s.includes(`${P.roof.l} × ${P.roof.w} cm`), `${f}: ${name} — Dachöffnung ${P.roof.l} × ${P.roof.w} fehlt`);
        if (P.gauge && P.kind === "flatrack") assert.ok(s.includes(`${P.gauge.l} × ${P.gauge.w} × ${P.gauge.h} cm`),
          `${f}: ${name} — Hüllmass fehlt`);
      }
    }
  }
});

test("die Reefer-Palettenzahlen kommen aus dem Packer: 10 und 23, ohne Drehen 8 und 18", () => {
  const rf20 = PRESETS["20' Reefer"], rf40 = PRESETS["40' Reefer"];
  assert.strictEqual(makeFloorPacker(120, 80, true)(rf20.l, rf20.w).count, 10);
  assert.strictEqual(makeFloorPacker(120, 80, true)(rf40.l, rf40.w).count, 23);
  assert.strictEqual(makeFloorPacker(120, 80, false)(rf20.l, rf20.w).count, 8);
  assert.strictEqual(makeFloorPacker(120, 80, false)(rf40.l, rf40.w).count, 18);
  for (const f of ["ratgeber/reefer-container-masse.html", "en/guide/reefer-container-dimensions.html"]) {
    const s = lese(f);
    for (const z of [10, 23, 8, 18])
      assert.ok(new RegExp(`\\b${z}\\b`).test(s), `${f}: die Zahl ${z} fehlt`);
  }
});

test("die CTAs waehlen ihren Container vor, und die App kennt die Kuerzel", () => {
  for (const [de, en, , kurz] of PAARE) {
    for (const f of [de, en]) {
      const s = lese(f);
      assert.ok(new RegExp(`cont=(20|40)${kurz}`).test(s), `${f}: CTA ohne cont=${kurz}-Kürzel`);
    }
  }
  for (const k of ['"20ot"', '"40ot"', '"20fr"', '"40fr"', '"20rf"', '"40rf"'])
    assert.ok(app.includes(k + ":"), `QCONT-Whitelist kennt ${k} nicht`);
});

test("die Paare haengen im Netz: Sitemap, GUIDE, Uebersichten, hreflang", () => {
  const sm = lese("sitemap.xml");
  const start = lese("index.html");
  for (const [deF, enF] of PAARE) {
    const de = deF.replace("ratgeber/", "").replace(".html", "");
    const en = enF.replace("en/guide/", "").replace(".html", "");
    assert.ok(sm.includes(`/ratgeber/${de}</loc>`), `Sitemap: ${de} fehlt`);
    assert.ok(sm.includes(`/en/guide/${en}</loc>`), `Sitemap: ${en} fehlt`);
    assert.ok(start.includes(`'/ratgeber/${de}':'/en/guide/${en}'`), `GUIDE kennt ${de} nicht`);
    assert.ok(lese("ratgeber/index.html").includes(`href="/ratgeber/${de}"`), `Ratgeber-Uebersicht ohne ${de}`);
    assert.ok(lese("en/guide/index.html").includes(`href="/en/guide/${en}"`), `Guide-Uebersicht ohne ${en}`);
    assert.ok(lese(deF).includes(`hreflang="en" href="https://containerload.io/en/guide/${en}"`), `${de}: hreflang en fehlt`);
    assert.ok(lese(enF).includes(`hreflang="de" href="https://containerload.io/ratgeber/${de}"`), `${en}: hreflang de fehlt`);
  }
});
