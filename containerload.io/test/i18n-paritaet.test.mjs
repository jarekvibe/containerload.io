// DE/EN-Paritaet im Rechner.
//
// CLAUDE.md macht daraus eine harte Regel: "Jeder neue sichtbare Text braucht einen
// Schluessel und einen passenden EN-Eintrag. Niemals nur eine Sprache hinzufuegen."
// Bisher hielt die Regel nur die Aufmerksamkeit desjenigen, der gerade tippt — und ein
// fehlender EN-Eintrag faellt niemandem auf, der die Oberflaeche auf Deutsch benutzt.
// Er faellt dem englischen Besucher auf, und zwar als "undefined" mitten im Satz.
//
// Zusaetzlich geprueft: Ein Schluessel, der auf Deutsch eine Funktion ist (Text mit
// eingesetzten Zahlen), muss auf Englisch ebenfalls eine Funktion mit derselben Zahl
// von Parametern sein — sonst steht dort ein Satz ohne die Zahl, um die es ging.
import fs from "node:fs";
import assert from "node:assert";
import test from "node:test";
import { fileURLToPath } from "node:url";
import path from "node:path";

const dir = path.dirname(fileURLToPath(import.meta.url));
const html = fs.readFileSync(path.join(dir, "..", "app.html"), "utf8");

// I18N-Objektliteral herausschneiden (Klammern zaehlen, Strings/Kommentare beachten).
const start = html.indexOf("var I18N = {");
assert.ok(start > 0, "var I18N nicht gefunden");
const open = html.indexOf("{", start);
let depth = 0, end = -1, q = null, esc = false, line = false, blk = false;
for (let i = open; i < html.length; i++) {
  const c = html[i], n = html[i + 1];
  if (line) { if (c === "\n") line = false; continue; }
  if (blk) { if (c === "*" && n === "/") { blk = false; i++; } continue; }
  if (q) {
    if (esc) esc = false;
    else if (c === "\\") esc = true;
    else if (c === q) q = null;
    continue;
  }
  if (c === "/" && n === "/") { line = true; i++; continue; }
  if (c === "/" && n === "*") { blk = true; i++; continue; }
  if (c === '"' || c === "'" || c === "`") { q = c; continue; }
  if (c === "{") depth++;
  else if (c === "}") { depth--; if (depth === 0) { end = i; break; } }
}
assert.ok(end > open, "Ende des I18N-Objekts nicht gefunden");
const I18N = new Function("var LANG='de';return " + html.slice(open, end + 1) + ";")();

test("beide Sprachen kennen dieselben Schluessel", () => {
  const de = Object.keys(I18N.de).sort(), en = Object.keys(I18N.en).sort();
  const fehltEn = de.filter((k) => !(k in I18N.en));
  const fehltDe = en.filter((k) => !(k in I18N.de));
  assert.deepStrictEqual(fehltEn, [], `ohne englische Entsprechung: ${fehltEn.join(", ")}`);
  assert.deepStrictEqual(fehltDe, [], `ohne deutsche Entsprechung: ${fehltDe.join(", ")}`);
});

test("Textbausteine mit Zahlen bleiben in beiden Sprachen Bausteine", () => {
  const falsch = [];
  for (const k of Object.keys(I18N.de)) {
    if (!(k in I18N.en)) continue;
    const d = I18N.de[k], e = I18N.en[k];
    if (typeof d !== typeof e) falsch.push(`${k}: de ist ${typeof d}, en ist ${typeof e}`);
    else if (typeof d === "function" && d.length !== e.length) falsch.push(`${k}: de nimmt ${d.length}, en nimmt ${e.length} Werte`);
  }
  assert.deepStrictEqual(falsch, [], `Bausteine passen nicht zusammen:\n${falsch.join("\n")}`);
});

test("kein Schluessel ist leer geblieben", () => {
  const leer = [];
  for (const lang of ["de", "en"]) {
    for (const [k, v] of Object.entries(I18N[lang])) {
      if (typeof v === "string" && v.trim() === "") leer.push(`${lang}.${k}`);
    }
  }
  assert.deepStrictEqual(leer, [], `leere Texte: ${leer.join(", ")}`);
});

test("die Palettier-Schluessel sind in beiden Sprachen da", () => {
  const pal = Object.keys(I18N.de).filter((k) => k.startsWith("pal"));
  assert.ok(pal.length >= 30, `nur ${pal.length} pal-Schluessel gefunden`);
  for (const k of pal) assert.ok(k in I18N.en, `${k} fehlt auf Englisch`);
});
