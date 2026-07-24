// Regressionstest für den Packer-Reihenfolge-Bug (nicht-stapelbar/stapelbar bei gleichen Maßen).
// Extrahiert packCargo aus app.html und prüft, dass die Pack-Menge NICHT von der
// Auflistungsreihenfolge zweier maßgleicher Typen abhängt. node test/pack-order.test.mjs
import fs from "node:fs";
import assert from "node:assert";
import { fileURLToPath } from "node:url";
import path from "node:path";

const dir = path.dirname(fileURLToPath(import.meta.url));
const html = fs.readFileSync(path.join(dir, "..", "app.html"), "utf8");
const lines = html.split("\n");
const s = lines.findIndex((l) => l.includes("function makeFloorPacker"));
const e = lines.findIndex((l, i) => i > s && l.trim() === "}" && lines[i - 1].includes("return { placed, perType"));
const block = lines.slice(s, e + 1).join("\n");
const { packCargo } = new Function("var num=(v,d=0)=>Number.isFinite(+v)&&v!==\"\"?+v:d;\n" + block + "\nreturn { packCargo };")();

const S = { l: 120, w: 80, h: 110, weight: 300, qty: 11, stackable: true, rotatable: true };
const N = { ...S, stackable: false };
const CTs = [
  { n: "20' GP", l: 590, w: 235, h: 239, payload: 28200 },
  { n: "40' GP", l: 1203, w: 235, h: 239, payload: 26600 },
  { n: "40' HC", l: 1203, w: 235, h: 270, payload: 26580 },
  { n: "45' HC", l: 1355, w: 235, h: 270, payload: 27600 },
];

for (const Ct of CTs) {
  const a = packCargo(Ct, [N, S], {}).boxes; // nicht, dann stapelbar
  const b = packCargo(Ct, [S, N], {}).boxes; // stapelbar, dann nicht
  assert.strictEqual(a, b, `${Ct.n}: Ergebnis reihenfolge-abhängig (${a} vs ${b})`);
  assert.strictEqual(a, 22, `${Ct.n}: erwartet 22 geladen (11 nicht-stapelbar auf Boden, 11 stapelbar darüber), war ${a}`);
}

console.log("pack-order: alle Tests grün (reihenfolge-unabhängig, 22/22 in allen Containertypen)");
