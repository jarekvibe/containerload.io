// Die Landfracht-Leiste traegt die cbm.
//
// Gemeldet: "bei Landfracht auch noch die cbm hinzufuegen". Das Volumen stand
// auf der Strasse nur in der Details-Schublade -- dort suchte es niemand.
// Strassenfracht wird nach ldm, kg UND cbm eingekauft; alle drei stehen jetzt
// nebeneinander in der Leiste. Die Seefracht-Leiste bleibt unveraendert, und
// die Schublade zeigt das Volumen nicht doppelt.
//
// node --test test/leiste-landfracht-cbm.test.mjs
import fs from "node:fs";
import assert from "node:assert";
import test from "node:test";
import { fileURLToPath } from "node:url";
import path from "node:path";

const dir = path.dirname(fileURLToPath(import.meta.url));
const roh = fs.readFileSync(path.join(dir, "..", "app.html"), "utf8");

test("die Strassen-Leiste traegt fuenf Karten, cbm zwischen ldm und kg", () => {
  assert.ok(roh.includes('? [kpiFull, kpiLoaded, kpiLdm, kpiVol, kpiWeight]'),
    "die Landfracht-Leiste traegt das Volumen nicht (mehr)");
  assert.ok(roh.includes(': [kpiFull, kpiLoaded, kpiVol, kpiWeight];'),
    "die Seefracht-Leiste hat sich mitveraendert -- das war nicht gemeint");
});

test("die Schublade zeigt das Volumen nicht doppelt", () => {
  assert.ok(roh.includes('const detailCards = domain === "road" ? [kpiSpots] : [kpiFreeLen, kpiLayers];'),
    "kpiVol steht auf der Strasse noch (oder wieder) in der Schublade");
});

test("auf der Strasse heisst die Einheit cbm, ohne Nenner", () => {
  // Ein Planensattel wird nicht gegen sein Huellvolumen verkauft -- die Zahl
  // steht fuer sich, wie bisher in der Schublade.
  assert.ok(/const kpiVol = domain === "road"\n\s*\? \{ label: T\.volume, value: nf\(sichtVol, 2\), sub: "cbm" \}/.test(roh),
    "die Strassen-Volumenkarte traegt nicht mehr die nackten cbm");
});
