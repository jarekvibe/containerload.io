// Strg+Z nimmt eine Stevie-Antwort GANZ zurueck — Container und Reederei eingeschlossen.
//
// Gemeldet (30.10.26): 20' GP, 8x Package 120x80x110, stapelbar. An Stevie: „Stell bitte auf
// 22 Stueck um, nicht stapelbar, und nimm den Container, in den das passt." Stevie stellte
// 40' GP, 22 Stueck, nicht stapelbar. Ein Strg+Z setzte Menge und Stapeln zurueck, der
// Container blieb auf 40' GP — und jedes weitere Strg+Z tat nichts mehr. Der Stapel merkte
// nur die Ladung; den Containerwechsel hatte er nie gesehen.
//
// Jetzt gilt: alle Aenderungen aus EINER Stevie-Nachricht sind EIN Schritt, auch wenn sie
// sich ueber Antwort und Nachzug-Runde verteilen. Und jeder Containerwechsel von Hand
// (Auswahl, „Uebernehmen" im Hinweis, Empfehlungs-Dialog, Reederei) ist ein eigener Schritt.
//
// Die Funktionen laufen hier mit dem echten Quelltext aus app.html, gegen einen kleinen
// Zustand, der sich wie React verhaelt: jeder „Render" sieht den Stand von damals.
//
// node --test test/stevie-undo.test.mjs
import fs from "node:fs";
import assert from "node:assert";
import test from "node:test";
import { fileURLToPath } from "node:url";
import path from "node:path";

const dir = path.dirname(fileURLToPath(import.meta.url));
const roh = fs.readFileSync(path.join(dir, "..", "app.html"), "utf8");
const L = roh.split("\n");
const zeilen = (von, bis) => {
  const s = L.findIndex((l) => l.includes(von));
  const e = L.findIndex((l, i) => i > s && l.includes(bis));
  assert.ok(s >= 0 && e > s, `Ausschnitt nicht gefunden: ${von}`);
  return L.slice(s, e).join("\n");
};

const { PRESETS, VEHICLES, CARRIERS, applyCarrier } = new Function(
  `${zeilen("var PRESETS = {", "var panelsFor")}
   return { PRESETS, VEHICLES, CARRIERS, applyCarrier };`
)();

// Die deutschen Texte, die der Hinweis nach dem Zuruecknehmen zeigt — aus dem Woerterbuch.
const deZeile = (k) => {
  const z = L.find((l) => l.trim().startsWith(k + ":"));
  assert.ok(z, `${k} fehlt im Woerterbuch`);
  return new Function(`return ({ ${z.trim().replace(/,$/, "")} }).${k};`)();
};
const T = new Proxy({ undone: "R\xFCckg\xE4ngig gemacht", undoneWas: deZeile("undoneWas"), undoTeil: deZeile("undoTeil") },
  { get: (o, k) => k in o ? o[k] : (...a) => `${String(k)}(${a.join(",")})` });

const QUELLE = [
  zeilen("const setzePreset = (p) => {", "const pickCarrier = (cn) => {"),
  zeilen("const pickCarrier = (cn) => {", "const openRec = () =>"),
  zeilen("const switchDomain = (d) => {", "// Manuelle Container-Wahl"),
  zeilen("const uebernehmeKombi = (combo) => {", "const upd = (id, k, v) =>"),
  zeilen("const merk = (cs) =>", "// Ein Hinweis, der etwas anbieten kann"),
  zeilen("const sag = (msg, akt) =>", "const del = (id) =>"),
  zeilen("const stevieMerk = (was, gewechselt) => {", "// Die Nachzug-Nachricht ist eine feste"),
].join("\n");

const SETTER = ["setDomain", "setPreset", "setContainer", "setCarrier", "setCargo", "setChainOverride", "setHist",
  "setToast", "setToastAct", "setForceCentered", "setManualMode", "setManualArmed", "setManualSel"];
const bauen = new Function("S", "stevieTx", "PRESETS", "VEHICLES", "CARRIERS", "applyCarrier", "T", "window",
  `const { domain, preset, container, carrier, cargo, chainOverride } = S.state;
   const CARRIER_KEY = "containerload.carrier.v1";
   const num = (v, d = 0) => Number.isFinite(+v) && v !== "" ? +v : d;
   let uidN = 0; const uid = () => "u" + (++uidN);
   // Wie React: ein Updater bekommt den aktuellen Stand; erst rechnen, dann eintragen.
   const setze = (k) => (v) => { const neu = typeof v === "function" ? v(S.state[k]) : v; S.state = { ...S.state, [k]: neu }; };
   const [${SETTER.join(", ")}] = ${JSON.stringify(SETTER.map((x) => x[3].toLowerCase() + x.slice(4)))}.map(setze);
   ${QUELLE}
   return { applyPreset, pickCarrier, switchDomain, uebernehmeKombi, merk, undo, kiAktionenAnwenden };`);

const speicher = {};
const fenster = { localStorage: { setItem: (k, v) => { speicher[k] = v; } } };
const EUR = () => ({ id: "p1", name: "Package", l: 120, w: 80, h: 110, weight: 300, qty: 8, stackable: true, stackMax: Infinity, stackH: null, rotatable: true });
// Der gemeldete Ausgangsplan — mit Reederei, damit auch deren Masse zurueckkommen muessen.
const start = () => ({
  state: {
    domain: "sea", preset: "20' GP", carrier: "Yang Ming", container: applyCarrier(PRESETS["20' GP"], "Yang Ming", "20' GP"),
    cargo: [EUR()], chainOverride: {}, hist: [], toast: "", toastAct: null,
  },
});
const tx = () => ({ current: 0 });
const render = (S, stevieTx) => bauen(S, stevieTx, PRESETS, VEHICLES, CARRIERS, applyCarrier, T, fenster);
const plan = (S) => JSON.parse(JSON.stringify((({ domain, preset, container, carrier, cargo, chainOverride }) =>
  ({ domain, preset, container, carrier, cargo, chainOverride }))(S.state)));
const REPRO = [
  { typ: "container", preset: "40' GP" },
  { typ: "menge", position: 1, anzahl: 22 },
  { typ: "stapeln", position: 1, wert: "nein" },
];
// Strg+Z wie im Tasten-Effekt: ohne Eintrag passiert nichts.
const strgZ = (S, t) => { if (!S.state.hist.length) return false; render(S, t).undo(); return true; };

test("der gemeldete Fall: ein Strg+Z, und der Plan ist exakt wie vor der Nachricht", () => {
  const S = start(), t = tx();
  const vorher = plan(S);
  t.current += 1; // chatSenden
  render(S, t).kiAktionenAnwenden(REPRO);
  assert.strictEqual(S.state.preset, "40' GP");
  assert.strictEqual(S.state.cargo[0].qty, 22);
  assert.strictEqual(S.state.cargo[0].stackable, false);
  assert.strictEqual(S.state.hist.length, 1, "eine Stevie-Antwort ist EIN Schritt");

  assert.ok(strgZ(S, t));
  assert.deepStrictEqual(plan(S), vorher, "Container, Masse, Reederei, Menge, Stapeln — alles wie vorher");
  assert.strictEqual(S.state.hist.length, 0);
  assert.strictEqual(S.state.toast, "R\xFCckg\xE4ngig: Container, Menge, Stapeln", "der Hinweis sagt, was zurueckkam");
  assert.strictEqual(strgZ(S, t), false, "ein weiteres Strg+Z hat nichts mehr zu tun");
  assert.deepStrictEqual(plan(S), vorher);
});

test("verteilt ueber Antwort und Nachzug-Runde bleibt es EIN Schritt", () => {
  const S = start(), t = tx();
  const vorher = plan(S);
  t.current += 1;
  render(S, t).kiAktionenAnwenden([REPRO[0]]);            // Antwort: Container
  render(S, t).kiAktionenAnwenden([REPRO[1], REPRO[2]]);  // Nachzug: Menge + Stapeln, frischer Render
  assert.strictEqual(S.state.hist.length, 1, "der Nachzug darf keinen zweiten Schritt anlegen");
  assert.ok(strgZ(S, t));
  assert.deepStrictEqual(plan(S), vorher);
  assert.strictEqual(S.state.toast, "R\xFCckg\xE4ngig: Container, Menge, Stapeln");
  // Und andersherum: erst die Ladung, im Nachzug der Container.
  const S2 = start(), t2 = tx();
  const vorher2 = plan(S2);
  t2.current += 1;
  render(S2, t2).kiAktionenAnwenden([REPRO[1]]);
  render(S2, t2).kiAktionenAnwenden([REPRO[0], REPRO[2]]);
  assert.strictEqual(S2.state.hist.length, 1);
  strgZ(S2, t2);
  assert.deepStrictEqual(plan(S2), vorher2, "der spaeter gewechselte Container kommt mit zurueck");
});

test("zwei Nachrichten sind zwei Schritte — jeder zurueck auf seinen Vorher-Stand", () => {
  const S = start(), t = tx();
  const ganzVorher = plan(S);
  t.current += 1;
  render(S, t).kiAktionenAnwenden([REPRO[0]]);
  const nachEins = plan(S);
  t.current += 1;
  render(S, t).kiAktionenAnwenden([REPRO[1], REPRO[2]]);
  assert.strictEqual(S.state.hist.length, 2);
  strgZ(S, t);
  assert.deepStrictEqual(plan(S), nachEins);
  strgZ(S, t);
  assert.deepStrictEqual(plan(S), ganzVorher);
});

test("Fragen und Rechnungen legen keinen Schritt an", () => {
  const S = start(), t = tx();
  t.current += 1;
  const erg = render(S, t).kiAktionenAnwenden([{ typ: "maxzahl", position: 1, stapeln: "nein" }, { typ: "container", preset: "20' GP" }]);
  assert.strictEqual(erg.geaendert, false);
  assert.strictEqual(S.state.hist.length, 0, "keine Aenderung, kein Schritt (derselbe Container zaehlt nicht)");
});

test("Container von Hand, „Uebernehmen\" und Kombi: je ein Schritt, die Ladung bleibt, wie sie ist", () => {
  const S = start(), t = tx();
  const vorher = plan(S);
  render(S, t).applyPreset("40' HC");
  assert.strictEqual(S.state.hist.length, 1);
  assert.strictEqual(S.state.hist[0].cargo, undefined, "ein Container-Schritt traegt keine Ladung");
  // Eine Eingabe danach (Zahlenfeld — kein eigener Schritt) ueberlebt das Zuruecknehmen.
  S.state = { ...S.state, cargo: [{ ...S.state.cargo[0], qty: 9 }] };
  strgZ(S, t);
  assert.deepStrictEqual({ ...plan(S), cargo: vorher.cargo }, vorher, "der Container ist zurueck");
  assert.strictEqual(S.state.cargo[0].qty, 9, "die Ladung wurde nicht mit zurueckgedreht");
  assert.strictEqual(S.state.toast, "R\xFCckg\xE4ngig: Container");

  render(S, t).applyPreset("20' GP");
  assert.strictEqual(S.state.hist.length, 0, "derselbe Container ist kein Schritt");

  const S2 = start();
  const vorher2 = plan(S2);
  render(S2, t).uebernehmeKombi([{ name: "40' HC", count: 2 }, { name: "40' GP", count: 1 }]);
  assert.strictEqual(S2.state.hist.length, 1, "C1 und Folgeslots sind EIN Schritt");
  strgZ(S2, t);
  assert.deepStrictEqual(plan(S2), vorher2, "C1 und die gepinnten Folgeslots sind zurueck");
});

test("die Reederei kommt mit zurueck — auch in den Speicher", () => {
  const S = start(), t = tx();
  const vorher = plan(S);
  render(S, t).pickCarrier("");
  assert.notDeepStrictEqual(S.state.container, vorher.container, "ohne andere Masse testete das nichts");
  strgZ(S, t);
  assert.deepStrictEqual(plan(S), vorher);
  assert.strictEqual(speicher["containerload.carrier.v1"], "Yang Ming");
  assert.strictEqual(S.state.toast, "R\xFCckg\xE4ngig: Reederei");
});

test("ein Ladungs-Schritt dreht keinen Containerwechsel mit zurueck", () => {
  const S = start(), t = tx();
  render(S, t).applyPreset("40' GP");
  const r = render(S, t);
  r.merk(S.state.cargo); // wie del(): erst merken, dann loeschen
  S.state = { ...S.state, cargo: [] };
  strgZ(S, t);
  assert.strictEqual(S.state.cargo.length, 1, "die Position ist zurueck");
  assert.strictEqual(S.state.preset, "40' GP", "der Container bleibt — das war ein eigener Schritt");
  strgZ(S, t);
  assert.strictEqual(S.state.preset, "20' GP");
});

test("beim Wechsel See/Strasse fallen die Container-Schritte weg, die Ladungs-Schritte bleiben", () => {
  const S = start(), t = tx();
  t.current += 1;
  render(S, t).kiAktionenAnwenden(REPRO);
  render(S, t).applyPreset("40' HC");
  render(S, t).switchDomain("road");
  assert.strictEqual(S.state.hist.length, 1, "nur Stevies Schritt bleibt (er traegt Ladung)");
  assert.strictEqual(S.state.hist[0].cont, undefined, "ein 40' GP laesst sich im Strassen-Modus nicht zuruecknehmen");
  strgZ(S, t);
  assert.strictEqual(S.state.domain, "road");
  assert.strictEqual(S.state.preset, "Planensattel", "das Fahrzeug bleibt");
  assert.strictEqual(S.state.cargo[0].qty, 8, "die Ladung ist zurueck");
  assert.strictEqual(S.state.toast, "R\xFCckg\xE4ngig: Menge, Stapeln");
});

test("der Vertrag im Quelltext", () => {
  assert.match(roh, /stevieTx\.current \+= 1;/, "jede Nachricht braucht ihre eigene Nummer");
  const tastatur = zeilen("// Strg+Z / Cmd+Z.", "window.addEventListener(\"keydown\", onKey)");
  assert.match(tastatur, /dataset\.planUndo === "1" && !e\.target\.value/, "im leeren Stevie-Feld nimmt Strg+Z den Plan zurueck");
  assert.ok(roh.includes(`"data-plan-undo": "1"`), "das Stevie-Feld traegt die Markierung nicht");
  for (const k of ["undoneWas:", "undoTeil:"]) assert.strictEqual(roh.split(k).length - 1, 2, `${k} fehlt in DE oder EN`);
  // Alle Wege zum Container laufen ueber applyPreset (mit Schritt) — ausser Stevie und Kombi,
  // die ihren Schritt selbst merken.
  const ohneSchritt = [...roh.matchAll(/setzePreset\(/g)].length;
  assert.strictEqual(ohneSchritt, 3, `setzePreset hat ${ohneSchritt} Aufrufer statt 3 (applyPreset, Stevie, Kombi)`);
});
