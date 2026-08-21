// Der Container Guide: die englische Fassung des Container-Wissens unter /en/guide/.
//
// WARUM EIGENE ADRESSEN und nicht ?lang=en: Es sind eigene Seiten mit eigenen Titeln und
// eigenen Fragen ("How many euro pallets fit in a 40ft container?"). Genau danach wird
// gesucht, und genau so sollen sie indexiert werden. Verknuepft werden die beiden Fassungen
// ueber hreflang — nicht ueber den Pfad.
//
// Was hier festgehalten wird, ist die PAARIGKEIT. Eine Uebersetzung, die nur in eine
// Richtung zeigt, ist fuer Google keine: Google verlangt, dass beide Seiten sich
// gegenseitig nennen. Und eine Seite ohne Gegenstueck faellt beim naechsten Umbau lautlos
// aus der Reihe.
//
// node --test test/container-guide-en.test.mjs
import fs from "node:fs";
import assert from "node:assert";
import test from "node:test";
import { fileURLToPath } from "node:url";
import path from "node:path";

const dir = path.dirname(fileURLToPath(import.meta.url));
const wurzel = path.join(dir, "..");
const lies = (p) => fs.readFileSync(path.join(wurzel, p), "utf8");
const SITE = "https://containerload.io";

const de_seiten = fs.readdirSync(path.join(wurzel, "ratgeber")).filter((f) => f.endsWith(".html"));
const en_seiten = fs.readdirSync(path.join(wurzel, "en", "guide")).filter((f) => f.endsWith(".html"));

// Die Paare stehen NICHT in diesem Test, sondern werden aus den Seiten selbst gelesen:
// jede englische Seite nennt ihre deutsche Fassung im hreflang. Abgeschrieben waere die
// Liste die naechste Kopie, die wegdriftet.
const paare = en_seiten.map((f) => {
  const s = lies(`en/guide/${f}`);
  const de = (s.match(/hreflang="de" href="[^"]*\/ratgeber\/([^"]*)"/) || [])[1];
  assert.ok(de !== undefined, `en/guide/${f}: nennt keine deutsche Fassung`);
  return { en: f, de: (de === "" ? "index" : de) + ".html", enSlug: f.replace(/\.html$/, ""), deSlug: de };
});

test("jede deutsche Seite hat genau eine englische und umgekehrt", () => {
  assert.strictEqual(en_seiten.length, de_seiten.length,
    `${de_seiten.length} deutsche, ${en_seiten.length} englische Seiten`);
  const genannt = paare.map((p) => p.de).sort();
  assert.deepStrictEqual(genannt, de_seiten.slice().sort(),
    "die englischen Seiten zeigen nicht auf genau die deutschen Seiten, die es gibt");
  assert.strictEqual(new Set(paare.map((p) => p.en)).size, paare.length, "zwei englische Seiten teilen sich eine Adresse");
});

test("beide Fassungen nennen einander — hreflang zeigt in BEIDE Richtungen", () => {
  for (const { en, de, enSlug, deSlug } of paare) {
    const enUrl = enSlug === "index" ? `${SITE}/en/guide/` : `${SITE}/en/guide/${enSlug}`;
    const deUrl = deSlug === "" ? `${SITE}/ratgeber/` : `${SITE}/ratgeber/${deSlug}`;
    for (const [datei, quelle] of [[`en/guide/${en}`, lies(`en/guide/${en}`)], [`ratgeber/${de}`, lies(`ratgeber/${de}`)]]) {
      assert.ok(quelle.includes(`<link rel="alternate" hreflang="de" href="${deUrl}" />`), `${datei}: hreflang de fehlt oder zeigt woanders hin`);
      assert.ok(quelle.includes(`<link rel="alternate" hreflang="en" href="${enUrl}" />`), `${datei}: hreflang en fehlt oder zeigt woanders hin`);
      // x-default auf die deutsche Fassung — Deutsch ist die Ausgangssprache, wie im Rechner auch.
      assert.ok(quelle.includes(`<link rel="alternate" hreflang="x-default" href="${deUrl}" />`), `${datei}: x-default fehlt`);
    }
    // Und das canonical zeigt auf die EIGENE Adresse, nicht auf die andere Fassung.
    assert.ok(lies(`en/guide/${en}`).includes(`<link rel="canonical" href="${enUrl}" />`), `en/guide/${en}: canonical stimmt nicht`);
  }
});

test("die englischen Seiten sind auch wirklich englisch", () => {
  // Nicht die Uebersetzungsqualitaet, sondern das, was beim Kopieren stehenbleibt:
  // deutsche Auszeichnung, deutsche Textbausteine, deutsches lang-Attribut.
  const verraeter = ["Ohne Gewähr", "Container-Wissen", "stapelbar", "Innenmaße", "Fuß-Container", "3D-Rechner", "Zur Startseite", "Verwandte Fragen"];
  for (const f of en_seiten) {
    const s = lies(`en/guide/${f}`);
    assert.ok(/<html lang="en">/.test(s), `en/guide/${f}: lang-Attribut steht nicht auf en`);
    const treffer = verraeter.filter((v) => s.includes(v));
    assert.deepStrictEqual(treffer, [], `en/guide/${f}: deutscher Text stehengeblieben — ${treffer.join(", ")}`);
    assert.ok(/<title>.{15,}<\/title>/.test(s), `en/guide/${f}: Titel fehlt`);
    assert.ok(/<meta name="description" content=".{40,}"/.test(s), `en/guide/${f}: Beschreibung fehlt oder ist zu kurz`);
  }
});

test("kein Titel und keine Beschreibung kommt zweimal vor", () => {
  // Zwei Seiten mit demselben Titel konkurrieren im Suchergebnis miteinander.
  for (const feld of [/<title>(.*?)<\/title>/s, /<meta name="description" content="(.*?)"/s]) {
    const werte = en_seiten.map((f) => (lies(`en/guide/${f}`).match(feld) || [])[1]);
    assert.strictEqual(new Set(werte).size, werte.length, `doppelter Eintrag: ${werte.join(" | ")}`);
  }
});

test("die englischen Seiten teilen sich dieselbe Gestaltung wie die deutschen", () => {
  // Dieselbe Regel wie in container-wissen.test.mjs, nur fuer den zweiten Baum: EINE Datei,
  // keine eigenen Regeln, keine Verlaeufe. Eine Kopie unter /en/ waere genau die zweite
  // Fassung, die irgendwann wegdriftet.
  for (const f of en_seiten) {
    const s = lies(`en/guide/${f}`);
    assert.ok(s.includes('href="/ratgeber/wissen.css"'), `en/guide/${f}: laedt die gemeinsame Gestaltung nicht`);
    assert.ok(!/<style[\s>]/.test(s), `en/guide/${f}: bringt eigene Regeln mit`);
    assert.ok(!/linear-gradient|radial-gradient/.test(s), `en/guide/${f}: Farbverlauf`);
    assert.ok(!/family=Inter|'Inter'/.test(s), `en/guide/${f}: laedt Inter`);
    assert.ok(s.includes('content="#0E1116"'), `en/guide/${f}: abweichende theme-color`);
    assert.ok(/<span class="brand-name">Container<span class="brand-load">Load<\/span><\/span>/.test(s),
      `en/guide/${f}: Schriftzug ist nicht EIN Element`);
  }
});

test("jede Seite traegt den Sprachumschalter — und er zeigt auf die Uebersetzung", () => {
  // Ohne ihn ist die zweite Fassung nur ueber Google erreichbar.
  for (const { en, enSlug, deSlug } of paare) {
    const s = lies(`en/guide/${en}`);
    const deHref = deSlug === "" ? "/ratgeber/" : `/ratgeber/${deSlug}`;
    assert.ok(s.includes(`<div class="lang"`), `en/guide/${en}: kein Sprachumschalter`);
    assert.ok(s.includes(`href="${deHref}" hreflang="de"`), `en/guide/${en}: DE zeigt nicht auf die eigene Uebersetzung`);
  }
  for (const { de, enSlug } of paare) {
    const s = lies(`ratgeber/${de}`);
    const enHref = enSlug === "index" ? "/en/guide/" : `/en/guide/${enSlug}`;
    assert.ok(s.includes(`<div class="lang"`), `ratgeber/${de}: kein Sprachumschalter`);
    assert.ok(s.includes(`href="${enHref}" hreflang="en"`), `ratgeber/${de}: EN zeigt nicht auf die eigene Uebersetzung`);
  }
});

test("kein englischer Link zeigt versehentlich in den deutschen Baum", () => {
  // Ausgenommen: der Sprachumschalter (das ist sein Zweck), die gemeinsame CSS-Datei und
  // die Rechtsseiten, die es nur auf Deutsch gibt.
  for (const f of en_seiten) {
    const s = lies(`en/guide/${f}`).replace(/<div class="lang"[\s\S]*?<\/div>/, "").replace(/hreflang="de" href="[^"]*"/g, "");
    const treffer = [...s.matchAll(/href="(\/ratgeber\/[^"]*)"/g)].map((m) => m[1]).filter((h) => h !== "/ratgeber/wissen.css");
    assert.deepStrictEqual(treffer, [], `en/guide/${f}: zeigt in den deutschen Baum — ${treffer.join(", ")}`);
    // Und der Rechner wird auf Englisch geoeffnet.
    const app = [...s.matchAll(/href="(\/app(?:\?[^"]*)?)"/g)].map((m) => m[1]); // /apple-touch-icon.png faengt sonst mit
    assert.ok(app.length > 0, `en/guide/${f}: verlinkt den Rechner gar nicht`);
    for (const a of app) assert.ok(/[?&]lang=en\b/.test(a), `en/guide/${f}: ${a} oeffnet den Rechner auf Deutsch`);
  }
});

test("Netlify kennt die neuen Adressen", () => {
  const r = lies("_redirects");
  for (const z of ["/en/guide            /en/guide/index.html    200",
                   "/en/guide/           /en/guide/index.html    200",
                   "/en/guide/:slug      /en/guide/:slug.html    200"]) {
    assert.ok(r.includes(z), `_redirects fehlt die Zeile: ${z}`);
  }
});

test("die Sitemap fuehrt beide Fassungen — jede mit der vollen Alternativenliste", () => {
  // Nach der Sitemap-Spezifikation muss JEDE Sprachfassung eine eigene <url> bekommen,
  // und jede davon die vollstaendige Liste nennen — auch sich selbst.
  const sm = lies("sitemap.xml");
  const bloecke = [...sm.matchAll(/<url>([\s\S]*?)<\/url>/g)].map((m) => m[1]);
  for (const { enSlug, deSlug } of paare) {
    const enUrl = enSlug === "index" ? `${SITE}/en/guide/` : `${SITE}/en/guide/${enSlug}`;
    const deUrl = deSlug === "" ? `${SITE}/ratgeber/` : `${SITE}/ratgeber/${deSlug}`;
    for (const loc of [enUrl, deUrl]) {
      const b = bloecke.find((x) => x.includes(`<loc>${loc}</loc>`));
      assert.ok(b, `sitemap.xml: ${loc} fehlt`);
      assert.ok(b.includes(`hreflang="de" href="${deUrl}"`), `sitemap.xml (${loc}): Alternative de fehlt`);
      assert.ok(b.includes(`hreflang="en" href="${enUrl}"`), `sitemap.xml (${loc}): Alternative en fehlt`);
      assert.ok(b.includes(`hreflang="x-default" href="${deUrl}"`), `sitemap.xml (${loc}): x-default fehlt`);
    }
  }
});

test("die Startseite haengt ihre Wissens-Links auf Englisch um", () => {
  // Sonst schickt die englische Startseite ihre Besucher auf deutsche Seiten. Die Tabelle
  // in index.html muss deshalb GENAU die Seiten kennen, die es gibt.
  const start = lies("index.html");
  const tab = start.slice(start.indexOf("var GUIDE={"), start.indexOf("var GUIDE_ZURUECK"));
  assert.ok(tab.length > 100, "index.html hat keine GUIDE-Tabelle mehr");
  for (const { enSlug, deSlug } of paare) {
    const de = deSlug === "" ? "/ratgeber/" : `/ratgeber/${deSlug}`;
    const en = enSlug === "index" ? "/en/guide/" : `/en/guide/${enSlug}`;
    assert.ok(tab.includes(`'${de}':'${en}'`), `index.html: die Zuordnung ${de} -> ${en} fehlt`);
  }
  // Und der alte Satz "diese Seiten sind auf Deutsch" darf nicht stehenbleiben.
  assert.ok(!/reference pages are written in German/.test(start),
    "index.html behauptet auf Englisch weiterhin, die Seiten gebe es nur auf Deutsch");
});
