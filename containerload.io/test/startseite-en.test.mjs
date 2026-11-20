// Die englische Startseite /en/ (seit 20.11.26).
//
// Vorher war sie /?lang=en: dasselbe HTML, per Skript uebersetzt. Die Websuche zeigte sie
// mit dem DEUTSCHEN Titel ("Containerbeladung in 3D berechnen — ContainerLoad" unter
// containerload.io/?lang=en), englische Werkzeug-Anfragen standen auf Platz 80+. Jetzt ist
// sie eine eigene Datei, erzeugt von werkzeug/startseite-en.mjs aus index.html. Der Test:
//   * die Datei ist GENAU das, was der Generator aus index.html macht (keine Handarbeit,
//     kein Auseinanderlaufen -- wer index.html aendert, muss neu erzeugen)
//   * englisch in Text, Kopf, Schema und Links
//   * die alte Adresse ist ueberall abgeloest (Links, hreflang, Sitemap, 301)
//
// node --test test/startseite-en.test.mjs
import fs from "node:fs";
import assert from "node:assert";
import test from "node:test";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { startseiteEn, woerterbuch, guideTabelle } from "../../werkzeug/startseite-en.mjs";

const dir = path.dirname(fileURLToPath(import.meta.url));
const wurzel = path.join(dir, "..");
const lies = (p) => fs.readFileSync(path.join(wurzel, p), "utf8");
const de = lies("index.html"), en = lies("en/index.html");
const EN = woerterbuch(de);

test("en/index.html ist genau das, was der Generator aus index.html macht", () => {
  assert.ok(en === startseiteEn(de),
    "en/index.html ist veraltet oder von Hand geaendert -- node werkzeug/startseite-en.mjs laufen lassen");
});

test("englisch: Sprache, Titel, Beschreibung, kanonische Adresse, Schema", () => {
  assert.ok(en.includes('<html lang="en"'), "lang ist nicht en");
  assert.strictEqual(en.match(/<title>([^<]+)<\/title>/)[1], EN.meta_t);
  assert.ok(/^3D /.test(EN.meta_t) && /container loading calculator/i.test(EN.meta_t) && EN.meta_t.length <= 60, `EN-Titel: ${EN.meta_t}`);
  assert.ok(en.includes(`<meta name="description" content="${EN.meta_d}" />`) && EN.meta_d.length <= 155);
  for (const [sel, wert] of [['property="og:title"', EN.meta_ot], ['name="twitter:title"', EN.meta_ot], ['property="og:description"', EN.meta_od], ['name="twitter:description"', EN.meta_od]]) {
    assert.ok(en.includes(`<meta ${sel} content="${wert}" />`), `${sel} nicht englisch`);
  }
  assert.ok(en.includes('<link rel="canonical" href="https://containerload.io/en/" />'), "canonical zeigt nicht auf /en/");
  assert.ok(en.includes('<meta property="og:url" content="https://containerload.io/en/" />'));
  const ld = JSON.parse(en.match(/<script type="application\/ld\+json">(.*?)<\/script>/s)[1]);
  assert.strictEqual(ld.url, "https://containerload.io/en/");
  assert.strictEqual(ld.offers.price, "0");
  assert.ok(ld.featureList.every((f) => !/[äöüß]|Laderechner|Ladeplan/i.test(f)), "Schema-Funktionen nicht englisch");
});

test("beide Fassungen zeigen per hreflang aufeinander, die DE-Seite bleibt Standard", () => {
  for (const [name, s] of [["DE", de], ["EN", en]]) {
    assert.ok(s.includes('<link rel="alternate" hreflang="de" href="https://containerload.io/" />'), `${name}: hreflang de`);
    assert.ok(s.includes('<link rel="alternate" hreflang="en" href="https://containerload.io/en/" />'), `${name}: hreflang en`);
    assert.ok(s.includes('<link rel="alternate" hreflang="x-default" href="https://containerload.io/" />'), `${name}: x-default`);
  }
});

test("der Text ist englisch: jeder data-i18n-Block traegt den englischen Inhalt", () => {
  const koerper = en.slice(en.indexOf("<body"));
  let geprueft = 0;
  for (const [, key] of koerper.matchAll(/data-i18n="([^"]+)"/g)) {
    assert.ok(key in EN, `${key} ohne englischen Text`);
    geprueft++;
  }
  assert.ok(geprueft > 60, `nur ${geprueft} Bloecke`);
  // Stichproben: Ueberschrift mit Suchbegriff, keine deutschen Reste im sichtbaren Text
  assert.ok(en.includes("3D load calculator for containers &amp; trucks"), "h1-Kopfzeile nicht englisch");
  const sichtbar = koerper.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/g, "").replace(/<[^>]+>/g, " ");
  for (const wort of ["Paletten statt", "Häufige Fragen", "kostenlos öffnen", "Packliste einfügen", "Zum Nachschlagen"]) {
    assert.ok(!sichtbar.includes(wort), `deutscher Rest auf /en/: "${wort}"`);
  }
});

test("Links auf /en/: Rechner englisch, Wissen auf dem Guide, Start auf /en/", () => {
  const koerper = en.slice(en.indexOf("<body"));
  const hrefs = [...koerper.matchAll(/<a\b[^>]*href="([^"]+)"[^>]*>/g)].map((m) => ({ h: m[1], tag: m[0] }));
  assert.ok(hrefs.length > 20);
  for (const { h, tag } of hrefs) {
    if (/data-lang="de"/.test(tag)) { assert.strictEqual(h, "/", "der DE-Knopf muss auf / zeigen"); continue; }
    assert.ok(!h.startsWith("/ratgeber/"), `deutscher Wissens-Link auf /en/: ${h}`);
    if (/^\/app(\?|$)/.test(h)) assert.ok(/[?&]lang=en\b/.test(h), `Rechner-Link ohne lang=en: ${h}`);
    assert.ok(h !== "/" && h !== "/?lang=en", `Link zurueck auf die deutsche oder alte Startseite: ${h}`);
  }
  // Jeder deutsche Wissens-Link der DE-Startseite hat seinen Zwilling in der GUIDE-Tabelle
  const G = guideTabelle(de);
  for (const [, h] of de.slice(de.indexOf("<body")).matchAll(/href="(\/ratgeber\/[^"]*)"/g)) {
    assert.ok(G[h], `GUIDE kennt ${h} nicht -- auf /en/ bliebe er deutsch`);
  }
  // Aktiver Sprachknopf
  assert.ok(/class="langbtn on">EN<\/a>/.test(en) && !/class="langbtn on">DE<\/a>/.test(en), "EN-Knopf nicht aktiv");
  assert.ok(/class="langbtn on">DE<\/a>/.test(de) && !/class="langbtn on">EN<\/a>/.test(de), "DE-Knopf nicht aktiv");
});

test("die alte Adresse /?lang=en ist ueberall abgeloest", () => {
  // Kein Link einer Seite zeigt mehr auf die alte Adresse ...
  const seiten = [];
  const suche = (d) => {
    for (const f of fs.readdirSync(path.join(wurzel, d), { withFileTypes: true })) {
      const p = path.join(d, f.name);
      if (f.isDirectory() && !["test", "node_modules", "netlify"].includes(f.name)) suche(p);
      else if (f.name.endsWith(".html")) seiten.push(p);
    }
  };
  suche(".");
  assert.ok(seiten.length > 40);
  for (const p of seiten) {
    const s = lies(p);
    assert.ok(!s.includes('href="/?lang=en"') && !s.includes('"https://containerload.io/?lang=en"'), `${p} zeigt auf /?lang=en`);
  }
  // ... die Sitemap fuehrt /en/ ...
  const sm = lies("sitemap.xml");
  assert.ok(!sm.includes("https://containerload.io/?lang=en"), "Sitemap fuehrt noch /?lang=en");
  assert.ok(sm.includes("<loc>https://containerload.io/en/</loc>"), "Sitemap ohne /en/");
  // ... Netlify leitet um (Platzhalter, weil Netlify den Wert nicht pruefen kann) ...
  const rd = lies("_redirects");
  assert.ok(/^\/\s+lang=:lang\s+\/:lang\/\s+301!$/m.test(rd), "301 fuer /?lang= fehlt");
  assert.ok(rd.search(/^\/\s+lang=:lang/m) < rd.search(/^\/index\.html\s/m), "die Regel muss vor den uebrigen stehen");
  // ... und ?lang=de findet ueber die DATEI /de/ zurueck. Netlify haengt beim 301 die
  // Abfrage an (gesehen live: /?lang=en -> /en/?lang=en). Eine Regel /de/ -> / bekaeme
  // ?lang=de also mit und landete wieder bei der Platzhalter-Regel: Schleife. Deshalb darf
  // es diese Regel NICHT geben, und de/index.html schickt ohne Parameter zurueck.
  assert.ok(!/^\/de\/?\s/m.test(rd), "eine Umleitung /de/ -> / liefe mit ?lang=de im Kreis");
  const dePfad = lies("de/index.html");
  assert.ok(dePfad.includes('<meta http-equiv="refresh" content="0;url=/" />'), "/de/ ohne Rueckweg (ohne JS)");
  assert.ok(dePfad.includes("location.replace('/'+location.hash)"), "/de/ ohne Rueckweg (mit JS)");
  assert.ok(dePfad.includes("localStorage.setItem('cl_lang','de')"), "/de/ merkt sich die Wahl nicht -- wer frueher EN gewaehlt hat, landete sonst auf /en/");
  assert.ok(!/location\.(replace|href)[^;]*search/.test(dePfad), "/de/ darf die Abfrage nicht mitnehmen");
  // Die englische Seite raeumt das angehaengte ?lang=en aus der Adresse
  assert.ok(de.includes("if(SEITE==='en'&&erzwungen){ try{var rest=location.search.replace(/([?&])lang=[^&]*(&|$)/,'$1').replace(/[?&]$/,''); history.replaceState(null,'',location.pathname+rest+location.hash);}catch(e){} }"));
  for (const [vor, nach] of [["?lang=en", ""], ["?lang=en&utm=x", "?utm=x"], ["?utm=x&lang=en", "?utm=x"], ["?a=1&lang=en&b=2", "?a=1&b=2"]]) {
    assert.strictEqual(vor.replace(/([?&])lang=[^&]*(&|$)/, "$1").replace(/[?&]$/, ""), nach, `Aufraeumen von ${vor}`);
  }
  // ... und das Skript der deutschen Seite faengt die alte Adresse auch ohne Netlify ab
  assert.ok(de.includes("if(SEITE==='de'&&(erzwungen==='en'||(!erzwungen&&gemerkt==='en'))){ try{location.replace('/en/'+location.hash);}catch(e){} return; }"));
  // Der Rechner verlinkt seine Startseite richtig
  assert.ok(lies("app.html").includes('var homeHref = LANG === "en" ? "/en/" : "/";'));
});
