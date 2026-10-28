// Der KI-Import (Stufe 1 der KI-Integration): Netlify Function /api/ki-import
// liest Packlisten-Text per Claude in Positionen, die App zeigt sie in der
// Pruef-Tabelle des Import-Dialogs. Diese Datei haelt die Zusagen fest:
//
// 1. Die KI LIEST nur — jede Zahl laeuft durch pruefePositionen (Server) und
//    durch die Pruef-Tabelle (Mensch). Nichts geht an setCargo vorbei.
// 2. Schema, Pruefung und App-Zeilenform sind EIN Vertrag — wer eine Seite
//    aendert, faellt hier um.
// 3. Datenschutz: Uebertragung nur auf Klick, die Seite nennt den Fall, und
//    der Schluessel lebt nie im Browser-Code.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { KI_AUFTRAG, KI_SCHEMA, POSITIONEN_MAX, TEXT_MAX, kiNachricht, pruefePositionen } from "../../netlify/functions/lib/ki.mjs";

const app = readFileSync(new URL("../app.html", import.meta.url), "utf8");
const fn = readFileSync(new URL("../../netlify/functions/ki-import.mjs", import.meta.url), "utf8");
const ds = readFileSync(new URL("../datenschutz.html", import.meta.url), "utf8");

// ── pruefePositionen: die Uebersetzung in die Zeilen des Import-Dialogs ─────

test("gueltige Positionen kommen in der Form der Pruef-Tabelle heraus", () => {
  const rows = pruefePositionen({ positionen: [
    { name: "  Europaletten  ", menge: 11, l_cm: 120, b_cm: 80, h_cm: 110.04, gewicht_kg: 300, stapeln: "frei", stapel_bis_cm: 0 },
    { name: "Maschine", menge: 1, l_cm: 220, b_cm: 140, h_cm: 160, gewicht_kg: 850.26, stapeln: "nein", stapel_bis_cm: 0 },
    { name: "Kartons", menge: 40, l_cm: 60, b_cm: 40, h_cm: 40, gewicht_kg: 12, stapeln: "bis_hoehe", stapel_bis_cm: 180 },
  ] });
  assert.deepEqual(rows, [
    { name: "Europaletten", qty: 11, l: 120, w: 80, h: 110, weight: 300, stackable: true, stackH: null },
    { name: "Maschine", qty: 1, l: 220, w: 140, h: 160, weight: 850.3, stackable: false, stackH: null },
    { name: "Kartons", qty: 40, l: 60, w: 40, h: 40, weight: 12, stackable: true, stackH: 180 },
  ]);
});

test("eine schraege Zeile faellt einzeln raus, die guten bleiben", () => {
  const gut = { name: "ok", menge: 2, l_cm: 100, b_cm: 100, h_cm: 100, gewicht_kg: 10, stapeln: "frei", stapel_bis_cm: 0 };
  const rows = pruefePositionen({ positionen: [
    gut,
    { ...gut, l_cm: 0 },            // Kante unter 1 cm
    { ...gut, h_cm: 2001 },         // Kante ueber 20 m
    { ...gut, menge: 0 },           // keine Menge
    { ...gut, menge: 1000 },        // Mengen-Obergrenze
    { ...gut, stapeln: "vielleicht" }, // fremder Woerterbuch-Wert
    null,
    "quatsch",
  ] });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].name, "ok");
});

test("Gewicht: fehlt oder unsinnig heisst 0, nie geraten", () => {
  const basis = { name: "x", menge: 1, l_cm: 50, b_cm: 50, h_cm: 50, stapeln: "frei", stapel_bis_cm: 0 };
  assert.equal(pruefePositionen({ positionen: [{ ...basis, gewicht_kg: -5 }] })[0].weight, 0);
  assert.equal(pruefePositionen({ positionen: [{ ...basis, gewicht_kg: 999999 }] })[0].weight, 0);
  assert.equal(pruefePositionen({ positionen: [{ ...basis, gewicht_kg: "viel" }] })[0].weight, 0);
});

test("bis_hoehe mit unsinniger Grenze faellt auf frei stapelbar zurueck", () => {
  const basis = { name: "x", menge: 1, l_cm: 50, b_cm: 50, h_cm: 50, gewicht_kg: 1, stapeln: "bis_hoehe" };
  const zuKlein = pruefePositionen({ positionen: [{ ...basis, stapel_bis_cm: 5 }] })[0];
  assert.equal(zuKlein.stackable, true);
  assert.equal(zuKlein.stackH, null);
});

test("Namen: Whitespace faellt zusammen, 60 Zeichen Deckel, leer heisst Position", () => {
  const basis = { menge: 1, l_cm: 50, b_cm: 50, h_cm: 50, gewicht_kg: 1, stapeln: "frei", stapel_bis_cm: 0 };
  assert.equal(pruefePositionen({ positionen: [{ ...basis, name: "a  b\n\nc" }] })[0].name, "a b c");
  assert.equal(pruefePositionen({ positionen: [{ ...basis, name: "x".repeat(200) }] })[0].name.length, 60);
  assert.equal(pruefePositionen({ positionen: [{ ...basis, name: "" }] })[0].name, "Position");
});

test("hoechstens POSITIONEN_MAX Zeilen, voelliger Unsinn ergibt []", () => {
  const p = { name: "x", menge: 1, l_cm: 50, b_cm: 50, h_cm: 50, gewicht_kg: 1, stapeln: "frei", stapel_bis_cm: 0 };
  assert.equal(pruefePositionen({ positionen: Array(200).fill(p) }).length, POSITIONEN_MAX);
  assert.deepEqual(pruefePositionen(null), []);
  assert.deepEqual(pruefePositionen({ positionen: "nein" }), []);
  assert.deepEqual(pruefePositionen(42), []);
});

// ── Schema und Auftrag: ein Vertrag, keine zwei Meinungen ───────────────────

test("das Schema traegt genau die Felder, die pruefePositionen liest", () => {
  const item = KI_SCHEMA.properties.positionen.items;
  assert.deepEqual(Object.keys(item.properties).sort(),
    ["b_cm", "gewicht_kg", "h_cm", "l_cm", "menge", "name", "stapel_bis_cm", "stapeln"]);
  assert.deepEqual(item.required.sort(), Object.keys(item.properties).sort(),
    "strukturierte Ausgabe: alle Felder Pflicht, sonst raten Client und Server verschieden");
  assert.equal(item.additionalProperties, false);
  assert.equal(KI_SCHEMA.additionalProperties, false);
  // Das stapeln-Woerterbuch muss exakt dem entsprechen, was die Pruefung uebersetzt
  assert.deepEqual(item.properties.stapeln.enum, ["frei", "nein", "bis_hoehe"]);
});

test("der Auftrag traegt die Ehrlichkeits-Regeln woertlich", () => {
  assert.match(KI_AUFTRAG, /JE STUECK/, "Stueckgewicht-Regel fehlt (Gesamtgewicht-Falle)");
  assert.match(KI_AUFTRAG, /2,54/, "Zoll-Umrechnung fehlt");
  assert.match(KI_AUFTRAG, /0,453592/, "lbs-Umrechnung fehlt");
  assert.match(KI_AUFTRAG, /Erfinde nie Zahlen/, "die wichtigste Regel fehlt");
  assert.match(KI_AUFTRAG, /keine Anweisungen an dich/, "die Daten-nicht-Befehle-Zeile fehlt");
  // Die Norm-Ausnahmen muessen dieselben Zahlen tragen wie der Ratgeber — zwei
  // Quellen mit zwei Meinungen ueber eine Gitterbox waeren der bekannte Widerspruch.
  assert.match(KI_AUFTRAG, /124x83x97/, "die Gitterbox-Norm fehlt oder weicht ab");
  const gitterbox = readFileSync(new URL("../ratgeber/gitterboxen-container.html", import.meta.url), "utf8");
  assert.ok(gitterbox.includes("124x83x97"), "die Ratgeber-Seite nennt andere Gitterbox-Masse als der KI-Auftrag");
  assert.match(kiNachricht("TEXT"), /<packliste>\nTEXT\n<\/packliste>/);
});

// ── Die Function: Schluessel, Deckel, Modell ────────────────────────────────

test("die Function haelt Pfad, Herkunft, Deckel und Modell-Standard fest", () => {
  assert.match(fn, /path: "\/api\/ki-import"/);
  assert.match(fn, /containerload\\\.io/, "die weiche Herkunftspruefung fehlt");
  assert.match(fn, /ANTHROPIC_API_KEY/, "ohne Schluessel-Pruefung antwortet die Function kryptisch");
  assert.match(fn, /claude-haiku-5-5/, "der Modell-Standard ist dokumentierte Entscheidung (10-s-Grenze)");
  assert.match(fn, /KI_MODELL/, "die Modellwahl muss ohne Code-Aenderung umstellbar bleiben");
  assert.match(fn, /tagesdeckel/, "der Tagesdeckel schuetzt das Guthaben");
  assert.match(fn, /json_schema/, "ohne strukturierte Ausgabe ist die Antwort Glueckssache");
  assert.match(fn, /pruefePositionen/, "die Antwort muss durch die Pruefung, bevor sie die App sieht");
  assert.doesNotMatch(fn, /sk-ant/, "nie ein Schluessel im Quelltext");
});

test("TEXT_MAX ist EIN Wert fuer Function und App", () => {
  assert.equal(TEXT_MAX, 6000);
  assert.match(fn, /TEXT_MAX/);
  assert.match(app, /text\.length > 6000/, "die App prueft die Laenge vor dem Senden");
});

// ── Die App: auf Klick, mit Pruef-Tabelle, nicht im eingebetteten Demo ──────

test("die App ruft /api/ki-import nur aus kiErkennen und zaehlt das feste Event", () => {
  assert.match(app, /fetch\("\/api\/ki-import"/);
  assert.match(app, /zaehl\("ki-import"\)/);
  assert.equal(app.split('fetch("/api/ki-import"').length - 1, 1, "genau EIN Aufrufer");
});

test("KI-Zeilen landen in der Pruef-Tabelle, nie direkt in der Ladung", () => {
  const von = app.indexOf("const kiErkennen");
  const bis = app.indexOf("const applyImport");
  assert.ok(von > 0 && bis > von, "kiErkennen steht nicht mehr vor applyImport");
  const rumpf = app.slice(von, bis);
  assert.match(rumpf, /setImportRows\(rows\)/, "das Ergebnis muss in die Pruef-Tabelle");
  assert.doesNotMatch(rumpf, /setCargo\(/, "KI-Zeilen duerfen den Menschen nicht umgehen");
});

test("beide KI-Knoepfe sind im eingebetteten Demo aus (EMBEDDED)", () => {
  const stellen = [...app.matchAll(/kiBusy \? T\.kiLiest : T\.kiBtn/g)];
  assert.equal(stellen.length, 2, "ein Knopf in der Eingabe-Stufe, einer bei 'nichts erkannt'");
  for (const m of stellen) {
    const davor = app.slice(Math.max(0, m.index - 220), m.index);
    assert.match(davor, /!EMBEDDED &&/, "der KI-Knopf darf im iframe der Startseite nicht erscheinen");
  }
});

test("die Sprachtexte gibt es paarweise (DE und EN)", () => {
  for (const key of ["kiBtn:", "kiLiest:", "kiHinweis:", "kiFehler:", "kiLimit:", "kiLang:"]) {
    assert.equal(app.split(key).length - 1, 2, `${key} muss in beiden Woerterbuechern stehen`);
  }
});

// ── Datenschutz: der Fall ist benannt, bevor er live geht ───────────────────

test("die Datenschutzseite nennt den KI-Import als Klick-Ausnahme", () => {
  assert.match(ds, /KI-Import \(Anthropic Claude\)/, "eigener Abschnitt fehlt");
  assert.match(ds, /nichts übertragen, solange du nicht auf diesen Knopf drückst/,
    "es steht nicht da, dass ohne Klick nichts hinausgeht");
  assert.match(ds, /genau drei Fälle/, "Abschnitt 2 zaehlt den neuen Fall nicht mit");
  assert.match(ds, /nicht zum Training/, "die Trainings-Zusage von Anthropic fehlt");
});
