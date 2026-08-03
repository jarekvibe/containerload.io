// Regressionstest gegen ineinander ragende Packstücke ("Glitching"): keine zwei Kisten dürfen
// sich im Raum durchdringen, und keine Kiste darf aus dem Container herausragen – weder beim
// Auto-Packer (packCargo) noch beim manuellen Platzieren (manualCandidate).
// node --test test/pack-overlap.test.mjs
import fs from "node:fs";
import assert from "node:assert";
import test from "node:test";
import { fileURLToPath } from "node:url";
import path from "node:path";

const dir = path.dirname(fileURLToPath(import.meta.url));
const html = fs.readFileSync(path.join(dir, "..", "app.html"), "utf8");
const L = html.split("\n");

const ps = L.findIndex((l) => l.includes("function makeFloorPacker"));
const pe = L.findIndex((l, i) => i > ps && l.trim() === "}" && L[i - 1].includes("return { placed, perType"));
const { packCargo } = new Function('var num=(v,d=0)=>Number.isFinite(+v)&&v!==""?+v:d;\n' + L.slice(ps, pe + 1).join("\n") + "\nreturn { packCargo };")();

const ms = L.findIndex((l) => l.includes("var SUPPORT_MIN = 0.7;"));
const me = L.findIndex((l, i) => i > ms && l.includes("function emsPackOnce"));
const { manualCandidate } = new Function('var num=(v,d=0)=>Number.isFinite(+v)&&v!==""?+v:d;\n' + L.slice(ms, me).join("\n") + "\nreturn { manualCandidate };")();

// Zwei Kisten durchdringen sich, wenn sie sich auf ALLEN drei Achsen echt überschneiden.
// TOL = 0.01 cm: bündiges Anliegen (Overlap 0) ist erlaubt, alles darüber ist ein Glitch.
const TOL = 0.01;
const axis = (a0, a1, b0, b1) => Math.min(a1, b1) - Math.max(a0, b0);
function intersects(a, b) {
  const ox = axis(a.x, a.x + a.dx, b.x, b.x + b.dx);
  const oy = axis(a.y, a.y + a.dy, b.y, b.y + b.dy);
  const oz = axis(a.z, a.z + a.dz, b.z, b.z + b.dz);
  return ox > TOL && oy > TOL && oz > TOL ? Math.min(ox, oy, oz) : 0;
}
function assertNoOverlap(placed, label) {
  for (let i = 0; i < placed.length; i++) {
    for (let j = i + 1; j < placed.length; j++) {
      const d = intersects(placed[i], placed[j]);
      assert.ok(
        d === 0,
        `${label}: Kiste ${i} und ${j} ragen ${d.toFixed(3)} cm ineinander ` +
          `(A x${placed[i].x} y${placed[i].y} z${placed[i].z} ${placed[i].dx}x${placed[i].dy}x${placed[i].dz} | ` +
          `B x${placed[j].x} y${placed[j].y} z${placed[j].z} ${placed[j].dx}x${placed[j].dy}x${placed[j].dz})`
      );
    }
  }
}
function assertInside(Ct, placed, label) {
  for (const b of placed) {
    assert.ok(b.x >= -TOL && b.y >= -TOL && b.z >= -TOL, `${label}: negative Koordinate (${b.x},${b.y},${b.z})`);
    assert.ok(b.x + b.dx <= Ct.l + TOL, `${label}: ragt in der Länge heraus (${b.x + b.dx} > ${Ct.l})`);
    assert.ok(b.z + b.dz <= Ct.w + TOL, `${label}: ragt in der Breite heraus (${b.z + b.dz} > ${Ct.w})`);
    assert.ok(b.y + b.dy <= Ct.h + TOL, `${label}: ragt in der Höhe heraus (${b.y + b.dy} > ${Ct.h})`);
  }
}

const CTs = [
  { n: "20' GP", l: 590, w: 235, h: 239, payload: 28200 },
  { n: "20' HC", l: 590, w: 235, h: 270, payload: 28150 },
  { n: "40' GP", l: 1203, w: 235, h: 239, payload: 26600 },
  { n: "40' HC", l: 1203, w: 235, h: 270, payload: 26580 },
  { n: "45' HC", l: 1355, w: 235, h: 270, payload: 27600 },
];

test("Auto-Packer: Standardladungen durchdringen sich nicht", () => {
  const cases = [
    [{ name: "Europalette", l: 120, w: 80, h: 110, weight: 300, qty: 40, stackable: true, rotatable: true }],
    [{ name: "Würfel", l: 100, w: 100, h: 100, weight: 50, qty: 60, stackable: true, rotatable: true }],
    [{ name: "Panel", l: 400, w: 230, h: 50, weight: 200, qty: 12, stackable: true, rotatable: true },
     { name: "Pal", l: 120, w: 80, h: 110, weight: 300, qty: 10, stackable: true, rotatable: true }],
    [{ name: "Flach", l: 200, w: 200, h: 2, weight: 5, qty: 100, stackable: true, rotatable: true }],
    [{ name: "Hoch", l: 60, w: 60, h: 220, weight: 80, qty: 30, stackable: false, rotatable: true }],
  ];
  for (const Ct of CTs) {
    for (const cargo of cases) {
      const r = packCargo(Ct, cargo, { intensive: true });
      assertNoOverlap(r.placed, `${Ct.n} / ${cargo[0].name}`);
      assertInside(Ct, r.placed, `${Ct.n} / ${cargo[0].name}`);
    }
  }
});

test("Auto-Packer: exakt aufgehende Stapelhöhen (Fließkomma-Grenzfall)", () => {
  // 239/3 und 270/3 gehen nicht glatt auf – hier akkumulieren sich Rundungsfehler am ehesten.
  const cases = [
    { Ct: CTs[0], h: 239 / 3 }, { Ct: CTs[0], h: 239 / 7 },
    { Ct: CTs[1], h: 270 / 3 }, { Ct: CTs[3], h: 270 / 9 },
    { Ct: CTs[2], h: 239 / 2 }, { Ct: CTs[4], h: 270 / 4 },
  ];
  for (const { Ct, h } of cases) {
    const cargo = [{ name: "Exakt", l: 117, w: 78, h, weight: 40, qty: 120, stackable: true, rotatable: true }];
    const r = packCargo(Ct, cargo, { intensive: true });
    assertNoOverlap(r.placed, `${Ct.n} / h=${h}`);
    assertInside(Ct, r.placed, `${Ct.n} / h=${h}`);
  }
});

test("Auto-Packer: sehr viele und stark gemischte Stücke", () => {
  const cargo = [
    { name: "Groß", l: 500, w: 200, h: 200, weight: 900, qty: 2, stackable: true, rotatable: true },
    { name: "Klein", l: 20, w: 20, h: 20, weight: 2, qty: 800, stackable: true, rotatable: true },
    { name: "Mittel", l: 90, w: 70, h: 60, weight: 30, qty: 120, stackable: true, rotatable: true },
    { name: "Unstapelbar", l: 110, w: 90, h: 140, weight: 60, qty: 40, stackable: false, rotatable: false },
  ];
  for (const Ct of CTs) {
    const r = packCargo(Ct, cargo, {});
    assertNoOverlap(r.placed, `${Ct.n} / Mix`);
    assertInside(Ct, r.placed, `${Ct.n} / Mix`);
  }
});

test("Auto-Packer: 200 Zufallsladungen bleiben überlappungsfrei", () => {
  let seed = 20250803;
  const rnd = () => ((seed = (seed * 1103515245 + 12345) & 2147483647) / 2147483647);
  const ri = (a, b) => a + Math.floor(rnd() * (b - a + 1));
  let boxes = 0;
  for (let i = 0; i < 200; i++) {
    const Ct = CTs[ri(0, CTs.length - 1)];
    const types = [];
    for (let t = 0, n = ri(1, 4); t < n; t++) {
      types.push({
        name: "T" + t,
        l: ri(15, 420), w: ri(15, 235), h: ri(10, 260),
        weight: ri(1, 500), qty: ri(2, 40),
        stackable: rnd() < 0.75, rotatable: rnd() < 0.75,
      });
    }
    const r = packCargo(Ct, types, {});
    boxes += r.placed.length;
    assertNoOverlap(r.placed, `Zufallsfall ${i} (${Ct.n})`);
    assertInside(Ct, r.placed, `Zufallsfall ${i} (${Ct.n})`);
  }
  assert.ok(boxes > 500, `zu wenig Kisten geprüft (${boxes})`);
});

test("Manuelles Platzieren: akzeptierte Kandidaten überlappen nie", () => {
  let seed = 4711;
  const rnd = () => ((seed = (seed * 1103515245 + 12345) & 2147483647) / 2147483647);
  const ri = (a, b) => a + Math.floor(rnd() * (b - a + 1));
  for (let run = 0; run < 60; run++) {
    const Ct = CTs[ri(0, CTs.length - 1)];
    const placed = [];
    let weightUsed = 0;
    for (let k = 0; k < 30; k++) {
      const item = {
        l: ri(30, 300), w: ri(30, 220), h: ri(20, 200),
        weight: ri(10, 400), stackable: rnd() < 0.75, rotatable: true,
      };
      const res = manualCandidate(Ct, item, rnd() < 0.5, ri(0, Ct.l), ri(0, Ct.w), placed, weightUsed);
      if (!res.ok) continue;
      placed.push(res.box);
      weightUsed += item.weight;
      assertNoOverlap(placed, `manuell Lauf ${run}`);
      assertInside(Ct, placed, `manuell Lauf ${run}`);
    }
  }
});
