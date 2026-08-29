// Die Zuweisung je Position: "dieses Packstueck kommt in Container 2".
//
// Schritt 05 aus dem Mehr-Container-Entwurf. Gewuenscht war: "Evtl auch einbauen, dass der
// User selbst auswaehlen kann, welche der Packstuecke in welchen Container kommen, wenn es
// mehrere gibt?"
//
// Entschieden ist "DORT ZUERST", nicht "nur dort": gemessen an der gemeldeten Sendung
// (9 flache Stuecke 250x80x30 nicht stapelbar + 22 Paletten) landen unter "nur dort"
// 2 von 9 gepinnten Stuecken im Container -- die Paletten sind schlicht frueher dran --,
// unter "dort zuerst" 8 von 9. Mehr passen auch allein nicht hinein.
//
// Drei Zusagen, und dieser Test haelt jede einzelne fest:
//   1. Ohne Zuweisung aendert sich NICHTS. slotPins liefert null, und dann laeuft jeder
//      Slot durch denselben Aufruf wie vorher.
//   2. Eine Zuweisung wird zuerst bedient -- und was danach noch passt, kommt dazu.
//   3. Geht eine Zuweisung nicht auf, bleibt das Stueck OFFEN und sagt es. Es rutscht
//      nicht heimlich in den naechsten Container.
//
// Und eine vierte, die beim Nachsehen im Browser aufgefallen ist: die Kette darf fuer ein
// gepinntes Stueck, das nie hineingeht, nicht bis MAXCHAIN weiterbauen.
//
// node --test test/zuweisung-je-position.test.mjs
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
const M = new Function(`var num=(v,d=0)=>Number.isFinite(+v)&&v!==""?+v:d;
   var applyCarrier=(p)=>p;
   ${cut("var PRESETS = {", (l) => l.includes("var panelsFor"))}
   ${cut("function makeFloorPacker", (l, i) => l.trim() === "}" && L[i - 1].includes("single: false"))}
   ${cut("var MAXCHAIN", (l, i) => l.trim() === "}" && L[i - 1].includes("return { chain, remainingBoxes"))}
   return { chainContainers, packCargo, slotPins, slotPacken, PRESETS, MAXCHAIN };`)();

const HC40 = M.PRESETS["40' HC"];
// Die gemeldete Sendung, Zeichen fuer Zeichen aus dem Teilen-Link:
// ?c=d~250x80x30w300q9snPackage~120x80x110w300q22y3nPackage
const FLACH = { name: "Flach", l: 250, w: 80, h: 30, qty: 9, weight: 300, stackable: false };
const PAL = { name: "Palette", l: 120, w: 80, h: 110, qty: 22, weight: 300, stackMax: 3 };

// Eine Kette so bauen, wie der Effekt in app.html es tut: erst der gewaehlte Container
// allein (slot0), dann die Kette darauf.
const kette = (cargo) => {
  const slot0 = M.packCargo(HC40, cargo, { noHint: true });
  const ch = M.chainContainers(HC40, "40' HC", cargo, slot0, null, M.MAXCHAIN, null);
  const je = ch.chain.map((c) => cargo.map((_, i) => c.placed.filter((b) => b.ti === i).length));
  return { ...ch, je };
};

test("ohne Zuweisung gibt es keine Zuweisung -- slotPins liefert null", () => {
  assert.strictEqual(M.slotPins([FLACH, PAL]), null);
  assert.strictEqual(M.slotPins([{ ...FLACH, slot: null }, { ...PAL, slot: null }]), null,
    "ein leeres Auswahlfeld ist keine Zuweisung");
  assert.deepStrictEqual(M.slotPins([{ ...FLACH, slot: 1 }, PAL]), [1, null],
    "eine einzige Zuweisung genuegt, damit die Kette sie beachtet");
});

test("ohne Zuweisung packt die Kette Zeichen fuer Zeichen wie vorher", () => {
  const a = kette([FLACH, PAL]);
  const b = kette([{ ...FLACH, slot: null }, { ...PAL, slot: null }]);
  assert.deepStrictEqual(b.je, a.je, "ein leeres Auswahlfeld darf nichts veraendern");
  assert.strictEqual(a.remainingBoxes, 0, "die gemeldete Sendung geht vollstaendig auf");
  assert.strictEqual(a.chain.length, 2);
});

test("die Zuweisung wird zuerst bedient -- und der Rest kommt dazu", () => {
  // "dort zuerst": 8 flache Stuecke belegen den Boden von C1, danach passen noch
  // 4 Paletten in die Restlaenge. Ohne "und der Rest dazu" waeren es 8 und sonst nichts.
  const c1 = kette([{ ...FLACH, slot: 0 }, PAL]);
  assert.strictEqual(c1.je[0][0], 8, "acht flache Stuecke stehen im zugewiesenen C1");
  assert.ok(c1.je[0][1] > 0, "was danach noch passt, kommt dazu -- sonst faehrt C1 halb leer");
  assert.strictEqual(c1.je[1][0], 0, "kein gepinntes Stueck rutscht heimlich in C2");

  // Gegenprobe "nur dort": ohne den zweiten Lauf blieben die Paletten in C1 aussen vor.
  const nur = M.packCargo(HC40, [{ ...FLACH, slot: 0 }, { ...PAL, qty: 0 }], { noHint: true });
  assert.ok(c1.je[0][0] + c1.je[0][1] > nur.boxes,
    "'dort zuerst' muss mehr in den Container bringen als 'nur dort'");
});

test("dieselbe Ware auf C2 gepinnt raeumt C1 fuer die andere Sorte", () => {
  const c2 = kette([{ ...FLACH, slot: 1 }, PAL]);
  assert.strictEqual(c2.je[0][0], 0, "nichts Gepinntes steht vor seinem Container");
  assert.ok(c2.je[0][1] >= 22, "C1 nimmt dafuer alle Paletten auf");
  assert.strictEqual(c2.je[1][0], 8, "die flachen Stuecke stehen in C2");
});

test("was die Zuweisung nicht aufnimmt, bleibt OFFEN und sagt es", () => {
  // Neun flache Stuecke passen in EINEN Container nur acht Mal -- das neunte hat keinen
  // Platz mehr, und "dort" heisst dort. Es rutscht nicht in den naechsten Container.
  const c1 = kette([{ ...FLACH, slot: 0 }, PAL]);
  assert.strictEqual(c1.remainingBoxes, 1, "genau ein Stueck bleibt offen");
  const gesamt = c1.je.reduce((s, z) => s + z[0], 0);
  assert.strictEqual(gesamt, 8, "und es taucht in keinem Container wieder auf");
});

test("fuer ein Stueck, das nie hineingeht, baut die Kette keine 24 Container", () => {
  const c1 = kette([{ ...FLACH, slot: 0 }, PAL]);
  assert.strictEqual(c1.chain.length, 2,
    "die Kette ist zu Ende, sobald nur noch gepinnte Ware fuer gebaute Container offen ist");
  assert.strictEqual(c1.gekappt, false,
    "und sie ist nicht an der Grenze abgeschnitten -- ein weiterer Container haette nichts geaendert");
});

test("gekappt unterscheidet die zwei Gruende, warum etwas offen bleibt", () => {
  // Ohne Zuweisung und ohne Grenze: alles geht auf, nichts ist gekappt.
  assert.strictEqual(kette([FLACH, PAL]).gekappt, false);
  // Und ohne Zuweisung: ein Stueck, das in KEINEN Container passt. Die Kette hat mehrere
  // Container (also zeigt die Ansicht die Pille), aber sie ist nicht an der Grenze
  // gescheitert. Vorher stand dort "2 offen \u00B7 mehr als 24 Container" -- schlicht falsch,
  // und dieser Fehler ist aelter als die Zuweisung.
  const GP20 = M.PRESETS["20' GP"];
  const cargo = [
    { name: "Palette", l: 120, w: 80, h: 110, qty: 30, weight: 300, stackMax: 1 },
    { name: "Riese", l: 1400, w: 200, h: 200, qty: 2, weight: 100, stackable: false },
  ];
  const slot0 = M.packCargo(GP20, cargo, { noHint: true });
  const g = M.chainContainers(GP20, "20' GP", cargo, slot0, null, M.MAXCHAIN, null);
  assert.ok(g.chain.length > 1, "die Kette hat mehrere Container -- die Pille wird gezeigt");
  assert.strictEqual(g.remainingBoxes, 2, "die zwei zu grossen Stuecke bleiben liegen");
  assert.strictEqual(g.gekappt, false, "aber die Kette ist nicht an MAXCHAIN gescheitert");
  assert.ok(g.chain.length < M.MAXCHAIN, "und sie hat dafuer auch keine Container gebaut");
});

test("was die Zuweisung liegen laesst, zaehlt pinOffen -- und das Banner schweigt dazu", () => {
  const c1 = kette([{ ...FLACH, slot: 0 }, PAL]);
  assert.strictEqual(c1.pinOffen, 1, "der ganze Rest geht auf das Konto der Zuweisung");
  assert.strictEqual(c1.remainingBoxes - c1.pinOffen, 0,
    "es bleibt nichts uebrig, wofuer ein weiterer Container helfen wuerde");
  // Ohne Zuweisung ist pinOffen null -- die Kette rechnet dann wie vorher.
  assert.strictEqual(kette([FLACH, PAL]).pinOffen, 0);
  // Der Vertrag: das Banner zieht pinOffen ab. Sonst stand unter einem Plan, der 1x 40' HC
  // + 1x 40' GP bucht, der Vorschlag "du brauchst ca. 1x 40' HC + 1x 40' GP" -- genau der
  // gemeldete Fehler, nur durch eine neue Tuer hereingekommen.
  assert.ok(/const offenOhnePin = Math\.max\(0, offenGesamt - \(result\.pinOffen \|\| 0\)\);/.test(roh),
    "das Banner rechnet den Rest nicht um die Zuweisung bereinigt");
  assert.ok(/const zeigeBanner = offenOhnePin > 0/.test(roh),
    "und es haengt nicht an diesem bereinigten Rest");
});

test("die Zuweisung reist im Teilen-Link mit -- in beiden Formaten", () => {
  // ?p= (base64-JSON): das Feld heisst sl und zaehlt ab 1, damit 0 nicht zu "kein Wert" wird.
  assert.ok(/sl:\s*Number\.isInteger\(c\.slot\)/.test(roh),
    "planStateFrom schreibt die Zuweisung als sl");
  assert.ok(/slot:\s*\+r\.sl >= 1/.test(roh), "decodePlanState liest sie zurueck");
  // ?c= (kompakt): der Tag S. Die Codetabelle darf nur ERGAENZT werden -- ein neu
  // vergebener alter Buchstabe machte jeden bereits geteilten Link ungueltig.
  assert.ok(/t \+= "S" \+ v2num\(r\.sl\)/.test(roh), "compactEncode kennt den Tag S");
  assert.ok(/tg === "S"/.test(roh), "compactDecode kennt den Tag S");
  for (const tag of ["S"]) {
    const treffer = roh.match(new RegExp(`tg === "${tag}"`, "g")) || [];
    assert.strictEqual(treffer.length, 1, `der Tag ${tag} darf nur einmal vergeben sein`);
  }
});

test("die Oberflaeche bietet die Zuweisung an und sagt, wenn sie nicht aufgeht", () => {
  assert.ok(/"aria-label": T\.slotLabel/.test(roh),
    "es gibt ein beschriftetes Auswahlfeld in der aufgeklappten Zeile");
  assert.ok(/upd\(c\.id, "slot", e\.target\.value === "__auto" \? null : \+e\.target\.value\)/.test(roh),
    "und 'Auto' setzt die Zuweisung wieder auf null zurueck -- nicht auf 0, das waere C1");
  for (const k of ["slotLabel", "slotAuto", "slotTitel", "slotOffen"]) {
    assert.ok(new RegExp(`\\b${k}:`).test(roh), `der Textschluessel ${k} fehlt`);
    assert.strictEqual(roh.match(new RegExp(`\\b${k}:`, "g")).length, 2,
      `${k} muss in BEIDEN Sprachen stehen (DE und EN)`);
  }
  assert.ok(/T\.slotOffen\(/.test(roh),
    "und die Zeile sagt es, wenn die Zuweisung nicht aufgeht");
});

test("der Vertrag im Quelltext: die Kette fragt die Zuweisung, und zwar ueberall", () => {
  assert.strictEqual((roh.match(/const pins = slotPins\(cargo\);/g) || []).length, 2,
    "beide Kettenfunktionen (See- und Landfracht) muessen die Zuweisung lesen");
  assert.strictEqual((roh.match(/slotPacken\(/g) || []).length >= 5, true,
    "erster Slot, Folgeslots und der Gewichtsausgleich laufen durch slotPacken");
  assert.ok(/ketteAusgleichen\(chain, cargo, ordentlich, pins\)/.test(roh),
    "auch der Gewichtsausgleich muss die Zuweisung beachten -- sonst verteilt er sie weg");
  assert.strictEqual((roh.match(/nochMoeglich\(remaining\) > 0/g) || []).length, 2,
    "die Abbruchbedingung der Kette zaehlt, was noch untergebracht werden KANN");
});
