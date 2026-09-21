// Der Uebernehmen-Knopf an der Kombi-Empfehlung.
//
// Gemeldet: fuer "es ginge auch mit 2x 40' HC + 1x 40' GP" gab es gar keinen
// Knopf -- nur Einzelcontainer und Equipment hatten einen -- und die drei 40er
// mussten von Hand nachgebaut werden. Die ?q=-Kette startet designgemaess beim
// gewaehlten C1; der Knopf ist der eine Handgriff von der freien Empfehlung
// zur Kette.
//
// Die Zusage: uebernehmeKombi stellt C1 auf den ersten Typ der Kombination und
// pinnt die Folgeslots per chainOverride EXAKT auf die restlichen Typen. Kein
// "C1 wechseln und hoffen, dass die Auto-Kette dieselbe Kombination findet".
//
// node --test test/kombi-uebernehmen.test.mjs
import fs from "node:fs";
import assert from "node:assert";
import test from "node:test";
import { fileURLToPath } from "node:url";
import path from "node:path";

const dir = path.dirname(fileURLToPath(import.meta.url));
const roh = fs.readFileSync(path.join(dir, "..", "app.html"), "utf8");

const schnitt = (von, bis) => {
  const a = roh.indexOf(von);
  assert.ok(a >= 0, `Anfang nicht gefunden: ${von}`);
  const b = roh.indexOf(bis, a);
  assert.ok(b > a, `Ende nicht gefunden: ${bis}`);
  return roh.slice(a, b + bis.length);
};

// Der Handgriff einzeln, mit Spionen an beiden Hebeln.
const bauen = () => {
  const rufe = [];
  const uebernehmeKombi = new Function(
    "PRESETS", "applyPreset", "setChainOverride",
    schnitt("const uebernehmeKombi = (combo) => {", "setChainOverride(ov);\n    };")
    + "\nreturn uebernehmeKombi;"
  )(
    { "40' HC": {}, "40' GP": {}, "20' GP": {} },
    (n) => rufe.push(["preset", n]),
    (ov) => rufe.push(["override", ov])
  );
  return { uebernehmeKombi, rufe };
};

test("die Kombination wird woertlich uebernommen: C1 + gepinnte Folgeslots", () => {
  const { uebernehmeKombi, rufe } = bauen();
  uebernehmeKombi([{ name: "40' HC", count: 2 }, { name: "40' GP", count: 1 }]);
  assert.deepStrictEqual(rufe, [
    ["preset", "40' HC"],
    ["override", { 1: "40' HC", 2: "40' GP" }],
  ], "erwartet: C1 -> 40' HC, Slot 1 -> 40' HC, Slot 2 -> 40' GP");
  // Ein Einzel-Eintrag mit count 1: C1 wechselt, kein Slot wird gepinnt --
  // dieselbe Wirkung wie der bestehende Einzelcontainer-Knopf.
  const b2 = bauen();
  b2.uebernehmeKombi([{ name: "20' GP", count: 1 }]);
  assert.deepStrictEqual(b2.rufe, [["preset", "20' GP"], ["override", {}]]);
});

test("Unsinn prallt ab: leere Kombi oder unbekannter Typ ruehrt nichts an", () => {
  const { uebernehmeKombi, rufe } = bauen();
  uebernehmeKombi([]);
  uebernehmeKombi(null);
  uebernehmeKombi([{ name: "Sattel 13,6 m", count: 2 }]); // kein Container-Preset
  assert.deepStrictEqual(rufe, [], "nichts davon darf den Plan anfassen");
});

test("der Vertrag im Quelltext: der Knopf haengt an der multi-Empfehlung", () => {
  assert.ok(roh.includes("uebernehmeKombi(sug.combo)"),
    "der Uebernehmen-Knopf ruft die Kombination nicht auf");
  assert.ok(roh.includes('sug.type === "multi" && sug.combo && sug.combo.length > 0 && /* @__PURE__ */ React.createElement("button"'),
    "der Knopf steht nicht an der multi-Empfehlung");
  // Beschriftet wie die anderen Uebernehmen-Knoepfe (T.apply, beide Sprachen).
  const knopf = roh.slice(roh.indexOf("uebernehmeKombi(sug.combo)"), roh.indexOf("uebernehmeKombi(sug.combo)") + 400);
  assert.ok(/T\.apply/.test(knopf), "der Knopf traegt nicht T.apply");
});
