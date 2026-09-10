// Multi-Stopp: die Entladereihenfolge bestimmt die Stauung (LIFO).
//
// Jede Position kann einen Stopp tragen. Der Plan wird dann so gestaut, dass
// Stopp 1 an der Tuer steht (wird zuerst entladen, also zuletzt geladen) und
// die hoechste Nummer an der Stirnwand; Ware ohne Stopp liegt ganz vorn und
// bleibt bis zuletzt geladen. Ware verschiedener Stopps wird NICHT vermischt --
// weder gestapelt noch in Luecken der anderen eingesickert. Das kann
// Stellplaetze kosten, und dieser Preis wird ausgewiesen, nicht versteckt.
//
// node --test test/multi-stopp.test.mjs
import fs from "node:fs";
import assert from "node:assert";
import test from "node:test";
import { fileURLToPath } from "node:url";
import path from "node:path";

const dir = path.dirname(fileURLToPath(import.meta.url));
const roh = fs.readFileSync(path.join(dir, "..", "app.html"), "utf8");
const L = roh.split("\n");
const zeile = (von) => { const i = L.findIndex((l) => l.includes(von)); assert.ok(i >= 0, `nicht gefunden: ${von}`); return i; };

// ── Packer-Slice: makeFloorPacker..packCargo plus stoppWerte/stoppPacken/slotPacken ──
const a = zeile("function makeFloorPacker");
const b = L.findIndex((l, i) => i > a && l.trim() === "}" && L[i - 1].includes("return { placed, perType"));
const c = zeile("function slotPins");
const e = zeile("function ketteBesser");
const M = new Function(
  'var num=(v,d=0)=>Number.isFinite(+v)&&v!==""?+v:d;\n'
  + 'var packSortenrein = () => { throw new Error("sortenrein darf mit Stopps nie laufen"); };\n'
  + 'var sortenReihenfolge = () => [];\n'
  + L.slice(a, b + 1).join("\n") + "\n" + L.slice(c, e).join("\n")
  + "\nreturn { packCargo, stoppWerte, stoppPacken, slotPacken, slotPins };"
)();

const C40 = { l: 1203, w: 235, h: 239, payload: 26600 };
const PAL = (stop, qty, extra) => ({ l: 120, w: 80, h: 110, weight: 300, qty, stackable: false, rotatable: true, stop, ...extra });
const span = (placed, ti) => {
  const l = placed.filter((p) => p.ti === ti);
  return l.length ? [Math.min(...l.map((p) => p.x)), Math.max(...l.map((p) => p.x + p.dx))] : null;
};

test("Stopp 1 steht an der Tuer, hohe Stopps an der Stirnwand, ohne Stopp ganz vorn", () => {
  const cargo = [PAL(1, 8), PAL(2, 8), { l: 100, w: 100, h: 100, weight: 200, qty: 4, stackable: false, rotatable: true, stop: null }];
  const r = M.slotPacken(C40, cargo, 0, null, { noHint: true }, false);
  assert.strictEqual(r.boxes, 20, "alles muss verladen sein");
  const s1 = span(r.placed, 0), s2 = span(r.placed, 1), s0 = span(r.placed, 2);
  // Reihenfolge laengs: ohne Stopp | Stopp 2 | Stopp 1 (Tuer = grosses x).
  assert.ok(s0[1] <= s2[0] + 1e-6, `ohne Stopp muss VOR Stopp 2 liegen (${s0} vs ${s2})`);
  assert.ok(s2[1] <= s1[0] + 1e-6, `Stopp 2 muss VOR Stopp 1 liegen (${s2} vs ${s1})`);
});

test("ueber eine Stoppgrenze wird weder gestapelt noch eingesickert", () => {
  // Stapelbare Ware zweier Stopps: kein Stueck des einen Stopps darf auf einem
  // des anderen stehen, und kein spaeteres Stueck vor der Grenze des fruehren.
  const cargo = [
    { l: 120, w: 80, h: 60, weight: 100, qty: 12, stackable: true, rotatable: true, stop: 1 },
    { l: 120, w: 80, h: 60, weight: 100, qty: 12, stackable: true, rotatable: true, stop: 2 }
  ];
  const r = M.slotPacken(C40, cargo, 0, null, { noHint: true }, false);
  assert.strictEqual(r.boxes, 24);
  for (const A of r.placed) {
    if (A.y < 1e-6) continue;
    // Traeger suchen: wer unter A liegt, muss denselben Stopp tragen.
    for (const B of r.placed) {
      if (B === A || Math.abs(B.y + B.dy - A.y) > 1e-3) continue;
      const ox = Math.min(A.x + A.dx, B.x + B.dx) - Math.max(A.x, B.x);
      const oz = Math.min(A.z + A.dz, B.z + B.dz) - Math.max(A.z, B.z);
      if (ox > 1e-6 && oz > 1e-6) assert.strictEqual(cargo[A.ti].stop, cargo[B.ti].stop,
        "ein Stueck steht auf Ware eines anderen Stopps");
    }
  }
  const s1 = span(r.placed, 0), s2 = span(r.placed, 1);
  assert.ok(s2[1] <= s1[0] + 1e-6, "Stopp 1 muss komplett hinter Stopp 2 liegen");
});

test("die Zuladung gilt ueber alle Wellen zusammen", () => {
  // Zwei Wellen a 10 x 2000 kg auf 26.600 kg: zusammen 40 t -- es duerfen nur
  // 13 Stueck mitfahren, egal wie sie sich auf die Stopps verteilen.
  const cargo = [PAL(1, 10, { weight: 2e3 }), PAL(2, 10, { weight: 2e3 })];
  const r = M.slotPacken(C40, cargo, 0, null, { noHint: true }, false);
  assert.ok(r.weight <= C40.payload + 1e-6, `Zuladung ueberschritten: ${r.weight}`);
  assert.strictEqual(r.boxes, 13, `13 x 2000 kg passen, nicht ${r.boxes}`);
});

test("ohne Stopps aendert sich NICHTS -- stoppWerte liefert null, der alte Weg laeuft", () => {
  assert.strictEqual(M.stoppWerte([PAL(null, 5), PAL(void 0, 3)]), null);
  const cargo = [{ ...PAL(null, 20), stackable: true }];
  const mit = M.slotPacken(C40, cargo, 0, null, { noHint: true }, false);
  const ohne = M.packCargo(C40, cargo, { noHint: true });
  assert.strictEqual(mit.boxes, ohne.boxes, "ohne Stopps muss slotPacken = packCargo sein");
});

test("der Preis der Anweisung ist sichtbar: Segregation kann Stellplaetze kosten -- und meldet sie offen", () => {
  // 2 Sorten, die gemischt einen 20-Fuesser exakt fuellen wuerden; getrennt
  // gestaut bleibt etwas offen. Der Rest wird als offen GEMELDET, nicht
  // stillschweigend hineingemischt.
  const C20 = { l: 590, w: 235, h: 239, payload: 28200 };
  const cargo = [
    { l: 120, w: 80, h: 100, weight: 100, qty: 11, stackable: false, rotatable: true, stop: 1 },
    { l: 110, w: 110, h: 100, weight: 100, qty: 8, stackable: false, rotatable: true, stop: 2 }
  ];
  const mit = M.slotPacken(C20, cargo, 0, null, { noHint: true }, false);
  const perOffen = mit.perType.reduce((s, p) => s + (p.total - p.loaded), 0);
  assert.strictEqual(mit.totalBoxes - mit.boxes, perOffen, "offene Stuecke muessen in perType auftauchen");
  // Und die Trennung haelt trotzdem:
  const s1 = span(mit.placed, 0), s2 = span(mit.placed, 1);
  if (s1 && s2) assert.ok(s2[1] <= s1[0] + 1e-6, "Segregation gebrochen, um Platz zu sparen");
});

test("Zuweisung + Stopp zusammen: die Stopp-Reihenfolge dominiert, gepinnt bleibt bedient", () => {
  const cargo = [PAL(1, 4, { slot: 0 }), PAL(2, 4, { slot: 0 })];
  const pins = M.slotPins(cargo);
  const r = M.slotPacken(C40, cargo, 0, pins, { noHint: true }, false);
  assert.strictEqual(r.boxes, 8);
  const s1 = span(r.placed, 0), s2 = span(r.placed, 1);
  assert.ok(s2[1] <= s1[0] + 1e-6, "auch mit Zuweisung muss Stopp 1 zur Tuer");
});

// ── Der Teilen-Link traegt den Stopp (Tag "T", Codetabelle nur ergaenzt) ──
const s = L.findIndex((l) => l.includes("// V2-ENCODE-BEGIN"));
const e2 = L.findIndex((l, i) => i > s && l.includes("// V2-ENCODE-END"));
const { compactEncode, compactDecode } = new Function(L.slice(s, e2 + 1).join("\n") + "\nreturn { compactEncode, compactDecode };")();

test("der Stopp ueberlebt den kompakten Encode/Decode-Round-Trip", () => {
  const st = { dm: "sea", pr: "Custom", co: { l: 590, w: 235, h: 239, p: 28200 }, it: [{ l: 120, w: 80, h: 110, wt: 0, q: 4, s: 1, r: 1, st: 2 }] };
  const enc = compactEncode(st, { presets: {}, vehicles: {} });
  assert.ok(enc.includes("T2"), `der T-Tag fehlt: ${enc}`);
  const dec = compactDecode(enc);
  assert.strictEqual(dec.it[0].st, 2, "der Stopp ging im Link verloren");
});

test("Alt-Links ohne T-Tag dekodieren unveraendert -- und tragen keinen Stopp", () => {
  const dec = compactDecode("z" + "g590x235x239x28200" + "~120x80x110w300q4");
  assert.ok(dec && dec.it[0]);
  assert.strictEqual(dec.it[0].st, void 0, "ein Alt-Link darf keinen Stopp erfinden");
});

// ── Das PDF: Entladereihenfolge je Blatt ──
const cutFn = (von) => {
  const i = zeile(von);
  const j = L.findIndex((l, k) => k > i && l.trim() === "};" && L[k - 1].includes("</div>`;"));
  assert.ok(j > i, `Funktionsende nicht gefunden: ${von}`);
  return L.slice(i, j + 1).join("\n");
};
const { LV_STOPPS } = new Function(cutFn("var LV_STOPPS = (placed") + "\nreturn { LV_STOPPS };")();

test("LV_STOPPS: Stopp 1 zuerst, ohne Stopp zuletzt, mit Bereich in Metern", () => {
  const cargo = [{ stop: 2 }, { stop: 1 }, {}];
  const placed = [
    { ti: 2, x: 0, dx: 100 }, { ti: 0, x: 120, dx: 100 }, { ti: 0, x: 220, dx: 100 },
    { ti: 1, x: 400, dx: 100 }
  ];
  const html = LV_STOPPS(placed, cargo, { 0: 1, 1: 2, 2: 3 }, "de");
  assert.ok(html.includes("ENTLADEREIHENFOLGE"));
  const i1 = html.indexOf("Stopp 1"), i2 = html.indexOf("Stopp 2"), i0 = html.indexOf("Ohne Stopp");
  assert.ok(i1 >= 0 && i2 > i1 && i0 > i2, "Reihenfolge muss Stopp 1, Stopp 2, ohne Stopp sein");
  assert.ok(html.includes("4,0–5,0 m"), `Bereich von Stopp 1 fehlt: ${html.slice(0, 300)}`);
  assert.ok(html.includes("2 Stk"), "Stueckzahl je Stopp fehlt");
  // Ohne Stopps auf dem Blatt: kein Block.
  assert.strictEqual(LV_STOPPS(placed, [{}, {}, {}], {}, "de"), "");
  // Englisch heisst englisch.
  const en = LV_STOPPS(placed, cargo, { 0: 1, 1: 2, 2: 3 }, "en");
  assert.ok(en.includes("UNLOADING ORDER") && !en.includes("Stirnwand"));
});

// ── Vertraege im Quelltext ──
test("mit Stopps schweigen sortenrein, Stufe 3 und der Guenstiger-Vorschlag", () => {
  assert.strictEqual((roh.match(/if \(!stopps && gemischt && sorten > 1/g) || []).length, 2,
    "die sortenreine Kette muss mit Stopps in BEIDEN Ketten aussetzen");
  assert.strictEqual((roh.match(/if \(!stopps && chain\.length > 1 && chain\.length <= MAXDRAW && mehrsortig\)/g) || []).length, 2,
    "Stufe 3 muss mit Stopps in BEIDEN Ketten aussetzen");
  assert.ok(/empfBesser = !!\(planFit && ketteKosten && sugKosten && sugLabel && !stoppWerte\(cargo\)/.test(roh),
    "der Guenstiger-Vorschlag rechnet ohne Wellen und muss mit Stopps schweigen");
});

test("beide Blattsorten haengen die Entladereihenfolge an, das Deckblatt nicht", () => {
  assert.ok(roh.includes("+ LV_STOPPS(placed, cargo, tiPos, LANG) + LV_GEWICHT"),
    "das einzelne Blatt traegt keine Entladereihenfolge");
  assert.ok(roh.includes("+ LV_STOPPS(sp, cargo, tiP, LANG) + LV_GEWICHT"),
    "die Container-Blaetter tragen keine Entladereihenfolge");
});

test("der Stopp reist auch im ?p=-Format und faellt beim Lesen auf 1..9 zurueck", () => {
  assert.ok(/st: Number\.isInteger\(c\.stop\) && c\.stop >= 1 \? Math\.min\(9, c\.stop\) : void 0/.test(roh),
    "planStateFrom traegt den Stopp nicht");
  assert.ok(/stop: \+r\.st >= 1 \? Math\.min\(9, Math\.round\(\+r\.st\)\) : null/.test(roh),
    "decodePlanState liest den Stopp nicht (oder ohne Klemme)");
});
