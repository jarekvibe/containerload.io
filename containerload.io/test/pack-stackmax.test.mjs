// Regressionstest fuer die Stapel-Obergrenze (stackMax / stackCapOf).
// Semantik: stackMax ist eine TRAGFAEHIGKEIT. Der Selektor sagt es woertlich —
//   "1x stapelbar" = eine zusaetzliche Lage obendrauf, also stackMax 2. Die Grenze zaehlt
//   AB DEM STUECK SELBST nach oben, nicht ab dem Containerboden, und sie gilt unabhaengig
//   davon, WAS obendrauf steht.
//   nicht stapelbar -> das Stueck darf auf nichts stehen; "frei" -> unbegrenzt.
// Extrahiert packCargo UND manualCandidate aus app.html (gleiche Slice-Mechanik wie die
// uebrigen Packer-Tests) und prueft, dass die Obergrenze im Auto- wie im Manuell-Pfad greift.
import fs from "node:fs";
import assert from "node:assert";
import test from "node:test";
import { fileURLToPath } from "node:url";
import path from "node:path";

const dir = path.dirname(fileURLToPath(import.meta.url));
const html = fs.readFileSync(path.join(dir, "..", "app.html"), "utf8");
const L = html.split("\n");

// --- packCargo (makeFloorPacker ... "return { placed, perType") ---
const ps = L.findIndex((l) => l.includes("function makeFloorPacker"));
const pe = L.findIndex((l, i) => i > ps && l.trim() === "}" && L[i - 1].includes("return { placed, perType"));
const { packCargo } = new Function('var num=(v,d=0)=>Number.isFinite(+v)&&v!==""?+v:d;\n' + L.slice(ps, pe + 1).join("\n") + "\nreturn { packCargo };")();

// --- manualCandidate (var SUPPORT_MIN ... function emsPackOnce) ---
const ms = L.findIndex((l) => l.includes("var SUPPORT_MIN = 0.7;"));
const me = L.findIndex((l, i) => i > ms && l.includes("function emsPackOnce"));
const { manualCandidate } = new Function('var num=(v,d=0)=>Number.isFinite(+v)&&v!==""?+v:d;\n' + L.slice(ms, me).join("\n") + "\nreturn { manualCandidate };")();

const H = 40; // Stueckhoehe in cm
const CT = { n: "20' HC", l: 590, w: 235, h: 270, payload: 28150 }; // Platz fuer ~6 Lagen a 40 cm

const layersOf = (placed, ti) => new Set(placed.filter((p) => ti == null || p.ti === ti).map((p) => Math.round(p.y / H))).size;
const maxLayerIdx = (placed, ti) => placed.filter((p) => ti == null || p.ti === ti).reduce((m, p) => Math.max(m, Math.round(p.y / H)), 0);

// 1) Single-Typ: "frei" stapelt so hoch wie der Container erlaubt (> 2 Lagen), stackMax=2 kappt auf 2.
test("Single-Typ: frei stapelt hoch, stackMax=2 kappt auf 2 Lagen", () => {
  const free = packCargo(CT, [{ name: "K", l: 120, w: 80, h: H, weight: 5, qty: 60, stackable: true, rotatable: true }]);
  assert.ok(layersOf(free.placed) > 2, `frei sollte > 2 Lagen stapeln, war ${layersOf(free.placed)}`);
  const capped = packCargo(CT, [{ name: "K", l: 120, w: 80, h: H, weight: 5, qty: 60, stackable: true, rotatable: true, stackMax: 2 }]);
  assert.strictEqual(layersOf(capped.placed), 2, `stackMax=2 sollte genau 2 Lagen ergeben, war ${layersOf(capped.placed)}`);
  assert.ok(capped.placed.every((p) => p.y <= (2 - 1) * H + 1e-3), "keine Kiste ueber der 2. Lage");
});

// 2) Single-Typ: stackMax=3 -> hoechstens 3 Lagen (nicht mehr).
test("Single-Typ: stackMax=3 -> max. 3 Lagen", () => {
  const r = packCargo(CT, [{ name: "K", l: 120, w: 80, h: H, weight: 5, qty: 90, stackable: true, rotatable: true, stackMax: 3 }]);
  assert.ok(maxLayerIdx(r.placed) <= 2, `hoechste Lage (0-basiert) <= 2, war ${maxLayerIdx(r.placed)}`);
});

// 3) Misch-Ladung: gekappter Typ ueberschreitet seine Obergrenze nie, freier Typ darf hoeher.
// Diese Pruefung hat frueher gefordert, dass eine gekappte Kiste NIE hoeher als Lage 2
// ueber dem Containerboden liegt. Das war die falsche Frage. "1x stapelbar" heisst, dass
// EINE Lage obendrauf darf — es sagt nichts darueber, wie hoch die Kiste selbst stehen
// darf. Ganz oben auf zwei freien Kisten traegt sie gar nichts, und nichts ist verletzt.
// Die alte Fassung hat dafuer Ladung liegenlassen, ohne dass es dafuer einen Grund an der
// Rampe gab. Gefragt ist: liegt auf einer gekappten Kiste je mehr, als sie tragen darf.
test("Misch-Ladung: auf einer gekappten Kiste liegt nie mehr, als sie tragen darf", () => {
  const CAP = 2;
  const r = packCargo(CT, [
    { name: "Capped", l: 100, w: 80, h: H, weight: 5, qty: 40, stackable: true, rotatable: true, stackMax: CAP },
    { name: "Free", l: 100, w: 80, h: H, weight: 5, qty: 40, stackable: true, rotatable: true },
  ], { intensive: true });
  // Wie viele Stuecke stehen ueber dieser Kiste in derselben Saeule?
  const darueber = (p) => r.placed.filter((q) =>
    q.y > p.y + 1e-3 &&
    Math.min(p.x + p.dx, q.x + q.dx) - Math.max(p.x, q.x) > 1e-6 &&
    Math.min(p.z + p.dz, q.z + q.dz) - Math.max(p.z, q.z) > 1e-6).length;
  for (const p of r.placed.filter((q) => q.ti === 0)) {
    const oben = darueber(p);
    assert.ok(oben <= CAP - 1,
      `gekappte Kiste bei y=${p.y} traegt ${oben} Stueck, erlaubt ist ${CAP - 1}`);
  }
  assert.ok(r.placed.some((p) => p.ti === 0), "es sollte ueberhaupt eine gekappte Kiste verladen sein");
});

// 4) Manuelles Ablegen: 3. Lage eines stackMax=2-Stuecks wird abgelehnt, "frei" erlaubt.
test("Manuell: stackMax=2 lehnt 3. Lage ab, frei erlaubt sie", () => {
  const base = { name: "K", l: 120, w: 80, h: H, weight: 5, qty: 9, rotatable: true };
  const placed = [
    { x: 0, y: 0, z: 0, dx: 120, dy: H, dz: 80, ti: 0 },
    { x: 0, y: H, z: 0, dx: 120, dy: H, dz: 80, ti: 0 },
  ];
  const capped = manualCandidate(CT, { ...base, stackable: true, stackMax: 2 }, false, 0, 0, placed, 10);
  assert.strictEqual(capped.ok, false, "gekapptes Stueck darf nicht auf die 3. Lage");
  assert.strictEqual(capped.reason, "stackmax", "Ablehnungsgrund ist die Stapel-Obergrenze");
  const free = manualCandidate(CT, { ...base, stackable: true }, false, 0, 0, placed, 10);
  assert.strictEqual(free.ok, true, "freies Stueck darf auf die 3. Lage");
  assert.ok(Math.abs(free.box.y - 2 * H) < 1e-3, "freies Stueck landet auf Hoehe 2*H");
});

console.log("pack-stackmax: alle Tests gruen");
