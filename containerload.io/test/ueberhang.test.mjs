// Kein Ueberstand: ein laengeres Packstueck darf nicht auf einem kuerzeren enden.
//
// Gemeldet mit Bild: der Packer stellte laengere Packstuecke auf kuerzere, sodass sie an einer
// Kante in der Luft endeten. Die alte Regel war eine reine FLAECHENREGEL -- 70 % der Grundflaeche
// mussten getragen sein. Ein Flaechenanteil sagt aber nur, WIE VIEL getragen wird, nicht WO das
// Fehlende liegt: 30 % Luft mitten unter der Kiste (zwei Paletten mit Luecke) ist eine Bruecke
// und in Ordnung, dieselben 30 % an EINER KANTE sind ein Ueberhang, der kippt und sich nicht
// sichern laesst.
//
// Seitdem gilt beides: Mindest-Auflageflaeche (SUPPORT_MIN) UND kein Ueberstand ueber den Umriss
// der Traeger (OVERHANG_MAX). Gekostet hat das ueber 300 Ladungen 62 von 15.189 Packstuecken
// (0,4 %) -- bewusst bezahlt, siehe CLAUDE.md.
//
// node --test test/ueberhang.test.mjs
import fs from "node:fs";
import assert from "node:assert";
import test from "node:test";
import { fileURLToPath } from "node:url";
import path from "node:path";

const dir = path.dirname(fileURLToPath(import.meta.url));
const html = fs.readFileSync(path.join(dir, "..", "app.html"), "utf8");
const L = html.split("\n");
const s = L.findIndex((l) => l.includes("function makeFloorPacker"));
const e = L.findIndex((l, i) => i > s && l.trim() === "}" && L[i - 1].includes("return { placed, perType"));
const { packCargo, OVERHANG_MAX } = new Function(
  'var num=(v,d=0)=>Number.isFinite(+v)&&v!==""?+v:d;\n' + L.slice(s, e + 1).join("\n") + "\nreturn { packCargo, OVERHANG_MAX };"
)();

// Traeger einer Kiste = alles, dessen Oberkante genau auf ihrer Unterkante liegt und dessen
// Grundflaeche sich mit ihrer ueberschneidet. Der Ueberstand ist der groesste Betrag, um den
// eine Kante der Kiste ueber die Huelle dieser Traeger hinausragt.
const ueberstand = (b, alle) => {
  if (b.y <= 1e-4) return 0;
  const tr = alle.filter((o) => o !== b && Math.abs(o.y + o.dy - b.y) <= 1e-3 &&
    Math.min(b.x + b.dx, o.x + o.dx) - Math.max(b.x, o.x) > 0 &&
    Math.min(b.z + b.dz, o.z + o.dz) - Math.max(b.z, o.z) > 0);
  if (!tr.length) return Infinity; // schwebt
  const x0 = Math.min(...tr.map((o) => o.x)), x1 = Math.max(...tr.map((o) => o.x + o.dx));
  const z0 = Math.min(...tr.map((o) => o.z)), z1 = Math.max(...tr.map((o) => o.z + o.dz));
  return Math.max(0, x0 - b.x, b.x + b.dx - x1, z0 - b.z, b.z + b.dz - z1);
};
// Absichtlich gegen NULL geprueft und nicht gegen OVERHANG_MAX: sonst waere der Test
// mitgewachsen, wenn jemand die Grenze wieder aufmacht -- und genau das soll auffallen.
const pruefe = (r, wo) => {
  let gestapelt = 0;
  for (const b of r.placed) {
    if (b.y <= 1e-4) continue;
    gestapelt++;
    const u = ueberstand(b, r.placed);
    assert.ok(u <= 1e-6,
      `${wo}: ${b.dx}x${b.dz} auf y=${b.y} ragt ${u === Infinity ? "frei schwebend" : u.toFixed(1) + " cm"} ueber seinen Unterbau`);
  }
  return gestapelt;
};

test("die Grenze steht auf null und ist keine Zufallszahl", () => {
  assert.strictEqual(typeof OVERHANG_MAX, "number");
  assert.ok(OVERHANG_MAX >= 0 && OVERHANG_MAX < 10,
    `OVERHANG_MAX ${OVERHANG_MAX}: ueber ein paar Zentimetern ist es wieder der Ueberhang, um den es ging`);
});

test("der gemeldete Fall: lang auf kurz kommt nicht mehr vor", () => {
  // Zwei Laengen, die genau die Falle bilden: 300 auf 210 sind rechnerisch 70 % Auflage --
  // die alte Regel liess das durch, und die 90 cm standen in der Luft.
  const HC = { l: 1203, w: 235, h: 270, payload: 26580 };
  const cargo = [
    { name: "kurz", l: 210, w: 110, h: 60, weight: 200, qty: 12, stackable: true, rotatable: false },
    { name: "lang", l: 300, w: 110, h: 60, weight: 260, qty: 12, stackable: true, rotatable: false }
  ];
  const r = packCargo(HC, cargo, { intensive: true });
  const g = pruefe(r, "lang auf kurz");
  assert.ok(g > 0, "der Fall muss ueberhaupt stapeln, sonst prueft er nichts");
});

test("Jareks Sendung: 37 einzeln erfasste Paletten, nichts ragt ueber", () => {
  const G1 = [49, 47, 47, 46, 45, 45, 45, 45, 42, 42, 45, 45, 45, 45, 45, 43, 43, 43, 47, 47, 47, 47, 46, 43, 45, 45, 45, 45, 44];
  const G2 = [55, 55, 55, 55, 55, 55, 51, 51];
  const cargo = [
    ...G1.map((h, i) => ({ name: "G1-" + i, l: 325, w: 218, h, weight: 2000, qty: 1, stackable: true, stackH: 180, rotatable: true })),
    ...G2.map((h, i) => ({ name: "G2-" + i, l: 228, w: 110, h, weight: 1000, qty: 1, stackable: true, stackH: 180, rotatable: true }))
  ];
  const r = packCargo({ l: 1203, w: 235, h: 270, payload: 26580 }, cargo, {});
  pruefe(r, "37 Paletten");
});

test("breite Streuung: 120 gemischte Ladungen ohne einen einzigen Ueberstand", () => {
  const CT = [{ l: 590, w: 235, h: 239, payload: 28200 }, { l: 1203, w: 235, h: 270, payload: 26580 },
    { l: 590, w: 235, h: 270, payload: 28150 }, { l: 1362, w: 248, h: 270, payload: 24000 }];
  let seed = 4711;
  const rnd = () => ((seed = (seed * 1103515245 + 12345) & 2147483647) / 2147483647);
  const ri = (a, b) => a + Math.floor(rnd() * (b - a + 1));
  let gestapelt = 0;
  for (let i = 0; i < 120; i++) {
    const types = [];
    // Absichtlich sehr unterschiedliche Grundflaechen -- genau daraus entsteht "lang auf kurz".
    for (let t = 0, n = ri(2, 4); t < n; t++) types.push({
      name: "T" + t, l: ri(40, 320), w: ri(40, 220), h: ri(30, 150), weight: ri(50, 500),
      qty: ri(3, 16), stackable: rnd() < 0.85, rotatable: rnd() < 0.8
    });
    gestapelt += pruefe(packCargo(CT[ri(0, 3)], types, {}), "Zufallsfall " + i);
  }
  assert.ok(gestapelt > 400, `nur ${gestapelt} gestapelte Kisten -- die Streuung prueft zu wenig`);
});
