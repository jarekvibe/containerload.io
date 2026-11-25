// Die Ladeliste als CSV -- eine Zeile je Position UND Container.
//
// Vorher hatte die Datei elf Spalten, und keine davon nannte den Container: wer drei
// Container buchte, bekam eine Liste ohne Aufteilung. Genau die Zahl, die an der Rampe
// zaehlt ("was kommt in den zweiten?"), fehlte.
//
// Diese Datei hatte ausserdem eine EIGENE KOPIE von buildCargoCSV, mit dem Kommentar
// "byte-identisch zur Inline-Fassung in app.html". Sie war es laengst nicht mehr -- der
// Kopie fehlten stackH und perTypeAll, und der Test haette jede Aenderung an app.html
// stillschweigend durchgewunken. Jetzt wird die Funktion aus app.html HERAUSGESCHNITTEN,
// wie es die uebrigen Tests dieses Projekts auch tun.
//
// node --test test/csv.test.mjs
import fs from "node:fs";
import assert from "node:assert";
import test from "node:test";
import { fileURLToPath } from "node:url";
import path from "node:path";

const dir = path.dirname(fileURLToPath(import.meta.url));
const L = fs.readFileSync(path.join(dir, "..", "app.html"), "utf8").split("\n");
const s = L.findIndex((l) => l.includes("function buildCargoCSV"));
const e = L.findIndex((l, i) => i > s && l.trim() === "}" && L[i - 1].includes('return lines.join'));
assert.ok(s >= 0 && e > s, "buildCargoCSV nicht gefunden");
const { buildCargoCSV } = new Function(
  L.slice(s, e + 1).join("\n") + "\nreturn { buildCargoCSV };"
)();

const spalten = (zeile) => zeile.split(";");
const kopfVon = (csv) => spalten(csv.split("\r\n")[0]);

const PAL = { name: "Euro; Palette", l: 120, w: 80, h: 110, weight: 250, qty: 4, stackable: false, rotatable: true };

test("ein Container: eine Zeile je Position, mit der Marke davor", () => {
  const csv = buildCargoCSV([PAL], { perType: [{ loaded: 4, total: 4 }] }, {}, "20' GP", {});
  const z = csv.split("\r\n");
  assert.strictEqual(z.length, 2, "Kopf + 1 Datenzeile");
  assert.strictEqual(kopfVon(csv)[0], "Container", "die Container-Spalte steht vorn");
  assert.ok(z[1].startsWith("C1;"), `Marke fehlt: ${z[1]}`);
  assert.ok(z[1].includes('"Euro; Palette"'), "Semikolon im Namen wird gequotet");
  assert.ok(z[1].includes(";1000;"), "Gesamtgewicht 250 x 4 = 1000");
  assert.ok(z[1].includes(";nein;ja;"), "Stapelbar = nein, Drehbar = ja");
  assert.strictEqual(spalten(z[1]).pop(), "4", "die eingegebene Menge steht am Ende");
});

test("Landfracht markiert Fahrzeuge, nicht Container", () => {
  const csv = buildCargoCSV([PAL], { perType: [{ loaded: 4, total: 4 }] }, {}, "Planensattel", { domain: "road" });
  assert.ok(csv.split("\r\n")[1].startsWith("F1;"), "auf der Strasse heisst die Marke F1");
});

test("mehrere Container: eine Zeile je Position und Container", () => {
  // Die gemeldete Sendung: 9 flache Stuecke (2 in C1, 7 in C2) + 22 Paletten (alle in C1).
  const cargo = [
    { name: "Flach", l: 250, w: 80, h: 30, weight: 300, qty: 9, stackable: false },
    { name: "Palette", l: 120, w: 80, h: 110, weight: 300, qty: 22, stackMax: 3 },
  ];
  const box = (ti) => ({ ti, x: 0, y: 0, z: 0, dx: 1, dy: 1, dz: 1 });
  const result = { chain: [
    { placed: [...Array(2)].map(() => box(0)).concat([...Array(22)].map(() => box(1))) },
    { placed: [...Array(7)].map(() => box(0)) },
  ] };
  const z = buildCargoCSV(cargo, result, {}, "40' HC", {}).split("\r\n").slice(1);
  assert.strictEqual(z.length, 3, `erwartet 3 Datenzeilen, waren ${z.length}:\n${z.join("\n")}`);
  assert.ok(z[0].startsWith("C1;Flach;2;"), z[0]);
  assert.ok(z[1].startsWith("C1;Palette;22;"), z[1]);
  assert.ok(z[2].startsWith("C2;Flach;7;"), z[2]);
  // Das Gewicht je Zeile ist das Gewicht DIESER Menge -- sonst summiert sich ein Container falsch.
  assert.strictEqual(spalten(z[0])[7], "600", "2 x 300 kg");
  assert.strictEqual(spalten(z[2])[7], "2100", "7 x 300 kg");
  // Und die Summe je Container ergibt das, was der Container wiegt.
  const kgVon = (marke) => z.filter((r) => r.startsWith(marke + ";")).reduce((a, r) => a + +spalten(r)[7], 0);
  assert.strictEqual(kgVon("C1"), 600 + 6600);
  assert.strictEqual(kgVon("C2"), 2100);
});

test("was nicht verladen ist, steht als 'offen' da", () => {
  const cargo = [{ name: "Lang", l: 1400, w: 100, h: 100, weight: 500, qty: 2 }];
  const csv = buildCargoCSV(cargo, { chain: [{ placed: [] }] }, {}, "40' HC", {});
  const z = csv.split("\r\n").slice(1);
  assert.strictEqual(z.length, 1, "die Position darf nicht verschwinden, nur weil nichts hineingeht");
  assert.ok(z[0].startsWith("offen;Lang;2;"), z[0]);
});

test("keine Position geht verloren und keine wird doppelt gezaehlt", () => {
  let seed = 5;
  const rnd = () => ((seed = (seed * 1103515245 + 12345) & 2147483647) / 2147483647);
  const ri = (a, b) => a + Math.floor(rnd() * (b - a + 1));
  for (let f = 0; f < 30; f++) {
    const cargo = [];
    for (let t = 0; t < ri(1, 4); t++) cargo.push({ name: "T" + t, l: 100, w: 80, h: 90, weight: ri(10, 400), qty: ri(1, 20) });
    // Zufaellige Aufteilung auf ein bis drei Container, Rest bleibt offen.
    const n = ri(1, 3);
    const rest = cargo.map((c) => c.qty);
    const chain = [...Array(n)].map(() => ({ placed: [] }));
    cargo.forEach((c, i) => {
      chain.forEach((sl) => {
        const nimm = ri(0, rest[i]);
        for (let k = 0; k < nimm; k++) sl.placed.push({ ti: i });
        rest[i] -= nimm;
      });
    });
    const z = buildCargoCSV(cargo, { chain }, {}, "40' HC", {}).split("\r\n").slice(1);
    cargo.forEach((c, i) => {
      const summe = z.filter((r) => spalten(r)[1] === c.name).reduce((a, r) => a + +spalten(r)[2], 0);
      assert.strictEqual(summe, c.qty,
        `Fall ${f}, ${c.name}: die Zeilen ergeben ${summe} statt der eingegebenen ${c.qty}`);
    });
  }
});

// ── Die Sprache der Datei (25.11.26) ────────────────────────────────────────────────────
// Spaltenkoepfe und die paar Woerter darin waren seit jeher deutsch -- auch im englischen
// Rechner. Jetzt kommen sie aus T.csv; ohne Angabe gilt Deutsch (die deutsche Fassung steht
// nur in buildCargoCSV selbst, I18N.de.csv ist bewusst null).
const roh = L.join("\n");
const DE_KOPF = ["Container", "Position", "Menge", "Laenge_cm", "Breite_cm", "Hoehe_cm", "Gewicht_kg_Stueck", "Gewicht_kg_gesamt", "Stapelbar", "Drehbar_90", "Eingegeben"];
// Die Sprachen: Englisch aus app.html, die weiteren aus sprache/<k>.js
const enBlock = /exportDone: "Cargo list exported",\n\s*csv: (\{[\s\S]*?\n\s*\}),\n/.exec(roh);
assert.ok(enBlock, "das englische csv-Woerterbuch wurde nicht gefunden");
const SPRACHEN = { en: new Function("return " + enBlock[1])() };
for (const f of fs.readdirSync(path.join(dir, "..", "sprache")).filter((x) => x.endsWith(".js"))) {
  const w = { CL_SPRACHE: {} };
  new Function("window", fs.readFileSync(path.join(dir, "..", "sprache", f), "utf8"))(w);
  const k = f.replace(".js", "");
  const el = (typ, _p, ...kinder) => ({ typ, kinder });
  SPRACHEN[k] = w.CL_SPRACHE[k].texte({ React: { createElement: el, Fragment: "f" }, C: new Proxy({}, { get: () => "#000000" }), plu: (n, a, b) => n + " " + (n === 1 ? a : b), fmtDE: (n) => String(n), loc: () => "en-GB" }).csv;
}

test("ohne Angabe bleibt die Datei deutsch -- Zeichen fuer Zeichen wie bisher", () => {
  const cargo = [{ name: "", l: 120, w: 80, h: 110, weight: 250, qty: 5, stackable: false, rotatable: false }, { name: "B", l: 60, w: 40, h: 40, weight: 12, qty: 2, stackH: 180 }, { name: "C", l: 60, w: 40, h: 40, weight: 12, qty: 2, stackMax: 3 }];
  const csv = buildCargoCSV(cargo, { perType: [{ loaded: 3 }, { loaded: 2 }, { loaded: 2 }] }, {}, "20' GP", {});
  assert.deepStrictEqual(csv.split("\r\n"), [
    DE_KOPF.join(";"),
    "C1;Position 1;3;120;80;110;250;750;nein;nein;5",
    "C1;B;2;60;40;40;12;24;bis 180 cm;ja;2",
    "C1;C;2;60;40;40;12;24;max. 3;ja;2",
    "offen;Position 1;2;120;80;110;250;500;nein;nein;5",
  ]);
  assert.ok(/exportDone: "Ladeliste exportiert",\n[^\n]*\n\s*csv: null,/.test(roh), "I18N.de.csv ist nicht mehr leer -- die deutsche Fassung gaebe es dann zweimal");
});

test("mit T.csv spricht die Datei die Sprache der Oberflaeche", () => {
  assert.ok(roh.includes("const csv = buildCargoCSV(cargo, result, container, preset, { domain, texte: T.csv });"), "der Export reicht die Texte nicht durch");
  const cargo = [{ name: "", l: 120, w: 80, h: 110, weight: 250, qty: 5, stackable: false, rotatable: false }, { name: "B", l: 60, w: 40, h: 40, weight: 12, qty: 2, stackH: 180 }, { name: "C", l: 60, w: 40, h: 40, weight: 12, qty: 2, stackMax: 3 }];
  const en = buildCargoCSV(cargo, { perType: [{ loaded: 3 }, { loaded: 2 }, { loaded: 2 }] }, {}, "20' GP", { texte: SPRACHEN.en }).split("\r\n");
  assert.deepStrictEqual(en, [
    "Container;Item;Qty;Length_cm;Width_cm;Height_cm;Weight_kg_each;Weight_kg_total;Stackable;Rotatable_90;Entered",
    "C1;Item 1;3;120;80;110;250;750;no;no;5",
    "C1;B;2;60;40;40;12;24;up to 180 cm;yes;2",
    "C1;C;2;60;40;40;12;24;max. 3;yes;2",
    "open;Item 1;2;120;80;110;250;500;no;no;5",
  ]);
  assert.ok(Object.keys(SPRACHEN).length >= 4, "Sprachdateien nicht gefunden: " + Object.keys(SPRACHEN));
  for (const [k, W] of Object.entries(SPRACHEN)) {
    assert.ok(W && Array.isArray(W.kopf), `${k}: kein csv-Woerterbuch`);
    assert.strictEqual(W.kopf.length, DE_KOPF.length, `${k}: ${W.kopf.length} Spaltenkoepfe statt ${DE_KOPF.length}`);
    assert.strictEqual(new Set(W.kopf).size, W.kopf.length, `${k}: doppelter Spaltenkopf`);
    // Koepfe ohne Trenner, Anfuehrungszeichen und Leerzeichen -- sie sollen sich in Excel und
    // in Skripten ohne Quoting benutzen lassen.
    for (const h of W.kopf) assert.ok(h && !/[;",\s]/.test(h), `${k}: Spaltenkopf „${h}" braucht Quoting`);
    // Die Einheiten bleiben cm und kg -- und stehen an denselben Spalten wie im Deutschen.
    W.kopf.forEach((h, i) => assert.strictEqual(/_cm$/.test(h) || /_cm\b/.test(h), /_cm$/.test(DE_KOPF[i]), `${k}: Spalte ${i + 1} („${h}") und die Einheit cm`));
    assert.strictEqual(W.kopf.filter((h) => /kg/.test(h)).length, 2, `${k}: zwei Gewichtsspalten in kg`);
    for (const key of ["ja", "nein", "offen"]) assert.ok(typeof W[key] === "string" && W[key] && !/[;"\n]/.test(W[key]), `${k}: ${key}`);
    assert.notStrictEqual(W.ja, W.nein, `${k}: ja und nein sind dasselbe Wort`);
    assert.ok(W.bis(180).includes("180") && W.bis(180).includes("cm") && W.max(3).includes("3") && W.pos(7).includes("7"), `${k}: bis/max/pos nennen ihre Zahl nicht`);
    // Die Datei bleibt lesbar: gleiche Zeilenzahl, gleiche Zahlen wie auf Deutsch.
    const z = buildCargoCSV(cargo, { perType: [{ loaded: 3 }, { loaded: 2 }, { loaded: 2 }] }, {}, "20' GP", { texte: W }).split("\r\n");
    assert.strictEqual(z.length, 5, `${k}: Zeilenzahl`);
    assert.strictEqual(spalten(z[1]).slice(2, 8).join(";"), "3;120;80;110;250;750", `${k}: Zahlen der ersten Zeile`);
    assert.strictEqual(spalten(z[4])[0], W.offen, `${k}: die Marke fuer nicht Verladenes`);
  }
});
