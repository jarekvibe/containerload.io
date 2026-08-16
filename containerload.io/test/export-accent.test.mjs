// Logik-Test fuer den Export-Bild-Farbwaehler (nur die exportierte Ansichtsbild-PNG).
// Extrahiert shade + exportAccentStops + EXPORT_ACCENTS aus app.html
// (Block zwischen "var hexA =" und "function makeFloorPacker").
import fs from "node:fs";
import assert from "node:assert";
import test from "node:test";
import { fileURLToPath } from "node:url";
import path from "node:path";

const dir = path.dirname(fileURLToPath(import.meta.url));
const L = fs.readFileSync(path.join(dir, "..", "app.html"), "utf8").split("\n");
const s = L.findIndex((l) => l.includes("var hexA = (hex, a) =>"));
const e = L.findIndex((l, i) => i > s && l.includes("function makeFloorPacker"));
const { shade, exportAccentStops, EXPORT_ACCENTS } = new Function(
  L.slice(s, e).join("\n") + "\nreturn { shade, exportAccentStops, EXPORT_ACCENTS };"
)();

test("shade veraendert die Farbe, liefert gueltigen Hex und clamped", () => {
  assert.notStrictEqual(shade("#0057a3", -0.22).toLowerCase(), "#0057a3");
  assert.ok(/^#[0-9a-f]{6}$/i.test(shade("#0057a3", -0.22)), "gueltiger Hex-String");
  assert.strictEqual(shade("#000000", -0.22), "#000000", "Schwarz bleibt Schwarz (Clamp)");
});

// Seit der Umstellung auf EINEN Markenton gilt fuer den Standard dieselbe Regel wie fuer
// selbst gewaehlte Farben: Akzent + abgedunkelter Akzent. Ein Verlauf zwischen zwei
// verschiedenen Markentoenen existiert nicht mehr.
test("exportAccentStops: immer Farbe + Abdunklung, auch im Standard", () => {
  const [sa, sb] = exportAccentStops(null);
  assert.strictEqual(sa, "#C8402C", "standard = Markenakzent");
  assert.ok(/^#[0-9a-f]{6}$/i.test(sb), "zweiter Stop ist gueltiger Hex");
  assert.notStrictEqual(sb.toLowerCase(), sa.toLowerCase(), "zweiter Stop ist wirklich dunkler, kein Verlauf ins Nichts");
  const [a, b] = exportAccentStops("#0057a3");
  assert.strictEqual(a, "#0057a3", "erster Stop = gewaehlte Farbe");
  assert.ok(/^#[0-9a-f]{6}$/i.test(b) && b.toLowerCase() !== "#0057a3", "zweiter Stop abgedunkelt");
});

test("Presets: genau standard/blau/rot, kein Weiss", () => {
  assert.deepStrictEqual(Object.keys(EXPORT_ACCENTS), ["standard", "blau", "rot"]);
  assert.strictEqual(EXPORT_ACCENTS.standard, null, "standard = kein Override");
  const vals = Object.values(EXPORT_ACCENTS).filter(Boolean).map((h) => h.toLowerCase());
  assert.ok(!vals.includes("#ffffff") && !vals.includes("#fff"), "kein Weiss");
});

console.log("export-accent: alle Tests gruen");
