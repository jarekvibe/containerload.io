// Die Sprach-Wellen: je Sprache vier Wissensseiten plus Uebersicht (es/guia/, fr/guide/), nach
// dem Muster der NL-Welle. Ohne sie stuende fuer die Sprache nur EINE Seite in der Suche (die
// Startseite). Dieselben Regeln wie immer: jede Zahl kommt aus dem Packer bzw. aus PRESETS,
// die Draufsicht zeichnet exakt die Stellplaetze, der Knopf laedt genau die genannte Menge --
// und das hreflang-Netz ist ein sauberes FUENFER-Cluster (de/en/nl/es/fr + x-default) auf
// allen Fassungen.
//
// Anders als die NL-Seiten fuehren diese in einen Rechner in IHRER Sprache (?lang=es / fr).
//
// Eine weitere Welle = ein Eintrag in WELLEN und eine Spalte in CLUSTER; die Zahl der
// hreflang-Zeilen rechnet der Test aus der Spaltenzahl.
import fs from "node:fs";
import assert from "node:assert";
import test from "node:test";
import { fileURLToPath } from "node:url";
import path from "node:path";

const dir = path.dirname(fileURLToPath(import.meta.url));
const app = fs.readFileSync(path.join(dir, "..", "app.html"), "utf8");
const L = app.split("\n");
const pStart = L.findIndex((l) => l.includes("var PRESETS = {"));
const pEnd = L.findIndex((l, i) => i > pStart && l.trim() === "};");
const ps = L.findIndex((l) => l.includes("function makeFloorPacker"));
const pe = L.findIndex((l, i) => i > ps && l.trim() === "}" && L[i - 1].includes("return { placed, perType"));
const { makeFloorPacker, PRESETS } = new Function(
  'var num=(v,d=0)=>Number.isFinite(+v)&&v!==""?+v:d;\n'
  + L.slice(pStart, pEnd + 1).join("\n") + "\n"
  + L.slice(ps, pe + 1).join("\n") + "\nreturn { makeFloorPacker, PRESETS };"
)();
const pa = L.findIndex((l) => l.includes("var PALLET_PRESETS = [")), pb = L.findIndex((l, i) => i > pa && l.includes("var hexA"));
const { parseCargoText } = new Function(L.slice(pa, pb).join("\n") + "\nreturn { parseCargoText };")();
const lese = (p) => fs.readFileSync(path.join(dir, "..", p), "utf8");
const B = "https://containerload.io";

// Spalten: de, en, nl, es, fr. Zeilen: 20-Fuss-Paletten, 40-Fuss-Paletten, Kubikmeter, Masse.
const SPALTEN = ["de", "en", "nl", "es", "fr"];
const NAMEN = { de: "Deutsch", en: "English", nl: "Nederlands", es: "Español", fr: "Français" };
const CLUSTER = [
  ["ratgeber/europaletten-20-fuss-container", "en/guide/euro-pallets-20ft-container", "nl/gids/europallets-20ft-container", "es/guia/europalets-contenedor-20-pies", "fr/guide/europalettes-conteneur-20-pieds"],
  ["ratgeber/europaletten-40-fuss-container", "en/guide/euro-pallets-40ft-container", "nl/gids/europallets-40ft-container", "es/guia/europalets-contenedor-40-pies", "fr/guide/europalettes-conteneur-40-pieds"],
  ["ratgeber/container-volumen-cbm", "en/guide/container-volume-cbm", "nl/gids/cbm-container", "es/guia/metros-cubicos-contenedor", "fr/guide/volume-conteneur-m3"],
  ["ratgeber/container-masse-innenmasse", "en/guide/container-internal-dimensions", "nl/gids/container-afmetingen", "es/guia/medidas-contenedor", "fr/guide/dimensions-conteneur"],
];
// Je Welle: Ordner, og:locale, und woran man erkennt, dass fremder Text stehengeblieben ist.
// Die Fremdwort-Liste nennt nur Woerter, die es in der Sprache der Seite NICHT gibt.
const WELLEN = {
  es: {
    ordner: "es/guia", locale: "es_ES",
    fremd: /\b(passen|hoeveel|de calculator|niet|één|und|nicht|Paletten|pallets passen|how many|the|with|combien|avec|conteneur)\b/gi,
    nurEnDe: /ingl[eé]s o alem[aá]n/i,
  },
  fr: {
    ordner: "fr/guide", locale: "fr_FR",
    fremd: /\b(passen|hoeveel|de calculator|niet|één|und|nicht|Paletten|pallets passen|how many|the|with|cuántos|caben|palets|contenedor)\b/gi,
    nurEnDe: /(qu’|uniquement |seulement )en anglais (ou|et) en allemand/i,
  },
};
const spalte = (k) => SPALTEN.indexOf(k);
const seiten = (k) => CLUSTER.map((c) => c[spalte(k)]);

for (const [k, W] of Object.entries(WELLEN)) {
  const [s20, s40, sM3, sMass] = seiten(k);
  const K = k.toUpperCase();

  test(`${K}: die Palettenzahlen kommen aus dem Packer -- und der Knopf laedt genau sie`, () => {
    const C20 = PRESETS["20' GP"], C40 = PRESETS["40' GP"];
    const faelle = [
      [s20 + ".html", C20, 11, 8, 22, null],
      [s40 + ".html", C40, 25, 20, 50, "40gp"],
    ];
    for (const [f, C, lage, ohne, zwei, cont] of faelle) {
      assert.strictEqual(makeFloorPacker(120, 80, true)(C.l, C.w).count, lage);
      assert.strictEqual(makeFloorPacker(120, 80, false)(C.l, C.w).count, ohne);
      assert.strictEqual(zwei, 2 * lage);
      const s = lese(f);
      for (const z of [lage, ohne, zwei]) assert.ok(new RegExp(`\\b${z}\\b`).test(s), `${f}: die Zahl ${z} fehlt`);
      // Das SVG zeichnet exakt die Stellplaetze der ersten Lage plus den Umriss.
      const m = s.match(/<figure class="stau">([\s\S]*?)<\/figure>/);
      assert.ok(m, `${f}: keine Draufsicht`);
      assert.strictEqual((m[1].match(/<rect /g) || []).length, lage + 1, `${f}: SVG-Stellplaetze`);
      // Der Knopf: durch den echten Parser genau die genannte Menge Europaletten, im richtigen Container
      const links = [...s.matchAll(new RegExp(`href="/app\\?lang=${k}&q=([^"&]+)(?:&cont=([a-z0-9]+))?"`, "g"))];
      assert.ok(links.length >= 2, `${f}: Rechner-Knoepfe fehlen`);
      for (const [, q, c] of links) {
        const rows = parseCargoText(decodeURIComponent(q));
        assert.strictEqual(rows.length, 1);
        assert.deepStrictEqual([rows[0].qty, rows[0].l, rows[0].w], [lage, 120, 80], `${f}: der Knopf laedt eine andere Ladung`);
        assert.strictEqual(c || null, cont, `${f}: der Knopf waehlt den falschen Container vor`);
      }
    }
    // Das Container-Kuerzel gibt es im Rechner
    assert.ok(/QCONT[\s\S]{0,400}40gp/.test(app), "40gp ist im Rechner kein bekanntes Kuerzel");
  });

  test(`${K}: die Kubikmeter sind aus den PRESETS gerechnet (eine Nachkommastelle)`, () => {
    const s = lese(sM3 + ".html");
    for (const name of ["20' GP", "40' GP", "40' HC", "45' HC"]) {
      const P = PRESETS[name];
      const m3 = (P.l * P.w * P.h / 1e6).toFixed(1).replace(".", ",");
      assert.ok(s.includes(`${m3} m³`), `${sM3}: ${name} = ${m3} m³ fehlt`);
      assert.ok(s.includes(`${P.l} × ${P.w} × ${P.h} cm`), `${sM3}: Innenmass ${name} fehlt`);
    }
  });

  test(`${K}: die Mass-Tabellen tragen die PRESETS-Innenmasse und -Tueren`, () => {
    const s = lese(sMass + ".html");
    for (const name of ["20' GP", "20' HC", "40' GP", "40' HC", "45' HC"]) {
      const P = PRESETS[name];
      for (const v of [P.l, P.w, P.h]) assert.ok(new RegExp(`\\b${v} cm\\b`).test(s), `${sMass}: ${name} — ${v} cm fehlt`);
      assert.ok(s.includes(`${Math.round(P.door.w)} × ${Math.round(P.door.h)} cm`), `${sMass}: Tuer ${name} fehlt`);
    }
    // Aussenmasse sind ISO-668-Normwerte
    for (const t of ["606 × 244 × 259 cm", "1219 × 244 × 259 cm", "1219 × 244 × 290 cm", "1372 × 244 × 290 cm"]) assert.ok(s.includes(t), `${sMass}: ${t} fehlt`);
  });

  test(`${K}: Suchergebnis -- Titel mit Zahl oder Thema, Laengen im Schnitt, og/twitter gleichlautend`, () => {
    for (const f of [...seiten(k), W.ordner + "/index"]) {
      const s = lese(f + ".html");
      const titel = /<title>(.*?)<\/title>/.exec(s)[1], desc = /<meta name="description" content="([^"]*)"/.exec(s)[1];
      assert.ok(titel.length <= 60, `${f}: Titel ${titel.length} Zeichen`);
      assert.ok(desc.length >= 110 && desc.length <= 155, `${f}: Beschreibung ${desc.length} Zeichen`);
      for (const m of ['property="og:title"', 'name="twitter:title"']) assert.ok(s.includes(`<meta ${m} content="${titel.replace(/&/g, "&amp;")}" />`), `${f}: ${m} weicht vom Titel ab`);
      for (const m of ['property="og:description"', 'name="twitter:description"']) assert.ok(s.includes(`<meta ${m} content="${desc}" />`), `${f}: ${m} weicht ab`);
      assert.ok(s.includes(`<meta property="og:locale" content="${W.locale}" />`), `${f}: og:locale`);
      assert.ok(s.includes(`<html lang="${k}">`), `${f}: lang-Attribut`);
      assert.ok(s.includes('<link rel="stylesheet" href="/ratgeber/wissen.css" />'), `${f}: eigene Gestaltung statt der gemeinsamen`);
    }
    // FAQ-Schema: gueltig, und die Antwort nennt die Zahl der Seite
    for (const [f, zahl] of [[s20, "11"], [s40, "25"], [sM3, "33,1"], [sMass, "590"]]) {
      const ld = JSON.parse(/<script type="application\/ld\+json">(.*?)<\/script>/s.exec(lese(f + ".html"))[1]);
      assert.strictEqual(ld["@type"], "FAQPage");
      assert.ok(ld.mainEntity.length >= 2 && ld.mainEntity[0].acceptedAnswer.text.includes(zahl), `${f}: die erste Antwort nennt ${zahl} nicht`);
    }
  });

  test(`${K}: die Seiten stehen in ihrer Sprache, fuehren in ihren Rechner und nie in den deutschen Baum`, () => {
    const baum = new RegExp(`^/${k}/|^/en/guide/$|^/impressum$|^/datenschutz$`);
    for (const f of [...seiten(k), W.ordner + "/index"]) {
      const s = lese(f + ".html");
      const koerper = s.slice(s.indexOf("<body"));
      const text = koerper.replace(/<details class="langmenu">[\s\S]*?<\/details>/, " ").replace(/<svg[\s\S]*?<\/svg>/g, " ")
        .replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ");
      const fremd = text.match(W.fremd) || [];
      assert.deepStrictEqual([...new Set(fremd)], [], `${f}: fremde Woerter im Text`);
      assert.ok(!W.nurEnDe.test(text), `${f}: behauptet, den Rechner gebe es nur auf Englisch oder Deutsch`);
      for (const [tag, h] of koerper.matchAll(/<a\b[^>]*href="([^"]*)"[^>]*>/g)) {
        if (/hreflang=/.test(tag)) continue;                                   // Sprachumschalter
        if (/^\/app/.test(h)) assert.ok(new RegExp(`^/app\\?lang=${k}(&|$)`).test(h), `${f}: Rechner-Link ohne lang=${k}: ${h}`);
        else assert.ok(baum.test(h), `${f}: Link aus dem eigenen Baum heraus: ${h}`);
      }
    }
    // Uebersicht und Rueckweg
    const ix = lese(W.ordner + "/index.html");
    for (const p of seiten(k)) {
      assert.ok(ix.includes(`href="/${p}"`), `${K}-Uebersicht verlinkt ${p} nicht`);
      assert.ok(lese(p + ".html").includes(`href="/${W.ordner}/"`), `${p}: Rueckweg zur Uebersicht fehlt`);
    }
    // Die Startseite der Sprache fuehrt auf diese Seiten statt auf die englischen
    const start = lese(`${k}/index.html`);
    for (const p of seiten(k)) assert.ok(start.includes(`href="/${p}"`), `die Startseite /${k}/ verlinkt ${p} nicht`);
    assert.ok(start.includes(`href="/${W.ordner}/"`), `die Startseite /${k}/ verlinkt die Uebersicht nicht`);
    // ... und der Rueckweg aus dem Rechner geht auf die Startseite der Sprache
    assert.ok(lese(`sprache/${k}.js`).includes(`start: "/${k}/"`), `sprache/${k}.js: Rueckweg auf die Startseite fehlt`);
  });
}

test("jedes Cluster ist ein sauberes Netz: hreflang auf ALLEN Fassungen, in beide Richtungen", () => {
  const zeilen = SPALTEN.length + 1;                                           // jede Sprache + x-default
  for (const c of CLUSTER) {
    for (const f of c) {
      const s = lese(f + ".html");
      for (const [k, ziel] of [...SPALTEN.map((k, i) => [k, c[i]]), ["x-default", c[0]]]) {
        assert.ok(s.includes(`<link rel="alternate" hreflang="${k}" href="${B}/${ziel}" />`), `${f}: hreflang ${k} fehlt`);
      }
      assert.strictEqual((s.match(/<link rel="alternate" hreflang=/g) || []).length, zeilen, `${f}: nicht genau ${zeilen} hreflang-Zeilen`);
      assert.ok(s.includes(`<link rel="canonical" href="${B}/${f}" />`), `${f}: canonical zeigt nicht auf sich selbst`);
    }
  }
});

test("die Sprachwahl dieser Seiten ist ein Aufklapp-Menue -- und zeigt auf die Uebersetzung DIESER Seite", () => {
  // Fuenf Kuerzel nebeneinander lasen sich wie ein Code (Jarek zur Reihe im Rechner: "sieht
  // ultra weird aus ... am besten waere doch ein Drop-down"). Ein Knopf zeigt das Kuerzel der
  // aktuellen Sprache, darunter stehen die vollen Namen.
  for (const c of CLUSTER) {
    c.forEach((f, i) => {
      const s = lese(f + ".html");
      const m = /<details class="langmenu"><summary aria-label="[^"]+">[\s\S]*?<span class="langcur">([A-Z]{2})<\/span>[\s\S]*?<\/summary><div class="lang" role="group" aria-label="[^"]+">([\s\S]*?)<\/div><\/details>/.exec(s);
      assert.ok(m, `${f}: kein Sprach-Menue`);
      assert.strictEqual(m[1], SPALTEN[i].toUpperCase(), `${f}: der Knopf zeigt nicht die Sprache der Seite`);
      const links = [...m[2].matchAll(/<a (class="on" )?href="([^"]*)" hreflang="([a-z]{2})" title="([^"]*)">([^<]*)<\/a>/g)];
      assert.deepStrictEqual(links.map((l) => [l[3], l[2]]), SPALTEN.map((k, j) => [k, "/" + c[j]]), `${f}: die Liste zeigt nicht auf die Uebersetzungen dieser Seite`);
      for (const l of links) assert.ok(l[5] === NAMEN[l[3]] && l[4] === NAMEN[l[3]], `${f}: ${l[3]} steht nicht mit vollem Namen im Menue`);
      assert.deepStrictEqual(links.filter((l) => l[1]).map((l) => l[3]), [SPALTEN[i]], `${f}: aktiv ist nicht genau die eigene Sprache`);
      assert.strictEqual((s.match(/<div class="lang"/g) || []).length, 1, `${f}: zwei Sprachwahlen`);
    });
  }
});

test("Menue ab drei Sprachen, Reihe bei zweien -- auf JEDER Wissensseite, und das Menue geht wieder zu", () => {
  let menues = 0, reihen = 0;
  for (const ordner of ["ratgeber", "en/guide", "nl/gids", "es/guia", "fr/guide"]) {
    for (const f of fs.readdirSync(path.join(dir, "..", ordner)).filter((x) => x.endsWith(".html"))) {
      const s = lese(`${ordner}/${f}`);
      const m = /<div class="lang"[^>]*>([\s\S]*?)<\/div>/.exec(s);
      if (!m) continue;
      const n = (m[1].match(/<a /g) || []).length, menue = s.includes('<details class="langmenu">');
      assert.strictEqual(menue, n >= 3, `${ordner}/${f}: ${n} Sprachen, ${menue ? "aber ein Menue" : "aber eine Reihe"}`);
      assert.strictEqual(s.includes('<script src="/ratgeber/langmenu.js" defer></script>'), menue, `${ordner}/${f}: Menue und Schliess-Skript gehoeren zusammen`);
      if (menue) menues++; else reihen++;
    }
  }
  assert.ok(menues >= CLUSTER.length * SPALTEN.length && reihen > 0, `Menues ${menues}, Reihen ${reihen}`);
  // Die Uebersichten der drei Wellen zeigen aufeinander
  for (const [f, k] of [["nl/gids/index.html", "nl"], ["es/guia/index.html", "es"], ["fr/guide/index.html", "fr"]]) {
    const s = lese(f);
    for (const [kk, h] of [["de", "/ratgeber/"], ["en", "/en/guide/"], ["nl", "/nl/gids/"], ["es", "/es/guia/"], ["fr", "/fr/guide/"]]) {
      assert.ok(s.includes(`href="${h}" hreflang="${kk}"`), `${f}: ${kk} fehlt in der Sprachwahl`);
    }
    assert.ok(new RegExp(`<span class="langcur">${k.toUpperCase()}</span>`).test(s), `${f}: Knopf zeigt nicht ${k}`);
  }
  // Gestaltung und Skript
  const css = lese("ratgeber/wissen.css"), js = lese("ratgeber/langmenu.js");
  assert.match(css, /\.langmenu\{[^}]*position:\s*relative/);
  assert.match(css, /\.langmenu \.lang\{[^}]*position:\s*absolute[^}]*flex-direction:\s*column/, "die Liste klappt nicht nach unten auf");
  assert.match(css, /\.langmenu:not\(\[open\]\) \.lang\{display:none\}/, "die zugeklappte Liste ist nicht sicher verborgen");
  assert.match(css, /\.langmenu summary::-webkit-details-marker\{display:none\}/);
  assert.ok(js.includes('"Escape"') && js.includes("!d.contains(e.target)"), "Esc bzw. Klick daneben schliesst das Menue nicht");
  assert.ok(!/fetch|XMLHttpRequest|localStorage|cookie/.test(js), "das Menue-Skript tut mehr als auf- und zuklappen");
});

test("Sitemap: jede Fassung gelistet, jeder Block der vier Themen traegt alle Sprachzeilen", () => {
  const sm = lese("sitemap.xml");
  const zeilen = SPALTEN.length + 1;
  for (const c of CLUSTER) {
    for (const pfad of c) {
      const i = sm.indexOf(`<loc>${B}/${pfad}</loc>`);
      assert.ok(i > 0, `Sitemap: ${pfad} fehlt`);
      const block = sm.slice(i, sm.indexOf("</url>", i));
      SPALTEN.forEach((k, j) => assert.ok(block.includes(`hreflang="${k}" href="${B}/${c[j]}"`), `Sitemap-Block ${pfad}: ${k}-Zeile fehlt`));
      assert.ok(block.includes(`hreflang="x-default" href="${B}/${c[0]}"`), `Sitemap-Block ${pfad}: x-default fehlt`);
      assert.strictEqual((block.match(/hreflang="/g) || []).length, zeilen, `Sitemap-Block ${pfad}: nicht genau ${zeilen} Sprachzeilen`);
    }
  }
  for (const W of Object.values(WELLEN)) assert.ok(sm.includes(`<loc>${B}/${W.ordner}/</loc>`), `Sitemap: Uebersicht ${W.ordner} fehlt`);
  assert.strictEqual((sm.match(/<loc>/g) || []).length, new Set(sm.match(/<loc>[^<]*<\/loc>/g)).size, "doppelte Adresse in der Sitemap");
});
