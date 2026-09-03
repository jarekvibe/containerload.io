// Die Search Console zeigte sechs Ratgeber-Seiten mit brauchbarer Position und NULL
// Klicks -- ein Snippet-Problem, kein Ranking-Problem. Die ueberarbeiteten Snippets
// folgen zwei harten Regeln (Titel <= 60 Zeichen, Beschreibung <= 155, sonst schneidet
// Google ab) und muessen in allen drei Ausspielungen gleich lauten (title, og, twitter),
// sonst zeigt LinkedIn etwas anderes als die Suche.
import fs from "node:fs";
import assert from "node:assert";
import test from "node:test";
import { fileURLToPath } from "node:url";
import path from "node:path";

const dir = path.dirname(fileURLToPath(import.meta.url));
// zahl: true, wo die Antwort der Seite EINE Zahl ist (Palettenzahlen, Stellplaetze) --
// dort gehoert sie in den Titel, das ist das Klick-Argument. Formel- und Anleitungs-
// Seiten (CBM, Stauplan) verkaufen den Rechner bzw. die Schritte, nicht eine Zahl.
const SEITEN = [
  { f: "ratgeber/europaletten-20-fuss-container.html", zahl: true },
  { f: "ratgeber/europaletten-40-fuss-container.html", zahl: true },
  { f: "ratgeber/cbm-berechnen.html", zahl: false },
  { f: "ratgeber/stellplaetze-container.html", zahl: true },
  { f: "ratgeber/stauplan-container.html", zahl: false },
  { f: "ratgeber/industriepaletten-container.html", zahl: true }
];
const lese = (p) => fs.readFileSync(path.join(dir, "..", p), "utf8");
const greif = (s, re, was, f) => {
  const m = s.match(re);
  assert.ok(m, `${f}: ${was} nicht gefunden`);
  return m[1];
};

for (const { f, zahl } of SEITEN) {
  test(`Snippet-Schnitt: ${f}`, () => {
    const s = lese(f);
    const titel = greif(s, /<title>([^<]+)<\/title>/, "Titel", f);
    const desc = greif(s, /<meta name="description" content="([^"]+)"/, "Beschreibung", f);
    assert.ok(titel.length <= 60, `Titel ${titel.length} Zeichen: "${titel}"`);
    assert.ok(desc.length <= 155, `Beschreibung ${desc.length} Zeichen`);
    // Eine Zahl im Titel ist das Klick-Argument -- ein Titel ohne Zahl faellt zurueck
    // in die Frage-Form, die null Klicks geholt hat.
    if (zahl) assert.ok(/\d/.test(titel), `Titel ohne Zahl: "${titel}"`);
    // og/twitter muessen woertlich mitziehen, sonst erzaehlt Social etwas anderes.
    assert.strictEqual(greif(s, /property="og:title" content="([^"]+)"/, "og:title", f), titel, "og:title weicht ab");
    assert.strictEqual(greif(s, /name="twitter:title" content="([^"]+)"/, "twitter:title", f), titel, "twitter:title weicht ab");
    assert.strictEqual(greif(s, /property="og:description" content="([^"]+)"/, "og:description", f), desc, "og:description weicht ab");
    assert.strictEqual(greif(s, /name="twitter:description" content="([^"]+)"/, "twitter:description", f), desc, "twitter:description weicht ab");
    // Der Canonical bleibt, was er war: die Datei ohne .html im Domain-Root-Pfad.
    const can = greif(s, /<link rel="canonical" href="([^"]+)"/, "Canonical", f);
    assert.strictEqual(can, "https://containerload.io/" + f.replace(/\.html$/, ""), "Canonical veraendert");
  });
}
