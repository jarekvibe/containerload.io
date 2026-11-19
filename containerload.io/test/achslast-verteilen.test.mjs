// Erst verteilen, dann schieben (Jareks Befund 19.11.26, mit Bild und Plan-Link).
//
// 18 flache Paletten 325 x 218 (36-51 cm hoch, je 1,3-2,6 t) auf zwei Planensattel. Der
// Rechner stapelte sie fuenf hoch auf die ersten 6,5 m -- die Stuetzlast lag bei ~17 t statt
// 11 t -- und schob den Block dann 2,87 m von der Stirnwand weg: "Warum staut er die mittig
// und nicht am Ende?". An der Rampe verteilt man solche Ladung flach ueber die Ladeflaeche.
//
// Seitdem: Ist der Zapfen ueberlastet, packt achsVerteilen dieselben Stuecke noch einmal mit
// tieferer Decke (und prueft die Spiegelung -- schwere Stapel nach hinten); genommen wird
// die flachste Lage, bei der der Zapfen haelt. Geschoben wird nur noch der Rest. Dieser
// Test rechnet den gemeldeten Fall mit der echten Kette durch und haelt die Vertraege fest.
//
// node --test test/achslast-verteilen.test.mjs
import fs from "node:fs";
import assert from "node:assert";
import test from "node:test";
import { fileURLToPath } from "node:url";
import path from "node:path";

const dir = path.dirname(fileURLToPath(import.meta.url));
const roh = fs.readFileSync(path.join(dir, "..", "app.html"), "utf8");
const L = roh.split("\n");
const cut = (von, bis) => {
  const s = L.findIndex((l) => l.includes(von));
  const e = L.findIndex((l, i) => i > s && bis(l, i));
  assert.ok(s >= 0 && e > s, `Ausschnitt nicht gefunden: ${von}`);
  return L.slice(s, e + 1).join("\n");
};
let ende = 0;
const M = new Function(
  `var num=(v,d=0)=>Number.isFinite(+v)&&v!==""?+v:d;
   var applyCarrier=(p)=>p;
   ${cut("var PRESETS = {", (l) => l.includes("var panelsFor"))}
   ${cut("function makeFloorPacker", (l, i) => l.trim() === "}" && L[i - 1].includes("single: false"))}
   ${cut("var ACHSEN = {", (l, i) => l.trim() === "}" && L[i - 1].includes("return best && best.zapfen < a0.zapfen ? best : null;"))}
   ${cut("var MAXCHAIN", (l, i) => l.trim() === "}" && L[i - 1].includes("return { chain, remainingBoxes") && ++ende === 2)}
   return { packCargo, VEHICLES, ACHSEN, achslasten, achsShift, achsVerteilen, achsSpiegel, chainVehicles, MAXCHAIN, ACHS_VERTEILEN_MAX };`
)();

const V = M.VEHICLES["Planensattel"], A = M.ACHSEN["Planensattel"];
// Die Ladung aus Jareks Link (Hoehen und Gewichte wie eingegeben, frei stapelbar)
const HOEHE = [36, 45, 45, 50, 40, 41, 41, 36, 46, 51, 45, 45, 51, 45, 45, 50, 51, 45];
const KG = [1294, 2170, 2171, 2514, 1794, 1807, 1802, 1455, 1338, 2560, 2226, 2250, 2646, 2170, 2171, 2514, 2560, 2226];
const LADUNG = HOEHE.map((h, i) => ({ name: "HU " + i, l: 325, w: 218, h, weight: KG[i], qty: 1, stackable: true, stackMax: Infinity, rotatable: true }));
const w = (ti) => LADUNG[ti].weight;
const OPT = { noHint: true, ordentlich: true };
const oben = (pl) => Math.max(...pl.map((p) => p.y + p.dy));
const stuecke = (pl) => LADUNG.map((t, i) => ({ ...t, qty: pl.filter((p) => p.ti === i).length }));

// Genau der Nachlauf aus dem Pack-Effekt in app.html: erst verteilen, dann schieben
const nachlauf = (slot) => {
  const v = M.achsVerteilen(slot.placed, stuecke(slot.placed), w, A, V, OPT);
  const pl = v ? v.placed : slot.placed;
  const dx = M.achsShift(pl, w, A, V.l);
  return { v, pl: dx ? pl.map((p) => ({ ...p, x: p.x + dx })) : pl, dx };
};
const kette = () => {
  const r = M.packCargo(V, LADUNG, { noHint: true });
  return M.chainVehicles(V, "Planensattel", LADUNG, r, null, M.MAXCHAIN);
};

// Gueltige Stauung: im Fahrzeug, keine Durchdringung, alles Gestapelte steht auf etwas
const pruefeLage = (pl, text) => {
  for (const p of pl) {
    assert.ok(p.x >= 0 && p.x + p.dx <= V.l + 1e-6 && p.z >= 0 && p.z + p.dz <= V.w + 1e-6 && p.y >= 0 && p.y + p.dy <= V.h + 1e-6, `${text}: Stueck ausserhalb`);
  }
  for (let i = 0; i < pl.length; i++) {
    for (let j = i + 1; j < pl.length; j++) {
      const a = pl[i], b = pl[j];
      const ueber = a.x < b.x + b.dx - 1e-6 && b.x < a.x + a.dx - 1e-6 && a.y < b.y + b.dy - 1e-6 && b.y < a.y + a.dy - 1e-6 && a.z < b.z + b.dz - 1e-6 && b.z < a.z + a.dz - 1e-6;
      assert.ok(!ueber, `${text}: Stuecke ${i} und ${j} durchdringen sich`);
    }
  }
  for (const p of pl) {
    if (p.y < 1e-6) continue;
    let traeg = 0;
    for (const q of pl) {
      if (Math.abs(q.y + q.dy - p.y) > 1e-6) continue;
      const fx = Math.max(0, Math.min(p.x + p.dx, q.x + q.dx) - Math.max(p.x, q.x));
      const fz = Math.max(0, Math.min(p.z + p.dz, q.z + q.dz) - Math.max(p.z, q.z));
      traeg += fx * fz;
    }
    assert.ok(traeg >= 0.7 * p.dx * p.dz - 1e-6, `${text}: ein Stueck schwebt`);
  }
};

test("der gemeldete Fall: vorher fuenf hoch und 2,87 m Luecke -- jetzt flach ab der Stirnwand", () => {
  const ch = kette();
  assert.strictEqual(ch.remainingBoxes, 0);
  assert.strictEqual(ch.chain.length, 2, "die Ladung braucht zwei Fahrzeuge (37,7 t)");
  for (const [si, slot] of ch.chain.entries()) {
    const vorher = M.achslasten(slot.placed, w, A);
    // So war es: der Zapfen weit ueber 11 t, nur Schieben haette geholfen
    assert.ok(vorher.zapfen > 15000, `F${si + 1}: Ausgangslage nicht wie gemeldet (${Math.round(vorher.zapfen)} kg)`);
    assert.ok(M.achsShift(slot.placed, w, A, V.l) > 250, `F${si + 1}: ohne Verteilen waere kein grosser Schub noetig`);
    const { v, pl, dx } = nachlauf(slot);
    assert.ok(v, `F${si + 1}: nicht verteilt`);
    assert.strictEqual(dx, 0, `F${si + 1}: es wird trotzdem geschoben (${dx} cm)`);
    const a = M.achslasten(pl, w, A);
    assert.ok(a.zapfen <= A.zapfenMax && a.aggregat <= A.aggregatMax, `F${si + 1}: Achslasten ${Math.round(a.zapfen)} / ${Math.round(a.aggregat)}`);
    assert.strictEqual(Math.min(...pl.map((p) => p.x)), 0, `F${si + 1}: Ladung steht nicht an der Stirnwand`);
    assert.ok(oben(pl) <= 140, `F${si + 1}: Stapel ${oben(pl)} cm hoch -- nicht flach verteilt`);
    assert.ok(oben(pl) < oben(slot.placed), `F${si + 1}: nicht flacher als vorher`);
    // Dieselben Stuecke, nichts verloren, nichts doppelt
    assert.deepStrictEqual(pl.map((p) => p.ti).sort((x, y) => x - y), slot.placed.map((p) => p.ti).sort((x, y) => x - y), `F${si + 1}: andere Stuecke`);
    pruefeLage(pl, `F${si + 1}`);
  }
});

test("Spiegelung: nur die Laengslage aendert sich, zweimal gespiegelt ist wie vorher", () => {
  const pl = M.packCargo(V, LADUNG.slice(0, 6), { noHint: true }).placed;
  const sp = M.achsSpiegel(pl);
  const endeX = Math.max(...pl.map((p) => p.x + p.dx));
  sp.forEach((q, i) => {
    assert.strictEqual(q.y, pl[i].y); assert.strictEqual(q.z, pl[i].z); assert.strictEqual(q.dx, pl[i].dx);
    assert.ok(Math.abs(q.x - (endeX - pl[i].x - pl[i].dx)) < 1e-9);
  });
  assert.deepStrictEqual(M.achsSpiegel(sp).map((p) => p.x), pl.map((p) => p.x));
  pruefeLage(sp, "gespiegelt");
});

test("nichts zu verteilen: haltender Zapfen, ein einzelnes Stueck -- dann bleibt nur Schieben", () => {
  // Leichte Ladung: der Zapfen haelt, nichts wird angefasst
  const leicht = [{ name: "L", l: 120, w: 80, h: 100, weight: 300, qty: 20, stackable: true, stackMax: Infinity, rotatable: true }];
  const pl = M.packCargo(V, leicht, { noHint: true }).placed;
  assert.strictEqual(M.achsVerteilen(pl, leicht, () => 300, A, V, OPT), null);
  // Eine 20-t-Kiste: flacher geht nicht, gespiegelt ist sie dieselbe -- also geschoben
  const kiste = [{ name: "K", l: 400, w: 240, h: 100, weight: 20000, qty: 1, stackable: false, rotatable: false }];
  const k = M.packCargo(V, kiste, { noHint: true }).placed;
  assert.strictEqual(M.achsVerteilen(k, kiste, () => 20000, A, V, OPT), null);
  assert.ok(M.achsShift(k, () => 20000, A, V.l) > 300, "die schwere Kiste muss weiter nach hinten");
  // Rechenzeit-Deckel
  assert.ok(M.ACHS_VERTEILEN_MAX >= 100 && M.ACHS_VERTEILEN_MAX <= 1000);
});

test("Vertraege im Pack-Effekt und in der Anzeige", () => {
  const fx = roh.slice(roh.indexOf('if (domain === "road" && r.chain) {'), roh.indexOf("Gezaehlt wird das ERGEBNIS"));
  assert.ok(fx.includes("achsVerteilen(slot.placed, stuecke, wOf, A, slot.preset || container, { noHint: true, ordentlich: true })"), "Verteilen fehlt im Pack-Effekt");
  assert.ok(fx.indexOf("achsVerteilen(") < fx.indexOf("const dx = achsShift(slot.placed, wOf, A, L);"), "erst verteilen, DANN schieben");
  assert.ok(fx.includes("if (!mitStopps) {"), "mit Stopps darf nicht umgestapelt werden (Entladereihenfolge)");
  assert.ok(fx.includes("if (si === 0) { r.placed = v.placed; if (v.layers != null) r.layers = v.layers; }"), "Slot 0 und r.placed laufen auseinander");
  // Die Schublade sagt, dass verteilt wurde; das Bild sagt, wenn trotzdem geschoben wurde
  assert.ok(roh.includes("achsDecke > 0 ? T.axleSpread(achsDecke / 100, achsGespiegelt) : T.axleHeckSchwer"), "Verteilen wird nicht ausgewiesen");
  assert.ok(roh.includes("!manualMode && achsRuecke > 0 && /* @__PURE__ */ React.createElement(\"div\", { className: \"absolute top-4 left-4 clrise\""), "Hinweis im Bild fehlt");
  assert.ok(roh.includes("T.axleShiftBild(achsRuecke / 100)"), "Hinweis im Bild nennt die Weite nicht");
  for (const t of ["axleSpread:", "axleHeckSchwer:", "axleShiftBild:"]) {
    assert.strictEqual(roh.split(t).length - 1, 2, `${t} nicht in beiden Sprachen`);
  }
  assert.ok(roh.includes("von der Stirnwand abger\\xFCckt") && roh.includes("back from the front wall"));
});
