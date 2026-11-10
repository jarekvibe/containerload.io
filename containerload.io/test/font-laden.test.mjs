// Die Font-CSS laedt asynchron -- auf JEDER oeffentlichen Seite.
//
// Der Hintergrund: PageSpeed (mobil 85) nannte als groessten vermeidbaren
// Posten die render-blockierenden Ressourcen, und die Font-CSS war auf allen
// oeffentlichen Seiten einer davon. display=swap zeichnet den Text sofort in
// der Systemschrift; es gibt keinen Grund, den ersten Paint auf die Schrift
// warten zu lassen. Der media-Swap (media="print" + onload="this.media='all'")
// nimmt die CSS aus dem kritischen Pfad, der noscript-Fallback haelt die
// Schrift ohne JavaScript am Leben.
//
// Seit November 2026 kommen die Schriften vom eigenen Server (schrift/, erzeugt
// von werkzeug/bibliotheken/holen.mjs) statt von Google Fonts. Am Muster aendert
// das nichts -- nur die Adresse ist eine eigene, und ein preload holt die eine
// Datei, die jede Seite braucht (Archivo, latin), schon bevor die CSS da ist.
//
// Wer eine neue oeffentliche Seite anlegt, faellt hier durch, wenn er die
// Font-CSS wieder blockierend einbindet.
//
// node --test test/font-laden.test.mjs
import fs from "node:fs";
import assert from "node:assert";
import test from "node:test";
import { fileURLToPath } from "node:url";
import path from "node:path";

const dir = path.dirname(fileURLToPath(import.meta.url));
const wurzel = path.join(dir, "..");
const seiten = [
  "index.html", "app.html", "impressum.html", "datenschutz.html",
  ...fs.readdirSync(path.join(wurzel, "ratgeber")).filter((f) => f.endsWith(".html")).map((f) => "ratgeber/" + f),
  ...fs.readdirSync(path.join(wurzel, "en/guide")).filter((f) => f.endsWith(".html")).map((f) => "en/guide/" + f),
  ...fs.readdirSync(path.join(wurzel, "nl/gids")).filter((f) => f.endsWith(".html")).map((f) => "nl/gids/" + f),
];

test("keine oeffentliche Seite blockiert den ersten Paint auf der Font-CSS", () => {
  for (const s of seiten) {
    const zeilen = fs.readFileSync(path.join(wurzel, s), "utf8").split("\n");
    let asynchron = 0, fallback = 0;
    for (const z of zeilen) {
      const t = z.trim();
      // Nur Kopfzeilen-Links zaehlen -- die Druckvorlage LV_DOC in app.html
      // steht als Template-String mitten in einer Skriptzeile und darf
      // blockierend bleiben (ein Druckdokument wartet ohnehin auf die Schrift).
      if (!t.startsWith("<link") && !t.startsWith("<noscript><link")) continue;
      if (!t.includes("schrift/schrift.css") || !t.includes('rel="stylesheet"')) continue;
      if (t.startsWith("<noscript>")) { fallback++; continue; }
      assert.ok(t.includes('media="print"') && t.includes("this.media='all'"),
        `${s}: die Font-CSS blockiert wieder den ersten Paint`);
      asynchron++;
    }
    assert.ok(asynchron >= 1, `${s}: keine Font-CSS gefunden -- Anker veraltet?`);
    assert.ok(fallback >= asynchron, `${s}: der noscript-Fallback fehlt`);
  }
});

test("jede Seite laedt die eine Schriftdatei vor, die sie sicher braucht", () => {
  // Ohne preload erfaehrt der Browser erst aus der (asynchronen) CSS, dass es die Schrift
  // gibt. crossorigin gehoert dazu: Schriften werden immer im CORS-Modus geholt, ein
  // preload ohne das Attribut wuerde die Datei ein zweites Mal laden.
  for (const s of seiten) {
    const roh = fs.readFileSync(path.join(wurzel, s), "utf8");
    const m = /<link rel="preload" href="([^"]*schrift\/(archivo-[^"]+-latin\.woff2))" as="font" type="font\/woff2" crossorigin \/>/.exec(roh);
    assert.ok(m, `${s}: kein preload der Archivo-Datei`);
    assert.ok(fs.existsSync(path.join(wurzel, "schrift", m[2])), `${s}: vorgeladen wird ${m[2]}, die Datei gibt es nicht`);
    assert.ok(roh.indexOf(m[0]) < roh.indexOf("schrift.css"), `${s}: das preload steht nicht vor der Font-CSS`);
  }
});
