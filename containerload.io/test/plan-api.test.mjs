// /api/plan -- der Rechner als Daten, fuer KI-Assistenten, Tabellen und ERP/TMS.
// Fahrplan Baustein 5, Jareks Zusage vom 26.11.26 ("Rechner fuer KI-Assistenten ja").
//
// Was dieser Test festhaelt:
//   1. ES RECHNET DER PACKER DES RECHNERS. Der Rechenkern der Functions
//      (netlify/functions/lib/rechenkern.mjs) ist Zeichen fuer Zeichen aus app.html
//      geschnitten (werkzeug/rechenkern.mjs) -- und rechnet als Modul (strikt) dasselbe wie
//      im Browser (locker).
//   2. DERSELBE ABLAUF WIE IM RECHNER. Der Test rechnet jede Antwort ein zweites Mal nach,
//      direkt mit dem Kern aus app.html und in den Schritten des Rechners (packKind, dann die
//      Kette) -- unabhaengig von lib/plan.mjs.
//   3. DIESELBEN PARAMETER WIE DER LINK, und plan_url oeffnet genau die Rechnung der Antwort.
//   4. EHRLICH UND SPARSAM: Hinweise in jeder Antwort, Deckel, nichts gespeichert ausser
//      einer Zahl je Tag, keine IP.
//   5. WAS DIE SEITEN ZEIGEN, ANTWORTET DIE SCHNITTSTELLE AUCH (Beispiele, openapi.json).
//
// "@netlify/blobs" gibt es in der CI nicht (kein npm install) -- ein Lade-Haken ersetzt das
// Paket durch einen Speicher im Arbeitsspeicher (wie test/functions-antworten).
//
// node --test test/plan-api.test.mjs
import fs from "node:fs";
import assert from "node:assert";
import test from "node:test";
import { register } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { rechenkern, EXPORTE } from "../../werkzeug/rechenkern.mjs";
import { seiteMitAuszug, llmsMitSatz, beispielAdresse, parameter, SEITEN } from "../../werkzeug/api-beispiele.mjs";

const dir = path.dirname(fileURLToPath(import.meta.url));
const wurzel = path.join(dir, "..");
const FN = path.join(wurzel, "..", "netlify", "functions");
const lese = (f) => fs.readFileSync(path.join(wurzel, f), "utf8");
const app = lese("app.html");

register("data:text/javascript," + encodeURIComponent(
  `export async function resolve(spec, ctx, next) {
     if (spec === "@netlify/blobs") return { url: ${JSON.stringify("data:text/javascript," + encodeURIComponent("export const getStore = (name) => globalThis.__clPlanBlobs(name);"))}, shortCircuit: true };
     return next(spec, ctx);
   }`));
// Der Speicher: ein Zaehlerstand je Schluessel, und ein Protokoll dessen, was geschrieben wurde
const speicher = (stand = {}) => {
  const log = [];
  globalThis.__clPlanBlobs = (name) => ({
    get: async (k) => (stand[name + "/" + k] === undefined ? null : stand[name + "/" + k]),
    setJSON: async (k, v) => { stand[name + "/" + k] = v; log.push([name, k, v]); },
  });
  return log;
};
speicher();

const kern = await import(path.join(FN, "lib", "rechenkern.mjs"));
const { planen, planAdresse, GRENZEN, FZ_EN, BASIS } = await import(path.join(FN, "lib", "plan.mjs"));
const fn = await import(path.join(FN, "plan.mjs"));
const { PLAN_TAGESLIMIT } = await import(path.join(FN, "lib", "deckel.mjs"));

// Der Kern aus app.html, geladen wie im Browser: als gewoehnliches Skript (nicht strikt)
const L = app.split("\n");
const ka = L.findIndex((l) => l.includes("// EQUIPMENT-BEGIN")), kb = L.findIndex((l) => l.includes("var LANG = (() => {"));
const ausApp = new Function("React", "THREE", "window", "document", L.slice(ka, kb).join("\n") + `\nreturn { ${EXPORTE.join(", ")} };`)({ createElement: () => null }, {}, {}, {});

const ok = (roh) => { const r = planen(roh); assert.strictEqual(r.status, 200, JSON.stringify(r.body).slice(0, 300)); assert.strictEqual(r.body.ok, true, JSON.stringify(r.body).slice(0, 300)); return r.body; };
const param = (adresse) => new URLSearchParams(adresse.slice(adresse.indexOf("?") + 1));

// ── 1. Der Rechenkern ────────────────────────────────────────────────────────────────────

test("der Rechenkern der Functions ist Zeichen fuer Zeichen der aus app.html", () => {
  const soll = rechenkern(app);
  assert.strictEqual(fs.readFileSync(path.join(FN, "lib", "rechenkern.mjs"), "utf8"), soll,
    "netlify/functions/lib/rechenkern.mjs ist veraltet oder von Hand geaendert -- node werkzeug/rechenkern.mjs laufen lassen");
  // Der Bereich enthaelt, was rechnet -- und das Modul gibt es heraus
  for (const n of EXPORTE) assert.ok(kern[n] !== undefined, `der Rechenkern gibt ${n} nicht heraus`);
  assert.ok(soll.length > 150000, "der Bereich ist auffaellig klein -- Anfang und Ende geprueft?");
  // Die Tabellen des Link-Formats sind die aus app.html
  const tabelle = (anker) => { const i = L.findIndex((l) => l.includes(anker)); return new Function("return " + L.slice(i, i + 8).join("\n").match(/const k = (\{[\s\S]*?\});/)[1])(); };
  assert.deepStrictEqual(kern.CONT_CODES, tabelle("var QCONT = (() => {"));
  assert.deepStrictEqual(kern.FZ_CODES, tabelle("var QFZ = (() => {"));
  assert.deepStrictEqual(kern.EINHEITEN, new Function("return " + app.match(/var EINHEITEN = (\[[^\]]*\])/)[1])());
  assert.deepStrictEqual(kern.SPRACHEN, ["de", "en", ...Object.keys(new Function("return " + app.match(/window\.CL_SPRACHEN = (\{[^\n]*\});/)[1])())]);
  // Jedes Kuerzel zeigt auf einen Container bzw. ein Fahrzeug, das es gibt
  for (const n of Object.values(kern.CONT_CODES)) assert.ok(kern.PRESETS[n], n);
  for (const n of Object.values(kern.FZ_CODES)) assert.ok(kern.VEHICLES[n], n);
});

test("als Modul (strikt) rechnet der Kern dasselbe wie im Browser", () => {
  // Ein Modul laeuft im strikten Modus, das Skript in app.html nicht. Derselbe Text kann
  // sich darin anders verhalten -- deshalb beide nebeneinander, Kiste fuer Kiste.
  let seed = 11; const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  const kisten = (liste) => liste.map((b) => [b.ti, b.x, b.y, b.z, b.dx, b.dy, b.dz]);
  for (let fall = 0; fall < 24; fall++) {
    const n = 1 + Math.floor(rnd() * 5);
    const cargo = Array.from({ length: n }, (_, i) => ({ id: "t" + i, name: "T" + i, l: 30 + Math.floor(rnd() * 200), w: 30 + Math.floor(rnd() * 120), h: 20 + Math.floor(rnd() * 150),
      weight: 10 + Math.floor(rnd() * 900), qty: 1 + Math.floor(rnd() * 30), stackable: rnd() > 0.3, stackH: rnd() > 0.8 ? 200 : null, rotatable: rnd() > 0.2 }));
    const strasse = fall % 4 === 3;
    const name = strasse ? ["Planensattel", "7,5-Tonner"][fall % 2] : ["20' GP", "40' HC", "20' Open Top", "40' Flat Rack"][fall % 4];
    const lauf = (K) => {
      const p = { ...(strasse ? K.VEHICLES[name] : K.PRESETS[name]) };
      const r = K.packKind(p, cargo, {}, false);
      const ch = r.boxes > 0 && r.boxes < r.totalBoxes ? (strasse ? K.chainVehicles(p, name, cargo, r, {}, K.MAXCHAIN) : K.chainContainers(p, name, cargo, r, {}, K.MAXCHAIN, "")) : null;
      return JSON.stringify([r.boxes, r.totalBoxes, kisten(r.placed), ch && ch.remainingBoxes, ch && ch.chain.map((s) => [s.name, kisten(s.placed)]), strasse ? null : K.suggestContainer(cargo, "")]);
    };
    assert.strictEqual(lauf(kern), lauf(ausApp), `Fall ${fall} (${name}): das Modul rechnet anders als app.html`);
  }
  // Auch der Text-Import
  for (const t of ["22 Europaletten 120x80x100 300kg stapelbar bis 180 cm", "9 pallets 48x40x55 inch 1100 lbs; 3 crates 200x100x90 2,4 t not stackable", "Bezeichnung\tStk\tLänge\tBreite\tHöhe\tkg\nA\t10\t120\t80\t100\t300"]) {
    assert.deepStrictEqual(kern.parseCargoText(t), ausApp.parseCargoText(t), t);
  }
});

// ── 2. Derselbe Ablauf wie im Rechner ────────────────────────────────────────────────────

// Die Rechnung des Rechners, hier noch einmal -- mit dem Kern aus app.html und in den
// Schritten des Effekts in App(). Bewusst NICHT aus lib/plan.mjs abgeschrieben.
function wieDerRechner(q, { cont, road, fz } = {}) {
  const K = ausApp;
  const rows = K.parseCargoText(q);
  const cargo = rows.map((r) => ({ id: K.uid(), name: r.name, l: r.l, w: r.w, h: r.h, weight: r.weight, qty: r.qty, stackable: r.stackable, stackH: r.stackH > 0 ? r.stackH : null, rotatable: r.rotatable }));
  const preset = road ? kern.FZ_CODES[fz || "sattel"] : kern.CONT_CODES[cont || "20gp"];
  const container = { ...(road ? K.VEHICLES[preset] : K.PRESETS[preset]) };
  const r = K.packKind(container, cargo, {}, false);
  let chain, rest;
  if (r.boxes < r.totalBoxes && r.totalBoxes > 0 && r.boxes > 0) {
    const ch = road ? K.chainVehicles(container, preset, cargo, r, {}, K.MAXCHAIN) : K.chainContainers(container, preset, cargo, r, {}, K.MAXCHAIN, "");
    chain = ch.chain; rest = ch.remainingBoxes;
  } else {
    chain = [{ name: preset, preset: container, placed: r.placed }];
    rest = Math.max(0, r.totalBoxes - r.boxes);
  }
  const je = chain.map((s) => ({ type: s.name, pieces: s.placed.length, kg: s.placed.reduce((a, b) => a + (+cargo[b.ti].weight || 0), 0) })).filter((s) => s.pieces > 0);
  return { stueck: r.totalBoxes, rest, je };
}

const FAELLE = [
  ["11 Europaletten 120x80x110 300kg nicht stapelbar", {}],
  ["22 Europaletten 120x80x100 300kg stapelbar bis 180 cm", {}],
  ["30 euro pallets 120x80x110 300kg not stackable", { cont: "40hc" }],
  ["25 IBC 120x100x116 1100kg nicht stapelbar", { cont: "40gp" }],
  ["8 Maschinen 600x220x100 300kg; 22 Europaletten 120x80x110 300kg", { cont: "40hc" }],
  ["9 bultos 250x80x30 40kg no apilables; 22 palés 120x80x110 300kg", { cont: "40gp" }],
  ["400 Kartons 60x40x40 12kg; 300 Kartons 50x30x30 8kg; 300 Kisten 80x60x50 25kg", { cont: "40hc" }],
  ["37 Paletten 120x100x150 700kg nicht stapelbar", { cont: "40gp" }],
  ["2 crates 300x200x270 4000kg", { cont: "20ot" }],
  ["4 Rohre 1150x60x60 800kg", { cont: "40fr" }],
  ["10 Europaletten 120x80x150 500kg nicht stapelbar", { cont: "20rf" }],
  ["34 Europaletten 120x80x120 500kg nicht stapelbar", { road: true }],
  ["20 pallets 120x80x120 400kg", { road: true, fz: "75t" }],
  ["60 Gitterboxen 124x83x97 600kg", { road: true, fz: "wb" }],
  ["2 Rotorblatt 1500x300x300 5000kg", { cont: "40hc" }],
];

test("die Antwort ist die Rechnung des Rechners -- nachgerechnet mit dem Kern aus app.html", () => {
  for (const [q, o] of FAELLE) {
    const b = ok({ q, cont: o.cont, d: o.road ? "road" : undefined, fz: o.fz });
    const soll = wieDerRechner(q, o);
    assert.strictEqual(b.totals.pieces, soll.stueck, q);
    assert.strictEqual(b.plan.pieces_left, soll.rest, q + " -- was offen bleibt");
    assert.deepStrictEqual(b.plan.units.map((u) => [u.type, u.pieces, u.weight_kg]), soll.je.map((s) => [s.type, s.pieces, Math.round(s.kg * 10) / 10]), q + " -- die Einheiten");
    // In sich stimmig
    assert.strictEqual(b.plan.pieces_loaded + b.plan.pieces_left, b.totals.pieces, q);
    assert.strictEqual(b.plan.units.reduce((s, u) => s + u.pieces, 0), b.plan.pieces_loaded, q);
    for (const u of b.plan.units) {
      assert.strictEqual(u.items.reduce((s, i) => s + i.pieces, 0), u.pieces, q + " -- Summe je Einheit");
      assert.ok(u.weight_kg <= u.payload_kg + 0.5, `${q}: Einheit ${u.no} ist ueberladen (${u.weight_kg} > ${u.payload_kg})`);
      assert.ok(u.volume_used_pct > 0 && u.volume_used_pct <= 100.5, q + " -- Volumenanteil " + u.volume_used_pct);
    }
    assert.strictEqual(b.plan.units_needed, b.plan.pieces_left === 0 ? b.plan.units.length : null, q);
    assert.strictEqual(b.plan.fits_in_one, b.plan.pieces_left === 0 && b.plan.units.length === 1, q);
    assert.strictEqual(b.plan.all_loaded, b.plan.pieces_left === 0, q);
    assert.strictEqual(b.mode, o.road ? "road" : "sea");
  }
});

test("der Ablauf im Rechner ist noch der, den die Schnittstelle nachbaut", () => {
  // Aendert sich eine dieser Zeilen in app.html, muss lib/plan.mjs mitgehen.
  const plan = fs.readFileSync(path.join(FN, "lib", "plan.mjs"), "utf8");
  for (const zeile of [
    "const r = packKind(container, cargo, {}, forceCentered);",
    "if ((r.boxes < r.totalBoxes || stoppsAktiv) && r.totalBoxes > 0 && r.boxes > 0) {",
    "? chainVehicles(container, preset, cargo, r, chainOverride, MAXVIS)",
    ": chainContainers(container, preset, cargo, r, chainOverride, MAXVIS, carrier);",
    "const MAXVIS = MAXCHAIN;",
    "const [chainOverride, setChainOverride] = useState({});",
    ": QROAD ? { ...VEHICLES[QFZ] }",
    `: { ...applyCarrier(PRESETS["20' GP"], INIT_CARRIER, "20' GP") };`,
    `try { return k[new URLSearchParams(window.location.search).get("fz")] || "Planensattel"; } catch (e) { return "Planensattel"; }`,
  ]) assert.ok(app.includes(zeile), "der Rechner rechnet anders als bisher -- lib/plan.mjs pruefen: " + zeile);
  // Die Uebernahme der gelesenen Zeilen ist wortgleich die von QIMPORT
  const uebernahme = "rows.map((r) => ({ id: uid(), name: r.name, l: r.l, w: r.w, h: r.h, weight: r.weight, qty: r.qty, stackable: r.stackable, stackH: r.stackH > 0 ? r.stackH : null, rotatable: r.rotatable }));";
  assert.ok(app.includes("return " + uebernahme) && plan.includes("const cargo = " + uebernahme), "QIMPORT und die Schnittstelle uebernehmen die Positionen nicht mehr gleich");
  assert.ok(plan.includes("const r = packKind(container, cargo, {}, false);"));
  assert.ok(plan.includes('cont = road ? "" : contCode || "20gp"') && plan.includes('fz = road ? fzCode || "sattel" : ""'), "die Vorgaben (20-Fuss-Standard, Planensattel) stehen nicht mehr da");
  // Hier rechnet keine KI
  assert.ok(!/anthropic|claude|openai|fetch\(/i.test(plan.replace(/\/\/[^\n]*/g, "")), "lib/plan.mjs ruft etwas anderes als den Packer");
});

test("bekannte Zahlen der Wissensseiten", () => {
  // 11 Europaletten im 20-Fuss, 25 im 40-Fuss (test/wissen-zahlen rechnet sie gegen den Packer)
  assert.strictEqual(ok({ q: "11 Europaletten 120x80x110 300kg nicht stapelbar" }).plan.fits_in_one, true);
  const zwoelf = ok({ q: "12 Europaletten 120x80x110 300kg nicht stapelbar" });
  assert.deepStrictEqual([zwoelf.plan.fits_in_one, zwoelf.plan.units_needed, zwoelf.plan.units[0].pieces], [false, 2, 11]);
  assert.strictEqual(ok({ q: "25 euro pallets 120x80x110 300kg not stackable", cont: "40gp" }).plan.fits_in_one, true);
  assert.strictEqual(ok({ q: "26 euro pallets 120x80x110 300kg not stackable", cont: "40gp" }).plan.units[0].pieces, 25);
  // Der Vergleich nennt fuer denselben Container dieselbe Zahl wie der Plan
  for (const [q, cont] of [["30 euro pallets 120x80x110 300kg not stackable", "40hc"], ["12 Europaletten 120x80x110 300kg nicht stapelbar", "20gp"]]) {
    const b = ok({ q, cont }), z = b.comparison.find((c) => c.code === cont);
    assert.strictEqual(z.pieces_fit, b.plan.units[0].pieces, q);
    assert.strictEqual(z.fits_all, b.plan.fits_in_one, q);
    assert.strictEqual(z.pieces_total, b.totals.pieces);
  }
  // Das Gewicht teilt: 26 Stueck zu je 1.100 kg sind 28,6 t -- der 40-Fuss traegt 26,6 t
  const schwer = ok({ q: "26 Kisten 80x60x60 1100kg", cont: "40gp" });
  assert.strictEqual(schwer.plan.weight_limited, true);
  assert.ok(schwer.plan.units.length === 2 && /Weight, not space/.test(schwer.summary) && schwer.notes.every((n) => typeof n === "string"));
  assert.strictEqual(ok({ q: "30 euro pallets 120x80x110 300kg not stackable", cont: "40hc" }).plan.weight_limited, false);
  // Auch auf der Strasse (der Rechner zeigt dort dieselbe Zeile, mit F1): 20 x 400 kg auf 2,8 t Zuladung
  const lkw = ok({ q: "20 pallets 120x80x120 400kg", d: "road", fz: "75t" });
  assert.deepStrictEqual([lkw.plan.weight_limited, lkw.plan.units.map((u) => u.pieces).join("+")], [true, "7+7+6"]);
  assert.ok(app.includes("kettenGrund(container, cargo, result.chain)"), "der Rechner fragt den Grund der Teilung anders ab als bisher");
});

// ── 3. Dieselben Parameter wie der Link ──────────────────────────────────────────────────

test("plan_url oeffnet genau die Rechnung der Antwort", () => {
  for (const [q, o] of FAELLE) {
    for (const lang of ["en", "de", "es"]) {
      const roh = { q, cont: o.cont, d: o.road ? "road" : undefined, fz: o.fz, lang };
      const b = ok(roh);
      assert.ok(b.plan_url.startsWith(BASIS + "/app?"), b.plan_url);
      const p = param(b.plan_url);
      assert.strictEqual(p.get("q"), q, "der Text der Ladung kommt nicht unveraendert an");
      assert.strictEqual(p.get("lang"), lang === "de" ? null : lang, "Sprache");
      if (lang !== "de") assert.ok(b.plan_url.startsWith(`${BASIS}/app?lang=${lang}&q=`), "englische Links tragen lang= vorn: " + b.plan_url);
      if (o.road) { assert.strictEqual(p.get("d"), "road"); assert.strictEqual(p.get("fz"), o.fz || "sattel"); assert.strictEqual(p.get("cont"), null); }
      else { assert.strictEqual(p.get("cont"), o.cont || "20gp"); assert.strictEqual(p.get("d"), null); }
      // Was der Link traegt, rechnet die Schnittstelle wieder genauso
      const nochmal = ok(Object.fromEntries(p.entries()));
      assert.deepStrictEqual(nochmal.plan, b.plan, q + " -- der Link rechnet anders als die Antwort");
      // ... und der Rechner liest den Container aus demselben Kuerzel
      const name = o.road ? b.plan.vehicle.name : b.plan.container.name;
      assert.strictEqual(name, o.road ? kern.FZ_CODES[p.get("fz")] : kern.CONT_CODES[p.get("cont")]);
    }
  }
  // Die Einheit reist nur im Link mit; die Antwort bleibt cm und kg
  const zoll = ok({ q: "9 pallets 48x40x55 inch 1100 lbs", u: "in" });
  assert.strictEqual(param(zoll.plan_url).get("u"), "in");
  assert.deepStrictEqual([zoll.cargo[0].length_cm, zoll.cargo[0].width_cm, zoll.cargo[0].weight_kg], [121.92, 101.6, 498.951607]);
  assert.strictEqual(param(ok({ q: "1 box 10x10x10", u: "furlong" }).plan_url).get("u"), null);
  assert.strictEqual(planAdresse("a b&c", { lang: "en", cont: "40hc" }), BASIS + "/app?lang=en&q=a%20b%26c&cont=40hc");
});

test("Kuerzel, die es nicht gibt, werden abgelehnt -- nicht still ersetzt", () => {
  const c = planen({ q: "1 box 10x10x10", cont: "53ft" });
  assert.deepStrictEqual([c.status, c.body.ok, c.body.error], [400, false, "unknown_container"]);
  assert.deepStrictEqual(c.body.valid, Object.keys(kern.CONT_CODES));
  const f = planen({ q: "1 box 10x10x10", d: "road", fz: "megatrailer" });
  assert.deepStrictEqual([f.status, f.body.error, f.body.valid], [400, "unknown_vehicle", Object.keys(kern.FZ_CODES)]);
  // Was nicht zum Modus gehoert, wird ignoriert -- und die Antwort sagt es
  const a = ok({ q: "5 pallets 120x80x100 200kg", d: "road", cont: "40hc" });
  assert.ok(a.plan.vehicle && !a.plan.container && a.notes.some((n) => /cont is ignored/.test(n)));
  const b = ok({ q: "5 pallets 120x80x100 200kg", fz: "75t" });
  assert.ok(b.plan.container && !b.plan.vehicle && b.notes.some((n) => /fz only applies/.test(n)));
  // Gross-/Kleinschreibung der Kuerzel
  assert.strictEqual(ok({ q: "5 pallets 120x80x100 200kg", cont: "40HC" }).plan.container.code, "40hc");
  // Die englischen Fahrzeugnamen sind die des Rechners
  const en = /vhTilt: "([^"]+)", vhSwap: "([^"]+)", vhRigid: "([^"]+)", vh75: "([^"]+)", vhVan: "([^"]+)"/.exec(app.slice(app.indexOf('shareTitle: "Share plan"') - 20000));
  assert.ok(en, "die englischen Fahrzeugnamen in app.html nicht gefunden");
  assert.deepStrictEqual(Object.values(FZ_EN), en.slice(1));
  assert.deepStrictEqual(Object.keys(FZ_EN), Object.values(kern.FZ_CODES));
});

// ── 4. Ehrlich und sparsam ───────────────────────────────────────────────────────────────

test("jede Antwort sagt, was sie ist -- und was nicht gelesen wurde", () => {
  for (const lang of ["en", "de"]) {
    const b = ok({ q: "22 pallets 120x80x100 300kg", lang });
    assert.match(b.notes[0], lang === "de" ? /Geometrische Schätzung.*Ladungssicherung, Achslasten und Standsicherheit sind nicht geprüft/ : /Geometric estimate.*does not check load securing, axle loads or stability/);
    assert.match(b.notes[1], lang === "de" ? /„cargo“ zeigt, wie der Text gelesen wurde/ : /"cargo" shows how the text was read/);
    assert.match(b.source, /ContainerLoad packer/);
  }
  // Deutsch nur mit lang=de; jede andere Sprache bekommt Englisch (und den Link in ihrer Sprache)
  assert.match(ok({ q: "22 Paletten 120x80x100 300kg nicht stapelbar", lang: "de" }).summary, /^22 Packstücke brauchen 2 Container: 20' GP \(11\) \+ 20' GP \(11\)\. Alles passt in 1 × 40' GP\.$/);
  assert.match(ok({ q: "22 palés 120x80x100 300kg no apilables", lang: "es" }).summary, /^22 pieces need 2 containers: 20' GP \(11\) \+ 20' GP \(11\)\. Everything fits into 1 × 40' GP\.$/);
  assert.match(ok({ q: "22 pallets 120x80x100 300kg", lang: "xx" }).plan_url, /\/app\?lang=en&q=/);
  assert.match(ok({ q: "3 Kisten 100x80x60 250kg", lang: "de" }).summary, /\(\d+,\d % des Volumens, 750 von 28\.200 kg Zuladung\)/);
  // Ohne Gewicht: kein erfundenes Gewicht im Satz, und ein Hinweis
  const ohne = ok({ q: "10 boxes 60x40x40" });
  assert.ok(!/payload/.test(ohne.summary) && ohne.notes.some((n) => /No weight was given for: Boxes/.test(n)), ohne.summary);
  // Eine Liste mit Kopfzeile: die Antwort sagt, dass nicht jede Zeile Ladung war
  const liste = ok({ q: "Bezeichnung\tStk\tLänge\tBreite\tHöhe\tkg\nPalette A\t10\t120\t80\t100\t300\nKiste B\t4\t200\t100\t100\t500", lang: "de" });
  assert.deepStrictEqual([liste.totals.positions, liste.totals.pieces, liste.totals.weight_kg], [2, 14, 5000]);
  assert.ok(liste.notes.some((n) => /2 von 3 Zeilen wurden als Ladung gelesen/.test(n)));
  // Eine Zeile ohne Masse faellt weg -- gemeldet, nicht verschwiegen
  const halb = ok({ q: "5 pallets 120x80x100 200kg; and some loose parts" });
  assert.ok(halb.totals.positions === 1 && halb.notes.some((n) => /1 of 2 lines were read as cargo/.test(n)));
  // Was nicht durch die Tuer geht, steht da
  const tuer = ok({ q: "2 crates 300x200x270 4000kg", cont: "20ot" });
  assert.ok(tuer.plan.door_conflicts.includes("Crates") && tuer.notes.some((n) => /Does not pass the door opening as stowed: Crates/.test(n)));
  // Nichts passt: keine Einheit, keine erfundene Zahl -- und der Vorschlag des Rechners
  const gross = ok({ q: "2 Rotorblatt 1500x300x300 5000kg", cont: "40hc" });
  assert.deepStrictEqual([gross.plan.pieces_loaded, gross.plan.pieces_left, gross.plan.units_needed, gross.plan.units.length], [0, 2, null, 0]);
  assert.match(gross.summary, /^None of the 2 pieces fit into a 40' HC\./);
  assert.ok(gross.recommendation && ["special_equipment", "too_large"].includes(gross.recommendation.type));
  // Landfracht: keine Lademeter (die Stauung fuer die Achslast veraendert die belegte Laenge)
  const lkw = ok({ q: "34 Europaletten 120x80x120 500kg nicht stapelbar", d: "road" });
  assert.ok(lkw.comparison === null && lkw.recommendation === null && lkw.notes.some((n) => /Loading metres are not part of this answer/.test(n)));
  assert.ok(!JSON.stringify(lkw).includes("ldm"));
});

test("Deckel: Text, Positionen, Packstuecke -- und darueber rechnet der Browser", () => {
  assert.deepStrictEqual(GRENZEN, { zeichen: 6000, positionen: 60, stueck: 1000 });
  const leer = planen({});
  assert.deepStrictEqual([leer.status, leer.body.error], [400, "missing_q"]);
  assert.ok(planen(leer.body.example_url ? Object.fromEntries(param(leer.body.example_url).entries()) : {}).body.ok, "das Beispiel der Fehlermeldung rechnet nicht");
  assert.strictEqual(planen({ q: "   " }).body.error, "missing_q");
  const lang = planen({ q: "5 boxes 10x10x10 " + "x".repeat(6000) });
  assert.deepStrictEqual([lang.status, lang.body.error], [413, "too_long"]);
  const nichts = planen({ q: "hallo welt" });
  assert.deepStrictEqual([nichts.status, nichts.body.ok, nichts.body.error], [200, false, "nothing_recognized"]);
  assert.ok(nichts.body.example && nichts.body.plan_url.includes("q=hallo%20welt"));
  // Genau an der Grenze wird gerechnet, eins darueber nicht mehr
  assert.strictEqual(ok({ q: "1000 Kartons 40x30x30 5kg", cont: "40hc" }).totals.pieces, 1000);
  const viel = planen({ q: "1001 Kartons 40x30x30 5kg", cont: "40hc" });
  assert.deepStrictEqual([viel.status, viel.body.ok, viel.body.error, viel.body.pieces], [200, false, "too_many_pieces", 1001]);
  assert.match(viel.body.plan_url, /\/app\?lang=en&q=1001%20Kartons%2040x30x30%205kg&cont=40hc$/);
  const pos = (n) => Array.from({ length: n }, (_, i) => `1 Teil ${40 + i}x30x20 5kg`).join("; ");
  assert.strictEqual(ok({ q: pos(60) }).totals.positions, 60);
  assert.strictEqual(planen({ q: pos(61) }).body.error, "too_many_positions");
  // Mehr Einheiten, als der Rechner rechnet: die Antwort sagt es, statt eine Zahl zu nennen
  const kette = ok({ q: "1000 Paletten 120x80x110 400kg nicht stapelbar" });
  assert.ok(kette.plan.units.length === kern.MAXCHAIN && kette.plan.units_needed === null && kette.plan.pieces_left > 0 && kette.notes.some((n) => /stops after 24 units/.test(n)));
  // Eingaben, die keine Zeichenketten sind, werfen nichts um
  for (const q of [null, 42, {}, [], true]) assert.ok([200, 400].includes(planen({ q, cont: q, lang: q }).status));
});

// ── Die Function: /api/plan ──────────────────────────────────────────────────────────────

const ruf = async (pfad, init) => {
  const res = await fn.default(new Request("https://containerload.io" + pfad, init));
  const text = await res.text();
  return { res, body: text ? JSON.parse(text) : null };
};

test("/api/plan: GET, POST (JSON, Formular, Text) -- dieselbe Antwort wie die Rechnung", async () => {
  speicher();
  assert.deepStrictEqual(fn.config, { path: "/api/plan" });
  const q = "30 euro pallets 120x80x110 300kg not stackable";
  const soll = planen({ q, cont: "40hc" }).body;
  const get = await ruf(`/api/plan?q=${encodeURIComponent(q)}&cont=40hc`);
  assert.strictEqual(get.res.status, 200);
  assert.deepStrictEqual(get.body, soll);
  assert.strictEqual(get.res.headers.get("content-type"), "application/json; charset=utf-8");
  assert.strictEqual(get.res.headers.get("access-control-allow-origin"), "*");
  assert.strictEqual(get.res.headers.get("x-robots-tag"), "noindex");
  const json = await ruf("/api/plan", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ q, cont: "40hc" }) });
  assert.deepStrictEqual(json.body, soll);
  const form = await ruf("/api/plan", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ q, cont: "40hc" }).toString() });
  assert.deepStrictEqual(form.body, soll);
  // Reiner Text im Koerper ist die Ladung; die uebrigen Angaben stehen in der Adresse
  const text = await ruf("/api/plan?cont=40hc", { method: "POST", headers: { "content-type": "text/plain" }, body: q });
  assert.deepStrictEqual(text.body, soll);
  // Der Koerper schlaegt die Adresse
  const beides = await ruf("/api/plan?cont=20gp", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ q, cont: "40hc" }) });
  assert.strictEqual(beides.body.plan.container.code, "40hc");
  // Fehler behalten ihren Status
  assert.strictEqual((await ruf("/api/plan")).res.status, 400);
  assert.strictEqual((await ruf("/api/plan?q=1%20box%2010x10x10&cont=nope")).res.status, 400);
  const kaputt = await ruf("/api/plan", { method: "POST", headers: { "content-type": "application/json" }, body: '{"q": "1 box' });
  assert.deepStrictEqual([kaputt.res.status, kaputt.body.error], [400, "bad_request"]);
  const riesig = await ruf("/api/plan", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ q: "y".repeat(20000) }) });
  assert.deepStrictEqual([riesig.res.status, riesig.body.error], [413, "too_long"]);
  // Andere Methoden
  const opt = await fn.default(new Request("https://containerload.io/api/plan", { method: "OPTIONS" }));
  assert.strictEqual(opt.status, 204);
  assert.strictEqual(opt.headers.get("access-control-allow-methods"), "GET, POST, OPTIONS");
  assert.strictEqual(await opt.text(), "");
  const put = await ruf("/api/plan?q=x", { method: "PUT", body: "x" });
  assert.deepStrictEqual([put.res.status, put.body.error], [405, "method_not_allowed"]);
});

test("/api/plan: gespeichert wird EINE Zahl je Tag, sonst nichts -- und am Deckel gibt es den Link", async () => {
  const tag = `z/${new Date().toISOString().slice(0, 10)}`;
  const log = speicher();
  await ruf("/api/plan?q=5%20pallets%20120x80x100%20200kg");
  await ruf("/api/plan?q=7%20Kisten%20100x80x60%20250kg&lang=de");
  assert.deepStrictEqual(log, [["plan", tag, { n: 1 }], ["plan", tag, { n: 2 }]], "es wird mehr gespeichert als der Zaehler");
  // Was gar nicht gerechnet wird, zaehlt nicht
  const vorher = log.length;
  await ruf("/api/plan");
  await ruf("/api/plan", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ q: "y".repeat(7000) }) });
  assert.strictEqual(log.length, vorher, "ein abgelehnter Aufruf verbraucht den Tagesdeckel");
  // Am Deckel: 429, nichts wird gerechnet oder gezaehlt, aber der Link zum 3D-Plan kommt mit
  assert.strictEqual(PLAN_TAGESLIMIT, 5000);
  const voll = speicher({ ["plan/" + tag]: { n: PLAN_TAGESLIMIT } });
  const r = await ruf("/api/plan?q=5%20pallets%20120x80x100%20200kg");
  assert.deepStrictEqual([r.res.status, r.body.ok, r.body.error], [429, false, "daily_limit"]);
  assert.strictEqual(r.body.plan_url, BASIS + "/app?lang=en&q=5%20pallets%20120x80x100%20200kg");
  assert.deepStrictEqual(voll, []);
  // Faellt der Speicher aus, wird trotzdem gerechnet
  globalThis.__clPlanBlobs = () => { throw new Error("Blobs nicht erreichbar"); };
  const fehlerLog = console.error; console.error = () => {};
  try { assert.strictEqual((await ruf("/api/plan?q=5%20pallets%20120x80x100%20200kg")).body.ok, true); } finally { console.error = fehlerLog; }
  speicher();
  // Keine IP, kein Herkunftsland, keine Browserkennung: die Function liest davon nichts
  for (const f of ["plan.mjs", "lib/plan.mjs"]) {
    const s = fs.readFileSync(path.join(FN, f), "utf8").replace(/\/\/[^\n]*/g, "");
    assert.ok(!/context|\.ip\b|geo\b|x-forwarded-for|x-nf-client|user-agent|cookie|referer/i.test(s), `${f} liest etwas ueber den Aufrufer`);
    assert.ok(!/setJSON|\.set\(|getStore/.test(s), `${f} speichert selbst`);
  }
});

// ── 5. Was die Seiten zeigen ─────────────────────────────────────────────────────────────

test("die Beispiel-Antworten auf den Seiten sind die der Schnittstelle -- Zeichen fuer Zeichen", () => {
  for (const [f, k] of SEITEN) {
    const s = lese(f);
    assert.strictEqual(seiteMitAuszug(s, k, planen), s, `${f}: die Beispiel-Antwort ist veraltet -- node werkzeug/api-beispiele.mjs laufen lassen`);
    const adresse = beispielAdresse(s, k);
    assert.ok(adresse.startsWith(BASIS + "/api/plan?q="), adresse);
    const b = ok(parameter(adresse));
    assert.ok(b.plan.units.length >= 2, `${f}: das Beispiel soll eine Aufteilung zeigen`);
    // Die Seite beschreibt die Felder, die es gibt, und die Grenzen, die gelten
    for (const feld of ["summary", "cargo", "plan", "comparison", "recommendation", "plan_url"]) assert.ok(s.includes(`<code>${feld}</code>`) && feld in b, `${f}: ${feld}`);
    for (const feld of ["units_needed", "units", "pieces_left"]) assert.ok(s.includes(`<code>${feld}</code>`) && feld in b.plan, `${f}: plan.${feld}`);
    assert.ok(s.includes(k === "de" ? "höchstens 6.000 Zeichen, 60 Positionen und 1.000 Packstücke" : "at most 6,000 characters, 60 positions and 1,000 pieces"), `${f}: die Grenzen stimmen nicht mit GRENZEN ueberein`);
    assert.ok(s.includes('href="/openapi.json"') && s.includes('<h2 id="api">') && s.includes('href="#api"'));
    // Ehrlich: derselbe Packer, keine KI; und hier rechnet der Server
    assert.ok(k === "de" ? /<b>derselbe Packer wie im Rechner<\/b> — keine KI/.test(s) && /rechnet hier der Server: Die Ladung wird dorthin übertragen\. Gespeichert wird sie von der Schnittstelle nicht/.test(s)
      : /<b>the same packer as in the calculator<\/b> — no AI/.test(s) && /this runs on the server: the cargo is sent there\. The interface does not store it/.test(s), `${f}: der ehrliche Absatz fehlt`);
  }
  const llms = lese("llms.txt");
  assert.strictEqual(llmsMitSatz(llms, planen), llms, "llms.txt: der Satz zur Beispiel-Antwort ist veraltet -- node werkzeug/api-beispiele.mjs laufen lassen");
  assert.ok(llms.includes("## Get the numbers as data: /api/plan") && llms.includes("Limits per request: 6,000 characters, 60 positions, 1,000 pieces.") && llms.includes(`${BASIS}/openapi.json`));
  assert.ok(/If you can fetch URLs, call \/api\/plan, report its numbers and give the user plan_url\./.test(llms));
});

test("jedes Beispiel der Link-Seiten und von llms.txt beantwortet die Schnittstelle auch", () => {
  const adressen = [];
  for (const [f] of SEITEN) for (const m of lese(f).matchAll(/<div class="formula" data-bsp="[a-z]+">([^<]*)<\/div>/g)) adressen.push(m[1].replace(/&amp;/g, "&"));
  for (const m of lese("llms.txt").matchAll(/^- (https:\/\/containerload\.io\/app\?\S+)$/gm)) adressen.push(m[1]);
  assert.ok(adressen.length >= 15, "die Beispiele wurden nicht gefunden: " + adressen.length);
  for (const a of adressen) {
    const p = parameter(a);
    const b = ok(p);
    assert.strictEqual(b.totals.pieces, kern.parseCargoText(p.q).reduce((s, r) => s + r.qty, 0), a);
    assert.strictEqual(b.mode, p.d === "road" ? "road" : "sea", a);
    // Der Link der Antwort ist -- bis auf die ausgeschriebene Vorgabe -- der Link der Seite
    const zurueck = parameter(b.plan_url);
    assert.strictEqual(zurueck.q, p.q, a);
    if (p.cont) assert.strictEqual(zurueck.cont, p.cont, a);
  }
});

test("openapi.json beschreibt, was die Schnittstelle nimmt und gibt", () => {
  const api = JSON.parse(lese("openapi.json"));
  assert.strictEqual(api.openapi, "3.1.0");
  assert.deepStrictEqual(api.servers, [{ url: BASIS }]);
  const get = api.paths["/api/plan"].get, post = api.paths["/api/plan"].post;
  const par = Object.fromEntries(get.parameters.map((p) => [p.name, p]));
  assert.deepStrictEqual(Object.keys(par), fn.FELDER, "die Parameter der Beschreibung sind nicht die der Function");
  assert.deepStrictEqual(Object.keys(post.requestBody.content["application/json"].schema.properties), fn.FELDER);
  assert.ok(get.parameters.every((p) => p.in === "query" && p.description.length > 20) && par.q.required === true && fn.FELDER.filter((k) => k !== "q").every((k) => !par[k].required));
  const koerper = post.requestBody.content["application/json"].schema.properties;
  for (const quelle of [Object.fromEntries(Object.entries(par).map(([k, p]) => [k, p.schema])), koerper]) {
    assert.deepStrictEqual(quelle.cont.enum, Object.keys(kern.CONT_CODES));
    assert.deepStrictEqual(quelle.fz.enum, Object.keys(kern.FZ_CODES));
    assert.deepStrictEqual(quelle.u.enum, kern.EINHEITEN);
    assert.deepStrictEqual([...quelle.lang.enum].sort(), [...kern.SPRACHEN].sort());
    assert.strictEqual(quelle.q.maxLength, GRENZEN.zeichen);
    assert.deepStrictEqual(quelle.d.enum, ["road"]);
  }
  assert.deepStrictEqual([par.cont.schema.default, par.fz.schema.default, par.lang.schema.default], ["20gp", "sattel", "en"]);
  assert.ok(par.q.description.includes("At most 60 positions and 1,000 pieces"));
  // Jeder Fehler, den die Schnittstelle melden kann, steht in der Liste
  const quelltext = fs.readFileSync(path.join(FN, "plan.mjs"), "utf8") + fs.readFileSync(path.join(FN, "lib", "plan.mjs"), "utf8");
  const fehler = [...new Set([...quelltext.matchAll(/fehler\(\d+, "([a-z_]+)"/g), ...quelltext.matchAll(/error: "([a-z_]+)"/g)].map((m) => m[1]))].sort();
  assert.ok(fehler.length >= 10, "die Fehler wurden nicht gelesen");
  assert.deepStrictEqual([...api.components.schemas.Problem.properties.error.enum].sort(), fehler);
  // Jedes Feld einer echten Antwort ist beschrieben -- See und Strasse, Kette, Vorschlag
  const S = api.components.schemas;
  const felder = (objekt, schema, wo) => { for (const k of Object.keys(objekt)) assert.ok(schema.properties && k in schema.properties, `openapi.json kennt ${wo}.${k} nicht`); };
  for (const b of [ok({ q: "30 euro pallets 120x80x110 300kg not stackable", cont: "40hc" }), ok({ q: "20 pallets 120x80x120 400kg", d: "road", fz: "75t" }), ok({ q: "2 Rotorblatt 1500x300x300 5000kg", cont: "40hc" }), ok({ q: "8 Maschinen 600x220x100 300kg; 22 Europaletten 120x80x110 300kg", cont: "40hc" })]) {
    felder(b, S.Plan, "Plan");
    for (const k of S.Plan.required) assert.ok(k in b, "Pflichtfeld fehlt in der Antwort: " + k);
    felder(b.cargo[0], S.Plan.properties.cargo.items, "cargo[]");
    felder(b.totals, S.Plan.properties.totals, "totals");
    felder(b.plan, S.Plan.properties.plan, "plan");
    felder(b.plan.container || b.plan.vehicle, S.Unit, "plan.container");
    for (const u of b.plan.units) felder(u, S.Plan.properties.plan.properties.units.items, "plan.units[]");
    if (b.recommendation) { felder(b.recommendation, S.Plan.properties.recommendation, "recommendation"); assert.ok(S.Plan.properties.recommendation.properties.type.enum.includes(b.recommendation.type)); }
    for (const c of b.comparison || []) felder(c, S.Plan.properties.comparison.items, "comparison[]");
  }
  for (const r of [planen({}), planen({ q: "1 box 1x1x1", cont: "x" }), planen({ q: "hallo" }), planen({ q: "1001 boxes 10x10x10" })]) felder(r.body, S.Problem, "Problem");
  // Ehrlich auch hier
  assert.match(api.info.description, /geometric estimate/);
  assert.match(api.info.description, /not a VGM/);
});

console.log("plan-api: alle Tests gruen");
