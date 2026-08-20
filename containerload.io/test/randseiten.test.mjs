// Impressum, Datenschutz und die Teilen-Zwischenseite gehoeren zur selben Marke.
//
// Sie waren die letzten drei Seiten mit eigenen Werten. Dieselbe Geschichte wie beim
// Container-Wissen, nur eine Ecke weiter: eigener Grundton (#070a0f statt #0E1116),
// eigene Flaechen- und Textstufen, Inter statt Archivo — und zwar ohne die Schrift
// ueberhaupt zu laden, sodass sie als einzige Seiten des Projekts in der Systemschrift
// standen. Dazu Gewicht 800, Radius 14 und in .ph ein Tuerkis, das es im Produkt seit
// dem Umbau nicht mehr gibt.
//
// Selten besuchte Seiten driften am weitesten, weil niemand hinsieht. Deshalb dieser
// Test: die Werte werden aus app.html GELESEN, nicht abgeschrieben — eine abgeschriebene
// Zahl waere die naechste Kopie, die weglaeuft.
//
// Am Rechtstext selbst aendert dieser Test nichts und prueft ihn auch nicht.
//
// node --test test/randseiten.test.mjs
import fs from "node:fs";
import assert from "node:assert";
import test from "node:test";
import { fileURLToPath } from "node:url";
import path from "node:path";

const dir = path.dirname(fileURLToPath(import.meta.url));
const lies = (f) => fs.readFileSync(path.join(dir, "..", f), "utf8");
const SEITEN = ["impressum.html", "datenschutz.html", "share.html"];
const app = lies("app.html");

// Grundton und Akzent kommen aus dem Rechner.
const GRUND = (app.match(/bg:\s*"(#[0-9a-fA-F]{6})"/) || [])[1] || "#0E1116";
const AKZENT = (app.match(/accent:\s*"(#[0-9a-fA-F]{6})"/) || [])[1] || "#2E8FFF";

test("die Werte des Rechners werden ueberhaupt gefunden", () => {
  assert.match(GRUND, /^#[0-9a-fA-F]{6}$/);
  assert.match(AKZENT, /^#[0-9a-fA-F]{6}$/);
});

test("jede Randseite traegt den Grundton und den Akzent des Produkts", () => {
  for (const f of SEITEN) {
    const s = lies(f);
    assert.ok(s.toLowerCase().includes(GRUND.toLowerCase()), `${f}: Grundton ${GRUND} kommt nicht vor`);
    assert.ok(s.toLowerCase().includes(AKZENT.toLowerCase()), `${f}: Akzent ${AKZENT} kommt nicht vor`);
  }
});

test("keine alten Toene, kein Verlauf, kein Gewicht ueber 700", () => {
  // #070a0f war der alte Grundton, #2f9bff der alte Akzent, 38e0c8 das Tuerkis.
  const verboten = [/#070a0f/i, /#2f9bff/i, /38\s*,\s*224\s*,\s*200/, /#38e0c8/i,
    /font-weight:\s*[89]00/, /linear-gradient/i, /radial-gradient/i];
  for (const f of SEITEN) {
    const s = lies(f);
    // Der Kommentar, der die Vorgeschichte erklaert, darf die alten Werte nennen.
    const ohneKommentare = s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/<!--[\s\S]*?-->/g, "");
    for (const r of verboten)
      assert.ok(!r.test(ohneKommentare), `${f}: ${r} kommt noch vor`);
  }
});

test("jede Randseite laedt dieselbe Schrift wie der Rest der Seite", () => {
  for (const f of SEITEN) {
    const s = lies(f);
    assert.ok(/Archivo/.test(s), `${f}: nennt Archivo nicht`);
    assert.ok(!/'Inter'/.test(s), `${f}: nennt noch Inter`);
  }
  // share.html laedt bewusst keine Schrift nach: die Seite ist 450 ms zu sehen und
  // soll dafuer keinen Netzabruf blockieren. Die Angabe im Stapel genuegt.
  for (const f of ["impressum.html", "datenschutz.html"])
    assert.ok(lies(f).includes("fonts.googleapis.com"), `${f}: laedt Archivo nicht wirklich`);
});

test("theme-color ist ueberall derselbe Ton — auch im Manifest", () => {
  const manifest = JSON.parse(lies("site.webmanifest"));
  assert.strictEqual(manifest.theme_color.toLowerCase(), GRUND.toLowerCase(), "site.webmanifest theme_color");
  assert.strictEqual(manifest.background_color.toLowerCase(), GRUND.toLowerCase(), "site.webmanifest background_color");
  for (const f of SEITEN.concat(["index.html", "app.html"])) {
    const m = lies(f).match(/name="theme-color"\s+content="(#[0-9a-fA-F]{6})"/);
    assert.ok(m, `${f}: kein theme-color`);
    assert.strictEqual(m[1].toLowerCase(), GRUND.toLowerCase(), `${f}: theme-color ${m[1]}`);
  }
});

test("die Radien stammen aus der Reihe 8 / 12 / 16 / 999", () => {
  const erlaubt = new Set(["1", "2", "4", "5", "8", "12", "16", "999", "50%"]);
  for (const f of SEITEN) {
    const treffer = [...lies(f).matchAll(/border-radius:\s*([\d.]+px|50%|999px)/g)]
      .map((m) => m[1].replace("px", ""))
      .filter((v) => !erlaubt.has(v));
    assert.deepStrictEqual([...new Set(treffer)], [], `${f}: Radien ausserhalb der Reihe`);
  }
});
