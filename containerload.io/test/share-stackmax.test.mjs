// Sichert den URL-Vertrag fuer die Stapel-Obergrenze im kompakten ?c=-Format ab.
// s-Feld: 0 = nicht stapelbar, 1 = frei (Default), >=2 = Gesamt-Lagen-Obergrenze ("y"-Tag).
// Alte Links (nur s=0/1) muessen unveraendert weiterfunktionieren.
import fs from "node:fs";
import assert from "node:assert";
import test from "node:test";
import { fileURLToPath } from "node:url";
import path from "node:path";

const dir = path.dirname(fileURLToPath(import.meta.url));
const html = fs.readFileSync(path.join(dir, "..", "app.html"), "utf8");
const L = html.split("\n");

const s = L.findIndex((l) => l.includes("// V2-ENCODE-BEGIN"));
const e = L.findIndex((l, i) => i > s && l.includes("// V2-ENCODE-END"));
const { compactEncode, compactDecode } = new Function(L.slice(s, e + 1).join("\n") + "\nreturn { compactEncode, compactDecode };")();

const TABLES = { presets: {}, vehicles: {} }; // leer -> Custom-Pfad, Item-Kodierung isoliert testbar
const mkState = (sVal) => ({ dm: "sea", pr: "Custom", co: { l: 590, w: 235, h: 239, p: 28200 }, it: [{ l: 120, w: 80, h: 110, wt: 0, q: 1, s: sVal, r: 1 }] });

test("s-Wert ueberlebt kompakten Encode/Decode-Round-Trip", () => {
  for (const sVal of [0, 1, 2, 3, 4]) {
    const enc = compactEncode(mkState(sVal), TABLES);
    const dec = compactDecode(enc);
    assert.ok(dec && dec.it && dec.it[0], `Decode fehlgeschlagen fuer s=${sVal} (enc=${enc})`);
    assert.strictEqual(dec.it[0].s, sVal, `s=${sVal} ging verloren (enc=${enc}, zurueck=${dec.it[0].s})`);
  }
});

test("Alt-Link ohne Stapel-Tags bleibt frei stapelbar (s=1)", () => {
  // So sah ein vor diesem Feature erzeugter Link aus: Item ohne s/y-Tag.
  const dec = compactDecode("z" + "g590x235x239x28200" + "~120x80x110");
  assert.ok(dec && dec.it[0], "Alt-Link muss dekodieren");
  assert.strictEqual(dec.it[0].s, 1, "fehlendes Tag = frei stapelbar (Default 1)");
});

test('"s"-Flag bleibt "nicht stapelbar" (s=0)', () => {
  const enc = compactEncode(mkState(0), TABLES);
  assert.ok(/s(?![0-9])/.test(enc.split("~")[1]), `Item sollte das s-Flag tragen: ${enc}`);
  assert.strictEqual(compactDecode(enc).it[0].s, 0);
});

console.log("share-stackmax: alle Tests gruen");

// ── Hoehengrenze ("stapelbar bis 180 cm") ────────────────────────────────────
// Neuer Tag "H". Grossbuchstabe, weil die Codetabelle ausdruecklich nur ERGAENZT
// werden darf. Ohne diesen Tag verlaesst die Grenze den Teilen-Link stillschweigend —
// der Empfaenger rechnet dann mit einer anderen Ladung als der Absender, und niemand
// sieht es. Genau dieselbe Falle wie seinerzeit bei stackMax.
const mkH = (sh) => ({ dm: "sea", pr: "Custom", co: { l: 590, w: 235, h: 239, p: 28200 },
  it: [{ l: 325, w: 218, h: 45, wt: 2000, q: 1, s: 1, sh, r: 1 }] });

test("die Hoehengrenze ueberlebt den Round-Trip", () => {
  for (const sh of [100, 180, 245.5]) {
    const enc = compactEncode(mkH(sh), TABLES);
    const dec = compactDecode(enc);
    assert.ok(dec && dec.it && dec.it[0], `Decode fehlgeschlagen fuer sh=${sh} (enc=${enc})`);
    assert.strictEqual(dec.it[0].sh, sh, `sh=${sh} ging verloren (enc=${enc})`);
  }
});

test("ohne Hoehengrenze steht kein H-Tag im Link", () => {
  const enc = compactEncode({ ...mkH(void 0) }, TABLES);
  assert.ok(!/H/.test(enc.split("~")[1] || ""), `kein H-Tag erwartet: ${enc}`);
  assert.strictEqual(compactDecode(enc).it[0].sh, void 0);
});

test("Lagengrenze und Hoehengrenze reisen zusammen", () => {
  const st = { dm: "sea", pr: "Custom", co: { l: 590, w: 235, h: 239, p: 28200 },
    it: [{ l: 325, w: 218, h: 45, wt: 0, q: 2, s: 3, sh: 180, r: 1 }] };
  const dec = compactDecode(compactEncode(st, TABLES));
  assert.strictEqual(dec.it[0].s, 3);
  assert.strictEqual(dec.it[0].sh, 180);
});
