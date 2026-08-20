// Haelt das Regelwerk der Rechner-Oberflaeche fest.
//
// Warum ein Test und keine Notiz: Eine Oberflaeche sieht nicht deshalb generiert aus, weil ein
// einzelner Wert falsch ist, sondern weil sich ueber viele kleine Aenderungen hinweg zwoelf
// Eckenradien, vierzehn Schriftgroessen und ein Dutzend fast gleicher Dunkelgraus ansammeln.
// Jede einzelne Entscheidung wirkt harmlos; die Summe ist der Fingerabdruck. Dieser Test macht
// die Summe sichtbar, bevor sie im Bild landet.
//
// Seit dem Design-Durchgang steht die Skala NICHT mehr als Zahl im Markup, sondern in den
// Marken FS / FW / NUMS / R / SP / ICO am Dateianfang. Dieser Test prueft deshalb zweierlei:
// dass die Marken die vereinbarten Werte haben, UND dass im Markup keine Zahl daneben steht.
// Wer eine Stufe WIRKLICH braucht, traegt sie oben ein — dann ist es eine Entscheidung
// und kein Versehen. Genau das ist der Unterschied.
import fs from "node:fs";
import assert from "node:assert";
import test from "node:test";
import { fileURLToPath } from "node:url";
import path from "node:path";

const dir = path.dirname(fileURLToPath(import.meta.url));
const app = fs.readFileSync(path.join(dir, "..", "app.html"), "utf8");
const zeilen = app.split("\n");

// Die Druckvorlage (LV_ROW / LV_STOWAGE / LV_PAGE / LV_DOC) ist ein eigenes Dokument: A4,
// weisses Papier, andere Schrift, andere Groessen. Sie folgt der Bildschirm-Skala nicht und
// wird hier ausgenommen. Dasselbe gilt fuer den mitgelieferten QR-Code-Erzeuger davor.
const DRUCK_VON = zeilen.findIndex((z) => z.includes("var LV_ROW =")) + 1;
const DRUCK_BIS = zeilen.findIndex((z) => z.includes("var LV_DOC =")) + 1;
const istOberflaeche = (nr) => nr > 78 && !(nr >= DRUCK_VON && nr <= DRUCK_BIS);
const oberflaeche = zeilen.filter((_, i) => istOberflaeche(i + 1)).join("\n");

// Werte, die absichtlich ausserhalb der Reihe stehen, mit Grund.
const AUSNAHMEN = new Set([
  "#0c1320", "#0b1119",                          // Strichfarben der Druckvorlage auf weissem Papier
  "#0a2b46", "#165780", "#0f3c60",               // die drei Wuerfelflaechen der Marke
  "#04121a",                                    // Text auf Akzentflaeche
  "#1a0f08",                                     // warmer Grund der Tuer-Warnung
  "#0f1c2e", "#0c1622", "#0e2438", "#15334e", "#0d1726", "#0b1f33", "#08111c", // 3D-Buehne
  "#101a2b",                                     // oberer Stop des Verlaufs hinter der 3D-Ansicht
  "#2c4358", "#384557", "#3a4a5e", "#33475e",    // Linien im 3D-Bild
  "#000000"
]);

test("es bleibt bei sechs Flaechenstufen", () => {
  const gezaehlt = new Set();
  for (const roh of app.match(/#[0-9A-Fa-f]{6}\b/g) || []) {
    const h = roh.toLowerCase();
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
    if ((r + g + b) / 3 >= 0x50) continue;      // nur dunkle Flaechen und Linien
    if (AUSNAHMEN.has(h)) continue;
    gezaehlt.add(h);
  }
  assert.ok(gezaehlt.size <= 6,
    `${gezaehlt.size} dunkle Werte statt hoechstens 6: ${[...gezaehlt].join(", ")}\n` +
    "Neue Zwischentoene sammeln sich an, bis kein Rahmen mehr etwas bedeutet. " +
    "Entweder eine bestehende Stufe nehmen oder hier bewusst eintragen.");
});

test("die Skalen stehen als Marken oben in der Datei", () => {
  const erwartet = [
    /var FS = \{ label: 11\.5, small: 12\.5, body: 13\.5, lead: 15, h3: 17, h2: 20 \};/,
    /var FW = \{ label: 500, body: 500, semi: 600, bold: 700 \};/,
    /var NUMS = \{ s: 15, m: 20, l: 26 \};/,
    /var R = \{ s: 8, l: 16 \};/,
    /var SP = \{ xs: 4, s: 8, m: 12, l: 16, xl: 24, xxl: 32 \};/,
    /var ICO = \{ s: 16, m: 20, sw: 1\.5 \};/
  ];
  const fehlt = erwartet.filter((re) => !re.test(app)).map((re) => re.source);
  assert.deepStrictEqual(fehlt, [],
    `Die Skala wurde veraendert oder verschoben:\n${fehlt.join("\n")}\n` +
    "Wer eine Stufe aendert, aendert sie hier UND im Test — sonst ist es keine Entscheidung.");
});

test("Eckenradien: zwei Stufen, sonst nur Pille und Kreis", () => {
  // "0 2px 2px 0" ist kein Eckenradius aus der Reihe, sondern das runde Ende eines
  // 2px hohen Fortschrittsbalkens — der Wert IST die Balkenhoehe.
  const erlaubt = new Set(["R.s", "R.l", "999", '"50%"', '"0 2px 2px 0"']);
  const falsch = [...new Set((app.match(/borderRadius: ([\w.]+|"[^"]*")/g) || [])
    .map((m) => m.slice("borderRadius: ".length)))]
    .filter((v) => !erlaubt.has(v) && !v.startsWith("`"));
  assert.deepStrictEqual(falsch, [],
    `Radien ausserhalb der Reihe: ${falsch.join(", ")}\n` +
    "R.s (8) fuer alles, was man anfasst; R.l (16) fuer Flaechen, auf denen etwas steht.");
});

test("Schriftgroessen und -gewichte kommen nur aus FS / NUMS / FW", () => {
  const groessen = [...new Set((oberflaeche.match(/fontSize: [\d.]+/g) || []))];
  assert.deepStrictEqual(groessen, [],
    `Zahl statt Marke: ${groessen.join(", ")} — FS.label/small/body/lead/h3/h2 oder NUMS.s/m/l nehmen`);
  const gewichte = [...new Set((oberflaeche.match(/fontWeight: \d+/g) || []))]
    .filter((g) => g !== "fontWeight: 400");   // 400 ist der Normalfall und hat keine Marke
  assert.deepStrictEqual(gewichte, [],
    `Zahl statt Marke: ${gewichte.join(", ")} — FW.label/body/semi/bold nehmen`);
});

test("Abstaende liegen auf 4 / 8 / 12 / 16 / 24 / 32", () => {
  const KEYS = "(?:padding|paddingTop|paddingBottom|paddingLeft|paddingRight" +
    "|margin|marginTop|marginBottom|marginLeft|marginRight|gap|rowGap|columnGap)";
  const stufen = new Set(["0", "4", "8", "12", "16", "24", "32"]);
  const falsch = [];
  zeilen.forEach((z, i) => {
    if (!istOberflaeche(i + 1)) return;
    for (const m of z.matchAll(new RegExp(KEYS + ": ([\\d.]+)(?![\\d.])", "g"))) {
      if (!stufen.has(m[1])) falsch.push(`Zeile ${i + 1}: ${m[0]}`);
    }
    for (const m of z.matchAll(new RegExp(KEYS + ': "([^"]+)"', "g"))) {
      for (const t of m[1].split(" ")) {
        if (t === "0") continue;
        const px = /^([\d.]+)px$/.exec(t);
        if (!px) continue;                      // Prozent/auto/Variablen sind nicht gemeint
        if (!stufen.has(px[1])) falsch.push(`Zeile ${i + 1}: ${m[0]}`);
      }
    }
  });
  assert.deepStrictEqual(falsch, [],
    `Abstaende neben der Skala:\n${falsch.join("\n")}\n` +
    "SP.xs/s/m/l/xl/xxl nehmen. Ein 13er-Abstand faellt einzeln nicht auf; dreissig davon sind der Grund, " +
    "warum eine Oberflaeche zusammengewuerfelt wirkt.");
});

test("Tailwind-Abstandsklassen liegen auf derselben Skala", () => {
  // px-5 sind 20px und damit neben der Reihe — die Klassen muessen dasselbe Raster treffen
  // wie die Inline-Werte, sonst hat die Oberflaeche zwei Rhythmen nebeneinander.
  const erlaubt = new Set(["0", "1", "2", "3", "4", "6", "8"]);
  const falsch = new Set();
  for (const m of app.matchAll(/className: "([^"]+)"/g)) {
    for (const t of m[1].split(" ")) {
      const k = /^(?:sm:|md:|lg:)?(?:p|px|py|pt|pb|pl|pr|m|mx|my|mt|mb|ml|mr|gap|gap-x|gap-y|space-x|space-y)-([\d.]+)$/.exec(t);
      if (k && !erlaubt.has(k[1])) falsch.add(t);
    }
  }
  assert.deepStrictEqual([...falsch], [],
    `Klassen neben der Skala: ${[...falsch].join(", ")} (1=4, 2=8, 3=12, 4=16, 6=24, 8=32)`);
});

test("Symbole haben eine Linienstaerke und zwei Groessen", () => {
  const staerken = [...new Set((app.match(/strokeWidth: [^,}\s]+/g) || []))];
  assert.deepStrictEqual(staerken, ["strokeWidth: ICO.sw"],
    `Mehr als eine Linienstaerke: ${staerken.join(", ")} — Symbole aus verschiedenen Saetzen fallen sofort auf`);
  const groessen = [...new Set((app.match(/createElement\("svg", \{ width: "(\d+)"/g) || [])
    .map((m) => m.match(/"(\d+)"/)[1]))];
  const falsch = groessen.filter((g) => !["16", "20"].includes(g));
  assert.deepStrictEqual(falsch, [], `Symbolgroessen ausserhalb 16/20: ${falsch.join(", ")}`);
});

test("die Flaeche haelt einen Ton - kein Verlauf hinter der Oberflaeche", () => {
  // Die Startseite kommt ohne Verlaeufe aus; im Rechner lag hinter der ganzen Seite ein
  // radialer, leicht blauer. Nebeneinander gehalten sah der Rechner deshalb "anders"
  // aus, ohne dass man sagen konnte warum. Erlaubt bleiben Verlaeufe nur DORT, wo ein
  // Bild entsteht: hinter der 3D-Buehne und als Vignette darueber.
  const zeilen = app.split("\n");
  const treffer = [];
  zeilen.forEach((z, i) => {
    if (!/radial-gradient/.test(z)) return;
    if (/mountRef|pointer-events-none/.test(z)) return;   // 3D-Buehne und ihre Vignette
    treffer.push(`Zeile ${i + 1}`);
  });
  assert.deepStrictEqual(treffer, [],
    `Verlauf als Flaechenhintergrund: ${treffer.join(", ")} — die Flaeche haelt EINEN Ton`);
});

test("es gibt genau einen Akzent", () => {
  // hint war #8B5CF6, ein Violett, das es sonst nirgends im Produkt gibt und auf der
  // Startseite schon gar nicht. Ein zweiter Akzent ist genau das, was eine Oberflaeche
  // zusammengesetzt aussehen laesst.
  const akz = (/\n\s*accent: "(#[0-9A-Fa-f]{6})"/.exec(app) || [])[1];
  const hint = (/\n\s*hint: "(#[0-9A-Fa-f]{6})"/.exec(app) || [])[1];
  assert.ok(akz, "C.accent nicht gefunden");
  assert.strictEqual(hint, akz, `hint (${hint}) weicht vom Akzent (${akz}) ab — ein Ton, nicht zwei`);
});

test("Schriftgewicht hoert bei 700 auf", () => {
  const schwer = app.match(/fontWeight: (800|900)|font-weight:\s*(800|900)/g) || [];
  assert.deepStrictEqual(schwer, [], `${schwer.length}× Gewicht ueber 700 — die Landingpage hoert bei 700 auf`);
});

test("Monospace nur an Zahlen, nicht als Kostuem", () => {
  // Monospace hat einen Zweck: Ziffern bleiben untereinander stehen. In kleinen Groessen steht
  // im Rechner aber Text — und der sieht in Schreibmaschinenschrift nur "technisch" aus.
  const KLEIN = new Set(["FS.label"]);
  const paare = [...app.matchAll(/fontFamily: MONO[^}]*?fontSize: ([\w.]+)|fontSize: ([\w.]+)[^}]*?fontFamily: MONO/g)]
    .map((m) => m[1] || m[2]);
  const zuKlein = paare.filter((g) => KLEIN.has(g) || (!isNaN(parseFloat(g)) && parseFloat(g) < 12.5));
  assert.deepStrictEqual(zuKlein, [], `Monospace in ${zuKlein.join(", ")} — dort steht Text, kein Mass`);
});

test("keine Emoji in der Oberflaeche", () => {
  const treffer = app.match(/[\u{1F300}-\u{1FAFF}]/gu) || [];
  assert.deepStrictEqual(treffer, [], `Emoji gefunden: ${treffer.join(" ")} — Linien-SVG oder Wort statt Bildchen`);
});

test("angezeigte Zahlen kennen die Sprache", () => {
  // toFixed liefert immer den englischen Punkt. In einer deutschen Oberflaeche ist "0.03 m"
  // das erste, was auffaellt. Erlaubt bleibt es nur dort, wo die Zahl kein Anzeigetext ist.
  const erlaubt = [
    /FL\.toFixed\(1\)/,          // Schluessel im Packer, keine Anzeige
    /FW\.toFixed\(1\)/,          // dito
    /\.toFixed\(0\)/             // Prozentwerte: ohne Nachkomma gibt es kein Trennzeichen
  ];
  const treffer = [];
  zeilen.forEach((z, i) => {
    for (const m of z.match(/[\w.()+\-*/ ]{0,40}\.toFixed\(\d\)/g) || []) {
      if (erlaubt.some((re) => re.test(m))) continue;
      treffer.push(`Zeile ${i + 1}: ${m.trim()}`);
    }
  });
  assert.deepStrictEqual(treffer, [], `toFixed in der Anzeige — nf()/fmtDE() nehmen:\n${treffer.join("\n")}`);
});
