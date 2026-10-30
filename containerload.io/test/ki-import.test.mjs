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
  assert.deepEqual(CHAT_AKTION_TYPEN, ["container", "stapeln", "menge", "entfernen", "neu", "drehen", "maxzahl", "leeren"]);
  const item = CHAT_SCHEMA.properties.aktionen.items;
  assert.deepEqual(item.properties.typ.enum, CHAT_AKTION_TYPEN);
  assert.deepEqual(item.required.sort(), Object.keys(item.properties).sort(), "strikt: alle Felder Pflicht");
  assert.equal(item.additionalProperties, false);
  assert.deepEqual(CHAT_SCHEMA.required.sort(), ["aktionen", "antwort"]);
  // Bug 1: die Maximal-Rechnung kennt hypothetische Regeln (nur fuer diese Rechnung).
  assert.deepEqual(item.properties.annahme_stapeln.enum, ["wie_plan", "nein", "frei", "bis_hoehe"]);
  assert.deepEqual(item.properties.annahme_drehen.enum, ["wie_plan", "ja", "nein"]);
  assert.ok(item.properties.annahme_bis_cm, "annahme_bis_cm fehlt");
  assert.doesNotMatch(CHAT_SCHEMA.properties.antwort.description, /Zielsprache/, "die Antwortsprache ist die des Nutzers, nicht die UI-Sprache");
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
  // maxzahl ist eine reine Rechnung: ohne Bedingung reist nur die P-Nummer mit.
  assert.deepEqual(pruefeAktionen([{ ...voll, typ: "maxzahl", position: 3 }]), [{ typ: "maxzahl", position: 3 }]);
  assert.deepEqual(pruefeAktionen([{ ...voll, typ: "maxzahl", position: 0 }]), [], "ohne P-Nummer und ohne Masse keine Rechnung");
  // Bug 1 (30.10.26): „Wie viele passen, wenn sie NICHT stapelbar sind?" rechnete mit der
  // Stapel-Einstellung der Position. Die Bedingung aus der Frage reist jetzt als Annahme mit.
  const ohne = { ...voll, annahme_stapeln: "wie_plan", annahme_bis_cm: 0, annahme_drehen: "wie_plan" };
  assert.deepEqual(pruefeAktionen([{ ...ohne, typ: "maxzahl", position: 1, annahme_stapeln: "nein" }]),
    [{ typ: "maxzahl", position: 1, stapeln: "nein" }]);
  assert.deepEqual(pruefeAktionen([{ ...ohne, typ: "maxzahl", position: 1, annahme_stapeln: "bis_hoehe", annahme_bis_cm: 180, annahme_drehen: "nein", preset: "40' GP" }]),
    [{ typ: "maxzahl", position: 1, stapeln: "bis_hoehe", bis_cm: 180, drehen: false, preset: "40' GP" }]);
  assert.deepEqual(pruefeAktionen([{ ...ohne, typ: "maxzahl", position: 1, annahme_stapeln: "bis_hoehe", annahme_bis_cm: 3 }]),
    [{ typ: "maxzahl", position: 1 }], "eine unplausible Hoehengrenze faellt weg, statt geraten zu werden");
  assert.deepEqual(pruefeAktionen([{ ...ohne, typ: "maxzahl", position: 1, preset: "Boeser Container" }]),
    [{ typ: "maxzahl", position: 1 }], "fremde Container-Namen reisen nicht mit");
  // Ware ausserhalb des Plans: Masse direkt bei der Rechnung, der Plan bleibt unberuehrt.
  assert.deepEqual(pruefeAktionen([{ ...ohne, typ: "maxzahl", position: 0, name: "Gitterbox", l: 124, b: 83, h: 97, gewicht: 85 }]),
    [{ typ: "maxzahl", ware: { name: "Gitterbox", l: 124, b: 83, h: 97, gewicht: 85 } }]);
  // leeren raeumt den Plan ab — aber NUR als erste Aktion: danach zeigten alle
  // P-Nummern auf eine Liste, die es nicht mehr gibt (Jareks 54-Paletten-Fall:
  // Maximalmenge wurde in einen Plan mit Bestand gemischt).
  assert.deepEqual(pruefeAktionen([{ ...voll, typ: "leeren" }, { ...voll, typ: "neu", name: "Europalette", l: 120, b: 80, h: 100, gewicht: 25, anzahl: 1 }]).map((a) => a.typ), ["leeren", "neu"]);
  assert.deepEqual(pruefeAktionen([{ ...voll, typ: "menge", position: 1, anzahl: 5 }, { ...voll, typ: "leeren" }]).map((a) => a.typ), ["menge"], "leeren nach anderen Aktionen wird verworfen");
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
  // Der befund (Maxzahl-Saetze des Rechners) reist nur im Chat-Nachzug mit — als
  // Whitelist-Neuaufbau mit Deckel, und im Brief-Pfad gar nicht.
  const mitBefund = pruefeFakten({ ...rest, befund: [" P1: maximal 25 Stueck ", 7, "", "x".repeat(500)] }, false);
  assert.deepEqual(mitBefund.befund, ["P1: maximal 25 Stueck", "x".repeat(300)], "300 Zeichen: der Satz nennt auch seine Bedingungen");
  assert.equal(pruefeFakten(rest, false).befund, void 0, "ohne befund-Feld kein befund");
  const brief = pruefeFakten({ ...FAKTEN_OK, befund: ["schmuggel"] });
  assert.ok(brief && !("befund" in brief), "der Brief kennt keinen befund");
});

test("der Chat-Auftrag traegt die Grenzen des Assistenten", () => {
  assert.match(CHAT_AUFTRAG, /NUR diese Zahlen/, "die Nur-Fakten-Regel fehlt");
  assert.match(CHAT_AUFTRAG, /kennst das Ergebnis NICHT/, "keine Ergebniszahlen nach Aktionen — der Packer rechnet");
  assert.match(CHAT_AUFTRAG, /die neuen Zahlen stehen im Plan/, "der Verweis auf den Plan fehlt");
  assert.match(CHAT_AUFTRAG, /Richtwerte, keine verbindliche Pruefung/, "der Richtwert-Vorbehalt fehlt");
  assert.match(CHAT_AUFTRAG, /nach einem entfernen keine weitere Aktion/, "die entfernen-Regel fehlt");
  assert.match(CHAT_AUFTRAG, /Du bist Stevie/, "die KI kennt ihren Namen nicht");
  assert.match(CHAT_AUFTRAG, /Strg\+Z/, "der Hinweis auf das Ruecknehmen fehlt im Auftrag");
  assert.match(CHAT_AUFTRAG, /im Verlauf oder in den Fakten/, "die Nutze-den-Kontext-Regel fehlt");
  // maxzahl laesst den RECHNER das Maximum ermitteln (Jareks Befund 'Wieso weiss er nicht,
  // dass 25 reinpassen?'), die Rechner-Meldung bringt Stevie die echten Zahlen.
  assert.match(CHAT_AUFTRAG, /maxzahl \(position\)/, "die maxzahl-Aktion ist nicht erklaert");
  assert.match(CHAT_AUFTRAG, /nimm IMMER maxzahl/, "Wie-viele-passen-Fragen muessen auf maxzahl zeigen");
  assert.match(CHAT_AUFTRAG, /aus fakten und rechenergebnisse/, "die Antwort muss aus fakten und rechenergebnisse kommen");
  assert.match(CHAT_AUFTRAG, /ECHTE Ergebnisse des Rechners/, "die Ergebnisse muessen als echt ausgewiesen sein");
  assert.match(CHAT_AUFTRAG, /FASSE DICH KURZ/, "die Kuerze-Regel fehlt");
  assert.match(CHAT_AUFTRAG, /ALLEIN in einem leeren Container/, "die Isolation der Rechnung ist nicht erklaert");
  assert.match(CHAT_AUFTRAG, /mische die Maximalmenge NIE ungefragt/, "die Bestand-Misch-Sperre fehlt");
  assert.match(CHAT_AUFTRAG, /leeren nur als ERSTE Aktion/, "die leeren-Regel fehlt");
  assert.match(CHAT_AUFTRAG, /missbrauche keine vorhandene Position als Naeherung/, "fremde Ware darf keine vorhandene Position missbrauchen");
  // Bug-Liste 30.10.26 ─────────────────────────────────────────────────────────────
  // Bug 1: Bedingungen aus der Frage MUESSEN als Annahme in die Rechnung — und der Plan
  // bleibt bei Fragen unveraendert (frueher: 'Hilf durch Handeln', die Zahl wurde
  // eingetragen; jetzt aendert Stevie den Plan nur auf ausdruecklichen Wunsch).
  assert.match(CHAT_AUFTRAG, /MUSST du sie als Annahme mitgeben/, "Bedingungen aus der Frage muessen in die Rechnung");
  assert.match(CHAT_AUFTRAG, /'nur auf den Boden'[^.]*= annahme_stapeln nein/, "'nur auf den Boden' muss 'nicht stapelbar' heissen");
  assert.match(CHAT_AUFTRAG, /Den Plan aenderst du NUR, wenn der Nutzer es ausdruecklich verlangt/, "Fragen duerfen den Plan nicht aendern");
  assert.match(CHAT_AUFTRAG, /laesst den Plan, wie er ist/);
  assert.match(CHAT_AUFTRAG, /nenne in deiner Antwort NUR diese Bedingungen und erfinde keine dazu/, "Stevie darf nur benutzte Bedingungen nennen");
  assert.doesNotMatch(CHAT_AUFTRAG, /Hilf durch Handeln|setze sie um|direkt mit aus/, "die alte Eintragen-statt-Antworten-Regel ist zurueck");
  // Bug 2: nach jeder Rechnung die Zahl — oder ehrlich sagen, was fehlt.
  assert.match(CHAT_AUFTRAG, /Auf eine Rechner-Meldung antwortest du IMMER mit der konkreten Zahl/, "die Zahl muss genannt werden");
  assert.match(CHAT_AUFTRAG, /tu nie so, als haettest du gerechnet/, "Stevie darf keine Rechnung vortaeuschen");
  // Bug 3: die Sprache der letzten Nutzernachricht, nicht die der Oberflaeche.
  assert.match(CHAT_AUFTRAG, /Sprache der letzten Nachricht, die der Nutzer selbst geschrieben hat/, "die Sprachregel fehlt");
  assert.match(CHAT_AUFTRAG, /auch in der Ankuendigung/, "auch die Ankuendigung muss in der Nutzersprache sein");
  assert.doesNotMatch(CHAT_AUFTRAG, /Zielsprache ist das Feld sprache/, "die UI-Sprache ist nur noch Ersatz");
  // Bug 4: keine internen Begriffe in den Antworten.
  assert.match(CHAT_AUFTRAG, /befund, Probe, Nachzug, Rechner-Meldung, fakten, rechenergebnisse/, "die Liste der verbotenen Begriffe fehlt");
  assert.match(CHAT_AUFTRAG, /Laut Berechnung/, "der Ersatz 'Laut Berechnung' fehlt");
  for (const n of CHAT_CONTAINER) assert.ok(CHAT_AUFTRAG.includes(n), `Whitelist im Auftrag unvollstaendig: ${n}`);
  assert.match(chatNachricht({ a: 1 }, "Frage?"), /<fakten>\n[^]*\n<\/fakten>\n<nachricht>\nFrage\?\n<\/nachricht>/);
  // Bug 4: das Modell sieht den befund als 'rechenergebnisse' — das interne Wort kommt
  // im Eingang gar nicht mehr vor. Bug 3: die Rechner-Meldung ist keine Nutzernachricht.
  const mitErg = chatNachricht({ sprache: "en", befund: ["P1: maximal 11 Stueck"] }, "Rechner-Meldung", true);
  assert.match(mitErg, /"rechenergebnisse":\["P1: maximal 11 Stueck"\]/);
  assert.doesNotMatch(mitErg, /befund/);
  assert.match(mitErg, /<rechner_meldung>\nRechner-Meldung\n<\/rechner_meldung>$/);
  assert.doesNotMatch(mitErg, /<nachricht>/);
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
  // Zwei Stevie-Antworten in Folge (Ankuendigung + Nachzug) muessen zu EINEM
  // assistant-Zug zusammengelegt werden — die API verlangt den Rollenwechsel.
  assert.match(fnChat, /letzte\.role === m\.role/, "gleiche Rollen in Folge werden nicht zusammengelegt");
  // Bug 3: die Rechner-Meldung der App wird als solche markiert, nicht als Nutzernachricht.
  assert.match(fnChat, /ausRechner = body\.nachzug === true/);
  assert.match(fnChat, /chatNachricht\(\{ sprache, \.\.\.fakten \}, frage, ausRechner\)/);
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
  assert.match(app, /cargo\.map\(\(c, ci\) => \{/, "P-Nummer muss der cargo-Index sein (ungefiltertes map)");
  assert.match(app, /return `P\$\{ci \+ 1\}/, "P-Nummer muss der cargo-Index sein");
  assert.match(app, /verladen \$\{je\.loaded\} von \$\{je\.total\}/, "die Verladen-Zahl des Packers fehlt in den Fakten");
});

test("der Chat ist im Demo aus und traegt die Ehrlichkeits-Fussnote", () => {
  const knopf = app.indexOf("T.chatBtn)");
  assert.ok(knopf > 0);
  assert.match(app.slice(Math.max(0, knopf - 900), knopf), /!EMBEDDED &&/, "der Knopf bleibt dem echten Rechner vorbehalten");
  assert.match(app, /chatOffen && !EMBEDDED &&/, "auch das Panel selbst ist im iframe aus");
  for (const key of ["chatBtn:", "chatTitle:", "chatRolle:", "chatIntro:", "chatPh:", "chatSenden:", "chatDenkt:", "chatHinweis:", "chatChipContainer:", "chatChipStapeln:", "chatChipMenge:", "chatChipDrehen:", "chatChipWeg:", "chatChipNeu:", "chatChipMax:", "chatChipMaxErg:", "chatChipMaxFehl:", "chatBed:", "chatChipLeer:", "chatKlein:", "chatGross:"]) {
    assert.equal(app.split(key).length - 1, 2, `${key} muss in beiden Woerterbuechern stehen`);
  }
});

test("der Nachzug bringt Stevie die frischen Zahlen des Packers", () => {
  // Jareks Live-Befund: Stevie konnte '25 Paletten passen' nie sagen, weil er das
  // Ergebnis seiner Aktionen nie sah. Jetzt meldet sich die App nach Aktionen EINMAL
  // automatisch mit frischen Fakten — und bei maxzahl rechnet packCargo die Probe,
  // ohne den Plan anzufassen. Der Nachzug selbst darf keinen weiteren ausloesen.
  assert.match(app, /const CHAT_NACHZUG = "Rechner-Meldung der App \(keine Nutzernachricht\):/, "die Rechner-Meldung fehlt");
  assert.doesNotMatch(app.slice(app.indexOf("const CHAT_NACHZUG"), app.indexOf("const CHAT_NACHZUG") + 600), /befund|Nachzug vom/, "die Meldung selbst darf kein internes Wort vorsagen");
  assert.match(app, /nachzugRef\.current = \{ probe: erg\.probe, tiefe: tiefe \+ 1, ohneKi: tiefe >= 2 \}/, "der Nachzug wird nicht angestossen");
  // Bug 1: gerechnet wird ueber maxProbe — mit den Annahmen aus der Frage, auf einer Kopie.
  assert.match(app, /const m = maxProbe\(ziel, item, pr\);/, "die Maximal-Rechnung laeuft nicht ueber maxProbe");
  assert.match(app, /gerechnet mit: \$\{bed\.join\(", "\)\}/, "der Ergebnissatz nennt seine Bedingungen nicht");
  // Bug 2: die Zahl steht als Chip unter der Antwort — auch wenn Stevie sie nicht nennt,
  // und auch am Ende der Kette (ohneKi), wo die App Stevie nicht mehr fragt.
  assert.match(app, /T\.chatChipMaxErg\(label, /, "der Ergebnis-Chip fehlt");
  assert.match(app, /chips: chips\.filter\(\(x, ix\) => chips\.indexOf\(x\) === ix\)/, "dieselbe Rechnung steht mehrfach als Chip da");
  assert.match(app, /if \(n\.ohneKi\) \{ setChatBusy\(false\); return; \}/, "am Ende der Kette wird nicht mehr gerechnet");
  assert.match(app, /\|\| erg\.probe\.length\) \{/, "angeforderte Rechnungen laufen am Ende der Kette nicht");
  // Bug 3: die App markiert ihre Meldung, damit sie nicht die Antwortsprache bestimmt.
  assert.match(app, /frage, nachzug: tiefe > 0 \}\)/, "die Rechner-Meldung wird nicht markiert");
  assert.match(app, /\}, \[result, nachzugTick\]\);/, "der Nachzug-Effekt haengt nicht am frischen result");
  // Stevie darf im Nachzug selbst handeln (eintragen statt nur nennen, Jareks
  // Richtung) — die Kette ist dafuer hart gedeckelt: hoechstens ZWEI Nachzuege.
  assert.match(app, /tiefe < 2 && \(erg\.geaendert \|\| erg\.probe\.length\)/, "der Tiefen-Deckel der Nachzug-Kette fehlt");
  assert.match(app, /nachzugRef\.current = \{ probe: erg\.probe, tiefe: tiefe \+ 1,/, "die Tiefe wird nicht mitgezaehlt");
  assert.match(app, /chatRunde\(CHAT_NACHZUG, verlauf, befund, n\.tiefe\)/, "der Nachzug traegt seine Tiefe nicht weiter");
  assert.match(app, /chatRunde\(frage, verlauf, null, 0\)/, "die Nutzerfrage startet nicht bei Tiefe 0");
  assert.equal(app.split("chatRunde(CHAT_NACHZUG").length - 1, 1, "genau EIN Nachzug-Aufrufer");
  // Eine Frage, EINE Stevie-Blase: der Nachzug ersetzt die Ankuendigung und
  // nimmt deren Chips mit, statt eine dritte Nachricht anzuhaengen.
  assert.match(app, /if \(tiefe > 0\) \{\s*setChatVerlauf/, "der Nachzug ersetzt die Ankuendigungs-Blase nicht");
  assert.match(app, /chips: \[\.\.\.\(k\[j\]\.chips \|\| \[\]\), \.\.\.erg\.chips\]/, "die Chips der Ankuendigung muessen mitwandern");
  // leeren in der App: nur als erste Aktion, und [] ist eine echte Arbeitskopie.
  assert.match(app, /a\.typ === "leeren"/, "die leeren-Aktion fehlt in der App");
  assert.match(app, /if \(erste && cargo\.length\) \{ neu = \[\];/, "leeren darf nur als erste Aktion abraeumen");
  // Das Panel bleibt gedeckelt und laesst sich klein machen — der Plan dahinter
  // bleibt sichtbar (Jareks Handy-Befund).
  assert.match(app, /maxHeight: "min\(60%, 460px\)"/, "der Hoehen-Deckel des Panels fehlt");
  assert.equal(app.split("setChatMini(false)").length - 1, 3, "Senden und beide Oeffnen-Wege heben Mini auf");
});

test("Stevie hat Gesicht, Namen und einen Platz auf der Flaeche", () => {
  // Das Maskottchen ist EINE Komponente (StevieKopf) — Launcher, Seitenleisten-Knopf
  // und Panel-Kopf zeigen denselben Kopf, keine Kopien.
  assert.match(app, /var StevieKopf = /, "die Maskottchen-Komponente fehlt");
  assert.ok(app.split("React.createElement(StevieKopf").length - 1 >= 3, "Launcher, Knopf und Panel-Kopf tragen den Kopf");
  // Der Launcher schwebt im Bild (Jareks Richtung: 'der Button verdient einen Platz
  // auf der Flaeche'). Er versteckt sich NICHT hinter den Bannern — Sicherungs-
  // Hinweise gibt es bei fast jedem Plan —, sondern rueckt hoch, solange eins spricht.
  assert.match(app, /const stevieLauncher = !chatOffen && !EMBEDDED;/, "der Launcher-Schalter fehlt oder haengt falsch");
  // Seit Phase 2 rechnet der Ausweich-Abstand vom Buehnen-Boden aus: ueber der Glasleiste
  // (wide: 128) bzw. ueber dem Bildrand (16), plus 72 wenn ein Banner spricht.
  assert.match(app, /bottom: buehneUnten \+ \(stevieHoch \? 72 : 0\)/, "der Launcher weicht den Bannern nicht aus");
  assert.match(app, /stevieLauncher && \/\* @__PURE__ \*\/ React\.createElement\("button"/, "der Launcher-Knopf fehlt im Bild");
  // Entdeckt-Zaehler: beide Wege zaehlen dasselbe Ereignis (zaehl dedupliziert selbst).
  assert.equal(app.split('zaehl("stevie-geoeffnet")').length - 1, 2, "beide Oeffnen-Wege zaehlen stevie-geoeffnet");
});

test("die Startseite stellt Stevie vor — in beiden Sprachen", () => {
  const start = readFileSync(new URL("../index.html", import.meta.url), "utf8");
  assert.match(start, /<section id="stevie"/, "die Stevie-Sektion fehlt");
  assert.match(start, /Frag Stevie\./, "die deutsche Ueberschrift fehlt");
  assert.match(start, /Stevie erfindet keine Zahlen/, "die Ehrlichkeitszeile fehlt auf der Startseite");
  // Die englische Fassung haengt im EN-Woerterbuch — sonst bleibt die Sektion deutsch.
  for (const key of ["st_ey", "st_h", "st_p", "st_c1", "st_c2", "st_c3", "st_c4", "st_cta", "st_b1", "st_b2", "st_chip", "nav_stevie"]) {
    assert.ok(new RegExp('"' + key + '": "').test(start), `EN-Uebersetzung ${key} fehlt`);
    assert.ok(start.includes(`data-i18n="${key}"`), `data-i18n="${key}" fehlt im Markup`);
  }
  // Der CTA ist ein /app-Link — setLang haengt ihn auf ?lang=en um wie jeden anderen.
  assert.match(start, /data-i18n="st_cta" href="\/app"/, "der CTA zeigt nicht auf den Rechner");
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
  assert.match(ds, /folgen automatisch bis zu zwei weitere Anfragen/, "der Nachzug muss in der Datenschutzerklaerung stehen");
});
