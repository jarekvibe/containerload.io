// Sichert die Reederei-Presets ab: die Tabelle selbst (Tippfehler, Einheiten, Plausibilitaet)
// und das Verhalten von applyCarrier (was ueberschrieben wird und was ausdruecklich nicht).
//
// Warum das einen Test verdient: die Werte sind von Hand aus acht verschiedenen
// Reederei-Datenblaettern abgeschrieben. Ein "12032" statt "1203.2" waere ein Container von
// 120 Metern Laenge — der Rechner wuerde ihn anstandslos beladen und niemand saehe den Fehler.
import fs from "node:fs";
import assert from "node:assert";
import test from "node:test";
import { fileURLToPath } from "node:url";
import path from "node:path";

const dir = path.dirname(fileURLToPath(import.meta.url));
const html = fs.readFileSync(path.join(dir, "..", "app.html"), "utf8");
const L = html.split("\n");
const s = L.findIndex((l) => l.includes("// EQUIPMENT-BEGIN"));
const e = L.findIndex((l, i) => i > s && l.includes("// EQUIPMENT-END"));
assert.ok(s >= 0 && e > s, "EQUIPMENT-Marker in app.html nicht gefunden");
const { PRESETS, CARRIERS, carrierSpec, applyCarrier } = new Function(
  L.slice(s, e + 1).join("\n") + "\nreturn { PRESETS, CARRIERS, carrierSpec, applyCarrier };"
)();

const ERWARTETE_REEDEREIEN = ["Maersk", "CMA CGM", "COSCO", "Hapag-Lloyd", "ONE", "Evergreen", "HMM", "Yang Ming"];

test("alle acht Reedereien sind da und nennen ihre Quelle", () => {
  assert.deepStrictEqual(Object.keys(CARRIERS), ERWARTETE_REEDEREIEN);
  for (const [name, c] of Object.entries(CARRIERS)) {
    assert.ok(c.src && /\./.test(c.src), `${name}: keine Quelle hinterlegt`);
    assert.ok(Object.keys(c.eq).length > 0, `${name}: keine Masse hinterlegt`);
  }
});

test("die angezeigte Domain fuehrt auch dorthin, wo sie hinzeigt", () => {
  // In der Oberflaeche steht c.src als Linktext ueber c.url. Zeigten die auseinander, waere
  // der Vertrauensbeweis eine Irrefuehrung — genau das faengt dieser Test ab.
  for (const [name, c] of Object.entries(CARRIERS)) {
    assert.ok(/^https:\/\//.test(c.url || ""), `${name}: Quell-Link fehlt oder ist nicht https`);
    const host = new URL(c.url).hostname;
    assert.ok(host === c.src || host.endsWith("." + c.src), `${name}: Link zeigt auf ${host}, angezeigt wird aber ${c.src}`);
  }
});

test("jeder Reederei-Typ trifft einen echten Containertyp", () => {
  for (const [name, c] of Object.entries(CARRIERS)) {
    for (const typ of Object.keys(c.eq)) {
      assert.ok(PRESETS[typ], `${name}: "${typ}" ist kein Typ aus PRESETS (Tippfehler?)`);
      assert.ok(!PRESETS[typ].kind, `${name}: "${typ}" ist Special Equipment — dafuer gibt es keine Reederei-Masse`);
    }
  }
});

test("die Masse liegen in Zentimetern und nah am Standard — kein Millimeter-/Meter-Ausrutscher", () => {
  for (const [name, c] of Object.entries(CARRIERS)) {
    for (const [typ, m] of Object.entries(c.eq)) {
      const std = PRESETS[typ];
      for (const achse of ["l", "w", "h"]) {
        assert.ok(Number.isFinite(m[achse]), `${name} ${typ}: ${achse} ist keine Zahl`);
        const abw = Math.abs(m[achse] - std[achse]);
        assert.ok(abw <= 5, `${name} ${typ}: ${achse}=${m[achse]} weicht ${abw} cm vom Standard ${std[achse]} ab — Einheit verrutscht?`);
      }
      assert.ok(m.door && m.door.w > 200 && m.door.w < 250, `${name} ${typ}: Tuerbreite ${m.door && m.door.w} unplausibel`);
      assert.ok(m.door.h > 200 && m.door.h < 280, `${name} ${typ}: Tuerhoehe ${m.door.h} unplausibel`);
      assert.ok(m.door.w <= m.w + 0.5, `${name} ${typ}: Tuer breiter als der Container`);
      assert.ok(m.door.h <= m.h, `${name} ${typ}: Tuer hoeher als der Container`);
    }
  }
});

test("applyCarrier tauscht die Geometrie und laesst Zuladung, kind und gauge in Ruhe", () => {
  const std = PRESETS["40' HC"];
  const out = applyCarrier(std, "Evergreen", "40' HC");
  assert.strictEqual(out.h, CARRIERS["Evergreen"].eq["40' HC"].h);
  assert.strictEqual(out.l, CARRIERS["Evergreen"].eq["40' HC"].l);
  assert.strictEqual(out.door.h, CARRIERS["Evergreen"].eq["40' HC"].door.h);
  assert.strictEqual(out.payload, std.payload, "Zuladung darf die Reederei-Wahl NICHT veraendern");
  assert.strictEqual(std.h, 270, "PRESETS darf nicht mutiert werden");
});

test("ohne Reederei, mit unbekannter Reederei oder ohne Angabe zum Typ bleibt alles beim Standard", () => {
  const std = PRESETS["40' HC"];
  assert.strictEqual(applyCarrier(std, "", "40' HC"), std);
  assert.strictEqual(applyCarrier(std, void 0, "40' HC"), std);
  assert.strictEqual(applyCarrier(std, "Reederei Gibtsnicht", "40' HC"), std);
  // HMM veroeffentlicht keinen 40' HC — dann gilt der Standard, still und ohne Fehler.
  assert.strictEqual(carrierSpec("HMM", "40' HC"), null);
  assert.strictEqual(applyCarrier(std, "HMM", "40' HC"), std);
  // Special Equipment fasst die Reederei-Wahl nicht an.
  assert.strictEqual(applyCarrier(PRESETS["20' Flat Rack"], "Maersk", "20' Flat Rack"), PRESETS["20' Flat Rack"]);
});

test("die Reedereien unterscheiden sich wirklich — sonst waere die Auswahl Behauptung", () => {
  const hoehen = new Set();
  const laengen = new Set();
  for (const c of Object.values(CARRIERS)) {
    if (c.eq["40' HC"]) hoehen.add(c.eq["40' HC"].h);
    if (c.eq["40' GP"]) laengen.add(c.eq["40' GP"].l);
  }
  assert.ok(hoehen.size >= 3, `40' HC: nur ${hoehen.size} verschiedene Innenhoehen`);
  assert.ok(laengen.size >= 2, `40' GP: nur ${laengen.size} verschiedene Innenlaengen`);
});
