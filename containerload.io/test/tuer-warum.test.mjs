// Die "Warum?"-Animation der Tuerpruefung.
//
// Die Regeln, an denen sie haengt:
//  * Sie zeigt EXAKT die Rechnung von doorFailCheck -- die kritische Kante in
//    ihrer echten gepackten Ausrichtung, samt Tiefe (d). Keine Deko-Sequenz.
//  * Sie laeuft NUR auf Abruf (Knopf an der Tuer-Warnung), nie von selbst,
//    und der Kasten geht NIE durch die Tuerebene.
//  * prefers-reduced-motion wird beachtet, das Aufraeumen laesst nichts stehen.
//
// node --test test/tuer-warum.test.mjs
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

// doorFailCheck einzeln, mit gestubbtem Rueckfall (fitsThroughDoor sagt "passt nicht").
const { doorFailCheck } = new Function(
  'var num = (v, d = 0) => Number.isFinite(+v) && v !== "" ? +v : d;\n'
  + "var fitsThroughDoor = () => false;\n"
  + schnitt("var doorFailCheck = (cargo, doorOpening, placedList)", "return { idx, critical };\n  };")
  + "\nreturn { doorFailCheck };"
)();

test("critical traegt die Tiefe der Kante -- in echter Ausrichtung wie gepackt", () => {
  const tuer = { w: 234, h: 228 };
  // Ein gedrehtes Stueck: 250 entlang der Breite (dz > Oeffnung), 120 in Fahrtrichtung.
  const r = doorFailCheck(
    [{ qty: 1, l: 250, w: 120, h: 100 }],
    tuer,
    [{ ti: 0, dx: 120, dy: 100, dz: 250 }]
  );
  assert.deepStrictEqual([...r.idx], [0]);
  assert.deepStrictEqual(r.critical, { w: 250, h: 100, d: 120 },
    "die Animation braucht die gepackte Ausrichtung, nicht den Bestfall");
  // Rueckfall ohne eigene Platzierung: schmalste Kante voran, Tiefe = laengste Kante.
  const r2 = doorFailCheck([{ qty: 1, l: 300, w: 240, h: 100 }], tuer, []);
  assert.deepStrictEqual(r2.critical, { w: 240, h: 100, d: 300 });
});

test("der Einstieg: Knopf an der Warnung, gezaehlt, auf Abruf statt von selbst", () => {
  assert.ok(roh.includes('zaehl("tuer-warum"); setTuerKino((k) => k + 1);'),
    "der Warum-Knopf zaehlt nicht oder startet die Sequenz nicht");
  // Ein Zaehler, kein Schalter: jeder Klick spielt erneut, nichts laeuft von selbst.
  assert.ok(roh.includes("const [tuerKino, setTuerKino] = useState(0);"), "der Zaehler fehlt");
  assert.ok(/T\.doorWhy/.test(roh), "der Knopf traegt keine Beschriftung");
  assert.ok(roh.includes('doorWhy: "Warum?"') && roh.includes('doorWhy: "Why?"'),
    "doorWhy fehlt in einer Sprache");
});

test("die Sequenz haengt am Aufbau und geht nie durch die Tuerebene", () => {
  // Der Aufbau-Effekt stiftet t.tuer am Tuer-Konflikt-Block und entwertet es je Neuaufbau.
  assert.ok(roh.includes("t.tuer = null;"), "ein Neuaufbau entwertet die Referenzen nicht");
  assert.ok(/t\.tuer = \{ cg, CL: d\.CL, CW: d\.CW, dw, dh, gw, gh, gd: Math\.max\(0\.2, num\(dc\.critical\.d\) \/ 100\), frame: ap \};/.test(roh),
    "der Tuer-Konflikt-Block stiftet t.tuer nicht mehr aus doorFailCheck");
  // Der Anschlag liegt VOR der Tuerebene, und der Anprall-Rueckstoss ist nie negativ
  // (Math.abs) -- der Kasten kann die Ebene also zu keinem Zeitpunkt durchdringen.
  assert.ok(roh.includes("const xEnde = CL + 0.03 + gd / 2"), "der Anschlag liegt nicht an der Tuerebene");
  assert.ok(roh.includes("x = xEnde + 0.07 * Math.abs(Math.sin("), "der Rueckstoss kann durch die Ebene schlagen");
  // Effekt laeuft nur bei Abruf und raeumt vollstaendig auf.
  assert.ok(/if \(!tuerKino\) return;/.test(roh), "die Sequenz laeuft ohne Abruf");
  assert.ok(/return \(\) => \{ cancelAnimationFrame\(raf\); weg\(\); \};\n\s*\}, \[tuerKino\]\);/.test(roh),
    "das Aufraeumen fehlt oder der Effekt haengt nicht am Zaehler");
  assert.ok(roh.includes("frame.material.opacity = frameOp;"), "der Oeffnungsrahmen bleibt verstellt zurueck");
});

test("prefers-reduced-motion: keine Fahrt, kein Pulsieren", () => {
  const effekt = schnitt('useEffect(() => {\n      if (!tuerKino) return;', "}, [tuerKino]);");
  assert.ok(effekt.includes("prefers-reduced-motion"), "die Sequenz ignoriert reduced motion");
  assert.ok(effekt.includes("o.position.set(ruhig ? xEnde : xStart"),
    "mit reduced motion muss der Kasten ohne Fahrt am Anschlag stehen");
});

test("die Verdrahtung: App -> Viewport", () => {
  assert.ok(roh.includes("onFokus: setFokus, sichZonen, zeigeNummern, setZeigeNummern, tuerKino })"),
    "der Viewport bekommt tuerKino nicht");
  assert.ok(roh.includes("setZeigeNummern, tuerKino }) {"), "die Viewport-Signatur kennt tuerKino nicht");
});
