// Vier kleine Stellen, an denen die Oberflaeche ihre eigenen Regeln brach.
//
// Aus einer UI-Durchsicht (Oktober 2026). Jede fuer sich harmlos, zusammen der Grund,
// warum der Rechner an diesen Stellen mehrdeutig wirkte:
//   - fuenf gruene Pillen "2/2 . 3/3 . 4/4" wiederholten "Alles verladen" -- und "2/2"
//     direkt hinter dem Namen las sich wie "Position 2 von 2";
//   - der Sicherungs-Hinweis trug einen VOLL orangen Knopf (lauter als "Teilen"), waehrend
//     dieselbe Handlung in der Seitenleiste "quiet" war und wie eine Beschriftung aussah;
//   - der Drehen-Umschalter hiess in beiden Zustaenden "↻ 90\xB0";
//   - das Tuermass stand als "234" gross und "\xD7257.7" klein -- mit Punkt in der deutschen
//     Oberflaeche und ohne Einheit.
//
// node --test test/oberflaeche-klarheit.test.mjs
import fs from "node:fs";
import assert from "node:assert";
import test from "node:test";
import { fileURLToPath } from "node:url";
import path from "node:path";

const dir = path.dirname(fileURLToPath(import.meta.url));
const roh = fs.readFileSync(path.join(dir, "..", "app.html"), "utf8");
const zweimal = (k) => {
  const n = (roh.match(new RegExp(`\\b${k}: `, "g")) || []).length;
  assert.strictEqual(n, 2, `${k} steht ${n}x in den Woerterbuechern, erwartet 2 (DE und EN)`);
};

test("die Mengen-Pille spricht nur, wenn etwas offen bleibt", () => {
  assert.ok(roh.includes("pt && !done && pt.total > 0 && /* @__PURE__ */ React.createElement(\"span\""),
    "die Pille steht wieder auch bei vollstaendig verladenen Positionen");
  // Kein Gruen mehr an der Pille: wenn sie erscheint, ist es eine Warnung.
  assert.ok(!roh.includes("background: hexA(done ? C.good : C.warn, 0.14), color: done ? C.good : C.warn"),
    "die gruene Variante der Pille ist zurueck");
  // Mit Fokus zaehlt die Pille diesen Container -- "noch nicht verladen" waere dann falsch.
  assert.ok(roh.includes("title: fokusSlot ? void 0 : T.pilleOffen(pt.total - pt.loaded)"),
    "der title der Pille behauptet auch im Fokus 'noch nicht verladen'");
  zweimal("pilleOffen");
});

test("der Sicherungs-Hinweis ist getoent, nicht voll orange", () => {
  assert.ok(!roh.includes('background: C.warn, color: "#1a0f08", fontSize: FS.small, fontWeight: FW.bold, border: 0, cursor: "pointer" } }, T.sichBtn)'),
    "der Knopf im Hinweis ist wieder voll orange -- Orange ist Status, kein Aktionsknopf");
  assert.ok(roh.includes('style: { background: hexA(C.warn, 0.14), color: C.warn, fontSize: FS.small, fontWeight: FW.bold, border: 0, cursor: "pointer" } }, T.sichBtn)'),
    "der Knopf im Hinweis hat seine getoente Form verloren");
});

test("die Seitenleiste traegt die Zahl der Hinweise am Werkzeug", () => {
  // Der Aufplopp verschwindet beim Wegklicken und hinter Empfehlung/Teilen-Anstoss;
  // die Zahl am Knopf bleibt.
  assert.ok(roh.includes('variant: sichtPlaced.length ? "accent" : "quiet", wide: true, disabled: !sichtPlaced.length'),
    "der Seitenleisten-Knopf ist wieder 'quiet' und liest sich wie eine Beschriftung");
  assert.ok(/sichWarnzahl > 0 && \/\* @__PURE__ \*\/ React\.createElement\("span", \{ className: "px-2 rounded-full", style: \{[^}]*color: C\.warn \} \}, sichWarnzahl\)\)/.test(roh),
    "die Zahl der Hinweise steht nicht mehr am Knopf");
});

test("der Drehen-Umschalter sagt seinen Zustand -- im Text und fuer Screenreader", () => {
  assert.ok(roh.includes('upd(c.id, "rotatable", !on), "aria-pressed": on ? "true" : "false", title: T.rotTitel'),
    "aria-pressed oder der erklaerende title fehlt am Drehen-Umschalter");
  assert.ok(roh.includes('"\\u21BB ", on ? T.rotJa : T.rotNein)'),
    "der Umschalter heisst wieder in beiden Zustaenden gleich");
  assert.ok(!roh.includes('color: on ? "#BCD9FF" : C.dim } }, "\\u21BB 90\\xB0")'),
    "die alte, zustandslose Beschriftung ist zurueck");
  // Aus hatte er dieselbe Flaeche wie die offene Karte (field = raised) und las sich als Text.
  assert.ok(roh.includes('boxShadow: on ? "none" : `inset 0 0 0 1px ${C.fieldBorder}`'),
    "der ausgeschaltete Umschalter hat keine Kante mehr und verschwindet in der Karte");
  for (const k of ["rotJa", "rotNein", "rotTitel"]) zweimal(k);
});

test("das Tuermass: beide Zahlen ueber dimDE, Einheit dahinter", () => {
  assert.ok(roh.includes('const tuerTxt = (d) => dimDE(d.w) + "\\xD7" + dimDE(d.h);'),
    "das Tuermass laeuft nicht ueber dimDE -- auf Deutsch stuende wieder '257.7'");
  const n = (roh.match(/stat\(T\.stDoor, tuerTxt\(P\.door\), " cm"\)/g) || []).length;
  assert.strictEqual(n, 2, `Tuer-Kachel ${n}x mit tuerTxt und cm, erwartet 2 (Standard und Open Top)`);
  assert.ok(!roh.includes('"\\xD7" + P.door.h'), "die rohe Tuerhoehe steht wieder in der Karte");
  // "234\xD7257,7 cm" ist breiter als ein Kartendrittel -- ohne nowrap rutschte das "cm" in
  // eine eigene Zeile (gemessen bei 1440 px). Die 1fr-Spalten geben nach.
  assert.ok(roh.includes('style: { whiteSpace: isTxt ? void 0 : "nowrap", fontFamily: MONO, fontSize: isTxt ? FS.small : NUMS.s'),
    "die Kennzahlen der Containerkarte duerfen wieder umbrechen");
});

test("dimDE schreibt 257,7 auf Deutsch und 257.7 auf Englisch", () => {
  // Dieselbe Zeile wie in app.html, mit festem Gebietsschema statt LOC().
  const a = roh.indexOf("var dimDE = ");
  const zeile = roh.slice(a, roh.indexOf("\n", a));
  const num = (v, d = 0) => Number.isFinite(+v) && v !== "" ? +v : d;
  const dimDE = new Function("num", "LOC", zeile + "\nreturn dimDE;")(num, () => "de-DE");
  assert.strictEqual(dimDE(234) + "\xD7" + dimDE(257.7), "234\xD7257,7");
  assert.strictEqual(dimDE(257.7, "en-US"), "257.7");
});
