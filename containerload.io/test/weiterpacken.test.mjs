// Weiterpacken auf einer Vorbelegung (opts.vorbelegt).
//
// Jeder Packlauf fing bisher beim leeren Container an. Zwei Dinge aus dem Mehr-Container-
// Entwurf brauchen das Gegenteil:
//   * die Zuweisung "dort ZUERST" -- erst die gepinnte Ware, dann der Rest in den Rest.
//     Ohne das heisst eine Zuweisung nur "dort", und dann landen von neun gepinnten Stuecken
//     zwei im Container, weil die Paletten frueher dran sind.
//   * der manuelle Modus je Container -- von Hand gesetzte Kisten sind nichts anderes als
//     eine Vorbelegung, auf der der Automat weitermachen soll.
//
// Diese Stufe aendert sichtbar NICHTS: ohne opts.vorbelegt laeuft alles wie vorher, und der
// Fuellgrad-Messstand ist Ziffer fuer Ziffer identisch (14.746 Packstuecke, 5.392,790 m3).
// Geprueft wird deshalb die neue Faehigkeit selbst -- sie hat noch keinen Aufrufer.
//
// node --test test/weiterpacken.test.mjs
import fs from "node:fs";
import assert from "node:assert";
import test from "node:test";
import { fileURLToPath } from "node:url";
import path from "node:path";

const dir = path.dirname(fileURLToPath(import.meta.url));
const roh = fs.readFileSync(path.join(dir, "..", "app.html"), "utf8");
const L = roh.split("\n");
const s = L.findIndex((l) => l.includes("function makeFloorPacker"));
const e = L.findIndex((l, i) => i > s && l.trim() === "}" && L[i - 1].includes("return { placed, perType"));
const { packCargo } = new Function(
  'var num=(v,d=0)=>Number.isFinite(+v)&&v!==""?+v:d;\n' + L.slice(s, e + 1).join("\n") + "\nreturn { packCargo };"
)();

const HC40 = { l: 1203, w: 235, h: 269, payload: 26580 };
const FLACH = { name: "Flach", l: 250, w: 80, h: 30, qty: 9, weight: 300, stackable: false };
const PAL = { name: "Palette", l: 120, w: 80, h: 110, qty: 22, weight: 300, stackMax: 3 };

const schneidet = (a, b) => ["x", "y", "z"].every((k) => {
  const d = k === "x" ? "dx" : k === "y" ? "dy" : "dz";
  return Math.min(a[k] + a[d], b[k] + b[d]) - Math.max(a[k], b[k]) > 1e-6;
});
// Alles, was unmittelbar auf u steht.
const drauf = (u, alle) => alle.filter((o) =>
  o !== u && Math.abs(o.y - (u.y + u.dy)) <= 1e-3 &&
  Math.min(u.x + u.dx, o.x + o.dx) - Math.max(u.x, o.x) > 1e-6 &&
  Math.min(u.z + u.dz, o.z + o.dz) - Math.max(u.z, o.z) > 1e-6);

test("was schon steht, kommt nicht im Ergebnis zurueck", () => {
  const erst = packCargo(HC40, [FLACH, { ...PAL, qty: 0 }], {});
  assert.strictEqual(erst.boxes, 8, "acht flache Stuecke passen allein auf den Boden");
  const zweit = packCargo(HC40, [{ ...FLACH, qty: 0 }, PAL], { vorbelegt: erst.placed });
  assert.ok(zweit.boxes > 0, "auf dem Rest muss noch etwas Platz sein");
  assert.ok(zweit.placed.every((b) => b.ti === 1),
    "im Ergebnis stehen Kisten der Vorbelegung -- 'pack das noch dazu' liefert, was dazukam");
  assert.strictEqual(zweit.perType[0].loaded, 0, "die Bilanz zaehlt die Vorbelegung mit");
});

test("nichts durchdringt die Vorbelegung, nichts schwebt darueber", () => {
  const erst = packCargo(HC40, [FLACH, { ...PAL, qty: 0 }], {});
  const zweit = packCargo(HC40, [{ ...FLACH, qty: 0 }, PAL], { vorbelegt: erst.placed });
  for (const n of zweit.placed) {
    for (const v of erst.placed) {
      assert.ok(!schneidet(n, v), `neue Kiste steckt in der Vorbelegung: ${JSON.stringify(n)}`);
    }
    if (n.y <= 1e-4) continue;
    const traeger = [...erst.placed, ...zweit.placed].filter((o) => o !== n &&
      Math.abs(o.y + o.dy - n.y) <= 1e-3 &&
      Math.min(n.x + n.dx, o.x + o.dx) - Math.max(n.x, o.x) > 1e-6 &&
      Math.min(n.z + n.dz, o.z + o.dz) - Math.max(n.z, o.z) > 1e-6);
    assert.ok(traeger.length > 0, `neue Kiste schwebt auf y=${n.y}`);
  }
});

// Die eigentliche Falle: eine von Hand gesetzte Kiste bringt pos/lim/hlim nicht mit. Ohne
// grenzenAus faellt der Packer auf "keine Grenze" zurueck -- und stapelt auf ein Stueck,
// auf das nichts darf.
test("die Stapelregel gilt ueber die Naht hinweg, auch ohne pos/lim an der Vorbelegung", () => {
  const cargo = [FLACH, PAL];
  // Ein nacktes Kistenobjekt, wie es der manuelle Modus liefert: nur Lage und Masse.
  const vonHand = [{ x: 0, y: 0, z: 0, dx: 250, dy: 30, dz: 80, ti: 0 }];
  assert.ok(!("pos" in vonHand[0]) && !("lim" in vonHand[0]), "der Testfall braucht eine Kiste ohne Grenzen");
  const r = packCargo(HC40, [{ ...FLACH, qty: 0 }, PAL], { vorbelegt: vonHand });
  const belastet = drauf(vonHand[0], [...vonHand, ...r.placed]).length;
  assert.strictEqual(belastet, 0,
    `auf dem nicht stapelbaren Stueck stehen ${belastet} Paletten -- die Grenzen der Vorbelegung fehlen`);
  // Gegenprobe: dieselbe Kiste als stapelbare Ware MUSS belastet werden, sonst prueft der
  // Test nur, dass an dieser Stelle ohnehin nichts hinpasst.
  const cargo2 = [{ ...FLACH, stackable: true, qty: 0 }, PAL];
  const r2 = packCargo(HC40, cargo2, { vorbelegt: [{ x: 0, y: 0, z: 0, dx: 250, dy: 30, dz: 80, ti: 0 }] });
  assert.ok(drauf({ x: 0, y: 0, z: 0, dx: 250, dy: 30, dz: 80 }, r2.placed).length > 0,
    "als stapelbare Ware muesste dort etwas daraufkommen");
  void cargo;
});

test("das Gewicht der Vorbelegung zaehlt gegen die Zuladung", () => {
  const schwer = { name: "Schwer", l: 120, w: 80, h: 110, qty: 20, weight: 1000 };
  const eng = { ...HC40, payload: 5000 };
  // Vier Stueck stehen schon: 4.000 kg von 5.000. Fuer das fuenfte ist kein Kilo mehr da.
  const vor = packCargo(eng, [{ ...schwer, qty: 4 }], {});
  assert.strictEqual(vor.boxes, 4);
  const r = packCargo(eng, [schwer], { vorbelegt: vor.placed });
  assert.strictEqual(r.boxes, 1, `erwartet genau ein weiteres Stueck (5.000 kg Grenze), waren ${r.boxes}`);
  // Ohne Vorbelegung waeren es fuenf -- die Grenze ist also wirklich das Gewicht und nicht der Platz.
  assert.strictEqual(packCargo(eng, [schwer], {}).boxes, 5);
});

test("eine einzige Sorte geht mit Vorbelegung durch den gemischten Pfad", () => {
  // Der Einzeltyp-Pfad legt ein Bodenraster und kennt keine Hindernisse. Ohne die Weiche
  // wuerde er die Vorbelegung schlicht ueberbauen.
  const vor = [{ x: 0, y: 0, z: 0, dx: 1203, dy: 110, dz: 235, ti: 0 }];   // sperrt die ganze Bodenlage
  const r = packCargo(HC40, [{ ...PAL, qty: 5 }], { vorbelegt: vor });
  r.placed.forEach((b) => {
    assert.ok(!schneidet(b, vor[0]), `Kiste steckt in der Vorbelegung: ${JSON.stringify(b)}`);
    assert.ok(b.y >= 110 - 1e-6, `Kiste steht unter der gesperrten Lage: y=${b.y}`);
  });
  assert.ok(/if \(valid\.length === 1 && !vorbelegt\) \{/.test(roh),
    "der Einzeltyp-Pfad prueft nicht mehr auf die Vorbelegung");
});

test("ueber 60 Zufallsfaelle bleibt die Vorbelegung unberuehrt", () => {
  let seed = 17;
  const rnd = () => ((seed = (seed * 1103515245 + 12345) & 2147483647) / 2147483647);
  const ri = (a, b) => a + Math.floor(rnd() * (b - a + 1));
  let mitZuwachs = 0;
  for (let f = 0; f < 60; f++) {
    const cargo = [];
    for (let t = 0; t < ri(2, 3); t++) {
      cargo.push({ name: "T" + t, l: ri(60, 260), w: ri(40, 120), h: ri(30, 140), weight: ri(20, 600),
        qty: ri(2, 14), rotatable: rnd() < 0.85, stackable: rnd() < 0.7 });
    }
    // Erst die eine Sorte, dann der Rest darauf.
    const nur0 = cargo.map((t, i) => (i === 0 ? t : { ...t, qty: 0 }));
    const erst = packCargo(HC40, nur0, {});
    if (!erst.placed.length) continue;
    const rest = cargo.map((t, i) => (i === 0 ? { ...t, qty: 0 } : t));
    const zweit = packCargo(HC40, rest, { vorbelegt: erst.placed });
    if (zweit.placed.length) mitZuwachs++;
    zweit.placed.forEach((n) => {
      assert.strictEqual(n.ti === 0, false, `Fall ${f}: eine Kiste der Vorbelegung kam zurueck`);
      erst.placed.forEach((v) => {
        assert.ok(!schneidet(n, v), `Fall ${f}: Ueberschneidung mit der Vorbelegung`);
      });
    });
    // Und die neuen Kisten stecken auch nicht ineinander.
    for (let i = 0; i < zweit.placed.length; i++) {
      for (let j = i + 1; j < zweit.placed.length; j++) {
        assert.ok(!schneidet(zweit.placed[i], zweit.placed[j]), `Fall ${f}: zwei neue Kisten ueberschneiden sich`);
      }
    }
  }
  assert.ok(mitZuwachs >= 25, `nur ${mitZuwachs} Faelle mit Zuwachs -- der Test liefe ins Leere`);
});

test("ohne Vorbelegung aendert sich nichts am Vertrag", () => {
  assert.ok(/function emsPackOnce\(C2, units, order, pay, cap, vorbelegt\)/.test(roh));
  assert.ok(/return \{ placed: vorN \? placed\.slice\(vorN\) : placed, weight \};/.test(roh),
    "die Vorbelegung wird nicht mehr aus dem Ergebnis geschnitten");
  assert.ok(/const payFrei = pay === Infinity \? Infinity : Math\.max\(0, pay - vorKg\);/.test(roh),
    "das Gewicht der Vorbelegung wird nicht mehr von der Zuladung abgezogen");
  assert.ok(/const g = grenzenAus\(B, vorbelegt, types\[B\.ti\]\);/.test(roh),
    "die Grenzen der Vorbelegung werden nicht mehr in packCargo ausgerechnet");
});
