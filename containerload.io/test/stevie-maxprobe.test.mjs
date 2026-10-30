// Stevies Maximal-Rechnung und der Container-Hinweis (Bug-Liste vom 30.10.26).
//
// Bug 1, gemeldet: Yang Ming 20' GP, 8 Paletten 120x80x110 (frei stapelbar). Frage an Stevie:
// „Wie viele passen maximal, wenn sie nicht stapelbar sind?" — Antwort: 22. Das sind 11 x 2
// Lagen, also gestapelt: die Rechnung nahm die Stapel-Einstellung der Position statt der
// Bedingung aus der Frage. Richtig ist 11 (bodengestellt, wie in den Speditionstabellen und
// auf der Startseite). maxProbe rechnet jetzt mit Annahmen, die NUR fuer diese Rechnung
// gelten — auf einer Kopie, der Plan bleibt unberuehrt.
//
// Bug 5, gemeldet: unter einem gewaehlten 20' GP stand „Es ginge auch mit 1x 20' GP —
// weniger Equipment". Die Kette rechnete mit der Reederei-Geometrie (Yang Ming: 589,6 x
// 235,2 x 239,3 cm), die Empfehlung mit dem Standard (590 x 235 x 239) — derselbe Typ wirkte
// 0,05 m³ kleiner. empfSpart vergleicht jetzt ueber den Container-TYP.
//
// node --test test/stevie-maxprobe.test.mjs
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
const { maxProbe, empfSpart, packCargo, suggestContainer, applyCarrier, PRESETS, MAXPROBE_DECKEL } = new Function(
  `var num=(v,d=0)=>Number.isFinite(+v)&&v!==""?+v:d;
   ${cut("var PRESETS = {", (l) => l.includes("var panelsFor"))}
   ${cut("function makeFloorPacker", (l, i) => l.trim() === "}" && L[i - 1].includes("single: false"))}
   ${cut("function suggestEquipment", (l, i) => l.trim() === "}" && L[i - 1].includes("combo };"))}
   return { maxProbe, empfSpart, packCargo, suggestContainer, applyCarrier, PRESETS, MAXPROBE_DECKEL };`
)();

// Die Europalette aus der Meldung: 8 Stueck, 120 x 80 x 110 cm, 300 kg, frei stapelbar.
const EUR = () => ({ name: "Package", l: 120, w: 80, h: 110, weight: 300, qty: 8, stackable: true, stackMax: Infinity, stackH: null, rotatable: true });
const gp20 = PRESETS["20' GP"], gp40 = PRESETS["40' GP"];

// ── Bug 1: die Bedingung aus der Frage zaehlt, nicht die Einstellung der Position ──────

test("20' GP: nicht stapelbar = 11, stapelbar = 22", () => {
  assert.strictEqual(maxProbe(gp20, EUR(), { stapeln: "nein" }).anzahl, 11, "bodengestellt passen 11 (Speditionstabelle)");
  assert.strictEqual(maxProbe(gp20, EUR(), { stapeln: "frei" }).anzahl, 22, "zwei Lagen: 22");
  assert.strictEqual(maxProbe(gp20, EUR(), {}).anzahl, 22, "ohne Bedingung gilt die Position (frei stapelbar)");
});

test("40' GP: nicht stapelbar = 25", () => {
  assert.strictEqual(maxProbe(gp40, EUR(), { stapeln: "nein" }).anzahl, 25);
});

test("der gemeldete Fall: Yang Ming 20' GP rechnet dieselben Zahlen", () => {
  const ym = applyCarrier(gp20, "Yang Ming", "20' GP");
  assert.notStrictEqual(ym.l, gp20.l, "ohne Reederei-Geometrie testete das nichts");
  assert.strictEqual(maxProbe(ym, EUR(), { stapeln: "nein" }).anzahl, 11);
  assert.strictEqual(maxProbe(ym, EUR(), { stapeln: "frei" }).anzahl, 22);
});

test("die Bedingung schlaegt die Einstellung — in beide Richtungen", () => {
  const nichtStapelbar = { ...EUR(), stackable: false, stackMax: 1 };
  assert.strictEqual(maxProbe(gp20, nichtStapelbar, {}).anzahl, 11, "ohne Bedingung: wie die Position");
  assert.strictEqual(maxProbe(gp20, nichtStapelbar, { stapeln: "frei" }).anzahl, 22, "„wenn sie stapelbar sind\" gilt auch gegen die Einstellung");
  const einmal = { ...EUR(), stackMax: 2 };
  assert.strictEqual(maxProbe(gp20, einmal, { stapeln: "nein" }).anzahl, 11);
});

test("der Plan bleibt unberuehrt", () => {
  const p = EUR();
  const vorher = JSON.stringify(p);
  maxProbe(gp20, p, { stapeln: "nein", drehen: false });
  assert.strictEqual(JSON.stringify(p), vorher, "maxProbe hat die Position veraendert");
  assert.strictEqual(p.qty, 8, "die Menge im Plan ist nicht mehr 8");
});

test("Drehen und Hoehengrenze sind eigene Bedingungen", () => {
  // 11 gibt es nur mit Drehen (8 laengs + 3 quer); ohne Drehen sind es 8.
  assert.strictEqual(maxProbe(gp20, EUR(), { stapeln: "nein", drehen: false }).anzahl, 8);
  assert.strictEqual(maxProbe(gp20, { ...EUR(), rotatable: false }, { stapeln: "nein", drehen: true }).anzahl, 11);
  // 2 x 110 = 220 cm: bis 200 cm geht nur eine Lage, bis 230 cm zwei.
  assert.strictEqual(maxProbe(gp20, EUR(), { stapeln: "bis_hoehe", bis_cm: 200 }).anzahl, 11);
  assert.strictEqual(maxProbe(gp20, EUR(), { stapeln: "bis_hoehe", bis_cm: 230 }).anzahl, 22);
});

test("die Rechnung meldet die Regeln, mit denen sie wirklich gerechnet hat", () => {
  // Nur diese Regeln darf Stevie nennen — der Ergebnissatz der App baut auf ihnen auf.
  const a = maxProbe(gp20, EUR(), { stapeln: "nein" });
  assert.deepStrictEqual({ stapeln: a.stapeln, drehen: a.drehen }, { stapeln: "nein", drehen: true });
  const b = maxProbe(gp20, EUR(), { stapeln: "bis_hoehe", bis_cm: 180, drehen: false });
  assert.deepStrictEqual({ stapeln: b.stapeln, bis_cm: b.bis_cm, drehen: b.drehen }, { stapeln: "bis_hoehe", bis_cm: 180, drehen: false });
  const c = maxProbe(gp20, { ...EUR(), stackMax: 3 }, {});
  assert.deepStrictEqual({ stapeln: c.stapeln, lagen: c.lagen }, { stapeln: "lagen", lagen: 3 });
  const d = maxProbe(gp20, { name: "Wuerfel", l: 10, w: 10, h: 10, weight: 1, qty: 1 }, {});
  assert.ok(d.deckel && d.anzahl >= MAXPROBE_DECKEL, "der Deckel muss als Deckel gemeldet werden, nicht als Zahl");
});

// ── Bug 5: der Container-Hinweis vergleicht Typen, nicht Millimeter ────────────────

const vol = (p) => p.l * p.w * p.h;

test("ein gewaehlter Reederei-20'-GP bekommt keinen „1x 20' GP\"-Hinweis", () => {
  const ym = applyCarrier(gp20, "Yang Ming", "20' GP");
  assert.ok(vol(ym) > vol(gp20), "die Reederei-Geometrie ist groesser — genau das loeste den Fehler aus");
  const cargo = [EUR()];
  assert.strictEqual(packCargo(ym, cargo).boxes, 8, "alles passt in den gewaehlten 20' GP");
  const sug = suggestContainer(cargo, "Yang Ming");
  assert.ok(sug && sug.type === "single" && sug.name === "20' GP", `die Empfehlung ist ${JSON.stringify(sug && (sug.name || sug.type))}`);
  assert.strictEqual(empfSpart([{ typ: "20' GP", geoVol: vol(ym) }], [sug.name]), false,
    "derselbe Typ darf nie als „weniger Equipment\" erscheinen");
});

test("echte Einsparungen bleiben ein Angebot", () => {
  assert.strictEqual(empfSpart([{ typ: "40' GP", geoVol: vol(gp40) }], ["20' GP"]), true, "kleinerer Typ");
  assert.strictEqual(empfSpart([{ typ: "40' HC" }, { typ: "40' HC" }], ["45' HC"]), true, "weniger Container");
  assert.strictEqual(empfSpart([{ typ: "20' GP" }, { typ: "40' GP" }], ["40' GP", "20' GP"]), false, "dieselbe Kombination in anderer Reihenfolge");
  assert.strictEqual(empfSpart([{ typ: "40' GP" }], ["40' HC"]), false, "ein groesserer Typ spart nichts");
  // Eigene Masse haben keinen Typ: dort zaehlt die Geometrie.
  assert.strictEqual(empfSpart([{ typ: "Custom", geoVol: 2 * vol(gp40) }], ["40' GP"]), true);
  assert.strictEqual(empfSpart([], ["20' GP"]), false);
});

test("die App fragt empfSpart — und benennt die Kette ueber ihre Typen", () => {
  assert.ok(/empfBesser = !!\(planFit && ketteKosten && sugKosten && sugLabel && !stoppWerte\(cargo\)\s*&& empfSpart\(ketteKosten, sugKosten\)\);/.test(roh),
    "empfBesser haengt nicht an empfSpart");
  assert.ok(roh.includes("result.chain.map((c, ci) => ({ typ: c.name || (ci === 0 ? preset : \"\"), geoVol:"),
    "die Kette reicht ihre Container-Typen nicht weiter");
});
