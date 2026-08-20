// Die Hero-Animation behauptet Zahlen. Sie muessen aus dem Rechner stammen.
//
// Die drei Szenen im Kopf der Startseite erzaehlen je einen Fall, und jeder Fall
// nennt konkrete Werte: 30 cm Ueberhoehe, 61 cm ueber dem Rahmen, 6 Kartons je Lage,
// 5 Lagen, 164,4 cm, 295 kg, 2 Paletten. Wer das sieht, haelt es fuer das Ergebnis
// des Werkzeugs — also muss es das auch sein. Dieser Test rechnet jede dieser Zahlen
// mit denselben Funktionen aus app.html nach und sucht sie danach im Animationsmodul
// von index.html. Abgeschrieben wird nichts.
//
// node --test test/hero-animation.test.mjs
import fs from "node:fs";
import assert from "node:assert";
import test from "node:test";
import { fileURLToPath } from "node:url";
import path from "node:path";

const dir = path.dirname(fileURLToPath(import.meta.url));
const L = fs.readFileSync(path.join(dir, "..", "app.html"), "utf8").split("\n");
const start = fs.readFileSync(path.join(dir, "..", "index.html"), "utf8");

// Das Animationsmodul allein — sonst faende ein Treffer auch im uebrigen Seitentext statt.
const modul = (() => {
  const a = start.indexOf("/* ContainerLoad — Hero-Animation, drei Akte im Wechsel");
  assert.ok(a > 0, "Hero-Modul nicht gefunden");
  const b = start.indexOf("</script>", a);
  return start.slice(a, b);
})();

const schnitt = (vonTxt, bisFn) => {
  const s = L.findIndex((l) => l.includes(vonTxt));
  assert.ok(s >= 0, `nicht gefunden: ${vonTxt}`);
  const e = L.findIndex((l, i) => i > s && bisFn(l, i));
  assert.ok(e > s, `Ende nicht gefunden fuer: ${vonTxt}`);
  return L.slice(s, e + 1).join("\n");
};

const presets = schnitt("var PRESETS = {", (l, i) => l.includes("var panelsFor"));
const packer = schnitt("function makeFloorPacker", (l, i) => l.trim() === "}" && L[i - 1].includes("return { placed, perType"));
const packerLang = schnitt("function makeFloorPacker", (l, i) => l.trim() === "}" && L[i - 1].includes("single: false"));
const pallets = schnitt("var PALLETS = {", (l) => l.trim() === "};");
const palletizeSrc = schnitt("function palletize(", (l) => /^ {2}\}$/.test(l));
const equip = schnitt("function suggestEquipment", (l, i) => l.trim() === "}" && L[i - 1].includes("return { name: hit.name"));

// Nur die Ausschnitte laden, die der jeweilige Test braucht. Was nicht dabei ist,
// kommt als undefined zurueck statt als Absturz.
const laden = (...teile) => new Function(
  'var num=(v,d=0)=>Number.isFinite(+v)&&v!==""?+v:d;\n' + teile.join("\n")
  + "\nvar _r={};" + ["PRESETS", "PALLETS", "makeFloorPacker", "palletize", "suggestEquipment"]
      .map((k) => `if(typeof ${k}!=='undefined')_r.${k}=${k};`).join("")
  + "return _r;"
)();

// ───────────────────────── Szene 2: Ueberhoehe / Open Top ─────────────────────────
test("Szene 2 — die Maschine landet wirklich im 20' Open Top", () => {
  const { suggestEquipment, PRESETS } = laden(presets, packerLang, equip);
  // Die Masse stehen im Modul; hier werden sie gelesen, nicht angenommen.
  const m = modul.match(/var ML=(\d+),MW=(\d+),MH=(\d+),STD=(\d+),INNER=(\d+);/);
  assert.ok(m, "die Masse der Maschine stehen nicht mehr, wo der Test sie sucht");
  const [ML, MW, MH, STD, INNER] = m.slice(1).map(Number);

  const stueck = { name: "Maschine", l: ML, w: MW, h: MH, weight: 4200, qty: 1, stackable: false, rotatable: true };
  const vorschlag = suggestEquipment(stueck, [stueck]);
  assert.ok(vorschlag, `${ML}×${MW}×${MH} braucht laut Rechner gar kein Special Equipment`);
  assert.strictEqual(vorschlag.name, "20' Open Top", "die Animation zeigt einen 20' Open Top");
  assert.strictEqual(vorschlag.reason.axis, "height", "der Grund muss die Hoehe sein, nicht Breite oder Laenge");

  // STD ist der hoechste Standardcontainer — der Wert, gegen den suggestEquipment misst.
  const hoechster = Math.max(...Object.values(PRESETS).filter((p) => !p.kind || p.kind === "dry").map((p) => p.h));
  assert.strictEqual(STD, hoechster, `die Animation nennt ${STD} cm als hoechsten Standard, es sind ${hoechster}`);
  assert.strictEqual(INNER, PRESETS["20' Open Top"].h, "die Innenhoehe des 20' Open Top stimmt nicht");

  assert.strictEqual(vorschlag.reason.cm, MH - STD, "die Ueberhoehe der Animation weicht vom Rechner ab");
  // Und die Szene muss diese Zahlen RECHNEN, nicht eintippen — sonst laufen sie beim
  // naechsten Mass wieder auseinander.
  assert.ok(modul.includes("UEBER=MH-STD"), "die Ueberhoehe steht als feste Zahl statt als Rechnung");
  assert.ok(modul.includes("RAHMEN=MH-INNER"), "der Ueberstand ueber den Rahmen steht als feste Zahl statt als Rechnung");
});

// ───────────────────────── Szene 3: Palette bauen ─────────────────────────
test("Szene 3 — Lagenmuster, Lagen und Palettenzahl kommen aus dem Palettierer", () => {
  const { palletize, PALLETS } = laden(pallets, packer, palletizeSrc);
  const m = modul.match(/var CL=(\d+),CW=(\d+),CH=(\d+),CKG=(\d+),QTY=(\d+);/);
  assert.ok(m, "die Kartonmasse stehen nicht mehr, wo der Test sie sucht");
  const [CL, CW, CH, CKG, QTY] = m.slice(1).map(Number);
  const b = modul.match(/var PER=(\d+),LAYERS=(\d+),PERPAL=(\d+),REST=(\d+),RESTL=(\d+),PALS=(\d+);/);
  assert.ok(b, "die Ergebniszahlen stehen nicht mehr, wo der Test sie sucht");
  const [PER, LAYERS, PERPAL, REST, RESTL, PALS] = b.slice(1).map(Number);

  // 180 cm Maximalhoehe — derselbe Wert, mit dem die Animation gebaut wurde.
  const r = palletize(PALLETS.EUR, { l: CL, w: CW, h: CH, weight: CKG, qty: QTY, rotatable: true }, { maxTotalH: 180 });
  assert.strictEqual(r.perLayer, PER, "Kartons je Lage");
  assert.strictEqual(r.layers, LAYERS, "Lagen je voller Palette");
  assert.strictEqual(r.perPallet, PERPAL, "Kartons je voller Palette");
  assert.strictEqual(r.pallets, PALS, "Palettenzahl");
  assert.strictEqual(r.rest, REST, "Kartons auf der angebrochenen Palette");
  assert.strictEqual(r.restLayers, RESTL, "Lagen auf der angebrochenen Palette");

  // Hoehe und Gewicht stehen als Rechnung im Modul, nicht als Zahl — hier der Beweis,
  // dass diese Rechnung dasselbe ergibt wie der Palettierer.
  const HGES = PALLETS.EUR.h + LAYERS * CH, KGES = PALLETS.EUR.tare + PERPAL * CKG;
  assert.strictEqual(HGES, r.fullH, "Gesamthoehe der vollen Palette");
  assert.strictEqual(KGES, r.fullKg, "Gesamtgewicht der vollen Palette");

  // Das Lagenmuster ist der eigentliche Punkt der Szene: vier laengs, zwei quer.
  // Es steht im Modul als Zahlentabelle und muss dem entsprechen, was der Packer legt.
  const mm = modul.match(/var MUSTER=(\[\[[\d,\[\]]+\]\]);/);
  assert.ok(mm, "das Lagenmuster steht nicht mehr, wo der Test es sucht");
  const muster = JSON.parse(mm[1]);
  const echt = r.rects.map((q) => [q.x, q.z, q.dx, q.dz]);
  const sortiere = (a) => a.slice().sort((p, q) => p[0] - q[0] || p[1] - q[1]).map((v) => v.join(","));
  assert.deepStrictEqual(sortiere(muster), sortiere(echt),
    "das gezeigte Lagenmuster ist nicht das, was der Packer rechnet");
  assert.ok(new Set(muster.map((q) => q[2] + "x" + q[3])).size > 1,
    "die Szene soll gerade das gemischte Muster zeigen — hier liegt alles gleich ausgerichtet");
});

// ───────────────────────── ueber alle Szenen ─────────────────────────
test("keine Szene verspricht mehr, als das Werkzeug rechnet", () => {
  // Rein geometrisch heisst: kein Schwerpunkt, keine Achslast, keine Ladungssicherung.
  // Woerter, die etwas anderes behaupten wuerden, haben im Kopf der Seite nichts zu suchen.
  const verboten = [/\bgarantiert\b/i, /\bverbindlich\b/i, /\bzertifiziert\b/i, /\bgesetzeskonform\b/i,
    /\bguaranteed\b/i, /\bcertified\b/i, /\blegally\b/i];
  const treffer = verboten.filter((r) => r.test(modul)).map((r) => String(r));
  assert.deepStrictEqual(treffer, [], `die Animation verspricht zu viel: ${treffer.join(", ")}`);
});
