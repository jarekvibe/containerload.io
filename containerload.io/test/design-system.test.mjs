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

// Die beiden Farbsaetze (UI-Umbau Phase 1): C_DUNKEL und C_HELL sind das sanktionierte
// Register — Werte DORT sind Entscheidungen, Werte im Markup sind Streuner. Die Flaechen-
// Wache nimmt die Definitionsbloecke deshalb aus (genau wie die Druckvorlage) und zaehlt
// nur, was daneben im Markup steht. Die Paletten selbst prueft der Block weiter unten.
const paletteBlock = (name) => {
  const von = zeilen.findIndex((z) => z.includes(`var ${name} = {`));
  assert.ok(von >= 0, `${name} nicht gefunden`);
  let bis = von;
  while (bis < zeilen.length && !/^\s{2}\};/.test(zeilen[bis])) bis++;
  return [von + 1, bis + 1];                     // 1-basiert, inklusive
};
const PAL_DUNKEL = paletteBlock("C_DUNKEL");
const PAL_HELL = paletteBlock("C_HELL");
// Die Buehnen-Paletten (helle 3D-Ansicht) sind dasselbe Register fuer die Szene.
const BUE_DUNKEL = paletteBlock("B_DUNKEL");
const BUE_HELL = paletteBlock("B_HELL");
const inPalette = (nr) =>
  (nr >= PAL_DUNKEL[0] && nr <= PAL_DUNKEL[1]) || (nr >= PAL_HELL[0] && nr <= PAL_HELL[1]) ||
  (nr >= BUE_DUNKEL[0] && nr <= BUE_DUNKEL[1]) || (nr >= BUE_HELL[0] && nr <= BUE_HELL[1]);

// Die head-CSS-Variablen (:root / [data-theme="hell"]) spiegeln dieselben Saetze —
// auch sie sind Register, kein Markup.
const istRegister = (nr) => inPalette(nr) || /^\s*:root(\[data-theme="hell"\])? \{ --/.test(zeilen[nr - 1]);

test("es bleibt bei sechs Flaechenstufen", () => {
  const gezaehlt = new Set();
  zeilen.forEach((z, i) => {
    if (istRegister(i + 1)) return;
    for (const roh of z.match(/#[0-9A-Fa-f]{6}\b/g) || []) {
      const h = roh.toLowerCase();
      const [r, g, b] = [1, 3, 5].map((j) => parseInt(h.slice(j, j + 2), 16));
      if ((r + g + b) / 3 >= 0x50) continue;      // nur dunkle Flaechen und Linien
      if (AUSNAHMEN.has(h)) continue;
      gezaehlt.add(h);
    }
  });
  assert.ok(gezaehlt.size <= 6,
    `${gezaehlt.size} dunkle Werte statt hoechstens 6: ${[...gezaehlt].join(", ")}\n` +
    "Neue Zwischentoene sammeln sich an, bis kein Rahmen mehr etwas bedeutet. " +
    "Entweder eine bestehende Stufe nehmen oder hier bewusst eintragen.");
});

// ── Die zwei Farbsaetze: gleiche Schluessel, gleiche Lesbarkeit ──────────────────────────
const liesPalette = ([von, bis]) => {
  const obj = {};
  for (let i = von; i <= bis; i++) {
    const m = /^\s{4}(\w+): "(#[0-9A-Fa-f]{6}|linear-gradient[^"]*)"/.exec(zeilen[i - 1]);
    if (m) obj[m[1]] = m[2];
  }
  return obj;
};
const DUNKEL = liesPalette(PAL_DUNKEL);
const HELL = liesPalette(PAL_HELL);

test("beide Farbsaetze tragen dieselben Marken", () => {
  assert.ok(Object.keys(DUNKEL).length >= 20, `C_DUNKEL unvollstaendig gelesen (${Object.keys(DUNKEL).length})`);
  assert.deepStrictEqual(Object.keys(HELL).sort(), Object.keys(DUNKEL).sort(),
    "C_HELL und C_DUNKEL muessen DIESELBEN Schluessel tragen — ein Schluessel, den nur ein Satz " +
    "kennt, ist im anderen Thema undefined und faerbt nichts.");
});

test("es gibt genau einen Akzent — in beiden Saetzen", () => {
  for (const [name, p] of [["C_DUNKEL", DUNKEL], ["C_HELL", HELL]]) {
    assert.ok(p.accent, `${name}: accent fehlt`);
    assert.strictEqual(p.hint, p.accent, `${name}: hint (${p.hint}) weicht vom Akzent (${p.accent}) ab — ein Ton, nicht zwei`);
    assert.strictEqual(p.teal, p.accent, `${name}: teal (${p.teal}) weicht vom Akzent (${p.accent}) ab — ein Ton, nicht zwei`);
    assert.ok(p.grad.includes(p.accent), `${name}: grad traegt nicht den Akzent`);
  }
});

test("die Lesbarkeitsgrenze 4,5:1 gilt fuer BEIDE Farbsaetze", () => {
  // Dieselbe Rechnung, mit der faint im Dunkeln auf #7689A0 gehoben wurde (WCAG AA) —
  // jetzt als Wache, damit kein Satz beim Nachjustieren stillschweigend darunter rutscht.
  const lum = (hex) => {
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
      .map((c) => c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const kontrast = (a, b) => {
    const [la, lb] = [lum(a), lum(b)];
    return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
  };
  const flaechen = ["bg", "chrome", "surface", "raised", "field"];
  // text/dim/faint/soft sind Fliess- und Nebentexte: 4,5:1 auf JEDER Flaechenstufe.
  // Die Status- und Akzent-Texttoene stehen fett oder auf hellen Tint-Flaechen; fuer sie
  // gilt 4,5:1 auf den Karten-Stufen (chrome/surface/raised/field), nicht auf bg.
  for (const [name, p] of [["C_DUNKEL", DUNKEL], ["C_HELL", HELL]]) {
    for (const t of ["text", "dim", "faint", "soft"])
      for (const f of flaechen)
        assert.ok(kontrast(p[t], p[f]) >= 4.5,
          `${name}: ${t} (${p[t]}) auf ${f} (${p[f]}) = ${kontrast(p[t], p[f]).toFixed(2)}:1 — unter 4,5`);
    for (const t of ["info", "accText", "warnSoft", "good", "warn", "bad"])
      for (const f of ["chrome", "surface", "raised", "field"])
        assert.ok(kontrast(p[t], p[f]) >= 4.5,
          `${name}: ${t} (${p[t]}) auf ${f} (${p[f]}) = ${kontrast(p[t], p[f]).toFixed(2)}:1 — unter 4,5`);
    // Knopftext auf gefuellten Flaechen.
    assert.ok(kontrast(p.onAcc, p.accent) >= 4.0,
      `${name}: onAcc auf accent = ${kontrast(p.onAcc, p.accent).toFixed(2)}:1`);
    assert.ok(kontrast(p.onWarn, p.warn) >= 4.5,
      `${name}: onWarn auf warn = ${kontrast(p.onWarn, p.warn).toFixed(2)}:1`);
  }
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
  // Stevies Sprechblasen tragen ein Schwaenzchen (Jareks Richtung: der Chat darf
  // anders aussehen als der Rest) — zwei asymmetrische Radien aus R.l/4, sonst nichts.
  const erlaubt = new Set(["R.s", "R.l", "999", '"50%"', '"0 2px 2px 0"', '"16px 16px 16px 4px"', '"16px 16px 4px 16px"']);
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
    if (istRegister(i + 1)) return;                       // die Buehnen-Verlaeufe stehen in B
    treffer.push(`Zeile ${i + 1}`);
  });
  assert.deepStrictEqual(treffer, [],
    `Verlauf als Flaechenhintergrund: ${treffer.join(", ")} — die Flaeche haelt EINEN Ton`);
});

// „es gibt genau einen Akzent" ist in die Farbsatz-Wachen oben gewandert — seit Phase 1
// gilt die Zusage je Satz (accent = hint = teal, in C_DUNKEL wie in C_HELL).

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
