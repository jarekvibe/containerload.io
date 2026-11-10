// Messstand für die Mengen-Grenze (MENGE_MAX / MENGE_GESAMT_MAX in app.html).
//
// WOFÜR: Die Grenze ist eine Zeitgrenze. Sie steht dort, wo der Start mit einem geteilten
// Link noch in vertretbarer Zeit fertig wird — und das hängt am Packer. Wer `emsSearch`,
// `chainContainers` oder `suggestContainer` schneller (oder langsamer) macht, verschiebt
// damit die Stelle, an der die Grenze sinnvoll steht. Dieser Lauf zeigt, wo sie heute liegt.
//
// Gerechnet wird, was der Rechner nach jedem Laden im Hauptthread rechnet (siehe den
// Rebuild-Effekt in app.html): der erste Container (packKind), die Kette, wenn etwas
// übrig bleibt (chainContainers), und die freie Empfehlung (suggestContainer). Nicht
// dabei: das Zeichnen in Three.js und React — im Browserprofil (10.000 Kartons) waren das
// zusammen rund 0,5 von 13 s.
//
// BENUTZUNG:
//   node test/bench/mengen-zeit.mjs app.html
//
// Läuft gut eine Minute (bewusst bis über die Grenze, damit man sieht, wovor sie schützt)
// und ist deshalb bewusst NICHT in test/ (die CI greift mit
// `node --test test/*.mjs`).
//
// Referenz (Nov. 2026, Einbau der Grenze; dieselbe Maschine wie die Browsermessung im
// Kommentar bei MENGE_MAX — dort zusätzlich ~2,2 s für Seite, React und 3D):
//   1 Sorte 40x30x30    1.000 -> 0,1 s   2.000 -> 1,5 s   5.000 -> 5,0 s   10.000 -> 10,2 s
//   3 Sorten gemischt   1.000 -> 4,3 s   3.000 -> 14,2 s  5.000 -> 35,2 s
// Davon jeweils gut die Hälfte in der Empfehlung, der Rest in der Kette.
// Die gemischten Zeiten sind der Grund, warum die Grenze nicht höher steht — und
// zugleich der Hinweis, dass sie für Mischladungen allein nicht reicht (siehe CLAUDE.md).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dir = path.dirname(fileURLToPath(import.meta.url));
const file = process.argv[2] || path.join(dir, "..", "..", "app.html");
const L = fs.readFileSync(file, "utf8").split("\n");
const cut = (von, bis) => {
  const s = L.findIndex((l) => l.includes(von));
  const e = L.findIndex((l, i) => i > s && bis(l, i));
  if (s < 0 || e < 0) throw new Error("Ausschnitt nicht gefunden: " + von);
  return L.slice(s, e + 1).join("\n");
};
const M = new Function(
  `var num=(v,d=0)=>Number.isFinite(+v)&&v!==""?+v:d; var applyCarrier=(p)=>p;
   ${cut("var PRESETS = {", (l) => l.includes("var panelsFor"))}
   var panelsFor = (k) => (EQUIP[k] || EQUIP.dry).panels;
   ${cut("function makeFloorPacker", (l, i) => l.trim() === "}" && L[i - 1].includes("return { chain, remainingBoxes"))}
   ${cut("// MENGEN-GRENZE-BEGIN", (l) => l.includes("// MENGEN-GRENZE-END"))}
   return { chainContainers, packKind, suggestContainer, PRESETS, MAXCHAIN, MENGE_MAX, MENGE_GESAMT_MAX };`
)();

const C = { ...M.PRESETS["40' HC"] };
const pos = (l, w, h, qty) => ({ name: `${l}x${w}x${h}`, l, w, h, weight: 0, qty, stackable: true, stackMax: Infinity, rotatable: true });
const SZENARIEN = [
  ["1 Sorte", (n) => [pos(40, 30, 30, n)]],
  ["3 Sorten", (n) => [pos(40, 30, 30, Math.ceil(n / 3)), pos(60, 40, 40, Math.ceil(n / 3)), pos(50, 50, 50, n - 2 * Math.ceil(n / 3))]]
];
const MENGEN = { "1 Sorte": [1000, 2000, 5000, 10000], "3 Sorten": [1000, 3000, 5000] };

console.log(`Grenze: ${M.MENGE_MAX} je Position, ${M.MENGE_GESAMT_MAX} je Plan · MAXCHAIN ${M.MAXCHAIN} · 40' HC`);
for (const [name, bau] of SZENARIEN) {
  for (const n of MENGEN[name]) {
    const cargo = bau(n);
    const t0 = performance.now();
    const r = M.packKind(C, cargo, {}, false);
    const t1 = performance.now();
    let kette = 1;
    if (r.boxes < r.totalBoxes && r.boxes > 0) kette = M.chainContainers(C, "40' HC", cargo, r, {}, M.MAXCHAIN, "").chain.length;
    const t2 = performance.now();
    M.suggestContainer(cargo, "");
    const t3 = performance.now();
    const s = (a, b) => ((b - a) / 1000).toFixed(1).padStart(5);
    console.log(`${name.padEnd(9)} ${String(n).padStart(6)} Stück  ${String(kette).padStart(2)} Container   ` +
      `erster ${s(t0, t1)} s · Kette ${s(t1, t2)} s · Empfehlung ${s(t2, t3)} s · zusammen ${s(t0, t3)} s` +
      (n > M.MENGE_GESAMT_MAX ? "   (über der Grenze)" : ""));
  }
}
