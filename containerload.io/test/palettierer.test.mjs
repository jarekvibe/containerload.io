// Karton -> Palette: die Vorstufe vor dem Container-/LKW-Rechner.
//
// Der Rechner ist nur dann etwas wert, wenn seine Zahlen zusammenpassen: die Menge, die
// hineingeht, muss auf den Paletten wieder herauskommen, und die Masse, die an den
// Containerrechner uebergeben werden, muessen die WIRKLICHEN Aussenmasse sein — sonst
// rechnet der Container mit einer Palette, die es so nicht gibt.
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
const { palletize, PALLETS } = new Function(
  'var num=(v,d=0)=>Number.isFinite(+v)&&v!==""?+v:d;\n' + L.slice(ps, pe + 1).join("\n") + "\nreturn { palletize, PALLETS };"
)();

const EUR = PALLETS.EUR;
const K = (o) => ({ l: 60, w: 40, h: 40, weight: 10, qty: 100, rotatable: true, ...o });

test("Europalette und Industriepalette haben die genormte Hoehe", () => {
  assert.strictEqual(PALLETS.EUR.h, 14.4);
  assert.strictEqual(PALLETS.IND.h, 14.4);
  assert.deepStrictEqual([PALLETS.EUR.l, PALLETS.EUR.w], [120, 80]);
  assert.deepStrictEqual([PALLETS.IND.l, PALLETS.IND.w], [120, 100]);
});

test("60x40 auf EUR gibt genau vier Kartons je Lage", () => {
  const r = palletize(EUR, K({ qty: 4 }), { maxTotalH: 180 });
  assert.strictEqual(r.perLayer, 4);
  assert.strictEqual(r.rects.length, 4);
});

test("das Muster darf Ausrichtungen mischen (Kreuzverband)", () => {
  // 50x30 auf 120x80: reines Raster gibt 4, gemischt gehen 6.
  const r = palletize(EUR, K({ l: 50, w: 30, h: 30, qty: 6 }), { maxTotalH: 180 });
  assert.strictEqual(r.perLayer, 6);
  assert.ok(new Set(r.rects.map((x) => x.dx + "x" + x.dz)).size > 1, "Muster nutzt nur eine Ausrichtung");
});

test("Lagenzahl folgt der Gesamthoehe INKLUSIVE Palette", () => {
  // 180 cm gesamt - 14,4 Palette = 165,6 nutzbar; bei 40 cm Karton sind das 4 Lagen.
  const r = palletize(EUR, K({ h: 40 }), { maxTotalH: 180 });
  assert.strictEqual(r.layers, 4);
  assert.strictEqual(r.fullH, 14.4 + 160);
  assert.strictEqual(r.cap, "height");
});

test("die Tragfaehigkeit der Palette deckelt und nennt sich als Grund", () => {
  // 4 Kartons/Lage a 100 kg = 400 kg je Lage; 1500 kg Tragfaehigkeit -> 3 Lagen.
  const r = palletize(EUR, K({ weight: 100 }), { maxTotalH: 400 });
  assert.strictEqual(r.layers, 3);
  assert.strictEqual(r.cap, "weight");
});

test("eine harte Lagenobergrenze sticht die Hoehe", () => {
  const r = palletize(EUR, K({ h: 20 }), { maxTotalH: 200, maxLayers: 2 });
  assert.strictEqual(r.layers, 2);
  assert.strictEqual(r.cap, "layers");
});

test("Restpalette: die Menge geht vollstaendig auf", () => {
  const r = palletize(EUR, K({ h: 40, qty: 30 }), { maxTotalH: 180 }); // 4/Lage x 4 Lagen = 16
  assert.strictEqual(r.perPallet, 16);
  assert.strictEqual(r.full, 1);
  assert.strictEqual(r.rest, 14);
  assert.strictEqual(r.pallets, 2);
  assert.strictEqual(r.full * r.perPallet + r.rest, 30, "Kartons gehen unterwegs verloren");
});

test("die Restpalette ist niedriger und leichter als eine volle", () => {
  const r = palletize(EUR, K({ h: 40, qty: 30 }), { maxTotalH: 180 });
  assert.strictEqual(r.restLayers, 4);          // 14 Kartons brauchen 4 angebrochene Lagen
  assert.ok(r.restKg < r.fullKg, "Restpalette wiegt wie eine volle");
  assert.strictEqual(r.fullKg, 25 + 16 * 10);
  assert.strictEqual(r.restKg, 25 + 14 * 10);
});

test("das Leergewicht der Palette faehrt mit", () => {
  const r = palletize(EUR, K({ h: 40, qty: 16 }), { maxTotalH: 180 });
  assert.strictEqual(r.fullKg - 16 * 10, 25, "Palettengewicht fehlt in der Uebergabe");
});

test("ohne Ueberstand ragt nichts ueber die Kante", () => {
  const r = palletize(EUR, K({ l: 50, w: 30, h: 30, qty: 6 }), { maxTotalH: 180 });
  assert.strictEqual(r.overL, 0);
  assert.strictEqual(r.overW, 0);
  assert.strictEqual(r.outL, 120);
  assert.strictEqual(r.outW, 80);
});

test("zugelassener Ueberstand wird gemessen, nicht angenommen", () => {
  // 40x40 auf 120x80 geht buendig auf (3x2) — auch mit erlaubtem Ueberstand bleibt es buendig.
  const b = palletize(EUR, K({ l: 40, w: 40, h: 40, qty: 6 }), { maxTotalH: 180, over: 5 });
  assert.strictEqual(b.overL, 0, "ungenutzter Ueberstand darf nicht als Ueberstand erscheinen");
  assert.strictEqual(b.outL, 120);
});

test("genutzter Ueberstand vergroessert die uebergebenen Aussenmasse", () => {
  // 65x40 buendig: 3 je Lage (gedreht 3x1). Mit 5 cm Ueberstand ist die Flaeche 130x90,
  // dort stehen 2x2 = 4 Stueck — und ragen dafuer je 5 cm ueber die Laengskante.
  const r = palletize(EUR, K({ l: 65, w: 40, h: 40, qty: 4 }), { maxTotalH: 180, over: 5 });
  assert.strictEqual(r.perLayer, 4);
  assert.strictEqual(r.overL, 5);
  assert.strictEqual(r.outL, 130, "Container muss die tatsaechliche Aussenlaenge sehen");
  assert.strictEqual(r.outW, 80);
});

test("ein Karton groesser als die Palette liefert kein Muster, sondern einen Grund", () => {
  const r = palletize(EUR, K({ l: 200, w: 90, h: 40 }), { maxTotalH: 180 });
  assert.strictEqual(r.perLayer, 0);
  assert.strictEqual(r.cap, "footprint");
  assert.strictEqual(r.pallets, 0);
});

test("ein Karton hoeher als die zugelassene Bauhoehe ergibt keine Palette", () => {
  const r = palletize(EUR, K({ h: 200 }), { maxTotalH: 180 });
  assert.strictEqual(r.layers, 0);
  assert.strictEqual(r.perPallet, 0);
  assert.strictEqual(r.pallets, 0);
});

test("Menge 0 ergibt keine Palette, aber ein gueltiges Muster", () => {
  const r = palletize(EUR, K({ h: 40, qty: 0 }), { maxTotalH: 180 });
  assert.strictEqual(r.perLayer, 4);
  assert.strictEqual(r.pallets, 0);
  assert.strictEqual(r.full, 0);
  assert.strictEqual(r.rest, 0);
});

test("nicht drehbare Kartons bekommen nur eine Ausrichtung", () => {
  const r = palletize(EUR, K({ l: 50, w: 30, h: 30, qty: 6, rotatable: false }), { maxTotalH: 180 });
  assert.strictEqual(new Set(r.rects.map((x) => x.dx + "x" + x.dz)).size, 1);
  assert.strictEqual(r.perLayer, 4, "ohne Drehung bleibt es beim reinen Raster");
});

test("das Muster ueberlappt sich nicht", () => {
  for (const c of [[50, 30], [33, 22], [45, 35], [60, 40]]) {
    const r = palletize(PALLETS.IND, K({ l: c[0], w: c[1], h: 30, qty: 1 }), { maxTotalH: 180 });
    for (let i = 0; i < r.rects.length; i++) for (let j = i + 1; j < r.rects.length; j++) {
      const a = r.rects[i], b = r.rects[j];
      const sep = a.x + a.dx <= b.x + 1e-6 || b.x + b.dx <= a.x + 1e-6 || a.z + a.dz <= b.z + 1e-6 || b.z + b.dz <= a.z + 1e-6;
      assert.ok(sep, `Kartons ueberlappen bei ${c[0]}x${c[1]}`);
    }
  }
});
