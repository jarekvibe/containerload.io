// Der Name einer Position, die der Import OHNE Namen anlegt.
//
// "12 x 120x80x100 250kg" oder ein ?q=-Link ohne Wort davor: der Parser muss die Position
// irgendwie nennen. Bis 25.11.26 hiess sie in JEDER Sprache "Position" (und in den seltenen
// Faellen, in denen nur ein Palettenmass erkannt wird, "Palette" oder "Europalette") -- auch
// im englischen, spanischen, chinesischen Rechner. Jetzt kommen die Woerter aus dem
// Woerterbuch der Sprache (T.importNamen); Deutsch bleibt die Vorgabe des Parsers, damit er
// auch allein (Tests, Startseite) dasselbe liefert wie immer.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const wurzel = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const app = fs.readFileSync(path.join(wurzel, "app.html"), "utf8");
const L = app.split("\n");
const von = L.findIndex((l) => l.includes("var PALLET_PRESETS = ["));
const bis = L.findIndex((l, i) => i > von && l.includes("var hexA"));
const parser = () => new Function(L.slice(von, bis).join("\n") + "\nreturn { parseCargoText, setze: (n) => { PARSER_NAMEN = n; } };")();

const OHNE_NAMEN = "12 x 100x100x100 250kg";
const EN = { pos: "Item", pal: "Pallet", ep: "Euro pallet" };

test("ohne Vorgabe bleibt der Parser deutsch -- wie immer", () => {
  const { parseCargoText } = parser();
  assert.strictEqual(parseCargoText(OHNE_NAMEN)[0].name, "Position");
  assert.strictEqual(parseCargoText("8 x 120x80x110 300kg")[0].name, "Position");
});

test("der Rechner setzt die Woerter seiner Sprache ein", () => {
  const { parseCargoText, setze } = parser();
  setze(EN);
  assert.strictEqual(parseCargoText(OHNE_NAMEN)[0].name, "Item");
  // Ein genannter Name bleibt, was jemand geschrieben hat
  assert.strictEqual(parseCargoText("8 Fässer 60x60x90 200kg")[0].name, "Fässer");
  assert.strictEqual(parseCargoText("10 Europaletten")[0].name, "Europaletten");
  // Masse und Mengen aendern sich dadurch nicht
  const r = parseCargoText(OHNE_NAMEN)[0];
  assert.deepStrictEqual([r.qty, r.l, r.w, r.h, r.weight], [12, 100, 100, 100, 250]);
  // Eine Excel-Zeile ohne Namensspalte
  const tsv = parseCargoText("Länge\tBreite\tHöhe\tMenge\n100\t100\t100\t4");
  assert.strictEqual(tsv[0].name, "Item", "die Tabellen-Lesart nennt die Position noch deutsch");
  // Ein einzelner Aufruf kann die Woerter ueberstimmen
  assert.strictEqual(parseCargoText(OHNE_NAMEN, { namen: { pos: "Bulto" } })[0].name, "Bulto");
  setze(null);
  assert.strictEqual(parseCargoText(OHNE_NAMEN)[0].name, "Position");
});

test("alle drei Woerter kommen aus derselben Quelle, mit dem deutschen als Rueckfall", () => {
  assert.ok(app.includes('var parserNamen = (opts) => (opts && opts.namen) || (typeof PARSER_NAMEN !== "undefined" && PARSER_NAMEN) || {};'));
  assert.ok(app.includes('if (!name) name = parserNamen(opts).pos || "Position";'), "die Tabellen-Lesart");
  assert.ok(app.includes('name = pal ? pal.w === 80 ? NM.ep || "Europalette" : NM.pal || "Palette" : dim2 ? NM.pal || "Palette" : NM.pos || "Position";'), "die Freitext-Lesart");
});

test("jede Sprache bringt die drei Woerter mit, und der Rechner meldet sie beim Parser an", () => {
  assert.ok(app.includes("  PARSER_NAMEN = (I18N[LANG] && I18N[LANG].importNamen) || null;"), "der Rechner reicht die Woerter nicht an den Parser");
  assert.ok(app.indexOf("PARSER_NAMEN = (I18N[LANG]") < app.indexOf("  var QIMPORT = "), "der ?q=-Import liest, bevor die Woerter gesetzt sind");
  assert.ok(app.includes("      importNamen: null,"), "Deutsch: die Vorgabe steht im Parser, nicht im Woerterbuch");
  assert.ok(app.includes('      importNamen: { pos: "Item", pal: "Pallet", ep: "Euro pallet" },'), "Englisch");
  const React = { Fragment: "F", createElement: (t, p, ...k) => ({ t, p, k }) };
  const h = { React, C: new Proxy({}, { get: () => "#000000" }), fmtDE: (n) => String(n), plu: (n, a, b) => n + " " + (n === 1 ? a : b), loc: () => "en-US" };
  const gesehen = new Set(["Item"]);
  for (const f of fs.readdirSync(path.join(wurzel, "sprache")).filter((x) => x.endsWith(".js"))) {
    const win = {}; new Function("window", fs.readFileSync(path.join(wurzel, "sprache", f), "utf8"))(win);
    const k = f.slice(0, -3), n = win.CL_SPRACHE[k].texte(h).importNamen;
    assert.deepStrictEqual(Object.keys(n).sort(), ["ep", "pal", "pos"], `${k}: importNamen`);
    for (const w of Object.values(n)) assert.ok(typeof w === "string" && w.trim().length > 1, `${k}: leeres Wort`);
    // Portugiesisch sagt "item" -- dasselbe Wort wie das englische. Die Ausnahme steht namentlich
    // hier; fuer jede andere Sprache waere ein englisches Wort ein vergessener Eintrag.
    const GLEICH_WIE_ENGLISCH = { pt: "Item" };
    assert.ok((!gesehen.has(n.pos) || GLEICH_WIE_ENGLISCH[k] === n.pos) && n.pos !== "Position", `${k}: "${n.pos}" ist nicht uebersetzt`);
    gesehen.add(n.pos);
    // ... und der Parser benutzt sie
    const { parseCargoText, setze } = parser();
    setze(n);
    assert.strictEqual(parseCargoText(OHNE_NAMEN)[0].name, n.pos.charAt(0).toUpperCase() + n.pos.slice(1));
  }
});
