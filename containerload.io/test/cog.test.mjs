// Reine Logik-Prüfung von computeLongCog (Slice 1). Kein Browser nötig.
// Die Funktion ist byte-identisch zur Inline-Fassung in app.html.
import assert from "node:assert";

function computeLongCog(placed, weightOf, contLenCm) {
  const L = Math.max(1, +contLenCm || 1);
  let W = 0, mom = 0, front = 0, rear = 0; // front = vordere Hälfte (x < L/2)
  for (const p of placed) {
    const w = Math.max(0, +weightOf(p.ti) || 0);
    if (w === 0) continue;
    const cx = (+p.x || 0) + (+p.dx || 0) / 2; // Längs-Mitte der Colli (cm)
    W += w;
    mom += w * cx;
    if (cx < L / 2) front += w; else rear += w;
  }
  if (W <= 0) return null;
  const cogCm = mom / W;
  const cogPct = cogCm / L * 100;
  const frontPct = front / W * 100;
  const rearPct = rear / W * 100;
  const devPct = cogPct - 50;
  let balance;
  if (devPct < -5) balance = "front";
  else if (devPct > 5) balance = "rear";
  else balance = "balanced";
  return { totalKg: W, cogCm, cogPct, frontPct, rearPct, devPct, balance };
}

// 1) Symmetrische Ladung → Schwerpunkt in der Mitte, ausbalanciert.
{
  const placed = [
    { x: 0,   dx: 100, ti: 0 },
    { x: 490, dx: 100, ti: 0 }, // Container 590 cm: Boxen symmetrisch um Mitte 295
  ];
  const r = computeLongCog(placed, () => 1000, 590);
  assert.ok(Math.abs(r.cogPct - 50) < 0.5, "symmetrisch → ~50 %");
  assert.strictEqual(r.balance, "balanced");
  assert.ok(Math.abs(r.frontPct - 50) < 0.5 && Math.abs(r.rearPct - 50) < 0.5);
}

// 2) Alles vorne → kopflastig.
{
  const placed = [ { x: 0, dx: 100, ti: 0 }, { x: 100, dx: 100, ti: 0 } ];
  const r = computeLongCog(placed, () => 500, 1203);
  assert.ok(r.cogPct < 20, "vorne → niedriger Prozentwert");
  assert.strictEqual(r.balance, "front");
}

// 3) Alles hinten → hecklastig.
{
  const placed = [ { x: 1000, dx: 100, ti: 0 }, { x: 1100, dx: 100, ti: 0 } ];
  const r = computeLongCog(placed, () => 500, 1203);
  assert.ok(r.cogPct > 80, "hinten → hoher Prozentwert");
  assert.strictEqual(r.balance, "rear");
}

// 4) Unterschiedliche Gewichte verschieben den Schwerpunkt korrekt (Momentbilanz).
{
  const placed = [ { x: 0, dx: 0, ti: 0 }, { x: 1000, dx: 0, ti: 1 } ];
  const w = { 0: 3000, 1: 1000 }; // vorne 3000 kg bei 0 cm, hinten 1000 kg bei 1000 cm → CoG = 250 cm
  const r = computeLongCog(placed, (ti) => w[ti], 1203);
  assert.ok(Math.abs(r.cogCm - 250) < 1, "gewichteter Schwerpunkt = 250 cm");
}

// 5) Keine Gewichte → null (Panel wird ausgeblendet).
{
  const r = computeLongCog([{ x: 0, dx: 100, ti: 0 }], () => 0, 590);
  assert.strictEqual(r, null);
}

console.log("computeLongCog: alle Tests grün");
