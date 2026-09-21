// Das Strassenlimit je Land: ein Container darf laut CSC-Schild oft weit mehr
// tragen, als im Vor-/Nachlauf auf der Strasse legal faehrt.
//
// Die eine Zusage, an der alles haengt: App (STRASSE in app.html), die neue
// Wissensseite (DE + EN) und das Strassen-Beispiel der Zuladungs-Seite rechnen
// mit DENSELBEN Zahlen. Zwei Seiten mit zwei verschiedenen "typischen"
// Fahrzeugen waeren genau die Drift, die dieses Projekt ueberall sonst
// ausgebaut hat.
//
// node --test test/strassenlimit.test.mjs
import fs from "node:fs";
import assert from "node:assert";
import test from "node:test";
import { fileURLToPath } from "node:url";
import path from "node:path";

const dir = path.dirname(fileURLToPath(import.meta.url));
const roh = fs.readFileSync(path.join(dir, "..", "app.html"), "utf8");
const seiteDE = fs.readFileSync(path.join(dir, "..", "ratgeber", "container-gewicht-strasse.html"), "utf8");
const seiteEN = fs.readFileSync(path.join(dir, "..", "en", "guide", "container-road-weight-limits.html"), "utf8");

const schnitt = (von, bis) => {
  const a = roh.indexOf(von);
  assert.ok(a >= 0, `Anfang nicht gefunden: ${von}`);
  const b = roh.indexOf(bis, a);
  assert.ok(b > a, `Ende nicht gefunden: ${bis}`);
  return roh.slice(a, b + bis.length);
};
const { STRASSE, TARA } = new Function(
  schnitt("var TARA = {", "};") + "\n" + schnitt("var STRASSE = {", "};") + "\nreturn { STRASSE, TARA };"
)();

test("die Invariante: brutto = zGG minus typisches Fahrzeug, in jeder Zeile", () => {
  const keys = Object.keys(STRASSE);
  assert.ok(keys.length >= 5, "die Tabelle ist geschrumpft");
  for (const k of keys) {
    const e = STRASSE[k];
    assert.strictEqual(e.brutto, e.zgg - e.fahrzeug, `${k}: brutto geht nicht auf`);
    assert.ok(e.brutto > 10000 && e.brutto < 40000, `${k}: unplausibles Brutto ${e.brutto}`);
  }
  // Und die Beispielannahme der Zuladungs-Seite (12.000 kg Fahrzeug) gilt
  // weiter fuer die europaeischen Zeilen -- beide Seiten, eine Annahme.
  assert.strictEqual(STRASSE.de40.fahrzeug, 12000);
  const zuladung = fs.readFileSync(path.join(dir, "..", "ratgeber", "container-zuladung-gewicht.html"), "utf8");
  assert.ok(zuladung.includes("12.000 kg"), "die Zuladungs-Seite rechnet mit einem anderen Fahrzeug");
});

test("beide Sprachfassungen der Seite tragen exakt die Zahlen der App", () => {
  const fmt = (n, en) => n.toLocaleString(en ? "en-GB" : "de-DE");
  for (const [seite, en] of [[seiteDE, false], [seiteEN, true]]) {
    for (const k of Object.keys(STRASSE)) {
      const e = STRASSE[k];
      for (const wert of [e.zgg, e.fahrzeug, e.brutto]) {
        assert.ok(seite.includes(fmt(wert, en) + " kg"), `${en ? "EN" : "DE"}: ${fmt(wert, en)} kg fehlt (${k})`);
      }
      // Die Spalte "davon Ladung im 40' HC" ist brutto minus Tara -- dieselbe
      // Tara wie ueberall (TARA in app.html, VGM-Block, Zuladungs-Seite).
      const ladung = e.brutto - TARA["40' HC"];
      assert.ok(seite.includes("≈ " + fmt(ladung, en) + " kg"), `${en ? "EN" : "DE"}: Ladungs-Spalte falsch (${k}: ${ladung})`);
    }
  }
});

test("die App: Auswahl aus STRASSE, Vergleich mit Tara, nur Seefracht, gezaehlt", () => {
  assert.ok(roh.includes("Object.keys(STRASSE).map((k) =>"), "das Auswahlfeld liest nicht aus STRASSE");
  assert.ok(roh.includes('if (v) zaehl("strassenlimit");'), "die Auswahl zaehlt nicht");
  assert.ok(roh.includes('if (domain !== "sea" || !strasse || !STRASSE[strasse]) return null;'),
    "das Limit gilt nicht mehr nur fuer die Seefracht");
  assert.ok(roh.includes("const tara = TARA[slotName] || null;") && roh.includes("const kg = sichtKg + (tara || 0);"),
    "der Vergleich rechnet nicht Ladung + typische Tara je gezeigtem Container");
  assert.ok(roh.includes("ueber: kg > grenze.brutto + 0.5"), "die Ueberschreitung wird nicht erkannt");
  // Jeder Schluessel hat in BEIDEN Woerterbuechern einen Namen.
  for (const k of Object.keys(STRASSE)) {
    const n = (roh.match(new RegExp(k + ': "', "g")) || []).length;
    assert.ok(n >= 2, `${k} fehlt in einem der beiden strasseLand-Woerterbuecher`);
  }
});

test("die Seiten haengen im Geflecht: hreflang-Paar, Sitemap, Uebersichten, verwandte Fragen", () => {
  for (const [seite, name] of [[seiteDE, "DE"], [seiteEN, "EN"]]) {
    assert.ok(seite.includes('hreflang="de" href="https://containerload.io/ratgeber/container-gewicht-strasse"')
      && seite.includes('hreflang="en" href="https://containerload.io/en/guide/container-road-weight-limits"')
      && seite.includes('hreflang="x-default" href="https://containerload.io/ratgeber/container-gewicht-strasse"'),
      `${name}: hreflang unvollstaendig`);
    assert.ok(seite.includes('/ratgeber/wissen.css'), `${name}: fremde Gestaltung`);
  }
  // EN-Rechnerlinks tragen die Sprache mit.
  assert.ok(seiteEN.includes('href="/app?lang=en"'), "EN oeffnet den deutschen Rechner");
  const sitemap = fs.readFileSync(path.join(dir, "..", "sitemap.xml"), "utf8");
  assert.ok(sitemap.includes("ratgeber/container-gewicht-strasse</loc>")
    && sitemap.includes("en/guide/container-road-weight-limits</loc>"), "die Sitemap kennt die Seiten nicht");
  assert.ok(fs.readFileSync(path.join(dir, "..", "ratgeber", "index.html"), "utf8").includes("container-gewicht-strasse"),
    "die deutsche Uebersicht verlinkt die Seite nicht");
  assert.ok(fs.readFileSync(path.join(dir, "..", "en", "guide", "index.html"), "utf8").includes("container-road-weight-limits"),
    "die englische Uebersicht verlinkt die Seite nicht");
  assert.ok(fs.readFileSync(path.join(dir, "..", "ratgeber", "container-zuladung-gewicht.html"), "utf8").includes("container-gewicht-strasse"),
    "die Zuladungs-Seite verlinkt die Strassen-Seite nicht");
});
