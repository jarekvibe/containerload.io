// Tailwind als feste Datei: tailwind.css statt der Laufzeit von cdn.tailwindcss.com.
//
// Die Laufzeit erzeugte im Browser eine Regel fuer JEDE Klasse, die im Dokument stand --
// eine neue Klasse funktionierte einfach. Die feste Datei kennt nur, was beim letzten Lauf
// von werkzeug/tailwind/bauen.mjs im Quelltext stand. Wer danach eine neue Utility-Klasse
// benutzt und den Generator nicht laufen laesst, bekommt eine Klasse ohne Regel: das Layout
// bricht an genau dieser Stelle, und nichts meldet es.
//
// Dieser Test ist die Meldung. Er liest alle Klassen aus app.html und index.html und
// verlangt fuer jede, dass es eine Regel gibt -- in tailwind.css oder im eigenen <style>
// der Seite. Die CI hat kein Tailwind; sie braucht es dafuer auch nicht.
//
// Faellt er, ist die Antwort fast immer:
//   cd werkzeug/tailwind
//   npm install --no-save tailwindcss@3.4.19 autoprefixer@10.4.21
//   node bauen.mjs
//
// node --test test/tailwind-css.test.mjs
import fs from "node:fs";
import assert from "node:assert";
import test from "node:test";
import { fileURLToPath } from "node:url";
import path from "node:path";

const dir = path.dirname(fileURLToPath(import.meta.url));
const lies = (f) => fs.readFileSync(path.join(dir, "..", f), "utf8");
const SEITEN = ["app.html", "index.html"];
const tailwind = lies("tailwind.css");

// Klassen, die bewusst KEINE Regel haben: reine Haken fuer JavaScript (querySelector) oder
// Marken fuer Tests. Wer hier eine Utility-Klasse eintraegt, um den Test still zu bekommen,
// hat das Problem nicht geloest, sondern versteckt.
const NUR_MARKE = new Set(["brandlogo", "cl-cube", "cbm-calc", "cbm-calc-grid", "clh-dot", "f1"]);

// Alle Klassennamen, fuer die ein Stylesheet eine Regel hat (".lg\:w-\[336px\]" -> "lg:w-[336px]").
const selektoren = (css) =>
  new Set([...css.matchAll(/\.((?:\\.|[A-Za-z0-9_-])+)/g)].map((m) => m[1].replace(/\\(.)/g, "$1")));

// Alle Klassen, die eine Seite benutzt -- an jeder Stelle, an der eine Klasse entstehen kann.
function klassenVon(s) {
  const klassen = new Set();
  const nimm = (liste) => liste.split(/\s+/).filter(Boolean).forEach((t) => klassen.add(t));
  // React: className: "..." -- auch als Auswahl zwischen zwei Literalen (a ? "x" : "y")
  for (const m of s.matchAll(/className:\s*((?:"[^"]*"|[^,{}"])*)/g)) for (const l of m[1].matchAll(/"([^"]*)"/g)) nimm(l[1]);
  // HTML: class="..." -- auch in JavaScript-Zeichenketten (class=\"...\", class='...')
  for (const m of s.matchAll(/\bclass=\\?(["'])(.*?)\\?\1/g)) nimm(m[2]);
  for (const m of s.matchAll(/classList\.(?:add|remove|toggle)\(\s*(['"])([^'"]+)\1/g)) nimm(m[2]);
  for (const m of s.matchAll(/\.className\s*=\s*(['"])([^'"]*)\1/g)) nimm(m[2]);
  return klassen;
}
// Das eigene CSS einer Seite: <style>-Bloecke und <style>-Elemente, die React setzt.
function eigenesCss(s) {
  let css = "";
  for (const m of s.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)) css += m[1];
  for (const m of s.matchAll(/createElement\("style", null, `([\s\S]*?)`\)/g)) css += m[1];
  return css;
}

const TW = selektoren(tailwind);

test("die Auslese findet die Klassen ueberhaupt", () => {
  // Sonst waere der naechste Test gruen, weil er nichts prueft.
  assert.ok(klassenVon(lies("app.html")).size > 100, "app.html: kaum Klassen gefunden -- stimmt die Auslese noch?");
  assert.ok(klassenVon(lies("index.html")).size > 150, "index.html: kaum Klassen gefunden -- stimmt die Auslese noch?");
  assert.ok(TW.size > 150, "tailwind.css: kaum Regeln gefunden");
  for (const k of ["flex", "hidden", "lg:h-screen", "lg:w-[336px]", "hover:brightness-110"]) {
    assert.ok(TW.has(k), `tailwind.css kennt ${k} nicht -- die Selektor-Auslese stimmt nicht mehr`);
  }
});

test("jede benutzte Klasse hat eine Regel -- sonst ist tailwind.css veraltet", () => {
  for (const seite of SEITEN) {
    const s = lies(seite);
    const eigen = selektoren(eigenesCss(s));
    const ohne = [...klassenVon(s)].filter((k) => !TW.has(k) && !eigen.has(k) && !NUR_MARKE.has(k)).sort();
    assert.deepStrictEqual(ohne, [],
      `${seite}: Klasse ohne Regel: ${ohne.join(", ")}\n` +
      "Eine neue Utility-Klasse braucht einen Lauf von werkzeug/tailwind/bauen.mjs (Befehle im Kopf dieser Datei).\n" +
      "Ist es eine reine JavaScript-Marke ohne Aussehen, gehoert sie in NUR_MARKE.");
  }
});

test("die Marken ohne Regel sind wirklich in Gebrauch", () => {
  // Eine Ausnahmeliste, die nur waechst, schuetzt irgendwann nichts mehr.
  const alle = new Set(SEITEN.flatMap((f) => [...klassenVon(lies(f))]));
  const tot = [...NUR_MARKE].filter((k) => !alle.has(k));
  assert.deepStrictEqual(tot, [], "in NUR_MARKE, aber in keiner Seite mehr benutzt: " + tot.join(", "));
});

test("beide Seiten laden die feste Datei -- als LETZTES Stylesheet im <head>", () => {
  // Die Laufzeit haengte ihr <style> ans Ende des <head>, sobald der <body> existierte.
  // Ihre Regeln (auch das Preflight) standen damit NACH dem <style> der Seite und gewannen
  // bei Gleichstand. Die feste Datei muss an derselben Stelle stehen, sonst gilt eine
  // andere Kaskade als die, mit der die Seiten gebaut und angesehen wurden.
  for (const seite of SEITEN) {
    const s = lies(seite);
    const kopf = s.slice(0, s.indexOf("</head>"));
    assert.ok(!/cdn\.tailwindcss\.com/.test(kopf), `${seite}: laedt wieder die Laufzeit vom CDN`);
    const link = '<link rel="stylesheet" href="tailwind.css" />';
    assert.strictEqual(kopf.split(link).length - 1, 1, `${seite}: tailwind.css ist nicht genau einmal eingebunden`);
    const danach = kopf.slice(kopf.indexOf(link) + link.length);
    assert.ok(!/<style[\s>]|rel="stylesheet"/.test(danach),
      `${seite}: nach tailwind.css steht noch ein Stylesheet im <head> -- die Reihenfolge der Kaskade ist eine andere als bisher`);
  }
});

test("die Datei sagt, woher sie kommt", () => {
  assert.match(tailwind, /^\/\* Tailwind CSS 3\.\d+\.\d+ /, "der Kopf nennt die Tailwind-Version nicht");
  assert.ok(tailwind.includes("werkzeug/tailwind/bauen.mjs"), "der Kopf nennt den Generator nicht");
  // Die drei Schichten der Laufzeit: das Preflight gehoert dazu.
  assert.ok(/\*,\s*::?before,\s*::?after\s*\{[^}]*box-sizing:\s*border-box/.test(tailwind), "das Preflight (base) fehlt");
});
