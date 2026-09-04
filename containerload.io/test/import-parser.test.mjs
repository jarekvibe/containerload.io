// Der Excel/Text-Import-Parser, gefuettert mit dem Chaos echter Packlisten.
//
// Ausloeser: "da kommt noch viel Quatsch bei raus". Die Faelle hier sind genau die, an
// denen es hakte -- jede Aenderung am Parser muss durch diesen Prüfstand. Grundsatz:
// der Parser raet nicht still. Wo eine Lesart unsicher ist (mm statt cm), meldet er
// einen VERDACHT (parseCargoText.hinweis), und erst die ausdrueckliche Bestaetigung
// (opts.einheit = "mm") rechnet um.
//
// node --test test/import-parser.test.mjs
import fs from "node:fs";
import assert from "node:assert";
import test from "node:test";
import { fileURLToPath } from "node:url";
import path from "node:path";

const dir = path.dirname(fileURLToPath(import.meta.url));
const roh = fs.readFileSync(path.join(dir, "..", "app.html"), "utf8");
const L = roh.split("\n");
const von = L.findIndex((l) => l.includes("var PALLET_PRESETS = ["));
const bis = L.findIndex((l, i) => i > von && l.includes("var hexA"));
assert.ok(von >= 0 && bis > von, "Parser-Ausschnitt nicht gefunden");
const { parseCargoText } = new Function(L.slice(von, bis).join("\n") + "\nreturn { parseCargoText };")();

const kurz = (rows) => rows.map((r) => `${r.qty}x ${r.l}x${r.w}x${r.h} ${r.weight}kg`).join(" | ");

test("mm-Liste ohne Einheit: Verdacht statt stiller Umrechnung", () => {
  const mm = "Bezeichnung\tStk\tLänge\tBreite\tHöhe\tkg\nMotorblock\t4\t1200\t800\t950\t310";
  const r = parseCargoText(mm);
  // Ohne Bestaetigung bleibt die ehrliche cm-Lesart stehen ...
  assert.strictEqual(kurz(r), "4x 1200x800x950 310kg");
  // ... aber der Verdacht wird gemeldet.
  assert.deepStrictEqual(parseCargoText.hinweis, { mmVerdacht: true });
  // Bestaetigt rechnet er um -- und der Verdacht ist erledigt.
  const r2 = parseCargoText(mm, { einheit: "mm" });
  assert.strictEqual(kurz(r2), "4x 120x80x95 310kg");
  assert.strictEqual(parseCargoText.hinweis, null);
  // Gegenprobe: eine normale cm-Liste loest KEINEN Verdacht aus.
  parseCargoText("Bezeichnung\tStk\tL\tB\tH\tkg\nKiste\t4\t120\t80\t95\t310");
  assert.strictEqual(parseCargoText.hinweis, null);
  // Auch im Freitext.
  parseCargoText("4x 1200x800x950 310kg");
  assert.deepStrictEqual(parseCargoText.hinweis, { mmVerdacht: true });
  assert.strictEqual(kurz(parseCargoText("4x 1200x800x950 310kg", { einheit: "mm" })), "4x 120x80x95 310kg");
});

test("zweizeiliger Excel-Kopf: die Einheitenzeile belegt die Einheiten je Spalte", () => {
  const r = parseCargoText("Bezeichnung\tStk\tLänge\tBreite\tHöhe\tGewicht\n\tStk\tmm\tmm\tmm\tkg\nMotorblock\t4\t1200\t800\t950\t310");
  assert.strictEqual(kurz(r), "4x 120x80x95 310kg");
  // Und sie zaehlt nicht als Datenzeile.
  assert.strictEqual(r.length, 1);
});

test("kombinierte Masse-Spalte (LxBxH) wird gelesen, mit Kopf und ohne", () => {
  const mitKopf = parseCargoText("Artikel\tMenge\tMaße (LxBxH)\tGewicht\nPumpe\t2\t120x80x95\t340\nGetriebe\t6\t110x75x80\t240");
  assert.strictEqual(kurz(mitKopf), "2x 120x80x95 340kg | 6x 110x75x80 240kg");
  assert.strictEqual(mitKopf[0].name, "Pumpe");
  const ohneKopf = parseCargoText("Pumpe\t2\t120x80x95\t340\nGetriebe\t6\t110x75x80\t240");
  assert.strictEqual(kurz(ohneKopf), "2x 120x80x95 340kg | 6x 110x75x80 240kg");
  // Einheit im Kopf der Masse-Spalte gilt fuer die Kette.
  const mmKopf = parseCargoText("Artikel\tMenge\tMaße (LxBxH, mm)\tGewicht\nPumpe\t2\t1200x800x950\t340");
  assert.strictEqual(kurz(mmKopf), "2x 120x80x95 340kg");
  // Gegenprobe: "Masse (kg)" ist und bleibt eine GEWICHTS-Spalte.
  const masseKg = parseCargoText("Artikel\tStk\tL\tB\tH\tMasse (kg)\nKiste\t4\t120\t80\t95\t310");
  assert.strictEqual(kurz(masseKg), "4x 120x80x95 310kg");
});

test("Gesamtgewicht meint die Position, nicht das Stueck", () => {
  const r = parseCargoText("Bezeichnung\tStk\tL\tB\tH\tGesamtgewicht\nKartons\t20\t60\t40\t40\t240");
  assert.strictEqual(r[0].weight, 12, "240 kg gesamt / 20 Stueck = 12 kg je Stueck");
  // Gegenproben: je-Stueck-Spalten bleiben unangetastet.
  assert.strictEqual(parseCargoText("Bezeichnung\tStk\tL\tB\tH\tGewicht je Stück\nKartons\t20\t60\t40\t40\t12")[0].weight, 12);
  assert.strictEqual(parseCargoText("Bezeichnung\tStk\tL\tB\tH\tkg\nKartons\t20\t60\t40\t40\t12")[0].weight, 12);
});

test("Semikolon-CSV wird als Tabelle gelesen, der Freitext-Trenner bleibt Freitext", () => {
  const csv = parseCargoText("Bezeichnung;Stk;L;B;H;kg\nMotorblock;4;120;80;95;310\nGetriebe;6;110;75;80;240");
  assert.strictEqual(kurz(csv), "4x 120x80x95 310kg | 6x 110x75x80 240kg");
  // Gegenprobe: "a; b" mit EINEM Semikolon ist die Freitext-Trennung zweier Positionen.
  const frei = parseCargoText("4x 120x80x100 300kg; 2x 60x40x30 10kg");
  assert.strictEqual(kurz(frei), "4x 120x80x100 300kg | 2x 60x40x30 10kg");
});

test("ohne Kopfzeile gewinnt die plausiblere Spalten-Reihenfolge", () => {
  // Stueckzahl HINTER den Massen: eine 4-cm-"Hoehe" neben 120 "Stueck" ist die
  // vertauschte Lesart -- der Parser wiegt beide Zuordnungen und nimmt die plausible.
  const b = parseCargoText("Motorblock\t120\t80\t95\t4\t310");
  assert.strictEqual(kurz(b), "4x 120x80x95 310kg");
  // Gegenprobe: die Standard-Reihenfolge (Stueckzahl vorn) bleibt Standard.
  const a = parseCargoText("Motorblock\t4\t120\t80\t95\t310");
  assert.strictEqual(kurz(a), "4x 120x80x95 310kg");
});

test("Palette mit zwei Massen bekommt die Standardhoehe statt des Papierkorbs", () => {
  const r = parseCargoText("4 Paletten 120x80, 400kg");
  assert.strictEqual(kurz(r), "4x 120x80x110 400kg");
  assert.strictEqual(r[0].name, "Palette");
  // Preset-Paletten bringen ihr Grundmass weiter selbst mit.
  assert.strictEqual(kurz(parseCargoText("3 Europaletten 400kg")), "3x 120x80x110 400kg");
  // Gegenprobe: eine Zweierkette OHNE Paletten-Stichwort bleibt verworfen -- eine
  // geratene Hoehe fuer ein unbekanntes Packstueck waere eine erfundene Zahl.
  // ("4x 60x40" ist dagegen seit jeher die Dreierkette 4x60x40 und bleibt es.)
  assert.strictEqual(parseCargoText("4 Kisten 60x40").length, 0);
});

test("Fuellwoerter bleiben nicht im Namen haengen", () => {
  assert.strictEqual(parseCargoText("3 Kisten 1,2x0,8x1,1 m je 250 kg")[0].name, "Kisten");
});

test("der Import-Dialog bietet den mm-Verdacht als Vorschlag an", () => {
  // Vertraege im Quelltext: das Banner haengt am Hinweis, der Knopf bestaetigt mit
  // opts.einheit, und beide Sprachen tragen die Texte.
  assert.ok(roh.includes("parseCargoText.hinweis && parseCargoText.hinweis.mmVerdacht &&"), "Banner-Gate fehlt");
  assert.ok(roh.includes('setImportRows(parseCargoText(importText, { einheit: "mm" }))'), "Bestaetigungs-Knopf fehlt");
  assert.ok(roh.includes('impMm: "Die Maße sehen nach Millimetern aus."'), "deutscher Text fehlt");
  assert.ok(roh.includes('impMm: "These dimensions look like millimetres."'), "englischer Text fehlt");
});
