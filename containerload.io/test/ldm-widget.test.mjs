// Der Lademeter-Rechner auf der LKW-Wissensseite, nach demselben Muster wie das
// CBM-Widget: Rechenkern und Oberflaeche stehen auf beiden Sprachfassungen WOERTLICH
// gleich (Marker LDM_CALC / LDM_UI), seitenspezifisch ist nur ldmCfg. Zwei Kopien,
// die auseinanderlaufen duerfen, waeren zwei Rechner mit zwei Meinungen.
import fs from "node:fs";
import assert from "node:assert";
import test from "node:test";
import { fileURLToPath } from "node:url";
import path from "node:path";

const dir = path.dirname(fileURLToPath(import.meta.url));
const lies = (p) => fs.readFileSync(path.join(dir, "..", p), "utf8");
const de = lies("ratgeber/ladungsberechnung-lkw-planensattel.html");
const en = lies("en/guide/truck-trailer-load-calculation.html");

const schnitt = (html, von, bis) => {
  const a = html.indexOf(von), b = html.indexOf(bis);
  assert.ok(a > 0 && b > a, `Marker ${von}…${bis} nicht gefunden`);
  return html.slice(a, b + bis.length);
};

test("genau ein Widget je Seite, auf beiden Seiten", () => {
  for (const [name, html] of [["DE", de], ["EN", en]]) {
    assert.strictEqual((html.match(/data-ldm-widget/g) || []).length, 1, `${name}: nicht genau ein Widget`);
  }
});

test("Rechenkern und Oberflaeche sind woertlich identisch", () => {
  assert.strictEqual(
    schnitt(de, "// LDM_CALC_START", "// LDM_CALC_END"),
    schnitt(en, "// LDM_CALC_START", "// LDM_CALC_END"),
    "LDM_CALC weicht ab"
  );
  assert.strictEqual(
    schnitt(de, "// LDM_UI_START", "// LDM_UI_END"),
    schnitt(en, "// LDM_UI_START", "// LDM_UI_END"),
    "LDM_UI weicht ab"
  );
});

// Den Rechenkern wirklich ausfuehren, nicht nur auf Zeichen vergleichen.
const kern = schnitt(de, "// LDM_CALC_START", "// LDM_CALC_END");
const { ldmBerechnen, ldmSumme } = new Function(kern + "\nreturn { ldmBerechnen, ldmSumme };")();

test("die Lademeter-Formel stimmt: (L x B) / 2,4 in Metern", () => {
  // Europalette 120x80: 0,96 m² / 2,4 = 0,4 ldm. 26 Stueck = 10,4 ldm.
  const r = ldmBerechnen(120, 80, 26);
  assert.ok(Math.abs(r.stueck - 0.4) < 1e-12, `je Stueck: ${r.stueck}`);
  assert.ok(Math.abs(r.gesamt - 10.4) < 1e-12, `gesamt: ${r.gesamt}`);
  // Industriepalette 120x100: 0,5 ldm.
  assert.ok(Math.abs(ldmBerechnen(120, 100, 1).gesamt - 0.5) < 1e-12);
  // Gegenproben: ohne Laenge, Breite oder Menge gibt es keine Zahl.
  assert.strictEqual(ldmBerechnen(0, 80, 5), null);
  assert.strictEqual(ldmBerechnen(120, "", 5), null);
  assert.strictEqual(ldmBerechnen(120, 80, 0), null);
});

test("frachtpflichtig nur, wenn JEDE gueltige Zeile ein Gewicht traegt", () => {
  // 10 Europaletten a 300 kg: 4 ldm -> 7.000 kg frachtpflichtig (1 ldm = 1.750 kg),
  // mehr als die echten 3.000 kg.
  const voll = ldmSumme([{ l: 120, w: 80, h: 100, qty: 10, kg: 300 }]);
  assert.ok(Math.abs(voll.ldm - 4) < 1e-12);
  assert.strictEqual(voll.frachtKg, 7e3);
  // Schwere Ladung: echtes Gewicht schlaegt den Satz.
  const schwer = ldmSumme([{ l: 120, w: 80, h: 100, qty: 10, kg: 900 }]);
  assert.strictEqual(schwer.frachtKg, 9e3);
  // Gegenprobe: eine Zeile ohne Gewicht -> KEIN frachtpflichtiges Gewicht. Ein halb
  // gewogenes Maximum waere eine falsche Zahl mit amtlichem Klang.
  const halb = ldmSumme([
    { l: 120, w: 80, h: 100, qty: 5, kg: 300 },
    { l: 120, w: 100, h: 100, qty: 2, kg: "" }
  ]);
  assert.strictEqual(halb.frachtKg, null);
  assert.ok(Math.abs(halb.ldm - (2 + 1)) < 1e-12, `ldm: ${halb.ldm}`);
});

test("die Hoehe ist nur fuer den 3D-Sprung Pflicht, nicht fuer die Lademeter", () => {
  const ohne = ldmSumme([{ l: 120, w: 80, h: "", qty: 4, kg: 200 }]);
  assert.ok(Math.abs(ohne.ldm - 1.6) < 1e-12, "ohne Hoehe muessen die Lademeter trotzdem stehen");
  assert.strictEqual(ohne.alleH, false);
  assert.strictEqual(ldmSumme([{ l: 120, w: 80, h: 100, qty: 4, kg: 200 }]).alleH, true);
  // Gegenprobe im UI-Code: ohne alleH wird der Sprung versteckt, nicht mit halben Daten gebaut.
  const ui = schnitt(de, "// LDM_UI_START", "// LDM_UI_END");
  assert.ok(ui.includes("if (!s.alleH)"), "UI prueft alleH nicht");
  assert.ok(/if \(!s\.alleH\) \{[\s\S]{0,200}?zur3d\.hidden = true;[\s\S]{0,40}?return;/.test(ui), "ohne Hoehen muss der 3D-Link verschwinden");
});

test("der Sprung landet in der Landfracht, mit Sprache", () => {
  assert.ok(de.includes("'/app?q=' + encodeURIComponent(q) + '&d=road'"), "DE: d=road fehlt");
  assert.ok(en.includes("'/app?q=' + encodeURIComponent(q) + '&d=road&lang=en'"), "EN: d=road&lang=en fehlt");
  // Der statische Platzhalter-Link der EN-Seite darf nicht auf Deutsch zeigen.
  assert.ok(en.includes('id="ldmZur3d" class="cbm-open" hidden href="/app?lang=en"'), "EN-Platzhalter ohne lang=en");
  // Und die App versteht d=road nur zusammen mit ?q= — der Vertrag im Rechner selbst.
  const app = lies("app.html");
  assert.ok(app.includes('QIMPORT && new URLSearchParams(window.location.search).get("d") === "road"'), "QROAD-Vertrag in app.html fehlt");
  assert.ok(app.includes('QROAD ? "road"'), "Domain-Start nutzt QROAD nicht");
  assert.ok(app.includes('QROAD ? "Planensattel"'), "Preset-Start nutzt QROAD nicht");
});

test("der uebliche Satz steht sichtbar auf der Seite, nicht nur im Code", () => {
  // Wer eine frachtpflichtige Zahl zeigt, muss sagen, woher sie kommt.
  assert.ok(de.includes("1&nbsp;ldm = 1.750&nbsp;kg"), "DE: Satz 1 ldm = 1.750 kg fehlt im Text");
  assert.ok(en.includes("1&nbsp;ldm = 1,750&nbsp;kg"), "EN: Satz fehlt im Text");
});
