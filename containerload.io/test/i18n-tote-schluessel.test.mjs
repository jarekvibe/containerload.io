// Uebersetzter Text, den niemand sehen kann.
//
// test/i18n-paritaet.test.mjs prueft, dass DE und EN dieselben Schluessel tragen. Was
// es nicht prueft: ob ein Schluessel ueberhaupt noch irgendwo BENUTZT wird. Sechs
// Eintraege hatten sich so angesammelt — Reste von Umbauten, doppelt gepflegt, in
// beiden Sprachen, und bei jeder Durchsicht sah es aus, als fehle irgendwo Text.
//
// Drei davon waren keine Reste, sondern Vergessenes: pdfTitle, exportTitle und
// shotTitle beschreiben, was die Menuepunkte tun, und standen fertig uebersetzt da,
// ohne je angezeigt zu werden. Genau deshalb loescht dieser Test nichts, sondern
// meldet nur — was damit geschieht, ist eine Entscheidung.
//
// VORSICHT bei der Pruefung: ein Schluessel kann auch dynamisch erreicht werden,
// als T[variable] ueber eine Tabelle (cogBalanced, kOpenTop, palCapHeight …). Eine
// fruehere Pruefung hatte das uebersehen und haette englischen Text geloescht, der
// gebraucht wird. Deshalb zaehlt hier jedes Vorkommen des Namens ausserhalb der
// Woerterbuecher als Verwendung.
//
// node --test test/i18n-tote-schluessel.test.mjs
import fs from "node:fs";
import assert from "node:assert";
import test from "node:test";
import { fileURLToPath } from "node:url";
import path from "node:path";

const dir = path.dirname(fileURLToPath(import.meta.url));
const src = fs.readFileSync(path.join(dir, "..", "app.html"), "utf8");

const i = src.indexOf("var I18N");
const j = src.indexOf("var T =", i);
assert.ok(i > 0 && j > i, "die Woerterbuecher stehen nicht mehr, wo der Test sie sucht");
const woerterbuch = src.slice(i, j);
const rest = src.slice(0, i) + src.slice(j);

const keys = [...new Set([...woerterbuch.matchAll(/^\s{6}([A-Za-z_]\w*):/gm)].map((m) => m[1]))];

test("die Woerterbuecher werden ueberhaupt gefunden", () => {
  assert.ok(keys.length > 150, `nur ${keys.length} Schluessel gefunden — der Ausschnitt stimmt nicht mehr`);
});

test("kein uebersetzter Text ohne Verwendung", () => {
  const tot = keys.filter((k) =>
    !new RegExp(`\\bT\\.${k}\\b`).test(rest) &&          // T.schluessel
    !new RegExp(`T\\[["']${k}["']\\]`).test(rest) &&     // T["schluessel"]
    !new RegExp(`["']${k}["']`).test(rest)               // ueber eine Tabelle, z. B. { height: T.palCapHeight }
  );
  assert.deepStrictEqual(tot, [],
    `Diese Schluessel werden nirgends benutzt. Entweder gehoert der Text angezeigt — oder er gehoert geloescht:\n  ${tot.join("\n  ")}`);
});
