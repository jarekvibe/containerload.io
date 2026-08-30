// Der CBM-Rechner auf den beiden CBM-Seiten (DE/EN).
//
// WARUM: Der Wettbewerber (containermath.com) hat einen kostenlosen CBM-Rechner als
// eigene Seite. Statt eine dritte, mit ihm konkurrierende Seite in den eigenen
// Suchindex zu haengen, wird das bestehende, indexierte Seitenpaar aufgewertet:
// /ratgeber/cbm-berechnen und /en/guide/how-to-calculate-cbm bekommen ein kleines
// interaktives Widget direkt unter der Einleitung. Dieser Test haelt fest, was dabei
// nicht kippen darf: genau EIN Widget je Seite, beide Seiten rechnen mit DERSELBEN
// Funktion (extrahiert aus dem HTML und tatsaechlich ausgefuehrt, nicht nur behauptet),
// jedes Eingabefeld hat ein sichtbares Label, und das Regelwerk der Seite (keine
// Farbverlaeufe, kein fill-opacity) gilt auch im Widget-Markup.
import fs from "node:fs";
import assert from "node:assert";
import test from "node:test";
import { fileURLToPath } from "node:url";
import path from "node:path";

const dir = path.dirname(fileURLToPath(import.meta.url));
const DE_DATEI = "cbm-berechnen.html";
const EN_DATEI = "how-to-calculate-cbm.html";
const de = fs.readFileSync(path.join(dir, "..", "ratgeber", DE_DATEI), "utf8");
const en = fs.readFileSync(path.join(dir, "..", "en", "guide", EN_DATEI), "utf8");
const SEITEN = [[DE_DATEI, de], [EN_DATEI, en]];

// Die Funktion wird nicht abgeschrieben, sondern per String-Schnitt aus dem
// tatsaechlich ausgelieferten HTML herausgetrennt und mit new Function ausgefuehrt —
// eine nachgebaute Kopie im Test wuerde nichts darueber sagen, ob die Seite selbst
// noch richtig rechnet.
function extrahiereFn(quelle, datei) {
  const start = quelle.indexOf("// CBM_CALC_START");
  const end = quelle.indexOf("// CBM_CALC_END");
  assert.ok(start !== -1 && end !== -1 && end > start, `${datei}: Rechen-Funktion nicht gefunden (Marker fehlen)`);
  const code = quelle.slice(start, end);
  return new Function(code + "\nreturn cbmBerechnen;")();
}

function widgetBlock(quelle) {
  const widgetStart = quelle.indexOf("data-cbm-widget");
  const scriptEnd = quelle.indexOf("</script>", widgetStart);
  return quelle.slice(widgetStart, scriptEnd === -1 ? undefined : scriptEnd + "</script>".length);
}

test("beide Seiten tragen genau ein CBM-Widget", () => {
  for (const [datei, quelle] of SEITEN) {
    const treffer = quelle.match(/data-cbm-widget/g) || [];
    assert.strictEqual(treffer.length, 1, `${datei}: ${treffer.length} statt genau 1 Element mit data-cbm-widget`);
  }
});

test("beide Seiten rechnen mit derselben Funktion — 120x80x110 cm", () => {
  for (const [datei, quelle] of SEITEN) {
    const fn = extrahiereFn(quelle, datei);
    const einzeln = fn(120, 80, 110, 1);
    assert.ok(einzeln, `${datei}: liefert bei gueltigen Massen kein Ergebnis`);
    assert.ok(Math.abs(einzeln.stueck - 1.056) < 1e-9, `${datei}: 1 Stueck ergibt ${einzeln.stueck} statt 1.056 m³`);
    assert.ok(Math.abs(einzeln.gesamt - 1.056) < 1e-9, `${datei}: bei Menge 1 muss gesamt = Stueckvolumen sein`);
    const mehrere = fn(120, 80, 110, 26);
    assert.ok(Math.abs(mehrere.gesamt - 27.456) < 1e-9, `${datei}: 26 Stueck ergibt ${mehrere.gesamt} statt 27.456 m³`);
    assert.ok(Math.abs(mehrere.stueck - 1.056) < 1e-9, `${datei}: das Stueckvolumen darf sich mit der Menge nicht aendern`);
  }
});

test("leere, negative oder nicht-numerische Eingaben ergeben kein Ergebnis", () => {
  for (const [datei, quelle] of SEITEN) {
    const fn = extrahiereFn(quelle, datei);
    const faelle = [
      ["", 80, 110, 1], [120, "", 110, 1], [120, 80, "", 1], [120, 80, 110, ""],
      [-120, 80, 110, 1], [120, -80, 110, 1], [120, 80, 110, 0], [120, 80, 110, -1],
      ["abc", 80, 110, 1], [120, 80, "abc", 1],
    ];
    for (const eingabe of faelle) {
      assert.strictEqual(fn(...eingabe), null, `${datei}: ${JSON.stringify(eingabe)} sollte kein Ergebnis liefern`);
    }
  }
});

test("jedes der vier Eingabefelder hat ein sichtbares Label mit passendem for", () => {
  for (const [datei, quelle] of SEITEN) {
    const block = widgetBlock(quelle);
    const inputs = [...block.matchAll(/<input[^>]*\bid="([^"]+)"[^>]*>/g)].map((m) => m[1]);
    assert.strictEqual(inputs.length, 4, `${datei}: ${inputs.length} statt 4 Eingabefelder im Widget gefunden`);
    for (const id of inputs) {
      assert.ok(new RegExp(`<label for="${id}"`).test(block), `${datei}: kein <label for="${id}">`);
    }
  }
});

test("kein fill-opacity, kein Farbverlauf im Widget-Markup", () => {
  for (const [datei, quelle] of SEITEN) {
    const block = widgetBlock(quelle);
    assert.ok(!/fill-opacity/.test(block), `${datei}: fill-opacity im Widget`);
    assert.ok(!/linear-gradient|radial-gradient/.test(block), `${datei}: Farbverlauf im Widget`);
  }
});
