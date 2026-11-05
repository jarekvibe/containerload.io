// Der Gewichts-Check auf den Zuladungs-Seiten (DE /ratgeber/container-zuladung-gewicht,
// EN /en/guide/container-payload-weight), November 2026.
//
// Warum: die Search Console zeigte die Zuladungs-Seite als meistgesehene Seite (2.187
// Impressionen in 28 Tagen, Position 7,6) mit 15 Klicks. Gesucht wird "Container Gewicht",
// "was wiegt ein leerer 40 Fuss Container" -- die Zahl zeigt Google selbst an. Was die
// Antwortbox nicht kann: die EIGENE Ladung pruefen. Deshalb steht oben auf der Seite ein
// kleiner Rechner: Container waehlen, Gewicht eintippen -> Zuladung, Brutto (VGM-Grundlage)
// und das Strassenlimit.
//
// Drei Zahlenquellen, und keine darf abgeschrieben wegdriften:
//   Zuladung = PRESETS.payload in app.html
//   Tara     = TARA in app.html (dieselbe, die der Ladevorschlag fuer die VGM nimmt)
//   Strasse  = die Tabelle DIESER Seite (40.000 / 44.000 / 12.000 kg -> 24.100 kg frei)
//
// node --test test/gewicht-check.test.mjs
import fs from "node:fs";
import assert from "node:assert";
import test from "node:test";
import { fileURLToPath } from "node:url";
import path from "node:path";

const dir = path.dirname(fileURLToPath(import.meta.url));
const lese = (p) => fs.readFileSync(path.join(dir, "..", p), "utf8");
const SEITEN = { de: "ratgeber/container-zuladung-gewicht.html", en: "en/guide/container-payload-weight.html" };
const html = { de: lese(SEITEN.de), en: lese(SEITEN.en) };
const app = lese("app.html");
const schnitt = (s, von, bis) => {
  const a = s.indexOf(von), b = s.indexOf(bis, a);
  assert.ok(a >= 0 && b > a, `Marker fehlen: ${von}`);
  return s.slice(a, b + bis.length);
};
const KERN = ["// GEWICHT_CALC_START", "// GEWICHT_CALC_END"];
const { gewichtCheck, GW_TYPEN, GW_STRASSE } = new Function(
  schnitt(html.de, ...KERN) + "\nreturn { gewichtCheck, GW_TYPEN, GW_STRASSE };"
)();

test("jede Zuladungs-Seite traegt genau einen Gewichts-Check, mit identischem Rechenkern", () => {
  for (const [k, s] of Object.entries(html)) assert.strictEqual((s.match(/data-gewicht-check/g) || []).length, 1, SEITEN[k]);
  assert.strictEqual(schnitt(html.en, ...KERN).replace(/\s+/g, " "), schnitt(html.de, ...KERN).replace(/\s+/g, " "),
    "DE und EN rechnen verschieden");
});

test("Zuladung und Tara kommen aus app.html (PRESETS / TARA)", () => {
  const TARA = new Function("return " + app.match(/var TARA = (\{[^}]+\})/)[1])();
  for (const [typ, w] of Object.entries(GW_TYPEN)) {
    const m = app.match(new RegExp(`"${typ.replace("'", "\\'")}": \\{ l: \\d+, w: \\d+, h: \\d+, payload: (\\d+)`));
    assert.ok(m, `PRESETS ${typ} fehlt`);
    assert.strictEqual(w.zuladung, +m[1], `${typ}: Zuladung weicht von PRESETS ab`);
    assert.strictEqual(w.tara, TARA[typ], `${typ}: Tara weicht von TARA ab`);
  }
  assert.deepStrictEqual(Object.keys(GW_TYPEN).sort(), Object.keys(TARA).sort(), "dieselben fuenf Typen wie TARA");
});

test("das Strassenlimit ist die Rechnung aus der Tabelle der Seite", () => {
  assert.deepStrictEqual(GW_STRASSE, { zug: 40000, kv: 44000, fahrzeug: 12000 });
  // Die Seite rechnet "= moeglich auf der Strasse 24.100 kg" fuer den 40' HC -- der Check muss dasselbe sagen.
  assert.strictEqual(gewichtCheck("40' HC", 1).strasseFrei, 24100);
  assert.ok(/24\.100 kg/.test(html.de) && /24,100 kg/.test(html.en), "die Tabellen nennen 24.100 kg nicht mehr");
  assert.ok(html.de.includes("12.000 kg") && html.de.includes("40.000 kg") && html.de.includes("44.000 kg"));
});

test("Rechnung: passt, knapp, zu schwer, Brutto und Strasse", () => {
  const r = gewichtCheck("40' HC", 18400);
  assert.strictEqual(r.zuladung, 26580);
  assert.ok(Math.abs(r.anteil - 18400 / 26580) < 1e-12);
  assert.strictEqual(r.ueber, 0);
  assert.strictEqual(r.brutto, 22300, "Ladung + Tara 3.900");
  assert.strictEqual(r.zug, 34300, "Brutto + 12 t Fahrzeug");
  assert.ok(r.zugOk);
  const schwer = gewichtCheck("40' HC", 27000);
  assert.strictEqual(schwer.ueber, 420);
  assert.ok(!schwer.zugOk && schwer.kvOk, "27 t + 3,9 + 12 = 42,9 t: ueber 40, unter 44 -> im KV ginge es");
  assert.ok(!gewichtCheck("40' HC", 29000).kvOk, "29 t + 3,9 + 12 = 44,9 t: auch fuer 44 t zu schwer");
  const kv = gewichtCheck("20' GP", 26000);
  assert.strictEqual(kv.zug, 26000 + 2280 + 12000);
  assert.ok(!kv.zugOk && kv.kvOk, "40,28 t: zu schwer fuer 40 t, geht im KV (44 t)");
  for (const kaputt of [["40' HC", 0], ["40' HC", ""], ["40' HC", -5], ["Custom", 1000]]) {
    assert.strictEqual(gewichtCheck(...kaputt), null, JSON.stringify(kaputt));
  }
});

test("Oberflaeche: Labels, Sprache, Sprung in den Rechner, kein Verlauf", () => {
  for (const [k, s] of Object.entries(html)) {
    const w = schnitt(s, "data-gewicht-check", "</script>");
    assert.ok(/<label for="gwCont">/.test(w) && /<label for="gwKg">/.test(w), `${k}: Felder ohne Label`);
    assert.ok(/aria-live="polite"/.test(w), `${k}: das Ergebnis wird nicht vorgelesen`);
    assert.ok(!/linear-gradient|radial-gradient|fill-opacity/.test(w), k);
    assert.ok(/<option value="40' HC" selected>/.test(w), `${k}: Voreinstellung 40' HC (meistgerechneter Typ)`);
  }
  assert.ok(html.de.includes("toLocaleString('de-DE')") && html.de.includes('href="/app"'));
  assert.ok(html.en.includes("toLocaleString('en-US')") && html.en.includes('href="/app?lang=en"'));
  // Ist schon der Container ueberladen, verspricht der Strassen-Satz nicht "im KV ginge es".
  assert.ok(html.de.includes("r.kvOk && !r.ueber ?") && html.en.includes("r.kvOk && !r.ueber ?"));
  // Der Strassen-Satz nennt das Fahrzeuggewicht als Richtwert -- sonst klingt er wie eine Zulassung.
  assert.ok(/Fahrzeug ca\. 12 t/.test(html.de) && /vehicle approx\. 12 t/.test(html.en));
});

test("Titel und Einleitung bedienen die Suche nach dem Gewicht (leer) -- mit stimmigen Zahlen", () => {
  assert.ok(/<title>Container-Gewicht/.test(html.de) && /<title>Container weight/.test(html.en));
  assert.ok(/<h1>Was wiegt ein Container/.test(html.de) && /<h1>How much does a container weigh/.test(html.en));
  // 3.880 kg sind gerundet 3,9 t -- die alte Seite sagte an zwei Stellen 3,8.
  assert.ok(!/3,8 Tonnen|rund 3,8 und/.test(html.de), "DE nennt noch 3,8 t fuer 3.880 kg");
  assert.ok(!/3\.8 tonnes|around 3\.8 and/.test(html.en), "EN nennt noch 3.8 t fuer 3,880 kg");
});
