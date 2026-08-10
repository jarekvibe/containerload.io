// Regressionstest: Von Hand ablegen und automatisch packen muessen dieselbe
// Stapelgrenze meinen.
//
// Vorgeschichte: Die Grenze wurde an ZWEI Stellen geprueft, mit derselben falschen
// Rechnung -- absolute Hoehe ueber dem Containerboden statt Lagen im eigenen Turm:
//
//   emsPackOnce     py > (u.stackMax - 1) * u.h      (Auto-Packer)
//   manualCandidate y  > (cap - 1) * h               (Ziehen von Hand)
//
// Der Auto-Packer wurde korrigiert, das Ablegen von Hand zunaechst nicht. Damit
// entstand ein sichtbarer Widerspruch: Der Packer stellte einen flachen Karton auf
// eine hohe Palette, aber wer denselben Karton mit der Maus dorthin zog, bekam eine
// Ablehnung. Dieselbe Ladung, zwei Antworten.
//
// Dieser Test haelt beide Wege zusammen. Er ist bewusst nicht nur ein Test FUER die
// Handablage, sondern einer fuer die UEBEREINSTIMMUNG - denn kaputtgehen kann
// kuenftig jede der beiden Seiten.
import fs from "node:fs";
import assert from "node:assert";
import test from "node:test";
import { fileURLToPath } from "node:url";
import path from "node:path";

const dir = path.dirname(fileURLToPath(import.meta.url));
const L = fs.readFileSync(path.join(dir, "..", "app.html"), "utf8").split("\n");

// packCargo (Auto-Packer)
const ps = L.findIndex((l) => l.includes("function makeFloorPacker"));
const pe = L.findIndex((l, i) => i > ps && l.trim() === "}" && L[i - 1].includes("return { placed, perType"));
const { packCargo } = new Function(
  'var num=(v,d=0)=>Number.isFinite(+v)&&v!==""?+v:d;\n' + L.slice(ps, pe + 1).join("\n") + "\nreturn { packCargo };"
)();

// manualCandidate (Handablage) -- gleiche Slice-Mechanik wie test/pack-stackmax.test.mjs
const ms = L.findIndex((l) => l.includes("var SUPPORT_MIN = 0.7;"));
const me = L.findIndex((l, i) => i > ms && l.includes("function emsPackOnce"));
const { manualCandidate } = new Function(
  'var num=(v,d=0)=>Number.isFinite(+v)&&v!==""?+v:d;\n' + L.slice(ms, me).join("\n") + "\nreturn { manualCandidate };"
)();

const HC40 = { n: "40' HC", l: 1203, w: 235, h: 270, payload: 26580 };
const GROSS = { name: "GrosseKiste", l: 150, w: 100, h: 90, weight: 80, qty: 15, stackable: true, rotatable: true };
const KLEIN = { name: "KleineKiste", l: 150, w: 100, h: 20, weight: 5, qty: 200, stackable: true, rotatable: true, stackMax: 3 };

// 1) DER FEHLERFALL: Eine flache Kiste muss von Hand auf eine hohe gestellt werden duerfen.
test("Von Hand: flache Kiste darf auf eine hohe Kiste, die Grenze zaehlt ab dort", () => {
  const unten = [{ x: 0, y: 0, z: 0, dx: 150, dy: 90, dz: 100, ti: 0 }];
  const c = manualCandidate(HC40, KLEIN, false, 0, 0, unten, 0);
  assert.strictEqual(
    c.ok, true,
    `abgelehnt mit Grund "${c.reason}" - der Karton waere die erste Lage seines eigenen Turms`
  );
  assert.ok(Math.abs(c.box.y - 90) < 1e-3, `sollte auf der hohen Kiste landen (y=90), war y=${c.box && c.box.y}`);
});

// 2) GEGENPROBE: Die Grenze muss weiter greifen - drei flache Kisten, die vierte nicht mehr.
test("Von Hand: die vierte Lage ueber stackMax 3 wird abgelehnt", () => {
  const unten = [
    { x: 0, y: 0, z: 0, dx: 150, dy: 90, dz: 100, ti: 0 },
    { x: 0, y: 90, z: 0, dx: 150, dy: 20, dz: 100, ti: 1 },
    { x: 0, y: 110, z: 0, dx: 150, dy: 20, dz: 100, ti: 1 },
    { x: 0, y: 130, z: 0, dx: 150, dy: 20, dz: 100, ti: 1 },
  ];
  const c = manualCandidate(HC40, KLEIN, false, 0, 0, unten, 0);
  assert.strictEqual(c.ok, false, "die vierte Lage des eigenen Turms darf nicht mehr passen");
  assert.strictEqual(c.reason, "stackmax", `Ablehnungsgrund sollte die Stapelgrenze sein, war "${c.reason}"`);
});

// 3) GEGENPROBE: Ein Turm aus gleich hohen Kisten wird weiterhin bei stackMax gekappt,
//    auch wenn er direkt am Boden beginnt.
test("Von Hand: gleich hohe Kisten werden weiterhin gekappt", () => {
  const unten = [
    { x: 0, y: 0, z: 0, dx: 150, dy: 20, dz: 100, ti: 1 },
    { x: 0, y: 20, z: 0, dx: 150, dy: 20, dz: 100, ti: 1 },
    { x: 0, y: 40, z: 0, dx: 150, dy: 20, dz: 100, ti: 1 },
  ];
  const c = manualCandidate(HC40, KLEIN, false, 0, 0, unten, 0);
  assert.strictEqual(c.ok, false, "vier gleich hohe Kisten uebereinander bei stackMax 3");
  assert.strictEqual(c.reason, "stackmax", `Grund sollte die Stapelgrenze sein, war "${c.reason}"`);
});

// 4) DIE EIGENTLICHE INVARIANTE: Was der Auto-Packer abstellt, darf die Hand nicht ablehnen.
test("Auto und Hand stimmen ueberein: keine automatisch gesetzte Kiste wird von Hand abgelehnt", () => {
  const r = packCargo(HC40, [GROSS, KLEIN], { intensive: true });
  const erhoeht = r.placed.filter((p) => p.ti === 1 && p.y > 1e-4);
  assert.ok(erhoeht.length > 0, "der Auto-Packer sollte kleine Kisten erhoeht abgestellt haben");

  for (const p of erhoeht.slice(0, 25)) {
    // Alles, was zum Zeitpunkt dieser Kiste schon stand: alle Stuecke unter ihrer Oberkante.
    const darunter = r.placed.filter((q) => q !== p && q.y + q.dy <= p.y + 1e-3);
    const gedreht = Math.abs(p.dx - num(KLEIN.w)) < 1e-3 && Math.abs(p.dz - num(KLEIN.l)) < 1e-3;
    const c = manualCandidate(HC40, KLEIN, gedreht, p.x, p.z, darunter, 0);
    assert.notStrictEqual(
      c.reason, "stackmax",
      `der Auto-Packer stellt hier eine Kiste ab (x=${p.x} y=${p.y} z=${p.z}), von Hand wird dieselbe Stelle mit "stackmax" abgelehnt`
    );
  }
});

function num(v, d = 0) { return Number.isFinite(+v) && v !== "" ? +v : d; }

console.log("stackmax-manuell: alle Tests gruen");
