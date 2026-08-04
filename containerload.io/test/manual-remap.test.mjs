// Regressionstest für remapPlaced: manuell platzierte Stücke müssen an ihrer Ware kleben, auch
// wenn sich die Ladungsliste darunter ändert. Die Position im cargo-Array (ti) verschiebt sich beim
// Löschen einer Zeile – maßgeblich ist die stabile cargo-id (cid).
// node --test test/manual-remap.test.mjs
import fs from "node:fs";
import assert from "node:assert";
import test from "node:test";
import { fileURLToPath } from "node:url";
import path from "node:path";

const dir = path.dirname(fileURLToPath(import.meta.url));
const html = fs.readFileSync(path.join(dir, "..", "app.html"), "utf8");
const L = html.split("\n");
const s = L.findIndex((l) => l.includes("var SUPPORT_MIN = 0.7;"));
const e = L.findIndex((l, i) => i > s && l.includes("function emsPackOnce"));
const src = 'var num=(v,d=0)=>Number.isFinite(+v)&&v!==""?+v:d;\n' + L.slice(s, e).join("\n") +
  "\nreturn { remapPlaced };";
const { remapPlaced } = new Function(src)();

const Ct = { l: 590, w: 235, h: 239, payload: 28200 };
// Drei Warenzeilen mit stabilen ids, wie sie die App über uid() vergibt.
const PAL = { id: "a1", name: "Europalette", l: 120, w: 80, h: 110, weight: 300, qty: 5, stackable: true };
const FAS = { id: "b2", name: "Fass", l: 60, w: 60, h: 90, weight: 200, qty: 5, stackable: true };
const KAR = { id: "c3", name: "Karton", l: 40, w: 40, h: 40, weight: 10, qty: 5, stackable: true };
const cargo = [PAL, FAS, KAR];

const box = (ti, cid, x) => ({ ti, cid, x, y: 0, z: 0, dx: 60, dy: 90, dz: 60, rot: false });

test("Löschen einer Zeile darüber: Stück bleibt an seiner Ware", () => {
  // Ein Fass (Zeile 1) liegt im Container. Dann wird die Europalette (Zeile 0) gelöscht.
  const placed = [box(1, "b2", 0)];
  const after = remapPlaced(Ct, placed, [FAS, KAR]);

  assert.strictEqual(after.length, 1, "das Fass darf nicht verschwinden");
  assert.strictEqual(after[0].cid, "b2", "es ist weiterhin dasselbe Fass");
  assert.strictEqual(after[0].ti, 0, "ti muss auf die neue Zeilenposition nachgeführt werden");
  // Der eigentliche Punkt: ohne Nachführung zeigte ti=1 jetzt auf den Karton.
  assert.strictEqual([FAS, KAR][after[0].ti].name, "Fass", "die Ware hinter dem Stück bleibt das Fass");
});

test("Ohne Nachführung wäre es der falsche Artikel (Beleg für den Bug)", () => {
  const stale = box(1, "b2", 0);
  assert.strictEqual([FAS, KAR][stale.ti].name, "Karton",
    "Vorbedingung: der rohe Index zeigt nach dem Löschen auf die falsche Ware");
});

test("Gelöschte Ware entfernt ihre Stücke", () => {
  const placed = [box(0, "a1", 0), box(1, "b2", 200)];
  const after = remapPlaced(Ct, placed, [FAS, KAR]); // Europalette (a1) ist weg
  assert.strictEqual(after.length, 1);
  assert.strictEqual(after[0].cid, "b2");
});

test("Umsortierte Liste: Stücke folgen ihrer Ware", () => {
  const placed = [box(0, "a1", 0), box(2, "c3", 200)];
  const after = remapPlaced(Ct, placed, [KAR, FAS, PAL]); // umgedreht
  assert.strictEqual(after.find((b) => b.cid === "a1").ti, 2, "Palette steht jetzt an Position 2");
  assert.strictEqual(after.find((b) => b.cid === "c3").ti, 0, "Karton steht jetzt an Position 0");
});

test("Menge reduziert: überzählige Stücke fallen weg", () => {
  const placed = [box(1, "b2", 0), box(1, "b2", 100), box(1, "b2", 200)];
  const after = remapPlaced(Ct, placed, [PAL, { ...FAS, qty: 2 }, KAR]);
  assert.strictEqual(after.length, 2, "nur noch zwei Fässer laut Eingabe");
});

test("Container verkleinert: Stücke ausserhalb fallen weg", () => {
  const placed = [box(1, "b2", 0), box(1, "b2", 500)];
  const after = remapPlaced({ ...Ct, l: 300 }, placed, cargo);
  assert.strictEqual(after.length, 1, "das Stück bei x=500 liegt ausserhalb");
  assert.strictEqual(after[0].x, 0);
});

test("Unverändert: dieselbe Array-Referenz zurück (kein Re-Render-Loop)", () => {
  const placed = [box(0, "a1", 0), box(1, "b2", 200)];
  assert.strictEqual(remapPlaced(Ct, placed, cargo), placed,
    "ohne Änderung muss die Identität erhalten bleiben, sonst rendert React endlos");
});

test("Altbestand ohne cid fällt auf den Index zurück", () => {
  const placed = [{ ti: 1, x: 0, y: 0, z: 0, dx: 60, dy: 90, dz: 60, rot: false }];
  const after = remapPlaced(Ct, placed, cargo);
  assert.strictEqual(after.length, 1, "darf nicht stillschweigend verschwinden");
  assert.strictEqual(after[0].ti, 1);
});
