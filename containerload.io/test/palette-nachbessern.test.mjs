// Eine uebernommene Palette muss sich nachbessern lassen.
//
// Der Fall aus der Praxis: jemand rechnet 40 Kartons auf Paletten, uebernimmt sie in die
// Ladung — und merkt dann, dass die Kartons 2 cm hoeher sind. In der Ladungsliste steht
// danach nur noch "120 x 80 x 174,4 cm". Daraus laesst sich nicht zurueckrechnen, ob
// darunter vier oder vierzig Kartons liegen; die ganze Eingabe war weg.
//
// Deshalb faehrt der EINGABESTAND des Dialogs als palSrc mit in die Ladung, und der
// Dialog nimmt ihn ueber init wieder an.
import fs from "node:fs";
import assert from "node:assert";
import test from "node:test";
import { fileURLToPath } from "node:url";
import path from "node:path";

const dir = path.dirname(fileURLToPath(import.meta.url));
const app = fs.readFileSync(path.join(dir, "..", "app.html"), "utf8");

test("der Eingabestand faehrt mit in die Ladung", () => {
  assert.ok(/onApply\(items, \{ palKey, pl, pw, mode, maxH, over, maxLay, stack, rows: rows\.map/.test(app),
    "der Dialog gibt seinen Eingabestand nicht mit heraus");
  assert.ok(/const withId = items\.map\(\(it\) => \(\{ \.\.\.it, id: uid\(\), grp, palSrc: quelle \}\)\)/.test(app),
    "palSrc landet nicht an den erzeugten Positionen");
});

test("jeder Wert, den der Dialog herausgibt, wird beim Wiederoeffnen auch gesetzt", () => {
  // Das ist die eigentliche Falle: wer dem Dialog ein neues Eingabefeld gibt und es in
  // onApply mitschickt, aber nicht aus init liest, setzt es beim Nachbessern stillschweigend
  // auf den Standardwert zurueck — und niemand sieht es, weil die Rechnung ja durchlaeuft.
  const raus = (/onApply\(items, \{ ([^}]*), rows: rows\.map/.exec(app) || [])[1];
  assert.ok(raus, "die Uebergabe an onApply wurde umgebaut — dieser Test muss mitwandern");
  const felder = raus.split(",").map((x) => x.trim()).filter(Boolean).concat(["rows"]);
  const fehlt = felder.filter((f) => !new RegExp(`useState\\(init \\? init\\.${f}\\b`).test(app));
  assert.deepStrictEqual(fehlt, [],
    `Diese Werte gibt der Dialog heraus, liest sie beim Wiederoeffnen aber nicht aus init: ${fehlt.join(", ")}`);
});

test("Nachbessern ersetzt die Gruppe, es haengt nicht an", () => {
  assert.ok(/const grp = palEdit \|\| uid\(\);/.test(app),
    "beim Nachbessern muss die Gruppenkennung erhalten bleiben");
  assert.ok(/const ohne = cs\.filter\(\(c\) => c\.grp !== palEdit\);/.test(app) &&
            /return \[\.\.\.ohne\.slice\(0, stelle\), \.\.\.neu3, \.\.\.ohne\.slice\(stelle\)\];/.test(app),
    "die alten Positionen der Gruppe werden nicht ersetzt — die Liste waechst bei jeder Korrektur");
  assert.ok(/const alteFarben = palEdit \? cs\.filter\(\(c\) => c\.grp === palEdit\)\.map\(\(c\) => c\.color\) : \[\];/.test(app),
    "eine Korrektur darf die Ladung nicht umfaerben");
});

test("der Knopf zum Nachbessern steht nur an Paletten und ist zweisprachig", () => {
  assert.ok(/open && c\.palSrc && [\s\S]{0,300}?T\.palEditBtn/.test(app),
    "der Knopf haengt nicht an palSrc — er stuende dann auch an getippten Packstuecken");
  for (const k of ["palEditBtn", "palEditTitle", "palUpdated"]) {
    const n = (app.match(new RegExp(`[{,]\\s*${k}:`, "g")) || []).length;
    assert.strictEqual(n, 2, `${k} steht ${n}× in den Woerterbuechern, erwartet 2 (DE und EN)`);
  }
});
