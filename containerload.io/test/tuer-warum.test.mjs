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
  // Seit der hellen Buehne reist hinter den Kino-Zaehlern noch das Thema mit.
  assert.ok(roh.includes("onFokus: setFokus, sichZonen, zeigeNummern, setZeigeNummern, tuerKino, oogKino, achsKino, thema })"),
    "der Viewport bekommt die Kino-Zaehler nicht");
  assert.ok(roh.includes("setZeigeNummern, tuerKino, oogKino, achsKino, thema }) {"),
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

// ── Der Ladeweg je Bauart (Kollegen-Meldung: "Dachoeffnung bei OTs bedenken") ──
// Der Open Top wird meist von oben beladen, aber die Dachoeffnung ist KLEINER als
// das Innenmass. Vorher prueften wir beim OT gar nichts -- ein Stueck in voller
// Innenlaenge sah ladbar aus, passt real aber weder durch Tuer noch Dach. Und der
// Reefer (geschlossener Kasten, engste Tuer) stand faelschlich auf "nie pruefen".
test("Open Top: Konflikt ist erst, was weder durch Tuer noch Dachoeffnung geht", () => {
  const tuer = { w: 234, h: 230 };
  const ot = { door: tuer, kind: "opentop", roof: { l: 540, w: 222 }, w: 235, h: 239 };
  // Zu hoch fuer die Tuer, passt aber von oben (Grundflaeche in der Dachoeffnung).
  const vonOben = tuerKonflikte([{ qty: 1, l: 300, w: 150, h: 250 }],
    [{ preset: ot, placed: [{ ti: 0, dx: 300, dy: 250, dz: 150 }] }], tuer);
  assert.strictEqual(vonOben.idx.size, 0, "was von oben geht, ist kein Konflikt");
  // Zu lang fuers Dach, passt aber durch die Tuer: auch kein Konflikt.
  const durchTuer = tuerKonflikte([{ qty: 1, l: 560, w: 200, h: 100 }],
    [{ preset: ot, placed: [{ ti: 0, dx: 560, dy: 100, dz: 200 }] }], tuer);
  assert.strictEqual(durchTuer.idx.size, 0, "was durch die Tuer geht, ist kein Konflikt");
  // Weder noch: zu breit fuer die Tuer UND zu lang fuers Dach.
  const weder = tuerKonflikte([{ qty: 1, l: 560, w: 240, h: 100 }],
    [{ preset: ot, placed: [{ ti: 0, dx: 560, dy: 100, dz: 240 }] }], tuer);
  assert.deepStrictEqual([...weder.idx], [0], "weder Tuer noch Dach -- das ist der Konflikt");
  assert.strictEqual(weder.slots.length, 1);
  // Ohne Dachmass (alte Custom-artige OTs) bleibt das alte Verhalten: keine Pruefung.
  const ohneDach = tuerKonflikte([{ qty: 1, l: 560, w: 240, h: 100 }],
    [{ preset: { door: tuer, kind: "opentop", w: 235, h: 239 }, placed: [{ ti: 0, dx: 560, dy: 100, dz: 240 }] }], tuer);
  assert.strictEqual(ohneDach.idx.size, 0);
});

test("Open Top: der Bestfall-Rueckfall kennt den Dach-Ladeweg", () => {
  const tuer = { w: 234, h: 230 };
  const ot = { door: tuer, kind: "opentop", roof: { l: 540, w: 222 }, w: 235, h: 239 };
  // Unplatziert, zu hoch fuer die Tuer -- aber die Grundflaeche passt von oben.
  const ok = tuerKonflikte([{ qty: 1, l: 300, w: 200, h: 260 }], [{ preset: ot, placed: [] }], tuer);
  assert.strictEqual(ok.idx.size, 0, "die Dachoeffnung rettet den Bestfall");
  // Unplatziert und fuer beide Wege zu gross (240 > 234 Tuer, 240 > 222 Dachbreite).
  const nein = tuerKonflikte([{ qty: 1, l: 560, w: 240, h: 100 }], [{ preset: ot, placed: [] }], tuer);
  assert.deepStrictEqual([...nein.idx], [0]);
});

test("Reefer prueft jetzt mit, Flat Rack und Platform bleiben offen", () => {
  const reefer = { door: { w: 228, h: 218 }, kind: "reefer", w: 228, h: 220 };
  const r = tuerKonflikte([{ qty: 1, l: 250, w: 230, h: 100 }],
    [{ preset: reefer, placed: [{ ti: 0, dx: 250, dy: 100, dz: 230 }] }], reefer.door);
  assert.deepStrictEqual([...r.idx], [0], "230 > 228: durch die Reefer-Tuer geht das nicht");
  for (const kind of ["flatrack", "platform"]) {
    const f = tuerKonflikte([{ qty: 1, l: 400, w: 250, h: 260 }],
      [{ preset: { kind, w: 244, h: 218 }, placed: [{ ti: 0, dx: 400, dy: 260, dz: 250 }] }], { w: 244, h: 218 });
    assert.strictEqual(f.idx.size, 0, kind + " hat keinen Ladeweg-Engpass");
  }
});

test("der Vertrag im Quelltext: die Bauart haengt an allen drei Toren", () => {
  // Beide OT-Presets tragen die Dachoeffnung.
  assert.ok(/20' Open Top": \{[^\n]*roof: \{ l: \d+, w: \d+ \}/.test(roh), "20' OT ohne roof-Mass");
  assert.ok(/40' Open Top": \{[^\n]*roof: \{ l: \d+, w: \d+ \}/.test(roh), "40' OT ohne roof-Mass");
  // Die Aussen-Gates sperren nur noch die offenen Bauarten aus -- nicht Reefer/OT.
  assert.ok(roh.includes('sichtCont.kind === "flatrack" || sichtCont.kind === "platform"'),
    "das UI-Gate prueft Reefer/Open Top nicht mehr mit");
  assert.ok(roh.includes('container.kind === "flatrack" || container.kind === "platform"'),
    "das 3D-Gate prueft Reefer/Open Top nicht mehr mit");
  assert.ok(!roh.includes('if (kind !== "dry") return;'), "tuerKonflikte sperrt wieder alles ausser dry");
  // Die Warnung spricht beim OT vom richtigen Ladeweg, in beiden Sprachen.
  for (const key of ["doorWarnOT", "doorHintOT", "doorChipOT"])
    assert.strictEqual((roh.match(new RegExp(key + ":", "g")) || []).length, 2, key + " fehlt in einer Sprache");
});

test("der Vertrag im Quelltext: gezeichnet wird je Slot, die Sequenz am ersten Konflikt", () => {
  assert.ok(roh.includes("tuerLage.slots.find((s2) => s2.ci === ci)"),
    "das 3D-Bild zeichnet den Tuer-Konflikt nicht mehr am jeweiligen Container");
  assert.ok(roh.includes("if (!t.tuer) t.tuer = { cg, CL: d.CL"),
    "die Warum-Animation haengt nicht mehr am ersten Konflikt-Container");
  assert.ok(!/if \(ci === 0 && ckind === "dry"\)/.test(roh),
    "die Tuerpruefung im Bild ist wieder auf C1 festgenagelt");
});
