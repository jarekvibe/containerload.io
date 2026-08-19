// DE/EN-Paritaet auf der Startseite.
//
// Fuer den Rechner haelt i18n-paritaet.test.mjs die Regel aus CLAUDE.md fest. index.html
// hat aber ein EIGENES Woerterbuch (var EN={…}) und eigene data-i18n-Attribute — und dort
// gab es bisher gar keine Wache. Ein fehlender englischer Eintrag faellt niemandem auf, der
// die Seite auf Deutsch liest; er faellt dem englischen Besucher auf, und zwar als leere
// oder unveraenderte Stelle mitten auf der Startseite.
import fs from "node:fs";
import assert from "node:assert";
import test from "node:test";
import { fileURLToPath } from "node:url";
import path from "node:path";

const dir = path.dirname(fileURLToPath(import.meta.url));
const html = fs.readFileSync(path.join(dir, "..", "index.html"), "utf8");

const start = html.indexOf("var EN={");
assert.ok(start > 0, "var EN nicht gefunden");
const open = html.indexOf("{", start);
let depth = 0, end = -1, q = null, esc = false;
for (let i = open; i < html.length; i++) {
  const c = html[i];
  if (q) {
    if (esc) esc = false;
    else if (c === "\\") esc = true;
    else if (c === q) q = null;
    continue;
  }
  if (c === '"' || c === "'" || c === "`") { q = c; continue; }
  if (c === "{") depth++;
  else if (c === "}") { depth--; if (depth === 0) { end = i; break; } }
}
assert.ok(end > open, "Ende des EN-Objekts nicht gefunden");
const EN = new Function("return " + html.slice(open, end + 1) + ";")();

// Schluessel, die absichtlich nur auf Deutsch stehen (Eigennamen, Zeichen ohne Wort).
const NUR_DEUTSCH = new Set([]);

// Ein Schluessel gilt als benutzt, wenn ein Element ihn traegt ODER das Skript ihn direkt
// anspricht (EN.imp_ph fuer den Platzhalter im Einfuegefeld, EN.imp_toolong fuer die
// Meldung bei zu langer Liste — die haengen an keinem data-i18n).
const ausAttribut = [...html.matchAll(/data-i18n="([^"]+)"/g)].map((m) => m[1]);
const ausSkript = [...html.matchAll(/\bEN\.([A-Za-z_$][\w$]*)|\bEN\[["']([^"']+)["']\]/g)].map((m) => m[1] || m[2]);
const benutzt = [...new Set([...ausAttribut, ...ausSkript])];

test("die Startseite benutzt ueberhaupt Schluessel", () => {
  assert.ok(benutzt.length > 30, `nur ${benutzt.length} data-i18n-Schluessel gefunden`);
});

test("jeder Schluessel auf der Seite hat eine englische Entsprechung", () => {
  const fehlt = benutzt.filter((k) => !NUR_DEUTSCH.has(k) && !(k in EN));
  assert.deepStrictEqual(fehlt, [], `ohne englischen Eintrag: ${fehlt.join(", ")}`);
});

test("kein englischer Eintrag zeigt ins Leere", () => {
  // Ein Schluessel im Woerterbuch, den die Seite nirgends mehr abruft, ist Altlast: er
  // faellt nie auf und wird beim naechsten Umbau mitgeschleppt. Beim Einbau dieses Tests
  // waren es sechs — Reste von Elementen, die es nicht mehr gibt.
  const tot = Object.keys(EN).filter((k) => !benutzt.includes(k));
  assert.deepStrictEqual(tot, [], `Eintrag ohne Stelle auf der Seite: ${tot.join(", ")}`);
});

test("kein englischer Text ist leer geblieben", () => {
  const leer = Object.entries(EN).filter(([, v]) => typeof v === "string" && v.trim() === "").map(([k]) => k);
  assert.deepStrictEqual(leer, [], `leere Texte: ${leer.join(", ")}`);
});

test("die Palettier-Texte sind in beiden Sprachen da", () => {
  for (const k of ["f6_h", "f6_p", "q5_s", "q5_a"]) {
    assert.ok(benutzt.includes(k), `${k} steht nicht auf der Seite`);
    assert.ok(k in EN, `${k} fehlt auf Englisch`);
  }
});
