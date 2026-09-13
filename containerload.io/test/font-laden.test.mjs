// Die Font-CSS laedt asynchron -- auf JEDER oeffentlichen Seite.
//
// Der Hintergrund: PageSpeed (mobil 85) nannte als groessten vermeidbaren
// Posten die render-blockierenden Ressourcen, und die Google-Font-CSS war
// auf allen 28 oeffentlichen Seiten einer davon. display=swap zeichnet den
// Text sofort in der Systemschrift; es gibt keinen Grund, den ersten Paint
// auf die Schrift warten zu lassen. Der media-Swap (media="print" +
// onload="this.media='all'") nimmt die CSS aus dem kritischen Pfad, der
// noscript-Fallback haelt die Schrift ohne JavaScript am Leben.
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
      if (!t.includes("fonts.googleapis.com/css2") || !t.includes('rel="stylesheet"')) continue;
      if (t.startsWith("<noscript>")) { fallback++; continue; }
      assert.ok(t.includes('media="print"') && t.includes("this.media='all'"),
        `${s}: die Font-CSS blockiert wieder den ersten Paint`);
      asynchron++;
    }
    assert.ok(asynchron >= 1, `${s}: keine Font-CSS gefunden -- Anker veraltet?`);
    assert.ok(fallback >= asynchron, `${s}: der noscript-Fallback fehlt`);
  }
});

test("die Startseite kuendigt die cdnjs-Verbindung an (Three.js der Hero-Animation)", () => {
  const roh = fs.readFileSync(path.join(wurzel, "index.html"), "utf8");
  assert.ok(roh.includes('<link rel="preconnect" href="https://cdnjs.cloudflare.com" crossorigin />'),
    "der preconnect zu cdnjs fehlt");
});
