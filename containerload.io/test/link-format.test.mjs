// "Ladung per Link uebergeben" -- die Doku des ?q=-Formats (/ratgeber/ladeplan-per-link,
// /en/guide/load-plan-by-link) und /llms.txt (26.11.26).
//
// Warum es die Seiten gibt: Der Link /app?q=... ist seit jeher der Weg, auf dem die
// Wissensseiten und die Import-Box der Startseite eine Ladung an den Rechner uebergeben --
// beschrieben war er nirgends. Die Zugriffsdaten zeigen, dass KI-Assistenten die Seite
// bereits lesen (ChatGPT holte die Startseite 30-mal an einem Tag); ein Sprachmodell kann
// nicht verlaesslich packen, aber es kann diesen Link bauen. Dasselbe gilt fuer Excel und ERP.
//
// Eine Beschreibung, die nicht stimmt, ist schlimmer als keine: wer nach ihr einen Link baut
// und einen anderen Plan bekommt, glaubt dem Werkzeug nicht mehr. Deshalb liest dieser Test
// JEDES Beispiel der Seiten durch den echten Parser und JEDE Parameter-Liste aus app.html.
//
// node --test test/link-format.test.mjs
import fs from "node:fs";
import assert from "node:assert";
import test from "node:test";
import { fileURLToPath } from "node:url";
import path from "node:path";

const dir = path.dirname(fileURLToPath(import.meta.url));
const wurzel = path.join(dir, "..");
const lese = (p) => fs.readFileSync(path.join(wurzel, p), "utf8");
const app = lese("app.html"), L = app.split("\n");
const von = L.findIndex((l) => l.includes("var PALLET_PRESETS = [")), bis = L.findIndex((l, i) => i > von && l.includes("var hexA"));
const { parseCargoText } = new Function(L.slice(von, bis).join("\n") + "\nreturn { parseCargoText };")();
const lesen = (t) => parseCargoText(t).map((r) => [r.qty, r.l, r.w, r.h, r.weight, r.stackable, r.stackH]);
const SEITEN = { de: "ratgeber/ladeplan-per-link.html", en: "en/guide/load-plan-by-link.html" };
const html = Object.fromEntries(Object.entries(SEITEN).map(([k, p]) => [k, lese(p)]));
const llms = lese("llms.txt");
const B = "https://containerload.io";
// Die Listen des Rechners -- aus dem Quelltext, nicht abgeschrieben
const schluessel = (anker) => { const i = L.findIndex((l) => l.includes(anker)); return Object.keys(new Function("return " + L.slice(i, i + 8).join("\n").match(/const k = (\{[\s\S]*?\});/)[1])()); };
const CONT = schluessel("var QCONT = (() => {"), FZ = schluessel("var QFZ = (() => {");
const EINHEITEN = new Function("return " + app.match(/var EINHEITEN = (\[[^\]]*\])/)[1])();
const SPRACHEN = ["en", ...Object.keys(new Function("return " + app.match(/window\.CL_SPRACHEN = (\{[^\n]*\});/)[1])())];
const param = (adresse) => new URLSearchParams(adresse.slice(adresse.indexOf("?") + 1));

// Was jedes Beispiel ergeben muss: Menge, L, B, H, kg, stapelbar, Hoehengrenze
const SOLL = {
  kurz: [[20, 120, 80, 110, 300, true, null]],
  zwei: [[8, 120, 80, 100, 250, true, null], [12, 60, 40, 40, 12, false, null]],
  hoch: [[18, 120, 80, 110, 300, true, 180]],
  lkw: [[33, 120, 80, 150, 400, false, null]],
  zoll: [[9, 121.92, 101.6, 139.7, 498.951607, true, null]],
};
const MEHR = { kurz: {}, zwei: {}, hoch: { cont: "40hc" }, lkw: { d: "road" }, zoll: { cont: "20gp", u: "in" } };

test("jedes Beispiel der Seiten liest der Rechner genau so -- gezeigter Link und Knopf sind derselbe", () => {
  for (const [k, s] of Object.entries(html)) {
    const bsp = [...s.matchAll(/<div class="formula" data-bsp="([a-z]+)">([^<]*)<\/div>\s*<p><a href="([^"]*)">/g)];
    assert.deepStrictEqual(bsp.map((m) => m[1]), Object.keys(SOLL), `${k}: die Beispiele der Seite`);
    for (const [, name, gezeigt, href] of bsp) {
      const g = param(gezeigt.replace(/&amp;/g, "&")), h = param(href);
      assert.ok(gezeigt.startsWith(B + "/app?") && href.startsWith("/app?"), `${k}/${name}: Adresse`);
      assert.deepStrictEqual([...g.entries()], [...h.entries()], `${k}/${name}: der gezeigte Link ist nicht der, den der Knopf oeffnet`);
      assert.deepStrictEqual(lesen(h.get("q")), SOLL[name], `${k}/${name}: ${h.get("q")}`);
      const rest = Object.fromEntries([...h.entries()].filter(([p]) => p !== "q" && p !== "lang"));
      assert.deepStrictEqual(rest, MEHR[name], `${k}/${name}: Parameter`);
      assert.strictEqual(h.get("lang"), k === "en" ? "en" : null, `${k}/${name}: Sprache`);
    }
    // Der Knopf am Ende: das Zwei-Positionen-Beispiel im 40' HC
    const cta = param(/<a class="btn btn-primary" href="(\/app\?[^"]*q=[^"]*)">/.exec(s)[1]);
    assert.deepStrictEqual(lesen(cta.get("q")), SOLL.zwei, `${k}: der Knopf am Ende`);
    assert.strictEqual(cta.get("cont"), "40hc");
  }
});

test("die Parameter-Tabellen nennen genau, was der Rechner annimmt", () => {
  assert.deepStrictEqual(EINHEITEN, ["cm", "mm", "in"]);
  for (const [k, s] of Object.entries(html)) {
    const zeile = (p) => { const m = new RegExp(`<tr><td><code>${p}</code></td><td>.*?</td><td>(.*?)</td></tr>`).exec(s); assert.ok(m, `${k}: Zeile ${p} fehlt`); return [...m[1].matchAll(/<code>([^<]+)<\/code>/g)].map((x) => x[1]); };
    assert.deepStrictEqual(zeile("cont"), CONT, `${k}: Container-Kuerzel`);
    assert.deepStrictEqual(zeile("d=road"), FZ, `${k}: Fahrzeug-Kuerzel`);
    assert.deepStrictEqual(zeile("u"), EINHEITEN, `${k}: Einheiten`);
    assert.deepStrictEqual(zeile("lang"), SPRACHEN, `${k}: Sprachen`);
  }
  // ... und der Rechner liest sie so, wie die Seite es sagt: cont, d und fz nur mit q
  assert.ok(app.includes('if (!QIMPORT || QROAD) return null;') && app.includes('var QROAD = !!(QIMPORT && new URLSearchParams(window.location.search).get("d") === "road");') && app.includes("if (!QROAD) return null;"));
  assert.ok(/QCONT \|\| \(DRAFT && DRAFT\.preset\) \|\| "20' GP"/.test(app), "ohne cont beginnt der Rechner nicht mehr mit dem 20-Fuss-Standard");
});

test("was die Seiten ueber das Schreiben einer Position behaupten, stimmt", () => {
  // Ein Komma trennt nicht, Semikolon und Zeilenumbruch trennen
  assert.strictEqual(parseCargoText("8 Kisten 120x80x100 250kg, 12 Kartons 60x40x40 12kg").length, 1);
  assert.strictEqual(parseCargoText("8 Kisten 120x80x100 250kg; 12 Kartons 60x40x40 12kg").length, 2);
  assert.strictEqual(parseCargoText("8 crates 120x80x100 250kg\n12 cartons 60x40x40 12kg").length, 2);
  for (const s of Object.values(html)) assert.ok(/<b>(Ein Komma trennt nicht|A comma does not separate)<\/b>/.test(s) && s.includes("<code>%0A</code>"));
  // Die Beispiele der Tabelle, Zelle fuer Zelle
  for (const [t, soll] of [
    ["5x 120x80x100", [5, 120, 80, 100]], ["3 Kisten 1200x800x1100 mm", [3, 120, 80, 110]], ["9 pallets 48x40x55 inch", [9, 121.92, 101.6, 139.7]],
    ["11 Europaletten", [11, 120, 80, 110]], ["11 euro pallets", [11, 120, 80, 110]], ["4 Industriepaletten", [4, 120, 100, 110]], ["4 industrial pallets", [4, 120, 100, 110]],
  ]) { const r = parseCargoText(t); assert.deepStrictEqual([r[0].qty, r[0].l, r[0].w, r[0].h], soll, t); }
  for (const [t, kg] of [["2 Kisten 100x80x60 300kg", 300], ["2 Kisten 100x80x60 2,4 t", 2400], ["2 crates 100x80x60 2.4 t", 2400], ["2 crates 100x80x60 1100 lbs", 498.951607]]) assert.strictEqual(parseCargoText(t)[0].weight, kg, t);
  assert.strictEqual(parseCargoText("2 Kisten 100x80x60 nicht drehbar")[0].rotatable, false);
  assert.strictEqual(parseCargoText("2 crates 100x80x60 not rotatable")[0].rotatable, false);
  // Die Woerter der anderen Sprachen, die die Seiten nennen
  for (const s of Object.values(html)) {
    const woerter = [...(/(?:Chinesisch|Chinese) — (.*?)<\/p>/.exec(s)[1]).matchAll(/<code>([^<]+)<\/code>/g)].map((m) => m[1]);
    assert.ok(woerter.length >= 4, "die Beispielwoerter der anderen Sprachen fehlen");
    for (const w of woerter) assert.strictEqual(parseCargoText(`5 x 60x40x40 ${w}`)[0].stackable, false, w);
  }
  // Die Excel-Zeile: Menge, Bezeichnung, Masse, Gewicht -- und die Formel baut genau sie
  const r = parseCargoText("4 Motorblock 120x80x95 310kg")[0];
  assert.deepStrictEqual([r.qty, r.name, r.l, r.w, r.h, r.weight], [4, "Motorblock", 120, 80, 95, 310]);
  assert.ok(html.de.includes('URLCODIEREN(B2 &amp; " " &amp; A2 &amp; " " &amp; C2 &amp; "x" &amp; D2 &amp; "x" &amp; E2 &amp; " " &amp; F2 &amp; "kg"); "In 3D ansehen")') && html.de.includes("<code>4 Motorblock 120x80x95 310kg</code>"));
  assert.ok(html.en.includes('ENCODEURL(B2 &amp; " " &amp; A2 &amp; " " &amp; C2 &amp; "x" &amp; D2 &amp; "x" &amp; E2 &amp; " " &amp; F2 &amp; "kg"), "View in 3D")') && html.en.includes("app?lang=en&amp;q="));
  assert.strictEqual(parseCargoText("4 Engine block 120x80x95 310kg")[0].name, "Engine block");
});

test("ein Link bringt die Hoehengrenze mit in den Plan (stapelbar bis 180 cm)", () => {
  // Bis 26.11.26 las der Parser die Grenze, und der Link-Weg liess sie fallen: der Plan
  // stapelte frei. Hier laeuft die echte Uebernahme aus app.html, mit einer nachgestellten Adresse.
  const a = L.findIndex((l) => l.includes("var QIMPORT = (() => {")), b = L.findIndex((l, i) => i > a && l.trim() === "})();");
  const qimport = (q) => new Function("window", "parseCargoText", "uid", L.slice(a, b + 1).join("\n") + "\nreturn QIMPORT;")({ location: { search: "?q=" + encodeURIComponent(q) } }, parseCargoText, () => "c0");
  const mit = qimport("18 Paletten 120x80x110 300kg stapelbar bis 180 cm")[0], ohne = qimport("18 Paletten 120x80x110 300kg")[0], nie = qimport("18 Paletten 120x80x110 nicht stapelbar")[0];
  assert.strictEqual(mit.stackH, 180);
  assert.strictEqual(ohne.stackH, null);
  assert.deepStrictEqual([nie.stackable, nie.stackH], [false, null]);
  assert.deepStrictEqual([mit.qty, mit.l, mit.w, mit.h, mit.weight, mit.stackable, mit.rotatable], [18, 120, 80, 110, 300, true, true]);
  // Dieselbe Uebernahme wie im Import-Fenster
  assert.ok(/stackH: num\(r\.stackH\) > 0 \? num\(r\.stackH\) : null/.test(app), "applyImport uebernimmt die Hoehengrenze nicht mehr");
});

test("ehrlich: keine Schnittstelle, kein Rueckkanal, die Ladung steht lesbar im Link", () => {
  assert.ok(/ohne Schnittstelle/.test(html.de) && /<b>Kein Rückkanal:<\/b>/.test(html.de) && /<b>Der Link enthält die Ladung lesbar\.<\/b>/.test(html.de) && /keine VGM/.test(html.de));
  assert.ok(/no API/.test(html.en) && /<b>No return channel:<\/b>/.test(html.en) && /<b>The link contains the cargo in readable form\.<\/b>/.test(html.en) && /not a VGM/.test(html.en));
  // Die KI rechnet nicht -- der Rechner gibt die Antwort
  assert.ok(/<b>die Antwort gibt dann der Rechner<\/b>/.test(html.de) && /<b>the calculator then gives the answer<\/b>/.test(html.en));
  for (const [k, s] of Object.entries(html)) assert.ok(s.includes('href="/llms.txt"') && s.includes(k === "de" ? 'href="/datenschutz"' : 'href="/en/privacy"'), k);
  // Die Laengen-Angabe passt zur Sperre der Startseite (6.000 kodierte Zeichen)
  assert.ok(lese("index.html").includes("if(enc.length>6000)") && html.de.includes("2.000 Zeichen") && html.en.includes("2,000 characters"));
});

test("das Netz: Paar, Uebersichten, Sitemap, Startseiten-Tabelle", () => {
  const [de, en] = [SEITEN.de, SEITEN.en].map((p) => p.replace(".html", ""));
  for (const s of Object.values(html)) for (const z of [`hreflang="de" href="${B}/${de}"`, `hreflang="en" href="${B}/${en}"`, `hreflang="x-default" href="${B}/${de}"`]) assert.ok(s.includes(`<link rel="alternate" ${z} />`), z);
  assert.ok(lese("ratgeber/index.html").includes(`href="/${de}"`) && lese("en/guide/index.html").includes(`href="/${en}"`), "die Uebersichten verlinken die Seiten nicht");
  const sm = lese("sitemap.xml");
  for (const p of [de, en]) assert.ok(sm.includes(`<loc>${B}/${p}</loc>`), `Sitemap: ${p}`);
  assert.ok(lese("index.html").includes(`'/${de}':'/${en}'`), "die Startseite kennt das Paar nicht");
  for (const [k, s] of Object.entries(html)) {
    const titel = /<title>(.*?)<\/title>/.exec(s)[1], desc = /<meta name="description" content="([^"]*)"/.exec(s)[1];
    assert.ok(titel.length <= 60 && desc.length >= 110 && desc.length <= 155, `${k}: Titel ${titel.length}, Beschreibung ${desc.length}`);
    const ld = JSON.parse(/<script type="application\/ld\+json">(.*?)<\/script>/s.exec(s)[1]);
    assert.ok(ld["@type"] === "FAQPage" && ld.mainEntity.length === 3);
    // Die Antwort im Schema nennt dieselben Kuerzel wie die Tabelle
    for (const c of CONT) assert.ok(ld.mainEntity[1].acceptedAnswer.text.includes(c), `${k}: ${c} fehlt in der Antwort`);
  }
});

test("llms.txt: stimmt mit dem Rechner ueberein, und jede genannte Seite gibt es", () => {
  assert.ok(llms.startsWith("# ContainerLoad\n\n> "), "Aufbau: Titel, dann die Kurzbeschreibung");
  assert.ok(llms.length < 8000, "llms.txt soll kurz bleiben");
  // Jede Adresse auf containerload.io zeigt auf eine Datei, die es gibt
  const adressen = [...llms.matchAll(/https:\/\/containerload\.io(\/[^\s)<\]]*)?/g)].map((m) => (m[1] || "/").replace(/[.,]$/, ""));
  assert.ok(adressen.length >= 20);
  for (const a of adressen) {
    if (a.startsWith("/app?")) continue;
    const p = a.replace(/\/$/, "/index").replace(/^\//, "");
    assert.ok(fs.existsSync(path.join(wurzel, (p || "index") + ".html")), `llms.txt nennt ${a} — die Seite gibt es nicht`);
  }
  // Jede Sprache des Rechners mit ihrer Startseite
  for (const k of SPRACHEN) assert.ok(llms.includes(`${B}/${k}/`), `llms.txt: Startseite /${k}/ fehlt`);
  // Die Beispiel-Links: derselbe Parser, dieselben Ergebnisse wie auf der Seite
  const links = adressen.filter((a) => a.startsWith("/app?")).map(param).filter((p) => p.get("q") && !/</.test(p.get("q")));
  assert.strictEqual(links.length, 5);
  const ergebnisse = links.map((p) => JSON.stringify(lesen(p.get("q"))));
  for (const soll of Object.values(SOLL)) assert.ok(ergebnisse.includes(JSON.stringify(soll)), "ein Beispiel der Seite fehlt in llms.txt oder liest anders");
  for (const p of links) { assert.strictEqual(p.get("lang"), "en"); if (p.get("cont")) assert.ok(CONT.includes(p.get("cont"))); }
  // Die Listen
  assert.ok(llms.includes(`cont (optional): ${CONT.join(", ")}.`), "Container-Kuerzel");
  assert.ok(llms.includes(`fz picks the vehicle: ${FZ.join(", ")}.`), "Fahrzeug-Kuerzel");
  assert.ok(llms.includes(`lang (optional): ${SPRACHEN.join(", ")}.`), "Sprachen");
  // Ehrlich: keine Schnittstelle, die Rechnung macht der Rechner, das Ergebnis ist eine Schaetzung
  assert.ok(/There is no API and no result is returned as data/.test(llms) && /do not estimate the count yourself/.test(llms) && /geometric estimate/.test(llms) && /not a VGM/.test(llms));
  assert.ok(/a comma does NOT separate positions/.test(llms));
  // robots.txt sperrt die Datei nicht
  assert.ok(!/Disallow:\s*\/llms/.test(lese("robots.txt")));
});
