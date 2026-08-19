// Messstand für den Füllgrad des gemischten Packers (emsSearch).
//
// WOFÜR: Wer an `emsSearch` oder `emsPackOnce` etwas ändert, ändert damit das Kernversprechen
// des Tools — wie viel hineinpasst. Ein Unit-Test fängt das nicht: dort steht nur, dass eine
// bestimmte Ladung aufgeht. Ob eine Änderung im Schnitt Kisten kostet, sieht man erst über
// viele Ladungen.
//
// BENUTZUNG:
//   node test/bench/fuellgrad.mjs app.html          # vor der Änderung
//   …ändern…
//   node test/bench/fuellgrad.mjs app.html          # danach
//
// Die Szenarien sind zufällig, aber über einen festen Startwert DETERMINISTISCH — zwei Läufe
// derselben Datei liefern dieselben Zahlen. Verglichen wird:
//   verladen  Zahl der untergebrachten Packstücke  -> darf NICHT sinken
//   volumen   belegtes Volumen in m³               -> darf NICHT sinken
//   mitEtagen Ladungen mit mehr als einer Etage    -> Anschaulichkeit, kein Qualitätsmaß
//   ySumme    Summe aller Aufsetzhöhen             -> dito
//
// Läuft rund 30 s und ist deshalb bewusst NICHT in test/ — dort greift die CI mit
// `node --test test/*.mjs`, und ein Messstand gehört nicht in jeden Pull Request.
//
// Referenz (Stand: Einbau des Gleichstand-Entscheids in emsSearch):
//   vorher   {"szenarien":300,"verladen":15189,"volumen":5547.979,"mitEtagen":187,"ySumme":445170}
//   nachher  {"szenarien":300,"verladen":15189,"volumen":5547.979,"mitEtagen":295,"ySumme":1107100}
// Also: identischer Füllgrad, deutlich mehr gestapelte Bilder.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dir = path.dirname(fileURLToPath(import.meta.url));
const file = process.argv[2] || path.join(dir, "..", "..", "app.html");
const L = fs.readFileSync(file, "utf8").split("\n");
const ps = L.findIndex((l) => l.includes("function makeFloorPacker"));
const pe = L.findIndex((l, i) => i > ps && l.trim() === "}" && L[i - 1].includes("return { placed, perType"));
const { packCargo } = new Function(
  'var num=(v,d=0)=>Number.isFinite(+v)&&v!==""?+v:d;\n' + L.slice(ps, pe + 1).join("\n") + "\nreturn { packCargo };"
)();

let seed = 20260819;
const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
const pick = (a) => a[Math.floor(rnd() * a.length)];
const CONT = [
  { l: 590, w: 235, h: 239, payload: 28200 }, { l: 590, w: 235, h: 270, payload: 28150 },
  { l: 1203, w: 235, h: 239, payload: 26600 }, { l: 1203, w: 235, h: 270, payload: 26580 },
  { l: 1362, w: 248, h: 270, payload: 24000 }
];

let boxes = 0, vol = 0, yTot = 0, n = 0, stacked = 0;
const t0 = Date.now();
for (let i = 0; i < 300; i++) {
  const C = pick(CONT);
  const types = [];
  // Mindestens zwei Typen: nur dann läuft der gemischte Pfad, um den es hier geht.
  for (let k = 0, nT = 2 + Math.floor(rnd() * 4); k < nT; k++) types.push({
    l: 30 + Math.floor(rnd() * 11) * 10, w: 30 + Math.floor(rnd() * 8) * 10, h: 20 + Math.floor(rnd() * 13) * 10,
    weight: Math.floor(rnd() * 400), qty: 1 + Math.floor(rnd() * 30),
    stackable: rnd() > 0.2, rotatable: rnd() > 0.25
  });
  const r = packCargo(C, types);
  boxes += r.boxes;
  vol += r.usedVol;
  n++;
  if (new Set(r.placed.map((p) => Math.round(p.y))).size > 1) stacked++;
  yTot += r.placed.reduce((s, p) => s + p.y, 0);
}
console.log(JSON.stringify({
  szenarien: n, verladen: boxes, volumen: +vol.toFixed(3),
  mitEtagen: stacked, ySumme: Math.round(yTot), sek: +((Date.now() - t0) / 1000).toFixed(1)
}));
