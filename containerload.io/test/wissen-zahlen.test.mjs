// Die Zahlen im Container-Wissen muessen dem Rechner entsprechen, in den sie verlinken.
//
// Vorgeschichte: Auf den Seiten standen Stellzahlen, die der eigene Packer widerlegt —
// "25–26 Europaletten" im 40-Fuss (26 ist geometrisch unmoeglich), "9–10"
// Industriepaletten im 20-Fuss (es sind 9), "rund 21" im 40-Fuss (es sind 22) und
// "24–25" Gitterboxen (mit den echten 124x83 cm sind es 23). Jede dieser Seiten hat
// einen Knopf "Im 3D-Rechner ansehen". Wer dort klickt und eine andere Zahl sieht,
// weiss nicht mehr, welcher Angabe er glauben soll — und genau das Vertrauen ist das
// Produkt.
//
// Dieser Test schreibt die Zahlen nicht ab, sondern RECHNET sie mit demselben Packer
// nach, den der Rechner benutzt. Aendert sich der Packer, faellt der Test auf.
import fs from "node:fs";
import assert from "node:assert";
import test from "node:test";
import { fileURLToPath } from "node:url";
import path from "node:path";

const dir = path.dirname(fileURLToPath(import.meta.url));
const app = fs.readFileSync(path.join(dir, "..", "app.html"), "utf8");
const L = app.split("\n");
// Die Containermasse kommen ebenfalls aus app.html — auch sie werden hier nicht
// abgeschrieben, sonst waere der Test die naechste Kopie, die wegdriftet.
const pStart = L.findIndex((l) => l.includes("var PRESETS = {"));
const pEnd = L.findIndex((l, i) => i > pStart && l.trim() === "};");
const ps = L.findIndex((l) => l.includes("function makeFloorPacker"));
const pe = L.findIndex((l, i) => i > ps && l.trim() === "}" && L[i - 1].includes("return { placed, perType"));
const { makeFloorPacker, PRESETS } = new Function(
  'var num=(v,d=0)=>Number.isFinite(+v)&&v!==""?+v:d;\n'
  + L.slice(pStart, pEnd + 1).join("\n") + "\n"
  + L.slice(ps, pe + 1).join("\n") + "\nreturn { makeFloorPacker, PRESETS };"
)();

const seite = (f) => fs.readFileSync(path.join(dir, "..", "ratgeber", f), "utf8");
const stellplaetze = (preset, l, w) => {
  const C = PRESETS[preset];
  return makeFloorPacker(l, w, true)(C.l, C.w).count;
};

// [Datei, Beschreibung, Preset, Packstueckmass, wie die Zahl auf der Seite steht]
const FAELLE = [
  ["europaletten-20-fuss-container.html", "Europaletten im 20'", "20' GP", [120, 80], 11],
  ["europaletten-40-fuss-container.html", "Europaletten im 40'", "40' GP", [120, 80], 25],
  ["industriepaletten-container.html", "Industriepaletten im 20'", "20' GP", [120, 100], 9],
  ["industriepaletten-container.html", "Industriepaletten im 40'", "40' GP", [120, 100], 22],
  ["gitterboxen-container.html", "Gitterboxen im 20'", "20' GP", [124, 83], 11],
  ["gitterboxen-container.html", "Gitterboxen im 40'", "40' GP", [124, 83], 23],
  ["faesser-container.html", "Faesser im 20'", "20' GP", [61, 61], 27],
  ["faesser-container.html", "Faesser im 40'", "40' GP", [61, 61], 57],
  ["big-bags-container.html", "Big Bags im 20'", "20' GP", [90, 90], 12],
  ["big-bags-container.html", "Big Bags im 40'", "40' GP", [90, 90], 26],
  // US-Palette: 48x40 Zoll. Die App rechnet Zoll mit *2,54 und rundet auf ganze
  // Zentimeter — also 122x102, nicht 121,9x101,6. Die Seiten rechnen mit demselben
  // gerundeten Mass, sonst widersprueche der ?q=-Knopf dem Text. Die Rundung selbst
  // wird unten eigens festgenagelt.
  ["us-paletten-20-fuss-container.html", "US-Paletten im 20'", "20' GP", [122, 102], 9],
  ["us-paletten-40-fuss-container.html", "US-Paletten im 40'", "40' GP", [122, 102], 20]
];

test("die genannten Stellzahlen stimmen mit dem Packer ueberein", () => {
  for (const [, was, preset, [l, w], behauptet] of FAELLE) {
    const echt = stellplaetze(preset, l, w);
    assert.strictEqual(behauptet, echt, `${was}: die Seite nennt ${behauptet}, der Packer rechnet ${echt}`);
  }
});

test("die Zahl steht auch wirklich auf der jeweiligen Seite", () => {
  for (const [datei, was, , , behauptet] of FAELLE) {
    assert.ok(new RegExp(`\\b${behauptet}\\b`).test(seite(datei)), `${datei}: ${was} — die Zahl ${behauptet} kommt gar nicht vor`);
  }
});

// Die englische Fassung nennt DIESELBEN Zahlen — sie kommen aus demselben Packer. Eine
// Uebersetzung, in der eine Zahl anders steht, ist schlimmer als keine: dann widerspricht
// sich die Seite je nach Sprache, und der Knopf daneben oeffnet in beiden Faellen denselben
// Rechner. Auch die Beispielmenge im ?q=-Link gehoert dazu.
const enSeite = (f) => fs.readFileSync(path.join(dir, "..", "en", "guide", f), "utf8");
const EN_FAELLE = [
  ["euro-pallets-20ft-container.html", "Euro pallets in 20'", "20' GP", [120, 80], 11],
  ["euro-pallets-40ft-container.html", "Euro pallets in 40'", "40' GP", [120, 80], 25],
  ["industrial-pallets-container.html", "Industrial pallets in 20'", "20' GP", [120, 100], 9],
  ["industrial-pallets-container.html", "Industrial pallets in 40'", "40' GP", [120, 100], 22],
  ["wire-mesh-pallets-container.html", "Mesh pallets in 20'", "20' GP", [124, 83], 11],
  ["wire-mesh-pallets-container.html", "Mesh pallets in 40'", "40' GP", [124, 83], 23],
  ["drums-container.html", "Drums in 20'", "20' GP", [61, 61], 27],
  ["drums-container.html", "Drums in 40'", "40' GP", [61, 61], 57],
  ["big-bags-container.html", "Big bags in 20'", "20' GP", [90, 90], 12],
  ["big-bags-container.html", "Big bags in 40'", "40' GP", [90, 90], 26],
  ["pallets-20ft-container.html", "US pallets in 20'", "20' GP", [122, 102], 9],
  ["pallets-40ft-container.html", "US pallets in 40'", "40' GP", [122, 102], 20]
];

test("die englische Fassung nennt dieselben gerechneten Zahlen", () => {
  for (const [datei, was, preset, [l, w], behauptet] of EN_FAELLE) {
    assert.strictEqual(behauptet, stellplaetze(preset, l, w), `${was}: der Packer rechnet anders`);
    assert.ok(new RegExp(`\\b${behauptet}\\b`).test(enSeite(datei)), `${datei}: ${was} — die Zahl ${behauptet} kommt gar nicht vor`);
  }
});

test("die Beispielladung hinter dem Knopf passt zur genannten Zahl", () => {
  // Der ?q=-Link laedt den Rechner vor. Stuende dort eine andere Menge, wuerde der
  // Rechner die Zahl im Text im selben Moment widerlegen, in dem jemand draufklickt.
  const erwartet = { "euro-pallets-20ft-container.html": 11, "euro-pallets-40ft-container.html": 25,
    "industrial-pallets-container.html": 22, "wire-mesh-pallets-container.html": 11,
    "truck-trailer-load-calculation.html": 34, "ibc-totes-container.html": 9,
    "drums-container.html": 27, "big-bags-container.html": 12,
    "pallets-20ft-container.html": 9, "pallets-40ft-container.html": 20 };
  for (const [datei, menge] of Object.entries(erwartet)) {
    const m = enSeite(datei).match(/href="\/app\?lang=en&q=([^"]+)"/);
    assert.ok(m, `${datei}: kein ?q=-Link`);
    const txt = decodeURIComponent(m[1]);
    assert.ok(new RegExp(`^${menge}\\b`).test(txt), `${datei}: der Link laedt "${txt}", der Text nennt ${menge}`);
  }
});

test("keine der widerlegten Angaben ist zurueckgekommen", () => {
  const raus = ["25–26", "24–25", "9–10", "rund 21 ", "fast identisch"];
  const treffer = [];
  for (const f of fs.readdirSync(path.join(dir, "..", "ratgeber")).filter((x) => x.endsWith(".html")))
    for (const r of raus) if (seite(f).includes(r)) treffer.push(`${f}: ${r}`);
  assert.deepStrictEqual(treffer, [], `widerlegte Angabe wieder da:\n${treffer.join("\n")}`);
});

test("26 Europaletten sind im 40-Fuss geometrisch unmoeglich", () => {
  // Der Kern der Korrektur, als Rechnung statt als Behauptung: das beste Muster belegt
  // 1200 x 200 cm. Uebrig bleiben ein Streifen von 35 cm Breite und 3 cm Laenge —
  // in keinen davon passt eine Palette, die in jeder Richtung mindestens 80 cm braucht.
  const C = PRESETS["40' GP"];
  const r = makeFloorPacker(120, 80, true)(C.l, C.w);
  assert.strictEqual(r.count, 25);
  const restBreite = C.w - Math.max(...r.rects.map((q) => q.z + q.dz));
  const restLaenge = C.l - Math.max(...r.rects.map((q) => q.x + q.dx));
  assert.ok(restBreite < 80, `${restBreite} cm Restbreite — da ginge doch noch eine Palette`);
  assert.ok(restLaenge < 80, `${restLaenge} cm Restlaenge — da ginge doch noch eine Palette`);
});

// Die Startseite hat genau denselben Fehler getragen und ist beim ersten Mal
// durchgerutscht, weil oben nur der Ordner ratgeber/ durchsucht wurde. Die
// Uebersichtskarte verlinkt aber auf die Seite, der sie widersprochen hat — und die
// englische Fassung im EN-Woerterbuch gleich mit. Deshalb steht die Startseite jetzt
// mit im Netz.
test("auch die Startseite traegt keine widerlegte Angabe mehr", () => {
  const start = fs.readFileSync(path.join(dir, "..", "index.html"), "utf8");
  const raus = ["25–26", "25-26", "24–25", "9–10"];
  const treffer = raus.filter((r) => start.includes(r));
  assert.deepStrictEqual(treffer, [], `index.html nennt wieder: ${treffer.join(", ")}`);
});

// Und die Karte muss die Zahl nennen, die auch der Packer rechnet — nicht bloss
// keine falsche. Sonst haette ein Loeschen des Satzes den Test schon zufriedengestellt.
test("die Uebersichtskarten der Startseite nennen die gerechneten Zahlen", () => {
  const start = fs.readFileSync(path.join(dir, "..", "index.html"), "utf8");
  // [i18n-Schluessel der Karte, Preset, Packstueckmass]
  const KARTEN = [["rg1_p", "20' GP", [120, 80]], ["rg2_p", "40' GP", [120, 80]]];
  for (const [key, preset, [l, w]] of KARTEN) {
    const echt = stellplaetze(preset, l, w);
    const de = start.match(new RegExp(`data-i18n="${key}"[^>]*>([^<]*)<`));
    const en = start.match(new RegExp(`"${key}": "([^"]*)"`));
    assert.ok(de && en, `${key}: deutsche oder englische Fassung nicht gefunden`);
    for (const [was, txt] of [["deutsch", de[1]], ["englisch", en[1]]])
      assert.ok(new RegExp(`\\b${echt}\\b`).test(txt),
        `Karte ${key} (${was}) sagt "${txt.trim()}", der Packer rechnet ${echt}`);
  }
});

// Der Beweis-Satz der Startseite: "11 EUR-Paletten statt 8". Die 11 stand immer, die
// Vergleichszahl war erfunden — sie soll das Ergebnis OHNE Erkennung gedrehter Muster
// nennen, und das sind 8, nicht 9. Ausgerechnet der Satz, mit dem das Werkzeug seine
// Genauigkeit belegt, war die einzige Zahl auf der Seite, die niemand nachrechnen
// konnte. Beide Zahlen kommen jetzt aus demselben Packer, mit und ohne Drehung.
// Der Dreh-Gewinn "x statt y" steht auf der Startseite an ZWEI Stellen: in der Ueberschrift
// (20-Fuss) und im Merkmal "palettengenau" (40-Fuss). Welcher Container gemeint ist, liest
// der Test aus dem Satz selbst -- sonst muesste man ihn nachziehen, sobald jemand die
// Ueberschrift auf einen anderen Container umschreibt, und genau das faellt niemandem auf.
test("die Dreh-Gewinne auf der Startseite stimmen, in beiden Sprachen", () => {
  const start = fs.readFileSync(path.join(dir, "..", "index.html"), "utf8");
  const stellen = [
    // Ueberschrift und Unterzeile gehoeren zusammen: die Zahlen stehen oben, der Container
    // darunter. Getrennt geprueft muesste eine der beiden Stellen etwas wiederholen.
    ["Hero, deutsch", (start.match(/data-i18n="hero_h1"[^>]*>(.*?)<\/h1>/s) || [])[1] + " " + (start.match(/data-i18n="hero_sub"[^>]*>(.*?)<\/p>/s) || [])[1]],
    ["Hero, englisch", (start.match(/"hero_h1": "(.*?)", "hero_sub": "(.*?)", "hero_cta1"/s) || []).slice(1, 3).join(" ")],
    ["Merkmal, deutsch", (start.match(/data-i18n="f2_p"[^>]*>(.*?)<\/p>/s) || [])[1]],
    ["Merkmal, englisch", (start.match(/"f2_p": "(.*?)", "f3_h"/s) || [])[1]],
  ];
  for (const [was, roh] of stellen) {
    assert.ok(roh, `${was}: Stelle nicht gefunden`);
    const txt = roh.replace(/<[^>]*>/g, " ");
    // Welcher Container? Der Satz sagt es -- "20-Fuss", "20-ft" oder das Kuerzel 20\u2032,
    // das im Rechner selbst steht.
    const fuss = txt.match(/\b(20|40|45)\s?(?:[-\s]?(?:Fu|ft|foot)|\u2032|')/i);
    assert.ok(fuss, `${was}: der Satz nennt keinen Container — "${txt.trim()}"`);
    const C = PRESETS[fuss[1] + "' " + (fuss[1] === "45" ? "HC" : "GP")];
    assert.ok(C, `${was}: kein Preset zu ${fuss[1]}'`);
    const mit = makeFloorPacker(120, 80, true)(C.l, C.w).count;
    const ohne = makeFloorPacker(120, 80, false)(C.l, C.w).count;
    assert.ok(mit > ohne, "ohne Drehung duerfte nicht mehr passen als mit");
    // Der Containername steht selbst als Zahl im Satz -- er zaehlt hier nicht mit.
    const zahlen = (txt.replace(fuss[0], " ").match(/\d+/g) || []).map(Number);
    assert.ok(zahlen.includes(mit), `${was}: die gerechnete Zahl ${mit} fehlt in "${txt.trim()}"`);
    assert.ok(zahlen.includes(ohne), `${was}: die Vergleichszahl muesste ${ohne} sein — im Text steht ${zahlen.join(", ")}`);
  }
});

// ── Der Ausbau der Passt-rein-Seiten ────────────────────────────────────────
// Jede Seite erklaert jetzt ihre Stauung: das Warum (mit und ohne Drehen), die
// Draufsicht als SVG DIREKT aus dem Packer, und die Stapelzahl mit sichtbarer
// Hoehen-Annahme. Alles, was dort als Zahl steht, wird hier nachgerechnet --
// die Seiten versprechen woertlich "berechnet, nicht abgeschrieben".
const AUSBAU = [
  // [DE-Datei, EN-Datei, Preset der Draufsicht, Grundmass, je Lage, ohne Drehen,
  //  2 Lagen (null = nicht genannt), beideFarben (false = quadratische Stellflaeche,
  //  die Draufsicht kennt kein Quer)]
  ["europaletten-20-fuss-container.html", "euro-pallets-20ft-container.html", "20' GP", [120, 80], 11, 8, 22, true],
  ["europaletten-40-fuss-container.html", "euro-pallets-40ft-container.html", "40' GP", [120, 80], 25, 20, 50, true],
  ["ibc-container.html", "ibc-totes-container.html", "20' GP", [120, 100], 9, null, 18, true],
  ["industriepaletten-container.html", "industrial-pallets-container.html", "20' GP", [120, 100], 9, 8, null, true],
  ["gitterboxen-container.html", "wire-mesh-pallets-container.html", "40' GP", [124, 83], 23, 18, null, true],
  ["faesser-container.html", "drums-container.html", "20' GP", [61, 61], 27, null, 54, false],
  ["big-bags-container.html", "big-bags-container.html", "20' GP", [90, 90], 12, null, null, false],
  ["us-paletten-20-fuss-container.html", "pallets-20ft-container.html", "20' GP", [122, 102], 9, 8, 18, true],
  ["us-paletten-40-fuss-container.html", "pallets-40ft-container.html", "40' GP", [122, 102], 20, 18, 40, true],
];

test("Warum- und Stapelzahlen: nachgerechnet, und auf beiden Sprachfassungen", () => {
  for (const [de, en, preset, [l, w], lage, ohne, zweiLagen] of AUSBAU) {
    const C = PRESETS[preset];
    assert.strictEqual(makeFloorPacker(l, w, true)(C.l, C.w).count, lage, `${de}: Stellzahl je Lage`);
    if (ohne !== null) assert.strictEqual(makeFloorPacker(l, w, false)(C.l, C.w).count, ohne,
      `${de}: die Ohne-Drehen-Zahl stimmt nicht mehr mit dem Packer`);
    if (zweiLagen !== null) assert.strictEqual(zweiLagen, 2 * lage, `${de}: zwei Lagen sind zweimal der Boden`);
    for (const [datei, txt] of [[de, seite(de)], [en, enSeite(en)]]) {
      for (const z of [lage, ohne, zweiLagen].filter((v) => v !== null))
        assert.ok(new RegExp(`\\b${z}\\b`).test(txt), `${datei}: die Zahl ${z} steht nicht auf der Seite`);
    }
  }
});

test("die Draufsicht zeichnet exakt die Stellplaetze der ersten Lage", () => {
  // Das SVG kommt aus dem Packer: ein Rechteck je Stellplatz plus der Umriss.
  // Weniger waere eine geschoente Skizze, mehr eine erfundene.
  for (const [de, en, , , lage, , , beideFarben] of AUSBAU) {
    for (const [datei, txt] of [[de, seite(de)], [en, enSeite(en)]]) {
      const m = txt.match(/<figure class="stau">([\s\S]*?)<\/figure>/);
      assert.ok(m, `${datei}: keine Draufsicht (figure.stau)`);
      const rects = (m[1].match(/<rect /g) || []).length;
      assert.strictEqual(rects, lage + 1, `${datei}: ${rects - 1} gezeichnete Stellplaetze, der Packer rechnet ${lage}`);
      assert.ok(m[1].includes("#2E8FFF"), `${datei}: die Draufsicht traegt die Akzentfarbe nicht`);
      if (beideFarben) assert.ok(m[1].includes("#2FD8A0"),
        `${datei}: die Draufsicht traegt kein Quer -- die Seite behauptet aber einen Dreh-Gewinn`);
    }
  }
});

test("die IBC-Gewichte folgen aus der genannten Annahme", () => {
  // Annahme auf der Seite: voller 1.000-l-IBC rund 1.070 kg. Die Tonnen-Angaben
  // sind daraus gerechnet, nicht daneben gepflegt.
  const kg = 1070;
  const t = (n) => (Math.round(n * kg / 100) / 10).toFixed(1);
  assert.strictEqual(t(18), "19.3"); assert.strictEqual(t(22), "23.5");
  assert.ok(seite("ibc-container.html").includes("19,3") && seite("ibc-container.html").includes("23,5"),
    "die deutsche IBC-Seite nennt andere Tonnen als 18 bzw. 22 x 1.070 kg ergeben");
  assert.ok(enSeite("ibc-totes-container.html").includes("19.3") && enSeite("ibc-totes-container.html").includes("23.5"),
    "die englische IBC-Seite nennt andere Tonnen");
});

test("die neuen Passt-rein-Paare haengen im Netz: Sitemap, Uebersichten, GUIDE, hreflang", () => {
  const PAARE = [["ibc-container", "ibc-totes-container"], ["faesser-container", "drums-container"],
    ["big-bags-container", "big-bags-container"],
    ["us-paletten-20-fuss-container", "pallets-20ft-container"],
    ["us-paletten-40-fuss-container", "pallets-40ft-container"]];
  const sm = fs.readFileSync(path.join(dir, "..", "sitemap.xml"), "utf8");
  const start = fs.readFileSync(path.join(dir, "..", "index.html"), "utf8");
  for (const [de, en] of PAARE) {
    assert.ok(sm.includes(`https://containerload.io/ratgeber/${de}</loc>`), `Sitemap: /ratgeber/${de} fehlt`);
    assert.ok(sm.includes(`https://containerload.io/en/guide/${en}</loc>`), `Sitemap: /en/guide/${en} fehlt`);
    assert.ok(start.includes(`'/ratgeber/${de}':'/en/guide/${en}'`),
      `GUIDE-Tabelle kennt ${de} nicht (Sprachumschalter bricht)`);
    assert.ok(seite("index.html").includes(`href="/ratgeber/${de}"`), `Ratgeber-Uebersicht verlinkt ${de} nicht`);
    assert.ok(enSeite("index.html").includes(`href="/en/guide/${en}"`), `Guide-Uebersicht verlinkt ${en} nicht`);
    assert.ok(seite(de + ".html").includes(`hreflang="en" href="https://containerload.io/en/guide/${en}"`), de + ": hreflang en fehlt");
    assert.ok(enSeite(en + ".html").includes(`hreflang="de" href="https://containerload.io/ratgeber/${de}"`), en + ": hreflang de fehlt");
  }
});

// ── US-Paletten: die Zoll-Rundung ist Teil des Versprechens ────────────────
// Die Seiten rechnen mit 122x102 cm, weil die App "48x40x55 Zoll" genau dorthin
// rundet (*2,54, dann ganze Zentimeter). Driftet der Parser, luegen die Seiten im
// selben Moment — deshalb laufen die ?q=-Knoepfe hier woertlich durch den echten
// parseCargoText und muessen exakt die gerechnete Ladung ergeben.
test("die US-Knoepfe laden durch den echten Parser exakt die gerechnete Ladung", () => {
  const von = L.findIndex((l) => l.includes("var PALLET_PRESETS = ["));
  const bis = L.findIndex((l, i) => i > von && l.includes("var hexA"));
  assert.ok(von >= 0 && bis > von, "Parser-Ausschnitt nicht gefunden");
  const { parseCargoText } = new Function(L.slice(von, bis).join("\n") + "\nreturn { parseCargoText };")();
  const faelle = [
    [seite("us-paletten-20-fuss-container.html"), 9], [seite("us-paletten-40-fuss-container.html"), 20],
    [enSeite("pallets-20ft-container.html"), 9], [enSeite("pallets-40ft-container.html"), 20],
  ];
  for (const [txt, menge] of faelle) {
    const m = txt.match(/href="\/app\?[^"]*q=([^"&]+)/);
    assert.ok(m, "kein ?q=-Link");
    const rows = parseCargoText(decodeURIComponent(m[1]));
    assert.strictEqual(rows.length, 1, "der Knopf laedt nicht genau eine Position");
    const r = rows[0];
    assert.strictEqual(r.qty, menge, `der Knopf laedt ${r.qty} Stueck, die Seite nennt ${menge}`);
    assert.deepStrictEqual([r.l, r.w], [122, 102], `48x40 Zoll ergeben ${r.l}x${r.w} statt 122x102`);
    assert.ok(r.weight > 0, "die Beispielladung hat kein Gewicht");
  }
});

// ── Der Knopf einer 40-Fuss-Zahl muss den 40-Fuss-Container oeffnen ─────────
// Ohne Vorwahl landet die Beispielladung im 20'-Default, die Kette verteilt sie
// auf 2 x 20' -- und die Seite sieht im Moment des Klicks widerlegt aus, obwohl
// die Zahl stimmt. Deshalb tragen alle Knoepfe mit 40-Fuss-Mengen &cont=40gp,
// und der Rechner kennt das Kuerzel (QCONT-Whitelist in app.html).
test("die 40-Fuss-Knoepfe waehlen den 40-Fuss-Container vor (&cont=40gp)", () => {
  assert.ok(app.includes(`"40gp": "40' GP"`), "die cont-Whitelist in app.html kennt 40gp nicht mehr");
  const vierziger = [
    [seite, "europaletten-40-fuss-container.html"], [enSeite, "euro-pallets-40ft-container.html"],
    [seite, "industriepaletten-container.html"], [enSeite, "industrial-pallets-container.html"],
    [seite, "us-paletten-40-fuss-container.html"], [enSeite, "pallets-40ft-container.html"],
  ];
  for (const [lese, f] of vierziger) {
    const links = lese(f).match(/href="\/app\?[^"]*q=[^"]*"/g) || [];
    assert.ok(links.length >= 2, `${f}: CTA-Links nicht gefunden`);
    for (const l of links) assert.ok(l.includes("cont=40gp"), `${f}: ${l} oeffnet nicht den 40-Fuss`);
  }
});
