// Drei Grenzfaelle im Container-Packer, alle drei aus einer Pruefung heraus gemeldet
// und hier mit den Zahlen der Meldung nachgestellt.
//
// 1) Ein Packstueck mit 3 mm Kante blockierte den Browser fuenf bis zwoelf Sekunden.
//    Das Bodenraster wurde immer vollstaendig aufgebaut, auch fuer ein einziges Teil:
//    auf einem 45' HC sind das 3,5 Millionen Rechtecke. Erreichbar ohne jede Absicht —
//    die Eingabe laesst sich auf Millimeter umstellen, "3" heisst dann 0,3 cm.
// 2) Ein negatives Stueckgewicht lief ungeklemmt in die Summe. Der Palettierer klemmt
//    seit jeher auf >= 0, der Container-Packer nicht: "-9.940 kg" bei 100 kg Zuladung.
// 3) Die Mengenbilanz muss stimmen: verstaut + offen = eingegeben, immer.
//
// node --test test/packer-grenzfaelle.test.mjs
import fs from "node:fs";
import assert from "node:assert";
import test from "node:test";
import { fileURLToPath } from "node:url";
import path from "node:path";

const dir = path.dirname(fileURLToPath(import.meta.url));
const L = fs.readFileSync(path.join(dir, "..", "app.html"), "utf8").split("\n");
const cut = (von, bis) => {
  const s = L.findIndex((l) => l.includes(von));
  const e = L.findIndex((l, i) => i > s && bis(l, i));
  assert.ok(s >= 0 && e > s, `Ausschnitt nicht gefunden: ${von}`);
  return L.slice(s, e + 1).join("\n");
};
const { packCargo, PRESETS, makeFloorPacker } = new Function(
  `var num=(v,d=0)=>Number.isFinite(+v)&&v!==""?+v:d;
   ${cut("var PRESETS = {", (l) => l.includes("var panelsFor"))}
   ${cut("function makeFloorPacker", (l, i) => l.trim() === "}" && L[i - 1].includes("single: false"))}
   return { packCargo, PRESETS, makeFloorPacker };`
)();

const stueck = (o) => ({ name: "P", weight: 10, stackable: true, rotatable: true, ...o });

test("winzige Masse blockieren den Rechner nicht mehr", () => {
  const C = PRESETS["45' HC"];
  for (const kante of [0.2, 0.3, 1]) {
    const t0 = Date.now();
    const r = packCargo(C, [stueck({ l: kante, w: kante, h: kante, qty: 1 })], {}, false);
    const ms = Date.now() - t0;
    assert.strictEqual(r.boxes, 1, `${kante} cm: das eine Teil muss verladen werden`);
    // Grosszuegig gemessen: vorher waren es 5.400 bis 11.900 ms fuer genau diesen Aufruf.
    assert.ok(ms < 1000, `${kante} cm Kante brauchte ${ms} ms — der Browser steht so lange still`);
  }
});

test("die Deckelung des Bodenrasters aendert kein einziges Ergebnis", () => {
  // Unter der Grenze muss exakt dasselbe herauskommen wie ohne Grenze; ab der Grenze
  // mindestens so viel, wie der Aufrufer angefordert hat. Beides hier nachgerechnet.
  const felder = [[590, 235], [1203, 235], [120, 80], [1355, 235]];
  const stuecke = [[120, 80], [100, 120], [45, 30], [60, 40], [110, 75], [244, 100]];
  for (const [FL, FW] of felder) for (const [l, w] of stuecke) for (const rot of [true, false]) {
    const echt = makeFloorPacker(l, w, rot)(FL, FW).count;
    for (const bedarf of [1, 2, 5, echt, echt + 1, echt + 50]) {
      const ged = makeFloorPacker(l, w, rot, bedarf)(FL, FW).count;
      if (bedarf > echt) assert.strictEqual(ged, echt, `${l}x${w} auf ${FL}x${FW} (rot=${rot}), Bedarf ${bedarf}`);
      else assert.ok(ged >= bedarf && ged <= echt,
        `${l}x${w} auf ${FL}x${FW} (rot=${rot}): Bedarf ${bedarf}, geliefert ${ged}, echtes Maximum ${echt}`);
    }
  }
});

test("die Stellzahlen der Speditionstabelle bleiben unveraendert", () => {
  // Die Zahlen, an denen das Werkzeug gemessen wird — sie duerfen sich durch die
  // Deckelung unter keinen Umstaenden verschieben.
  const faelle = [["20' GP", 11], ["40' GP", 25], ["40' HC", 25], ["45' HC", 27]];
  for (const [name, erwartet] of faelle) {
    const C = PRESETS[name];
    const r = packCargo(C, [stueck({ l: 120, w: 80, h: 220, qty: 40, weight: 300, stackable: false })], {}, false);
    assert.strictEqual(r.boxes, erwartet, `${name}: Europaletten bodengestellt`);
  }
});

test("ein negatives Stueckgewicht zieht die Zuladung nicht ins Minus", () => {
  const C = { ...PRESETS["20' GP"], payload: 100 };
  const r = packCargo(C, [
    stueck({ name: "Gutschrift", l: 100, w: 100, h: 100, weight: -500, qty: 20 }),
    stueck({ name: "Ware", l: 100, w: 100, h: 100, weight: 60, qty: 3 })
  ], {}, false);
  assert.ok(r.weight >= 0, `angezeigtes Gewicht ${r.weight} kg — negativ ist keine Ladung`);
  assert.ok(r.weight <= C.payload + 1e-6, `${r.weight} kg bei ${C.payload} kg Zuladung — der Deckel greift nicht mehr`);
});

test("Mengenbilanz: verstaut plus offen ergibt immer die eingegebene Menge", () => {
  const faelle = [
    [PRESETS["20' GP"], [stueck({ l: 120, w: 80, h: 110, qty: 60, weight: 300 })]],
    [PRESETS["20' GP"], [stueck({ l: 900, w: 200, h: 200, qty: 3, weight: 900 })]],
    [PRESETS["20' GP"], [stueck({ l: 120, w: 80, h: 110, qty: 20, weight: 300 }), stueck({ l: 240, w: 110, h: 95, qty: 4, weight: 800 })]],
    [{ ...PRESETS["20' GP"], payload: 500 }, [stueck({ l: 100, w: 100, h: 100, qty: 30, weight: 400 })]]
  ];
  for (const [C, cargo] of faelle) {
    const r = packCargo(C, cargo, {}, false);
    const eingegeben = cargo.reduce((s, t) => s + Math.max(0, Math.floor(t.qty)), 0);
    assert.strictEqual(r.totalBoxes, eingegeben, "totalBoxes muss die eingegebene Menge sein");
    assert.ok(r.boxes <= r.totalBoxes, "es kann nicht mehr verstaut sein als eingegeben");
    const summeTypen = r.perType.reduce((s, p) => s + p.loaded, 0);
    assert.strictEqual(summeTypen, r.boxes, "die Summe je Typ muss der Gesamtzahl entsprechen");
  }
});
