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
const de = lies("ratgeber/lademeter-rechner.html");
const en = lies("en/guide/loading-metre-calculator.html");

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

test("gestapelt: n Stueck in L Lagen belegen aufgerundet n/L Stellplaetze", () => {
  // Das Beispiel der Seite: 26 Europaletten in zwei Lagen = 13 Stellplaetze = 5,2 ldm.
  const zwei = ldmBerechnen(120, 80, 26, 2);
  assert.strictEqual(zwei.stellen, 13);
  assert.ok(Math.abs(zwei.gesamt - 5.2) < 1e-12, `gesamt: ${zwei.gesamt}`);
  // Ungerade Menge: die letzte Palette steht allein und belegt trotzdem einen Platz.
  assert.strictEqual(ldmBerechnen(120, 80, 27, 2).stellen, 14);
  // Ohne, mit 0 oder Unsinn als Lagen: eine Lage (nie mehr Lademeter erfinden als ohne Stapeln).
  for (const n of [undefined, "", 0, -3, "abc"]) {
    assert.strictEqual(ldmBerechnen(120, 80, 26, n).stellen, 26, `Lagen=${n}`);
  }
  // Angebrochene Lagen zaehlen ganz: 2,7 Lagen sind 2.
  assert.strictEqual(ldmBerechnen(120, 80, 26, 2.7).lagen, 2);
  // Die Seite nennt dasselbe Beispiel.
  assert.ok(de.includes("<b>5,2 statt 10,4&nbsp;ldm</b>") && en.includes("<b>5.2 instead of 10.4&nbsp;ldm</b>"));
});

test("frachtpflichtig nur mit dem Satz der Spedition und nur, wenn JEDE gueltige Zeile ein Gewicht traegt", () => {
  // Das Beispiel der Seite, mit dem dort ausdruecklich ANGENOMMENEN Satz von 1.750 kg/ldm:
  // 10 Europaletten a 300 kg = 4 ldm -> 7.000 kg frachtpflichtig, mehr als die echten 3.000.
  const voll = ldmSumme([{ l: 120, w: 80, h: 100, qty: 10, kg: 300 }], 1750);
  assert.ok(Math.abs(voll.ldm - 4) < 1e-12);
  assert.strictEqual(voll.frachtKg, 7e3);
  // Schwere Ladung: echtes Gewicht schlaegt den Satz.
  assert.strictEqual(ldmSumme([{ l: 120, w: 80, h: 100, qty: 10, kg: 900 }], 1750).frachtKg, 9e3);
  // Ein anderer Satz, eine andere Zahl: der Rechner traegt keinen eigenen.
  assert.strictEqual(ldmSumme([{ l: 120, w: 80, h: 100, qty: 10, kg: 300 }], 1850).frachtKg, 7400);
  // Gegenprobe: ohne Satz gibt es KEIN frachtpflichtiges Gewicht -- ein allgemeiner Satz
  // existiert nicht, also darf der Rechner auch keinen unterstellen.
  for (const satz of [undefined, "", 0, -1750, "abc"]) {
    assert.strictEqual(ldmSumme([{ l: 120, w: 80, h: 100, qty: 10, kg: 300 }], satz).frachtKg, null, `Satz=${satz}`);
  }
  // Gegenprobe: eine Zeile ohne Gewicht -> KEIN frachtpflichtiges Gewicht. Ein halb
  // gewogenes Maximum waere eine falsche Zahl mit amtlichem Klang.
  const halb = ldmSumme([
    { l: 120, w: 80, h: 100, qty: 5, kg: 300 },
    { l: 120, w: 100, h: 100, qty: 2, kg: "" }
  ], 1750);
  assert.strictEqual(halb.frachtKg, null);
  assert.ok(Math.abs(halb.ldm - (2 + 1)) < 1e-12, `ldm: ${halb.ldm}`);
  // Gestapelt wird auch frachtpflichtig weniger: 20 Europaletten a 300 kg in zwei Lagen.
  const gestapelt = ldmSumme([{ l: 120, w: 80, h: 100, qty: 20, lagen: 2, kg: 300 }], 1750);
  assert.ok(Math.abs(gestapelt.ldm - 4) < 1e-12);
  assert.strictEqual(gestapelt.frachtKg, 7e3);
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

test("kein angeblich ueblicher Satz: der Satz ist eine Eingabe, und die Seite sagt das", () => {
  // Bis 20.11.26 stand hier "der uebliche Satz 1 ldm = 1.750 kg". Einen allgemeingueltigen
  // Satz gibt es nicht -- jede Spedition legt ihren in den Tarifbedingungen fest (1.500,
  // 1.650, 1.750, 1.850 ...). Jetzt ist er ein Feld, und ohne Eingabe gibt es keine Zahl.
  for (const [name, html, satzText, keinSatz] of [
    ["DE", de, "Satz Ihrer Spedition", "Einen allgemeingültigen Satz gibt es nicht"],
    ["EN", en, "forwarder’s rate", "There is no universal rate"]
  ]) {
    assert.ok(/<input type="number" id="ldmSatz"[^>]*>/.test(html), `${name}: Satz-Feld fehlt`);
    assert.ok(!/<input type="number" id="ldmSatz"[^>]*\bvalue=/.test(html), `${name}: das Satz-Feld darf nicht vorbelegt sein`);
    assert.ok(html.includes(satzText) && html.includes(keinSatz), `${name}: Hinweis auf den Satz der Spedition fehlt`);
    assert.ok(!/(üblich|usual|standard|common)[^.<]{0,40}(1[.,]750|Satz|rate)/i.test(html), `${name}: ein "ueblicher Satz" ist zurueck`);
    // Das Rechenbeispiel nennt seinen Satz ausdruecklich als Annahme.
    assert.ok(/<b>(angenommenen|assumed)<\/b>/.test(html), `${name}: das Beispiel nennt den Satz nicht als Annahme`);
  }
  // Die Oberflaeche liest den Satz aus dem Feld -- und nirgends aus einer Konstante.
  const ui = schnitt(de, "// LDM_UI_START", "// LDM_UI_END");
  assert.ok(ui.includes("ldmSumme(daten, satzFeld ? satzFeld.value : '')"), "UI liest den Satz nicht aus dem Feld");
  assert.ok(!/1750|1\.750/.test(schnitt(de, "// LDM_CALC_START", "// LDM_UI_END")), "eine feste 1750 steckt im Code");
});

test("eine Lage heisst im 3D-Rechner: nicht stapelbar", () => {
  // Sonst stapelt der Rechner, was das Widget flach gerechnet hat -- und zeigt weniger
  // Lademeter als die Seite. Der Zusatz muss vom Import-Parser in app.html verstanden werden.
  assert.ok(de.includes("flach: ' nicht stapelbar'") && en.includes("flach: ' not stackable'"));
  const app = lies("app.html");
  const m = app.match(/if \((\/nicht\\s\*stapel[^\n]*?\/i)\.test\(low\)\) stackable = false;/);
  assert.ok(m, "Stapel-Regel im Import-Parser nicht gefunden");
  const re = new Function("return " + m[1])();
  assert.ok(re.test("26x 120x80x100 300kg nicht stapelbar") && re.test("26x 120x80x100 300kg not stackable"));
  assert.ok(!re.test("26x 120x80x100 300kg"), "Gegenprobe: ohne Zusatz bleibt es stapelbar");
  const ui = schnitt(de, "// LDM_UI_START", "// LDM_UI_END");
  assert.ok(ui.includes("(r.lagen === 1 ? ldmCfg.flach : '')"), "UI haengt den Zusatz nicht an");
});
