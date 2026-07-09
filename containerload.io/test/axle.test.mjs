// Reine Logik-Prüfung von axleLoads (P5). Byte-identisch zur Inline-Fassung in app.html.
import assert from "node:assert";

function axleLoads(W, cogFromFrontCm, kingpinFromFrontCm, bogieFromFrontCm) {
  const Lkb = bogieFromFrontCm - kingpinFromFrontCm;
  if (!(Lkb > 0) || !(W > 0)) return null;
  const s = cogFromFrontCm - kingpinFromFrontCm;
  const bogie = W * s / Lkb;
  const kingpin = W - bogie;
  return { kingpin, bogie, Lkb, s };
}

// Quelle-Beispiel: W=20 t, Kingpin bei 0, CoG 384 cm dahinter, Bogie 960 cm hinter Kingpin
const r = axleLoads(20000, 384, 0, 960);
assert.ok(Math.abs(r.bogie - 8000) < 1, "Aufliegerachse ~8 t");
assert.ok(Math.abs(r.kingpin - 12000) < 1, "Sattellast ~12 t");
assert.ok(Math.abs(r.kingpin + r.bogie - 20000) < 1, "Summe = W");

// Ungültige Geometrie (Bogie vor Kingpin) -> null
assert.strictEqual(axleLoads(20000, 384, 500, 300), null, "Lkb<=0 -> null");
// Kein Gewicht -> null
assert.strictEqual(axleLoads(0, 384, 0, 960), null, "W<=0 -> null");

console.log("axleLoads: alle Tests grün");
