// Regressionstest für die Abstütz-Regel im Packer: keine schwebenden Kisten / großen Überhänge.
// Extrahiert packCargo aus app.html und prüft, dass JEDE gestapelte Kiste (y>0) zu >= 70 % ihrer
// Grundfläche von den Kisten direkt darunter getragen wird. node test/pack-support.test.mjs
import fs from "node:fs";
import assert from "node:assert";
import { fileURLToPath } from "node:url";
import path from "node:path";

const dir = path.dirname(fileURLToPath(import.meta.url));
const html = fs.readFileSync(path.join(dir, "..", "app.html"), "utf8");
const L = html.split("\n");
const s = L.findIndex((l) => l.includes("function makeFloorPacker"));
const e = L.findIndex((l, i) => i > s && l.trim() === "}" && L[i - 1].includes("return { placed, perType"));
const { packCargo } = new Function('var num=(v,d=0)=>Number.isFinite(+v)&&v!==""?+v:d;\n' + L.slice(s, e + 1).join("\n") + "\nreturn { packCargo };")();

const MIN = 0.7;
const support = (b, all) => {
  if (b.y <= 1e-4) return 1;
  const base = b.dx * b.dz;
  let sup = 0;
  for (const o of all) {
    if (o === b) continue;
    if (Math.abs(o.y + o.dy - b.y) > 1e-3) continue;
    const ox = Math.min(b.x + b.dx, o.x + o.dx) - Math.max(b.x, o.x);
    if (ox <= 0) continue;
    const oz = Math.min(b.z + b.dz, o.z + o.dz) - Math.max(b.z, o.z);
    if (oz <= 0) continue;
    sup += ox * oz;
  }
  return sup / base;
};

// 1) Der konkret gemeldete Fall (Panels + Paletten im 20' HC): nichts schwebt.
const HC = { n: "20' HC", l: 590, w: 235, h: 270, payload: 28150 };
const mixed = [
  { name: "Panel", l: 400, w: 230, h: 50, weight: 200, qty: 4, stackable: true, rotatable: true },
  { name: "Pal", l: 120, w: 80, h: 110, weight: 300, qty: 6, stackable: true, rotatable: true },
];
const r0 = packCargo(HC, mixed, { intensive: true });
r0.placed.forEach((b) => assert.ok(support(b, r0.placed) >= MIN - 1e-6, `Panel/Paletten: schwebende Kiste bei y=${b.y} (Auflage ${(support(b, r0.placed) * 100) | 0}%)`));

// 2) Breite Zufallsstreuung: keine gestapelte Kiste unter 70 % Auflage.
const CTs = [
  { l: 590, w: 235, h: 239, payload: 28200 },
  { l: 1203, w: 235, h: 270, payload: 26580 },
  { l: 590, w: 235, h: 270, payload: 28150 },
];
let seed = 7;
const rnd = () => ((seed = (seed * 1103515245 + 12345) & 2147483647) / 2147483647);
const ri = (a, b) => a + Math.floor(rnd() * (b - a + 1));
let stacked = 0;
for (let i = 0; i < 80; i++) {
  const Ct = CTs[ri(0, 2)];
  const nT = ri(1, 3);
  const types = [];
  for (let t = 0; t < nT; t++) types.push({ name: "T" + t, l: ri(40, 300), w: ri(40, 200), h: ri(30, 160), weight: ri(50, 400), qty: ri(3, 14), stackable: rnd() < 0.8, rotatable: rnd() < 0.8 });
  const r = packCargo(Ct, types, {});
  r.placed.forEach((b) => {
    if (b.y > 1e-4) {
      stacked++;
      assert.ok(support(b, r.placed) >= MIN - 1e-6, `Zufallsfall ${i}: schwebende Kiste bei y=${b.y} (Auflage ${(support(b, r.placed) * 100) | 0}%)`);
    }
  });
}

console.log(`pack-support: alle Tests grün (Panels+Paletten + 80 Zufallsladungen, ${stacked} gestapelte Kisten, keine < 70 % Auflage)`);
