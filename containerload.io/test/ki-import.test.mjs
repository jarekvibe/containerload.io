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
import { AKTIONEN_MAX, BILD_MAX, BILD_TYPEN, BRIEF_AUFTRAG, BRIEF_SCHEMA, BRIEF_SPRACHEN, CHAT_AKTION_TYPEN, CHAT_AUFTRAG, CHAT_CONTAINER, CHAT_SCHEMA, KI_AUFTRAG, KI_FOTO_FRAGE, KI_SCHEMA, POSITIONEN_MAX, TEXT_MAX, briefNachricht, chatNachricht, kiNachricht, pruefeAktionen, pruefeBild, pruefeBrief, pruefeChatAntwort, pruefeFakten, pruefePositionen, pruefeVerlauf } from "../../netlify/functions/lib/ki.mjs";

const app = readFileSync(new URL("../app.html", import.meta.url), "utf8");
const fn = readFileSync(new URL("../../netlify/functions/ki-import.mjs", import.meta.url), "utf8");
const fnBrief = readFileSync(new URL("../../netlify/functions/ki-brief.mjs", import.meta.url), "utf8");
const fnChat = readFileSync(new URL("../../netlify/functions/ki-chat.mjs", import.meta.url), "utf8");
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

// ── pruefeBild: der Tuersteher des Foto-Imports (Stufe 2) ───────────────────

test("pruefeBild laesst nur echte, gedeckelte Bilder durch", () => {
  const ok = pruefeBild({ media_type: "image/jpeg", data: "QUJD" });
  assert.deepEqual(ok, { media_type: "image/jpeg", data: "QUJD" });
  assert.ok(pruefeBild({ media_type: "image/png", data: "QUJDRA==" }));
  assert.ok(pruefeBild({ media_type: "image/webp", data: "QUJD" }));
  assert.equal(pruefeBild({ media_type: "image/gif", data: "QUJD" }), null, "nur die Whitelist");
  assert.equal(pruefeBild({ media_type: "image/jpeg", data: "kein base64 !!" }), null);
  assert.equal(pruefeBild({ media_type: "image/jpeg", data: "" }), null);
  assert.equal(pruefeBild({ media_type: "image/jpeg", data: "A".repeat(BILD_MAX + 1) }), null, "Groessendeckel");
  assert.equal(pruefeBild(null), null);
  assert.equal(pruefeBild("data:image/jpeg;base64,abc"), null, "nur die Objekt-Form, nie eine Daten-URL");
  assert.deepEqual(BILD_TYPEN, ["image/jpeg", "image/png", "image/webp"]);
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
  assert.match(KI_AUFTRAG, /Foto oder Bildschirmfoto/, "die Bild-Regel (Stufe 2) fehlt");
  assert.match(KI_AUFTRAG, /weg, statt zu raten/, "unleserliche Bild-Zeilen muessen wegfallen, nicht geraten werden");
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
  assert.match(fn, /pruefeBild/, "Bilder muessen durch den Tuersteher, bevor sie zur KI gehen");
  assert.match(fn, /KI_FOTO_FRAGE/, "die Bild-Frage kommt aus lib/ki.mjs, nicht als zweite Kopie");
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
  const von = app.indexOf("const kiSenden");
  const bis = app.indexOf("const applyImport");
  assert.ok(von > 0 && bis > von, "kiSenden steht nicht mehr vor applyImport");
  const rumpf = app.slice(von, bis);
  assert.match(rumpf, /setImportRows\(rows\)/, "das Ergebnis muss in die Pruef-Tabelle");
  assert.doesNotMatch(rumpf, /setCargo\(/, "KI-Zeilen duerfen den Menschen nicht umgehen");
});

test("alle KI-Bedienstellen sind im eingebetteten Demo aus (EMBEDDED)", () => {
  // Zwei Text-Knoepfe (Eingabe-Stufe und 'nichts erkannt'), ein Foto-Knopf
  const textKnoepfe = [...app.matchAll(/, T\.kiBtn\)/g)];
  assert.equal(textKnoepfe.length, 2, "ein Text-KI-Knopf in der Eingabe-Stufe, einer bei 'nichts erkannt'");
  for (const m of textKnoepfe) {
    const davor = app.slice(Math.max(0, m.index - 260), m.index);
    assert.match(davor, /!EMBEDDED &&/, "der KI-Knopf darf im iframe der Startseite nicht erscheinen");
  }
  const foto = [...app.matchAll(/, T\.kiFotoBtn\)/g)];
  assert.equal(foto.length, 1, "genau ein Foto-Knopf");
  assert.match(app.slice(Math.max(0, foto[0].index - 320), foto[0].index), /!EMBEDDED &&/,
    "auch der Foto-Knopf bleibt dem echten Rechner vorbehalten");
  // Der Einfuege-Weg (Screenshot in die Textarea) laeuft durch kiFoto — und
  // kiFoto prueft EMBEDDED selbst, damit kein Weg am Gate vorbeifuehrt.
  assert.match(app, /const kiFoto = async[^]{0,120}kiBusy \|\| EMBEDDED/,
    "kiFoto muss EMBEDDED selbst pruefen (der Paste-Weg hat keinen Knopf)");
});

test("Foto-Weg: Datei-Feld, Einfuegen und Verkleinern sind verdrahtet", () => {
  assert.match(app, /type: "file", accept: "image\/\*"/, "das versteckte Datei-Feld fehlt");
  assert.match(app, /onPaste:[^}]+indexOf\("image\/"\)/, "eingefuegte Bildschirmfotos muessen erkannt werden");
  const von = app.indexOf("const bildVerkleinern");
  assert.ok(von > 0, "bildVerkleinern fehlt");
  const rumpf = app.slice(von, von + 1600);
  assert.match(rumpf, /1568/, "die Kantenlaenge folgt der Vision-Empfehlung (1568 px)");
  assert.match(rumpf, /toDataURL\("image\/jpeg"/, "gesendet wird ein verkleinertes JPEG, nie das Original");
  assert.match(rumpf, /4 \* 1024 \* 1024/, "die App prueft den Deckel vor dem Senden (wie BILD_MAX)");
  assert.match(app, /zaehl\("ki-import-foto"\)/, "der Foto-Import zaehlt sein eigenes festes Event");
});

test("die Sprachtexte gibt es paarweise (DE und EN)", () => {
  for (const key of ["kiBtn:", "kiLiest:", "kiHinweis:", "kiFehler:", "kiLimit:", "kiLang:", "kiFotoBtn:", "kiLiestFoto:", "kiBildGross:"]) {
    assert.equal(app.split(key).length - 1, 2, `${key} muss in beiden Woerterbuechern stehen`);
  }
});

// ── KI-Brief (Stufe 3): formulieren, nicht rechnen ──────────────────────────

const FAKTEN_OK = {
  sprache: "de", modus: "sea", link: "https://containerload.io/share?c=abc",
  equipment: ["C1 · 40' HC", "C2 · 20' GP"],
  zahlen: { positionen: 2, stueck: 14, gewichtKg: 6588, offen: 0 },
  gruende: ["Das Gewicht teilt die Sendung: C1 trägt 26.400 von 26.600 kg."],
  positionen: ["6× Kisten — 120×80×95 cm, je 245 kg", "8× Kartons — 60×40×40 cm, je 18 kg"],
};

test("pruefeFakten baut die Fakten neu auf und laesst nichts Fremdes durch", () => {
  const ok = pruefeFakten({ ...FAKTEN_OK, extra: "weg", script: "<script>" });
  assert.ok(ok, "gueltige Fakten muessen durch");
  assert.deepEqual(Object.keys(ok).sort(), ["equipment", "gruende", "link", "modus", "positionen", "sprache", "zahlen"]);
  assert.equal(ok.zahlen.gewichtKg, 6588);
  // Deckel: 61. Position faellt, ueberlange Strings werden gekappt
  const viele = pruefeFakten({ ...FAKTEN_OK, positionen: Array(80).fill("1× Kiste — 1×1×1 cm, je 1 kg") });
  assert.equal(viele.positionen.length, 60);
  assert.equal(pruefeFakten({ ...FAKTEN_OK, gruende: ["x".repeat(900)] }).gruende[0].length, 300);
});

test("der Link MUSS auf containerload.io zeigen — sonst ist es ein Spam-Werkzeug", () => {
  assert.ok(pruefeFakten({ ...FAKTEN_OK, link: "https://www.containerload.io/share?c=x" }));
  assert.equal(pruefeFakten({ ...FAKTEN_OK, link: "https://boese-seite.de/share" }), null);
  assert.equal(pruefeFakten({ ...FAKTEN_OK, link: "http://containerload.io/share" }), null, "nur https");
  assert.equal(pruefeFakten({ ...FAKTEN_OK, link: "https://containerload.io.boese.de/x" }), null);
  assert.equal(pruefeFakten({ ...FAKTEN_OK, link: "" }), null);
});

test("pruefeFakten: Sprach-Whitelist, Modus, Pflicht-Positionen, Zahlen-Grenzen", () => {
  assert.deepEqual(BRIEF_SPRACHEN, ["de", "en", "nl"]);
  assert.equal(pruefeFakten({ ...FAKTEN_OK, sprache: "fr" }), null);
  assert.equal(pruefeFakten({ ...FAKTEN_OK, modus: "air" }), null);
  assert.equal(pruefeFakten({ ...FAKTEN_OK, positionen: [] }), null, "ohne Positionen gibt es nichts zu erklaeren");
  assert.equal(pruefeFakten({ ...FAKTEN_OK, zahlen: { ...FAKTEN_OK.zahlen, gewichtKg: -5 } }), null);
  assert.equal(pruefeFakten({ ...FAKTEN_OK, zahlen: { ...FAKTEN_OK.zahlen, stueck: "viele" } }), null);
  assert.equal(pruefeFakten(null), null);
});

test("pruefeBrief: beide Felder Pflicht, begrenzt", () => {
  assert.deepEqual(pruefeBrief({ betreff: " Ladeplan 40' HC ", text: " Guten Tag ... " }), { betreff: "Ladeplan 40' HC", text: "Guten Tag ..." });
  assert.equal(pruefeBrief({ betreff: "", text: "x" }), null);
  assert.equal(pruefeBrief({ betreff: "x", text: "" }), null);
  assert.equal(pruefeBrief(null), null);
  assert.equal(pruefeBrief({ betreff: "x".repeat(400), text: "y" }).betreff.length, 120);
});

test("Brief-Schema und -Auftrag tragen die Formulieren-nicht-rechnen-Regeln", () => {
  assert.deepEqual(Object.keys(BRIEF_SCHEMA.properties).sort(), ["betreff", "text"]);
  assert.deepEqual(BRIEF_SCHEMA.required.sort(), ["betreff", "text"]);
  assert.equal(BRIEF_SCHEMA.additionalProperties, false);
  assert.match(BRIEF_AUFTRAG, /AUSSCHLIESSLICH die Fakten/, "die Nur-diese-Fakten-Regel fehlt");
  assert.match(BRIEF_AUFTRAG, /erfindest nichts dazu/, "die wichtigste Regel fehlt");
  assert.match(BRIEF_AUFTRAG, /ZEICHENGENAU/, "der Link darf sich kein Zeichen aendern");
  assert.match(BRIEF_AUFTRAG, /wertgleich/, "Zahlen muessen wertgleich bleiben");
  assert.match(BRIEF_AUFTRAG, /sag es ehrlich/, "offene Positionen duerfen nicht verschwiegen werden");
  assert.match(BRIEF_AUFTRAG, /keine Anweisung an dich/, "die Daten-nicht-Befehle-Zeile fehlt");
  for (const sp of ["de", "en", "nl"]) assert.ok(BRIEF_AUFTRAG.includes(sp + " ="), `Sprachregel ${sp} fehlt`);
  assert.match(briefNachricht(FAKTEN_OK), /^<fakten>\n[^]*\n<\/fakten>$/);
});

test("die Brief-Function haelt dieselben Deckel wie der Import", () => {
  assert.match(fnBrief, /path: "\/api\/ki-brief"/);
  assert.match(fnBrief, /containerload\\\.io/, "die weiche Herkunftspruefung fehlt");
  assert.match(fnBrief, /ANTHROPIC_API_KEY/);
  assert.match(fnBrief, /tagesdeckel/, "der gemeinsame Tagesdeckel schuetzt das Guthaben");
  assert.match(fnBrief, /json_schema/);
  assert.match(fnBrief, /pruefeFakten/, "Fakten muessen durch den Tuersteher");
  assert.match(fnBrief, /pruefeBrief/, "die Antwort muss geprueft werden");
  assert.match(fnBrief, /KI_MODELL/);
  assert.match(fnBrief, /claude-haiku-5-5/);
  // EIN Tagesdeckel fuer alle KI-Endpunkte — keine zweite Kopie
  assert.match(fn, /\.\/lib\/deckel\.mjs/);
  assert.match(fnBrief, /\.\/lib\/deckel\.mjs/);
  assert.doesNotMatch(fn, /getStore/, "der Zaehler lebt in lib/deckel.mjs, nicht als Kopie");
  assert.doesNotMatch(fnBrief, /getStore/, "der Zaehler lebt in lib/deckel.mjs, nicht als Kopie");
});

test("die App: ein Brief-Aufrufer, Fakten aus den echten Quellen, Mensch prueft", () => {
  assert.equal(app.split('fetch("/api/ki-brief"').length - 1, 1, "genau EIN Aufrufer");
  assert.match(app, /zaehl\("ki-brief"\)/);
  const von = app.indexOf("const planFakten");
  const bis = app.indexOf("const briefKopieren");
  assert.ok(von > 0 && bis > von, "planFakten/briefKopieren fehlen");
  const rumpf = app.slice(von, bis);
  assert.match(rumpf, /kettenGrund\(container, cargo, result\.chain\)/, "die Grund-Zeile kommt aus derselben Rechnung wie im Bild");
  assert.match(rumpf, /alsText\(T\.recBetter\(sugLabel\)\)/,
    "der Empfehlungs-Satz ist derselbe wie im Banner — und wird zu TEXT geplaettet (recBetter traegt ein React-Element)");
  assert.match(rumpf, /link: shareURL/, "der Link ist der echte Teilen-Link");
  // Der Entwurf ist BEARBEITBAR — das ist die Pruef-Tabelle des Briefs
  assert.match(app, /value: briefText, onChange: \(e\) => setBriefText/, "der Entwurf muss ein bearbeitbares Feld sein");
  assert.match(app, /value: briefBetreff, onChange: \(e\) => setBriefBetreff/, "auch der Betreff bleibt in der Hand des Menschen");
  // Nicht im eingebetteten Demo
  const titel = app.indexOf("T.briefTitle)");
  assert.ok(titel > 0);
  assert.match(app.slice(Math.max(0, titel - 700), titel), /!EMBEDDED &&/, "der KI-Brief bleibt dem echten Rechner vorbehalten");
});

test("die Brief-Sprachtexte gibt es paarweise (DE und EN)", () => {
  for (const key of ["briefTitle:", "briefSub:", "briefBtn:", "briefSchreibt:", "briefHinweis:", "briefKopierenBtn:", "briefMail:", "briefNeu:"]) {
    assert.equal(app.split(key).length - 1, 2, `${key} muss in beiden Woerterbuechern stehen`);
  }
});

// ── Lade-Assistent (Stufe 4): Woerterbuch statt Willkuer ────────────────────

test("das Chat-Schema kennt genau die Aktionstypen, die die App ausfuehrt", () => {
  assert.deepEqual(CHAT_AKTION_TYPEN, ["container", "stapeln", "menge", "entfernen", "neu", "drehen"]);
  const item = CHAT_SCHEMA.properties.aktionen.items;
  assert.deepEqual(item.properties.typ.enum, CHAT_AKTION_TYPEN);
  assert.deepEqual(item.required.sort(), Object.keys(item.properties).sort(), "strikt: alle Felder Pflicht");
  assert.equal(item.additionalProperties, false);
  assert.deepEqual(CHAT_SCHEMA.required.sort(), ["aktionen", "antwort"]);
  // Die Container-Whitelist muss die ECHTEN Preset-Namen der App tragen
  for (const n of CHAT_CONTAINER) assert.ok(app.includes(`"${n}"`), `Preset ${n} gibt es in der App nicht`);
});

test("pruefeAktionen: nur Plausibles, Deckel, nach entfernen ist Schluss", () => {
  const voll = { preset: "", position: 0, wert: "", bis_cm: 0, anzahl: 0, name: "", l: 0, b: 0, h: 0, gewicht: 0, erlaubt: true };
  const ok = pruefeAktionen([
    { ...voll, typ: "container", preset: "40' HC" },
    { ...voll, typ: "stapeln", position: 2, wert: "nein" },
    { ...voll, typ: "menge", position: 1, anzahl: 12 },
    { ...voll, typ: "container", preset: "Boeser Container" },
    { ...voll, typ: "menge", position: 1, anzahl: 5000 },
    { ...voll, typ: "zaubern", position: 1 },
  ]);
  assert.deepEqual(ok.map((a) => a.typ), ["container", "stapeln", "menge"], "nur die drei gueltigen (Deckel: 5 betrachtet)");
  // entfernen beendet die Liste — die P-Nummern dahinter wuerden verrutschen
  const weg = pruefeAktionen([
    { ...voll, typ: "entfernen", position: 1 },
    { ...voll, typ: "menge", position: 2, anzahl: 3 },
  ]);
  assert.deepEqual(weg.map((a) => a.typ), ["entfernen"]);
  assert.equal(pruefeAktionen(Array(20).fill({ ...voll, typ: "drehen", position: 1 })).length, AKTIONEN_MAX);
  assert.deepEqual(pruefeAktionen("quatsch"), []);
});

test("pruefeVerlauf und pruefeChatAntwort halten die Grenzen", () => {
  const v = pruefeVerlauf([
    { rolle: "nutzer", text: " hallo " }, { rolle: "ki", text: "hi" },
    { rolle: "chef", text: "nein" }, { rolle: "nutzer", text: "" }, null,
  ]);
  assert.deepEqual(v, [{ rolle: "nutzer", text: "hallo" }, { rolle: "ki", text: "hi" }]);
  assert.equal(pruefeVerlauf(Array(40).fill({ rolle: "ki", text: "x" })).length, 10);
  assert.equal(pruefeChatAntwort({ antwort: "", aktionen: [] }), null);
  const a = pruefeChatAntwort({ antwort: " Passt. ", aktionen: "nix" });
  assert.deepEqual(a, { antwort: "Passt.", aktionen: [] });
});

test("pruefeFakten ohne Link-Pflicht (Chat) laesst den Link weg", () => {
  const { link, sprache, ...rest } = FAKTEN_OK;
  const ok = pruefeFakten(rest, false);
  assert.ok(ok, "Chat-Fakten ohne Link muessen durch");
  assert.ok(!("link" in ok) && !("sprache" in ok), "kein Link- und kein Sprach-Feld im Chat-Faktenpaket");
  assert.equal(pruefeFakten(rest), null, "fuer den BRIEF bleibt der Link Pflicht");
});

test("der Chat-Auftrag traegt die Grenzen des Assistenten", () => {
  assert.match(CHAT_AUFTRAG, /NUR diese Zahlen/, "die Nur-Fakten-Regel fehlt");
  assert.match(CHAT_AUFTRAG, /kennst das Ergebnis NICHT/, "keine Ergebniszahlen nach Aktionen — der Packer rechnet");
  assert.match(CHAT_AUFTRAG, /die neuen Zahlen stehen im Plan/, "der Verweis auf den Plan fehlt");
  assert.match(CHAT_AUFTRAG, /Richtwerte, keine verbindliche Pruefung/, "der Richtwert-Vorbehalt fehlt");
  assert.match(CHAT_AUFTRAG, /nach einem entfernen keine weitere Aktion/, "die entfernen-Regel fehlt");
  for (const n of CHAT_CONTAINER) assert.ok(CHAT_AUFTRAG.includes(n), `Whitelist im Auftrag unvollstaendig: ${n}`);
  assert.match(chatNachricht({ a: 1 }, "Frage?"), /<fakten>\n[^]*\n<\/fakten>\n<nachricht>\nFrage\?\n<\/nachricht>/);
});

test("die Chat-Function haelt dieselben Deckel wie die anderen", () => {
  assert.match(fnChat, /path: "\/api\/ki-chat"/);
  assert.match(fnChat, /containerload\\\.io/);
  assert.match(fnChat, /ANTHROPIC_API_KEY/);
  assert.match(fnChat, /tagesdeckel/);
  assert.match(fnChat, /json_schema/);
  assert.match(fnChat, /pruefeFakten\(body\.fakten, false\)/, "Chat-Fakten ohne Link-Pflicht");
  assert.match(fnChat, /pruefeVerlauf/);
  assert.match(fnChat, /pruefeChatAntwort/, "die Antwort muss durch die Pruefung");
  assert.match(fnChat, /KI_MODELL/);
  assert.doesNotMatch(fnChat, /getStore/, "der Zaehler lebt in lib/deckel.mjs");
});

test("die App wendet Aktionen nur geprueft und mit Undo an", () => {
  assert.equal(app.split('fetch("/api/ki-chat"').length - 1, 1, "genau EIN Aufrufer");
  assert.match(app, /zaehl\("ki-chat"\)/);
  const von = app.indexOf("const kiAktionenAnwenden");
  const bis = app.indexOf("const chatSenden");
  assert.ok(von > 0 && bis > von, "kiAktionenAnwenden fehlt oder steht falsch");
  const rumpf = app.slice(von, bis);
  assert.match(rumpf, /domain === "sea" && PRESETS\[a\.preset\]/, "Container nur im See-Modus und nur echte PRESETS-Namen");
  assert.match(rumpf, /merk\(cargo\);\s*setCargo\(neu\)/, "Aenderungen laufen ueber merk + setCargo — Strg+Z nimmt sie zurueck");
  assert.match(rumpf, /splice\(i, 1\);[^]{0,120}break;/, "nach entfernen ist Schluss (P-Nummern verrutschen sonst)");
  assert.doesNotMatch(rumpf, /eval|innerHTML/, "keine wilden Wege");
  // Fakten: die P-Nummer ist der UNGEFILTERTE cargo-Index — sonst zeigen Aktionen daneben
  assert.match(app, /cargo\.map\(\(c, ci\) => `P\$\{ci \+ 1\}/, "P-Nummer muss der cargo-Index sein");
});

test("der Chat ist im Demo aus und traegt die Ehrlichkeits-Fussnote", () => {
  const knopf = app.indexOf("T.chatBtn)");
  assert.ok(knopf > 0);
  assert.match(app.slice(Math.max(0, knopf - 900), knopf), /!EMBEDDED &&/, "der Knopf bleibt dem echten Rechner vorbehalten");
  assert.match(app, /chatOffen && !EMBEDDED &&/, "auch das Panel selbst ist im iframe aus");
  for (const key of ["chatBtn:", "chatTitle:", "chatIntro:", "chatPh:", "chatSenden:", "chatDenkt:", "chatHinweis:", "chatChipContainer:", "chatChipStapeln:", "chatChipMenge:", "chatChipDrehen:", "chatChipWeg:", "chatChipNeu:"]) {
    assert.equal(app.split(key).length - 1, 2, `${key} muss in beiden Woerterbuechern stehen`);
  }
});

// ── Datenschutz: der Fall ist benannt, bevor er live geht ───────────────────

test("die Datenschutzseite nennt den KI-Import als Klick-Ausnahme — samt Foto-Weg", () => {
  assert.match(ds, /KI-Funktionen \(Anthropic Claude\)/, "eigener Abschnitt fehlt");
  assert.match(ds, /nichts übertragen, solange du nicht einen dieser Knöpfe drückst/,
    "es steht nicht da, dass ohne Klick nichts hinausgeht");
  assert.match(ds, /„Foto \/ Screenshot“/, "der Foto-Knopf ist nicht benannt");
  assert.match(ds, /Bildschirmfoto in das Eingabefeld einfügst/, "der Einfuege-Weg ist nicht benannt");
  assert.match(ds, /auf deinem Gerät verkleinert/, "dass das Bild vorher verkleinert wird, gehoert dazu");
  assert.match(ds, /genau drei Fälle/, "Abschnitt 2 zaehlt den neuen Fall nicht mit");
  assert.match(ds, /nicht zum Training/, "die Trainings-Zusage von Anthropic fehlt");
  // Stufe 3: der KI-Brief ueberträgt den PLAN (samt Positionsbezeichnungen) — benannt
  assert.match(ds, /„KI-Brief zum Plan“/, "der KI-Brief ist nicht benannt");
  assert.match(ds, /deine Positionsbezeichnungen/, "dass Positionsnamen mitgehen, muss dastehen");
  assert.match(ds, /bearbeitbaren Feld/, "dass der Mensch den Entwurf vor dem Senden sieht, gehoert dazu");
  // Stufe 4: der Assistent ueberträgt Verlauf + Plan je Nachricht — benannt
  assert.match(ds, /Lade-Assistent/, "der Assistent ist nicht benannt");
  assert.match(ds, /der bisherige Verlauf dieser Unterhaltung/, "dass der Verlauf mitgeht, muss dastehen");
  assert.match(ds, /mit „Rückgängig“ \(Strg\+Z\) zurücknehmbar/, "dass Aenderungen zuruecknehmbar sind, gehoert dazu");
});
