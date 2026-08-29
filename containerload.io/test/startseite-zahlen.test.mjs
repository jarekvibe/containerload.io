// Das Kennzahlenband unter dem Hero muss stimmen.
//
// Vorher standen dort drei EIGENSCHAFTEN ("Ohne Account · Kostenlos · Maße nach ISO 668").
// Das sagt, was wir nicht verlangen, nicht, was der Rechner kann. Jetzt stehen dort drei
// Zahlen -- und damit gilt fuer sie dieselbe Regel wie im Container-Wissen: eine Zahl auf
// dieser Seite muss nachrechenbar sein, sonst ist sie Werbung.
//
// Die Falle, gegen die dieser Test gebaut ist: jemand ergaenzt in app.html einen Container-
// typ oder eine Reederei, und auf der Startseite steht weiter die alte Zahl. Das faellt
// niemandem auf -- ausser dem, der nachzaehlt und uns danach nichts mehr glaubt.
//
// node --test test/startseite-zahlen.test.mjs
import fs from "node:fs";
import assert from "node:assert";
import test from "node:test";
import { fileURLToPath } from "node:url";
import path from "node:path";

const dir = path.dirname(fileURLToPath(import.meta.url));
const start = fs.readFileSync(path.join(dir, "..", "index.html"), "utf8");
const app = fs.readFileSync(path.join(dir, "..", "app.html"), "utf8");

// Aus app.html gezaehlt, nicht abgeschrieben.
const block = (name) => {
  const m = app.match(new RegExp("var " + name + " = \\{[\\s\\S]*?\\n  \\};"));
  assert.ok(m, `${name} nicht gefunden`);
  return [...m[0].matchAll(/^\s{4}"?([A-Za-z0-9][^":]*?)"?:\s*\{/gm)].map((x) => x[1]);
};
const presets = block("PRESETS");
const vehicles = block("VEHICLES");
const carriers = block("CARRIERS");

// Die Kacheln des Bandes: grosse Zahl + Beschriftung, in Reihenfolge.
const kacheln = [...start.matchAll(
  /leading-none"[^>]*>(\d+)<\/div>\s*<div data-i18n="(kpi\d)"[^>]*>(.*?)<\/div>/gs
)].map((m) => ({ zahl: +m[1], key: m[2], text: m[3] }));

test("das Band steht ueberhaupt auf der Seite", () => {
  assert.strictEqual(kacheln.length, 3, `erwartet drei Kacheln, gefunden ${kacheln.length}`);
  assert.deepStrictEqual(kacheln.map((k) => k.key), ["kpi1", "kpi2", "kpi3"]);
});

test("18 Equipment-Typen = Container + Fahrzeuge aus app.html", () => {
  const soll = presets.length + vehicles.length;
  assert.strictEqual(kacheln[0].zahl, soll,
    `auf der Startseite steht ${kacheln[0].zahl}, gezaehlt sind es ${presets.length} Container + ${vehicles.length} Fahrzeuge = ${soll}`);
  // Und die Beschriftung nennt, was die Zahl gross macht -- sonst klaenge sie erfunden.
  for (const wort of ["Open Top", "Flat Rack", "Platform", "Reefer"]) {
    assert.ok(kacheln[0].text.includes(wort), `die Beschriftung nennt ${wort} nicht`);
    assert.ok(presets.some((p) => p.includes(wort)), `${wort} steht gar nicht in PRESETS`);
  }
});

test("8 Reedereien = CARRIERS aus app.html", () => {
  assert.strictEqual(kacheln[1].zahl, carriers.length,
    `auf der Startseite steht ${kacheln[1].zahl}, in CARRIERS stehen ${carriers.length}`);
  assert.ok(carriers.length >= 5, "unerwartet wenige Reedereien -- Ausschnitt kaputt?");
});

test("die dritte Kachel verspricht nichts, was wir nicht halten", () => {
  // "0 Anmeldungen" -- das gilt nur, solange der Rechner ohne Konto laeuft und der
  // Teilen-Link ohne Konto aufgeht. Beides steht im Quelltext.
  assert.strictEqual(kacheln[2].zahl, 0);
  assert.ok(/share\?/.test(app) || /share\.html/.test(app),
    "es gibt keinen Teilen-Link mehr -- dann stimmt die Kachel nicht");
  // Kein Weg zu einer Anmeldung. Das Wort selbst darf vorkommen -- "Ohne Login" ist
  // genau die Zusage; ein LINK dorthin waere ihr Gegenteil.
  const ziele = [...start.matchAll(/href="([^"]+)"/g)].map((m) => m[1]);
  const anmeldung = ziele.filter((h) => /login|signin|sign-in|signup|sign-up|register|konto|account/i.test(h));
  assert.deepStrictEqual(anmeldung, [], `die Startseite verlinkt auf eine Anmeldung: ${anmeldung.join(", ")}`);
});

test("jede Zahl steht auch in der englischen Fassung -- oder gar nicht", () => {
  // Die Zahl selbst steht im Markup, nicht im Woerterbuch; uebersetzt wird nur der Text
  // daneben. Genau deshalb muss der englische Text dieselben Begriffe tragen.
  const en = start.slice(start.indexOf("var EN={"));
  const paare = [["kpi1", ["open top", "flat rack", "platform", "reefer"]],
                 ["kpi2", ["millimetre", "source"]],
                 ["kpi3", ["link", "3d"]]];
  for (const [key, woerter] of paare) {
    const m = en.match(new RegExp(`"${key}":\\s*"(.*?)",\\s*"`, "s"));
    assert.ok(m, `${key} fehlt auf Englisch`);
    for (const w of woerter) {
      assert.ok(m[1].toLowerCase().includes(w), `der englische ${key}-Text nennt "${w}" nicht: ${m[1]}`);
    }
  }
});

test("die geloeschten Schluessel sind wirklich weg", () => {
  // "In drei Schritten zum Ladeplan" erzaehlte denselben Ablauf wie "So arbeitet der
  // Rechner". Ein Abschnitt zu loeschen und seine Woerterbucheintraege stehenzulassen ist
  // der uebliche halbe Weg -- i18n-startseite.test.mjs faengt das ab, hier steht der Grund.
  for (const k of ["how_ey", "how_h", "s1_h", "s2_h", "s3_h", "nav_how"]) {
    assert.ok(!start.includes(`"${k}"`), `${k} steht noch in index.html`);
  }
  assert.ok(!start.includes('id="how"'), "der Abschnitt steht noch da");
  assert.ok(!start.includes('href="#how"'), "es zeigt noch ein Link auf den geloeschten Abschnitt");
});
