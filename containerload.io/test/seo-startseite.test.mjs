// Die Startseiten-Snippets: die Suchbegriffe, fuer die es das Produkt gibt.
//
// GSC-Befund (28 Tage): "container loading calculator" und Verwandte holen
// Impressionen auf Position 38-79, und keine Seite zielte darauf -- der Titel
// war schlicht "ContainerLoad". Titel und Beschreibung tragen jetzt die
// Kategorie ("Containerbeladung berechnen" / "container loading calculator"),
// je Sprache, in den harten Snippet-Grenzen (Titel <= 60, Beschreibung <= 155).
//
// node --test test/seo-startseite.test.mjs
import fs from "node:fs";
import assert from "node:assert";
import test from "node:test";
import { fileURLToPath } from "node:url";
import path from "node:path";

const dir = path.dirname(fileURLToPath(import.meta.url));
const roh = fs.readFileSync(path.join(dir, "..", "index.html"), "utf8");

test("der deutsche Titel nennt die Kategorie und haelt die Schnittgrenzen", () => {
  const titel = (roh.match(/<title>([^<]+)<\/title>/) || [])[1];
  assert.ok(titel, "kein <title>");
  assert.ok(/Containerbeladung/i.test(titel), `Titel ohne Kategorie: "${titel}"`);
  assert.ok(titel.length <= 60, `Titel ${titel.length} Zeichen`);
  const desc = (roh.match(/<meta name="description" content="([^"]+)"/) || [])[1];
  assert.ok(desc && desc.length <= 155, `Beschreibung ${desc ? desc.length : 0} Zeichen`);
  assert.ok(/Laderechner/i.test(desc), "Beschreibung ohne Laderechner");
});

test("die englische Fassung zielt auf 'container loading calculator'", () => {
  // Die EN-Kopfdaten stehen im META-Objekt und werden beim Sprachwechsel gesetzt.
  const m = roh.match(/en:\{t:'([^']+)',\s*\n\s*d:'([^']+)',/);
  assert.ok(m, "EN META nicht gefunden");
  const [, t, d] = m;
  assert.ok(/container loading calculator/i.test(t), `EN-Titel ohne Kategorie: "${t}"`);
  assert.ok(t.length <= 60, `EN-Titel ${t.length} Zeichen`);
  assert.ok(/container loading calculator/i.test(d), "EN-Beschreibung ohne Kategorie");
  assert.ok(d.length <= 155, `EN-Beschreibung ${d.length} Zeichen`);
  // Und einmal sichtbar im Text, nicht nur im Kopf: die Unterzeile des Heros.
  assert.ok(/hero_sub": "The free 3D container loading calculator/.test(roh),
    "die EN-Unterzeile traegt die Kategorie nicht mehr sichtbar");
});
