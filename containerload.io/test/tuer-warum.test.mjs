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
  assert.ok(roh.includes("onFokus: setFokus, sichZonen, zeigeNummern, setZeigeNummern, tuerKino, oogKino, achsKino })"),
    "der Viewport bekommt die Kino-Zaehler nicht");
  assert.ok(roh.includes("setZeigeNummern, tuerKino, oogKino, achsKino }) {"),
    "die Viewport-Signatur kennt die Kino-Zaehler nicht");
});

// ── Die Tuerpruefung je Container (gemeldet: Ghost an C1, Konflikt in C3) ──
const { tuerKonflikte } = new Function(
  'var num = (v, d = 0) => Number.isFinite(+v) && v !== "" ? +v : d;\n'
  + "var fitsThroughDoor = (it, o) => Math.min(num(it.l), num(it.w)) <= o.w && num(it.h) <= o.h;\n"
  + schnitt("var tuerKonflikte = (cargo, chain, tuer0", "return { idx, slots };\n  };")
  + "\nreturn { tuerKonflikte };"
)();

test("tuerKonflikte findet den Konflikt im RICHTIGEN Container", () => {
  const tuer = { w: 234, h: 228 };
  const preset = { door: tuer, w: 235, h: 239 };
  const cargo = [{ qty: 1, l: 120, w: 80, h: 100 }, { qty: 1, l: 250, w: 245, h: 100 }];
  const chain = [
    { preset, placed: [{ ti: 0, dx: 120, dy: 100, dz: 80 }] },                 // C1: alles gut
    { preset, placed: [{ ti: 1, dx: 250, dy: 100, dz: 245 }] }                 // C2: 245 > 234
  ];
  const r = tuerKonflikte(cargo, chain, tuer);
  assert.deepStrictEqual([...r.idx], [1]);
  assert.strictEqual(r.slots.length, 1, "genau EIN Konflikt-Container");
  assert.strictEqual(r.slots[0].ci, 1, "der Ghost gehoert an C2, nicht an C1");
  assert.deepStrictEqual(r.slots[0].critical, { w: 245, h: 100, d: 250 });
  // Jede Kiste zaehlt gegen die Tuer IHRES Containers: eine engere Tuer im
  // Folgecontainer macht denselben Fussabdruck dort zum Konflikt.
  const eng = { preset: { door: { w: 200, h: 228 }, w: 235, h: 239 }, placed: [{ ti: 0, dx: 120, dy: 100, dz: 210 }] };
  const r2 = tuerKonflikte([{ qty: 1, l: 210, w: 120, h: 100 }], [{ preset, placed: [] }, eng], tuer);
  assert.strictEqual(r2.slots.length, 1);
  assert.strictEqual(r2.slots[0].ci, 1);
});

test("der Bestfall-Rueckfall haengt an Slot 0 -- und schweigt im Fokus", () => {
  const tuer = { w: 234, h: 228 };
  const preset = { door: tuer, w: 235, h: 239 };
  // Typ 0 ist NIRGENDS platziert und passt im Bestfall nicht durch die Tuer.
  const cargo = [{ qty: 1, l: 300, w: 240, h: 100 }];
  const r = tuerKonflikte(cargo, [{ preset, placed: [] }], tuer);
  assert.deepStrictEqual([...r.idx], [0]);
  assert.strictEqual(r.slots[0].ci, 0);
  assert.deepStrictEqual(r.slots[0].critical, { w: 240, h: 100, d: 300 });
  // Im Fokus (mitRueckfall = false) erzaehlt der gezeigte Container nur von
  // sich selbst -- ein Typ, der in einem ANDEREN Container liegt, ist hier
  // weder platziert noch ein Konflikt.
  const r2 = tuerKonflikte(cargo, [{ preset, placed: [] }], tuer, false);
  assert.strictEqual(r2.idx.size, 0);
  assert.strictEqual(r2.slots.length, 0);
});

test("der Vertrag im Quelltext: gezeichnet wird je Slot, die Sequenz am ersten Konflikt", () => {
  assert.ok(roh.includes("tuerLage.slots.find((s2) => s2.ci === ci)"),
    "das 3D-Bild zeichnet den Tuer-Konflikt nicht mehr am jeweiligen Container");
  assert.ok(roh.includes("if (!t.tuer) t.tuer = { cg, CL: d.CL"),
    "die Warum-Animation haengt nicht mehr am ersten Konflikt-Container");
  assert.ok(!/if \(ci === 0 && ckind === "dry"\)/.test(roh),
    "die Tuerpruefung im Bild ist wieder auf C1 festgenagelt");
});
