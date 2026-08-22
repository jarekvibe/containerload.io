// Wissen, was passiert — und einen Weg, es zu sagen.
//
// Ausgangslage: GoatCounter zaehlte nur Seitenaufrufe, und im Rechner gab es keinen Weg,
// etwas zu melden. Damit war weder zu erkennen, ob nach dem Aufruf ueberhaupt etwas
// passiert (tippt jemand eine Ladung ein? rechnet er? teilt er?), noch kam ein Fehler
// anders herein als per Bildschirmfoto, das erst von Hand nachgebaut werden musste.
//
// Beides ist billig zu haben und aendert, woran als naechstes gearbeitet wird. Beides muss
// aber sauber bleiben, und genau das haelt diese Datei fest:
//
//   * Es geht NUR DER NAME DES EREIGNISSES mit — nie ein Mass, ein Gewicht, ein
//     Positionsname. Das ist die Zusage der Datenschutzseite, und sie ist im Code
//     nachpruefbar: jeder Aufruf von zaehl() traegt eine feste Zeichenkette.
//   * Jedes Ereignis zaehlt JE SEITENAUFRUF HOECHSTENS EINMAL. Sonst zaehlt jeder
//     Tastendruck im Mengenfeld eine "Ladung eingegeben".
//   * Der Rueckkanal uebertraegt von sich aus GAR NICHTS: er oeffnet das Mailprogramm des
//     Absenders, und der sieht vor dem Senden, was drinsteht.
//
// node --test test/messen-und-melden.test.mjs
import fs from "node:fs";
import assert from "node:assert";
import test from "node:test";
import { fileURLToPath } from "node:url";
import path from "node:path";

const dir = path.dirname(fileURLToPath(import.meta.url));
const src = fs.readFileSync(path.join(dir, "..", "app.html"), "utf8");
const schnitt = (von, bis) => {
  const a = src.indexOf(von);
  assert.ok(a >= 0, `nicht gefunden: ${von}`);
  const b = src.indexOf(bis, a);
  assert.ok(b > a, `Ende nicht gefunden: ${bis}`);
  return src.slice(a, b);
};

// Die Ereignisse, die es geben soll. Wer eines ergaenzt, faellt hier auf — und muss sich
// dabei die Frage stellen, ob der Name wirklich nichts ueber die Ladung verraet.
const EREIGNISSE = [
  "plan-per-link-geoeffnet", "beispiel-geoeffnet", "ladung-eingegeben", "excel-import",
  "palettierer", "plan-gerechnet", "mehrere-container", "passt-nicht", "empfehlung",
  "manueller-modus", "geteilt", "csv-export", "ladevorschlag", "bild-export", "problem-gemeldet"
];

test("es geht NUR der Name des Ereignisses mit — nie etwas aus der Ladung", () => {
  // Der wichtigste Test dieser Datei. Ein einziges zaehl(name) mit einer Variablen wuerde
  // die Zusage der Datenschutzseite brechen, ohne dass es jemandem auffiele.
  // Die Definition selbst (function zaehl(name)) ist kein Aufruf.
  const aufrufe = [...src.matchAll(/(?<!function )\bzaehl\(([^)]*)\)/g)].map((m) => m[1].trim());
  assert.ok(aufrufe.length >= EREIGNISSE.length, `nur ${aufrufe.length} Zaehl-Aufrufe gefunden`);
  for (const a of aufrufe) {
    assert.match(a, /^"[a-z0-9-]+"$/,
      `zaehl(${a}) — der Wert ist keine feste Zeichenkette. Damit koennte Ladungsinhalt hinausgehen.`);
  }
  const genutzt = [...new Set(aufrufe.map((a) => a.slice(1, -1)))].sort();
  assert.deepStrictEqual(genutzt, EREIGNISSE.slice().sort(),
    "die gezaehlten Ereignisse weichen von der vereinbarten Liste ab");
});

test("jedes Ereignis zaehlt je Seitenaufruf hoechstens einmal", () => {
  const fn = schnitt("function zaehl(name) {", "var homeHref");
  assert.match(fn, /if \(EV_GEZAEHLT\[name\]\) return;/, "der Wiederholungsschutz fehlt");
  assert.match(fn, /EV_GEZAEHLT\[name\] = true;/, "das Ereignis wird nie als gezaehlt vermerkt");
});

test("Ereignisse gehen nicht verloren, solange der Zaehler noch laedt", () => {
  // count.js wird async geladen. Ohne Warteschlange ginge ausgerechnet das erste Ereignis
  // verloren — und das erste ist das wichtigste.
  const fn = schnitt("function zaehl(name) {", "var homeHref");
  assert.match(fn, /EV_WARTEN\.push\(name\)/, "es gibt keine Warteschlange");
  assert.match(fn, /setInterval/, "auf den Zaehler wird nicht gewartet");
  const senden = schnitt("function evAbsenden() {", "function zaehl(name)");
  assert.match(senden, /typeof window\.goatcounter\.count === "function"/, "es wird nicht geprueft, ob der Zaehler ueberhaupt da ist");
  assert.match(senden, /while \(EV_WARTEN\.length\)/, "die Warteschlange wird nie geleert");
});

test("der eingebettete Rechner zaehlt getrennt vom eigenstaendigen", () => {
  // Jeder Startseiten-Besuch laedt den Rechner im iframe mit. Ohne die Trennung waere jede
  // Zahl von diesen Aufrufen verwaessert.
  const senden = schnitt("function evAbsenden() {", "function zaehl(name)");
  assert.match(senden, /EMBEDDED \? "demo\/" : "app\/"/, "beide Faelle zaehlen in denselben Topf");
  assert.match(senden, /event: true/, "es wird als Seitenaufruf statt als Ereignis gezaehlt");
});

test("der Rueckkanal oeffnet eine Mail und uebertraegt von sich aus nichts", () => {
  const fn = schnitt("const meldeProblem = () => {", "const doShare = () =>");
  assert.match(fn, /^[\s\S]*mailto:/, "es wird gar keine Mail geoeffnet");
  assert.ok(!/fetch\(|XMLHttpRequest|navigator\.sendBeacon/.test(fn),
    "der Rueckkanal schickt etwas ohne Zutun des Absenders — genau das soll er nicht");
  // Die Adresse steht im Impressum und wird hier nicht abgeschrieben.
  const imp = fs.readFileSync(path.join(dir, "..", "impressum.html"), "utf8");
  const mail = (imp.match(/mailto:([^"?]+)/) || [])[1];
  assert.ok(mail, "im Impressum steht keine Adresse");
  assert.ok(fn.includes("mailto:" + mail), `der Rueckkanal schreibt an eine andere Adresse als das Impressum (${mail})`);
});

test("die Meldung traegt den Plan — und sagt das auch", () => {
  const fn = schnitt("const meldeProblem = () => {", "const doShare = () =>");
  assert.match(fn, /encodePlanURL\(preset, container, cargo, forceCentered, domain\)/,
    "ohne den Plan-Link muss jeder Fall wieder von Hand nachgebaut werden");
  assert.match(fn, /T\.feedbackPrivacy/, "es steht nicht dabei, dass die Ladung im Link steckt");
  // Lange Adressen schneiden manche Mailprogramme ab. Dann lieber ohne Link als halb.
  assert.match(fn, /if \(mail\.length > \d+\) mail = bauen\(""\)/, "keine Laengenbegrenzung");
});

test("beide Sprachen kennen die neuen Texte", () => {
  for (const key of ["feedback", "feedbackTitle", "feedbackSubject", "feedbackIntro",
                     "feedbackFacts", "feedbackNoLink", "feedbackPrivacy"]) {
    const n = [...src.matchAll(new RegExp(`\\b${key}: "`, "g"))].length;
    assert.strictEqual(n, 2, `${key} steht ${n}× da statt zweimal (DE und EN)`);
  }
});

test("die Datenschutzseite sagt, was gezaehlt wird und was der Rueckkanal tut", () => {
  // Dieselbe Ehrlichkeitsregel wie bei den Zahlen: was die Seite tut, steht dort auch.
  const ds = fs.readFileSync(path.join(dir, "..", "datenschutz.html"), "utf8");
  assert.match(ds, /anonyme Ereignisse/, "die Ereigniszaehlung ist nicht erwaehnt");
  assert.match(ds, /ausschließlich der Name des Ereignisses/, "es steht nicht da, dass nur der Name uebertragen wird");
  assert.match(ds, /Problem melden/, "der Rueckkanal ist nicht erwaehnt");
  assert.match(ds, /nichts automatisch übertragen/, "es steht nicht da, dass von selbst nichts hinausgeht");
});
