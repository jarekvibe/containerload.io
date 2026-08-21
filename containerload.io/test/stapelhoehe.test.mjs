// "Stapelbar bis 180 cm" — die zweite Stapelgrenze, in Zentimetern statt in Lagen.
//
// Gemeldet als Fehler ("das Tool macht vier Lagen, obwohl ich nur 2x stapelbar gewaehlt
// habe"), war es keiner: das Stueck mit "2x stapelbar" stand auf Lage 2 und trug zwei —
// genau das, was die Angabe bedeutet. Der Fehler lag eine Ebene darueber, in der
// UEBERSETZUNG der Vorgabe. Der Partner hatte "stapelbar bis 180 cm" geschrieben; daraus
// wurden Lagenzahlen gerechnet (unter 45 cm gehen vier, darueber drei), und diese Naeherung
// laesst sich nicht zusammensetzen: eine flache Palette unten plus drei hohe darauf haelt
// jede Einzelgrenze ein und ist trotzdem 183 cm hoch.
//
// Deshalb kann die Grenze jetzt direkt in Zentimetern stehen. Gemessen ab dem
// Containerboden — so, wie die Angabe in der Anfrage gemeint ist.
//
// node --test test/stapelhoehe.test.mjs
import fs from "node:fs";
import assert from "node:assert";
import test from "node:test";
import { fileURLToPath } from "node:url";
import path from "node:path";

const dir = path.dirname(fileURLToPath(import.meta.url));
const roh = fs.readFileSync(path.join(dir, "..", "app.html"), "utf8");
const L = roh.split("\n");
const ps = L.findIndex((l) => l.includes("function makeFloorPacker"));
const pe = L.findIndex((l, i) => i > ps && l.trim() === "}" && L[i - 1].includes("return { placed, perType"));
const pS = L.findIndex((l) => l.includes("var PRESETS = {"));
const pE = L.findIndex((l, i) => i > pS && l.includes("var panelsFor"));
const { packCargo, PRESETS, stackHOf, stackModeOf } = new Function(
  'var num=(v,d=0)=>Number.isFinite(+v)&&v!==""?+v:d;\n'
  + L.slice(pS, pE + 1).join("\n") + "\n" + L.slice(ps, pe + 1).join("\n")
  + "\nreturn { packCargo, PRESETS, stackHOf, stackModeOf };"
)();

// Hoechste Oberkante je Saeule (x/z-Stelle)
const saeulenHoehen = (placed) => {
  const m = new Map();
  for (const p of placed) {
    const k = Math.round(p.x) + "|" + Math.round(p.z);
    m.set(k, Math.max(m.get(k) || 0, p.y + p.dy));
  }
  return [...m.values()];
};
const pal = (h, extra) => ({ name: "P" + h, l: 325, w: 218, h, weight: 100, qty: 1, stackable: true, stackMax: Infinity, rotatable: true, ...extra });

test("ohne Angabe bleibt alles, wie es war", () => {
  assert.strictEqual(stackHOf({}), Infinity);
  assert.strictEqual(stackHOf({ stackH: null }), Infinity);
  assert.strictEqual(stackHOf({ stackH: 0 }), Infinity);
  assert.strictEqual(stackHOf({ stackH: 180 }), 180);
});

test("der Auswahlwert kennt die Betriebsart", () => {
  assert.strictEqual(stackModeOf({ stackable: true, stackMax: Infinity, stackH: 180 }), "h");
  assert.strictEqual(stackModeOf({ stackable: true, stackMax: Infinity }), "free");
  assert.strictEqual(stackModeOf({ stackable: true, stackMax: 3 }), "x2");
  // "nicht stapelbar" gewinnt: das Stueck darf auf nichts stehen, eine Hoehengrenze
  // waere daneben bedeutungslos.
  assert.strictEqual(stackModeOf({ stackable: false, stackH: 180 }), "no");
});

test("EIN Typ: die Grenze deckelt die Lagen, nicht der Container", () => {
  // 45 cm hoch, 40' HC ist innen 270 cm: ohne Grenze sechs Lagen, mit 180 cm vier.
  const ohne = packCargo(PRESETS["40' HC"], [pal(45, { qty: 30 })], {}, false);
  const mit = packCargo(PRESETS["40' HC"], [pal(45, { qty: 30, stackH: 180 })], {}, false);
  assert.strictEqual(Math.max(...saeulenHoehen(ohne.placed)), 270, "ohne Grenze fuellt der Packer die Hoehe aus");
  assert.strictEqual(Math.max(...saeulenHoehen(mit.placed)), 180, "mit 180 cm darf keine Saeule hoeher werden");
  assert.ok(mit.boxes < ohne.boxes, "die Grenze muss sich auf die Menge auswirken");
});

test("gemischte Hoehen: keine Saeule ueber der Grenze", () => {
  for (const grenze of [100, 140, 180, 220]) {
    const ladung = [42, 47, 47, 47, 42, 47, 47, 47, 42, 47, 47, 47].map((h) => pal(h, { stackH: grenze }));
    const r = packCargo(PRESETS["40' HC"], ladung, {}, false);
    const hoch = saeulenHoehen(r.placed).filter((h) => h > grenze + 1e-6);
    assert.deepStrictEqual(hoch, [], `Grenze ${grenze} cm: Saeule(n) mit ${hoch.join(", ")} cm`);
  }
});

test("der Fall, an dem die Lagenzahl scheitert", () => {
  // 42 + 47 + 47 + 47 = 183 cm. Mit Lagengrenzen allein (die flache traegt 4, die hohen
  // je 3) ist jede Einzelgrenze eingehalten — und der Stapel trotzdem zu hoch.
  const ladung = [
    { name: "flach", l: 325, w: 218, h: 42, weight: 100, qty: 1, stackable: true, stackMax: 4, rotatable: true },
    { name: "hoch", l: 325, w: 218, h: 47, weight: 100, qty: 3, stackable: true, stackMax: 3, rotatable: true }
  ];
  const ohne = packCargo(PRESETS["20' GP"], ladung, {}, false);
  assert.strictEqual(Math.max(...saeulenHoehen(ohne.placed)), 183,
    "Gegenprobe: mit Lagengrenzen allein entsteht genau dieser 183-cm-Stapel");
  const mit = packCargo(PRESETS["20' GP"], ladung.map((c) => ({ ...c, stackH: 180 })), {}, false);
  const hoch = saeulenHoehen(mit.placed).filter((h) => h > 180 + 1e-6);
  assert.deepStrictEqual(hoch, [], `mit 180 cm darf das nicht mehr passieren: ${hoch.join(", ")} cm`);
});

test("die Grenze wuergt die Ladung nicht ab", () => {
  // 180 cm bei 45 cm Bauhoehe sind genau vier Lagen — die muessen auch gefunden werden.
  const r = packCargo(PRESETS["20' GP"], [pal(45, { qty: 10, stackH: 180 })], {}, false);
  assert.strictEqual(r.boxes, 4, `erwartet 4 Paletten (1 Stellplatz x 4 Lagen), verladen wurden ${r.boxes}`);
});

test("beide Grenzen gelten nebeneinander, die schaerfere gewinnt", () => {
  const r = packCargo(PRESETS["40' HC"], [pal(45, { qty: 30, stackMax: 2, stackH: 180 })], {}, false);
  assert.strictEqual(Math.max(...saeulenHoehen(r.placed)), 90, "stackMax 2 ist hier schaerfer als 180 cm");
  const r2 = packCargo(PRESETS["40' HC"], [pal(45, { qty: 30, stackMax: 5, stackH: 140 })], {}, false);
  assert.strictEqual(Math.max(...saeulenHoehen(r2.placed)), 135, "140 cm ist hier schaerfer als 5 Lagen");
});
