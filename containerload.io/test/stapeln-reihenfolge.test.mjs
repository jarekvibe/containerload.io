// Stellplatz zuerst, dann in die Hoehe.
//
// Frueher fuellte der Einzeltyp-Pfad erst den ganzen Boden und danach die zweite Etage.
// Die ZAHL war in beiden Reihenfolgen dieselbe — die Kapazitaet ist Stellplaetze mal
// Etagen —, aber bei wenigen Packstuecken stand alles nebeneinander, obwohl jemand die
// Bauhoehe gerade auf zwei Etagen abgestimmt hatte.
//
// Dieser Test haelt beides fest: dass gestapelt wird, UND dass die Umstellung keine
// einzige Kiste gekostet hat. Das zweite ist das wichtigere.
import fs from "node:fs";
import assert from "node:assert";
import test from "node:test";
import { fileURLToPath } from "node:url";
import path from "node:path";

const dir = path.dirname(fileURLToPath(import.meta.url));
const L = fs.readFileSync(path.join(dir, "..", "app.html"), "utf8").split("\n");
const ps = L.findIndex((l) => l.includes("function makeFloorPacker"));
const pe = L.findIndex((l, i) => i > ps && l.trim() === "}" && L[i - 1].includes("return { placed, perType"));
const { packCargo, makeFloorPacker } = new Function(
  'var num=(v,d=0)=>Number.isFinite(+v)&&v!==""?+v:d;\n' + L.slice(ps, pe + 1).join("\n") + "\nreturn { packCargo, makeFloorPacker };"
)();

const GP20 = { l: 590, w: 235, h: 239, payload: 28200 };
const HC40 = { l: 1203, w: 235, h: 270, payload: 26580 };
const etagen = (r) => new Set(r.placed.map((p) => Math.round(p.y))).size;

test("wer stapeln darf, steht auch uebereinander", () => {
  const pal = { l: 120, w: 80, h: 119, weight: 225, qty: 2, stackable: true, rotatable: true };
  const r = packCargo(GP20, [pal]);
  assert.strictEqual(r.boxes, 2);
  assert.strictEqual(etagen(r), 2, "zwei stapelbare Paletten stehen nebeneinander statt uebereinander");
});

test("nicht stapelbar bleibt am Boden", () => {
  const pal = { l: 120, w: 80, h: 119, weight: 225, qty: 4, stackable: false, rotatable: true };
  assert.strictEqual(etagen(packCargo(GP20, [pal])), 1);
});

test("eine Stapelgrenze wird eingehalten", () => {
  const pal = { l: 120, w: 80, h: 55, weight: 100, qty: 12, stackable: true, stackMax: 2, rotatable: true };
  const r = packCargo(GP20, [pal]);
  assert.ok(etagen(r) <= 2, `${etagen(r)} Etagen trotz stackMax 2`);
});

test("die Umstellung hat keine einzige Kiste gekostet", () => {
  // Erwartung in geschlossener Form: Stellplaetze x erlaubte Etagen, gedeckelt durch Menge
  // und Zuladung. Genau das muss herauskommen — unabhaengig davon, in welcher Reihenfolge
  // gefuellt wird.
  const faelle = [];
  for (const C of [GP20, HC40]) {
    for (const [l, w, h] of [[120, 80, 119], [120, 100, 90], [60, 40, 40], [235, 120, 70], [100, 100, 100]]) {
      for (const wt of [0, 225, 900]) {
        for (const qty of [1, 2, 3, 7, 25, 200]) faelle.push({ C, t: { l, w, h, weight: wt, qty, stackable: true, rotatable: true } });
      }
    }
  }
  for (const { C, t } of faelle) {
    const spots = makeFloorPacker(t.l, t.w, true)(C.l, C.w).count;
    const lagen = Math.floor((C.h + 1e-6) / t.h);
    const nachPlatz = spots * Math.max(0, lagen);
    const nachGewicht = t.weight > 0 ? Math.floor(C.payload / t.weight) : Infinity;
    const soll = Math.min(t.qty, nachPlatz, nachGewicht);
    const r = packCargo(C, [t]);
    assert.strictEqual(r.boxes, soll, `${t.l}x${t.w}x${t.h}, ${t.weight} kg, ${t.qty} Stueck in ${C.l}er: ${r.boxes} statt ${soll}`);
  }
});

test("nichts schwebt und nichts durchdringt sich", () => {
  const r = packCargo(GP20, [{ l: 120, w: 80, h: 119, weight: 225, qty: 9, stackable: true, rotatable: true }]);
  for (const p of r.placed) {
    const traegt = Math.round(p.y) === 0 || r.placed.some((q) =>
      Math.round(q.y + q.dy) === Math.round(p.y) &&
      q.x < p.x + p.dx - 1e-6 && p.x < q.x + q.dx - 1e-6 &&
      q.z < p.z + p.dz - 1e-6 && p.z < q.z + q.dz - 1e-6);
    assert.ok(traegt, `Palette bei y=${p.y} schwebt`);
  }
  for (let i = 0; i < r.placed.length; i++) for (let j = i + 1; j < r.placed.length; j++) {
    const a = r.placed[i], b = r.placed[j];
    const sep = a.x + a.dx <= b.x + 1e-6 || b.x + b.dx <= a.x + 1e-6 ||
      a.y + a.dy <= b.y + 1e-6 || b.y + b.dy <= a.y + 1e-6 ||
      a.z + a.dz <= b.z + 1e-6 || b.z + b.dz <= a.z + 1e-6;
    assert.ok(sep, "zwei Paletten stehen ineinander");
  }
});

// --- Gemischter Pfad: Gleichstand geht an die gestapelte Loesung ------------------------
// emsSearch laeuft viele Varianten und nimmt die beste nach (Anzahl, Volumen). Sind beide
// gleich, entscheidet seit dieser Aenderung die Hoehensumme. Das kann per Konstruktion
// keinen Fuellgrad kosten — es wird nur ein Gleichstand aufgeloest, der vorher zufaellig
// zugunsten der flachen Loesung ausging.
//
// Gemessen wurde die Aenderung ueber 300 zufaellige Ladungen: verladene Kisten und
// belegtes Volumen blieben auf die dritte Nachkommastelle identisch, die Zahl der
// Ladungen mit mehr als einer Etage stieg von 187 auf 295.

test("wenige stapelbare Packstuecke stehen auch im gemischten Pfad uebereinander", () => {
  const P = { l: 120, w: 80, h: 110, weight: 300, qty: 1, stackable: true, rotatable: true };
  const pal = { l: 120, w: 80, h: 119, weight: 225, qty: 2, stackable: true, rotatable: true };
  const r = packCargo(GP20, [P, pal]);
  assert.strictEqual(r.boxes, 3);
  assert.strictEqual(etagen(r), 2, "drei stapelbare Packstuecke bleiben flach am Boden");
});

test("die vollstaendige Suche bleibt nie hinter einem Schnelldurchlauf zurueck", () => {
  // Wache gegen genau den Fehler, den man sich mit einem zusaetzlichen Kriterium einhandelt:
  // dass die Suche am Ende eine SCHLECHTERE Loesung waehlt. Der Schnelldurchlauf (ohne
  // Neustarts) ist die Untergrenze — die volle Suche muss sie immer erreichen.
  let seed = 4711;
  const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  for (let i = 0; i < 20; i++) {
    const C = i % 2 ? HC40 : GP20;
    const types = [];
    for (let k = 0; k < 2 + Math.floor(rnd() * 3); k++) types.push({
      l: 30 + Math.floor(rnd() * 9) * 10, w: 30 + Math.floor(rnd() * 7) * 10, h: 20 + Math.floor(rnd() * 10) * 10,
      weight: Math.floor(rnd() * 300), qty: 1 + Math.floor(rnd() * 12),
      stackable: rnd() > 0.2, rotatable: rnd() > 0.25
    });
    const voll = packCargo(C, types).boxes;
    const schnell = packCargo(C, types, { quick: true }).boxes;
    assert.ok(voll >= schnell, `Fall ${i}: volle Suche ${voll} < Schnelldurchlauf ${schnell}`);
  }
});

test("gestapelte Mischladung schwebt nicht und durchdringt sich nicht", () => {
  const r = packCargo(GP20, [
    { l: 120, w: 80, h: 119, weight: 225, qty: 5, stackable: true, rotatable: true },
    { l: 100, w: 60, h: 60, weight: 90, qty: 6, stackable: true, rotatable: true }
  ]);
  for (const p of r.placed) {
    const traegt = Math.round(p.y) === 0 || r.placed.some((q) =>
      Math.round(q.y + q.dy) === Math.round(p.y) &&
      q.x < p.x + p.dx - 1e-6 && p.x < q.x + q.dx - 1e-6 &&
      q.z < p.z + p.dz - 1e-6 && p.z < q.z + q.dz - 1e-6);
    assert.ok(traegt, `Packstueck bei y=${p.y} schwebt`);
  }
  for (let i = 0; i < r.placed.length; i++) for (let j = i + 1; j < r.placed.length; j++) {
    const a = r.placed[i], b = r.placed[j];
    const sep = a.x + a.dx <= b.x + 1e-6 || b.x + b.dx <= a.x + 1e-6 ||
      a.y + a.dy <= b.y + 1e-6 || b.y + b.dy <= a.y + 1e-6 ||
      a.z + a.dz <= b.z + 1e-6 || b.z + b.dz <= a.z + 1e-6;
    assert.ok(sep, "zwei Packstuecke stehen ineinander");
  }
});
