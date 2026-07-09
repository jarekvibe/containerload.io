// Reine Logik-Prüfung von loadingOrder (P4). Byte-identisch zur Inline-Fassung in app.html.
import assert from "node:assert";

function loadingOrder(placed) {
  const sorted = [...placed].sort((a, b) => a.x - b.x || a.y - b.y || a.z - b.z || a.ti - b.ti);
  const firstRankOfType = new Map();
  sorted.forEach((p, idx) => {
    if (!firstRankOfType.has(p.ti)) firstRankOfType.set(p.ti, idx);
  });
  const types = [...firstRankOfType.entries()].sort((a, b) => a[1] - b[1]);
  const rank = new Map();
  types.forEach(([ti], i) => rank.set(ti, i + 1));
  return rank;
}

// vorne unten zuerst
const placed = [
  { x: 900, y: 0, z: 0, ti: 1 },
  { x: 0, y: 0, z: 0, ti: 0 },
  { x: 0, y: 100, z: 0, ti: 0 },
];
const r = loadingOrder(placed);
assert.strictEqual(r.get(0), 1, "x=0 zuerst");
assert.strictEqual(r.get(1), 2, "x=900 danach");

// drei Typen, gemischte Positionen: Reihenfolge nach frühestem x
const p2 = [
  { x: 500, y: 0, z: 0, ti: 2 },
  { x: 100, y: 0, z: 0, ti: 1 },
  { x: 100, y: 200, z: 0, ti: 0 }, // gleiches x=100, aber höher -> nach ti1
];
const r2 = loadingOrder(p2);
assert.strictEqual(r2.get(1), 1, "x=100 y=0 zuerst");
assert.strictEqual(r2.get(0), 2, "x=100 y=200 danach");
assert.strictEqual(r2.get(2), 3, "x=500 zuletzt");

console.log("loadingOrder: alle Tests grün");
