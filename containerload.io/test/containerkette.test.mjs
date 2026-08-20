// Wie viele Container brauche ich? — Die Kette muss weit genug rechnen, um das zu sagen.
//
// Gemeldet: 39 Paletten eingegeben, im Bild vier Huellen, darunter "15 offen · weitere
// Container noetig". Wie viele weitere, stand nirgends. Es sind sieben.
//
// Ursache war eine einzige Grenze fuer zwei verschiedene Fragen. "Wie viele Container
// brauche ich" beantwortet man mit einer Zahl, "wie steht die Ladung" mit einem Bild —
// und ein Bild mit zwanzig Huellen nebeneinander sagt nichts mehr. Deshalb jetzt zwei
// Grenzen: MAXCHAIN wird gerechnet, MAXDRAW gezeichnet.
//
// node --test test/containerkette.test.mjs
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
const { chainContainers, packCargo, PRESETS, MAXCHAIN, MAXDRAW } = new Function(
  `var num=(v,d=0)=>Number.isFinite(+v)&&v!==""?+v:d;
   var applyCarrier=(p)=>p;
   ${cut("var PRESETS = {", (l) => l.includes("var panelsFor"))}
   ${cut("function makeFloorPacker", (l, i) => l.trim() === "}" && L[i - 1].includes("single: false"))}
   ${cut("var MAXCHAIN", (l, i) => l.trim() === "}" && L[i - 1].includes("return { chain, remainingBoxes"))}
   return { chainContainers, packCargo, PRESETS, MAXCHAIN, MAXDRAW };`
)();

test("gerechnet wird weiter, als gezeichnet wird", () => {
  assert.ok(MAXCHAIN > MAXDRAW, `MAXCHAIN ${MAXCHAIN} muss groesser sein als MAXDRAW ${MAXDRAW}`);
  assert.ok(MAXDRAW >= 6, `MAXDRAW ${MAXDRAW}: darunter bleibt schon eine gewoehnliche Sendung unvollstaendig`);
  assert.ok(MAXCHAIN >= 16, `MAXCHAIN ${MAXCHAIN}: darunter kann die Kette bei mittelgrossen Sendungen nicht zu Ende rechnen`);
});

// Die Sendung aus der Meldung: 39 Paletten 325 x 218, Hoehen 41 bis 52 cm, je "1x stapelbar".
const HOEHEN = [44, 43, 44, 44, 43, 43, 52, 51, 50, 43, 43, 43, 42, 44, 44, 44, 42, 41, 44, 44,
                44, 43, 49, 47, 47, 47, 48, 48, 48, 48, 48, 48, 46, 46, 46, 46, 49, 49, 49];
const LADUNG = HOEHEN.map((h, i) => ({
  name: "Palette " + (i + 1), l: 325, w: 218, h, weight: 2000,
  qty: 1, stackable: true, stackMax: 2, rotatable: true
}));

const kette = (presetName) => {
  const C = PRESETS[presetName];
  const slot0 = packCargo(C, LADUNG, { noHint: true }, false);
  return chainContainers(C, presetName, LADUNG, slot0, null, MAXCHAIN, "");
};

test("39 Paletten: die Kette rechnet bis zum Ende durch", () => {
  const ch = kette("40' HC");
  assert.strictEqual(ch.remainingBoxes, 0,
    `nach ${ch.chain.length} Containern sind noch ${ch.remainingBoxes} Paletten offen — die Kette bricht zu frueh ab`);
  assert.strictEqual(ch.chain.length, 7, `erwartet 7 Container, gerechnet wurden ${ch.chain.length}`);
  const drin = ch.chain.reduce((s, c) => s + c.placed.length, 0);
  assert.strictEqual(drin, LADUNG.length, "verstaut + offen muss die eingegebene Menge ergeben");
});

test("die Kette bleibt bei jedem Starttyp vollstaendig", () => {
  for (const name of ["40' GP", "40' HC", "45' HC"]) {
    const ch = kette(name);
    assert.strictEqual(ch.remainingBoxes, 0, `${name}: noch ${ch.remainingBoxes} offen nach ${ch.chain.length} Containern`);
    assert.ok(ch.chain.length <= MAXCHAIN, `${name}: ${ch.chain.length} Container ueber der Grenze`);
  }
});

test("bei einer Sendung, die auch 24 Container sprengt, sagt die Kette das ehrlich", () => {
  const riesig = [{ name: "Kiste", l: 230, w: 180, h: 200, weight: 900, qty: 600, stackable: false, rotatable: true }];
  const C = PRESETS["20' GP"];
  const slot0 = packCargo(C, riesig, { noHint: true }, false);
  const ch = chainContainers(C, "20' GP", riesig, slot0, null, MAXCHAIN, "");
  assert.strictEqual(ch.chain.length, MAXCHAIN, "die Kette muss bis zur Grenze rechnen");
  assert.ok(ch.remainingBoxes > 0, "und melden, dass danach noch etwas offen ist");
});

test("beide Sprachen kennen die neuen Texte", () => {
  for (const k of ["chainN", "chainNRoad", "chainMore", "openMore"]) {
    const treffer = roh.split(k + ":").length - 1;
    assert.strictEqual(treffer, 2, `${k}: ${treffer} Eintraege statt je einem in DE und EN`);
  }
});
