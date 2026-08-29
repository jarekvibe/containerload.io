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
// Die Erwartungswerte sind seit der Klarstellung von "nicht stapelbar" (nichts steht auf mir,
// siehe test/nicht-stapelbar.test.mjs) keine 22 mehr in jedem Container. Sie sind trotzdem
// nachgerechnet und nicht abgelesen -- in Klammern die Rechnung:
//
//   Stellplaetze 120x80 auf dem Boden  x  moegliche Etagen
//   20' GP  590x235x239: 11 Stellplaetze, 2 Etagen (239/110). Die 11 stapelbaren brauchen
//           ceil(11/2) = 6 Plaetze, fuer die nicht stapelbaren bleiben 5 -> 16. Mehr geht
//           nicht: n + min(11, 2*(11-n)) hat bei n = 5 und n = 6 sein Maximum, beide 16.
//   40'/45': genug Boden fuer 11 + 11 nebeneinander -> weiterhin 22.
const CTs = [
  { n: "20' GP", l: 590, w: 235, h: 239, payload: 28200, erwartet: 16 },
  { n: "40' GP", l: 1203, w: 235, h: 239, payload: 26600, erwartet: 22 },
  { n: "40' HC", l: 1203, w: 235, h: 270, payload: 26580, erwartet: 22 },
  { n: "45' HC", l: 1355, w: 235, h: 270, payload: 27600, erwartet: 22 },
];

for (const Ct of CTs) {
  const a = packCargo(Ct, [N, S], {}).boxes; // nicht, dann stapelbar
  const b = packCargo(Ct, [S, N], {}).boxes; // stapelbar, dann nicht
  assert.strictEqual(a, b, `${Ct.n}: Ergebnis reihenfolge-abhängig (${a} vs ${b})`);
  assert.strictEqual(a, Ct.erwartet, `${Ct.n}: erwartet ${Ct.erwartet} geladen, war ${a}`);
}

// Vollständige Reihenfolge-Unabhängigkeit: gleiche Ladung, umgekehrte Typreihenfolge -> gleiches Ergebnis.
let seed = 99;
const rnd = () => ((seed = (seed * 1103515245 + 12345) & 2147483647) / 2147483647);
const ri = (a, b) => a + Math.floor(rnd() * (b - a + 1));
let checked = 0;
for (let i = 0; i < 60; i++) {
  const Ct = CTs[ri(0, 3)];
  const nT = ri(1, 4);
  const types = [];
  for (let t = 0; t < nT; t++) types.push({ l: ri(40, 140), w: ri(30, 120), h: ri(40, 160), weight: ri(50, 500), qty: ri(2, 12), stackable: rnd() < 0.5, rotatable: rnd() < 0.8 });
  const fwd = packCargo(Ct, types, {}).boxes;
  const rev = packCargo(Ct, [...types].reverse(), {}).boxes;
  assert.strictEqual(fwd, rev, `${Ct.n}: reihenfolge-abhängig (${fwd} vs ${rev}) für ${JSON.stringify(types)}`);
  checked++;
}

console.log(`pack-order: alle Tests grün (nachgerechnete Mengen je Containertyp; ${checked} Zufallsladungen reihenfolge-unabhängig)`);
