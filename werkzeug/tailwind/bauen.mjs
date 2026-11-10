// Erzeugt containerload.io/tailwind.css -- das Tailwind-CSS fuer app.html und index.html
// als feste, eingecheckte Datei.
//
// WARUM: Bis November 2026 luden beide Seiten die Tailwind-LAUFZEIT von cdn.tailwindcss.com:
// ein Skript von rund 470 KB, das im Browser bei jedem Aufruf dieselben paar Regeln neu
// erzeugt. Tailwind selbst nennt diesen Weg ausdruecklich "nicht fuer den Produktivbetrieb".
// Er kostete den groessten vermeidbaren Posten der Ladezeit, liess die Seite ungestaltet
// aufblitzen, bis das Skript fertig war, und gab die IP-Adresse jedes Besuchers an einen
// weiteren Server. Das fertige CSS ist ein Zwanzigstel so gross.
//
// Das ist KEIN Build-Schritt der Seite: die Ausgabe ist eingecheckt, beide Seiten laufen
// durch blosses Oeffnen. ABER: wer in app.html oder index.html eine Utility-Klasse benutzt,
// die es bisher nicht gab, muss dieses Skript einmal laufen lassen -- sonst fehlt ihre Regel.
// test/tailwind-css.test.mjs faellt genau dann und nennt die Klasse.
//
//   cd werkzeug/tailwind
//   npm install --no-save tailwindcss@3.4.19 autoprefixer@10.4.21
//   node bauen.mjs
//
// DREI DINGE SIND DER LAUFZEIT NACHGEBAUT (gelesen aus dem CDN-Skript, nicht geraten):
//   1. Dieselben drei Schichten in derselben Reihenfolge: base (Preflight), components,
//      utilities -- mit der Standard-Konfiguration, ohne Plugins.
//   2. Autoprefixer mit remove:false, wie dort.
//   3. Die Laufzeit haengt ihr <style> erst ans ENDE des <head>, sobald der <body> existiert.
//      Ihre Regeln stehen damit NACH dem <style> der Seite und gewinnen bei Gleichstand.
//      Deshalb muss <link href="tailwind.css"> in beiden Seiten das LETZTE Stylesheet im
//      <head> sein (der Test prueft das). Stuende es weiter oben, wuerde z. B. das Preflight
//      eine Regel der Seite nicht mehr ueberschreiben, die es heute ueberschreibt.
//
// Bewusst NICHT minifiziert: gzip macht aus 24 KB ohnehin rund 5, und eine lesbare Datei
// zeigt im Diff, welche Regel dazugekommen ist. Ein Minifizierer, der Regeln zusammenlegt,
// waere ausserdem eine weitere Stelle, an der sich die Reihenfolge aendern koennte.
//
// Der Unterschied, der bleibt: die Laufzeit erzeugte Regeln nur fuer Klassen, die gerade im
// Dokument standen; hier entstehen sie fuer jede Klasse, die im Quelltext vorkommt. Das ist
// eine Obermenge -- eine Regel mehr schadet nicht, eine fehlende wuerde man sehen.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const hier = path.dirname(fileURLToPath(import.meta.url));
const SEITE = path.join(hier, "..", "..", "containerload.io");
const QUELLEN = ["app.html", "index.html"];
const ZIEL = path.join(SEITE, "tailwind.css");

const require = createRequire(import.meta.url);
let postcss, tailwindcss, autoprefixer, version;
try {
  postcss = require("postcss");
  tailwindcss = require("tailwindcss");
  autoprefixer = require("autoprefixer");
  version = require("tailwindcss/package.json").version;
} catch (e) {
  console.error("Die Werkzeuge fehlen. In werkzeug/tailwind:\n  npm install --no-save tailwindcss@3.4.19 autoprefixer@10.4.21\n\n" + e.message);
  process.exit(1);
}

const konfig = {
  content: QUELLEN.map((q) => path.join(SEITE, q)),
  theme: { extend: {} },
  plugins: [],
};
const { css } = await postcss([
  tailwindcss(konfig),
  autoprefixer({ remove: false, overrideBrowserslist: ["defaults"] }),
]).process("@tailwind base;@tailwind components;@tailwind utilities;", { from: undefined });

const kopf = "/* Tailwind CSS " + version + " fuer " + QUELLEN.join(" und ") + ".\n" +
  " * Erzeugt von werkzeug/tailwind/bauen.mjs -- nicht von Hand aendern.\n" +
  " * Neue Utility-Klasse in einer der beiden Seiten? Dann den Generator laufen lassen;\n" +
  " * test/tailwind-css.test.mjs sagt, welche Klasse fehlt.\n" +
  " * Tailwind CSS: MIT License, Copyright (c) Tailwind Labs, Inc. */\n";
fs.writeFileSync(ZIEL, kopf + css + "\n");
console.log("containerload.io/tailwind.css: " + fs.statSync(ZIEL).size + " B (Tailwind " + version + ")");
