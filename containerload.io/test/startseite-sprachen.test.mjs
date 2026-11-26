// Die Startseite in weiteren Sprachen (/es/ ...). Erzeugt von werkzeug/startseite-en.mjs aus
// index.html und werkzeug/sprachen/<kuerzel>.mjs -- dieselbe Fabrik wie fuer /en/.
//
// Festgehalten wird:
//   * jede Sprachseite ist Zeichen fuer Zeichen das, was der Generator baut (kein Handeingriff,
//     und wer index.html aendert, ohne den Generator laufen zu lassen, faellt hier auf);
//   * die Sprachdatei traegt genau die Schluessel des EN-Woerterbuchs und uebersetzt JEDEN
//     Text, der in den Skripten der Seite steht (Hero-Demo, CBM-Rechner);
//   * auf der Seite steht kein englischer Skript-Text mehr und kein deutscher Fliesstext;
//   * Kopf, Schema, Links (Rechner in dieser Sprache, kein Link in den deutschen Baum),
//     Sprachknoepfe, hreflang auf ALLEN Startseiten, Sitemap, Weiterleitung;
//   * der Rechner der Sprache zeigt auf diese Startseite zurueck.
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import assert from "node:assert";
import { fileURLToPath } from "node:url";
import { SPRACHEN, startseiteSprache, startseiteEn, woerterbuch, inlineTexte, guideTabelle } from "../../werkzeug/startseite-en.mjs";

const dir = path.dirname(fileURLToPath(import.meta.url));
const lies = (p) => fs.readFileSync(path.join(dir, "..", p), "utf8");
const de = lies("index.html");
const EN = woerterbuch(de);
const ohneSkript = (h) => h.replace(/<script\b[\s\S]*?<\/script>/g, "").replace(/<style\b[\s\S]*?<\/style>/g, "");
// Sichtbarer Text samt der Beschriftungen in Attributen. Zwei Dinge sind keine Sprache der
// Seite: die Beispiel-Adresse im Teilen-Bild und der Fachbegriff "open top". Die Namen der
// Sprachen und die Leiste "available in English" (nur auf der deutschen Seite sichtbar) bleiben.
const sichtbar = (h) => {
  const o = ohneSkript(h.slice(h.indexOf("<body")));
  const attribute = [...o.matchAll(/(?:aria-label|title|alt|placeholder)="([^"]*)"/g)].map((m) => m[1]).filter((t) => !/^(Deutsch|English|Language|Dismiss)$/.test(t)).join(" ");
  return (o.replace(/<div id="langbar"[\s\S]*?<\/div>/, " ").replace(/<[^>]+>/g, " ") + " " + attribute).replace(/&[a-z]+;/g, " ").replace(/containerload\.io\/share\S*/g, " ").replace(/open top/gi, " ").replace(/\s+/g, " ");
};

test("es gibt mindestens Spanisch, und index.html kennt jede Sprachseite", () => {
  assert.ok(SPRACHEN.some((X) => X.kuerzel === "es"));
  const fremd = new Function("return " + /FREMD=(\[[^\]]*\])/.exec(de)[1])();
  assert.deepStrictEqual(fremd.slice().sort(), ["en", ...SPRACHEN.map((X) => X.kuerzel)].sort(), "FREMD in index.html und die Sprachen des Generators weichen ab");
});

for (const X of SPRACHEN) {
  const K = X.kuerzel;
  const seite = lies(K + "/index.html");

  test(`${K}: die Datei ist genau das, was der Generator aus index.html baut`, () => {
    assert.strictEqual(seite, startseiteSprache(de, X), `${K}/index.html ist veraltet -- node werkzeug/startseite-en.mjs laufen lassen`);
  });

  test(`${K}: gleiche Schluessel wie Englisch, und jeder Skript-Text ist uebersetzt`, () => {
    assert.deepStrictEqual(Object.keys(X.texte).sort(), Object.keys(EN).sort());
    for (const [k, v] of Object.entries(X.texte)) {
      assert.ok(typeof v === "string" && v.trim(), `${K}.${k} ist leer`);
      // HTML im Wert: dieselben Tags wie im Englischen (sonst zerbricht das Layout)
      const tags = (t) => (t.match(/<\/?[a-z]+/g) || []).join(" ");
      assert.strictEqual(tags(v), tags(EN[k]), `${K}.${k}: andere HTML-Tags als im Englischen`);
    }
    assert.strictEqual(X.texte.ld_features.split("|").length, EN.ld_features.split("|").length);
    assert.ok(X.texte.meta_t.length <= 62 && X.texte.meta_d.length <= 160, "Titel/Beschreibung zu lang fuers Suchergebnis");
    const alle = inlineTexte(de);
    assert.ok(alle.length > 60, "zu wenige Skript-Texte gefunden -- stimmt das Muster noch?");
    for (const t of alle) {
      assert.ok(X.inline[t] !== undefined, `${K}: Skript-Text "${t}" hat keine Uebersetzung`);
      // Platzhalter muessen dieselben bleiben, sonst steht {n} im Bild
      const platz = (s) => (s.match(/\{[A-Za-z]+\}/g) || []).sort().join(",");
      assert.strictEqual(platz(X.inline[t]), platz(t), `${K}: Platzhalter in "${t}" → "${X.inline[t]}"`);
    }
    for (const t of Object.keys(X.inline)) assert.ok(alle.includes(t), `${K}: "${t}" steht nicht (mehr) in index.html`);
  });

  test(`${K}: Kopf, Schema und Sprache der Seite`, () => {
    assert.ok(seite.includes(`<html lang="${K}"`));
    assert.ok(seite.includes(`<title>${X.texte.meta_t}</title>`));
    assert.ok(seite.includes(`<link rel="canonical" href="https://containerload.io/${K}/" />`));
    assert.ok(seite.includes(`<meta property="og:url" content="https://containerload.io/${K}/"`));
    const ld = JSON.parse(/<script type="application\/ld\+json">(.*?)<\/script>/s.exec(seite)[1]);
    assert.strictEqual(ld.url, `https://containerload.io/${K}/`);
    assert.strictEqual(ld.description, X.texte.ld_d);
    assert.strictEqual(ld.offers.price, "0", "das Schema behauptet einen Preis");
    // Das Woerterbuch der Seite ist das dieser Sprache (die Skripte lesen daraus)
    assert.deepStrictEqual(woerterbuch(seite), X.texte);
    // Kein englischer Skript-Text mehr: jeder en-Platz traegt die Uebersetzung
    const rest = inlineTexte(seite).filter((t) => !Object.values(X.inline).includes(t));
    assert.deepStrictEqual(rest, [], `${K}: englische Skript-Texte auf der Seite`);
  });

  test(`${K}: Links -- Rechner in dieser Sprache, Wissen nie im deutschen Baum`, () => {
    const koerper = seite.slice(seite.indexOf("<body"));
    const links = [...koerper.matchAll(/<a\b[^>]*>/g)].map((m) => m[0]).filter((a) => !/data-lang=/.test(a)).map((a) => (/href="([^"]*)"/.exec(a) || [])[1]).filter(Boolean);
    assert.ok(links.length > 20);
    const GUIDE = guideTabelle(de);
    for (const h of links) {
      if (/^\/app(\?|$)/.test(h)) assert.ok(new RegExp("[?&]lang=" + K + "(&|$)").test(h), `Rechner-Link ohne lang=${K}: ${h}`);
      assert.ok(!/^\/ratgeber\//.test(h), `Link in den deutschen Baum: ${h}`);
      assert.notStrictEqual(h, "/", "Start-Link zeigt auf die deutsche Seite");
      assert.ok(!/^\/en\/$/.test(h), "Start-Link zeigt auf die englische Seite");
    }
    // Wissens-Links: die Seite dieser Sprache, wo es sie gibt, sonst die englische
    for (const [von, enZiel] of Object.entries(GUIDE)) {
      const ziel = X.guide[von] || enZiel;
      if (de.includes(`href="${von}"`)) assert.ok(koerper.includes(`href="${ziel}"`), `${von} zeigt nicht auf ${ziel}`);
    }
    for (const ziel of Object.values(X.guide)) assert.ok(fs.existsSync(path.join(dir, "..", ziel.replace(/^\//, "") + (ziel.endsWith("/") ? "index.html" : ".html"))), `${ziel} gibt es nicht`);
    // Sprachknoepfe: dieser ist aktiv, DE und EN bleiben Links auf ihre Seiten
    // Sprach-Menue (Kopfzeile + Mobilmenue): diese Sprache ist aktiv und steht im Knopf, die
    // anderen bleiben Links auf ihre Seiten -- mit vollem Namen, nicht als Kuerzel-Reihe
    assert.strictEqual((seite.match(new RegExp(`<a data-lang="${K}" href="/${K}/" hreflang="${K}" class="langbtn on">${X.name}</a>`, "g")) || []).length, 2);
    assert.strictEqual((seite.match(new RegExp(`<span class="langcur">${K.toUpperCase()}</span>`, "g")) || []).length, 2);
    assert.strictEqual((seite.match(/<a data-lang="de" href="\/" hreflang="de" class="langbtn">Deutsch<\/a>/g) || []).length, 2);
    assert.strictEqual((seite.match(/<a data-lang="en" href="\/en\/" hreflang="en" class="langbtn">English<\/a>/g) || []).length, 2);
    assert.strictEqual((seite.match(/<details class="langmenu/g) || []).length, 2, "die Sprachwahl ist kein Aufklapp-Menue");
    assert.ok(!seite.includes('class="langswitch'), "die alte Knopfreihe ist noch da");
  });

  test(`${K}: kein deutscher und kein englischer Fliesstext auf der Seite`, () => {
    const t = sichtbar(seite);
    // Woerter, die es in der Sprache der Seite genauso gibt, sind kein Rest (Niederlaendisch:
    // "die" und "der" -- "een QR-code die terugleidt").
    // "pallets" und "calculator" schreibt das Niederlaendische wie das Englische.
    const GLEICH = { nl: ["die", "der", "pallets", "calculator"] }[K] || [];
    const deutsch = (t.match(/\b(und|der|die|das|nicht|kostenlos|Ladung|Rechner|Packstück\w*|Paletten|ohne|oder|für|öffnen|Werkzeug|Design|Packliste|einfügen|Dunkles|Helles)\b/g) || []).filter((w) => !GLEICH.includes(w));
    assert.deepStrictEqual([...new Set(deutsch)], [], `${K}: deutsche Woerter im sichtbaren Text`);
    const englisch = (t.match(/\b(the|and|your|free|without|pallets|calculator|loading|share|open|with)\b/gi) || []).filter((w) => !GLEICH.includes(w.toLowerCase()));
    assert.deepStrictEqual([...new Set(englisch.map((w) => w.toLowerCase()))], [], `${K}: englische Woerter im sichtbaren Text`);
  });

  test(`${K}: hreflang auf allen Startseiten, Sitemap, Weiterleitung, Rueckweg aus dem Rechner`, () => {
    const zeile = `<link rel="alternate" hreflang="${K}" href="https://containerload.io/${K}/" />`;
    for (const [name, html] of [["index.html", de], ["en/index.html", startseiteEn(de)], [K + "/index.html", seite]]) assert.ok(html.includes(zeile), `${name}: hreflang ${K} fehlt`);
    assert.ok(seite.includes('<link rel="alternate" hreflang="x-default" href="https://containerload.io/" />'));
    const karte = lies("sitemap.xml");
    assert.ok(karte.includes(`<loc>https://containerload.io/${K}/</loc>`), "steht nicht in der Sitemap");
    for (const loc of ["https://containerload.io/", "https://containerload.io/en/", `https://containerload.io/${K}/`]) {
      const block = karte.split("<url>").find((b) => b.includes(`<loc>${loc}</loc>`));
      assert.ok(block && block.includes(`hreflang="${K}" href="https://containerload.io/${K}/"`), `Sitemap-Block ${loc} nennt ${K} nicht`);
    }
    // /?lang=<k> leitet Netlify ueber die Platzhalter-Regel auf /<k>/
    assert.match(lies("_redirects"), /^\/\s+lang=:lang\s+\/:lang\/\s+301!$/m);
    // Der Rechner dieser Sprache kennt seine Startseite
    assert.ok(lies(`sprache/${K}.js`).includes(`start: "/${K}/"`), "der Rechner zeigt nicht auf diese Startseite zurueck");
    assert.ok(lies("app.html").includes('(SPRACHE_MEHR[LANG] && SPRACHE_MEHR[LANG].start) || "/en/"'));
  });
}

test("die deutsche Seite schickt gemerkte und erzwungene Sprachen auf ihre Seite -- nur bekannte", () => {
  const a = de.indexOf("  function kennt(l){"), e = de.indexOf("  if(SEITE!=='de'&&erzwungen){");
  assert.ok(a > 0 && e > a);
  const lauf = (search, gemerkt) => {
    let ziel = null;
    const location = { search, hash: "", replace: (u) => { ziel = u; } };
    const localStorage = { getItem: () => gemerkt || null };
    new Function("location", "localStorage", "SEITE", "FREMD", de.slice(a, e).replace(/return; \}\s*$/, "}"))(location, localStorage, "de", ["en", ...SPRACHEN.map((X) => X.kuerzel)]);
    return ziel;
  };
  assert.strictEqual(lauf("?lang=es"), "/es/");
  assert.strictEqual(lauf("?lang=ES-mx"), "/es/");
  assert.strictEqual(lauf("?lang=en"), "/en/");
  assert.strictEqual(lauf("", "es"), "/es/");
  assert.strictEqual(lauf("?lang=de", "es"), null, "die Adresse schlaegt die gemerkte Wahl");
  for (const fremd of ["?lang=qq", "?lang=xx", "?lang=//evil.example", ""]) assert.strictEqual(lauf(fremd), null, `"${fremd}" leitet um`);
  assert.strictEqual(lauf("", "//evil.example"), null);
});
