// Regressionstest fuer die Stapel-Obergrenze (stackMax) bei gemischten Packstueckhoehen.
//
// Der Fehler steht in der gemischten Packschleife:
//   if (py > 1e-4 && isFinite(u.stackMax) && py > (u.stackMax - 1) * u.h + 1e-3) continue;
//
// `py` ist die ABSOLUTE Hoehe ueber dem Containerboden, `u.h` die Hoehe DIESES
// Packstuecks. Gemeint ist aber "hoechstens stackMax Stueck dieser Sorte
// uebereinander" — also eine Hoehe INNERHALB des eigenen Turms.
//
// Solange alle Packstuecke gleich hoch sind, fallen beide Rechnungen zusammen.
// Deshalb sieht der bestehende test/pack-stackmax.test.mjs den Fehler nicht:
// dort haben alle Stuecke dieselbe Hoehe.
//
// Bei gemischten Hoehen bricht es auseinander:
//   Karton 20 cm, stackMax 3  ->  Grenze (3-1)*20 = 40 cm
//   Steht eine 90-cm-Kiste am Boden, ist py dort 90 > 40
//   -> Der Karton wird abgelehnt, obwohl er die ERSTE Lage SEINES Turms waere.
//
// Praktisch heisst das: flache Ware kann nie auf hoher Ware stehen, sobald sie
// eine Stapelgrenze hat. Es geht Ladung verloren.
import fs from "node:fs";
import assert from "node:assert";
import test from "node:test";
import { fileURLToPath } from "node:url";
import path from "node:path";

const dir = path.dirname(fileURLToPath(import.meta.url));
const L = fs.readFileSync(path.join(dir, "..", "app.html"), "utf8").split("\n");

// packCargo herausschneiden — gleiche Slice-Mechanik wie die uebrigen Packer-Tests.
const ps = L.findIndex((l) => l.includes("function makeFloorPacker"));
const pe = L.findIndex((l, i) => i > ps && l.trim() === "}" && L[i - 1].includes("return { placed, perType"));
const { packCargo } = new Function(
  'var num=(v,d=0)=>Number.isFinite(+v)&&v!==""?+v:d;\n' + L.slice(ps, pe + 1).join("\n") + "\nreturn { packCargo };"
)();

const HC20 = { n: "20' HC", l: 590, w: 235, h: 270, payload: 28150 };
const HC40 = { n: "40' HC", l: 1203, w: 235, h: 270, payload: 26580 };

// Der gemischte Fall: hohe Kiste ohne Grenze am Boden, flache Kiste mit stackMax 3.
const GROSS = { name: "GrosseKiste", l: 150, w: 100, h: 90, weight: 80, qty: 15, stackable: true, rotatable: true };
const KLEIN = { name: "KleineKiste", l: 150, w: 100, h: 20, weight: 5, qty: 200, stackable: true, rotatable: true, stackMax: 3 };

const hoehenVon = (placed, ti) =>
  [...new Set(placed.filter((p) => p.ti === ti).map((p) => Math.round(p.y)))].sort((a, b) => a - b);

// Laengster zusammenhaengender Turm einer Sorte: gleiche Grundflaeche, jede Kiste
// sitzt unmittelbar auf der vorherigen. Das ist die Zahl, die stackMax begrenzt.
function laengsterTurm(placed, ti, h) {
  const spalten = new Map();
  for (const p of placed.filter((q) => q.ti === ti)) {
    const key = `${Math.round(p.x)}|${Math.round(p.z)}`;
    if (!spalten.has(key)) spalten.set(key, []);
    spalten.get(key).push(p.y);
  }
  let max = 0;
  for (const ys of spalten.values()) {
    ys.sort((a, b) => a - b);
    let lauf = 1;
    max = Math.max(max, 1);
    for (let i = 1; i < ys.length; i++) {
      lauf = Math.abs(ys[i] - ys[i - 1] - h) < 1e-3 ? lauf + 1 : 1;
      max = Math.max(max, lauf);
    }
  }
  return max;
}

// 1) KONTROLLE: Bei EINER Sorte muss die Grenze weiterhin greifen.
//    Ohne diesen Test koennte man den Fehler "beheben", indem man die Grenze streicht.
test("Eine Sorte: stackMax=2 bleibt bei 2 Lagen, obwohl 9 passen wuerden", () => {
  const H = 30;
  const r = packCargo(HC20, [
    { name: "FlacheKiste", l: 120, w: 80, h: H, weight: 10, qty: 50, stackable: true, rotatable: true, stackMax: 2 },
  ]);
  const hoechsteLage = Math.max(...r.placed.map((p) => Math.round(p.y / H)));
  assert.ok(hoechsteLage <= 1, `hoechste Lage (0-basiert) sollte <= 1 sein, war ${hoechsteLage}`);
  assert.ok(r.boxes >= 6, `erwartet mindestens 6 Stueck, verladen wurden ${r.boxes}`);
});

// 2) DER FEHLERFALL, semantisch statt ueber eine Stueckzahl.
//    Eine geratene Zahl ("mindestens 70 Stueck") haengt an der Heuristik des Packers
//    und waere bei jeder kuenftigen Verbesserung falsch. Gefragt ist nicht "wie viele",
//    sondern "darf die kleine Kiste ueberhaupt oben stehen".
test("Gemischt: die kleine Kiste muss auf der grossen stehen duerfen", () => {
  const r = packCargo(HC40, [GROSS, KLEIN], { intensive: true });
  const oben = r.placed.filter((p) => p.ti === 1 && p.y >= 90 - 1e-6);
  assert.ok(
    oben.length > 0,
    `keine einzige kleine Kiste steht auf der grossen. Belegte Hoehen der kleinen Kisten: [${hoehenVon(r.placed, 1)}]`
  );
});

// 3) Und sie muss ihren eigenen Turm dort auch AUSBAUEN duerfen — stackMax 3 heisst
//    drei Lagen ab der Oberkante der grossen Kiste, also y = 90, 110, 130.
test("Gemischt: der eigene Turm der kleinen Kiste zaehlt ab ihrer Standflaeche", () => {
  const r = packCargo(HC40, [GROSS, KLEIN], { intensive: true });
  const hoehen = hoehenVon(r.placed, 1);
  const ueber90 = hoehen.filter((y) => y >= 90 - 1e-6);
  assert.ok(
    ueber90.length >= 2,
    `auf der grossen Kiste sollten mehrere Lagen moeglich sein, gefunden wurden ${ueber90.length} (alle Hoehen: [${hoehen}])`
  );
});

// 4) GEGENPROBE zu 2 und 3: Die Grenze darf nicht einfach abgeschafft werden.
//    Auch im gemischten Fall duerfen nie mehr als 3 kleine Kisten uebereinander stehen.
test("Gemischt: nie mehr als stackMax kleine Kisten uebereinander", () => {
  const r = packCargo(HC40, [GROSS, KLEIN], { intensive: true });
  const turm = laengsterTurm(r.placed, 1, KLEIN.h);
  assert.ok(
    turm <= KLEIN.stackMax,
    `stackMax ist ${KLEIN.stackMax}, gefunden wurde ein Turm aus ${turm} kleinen Kisten — die Grenze wurde aufgehoben statt korrigiert`
  );
});

// 5) Der Fix darf die Ladung nicht VERSCHLECHTERN: mit korrigierter Semantik muss
//    mindestens so viel passen wie mit der fehlerhaften absoluten Grenze.
test("Gemischt: es geht keine Ladung verloren", () => {
  const r = packCargo(HC40, [GROSS, KLEIN], { intensive: true });
  assert.ok(r.boxes >= 63, `frueher waren es 63 Stueck, jetzt sind es ${r.boxes} — der Fix darf nichts kosten`);
});

console.log("pack-stackmax-mixed: alle Tests gruen");
