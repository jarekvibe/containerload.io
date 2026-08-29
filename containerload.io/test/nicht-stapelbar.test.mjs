// "Nicht stapelbar" heisst beides: ich stehe auf nichts UND auf mir steht nichts.
//
// Gemeldet mit diesem Link:
//   /share?c=d~250x80x30w300q9snPackage~120x80x110w300q22y3nPackage
// 9 Packstuecke 250x80x30, 300 kg, "nicht stapelbar" -- und 22 Paletten 120x80x110,
// dreifach stapelbar. Im Ergebnis trugen sechs der acht verladenen "nicht stapelbar"-
// Stuecke je zwei bis drei Paletten. Die Nichtstapelbarkeit wurde also nur zur Haelfte
// beachtet: der Packer stellte sie brav auf den Boden, belud sie aber danach.
//
// Der Grund war eine ausdrueckliche Festlegung im Packer ("nicht stapelbar" = ich darf auf
// nichts stehen, aber tragen darf ich). Sie widerspricht dem eigenen Auswahlfeld: dort
// stehen "nicht stapelbar / 1x / 2x / 3x stapelbar / bis Hoehe / frei stapelbar", und jede
// andere Stufe begrenzt genau eine Sache -- was OBEN drauf darf. Sie widerspricht auch dem
// Aufkleber am Packstueck ("Stapelverbot") und dem eigenen Ladevorschlag ("Nicht stapelbare
// Positionen zuletzt bzw. oben verladen").
//
// Das kostet Kapazitaet, und zwar sichtbar: in einem 20' GP fallen 11 + 11 gleich grosse
// Paletten von 22 auf 16 (siehe Rechnung in test/pack-order.test.mjs). Das ist der Preis
// dafuer, dass die Angabe stimmt.
//
// node --test test/nicht-stapelbar.test.mjs
import fs from "node:fs";
import assert from "node:assert";
import test from "node:test";
import { fileURLToPath } from "node:url";
import path from "node:path";

const dir = path.dirname(fileURLToPath(import.meta.url));
const L = fs.readFileSync(path.join(dir, "..", "app.html"), "utf8").split("\n");

const ps = L.findIndex((l) => l.includes("function makeFloorPacker"));
const pe = L.findIndex((l, i) => i > ps && l.trim() === "}" && L[i - 1].includes("return { placed, perType"));
const { packCargo } = new Function(
  'var num=(v,d=0)=>Number.isFinite(+v)&&v!==""?+v:d;\n' + L.slice(ps, pe + 1).join("\n") + "\nreturn { packCargo };"
)();

// manualCandidate liegt vor emsPackOnce -- gleiche Slice-Mechanik wie test/stackmax-manuell.
const ms = L.findIndex((l) => l.includes("var SUPPORT_MIN = 0.7;"));
const me = L.findIndex((l, i) => i > ms && l.includes("function emsPackOnce"));
const { manualCandidate } = new Function(
  'var num=(v,d=0)=>Number.isFinite(+v)&&v!==""?+v:d;\n' + L.slice(ms, me).join("\n") + "\nreturn { manualCandidate };"
)();

const HC40 = { n: "40' HC", l: 1203, w: 235, h: 269, payload: 26580 };
const GP20 = { n: "20' GP", l: 590, w: 235, h: 239, payload: 28200 };

// Alles, was unmittelbar auf u steht: Unterkante = Oberkante von u, Grundflaechen ueberlappen.
const drauf = (u, alle) => alle.filter((o) =>
  o !== u && Math.abs(o.y - (u.y + u.dy)) <= 1e-3 &&
  Math.min(u.x + u.dx, o.x + o.dx) - Math.max(u.x, o.x) > 1e-6 &&
  Math.min(u.z + u.dz, o.z + o.dz) - Math.max(u.z, o.z) > 1e-6);

// Beide Haelften der Regel in einem Durchgang.
const pruefe = (r, types, wo) => {
  let belastet = 0, erhoeht = 0;
  for (const b of r.placed) {
    if (types[b.ti].stackable !== false) continue;
    if (b.y > 1e-4) erhoeht++;
    if (drauf(b, r.placed).length) belastet++;
  }
  assert.strictEqual(erhoeht, 0, `${wo}: ${erhoeht} nicht stapelbare Stuecke stehen erhoeht`);
  assert.strictEqual(belastet, 0, `${wo}: auf ${belastet} nicht stapelbaren Stuecken steht Ladung`);
};

// ── 1. Der gemeldete Fall, Zahl fuer Zahl aus dem Link ──────────────────────────────
const GEMELDET = [
  { n: "Package", l: 250, w: 80, h: 30, qty: 9, weight: 300, stackable: false },
  { n: "Package", l: 120, w: 80, h: 110, qty: 22, weight: 300, stackMax: 3 },
];

test("der gemeldete Link: auf keinem 'nicht stapelbar' steht mehr etwas", () => {
  pruefe(packCargo(HC40, GEMELDET, {}), GEMELDET, "gemeldeter Link");
});

// Gegenprobe. Ohne sie wuerde der Test auch dann gruen bleiben, wenn der Packer aus einem
// ganz anderen Grund gar nicht mehr stapelt -- und faende den Fehler nie wieder.
test("Gegenprobe: dieselbe Ladung als stapelbar wird sehr wohl belastet", () => {
  const frei = GEMELDET.map((t) => ({ ...t, stackable: true }));
  const r = packCargo(HC40, frei, {});
  const belastet = r.placed.filter((b) => b.ti === 0 && drauf(b, r.placed).length).length;
  assert.ok(belastet > 0,
    "der Packer stapelt hier ueberhaupt nicht mehr -- dann prueft der Test oben nichts");
});

// ── 2. Zufallsladungen: die Regel darf an keiner Stelle durchrutschen ───────────────
test("ueber 200 gemischte Zufallsladungen bleibt kein 'nicht stapelbar' belastet", () => {
  let seed = 7;
  const rnd = () => ((seed = (seed * 1103515245 + 12345) & 2147483647) / 2147483647);
  const ri = (a, b) => a + Math.floor(rnd() * (b - a + 1));
  let mitNicht = 0, gestapelt = 0;
  for (let i = 0; i < 200; i++) {
    const Ct = rnd() < 0.5 ? HC40 : GP20;
    const types = [];
    for (let t = 0; t < ri(2, 4); t++) {
      const nicht = rnd() < 0.45;
      types.push({
        l: ri(40, 240), w: ri(30, 120), h: ri(20, 140), weight: ri(20, 400),
        qty: ri(2, 14), rotatable: rnd() < 0.85,
        stackable: !nicht, ...(nicht || rnd() < 0.5 ? {} : { stackMax: ri(2, 4) })
      });
    }
    if (!types.some((t) => t.stackable === false)) continue;
    mitNicht++;
    const r = packCargo(Ct, types, {});
    if (r.placed.some((b) => b.y > 1e-4)) gestapelt++;
    pruefe(r, types, `Zufallsladung ${i}`);
  }
  assert.ok(mitNicht > 100, `zu wenige Ladungen mit nicht stapelbarer Ware (${mitNicht})`);
  assert.ok(gestapelt > 40,
    `nur ${gestapelt} der ${mitNicht} Ladungen wurden ueberhaupt gestapelt -- die Pruefung liefe ins Leere`);
});

// ── 3. Von Hand muss dasselbe gelten ────────────────────────────────────────────────
const KISTE = { name: "Kiste", l: 120, w: 80, h: 60, weight: 100, qty: 20, stackable: true, rotatable: true };
const NICHT = { name: "Nicht stapelbar", l: 120, w: 80, h: 60, weight: 100, qty: 20, stackable: false, rotatable: true };

test("Von Hand: nichts laesst sich auf ein nicht stapelbares Stueck ziehen", () => {
  const cargo = [NICHT, KISTE];
  const unten = [{ x: 0, y: 0, z: 0, dx: 120, dy: 60, dz: 80, ti: 0 }];
  const c = manualCandidate(HC40, KISTE, false, 0, 0, unten, 0, cargo);
  assert.strictEqual(c.ok, false, "die Kiste durfte auf das nicht stapelbare Stueck");
  assert.strictEqual(c.reason, "stackmax", `Ablehnungsgrund sollte die Stapelgrenze sein, war "${c.reason}"`);
});

test("Von Hand: dieselbe Stelle mit stapelbarem Unterbau bleibt erlaubt", () => {
  const cargo = [KISTE, KISTE];
  const unten = [{ x: 0, y: 0, z: 0, dx: 120, dy: 60, dz: 80, ti: 0 }];
  const c = manualCandidate(HC40, KISTE, false, 0, 0, unten, 0, cargo);
  assert.strictEqual(c.ok, true, `abgelehnt mit Grund "${c.reason}" -- hier ist Stapeln erlaubt`);
  assert.ok(Math.abs(c.box.y - 60) < 1e-3, `sollte auf y=60 landen, war y=${c.box && c.box.y}`);
});

// Die Tragfaehigkeit UNTER mir zaehlt, nicht meine eigene. Vorher stand hier die eigene
// Grenze des gezogenen Stueckes gegen die Turmhoehe; bei gemischter Ladung ist das die
// falsche Zahl, und der Auto-Packer rechnete laengst anders.
test("Von Hand: es zaehlt die Tragfaehigkeit der Stuecke darunter", () => {
  const zwei = { ...KISTE, stackMax: 2 };
  const frei = { ...KISTE, stackMax: void 0 };
  const cargo = [zwei, frei];
  // zwei (stackMax 2) am Boden, darauf eine freie Kiste -> die dritte Lage sprengt die 2.
  const unten = [
    { x: 0, y: 0, z: 0, dx: 120, dy: 60, dz: 80, ti: 0 },
    { x: 0, y: 60, z: 0, dx: 120, dy: 60, dz: 80, ti: 1 },
  ];
  const c = manualCandidate(HC40, frei, false, 0, 0, unten, 0, cargo);
  assert.strictEqual(c.ok, false,
    "die dritte Lage stand auf einem Stueck, das nur eine weitere Lage traegt");
  assert.strictEqual(c.reason, "stackmax", `Grund sollte die Stapelgrenze sein, war "${c.reason}"`);
});
