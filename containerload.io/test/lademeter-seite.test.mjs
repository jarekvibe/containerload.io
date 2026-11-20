// Die Lademeter-Seite (/ratgeber/lademeter-rechner, /en/guide/loading-metre-calculator).
//
// Seit 20.11.26 heisst sie nach dem, wonach gesucht wird ("Lademeter-Rechner"), und traegt
// zwei Tabellen mit Zahlen: Paletten im Planensattel (Formel gegen Packer) und Fahrzeuge
// (Innenmasse und Europaletten). Beide Tabellen werden hier NACHGERECHNET -- mit dem Packer
// und den Fahrzeugmassen aus app.html, also mit dem, was der Rechner hinter dem Knopf zeigt.
// Dazu: der Umzug (301, keine alten Links), der Kopf und das FAQ-Schema.
//
// node --test test/lademeter-seite.test.mjs
import fs from "node:fs";
import assert from "node:assert";
import test from "node:test";
import { fileURLToPath } from "node:url";
import path from "node:path";

const dir = path.dirname(fileURLToPath(import.meta.url));
const wurzel = path.join(dir, "..");
const lies = (p) => fs.readFileSync(path.join(wurzel, p), "utf8");
const de = lies("ratgeber/lademeter-rechner.html");
const en = lies("en/guide/loading-metre-calculator.html");

const app = lies("app.html");
const L = app.split("\n");
const vStart = L.findIndex((l) => l.includes("var VEHICLES = {"));
const vEnd = L.findIndex((l, i) => i > vStart && l.trim() === "};");
const ps = L.findIndex((l) => l.includes("function makeFloorPacker"));
const pe = L.findIndex((l, i) => i > ps && l.trim() === "}" && L[i - 1].includes("return { placed, perType"));
const { makeFloorPacker, VEHICLES } = new Function(
  'var num=(v,d=0)=>Number.isFinite(+v)&&v!==""?+v:d;\n'
  + L.slice(vStart, vEnd + 1).join("\n") + "\n"
  + L.slice(ps, pe + 1).join("\n") + "\nreturn { makeFloorPacker, VEHICLES };"
)();
const stellen = (fz, l, w) => makeFloorPacker(l, w, true)(VEHICLES[fz].l, VEHICLES[fz].w).count;

// Tabellenzeilen einer Seite: je <tr> die Zellen als Text
const tabellen = (html) => [...html.matchAll(/<table>([\s\S]*?)<\/table>/g)].map((t) =>
  [...t[1].matchAll(/<tr>([\s\S]*?)<\/tr>/g)].map((r) =>
    [...r[1].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/g)].map((c) => c[1].replace(/<[^>]+>/g, "").trim())));
const zahl = (s, dez) => Number(dez === "," ? s.replace(/\./g, "").replace(",", ".") : s.replace(/,/g, ""));

// [Zeilenanfang DE, Zeilenanfang EN, Laenge, Breite]
const PALETTEN = [
  ["Europalette 120 × 80", "Euro pallet 120 × 80", 120, 80],
  ["Industriepalette 120 × 100", "Industrial pallet 120 × 100", 120, 100],
  ["Gitterbox 124 × 83", "Wire mesh pallet 124 × 83", 124, 83],
  ["US-Palette 122 × 102", "US pallet 122 × 102", 122, 102]
];

test("Paletten-Tabelle: Formel UND Packer stimmen, auf beiden Sprachfassungen", () => {
  for (const [html, sp, dez] of [[de, 0, ","], [en, 1, "."]]) {
    const t = tabellen(html)[0];
    assert.strictEqual(t.length, 1 + PALETTEN.length, "Zeilenzahl der Paletten-Tabelle");
    PALETTEN.forEach((p, i) => {
      const [name, ldmTxt, formelTxt, echtTxt] = t[i + 1];
      assert.strictEqual(name, p[sp]);
      const ldm = (p[2] / 100) * (p[3] / 100) / 2.4;
      assert.strictEqual(zahl(ldmTxt, dez), Math.round(ldm * 100) / 100, `${name}: ldm je Stueck`);
      assert.strictEqual(zahl(formelTxt, dez), Math.round(13.6 / ldm * 10) / 10, `${name}: nach Formel`);
      assert.strictEqual(zahl(echtTxt, dez), stellen("Planensattel", p[2], p[3]), `${name}: der Packer stellt eine andere Zahl`);
    });
  }
  // Der Text erklaert die Abweichungen -- sie muessen also auch wirklich da sein.
  assert.strictEqual(stellen("Planensattel", 120, 100), 26, "Industriepalette: Text sagt 26 statt 27");
  assert.ok(de.includes("<b>26 statt 27</b>") && en.includes("<b>26 instead of 27</b>"));
  assert.ok(stellen("Planensattel", 124, 83) > Math.floor(13.6 / (1.24 * 0.83 / 2.4)), "Gitterbox: Text sagt eine mehr als die Formel");
});

// [Zeilenanfang DE, Zeilenanfang EN, Schluessel in VEHICLES]
const FAHRZEUGE = [
  ["Planensattel", "Curtainsider", "Planensattel"],
  ["Wechselbrücke", "Swap body", "Wechselbrücke"],
  ["Motorwagen", "Rigid truck", "Motorwagen"],
  ["7,5-Tonner", "7.5-t truck", "7,5-Tonner"],
  ["Transporter (Sprinter)", "Van (Sprinter)", "Sprinter"]
];

test("Fahrzeug-Tabelle: Masse aus VEHICLES, Europaletten vom Packer", () => {
  assert.strictEqual(Object.keys(VEHICLES).length, FAHRZEUGE.length, "neues Fahrzeug im Rechner -- Tabelle nachziehen");
  for (const [html, sp, dez] of [[de, 0, ","], [en, 1, "."]]) {
    const t = tabellen(html)[1];
    assert.strictEqual(t.length, 1 + FAHRZEUGE.length);
    FAHRZEUGE.forEach((f, i) => {
      const [name, masse, eur] = t[i + 1];
      const V = VEHICLES[f[2]];
      assert.ok(V, `${f[2]} fehlt in VEHICLES`);
      assert.strictEqual(name, f[sp]);
      const m = (cm) => (cm / 100).toFixed(2).replace(".", dez);
      assert.strictEqual(masse, `${m(V.l)} × ${m(V.w)} m`, `${name}: Masse weichen vom Rechner ab`);
      assert.strictEqual(Number(eur), stellen(f[2], 120, 80), `${name}: der Packer stellt eine andere Zahl`);
    });
  }
  // Die 34 der Einleitung, des FAQ und des Knopfs sind dieselbe Zahl wie im Rechner.
  assert.strictEqual(stellen("Planensattel", 120, 80), 34);
  for (const html of [de, en]) {
    assert.ok(/\b34\b/.test(html.match(/<div class="answer">[\s\S]*?<\/div>/)[0]), "Einleitung ohne 34");
    assert.ok(/href="\/app\?(lang=en&)?q=34%20Euro/.test(html), "Knopf laedt nicht 34 Europaletten");
    assert.ok(/[?&]d=road\b/.test(html.match(/href="(\/app\?[^"]*q=34[^"]*)"/)[1]), "Knopf landet nicht in der Landfracht");
  }
});

test("Kopf: Suchbegriff vorne, Laengen fuer das Snippet, hreflang-Paar", () => {
  for (const [name, html, url, begriff] of [
    ["DE", de, "https://containerload.io/ratgeber/lademeter-rechner", /^Lademeter-Rechner/],
    ["EN", en, "https://containerload.io/en/guide/loading-metre-calculator", /^Loading metre calculator/]
  ]) {
    const titel = html.match(/<title>([^<]+)<\/title>/)[1].replace(/&amp;/g, "&");
    const desc = html.match(/<meta name="description" content="([^"]+)"/)[1];
    assert.ok(begriff.test(titel) && titel.length <= 60, `${name}-Titel: ${titel} (${titel.length})`);
    assert.ok(desc.length <= 155 && /2[,.]4/.test(desc) && /13[,.]6/.test(desc), `${name}-Beschreibung: ${desc.length}`);
    assert.ok(begriff.test(html.match(/<h1>([^<]+)<\/h1>/)[1]), `${name}: h1 ohne Suchbegriff`);
    assert.ok(html.includes(`<link rel="canonical" href="${url}" />`) && html.includes(`<meta property="og:url" content="${url}" />`));
    assert.ok(html.includes('<link rel="alternate" hreflang="de" href="https://containerload.io/ratgeber/lademeter-rechner" />'));
    assert.ok(html.includes('<link rel="alternate" hreflang="en" href="https://containerload.io/en/guide/loading-metre-calculator" />'));
  }
});

test("FAQ: jede Frage im Schema steht auch sichtbar auf der Seite", () => {
  for (const [name, html] of [["DE", de], ["EN", en]]) {
    const ld = JSON.parse(html.match(/<script type="application\/ld\+json">(.*?)<\/script>/s)[1]);
    assert.strictEqual(ld["@type"], "FAQPage");
    assert.ok(ld.mainEntity.length >= 4, `${name}: zu wenige Fragen`);
    for (const q of ld.mainEntity) {
      assert.ok(html.includes(`<p><b>${q.name}</b><br>`), `${name}: "${q.name}" steht nur im Schema`);
      assert.ok(q.acceptedAnswer.text.length > 40);
    }
    // Die meistgesuchte Frage ist dabei, mit der Zahl des Rechners.
    const pal = ld.mainEntity.find((q) => /Europaletten|euro pallets/.test(q.name) && /LKW|truck/.test(q.name));
    assert.ok(pal && /\b34\b/.test(pal.acceptedAnswer.text), `${name}: Frage nach Europaletten auf dem LKW fehlt`);
  }
});

test("der Umzug: 301 von den alten Adressen, kein Link zeigt mehr dorthin", () => {
  const rd = lies("_redirects");
  const regeln = [
    ["/ratgeber/ladungsberechnung-lkw-planensattel", "/ratgeber/lademeter-rechner"],
    ["/ratgeber/ladungsberechnung-lkw-planensattel.html", "/ratgeber/lademeter-rechner"],
    ["/en/guide/truck-trailer-load-calculation", "/en/guide/loading-metre-calculator"],
    ["/en/guide/truck-trailer-load-calculation.html", "/en/guide/loading-metre-calculator"]
  ];
  for (const [von, nach] of regeln) {
    const re = new RegExp(`^${von.replace(/[./]/g, "\\$&")}\\s+${nach.replace(/[./]/g, "\\$&")}\\s+301$`, "m");
    const m = rd.match(re);
    assert.ok(m, `301 ${von} -> ${nach} fehlt`);
    // Vor den Rewrites, sonst liefert /ratgeber/:slug ins Leere (die alte Datei ist weg).
    const rewrite = von.startsWith("/en/") ? "/en/guide/:slug" : "/ratgeber/:slug";
    assert.ok(m.index < rd.indexOf(rewrite + " "), `${von}: 301 steht hinter ${rewrite}`);
  }
  assert.ok(!fs.existsSync(path.join(wurzel, "ratgeber/ladungsberechnung-lkw-planensattel.html")));
  assert.ok(!fs.existsSync(path.join(wurzel, "en/guide/truck-trailer-load-calculation.html")));
  // Kein Link, keine Sitemap, keine GUIDE-Tabelle zeigt noch auf eine alte Adresse.
  const dateien = ["sitemap.xml"];
  const suche = (d) => {
    for (const f of fs.readdirSync(path.join(wurzel, d), { withFileTypes: true })) {
      const p = path.join(d, f.name);
      if (f.isDirectory() && !["test", "node_modules", "netlify"].includes(f.name)) suche(p);
      else if (f.name.endsWith(".html")) dateien.push(p);
    }
  };
  suche(".");
  for (const p of dateien) {
    const s = lies(p).replace(/<!--[\s\S]*?-->/g, "");
    assert.ok(!/ladungsberechnung-lkw-planensattel|truck-trailer-load-calculation/.test(s), `${p} nennt noch die alte Adresse`);
  }
  // Sitemap fuehrt die neuen Adressen.
  const sm = lies("sitemap.xml");
  assert.ok(sm.includes("<loc>https://containerload.io/ratgeber/lademeter-rechner</loc>"));
  assert.ok(sm.includes("<loc>https://containerload.io/en/guide/loading-metre-calculator</loc>"));
});
