// Der Rampen-Modus: die Belade-Reihenfolge als Abhak-Liste fuers Handy.
//
// Die eine Zusage, an der alles haengt: der Rampen-Modus und die Belade-
// Reihenfolge im PDF erzaehlen DIESELBEN Schritte. Zwei Listen, die an der
// Rampe voneinander abweichen ("auf dem Papier Schritt 3, am Handy Schritt 4"),
// waeren schlimmer als gar kein Modus. rampenSchritte ist bewusst eine eigene
// Funktion (die Druckvorlage wird von Test-Slices woertlich geschnitten) --
// dieser Test rechnet beide Quellen gegeneinander, damit sie nie driften.
//
// node --test test/rampen-modus.test.mjs
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

const { rampenSchritte } = new Function(
  cut("function rampenSchritte(placed", (l, i) => l.trim() === "}" && L[i - 1].includes("return schritte;"))
  + "\nreturn { rampenSchritte };"
)();
const { LV_SEQUENZ } = new Function(
  'var escHTML = (t) => String(t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", \'"\': "&quot;" })[c]);\n'
  + cut("var LV_SEQUENZ = (placed", (l, i) => l.trim() === "};" && L[i - 1].includes("</div>`;"))
  + "\nreturn { LV_SEQUENZ };"
)();

// Zufaellige Stauungen: beide Quellen muessen dieselben Laeufe sehen.
let seed = 20260912;
const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;

test("Rampen-Schritte und PDF-Reihenfolge erzaehlen dieselben Laeufe", () => {
  for (let fall = 0; fall < 40; fall++) {
    const cargo = [{ name: "A" }, { name: "B" }, { name: "C" }];
    const placed = Array.from({ length: 2 + Math.floor(rnd() * 14) }, () => ({
      ti: Math.floor(rnd() * 3),
      x: Math.floor(rnd() * 100) * 10, y: Math.floor(rnd() * 3) * 100, z: Math.floor(rnd() * 2) * 100,
      dx: 80 + Math.floor(rnd() * 5) * 10
    }));
    const schritte = rampenSchritte(placed, cargo);
    const html = LV_SEQUENZ(placed, cargo, "de", {});
    // Das PDF kappt bei 16 Schritten; verglichen wird bis dorthin.
    const imPdf = Math.min(schritte.length, 16);
    for (let i = 0; i < imPdf; i++) {
      const sc = schritte[i];
      assert.ok(html.includes(`${sc.n}× ${cargo[sc.ti].name}`),
        `Fall ${fall}, Schritt ${i + 1}: "${sc.n}x ${cargo[sc.ti].name}" fehlt im PDF`);
    }
    // Und die Gesamtmenge stimmt: kein Stueck verschwindet, keines doppelt.
    assert.strictEqual(schritte.reduce((s, x) => s + x.n, 0), placed.length,
      `Fall ${fall}: Stueckzahl der Schritte != Stauung`);
  }
});

test("Reihenfolge: Stirnwand zuerst, unten vor oben -- und ohne Kappung", () => {
  const cargo = [{ name: "P" }];
  const placed = [
    { ti: 0, x: 200, y: 0, z: 0, dx: 100 },
    { ti: 0, x: 0, y: 110, z: 0, dx: 100 },
    { ti: 0, x: 0, y: 0, z: 0, dx: 100 }
  ];
  const s = rampenSchritte(placed, cargo);
  assert.strictEqual(s.length, 1, "gleiche Sorte in Folge ist EIN Schritt");
  assert.strictEqual(s[0].von, 0);
  assert.strictEqual(s[0].bis, 300);
  // 40 Einzelsorten abwechselnd: das Papier kappt bei 16, die Liste nicht.
  const viele = Array.from({ length: 40 }, (_, i) => ({ ti: i % 2, x: i * 30, y: 0, z: 0, dx: 25 }));
  assert.strictEqual(rampenSchritte(viele, [{ name: "A" }, { name: "B" }]).length, 40,
    "die scrollende Liste darf nicht kappen");
  assert.deepStrictEqual(rampenSchritte([], cargo), []);
});

// ── Vertraege im Quelltext ──────────────────────────────────────────────────
test("Einstieg: Menuepunkt, ?rampe=1 und der kopierbare Rampen-Link", () => {
  assert.ok(roh.includes('get("rampe") === "1"'), "?rampe=1 wird nicht gelesen");
  assert.ok(roh.includes("useState(RAMPE_START)"), "der Parameter oeffnet den Modus nicht");
  assert.ok(roh.includes("{ label: T.rampeBtn, sub: T.rampeMenuSub, fn: () => setRampeOffen(true)"),
    "der Menuepunkt fehlt");
  assert.ok(roh.includes('+ "&rampe=1"'), "der Rampen-Link haengt den Parameter nicht an");
});

test("die Haken bleiben lokal, je Plan, und raeumen sich auf", () => {
  assert.ok(roh.includes('"cl-rampe-v1:" + h.toString(36)'), "der Plan-Schluessel fehlt");
  // Der Hash kommt aus dem Teilen-Link: dieselbe Ladung = derselbe Schluessel,
  // auch auf dem Empfaenger-Geraet.
  assert.ok(/const s = encodePlanURL\(preset, container, cargo, forceCentered, domain\);\n\s*for \(let i = 0; i < s\.length; i\+\+\) h = /.test(roh),
    "der Schluessel haengt nicht am Teilen-Link");
  assert.ok(roh.includes('k.startsWith("cl-rampe-v1:")') && roh.includes("alle.length > 20"),
    "alte Abhaklisten werden nicht aufgeraeumt");
  // Und die Datenschutzseite nennt den Speicher -- dieselbe Ehrlichkeitsregel
  // wie bei jedem localStorage-Schluessel.
  const ds = fs.readFileSync(path.join(dir, "..", "datenschutz.html"), "utf8");
  assert.ok(ds.includes("Abhaklisten des Rampen-Modus"), "die Datenschutzseite nennt die Abhakliste nicht");
});

test("das Oeffnen zaehlt, und beide Sprachen kennen den Modus", () => {
  assert.ok(roh.includes('zaehl("rampen-modus")'), "das Oeffnen wird nicht gezaehlt");
  assert.ok(roh.includes('rampeBtn: "Rampen-Modus"') && roh.includes('rampeBtn: "Ramp mode"'),
    "rampeBtn fehlt in einer Sprache");
  assert.ok(roh.includes('rampeLokal: "Haken bleiben nur auf diesem Ger\\xE4t."')
    && roh.includes('rampeLokal: "Checkmarks stay on this device only."'),
    "der Lokal-Hinweis fehlt in einer Sprache");
});
