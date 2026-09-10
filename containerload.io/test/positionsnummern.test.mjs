// Positionsnummern auf den Kisten in 3D -- der Vertrag im Quelltext.
//
// Die Plaketten tragen dieselbe Nummer wie die POS-Spalte der Ladeliste und die
// Beschriftung im PDF-Stauplan: der Index unter den Positionen mit Menge > 0.
// Zwei Zaehlungen fuer dieselbe Kiste ("im Bild die 03, auf dem Papier die 04")
// waeren genau der Widerspruch, den das Projekt ueberall sonst ausgebaut hat --
// deshalb prueft dieser Test die Formel AUF BEIDEN SEITEN und faellt um, sobald
// eine Seite allein geaendert wird.
//
// node --test test/positionsnummern.test.mjs
import fs from "node:fs";
import assert from "node:assert";
import test from "node:test";
import { fileURLToPath } from "node:url";
import path from "node:path";

const dir = path.dirname(fileURLToPath(import.meta.url));
const src = fs.readFileSync(path.join(dir, "..", "app.html"), "utf8");
const schnitt = (von, bis) => {
  const a = src.indexOf(von);
  assert.ok(a >= 0, `nicht gefunden: ${von}`);
  const b = src.indexOf(bis, a);
  assert.ok(b > a, `Ende nicht gefunden: ${bis}`);
  return src.slice(a, b);
};

// Der Nummern-Effekt im Viewport, vom Kommentar bis zu seiner Dep-Liste.
const effekt = schnitt("// Positionsnummern (3D):", '[zeigeNummern, result, cargo, container, domain, fokus]');

test("eine Nummernquelle: 3D rechnet woertlich dieselbe Formel wie das PDF", () => {
  // Beide Seiten filtern auf Menge > 0 und nummerieren ueber items.indexOf + 1.
  assert.ok(effekt.includes("cargo || []).filter((c) => num(c.qty, 0) > 0"),
    "der 3D-Effekt filtert nicht auf Menge > 0");
  assert.ok(effekt.includes("items.indexOf(cargo[ti])"),
    "der 3D-Effekt nummeriert nicht ueber items.indexOf");
  // Die PDF-Seite (buildLadevorschlag) traegt dieselbe Formel -- wer dort
  // umbaut, muss hier vorbei und die 3D-Seite mitziehen.
  assert.ok(src.includes("const items = cargo.filter((c) => num(c.qty, 0) > 0)"),
    "die PDF-Seite filtert nicht mehr auf Menge > 0 -- Nummernquellen driften");
  assert.ok(src.includes("tiPos[p.ti] = items.indexOf(it) + 1"),
    "die PDF-Seite nummeriert nicht mehr ueber items.indexOf -- Nummernquellen driften");
});

test("Standard AUS, und das Einschalten zaehlt die Nutzung", () => {
  assert.ok(src.includes("const [zeigeNummern, setZeigeNummern] = useState(false)"),
    "die Plaketten muessen standardmaessig AUS sein");
  // Gezaehlt wird nur beim Einschalten (n truthy), nie beim Ausschalten.
  assert.ok(src.includes('if (n) zaehl("nummern-3d")'),
    "das Einschalten zaehlt nicht (oder zaehlt anders als vereinbart)");
});

test("alte Plaketten werden beim Neuaufbau entsorgt (Texturen und Materialien)", () => {
  assert.ok(effekt.includes("t.numMeshes || []") && effekt.includes("m.material.map.dispose()"),
    "der Effekt raeumt alte Sprites nicht ab -- jede Aenderung liesse Texturen liegen");
});

test("ab mehr als 40 sichtbaren Kisten wird je Sorte geclustert, nicht je Stueck", () => {
  assert.ok(effekt.includes("sichtbar > 40"),
    "die Cluster-Schwelle fehlt -- vierzig einzelne Nummern uebereinander liest niemand");
  // Der Cluster traegt die Stueckzahl ("04 x22"), nicht nur die Nummer.
  assert.ok(effekt.includes("plakette(nr, arr.length"),
    "die Cluster-Plakette nennt die Stueckzahl nicht");
});

test("der Fokus gilt auch fuer die Plaketten", () => {
  assert.ok(effekt.includes('fokus !== "alle" && fokus !== ci) return'),
    "Plaketten anderer Container muessen mit dem Fokus verschwinden");
});

test("beide Sprachen kennen den Schalter", () => {
  assert.ok(src.includes('numAn: "Positionsnummern anzeigen"') && src.includes('numAn: "Show position numbers"'),
    "numAn fehlt in einer Sprache");
  assert.ok(src.includes('numAus: "Positionsnummern ausblenden"') && src.includes('numAus: "Hide position numbers"'),
    "numAus fehlt in einer Sprache");
});
