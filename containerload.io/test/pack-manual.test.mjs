// Regressionstest für die reinen Geometrie-Helfer des manuellen Platzierens (Slice 2):
// boxesOverlap/withinBounds/dropHeight/manualCandidate. Extrahiert aus app.html.
// node test/pack-manual.test.mjs
import fs from "node:fs";
import assert from "node:assert";
import { fileURLToPath } from "node:url";
import path from "node:path";

const dir = path.dirname(fileURLToPath(import.meta.url));
const html = fs.readFileSync(path.join(dir, "..", "app.html"), "utf8");
const L = html.split("\n");
const s = L.findIndex((l) => l.includes("var SUPPORT_MIN = 0.7;"));
const e = L.findIndex((l, i) => i > s && l.includes("function emsPackOnce"));
const block = L.slice(s, e).join("\n");
const src = 'var num=(v,d=0)=>Number.isFinite(+v)&&v!==""?+v:d;\n' + block +
  "\nreturn { boxesOverlap, withinBounds, dropHeight, manualCandidate, SUPPORT_MIN };";
const { boxesOverlap, withinBounds, dropHeight, manualCandidate } = new Function(src)();

const Ct = { l: 590, w: 235, h: 239, payload: 28200 };

// 1) Erstes Stück landet auf dem Boden
let placed = [];
let r = manualCandidate(Ct, { l: 120, w: 80, h: 110, weight: 300, stackable: true, rotatable: true }, false, 0, 0, placed, 0);
assert.ok(r.ok, "erstes Stück sollte passen");
assert.strictEqual(r.box.y, 0, "erstes Stück auf dem Boden");
placed.push(r.box);

// 2) Zweites Stück direkt daneben (gleiche Höhe) -> auch y=0
r = manualCandidate(Ct, { l: 120, w: 80, h: 110, weight: 300, stackable: true, rotatable: true }, false, 120, 0, placed, 300);
assert.ok(r.ok, "daneben sollte passen");
assert.strictEqual(r.box.y, 0);
placed.push(r.box);

// 3) Drittes Stück OBEN auf dem ersten (gleiche Grundfläche) -> y = 110 (Oberkante)
r = manualCandidate(Ct, { l: 120, w: 80, h: 110, weight: 300, stackable: true, rotatable: true }, false, 0, 0, placed, 600);
assert.ok(r.ok, "oben drauf sollte passen");
assert.strictEqual(r.box.y, 110, "landet exakt auf der Oberkante des darunterliegenden Stücks");
placed.push(r.box);

// 4) NICHT genug Auflage: 90% des Footprints ragt über die Kante hinaus -> darf NICHT auf der
//    (viel zu kleinen) Auflage schweben, muss auf den Boden fallen (0), da kein Overlap dort.
placed = [{ x: 0, y: 0, z: 0, dx: 120, dy: 110, dz: 80 }];
// neues Stück bei x=300 (weit weg, kein Overlap mit dem Boden-Stück) -> landet auf dem Boden
r = manualCandidate(Ct, { l: 120, w: 80, h: 110, weight: 300, stackable: true, rotatable: true }, false, 300, 0, placed, 300);
assert.ok(r.ok);
assert.strictEqual(r.box.y, 0, "weit entferntes Stück landet auf dem Boden, nicht in der Luft");

// 5) Kaum Auflage (nur 10% Overlap mit einer Kiste) -> darf NICHT auf deren Oberkante "schweben"
//    -> muss auf den Boden fallen falls dort frei, sonst reason overlap/keine Position
placed = [{ x: 0, y: 0, z: 0, dx: 120, dy: 110, dz: 80 }];
r = manualCandidate(Ct, { l: 120, w: 80, h: 40, weight: 50, stackable: true, rotatable: true }, false, 108, 0, placed, 300);
// footprint x:[108,228] überlappt das Basis-Stück nur in x:[108,120] = 12/120 = 10% -> zu wenig Auflage bei y=110
// da sonst nichts da ist, MUSS es auf den Boden (y=0) fallen, dort aber x:[108,228] überlappt z. T. mit dem
// Basisstück in 3D (y 0..110 vs 0..40) -> das wäre ein echter Overlap -> Ablehnung erwartet
assert.ok(!r.ok, "10% Auflage darf nicht auf der Oberkante schweben; am Boden würde es die Basis-Kiste durchdringen -> muss abgelehnt werden");

// 6) Nicht stapelbar: darf NIE über y=0
placed = [{ x: 0, y: 0, z: 0, dx: 120, dy: 110, dz: 80 }];
r = manualCandidate(Ct, { l: 120, w: 80, h: 50, weight: 50, stackable: false, rotatable: true }, false, 0, 0, placed, 300);
assert.ok(!r.ok, "nicht-stapelbar auf besetzter Fläche -> abgelehnt (kein Ausweichen nach oben)");

// 7) Zuladung: über dem Payload -> abgelehnt
r = manualCandidate(Ct, { l: 50, w: 50, h: 50, weight: 5000, stackable: true, rotatable: true }, false, 300, 0, [], 27000);
assert.strictEqual(r.ok, false);
assert.strictEqual(r.reason, "weight", "Zuladung überschritten -> reason weight");

// 8) Rotation: Stück mit l=100,w=300 passt UNGEDREHT nicht (dz=300 > CW=235), GEDREHT schon
//    (dx=300 <= CL=590, dz=100 <= CW=235).
const CtR = { l: 590, w: 235, h: 239, payload: 28200 };
const itR = { l: 100, w: 300, h: 100, weight: 10, stackable: true, rotatable: true };
r = manualCandidate(CtR, itR, false, 0, 0, [], 0);
assert.strictEqual(r.ok, false, "ungedreht (dz=300 > CW=235) darf nicht passen");
r = manualCandidate(CtR, itR, true, 0, 0, [], 0);
assert.ok(r.ok, "gedreht sollte passen");
assert.strictEqual(r.box.dx, 300, "gedreht: dx=w");
assert.strictEqual(r.box.dz, 100, "gedreht: dz=l");

// 9) Zu groß für den Container (auch gedreht) -> reason toobig
r = manualCandidate({ l: 590, w: 235, h: 239, payload: 28200 }, { l: 700, w: 300, h: 100, weight: 10, stackable: true, rotatable: true }, false, 0, 0, [], 0);
assert.strictEqual(r.reason, "toobig");

// 10) Klemmen: Klick nahe der rechten Wand klemmt px so, dass die Kiste noch reinpasst
r = manualCandidate({ l: 590, w: 235, h: 239, payload: 28200 }, { l: 120, w: 80, h: 100, weight: 10, stackable: true, rotatable: true }, false, 585, 5, [], 0);
assert.ok(r.ok);
assert.ok(r.box.x + r.box.dx <= 590 + 1e-6, "x wird geklemmt, damit die Kiste im Container bleibt");
assert.ok(r.box.z + r.box.dz <= 235 + 1e-6);

console.log("manual-placement: alle 10 Tests grün");
