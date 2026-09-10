// Das Rampen-Blatt: was den Ladevorschlag vom Bildschirm-Dokument zum
// Klemmbrett-Dokument macht.
//
// Vier Teile, alle in app.html: editierbare Kopf-Felder (REF, Absender,
// Empfaenger -- rein lokal, nie im Teilen-Link), Abhak-Kaestchen in der
// Belade-Reihenfolge, der Gewicht-&-Schwerpunkt-Block (LV_GEWICHT) und die
// Unterschriftszeile (LV_QUITTUNG). Die zwei neuen Funktionen sind bewusst
// abhaengigkeitsfrei und werden hier einzeln ausgeschnitten -- dasselbe
// Muster wie test/belade-reihenfolge.test.mjs.
//
// node --test test/rampen-blatt.test.mjs
import fs from "node:fs";
import assert from "node:assert";
import test from "node:test";
import { fileURLToPath } from "node:url";
import path from "node:path";

const dir = path.dirname(fileURLToPath(import.meta.url));
const roh = fs.readFileSync(path.join(dir, "..", "app.html"), "utf8");
const L = roh.split("\n");
const cut = (von) => {
  const s = L.findIndex((l) => l.includes(von));
  const e = L.findIndex((l, i) => i > s && l.trim() === "};" && L[i - 1].includes("</div>`;"));
  assert.ok(s >= 0 && e > s, `Ausschnitt nicht gefunden: ${von}`);
  return L.slice(s, e + 1).join("\n");
};
const { LV_GEWICHT, LV_QUITTUNG } = new Function(
  cut("var LV_GEWICHT = (placed")
  + "\n" + cut("var LV_QUITTUNG = (lang)")
  + "\nreturn { LV_GEWICHT, LV_QUITTUNG };"
)();

// Zwei Stuecke mit bekannter Statik: 100 kg mit Mitte bei 0,5 m, 300 kg mit
// Mitte bei 4,5 m. Schwerpunkt = (100*50 + 300*450) / 400 = 350 cm. Das
// leichte Stueck liegt ganz in der vorderen Haelfte (CL/2 = 295), das
// schwere ganz in der hinteren: vorne 100 von 400 kg = 25 %.
const CARGO = [{ weight: 100 }, { weight: 300 }];
const PLACED = [
  { ti: 0, x: 0, y: 0, z: 0, dx: 100 },
  { ti: 1, x: 400, y: 0, z: 0, dx: 100 },
];

test("Schwerpunkt und Haelften-Verteilung sind nachgerechnet", () => {
  const html = LV_GEWICHT(PLACED, CARGO, 590, "de");
  assert.ok(html.includes("400 kg"), "Ladungsgewicht fehlt oder falsch");
  assert.ok(html.includes("3,50 m"), `Schwerpunkt 3,50 m fehlt: ${html.slice(0, 300)}`);
  assert.ok(html.includes("(59 % der L\xE4nge)"), "Prozent der Laenge falsch");
  assert.ok(html.includes("vordere H\xE4lfte 25 %"), "vordere Haelfte falsch");
  assert.ok(html.includes("hintere H\xE4lfte 75 %"), "hintere Haelfte falsch");
  // Der Marker auf dem Balken steht an derselben Stelle wie die Prozentzahl.
  assert.ok(html.includes("left:59%"), "Marker steht nicht am Schwerpunkt");
  assert.ok(html.includes("STIRNWAND") && html.includes("T\xDCR"), "Balken-Beschriftung fehlt");
});

test("ein Stueck, das die Haelften-Grenze ueberspannt, zaehlt anteilig", () => {
  // Ein Stueck 200-400 cm auf CL 600: Haelfte bei 300, also 50/50.
  const html = LV_GEWICHT([{ ti: 0, x: 200, y: 0, z: 0, dx: 200 }], [{ weight: 500 }], 600, "de");
  assert.ok(html.includes("vordere H\xE4lfte 50 %"), "anteiliger Ueberlapp wird nicht gerechnet");
});

test("ohne vollstaendige Gewichte gibt es KEINEN Schwerpunkt (Ehrlichkeits-Gate)", () => {
  // Dieselbe Regel wie beim W/M des CBM-Widgets: ein Schwerpunkt aus halben
  // Gewichten waere eine erfundene Zahl mit amtlichem Klang.
  assert.strictEqual(LV_GEWICHT(PLACED, [{ weight: 100 }, {}], 590, "de"), "");
  assert.strictEqual(LV_GEWICHT(PLACED, [{ weight: 100 }, { weight: 0 }], 590, "de"), "");
  assert.strictEqual(LV_GEWICHT([], CARGO, 590, "de"), "");
  assert.strictEqual(LV_GEWICHT(PLACED, CARGO, 0, "de"), "");
});

test("der Block heisst Richtwert und verspricht kein Wiegen", () => {
  const de = LV_GEWICHT(PLACED, CARGO, 590, "de");
  assert.ok(de.includes("RICHTWERT"), "die Richtwert-Plakette fehlt");
  assert.ok(de.includes("Kein Wiegeersatz"), "die Abgrenzung zum Wiegen fehlt");
  assert.ok(de.includes("homogene Masse"), "die Annahme steht nicht sichtbar dabei");
  const en = LV_GEWICHT(PLACED, CARGO, 590, "en");
  assert.ok(en.includes("WEIGHT &amp; CENTRE OF GRAVITY \xB7 GUIDE VALUE"));
  assert.ok(en.includes("3.50 m"), "englischer Dezimalpunkt fehlt");
  assert.ok(!en.includes("Stirnwand"), "deutscher Text im englischen Dokument");
});

test("die Quittung bestaetigt GELADEN, niemals geprueft", () => {
  const de = LV_QUITTUNG("de");
  assert.ok(de.includes("Geladen von (Name)"), "das Namensfeld fehlt");
  assert.ok(de.includes("Datum / Uhrzeit") && de.includes("Unterschrift"), "Felder fehlen");
  assert.ok(de.includes("Best\xE4tigt nur die Verladung"), "die Eingrenzung fehlt");
  assert.ok(de.includes("Keine Best\xE4tigung von Ladungssicherung, Achslast oder Gewichten"),
    "der Haftungs-Satz fehlt");
  // "geprueft"/"geprüft" darf hier nicht stehen: die Pruefung von Sicherung
  // und Achslast bleibt fachliche Sache, ein kostenloses Tool darf sie nicht
  // per Unterschriftsfeld einsammeln.
  assert.ok(!/gepr\xFCft|geprueft/i.test(de), "die Quittung behauptet eine Pruefung");
  const en = LV_QUITTUNG("en");
  assert.ok(en.includes("Loaded by (name)") && en.includes("Signature"));
  assert.ok(en.includes("No confirmation of load securing, axle load or weights"));
  assert.ok(!/checked|verified|inspected/i.test(en), "die englische Quittung behauptet eine Pruefung");
});

// ── Der Vertrag im Quelltext ────────────────────────────────────────────────────────

test("die Belade-Reihenfolge traegt je Schritt ein Abhak-Kaestchen", () => {
  const seq = cut("var LV_SEQUENZ = (placed");
  assert.ok(/border:1\.5px solid #0c1320; border-radius:2\.5px/.test(seq),
    "das Kaestchen fehlt in der Zeilen-Vorlage");
  assert.ok(seq.includes("K\xE4stchen beim Verladen abhaken") && seq.includes("Tick each step as you load"),
    "der Hinweis zum Abhaken fehlt (de oder en)");
});

test("die Kopf-Felder sind editierbar -- und bleiben auf dem Blatt", () => {
  // REF, Absender, Empfaenger als contenteditable im Hero von LV_PAGE.
  assert.strictEqual((roh.match(/class="cl-edit" contenteditable="true"/g) || []).length, 3,
    "es muessen genau drei editierbare Felder sein (REF, Absender, Empfaenger)");
  assert.ok(roh.includes('ABSENDER"}&nbsp;') || /SHIPPER" : "ABSENDER"/.test(roh), "das Absender-Feld fehlt");
  assert.ok(/CONSIGNEE" : "EMPF\\xC4NGER"/.test(roh), "das Empfaenger-Feld fehlt");
  // Leer zeigt das Feld seinen Hinweis, im Druck wird daraus eine leere Linie
  // (Handschrift), und der Hinweis verschwindet.
  assert.ok(roh.includes(".cl-edit:empty::before{content:attr(data-hint)"), "der Platzhalter-Hinweis fehlt");
  assert.ok(/@media print\{\.cl-edit\{border-bottom:1px solid[^}]*\}\.cl-edit:empty::before\{content:""\}/.test(roh),
    "im Druck muss der Hinweis verschwinden und die Linie bleiben");
  // Die Felder bleiben lokal: kein Skript liest sie zurueck, sie erreichen
  // weder Teilen-Link noch Statistik. Wer das aendert, muss hier vorbei.
  assert.ok(!/(querySelector|getElementsBy)[^\n]*cl-edit/.test(roh),
    "ein Skript liest die editierbaren Felder zurueck -- sie sollen das Blatt nie verlassen");
  // Und die Toolbar sagt es dazu.
  assert.ok(roh.includes("sie verlassen dieses Blatt nicht") && roh.includes("they never leave this page"),
    "der Hinweis in der Toolbar fehlt");
});

test("Einzelblatt und Container-Blaetter tragen Gewicht-Block und Quittung, das Deckblatt nicht", () => {
  assert.ok(/: STOWAGE \+ LV_SEQUENZ\(placed, cargo, LANG, tiColor\)( \+ LV_STOPPS\(placed, cargo, tiPos, LANG\))? \+ LV_GEWICHT\(placed, cargo, num\(container\.l\), LANG\) \+ LV_QUITTUNG\(LANG\),/.test(roh),
    "das einzelne Blatt traegt Gewicht-Block und Quittung nicht");
  assert.ok(/chainLen: 1 \}\) \+ LV_SEQUENZ\(sp, cargo, LANG, tiC\)( \+ LV_STOPPS\(sp, cargo, tiP, LANG\))? \+ LV_GEWICHT\(sp, cargo, num\(cp\.l\), LANG\) \+ LV_QUITTUNG\(LANG\),/.test(roh),
    "die Container-Blaetter tragen Gewicht-Block und Quittung nicht");
  // Das Deckblatt zeigt die Uebersicht je Container -- unterschrieben wird an
  // der Rampe je Container, nicht auf dem Deckblatt.
  assert.ok(/mehrere \? LV_UEBERSICHT\(slotRows, LANG\) :/.test(roh),
    "das Deckblatt haengt ploetzlich an einer anderen Weiche");
});

test("die Rampen-Bloecke stehen buendig im 44px-Satzspiegel des Blatts", () => {
  // LV_STOWAGE traegt margin ... 44px; die Bloecke darunter sassen zuerst
  // buendig am SEITENRAND (links:0 statt 44, im Render gemessen). Die drei
  // Wurzeln muessen denselben Einzug tragen.
  assert.ok(cut("var LV_SEQUENZ = (placed").includes('style="margin:18px 44px 0;"'),
    "die Belade-Reihenfolge klebt am Seitenrand");
  assert.ok(cut("var LV_GEWICHT = (placed").includes('style="margin:14px 44px 0;'),
    "der Gewicht-Block klebt am Seitenrand");
  assert.ok(cut("var LV_QUITTUNG = (lang)").includes('style="margin:14px 44px 0;'),
    "die Quittung klebt am Seitenrand");
});
