// Die beiden weiteren Erklaer-Animationen nach dem Muster der Tuer-Animation:
// die Kran-Sequenz der Ueberhoehe (Open Top / Flat Rack) und die sichtbare
// Achslast-Ruecksetzung. Dieselben Regeln wie dort (test/tuer-warum.test.mjs):
// auf Abruf statt von selbst, gezeigt wird nur, was wirklich gerechnet wird,
// und das Aufraeumen laesst nichts stehen.
//
// node --test test/erklaer-animationen.test.mjs
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

test("Kran-Sequenz: auf Abruf, hoechstes Stueck, Original bleibt exakt stehen", () => {
  const eff = schnitt("if (!oogKino) return;", "}, [oogKino]);");
  // Der Knopf sitzt an der Ueberhoehe-Karte und zaehlt.
  assert.ok(roh.includes('zaehl("oog-ansehen"); setOogKino((k) => k + 1);'),
    "der Knopf an der Ueberhoehe-Karte fehlt oder zaehlt nicht");
  // Ziel ist das HOECHSTE Stueck -- genau das, um das es bei Ueberhoehe geht.
  assert.ok(eff.includes("const top = b.cy + b.sy / 2;") && eff.includes("top > ziel.top"),
    "die Sequenz sucht nicht das hoechste Stueck");
  // Es fliegt ein Klon; das Original wird geschrumpft und am Ende WIEDERHERGESTELLT
  // (instanz(true) im Aufraeumen) -- die Rechnung selbst bleibt unangetastet.
  assert.ok(eff.includes("instanz(false);") && /const weg = \(\) => \{[\s\S]*?instanz\(true\);\n\s*\};/.test(eff),
    "das Original wird nicht sauber versteckt und wiederhergestellt");
  assert.ok(eff.includes("klon.geometry.dispose(); seilGeo.dispose(); seilMat.dispose();"),
    "die Kran-Objekte werden nicht entsorgt");
  assert.ok(eff.includes("prefers-reduced-motion"), "reduced motion wird ignoriert");
  assert.ok(/return \(\) => \{ cancelAnimationFrame\(raf\); weg\(\); \};\n\s*\}, \[oogKino\]\);/.test(roh),
    "das Aufraeumen fehlt oder der Effekt haengt nicht am Zaehler");
});

test("Achslast-Ruecksetzung: Block faehrt an die Stirnwand und exakt zurueck", () => {
  const eff = schnitt("if (!achsKino || !achsKino.n) return;", "}, [achsKino]);");
  // Der Knopf sitzt am axleShift-Satz, zaehlt, und gibt Slot + Zentimeter mit --
  // gezeigt wird genau die Ruecksetzung, die achsShift gerechnet hat.
  assert.ok(roh.includes('zaehl("achslast-ansehen"); setAchsKino((v) => ({ n: (v ? v.n : 0) + 1, slot: fokusSlot ? fokus : 0, cm: achsRuecke }));'),
    "der Knopf am Ruecksetzungs-Satz fehlt, zaehlt nicht oder traegt nicht die gerechneten Werte");
  // Bewegt werden Kisten UND Trennkanten (sonst blieben die Kanten stehen), und
  // am Ende steht alles exakt auf der berechneten Lage (setOff(0) im Aufraeumen).
  assert.ok(eff.includes("o.userData && o.userData.ladung") && eff.includes("linien.forEach((l) => { l.position.x = off; })"),
    "die Trennkanten fahren nicht mit");
  assert.ok(/const weg = \(\) => \{ if \(aufgeraeumt\) return; aufgeraeumt = true; setOff\(0\); \};/.test(eff),
    "die Ladung kehrt nicht exakt auf die berechnete Lage zurueck");
  assert.ok(eff.includes("prefers-reduced-motion"), "reduced motion wird ignoriert");
  assert.ok(/return \(\) => \{ cancelAnimationFrame\(raf\); weg\(\); \};\n\s*\}, \[achsKino\]\);/.test(roh),
    "das Aufraeumen fehlt oder der Effekt haengt nicht am Zaehler");
});

test("beide Sprachen kennen die Knoepfe, die Ereignisse sind feste Namen", () => {
  assert.ok(roh.includes('oogKran: "Beladung ansehen"') && roh.includes('oogKran: "Show loading"'),
    "oogKran fehlt in einer Sprache");
  assert.ok(roh.includes('axleKino: "Ansehen"') && roh.includes('axleKino: "Show"'),
    "axleKino fehlt in einer Sprache");
});
