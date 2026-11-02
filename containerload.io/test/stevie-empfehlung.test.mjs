// Stevie v6: welcher Container passt -- der Rechner sagt es, nicht das Sprachmodell.
//
// Gemeldet (Jarek, 02.11.26, live auf dem Handy): „i have another package, but its 5,8m x 2,5m x
// 3,0m … which type would u rec" — Stevie: „won't fit a 20' GP (about 5.9 m long, 2.35 m wide
// inside), so the 40' GP or 40' HC is the way to go". Falsch: 250 cm Breite gehen in KEINEN
// Standardcontainer (innen hoechstens 235 cm), 300 cm Hoehe auch nicht (High Cube innen 270).
// Das Banner im Bild sagte zur selben Zeit „Passt nicht in einen Standard-Container — zu breit
// (15 cm über Standard). Empfehlung: 20' Flat Rack". Dann „Switch pls" — Stevie stellte nur den
// Container um und legte das Packstueck nicht an, und als er es auf Nachfrage tat, erfand er 300 kg.
//
// Die Antwort darauf ist dieselbe wie bei der Maximal-Rechnung: Stevie fragt den Rechner
// (Aktion `empfehlen` → empfProbe = dieselbe suggestContainer/suggestEquipment-Kette wie das
// Banner) und gibt nur das Ergebnis wieder. Dieser Test rechnet die Empfehlung mit dem echten
// Code nach und haelt den Vertrag in der App fest.
//
// node --test test/stevie-empfehlung.test.mjs
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
const { empfProbe, PRESETS } = new Function(
  `var num=(v,d=0)=>Number.isFinite(+v)&&v!==""?+v:d;
   ${cut("var PRESETS = {", (l) => l.includes("var panelsFor"))}
   ${cut("function makeFloorPacker", (l, i) => l.trim() === "}" && L[i - 1].includes("single: false"))}
   ${cut("function suggestEquipment", (l, i) => l.trim() === "}" && L[i - 1].includes("combo };"))}
   return { empfProbe, PRESETS };`
)();

const stueck = (l, w, h, extra = {}) => ({ name: "Stück", l, w, h, weight: 0, qty: 1, stackable: true, stackMax: Infinity, stackH: null, rotatable: true, ...extra });

test("das gemeldete Stueck 580 x 250 x 300: kein Standardcontainer, der Rechner empfiehlt den 20' Flat Rack", () => {
  const e = empfProbe([stueck(580, 250, 300)], null);
  assert.equal(e.sug.type, "equip");
  assert.equal(e.sug.name, "20' Flat Rack", "dieselbe Empfehlung wie das Banner im Bild");
  assert.equal(e.ueber.breit, 15, "250 - 235 = 15 cm zu breit");
  assert.equal(e.ueber.hoch, 30, "300 - 270 = 30 cm zu hoch");
  assert.equal(e.ueber.lang, 0);
  assert.deepEqual(e.std, { w: 235, h: 270, l: 1355 }, "die Grenzen kommen aus PRESETS (groesster Standardcontainer)");
  // Was Stevie live behauptet hat, widerlegt der Rechner selbst: in den 40' HC geht es nicht
  assert.ok(Math.min(580, 250) > PRESETS["40' HC"].w, "250 cm sind breiter als der 40' HC innen");
});

test("Normalfall: 11 Europaletten → 1x 20' GP, durch die Tuer", () => {
  const e = empfProbe([stueck(120, 80, 110, { qty: 11, weight: 300, stackable: false, stackMax: 1 })], null);
  assert.equal(e.sug.type, "single");
  assert.equal(e.sug.name, "20' GP");
  assert.equal(e.durchTuer, true);
  assert.deepEqual(e.ueber, { breit: 0, hoch: 0, lang: 0 });
});

test("Tuer-Hinweis: passt hinein, aber nicht durch die Tuer", () => {
  // 260 cm hoch geht in den High Cube (270), aber nicht durch dessen Tuer (258)
  const e = empfProbe([stueck(200, 200, 262)], null);
  assert.equal(e.sug.type, "single");
  assert.ok(/HC/.test(e.sug.name), "nur ein High Cube ist hoch genug");
  assert.equal(e.durchTuer, false, "262 cm gehen nicht durch eine 258-cm-Tuer");
  assert.equal(e.tuer.h, 258);
});

test("zu hoch, aber schmal genug: Open Top; zu lang fuer jedes Deck: Platform", () => {
  const ot = empfProbe([stueck(500, 220, 290)], null);
  assert.equal(ot.sug.type, "equip");
  assert.equal(ot.sug.name, "20' Open Top");
  assert.equal(ot.ueber.hoch, 20);
  const pf = empfProbe([stueck(1300, 250, 200)], null);
  assert.equal(pf.sug.type, "equip");
  assert.ok(/Platform/.test(pf.sug.name), "laenger als jedes Flat-Rack-Deck und zu breit fuer den Open Top: " + pf.sug.name);
});

test("zu schwer und ganzer Plan", () => {
  const schwer = empfProbe([stueck(100, 100, 100, { weight: 40000 })], null);
  assert.equal(schwer.sug.type, "tooheavy");
  // Der ganze Plan: 11 Paletten + das Uebermass-Stueck -> der Rechner kennt das Stueck, das nicht passt
  const plan = empfProbe([stueck(120, 80, 110, { qty: 11 }), stueck(580, 250, 300)], null);
  assert.equal(plan.sug.type, "equip");
  assert.equal(plan.ueber.breit, 15);
  // Nicht drehbare Ware zaehlt so, wie sie eingegeben ist: 240 quer ist zu breit
  const fest = empfProbe([stueck(100, 240, 100, { rotatable: false })], null);
  assert.equal(fest.ueber.breit, 5);
});

// ── Der Vertrag in der App ───────────────────────────────────────────────────

test("die App rechnet empfehlen im Nachzug mit empfProbe und nennt das Ergebnis", () => {
  const anw = roh.slice(roh.indexOf("const kiAktionenAnwenden"), roh.indexOf("const CHAT_NACHZUG"));
  assert.match(anw, /a\.typ === "empfehlen"/, "kiAktionenAnwenden kennt empfehlen");
  assert.match(anw, /pr\.plan = true/, "ohne Position und Ware: der ganze Plan");
  assert.doesNotMatch(anw.slice(anw.indexOf('a.typ === "empfehlen"'), anw.indexOf('a.typ === "maxzahl"')), /setCargo|setzePreset|arbeit\(\)/,
    "empfehlen ist eine reine Rechnung -- der Plan bleibt unberuehrt");
  const eff = roh.slice(roh.indexOf("for (const pr of n.probe)"), roh.indexOf("if (n.ohneKi)"));
  assert.match(eff, /pr\.art === "empfehlen"/);
  assert.match(eff, /empfProbe\(items, carrier\)/, "dieselbe Reederei wie der Plan");
  assert.match(eff, /befund\.push\(empfSatz\(was, e\)\)/, "das Ergebnis reist als Rechenergebnis zu Stevie");
  assert.match(eff, /domain !== "sea"/, "auf der Strasse keine erfundene Container-Empfehlung");
  // Der Satz nennt Achsen, Grenze und Empfehlung -- Stevie soll den Grund wiedergeben
  const satz = roh.slice(roh.indexOf("const empfSatz"), roh.indexOf("const maxBedKurz"));
  assert.match(satz, /cm zu breit/);
  assert.match(satz, /cm zu hoch/);
  assert.match(satz, /Standardcontainer innen höchstens/);
  assert.match(satz, /Empfehlung des Rechners: \$\{s2\.name\} \(Special Equipment\)/);
  assert.match(satz, /geht aber nicht durch dessen Tür/);
});

test("die Fakten tragen, was das Bild meldet: Empfehlungsbanner und Tuer-Warnung", () => {
  const pf = roh.slice(roh.indexOf("const planFakten"), roh.indexOf("const briefFakten"));
  assert.match(pf, /zeigeBanner && !empfBesser/, "dieselbe Bedingung wie das Banner; recBetter steht schon in gruende");
  for (const t of ["recRot", "recSingle", "recMulti", "recTooBig", "recTooHeavy", "recVehicles", "recEquip", "recNoFit"]) {
    assert.ok(pf.includes("T." + t + "("), `Bannerzweig ${t} fehlt in den Fakten`);
  }
  assert.match(pf, /doorFails && doorFails\.length/, "die Tuer-Warnung gehoert dazu");
  assert.match(pf, /"Im Bild: "/);
});

test("Platform ist ueberall waehlbar, wo Stevie den Container umstellt", () => {
  // Die App nimmt jeden echten PRESETS-Namen (applyPreset nur im See-Modus) -- die
  // Whitelist auf dem Server muss die Platform deshalb kennen, sonst faellt die
  // Umstellung auf eine Rechner-Empfehlung still weg.
  assert.match(roh, /"20' Platform": \{/);
  assert.match(roh, /domain === "sea" && PRESETS\[a\.preset\] && a\.preset !== preset/);
});
