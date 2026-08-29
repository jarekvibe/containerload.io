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
