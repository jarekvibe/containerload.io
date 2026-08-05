// Reine Logik-Prüfung von buildCargoCSV (P3). Byte-identisch zur Inline-Fassung in app.html.
import assert from "node:assert";

function buildCargoCSV(cargo, result, container, preset, opts) {
  const sep = opts && opts.sep || ";";
  const esc = (v) => {
    const s = String(v == null ? "" : v);
    return /[";\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };
  const row = (arr) => arr.map(esc).join(sep);
  const lines = [];
  lines.push(row(["Position", "Menge", "Laenge_cm", "Breite_cm", "Hoehe_cm", "Gewicht_kg_Stueck", "Gewicht_kg_gesamt", "Stapelbar", "Drehbar_90", "Geladen", "Gesamt"]));
  cargo.forEach((c, i) => {
    const q = Math.max(0, +c.qty || 0);
    const pt = result && result.perType && result.perType[i] || { loaded: "", total: q };
    lines.push(row([
      c.name || "Position " + (i + 1),
      q, +c.l || 0, +c.w || 0, +c.h || 0,
      +c.weight || 0, (+c.weight || 0) * q,
      c.stackable === false ? "nein" : isFinite(c.stackMax) && +c.stackMax >= 2 ? "max. " + +c.stackMax : "ja",
      c.rotatable === false ? "nein" : "ja",
      pt.loaded, pt.total
    ]));
  });
  return lines.join("\r\n");
}

const cargo = [{ name: "Euro; Palette", l: 120, w: 80, h: 110, weight: 250, qty: 4, stackable: false, rotatable: true }];
const result = { perType: [{ loaded: 4, total: 4 }] };
const csv = buildCargoCSV(cargo, result, {}, "20' GP", {});
const rows = csv.split("\r\n");
assert.strictEqual(rows.length, 2, "Kopf + 1 Datenzeile");
assert.ok(rows[1].includes('"Euro; Palette"'), "Semikolon im Namen wird gequotet");
assert.ok(rows[1].includes(";1000;"), "Gesamtgewicht 250*4 = 1000");
assert.ok(rows[1].includes(";nein;ja;"), "Stapelbar=nein, Drehbar=ja");

console.log("buildCargoCSV: alle Tests grün");
