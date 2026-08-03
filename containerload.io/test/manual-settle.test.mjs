// Regressionstest für settlePlaced: nach Löschen/Verschieben/Drehen einer bereits platzierten
// Kiste darf keine darüber liegende Kiste in der Luft stehen bleiben – sie muss nachrutschen.
// Ohne das sieht ein Stapel im 3D-Bild aus, als steckten die Packstücke ineinander.
// node --test test/manual-settle.test.mjs
import fs from "node:fs";
import assert from "node:assert";
import test from "node:test";
import { fileURLToPath } from "node:url";
import path from "node:path";

const dir = path.dirname(fileURLToPath(import.meta.url));
const html = fs.readFileSync(path.join(dir, "..", "app.html"), "utf8");
const L = html.split("\n");
const s = L.findIndex((l) => l.includes("var SUPPORT_MIN = 0.7;"));
const e = L.findIndex((l, i) => i > s && l.includes("function emsPackOnce"));
const src = 'var num=(v,d=0)=>Number.isFinite(+v)&&v!==""?+v:d;\n' + L.slice(s, e).join("\n") +
  "\nreturn { manualCandidate, settlePlaced, boxesOverlap, SUPPORT_MIN };";
const { manualCandidate, settlePlaced, boxesOverlap, SUPPORT_MIN } = new Function(src)();

const Ct = { l: 590, w: 235, h: 239, payload: 28200 };
const PAL = { l: 120, w: 80, h: 110, weight: 300, stackable: true, rotatable: true };

// Auflage einer Kiste durch die Kisten direkt darunter – identisch zur Regel im Packer.
function support(b, all) {
  if (b.y <= 1e-4) return 1;
  let sup = 0;
  for (const o of all) {
    if (o === b) continue;
    if (Math.abs(o.y + o.dy - b.y) > 1e-3) continue;
    const ox = Math.min(b.x + b.dx, o.x + o.dx) - Math.max(b.x, o.x);
    const oz = Math.min(b.z + b.dz, o.z + o.dz) - Math.max(b.z, o.z);
    if (ox <= 0 || oz <= 0) continue;
    sup += ox * oz;
  }
  return sup / (b.dx * b.dz);
}
const assertGrounded = (placed, label) => placed.forEach((b, i) =>
  assert.ok(support(b, placed) >= SUPPORT_MIN - 1e-6,
    `${label}: Kiste ${i} schwebt bei y=${b.y} (Auflage ${(support(b, placed) * 100) | 0} %)`));
const assertNoOverlap = (placed, label) => {
  for (let i = 0; i < placed.length; i++)
    for (let j = i + 1; j < placed.length; j++)
      assert.ok(!boxesOverlap(placed[i], placed[j]), `${label}: Kiste ${i} und ${j} überlappen`);
};

// Baut einen Zweierstapel: eine Kiste auf dem Boden, eine exakt darauf.
function stackOfTwo() {
  const cargo = [PAL, PAL];
  const placed = [];
  let w = 0;
  for (const ti of [0, 1]) {
    const r = manualCandidate(Ct, cargo[ti], false, 0, 0, placed, w);
    assert.ok(r.ok);
    placed.push({ ...r.box, ti, rot: false });
    w += PAL.weight;
  }
  assert.strictEqual(placed[0].y, 0);
  assert.strictEqual(placed[1].y, 110, "zweite Kiste liegt auf der ersten");
  return { cargo, placed };
}

test("Löschen der unteren Kiste lässt die obere nachrutschen", () => {
  const { cargo, placed } = stackOfTwo();
  const afterRaw = placed.filter((_, i) => i !== 0);
  assert.strictEqual(afterRaw[0].y, 110, "Vorbedingung: ohne Settle bliebe die Kiste in der Luft");

  const after = settlePlaced(Ct, afterRaw, cargo);
  assert.strictEqual(after[0].y, 0, "obere Kiste muss auf den Boden fallen");
  assertGrounded(after, "nach Löschen");
  assertNoOverlap(after, "nach Löschen");
});

test("Ganzer Stapel rutscht geschlossen nach", () => {
  // Flache Kisten, damit vier Lagen in die 239 cm des 20' GP passen (4 x 50 = 200 cm).
  const FLAT = { l: 120, w: 80, h: 50, weight: 200, stackable: true, rotatable: true };
  const cargo = [FLAT, FLAT, FLAT, FLAT];
  const placed = [];
  let w = 0;
  for (let ti = 0; ti < 4; ti++) {
    const r = manualCandidate(Ct, FLAT, false, 0, 0, placed, w);
    assert.ok(r.ok, `Kiste ${ti} sollte stapelbar sein`);
    placed.push({ ...r.box, ti, rot: false });
    w += FLAT.weight;
  }
  assert.deepStrictEqual(placed.map((b) => b.y), [0, 50, 100, 150]);

  const after = settlePlaced(Ct, placed.filter((_, i) => i !== 1), cargo);
  assert.deepStrictEqual(after.map((b) => b.y), [0, 50, 100], "alle drei rutschen eine Ebene tiefer");
  assertGrounded(after, "Stapel");
  assertNoOverlap(after, "Stapel");
});

test("Reihenfolge der Kisten bleibt erhalten (Auswahl zeigt auf dieselbe Kiste)", () => {
  const { cargo, placed } = stackOfTwo();
  const tagged = placed.map((b, i) => ({ ...b, mark: i }));
  const after = settlePlaced(Ct, tagged, cargo);
  assert.deepStrictEqual(after.map((b) => b.mark), [0, 1], "Indizes dürfen nicht umsortiert werden");
  assert.deepStrictEqual(after.map((b) => b.ti), [0, 1]);
});

test("Nicht stapelbare Kisten bleiben auf dem Boden", () => {
  const cargo = [{ ...PAL, stackable: false }, { ...PAL, stackable: false }];
  const placed = [
    { x: 0, y: 0, z: 0, dx: 120, dy: 110, dz: 80, ti: 0, rot: false },
    { x: 200, y: 0, z: 0, dx: 120, dy: 110, dz: 80, ti: 1, rot: false },
  ];
  const after = settlePlaced(Ct, placed, cargo);
  assert.deepStrictEqual(after.map((b) => b.y), [0, 0]);
  assertNoOverlap(after, "unstapelbar");
});

test("Settle ist stabil: bereits gesetzte Ladung bleibt unverändert", () => {
  const { cargo, placed } = stackOfTwo();
  const once = settlePlaced(Ct, placed, cargo);
  const twice = settlePlaced(Ct, once, cargo);
  assert.deepStrictEqual(twice.map((b) => b.y), once.map((b) => b.y));
  assert.deepStrictEqual(once.map((b) => b.y), [0, 110], "gültige Ladung darf sich nicht verändern");
});

test("Zufallsladungen: nach beliebigem Löschen schwebt nichts und nichts überlappt", () => {
  let seed = 99;
  const rnd = () => ((seed = (seed * 1103515245 + 12345) & 2147483647) / 2147483647);
  const ri = (a, b) => a + Math.floor(rnd() * (b - a + 1));
  for (let run = 0; run < 40; run++) {
    const cargo = [];
    const placed = [];
    let w = 0;
    for (let k = 0; k < 14; k++) {
      const item = { l: ri(40, 240), w: ri(40, 200), h: ri(30, 120), weight: ri(10, 300), stackable: rnd() < 0.8, rotatable: true };
      const res = manualCandidate(Ct, item, rnd() < 0.5, ri(0, 400), ri(0, 150), placed, w);
      if (!res.ok) continue;
      cargo.push(item);
      placed.push({ ...res.box, ti: cargo.length - 1, rot: false });
      w += item.weight;
    }
    if (placed.length < 3) continue;
    const drop = ri(0, placed.length - 1);
    const after = settlePlaced(Ct, placed.filter((_, i) => i !== drop), cargo);
    assertGrounded(after, `Zufallslauf ${run} (Kiste ${drop} gelöscht)`);
    assertNoOverlap(after, `Zufallslauf ${run}`);
  }
});
