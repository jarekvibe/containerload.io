// Ein Teilen-Link darf den Tab des Empfaengers nicht einfrieren.
//
// Nachgestellt: ?p=-Link, 40' HC, Karton 40 x 30 x 30 cm. 5.000 Stueck laden, bei 50.000
// war die Seite nach 25 s noch nicht fertig — der Packer rechnet synchron im Hauptthread,
// schon im ersten Render. decodePlanState setzte die Menge mit Math.max(1, +r.q || 1),
// also ohne Obergrenze; Infinity (ein Link mit 400 Ziffern) haette fuer immer gerechnet.
//
// Seitdem gilt MENGE_MAX je Position und MENGE_GESAMT_MAX je Plan — an jeder Tuer, durch
// die Ladung hereinkommt (Link ?p=/?c=, ?q=, Entwurf, Mengenfeld, Import, Stevie), mit
// sichtbarem Hinweis. Das Kodierungsschema der Links bleibt, wie es war: alte Links und
// gedruckte QR-Codes oeffnen unveraendert.
//
// Warum gerade diese Zahl, steht als Messung am Kommentar bei MENGE_MAX in app.html;
// nachmessen mit `node test/bench/mengen-zeit.mjs app.html`.
//
// node --test test/mengen-grenze.test.mjs
import fs from "node:fs";
import assert from "node:assert";
import test from "node:test";
import { fileURLToPath } from "node:url";
import path from "node:path";

const dir = path.dirname(fileURLToPath(import.meta.url));
const src = fs.readFileSync(path.join(dir, "..", "app.html"), "utf8");
const L = src.split("\n");
const cut = (von, bis) => {
  const s = L.findIndex((l) => l.includes(von));
  const e = L.findIndex((l, i) => i > s && bis(l, i));
  assert.ok(s >= 0 && e > s, `Ausschnitt nicht gefunden: ${von}`);
  return L.slice(s, e + 1).join("\n");
};

// Der echte Weg eines Links: compactDecode (?c=) bzw. JSON (?p=) -> decodePlanState.
// Dazu der Entwurf (loadDraft/saveDraft) mit einem Speicher zum Mitrechnen.
const speicher = {};
const M = new Function("speicher",
  `var num = (v, d = 0) => Number.isFinite(+v) && v !== "" ? +v : d;
   var applyCarrier = (p) => p;
   var _id = 0; var uid = () => "c" + (_id++);
   var window = { atob: (s) => atob(s), location: { search: "" }, localStorage: {
     getItem: (k) => (k in speicher ? speicher[k] : null),
     setItem: (k, v) => { speicher[k] = String(v); },
     removeItem: (k) => { delete speicher[k]; } } };
   ${cut("var PRESETS = {", (l) => l.includes("var panelsFor"))}
   ${cut("// MENGEN-GRENZE-BEGIN", (l) => l.includes("// MENGEN-GRENZE-END"))}
   ${cut("var planStateFrom = ", (l) => l.includes("// V2-ENCODE-END"))}
   ${cut("var DRAFT_KEY", (l) => l.includes("var PLANS_KEY"))}
   // Der Start eines Empfaengers: genau der Code, der beim Oeffnen den Link liest.
   function geteilt(search) {
     window.location.search = search;
     ${cut("var SHARED = (() => {", (l) => l.trim() === "})();")}
     return SHARED;
   }
   return { MENGE_MAX, MENGE_GESAMT_MAX, mengenKappen, decodePlanState, planStateFrom, compactEncode, compactDecode,
            loadDraft, saveDraft, DRAFT_KEY, PRESETS, VEHICLES, geteilt };`
)(speicher);
const { MENGE_MAX, MENGE_GESAMT_MAX, mengenKappen, decodePlanState, planStateFrom, compactEncode, compactDecode } = M;
const TABLES = { presets: M.PRESETS, vehicles: M.VEHICLES };

// Wie der Empfaenger einen Link liest: ueber SHARED, so wie share.html ihn weiterreicht.
const ausC = (c) => M.geteilt("?c=" + encodeURIComponent(c));
// ?p= wurde frueher so erzeugt: JSON -> UTF-8 -> base64, URL-sicher, ohne "=".
const ausP = (json) => M.geteilt("?p=" + Buffer.from(json, "utf8").toString("base64")
  .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""));
const summe = (cargo) => cargo.reduce((s, c) => s + c.qty, 0);

test("die Grenze steht, wo die Messung sie hinstellt", () => {
  // Eine Entscheidung, kein Zufall: wer die Zahl aendert, misst neu (test/bench/mengen-zeit.mjs)
  // und passt diesen Test an.
  assert.strictEqual(MENGE_MAX, 5000);
  assert.strictEqual(MENGE_GESAMT_MAX, 5000);
  // Ein voller 40' HC mit Standardkartons (40 x 30 x 30: 2.070 Stueck) muss in EINEN Plan passen,
  // sonst schneidet die Grenze den Normalfall ab.
  assert.ok(MENGE_MAX >= 2070 && MENGE_GESAMT_MAX >= 2070, "ein voller Container Kartons muss gehen");
  assert.ok(MENGE_MAX <= MENGE_GESAMT_MAX, "eine Position kann nie mehr tragen als der ganze Plan");
});

test("der nachgestellte Link: 50.000 Kartons kommen als 5.000 an — und sagen es", () => {
  const d = ausC("d~40x30x30q50000");
  assert.ok(d, "der Link muss weiterhin oeffnen");
  assert.strictEqual(d.preset, "40' HC");
  assert.strictEqual(d.cargo.length, 1);
  assert.strictEqual(d.cargo[0].qty, 5000);
  assert.deepStrictEqual([d.cargo[0].l, d.cargo[0].w, d.cargo[0].h], [40, 30, 30], "die Masse bleiben, wie sie waren");
  assert.ok(d.gekappt, "gekappt, aber nicht gesagt — genau das darf nicht sein");
  assert.strictEqual(d.gekappt.vorher, 50000);
  assert.strictEqual(d.gekappt.nachher, 5000);
  assert.deepStrictEqual(d.gekappt.pos.map((p) => [p.p, p.alt, p.neu]), [[1, 50000, 5000]]);
});

test("?p= (das alte JSON-Format) kappt genauso", () => {
  const st = { pr: "40' HC", co: { l: 1203, w: 235, h: 270, p: 26580 },
    it: [{ n: "Karton", l: 40, w: 30, h: 30, wt: 8, q: 50000, s: 1, r: 1 }] };
  const d = ausP(JSON.stringify(st));
  assert.strictEqual(d.cargo[0].qty, 5000);
  assert.strictEqual(d.cargo[0].weight, 8);
  assert.strictEqual(d.cargo[0].name, "Karton");
  assert.ok(d.gekappt);
});

test("Infinity und Ziffernketten rechnen nicht fuer immer", () => {
  // JSON.parse macht aus 1e999 Infinity; im ?c=-Format liefert eine 400-stellige Zahl dasselbe.
  const p = decodePlanState(JSON.parse('{"pr":"40\' HC","it":[{"l":40,"w":30,"h":30,"q":1e999}]}'));
  assert.strictEqual(p.cargo[0].qty, 5000);
  assert.strictEqual(p.gekappt.vorher, Infinity, "der Hinweis darf die Zahl als unendlich nennen");
  const c = ausC("d~40x30x30q" + "9".repeat(400));
  assert.strictEqual(c.cargo[0].qty, 5000);
});

test("das Plan-Budget gilt ueber alle Positionen — in Listenreihenfolge, nichts verschwindet", () => {
  const d = ausC("d~40x30x30q3000~60x40x40q3000~120x80x110q20nPalette");
  assert.deepStrictEqual(d.cargo.map((c) => c.qty), [3000, 2000, 0]);
  assert.strictEqual(summe(d.cargo), MENGE_GESAMT_MAX);
  assert.strictEqual(d.cargo.length, 3, "die dritte Position bleibt sichtbar stehen (mit 0), statt still wegzufallen");
  assert.strictEqual(d.cargo[2].name, "Palette");
  assert.deepStrictEqual(d.gekappt.pos.map((p) => [p.p, p.alt, p.neu]), [[2, 3000, 2000], [3, 20, 0]]);
  assert.strictEqual(d.gekappt.vorher, 6020);
});

test("alte Links unter der Grenze oeffnen unveraendert — ohne Hinweis", () => {
  // So sah ein Link vor der Grenze aus. Er muss Byte fuer Byte dasselbe ergeben wie bisher.
  const d = ausC("zg590x235x239x28200~120x80x110q20~60x40x40w12q300sn" + encodeURIComponent("Kiste A"));
  assert.ok(d);
  assert.strictEqual(d.gekappt, null);
  assert.deepStrictEqual(d.cargo.map((c) => c.qty), [20, 300]);
  assert.strictEqual(d.cargo[1].stackable, false);
  assert.strictEqual(d.cargo[1].name, "Kiste A");
  // Genau an der Grenze wird nichts gekappt.
  assert.strictEqual(ausC("d~40x30x30q5000").gekappt, null);
  assert.strictEqual(ausC("d~40x30x30q2500~60x40x40q2500").gekappt, null);
});

test("das Kodierungsschema bleibt: ein gekappter Plan kodiert wie jeder andere", () => {
  const d = ausC("d~40x30x30q50000");
  const s = compactEncode(planStateFrom(d.preset, d.container, d.cargo, d.forceCentered, d.domain), TABLES);
  assert.strictEqual(s, "d~40x30x30q5000", "derselbe Code, nur mit der begrenzten Menge");
  assert.strictEqual(ausC(s).cargo[0].qty, 5000);
});

test("mengenKappen laesst alles Uebrige in Ruhe", () => {
  const ladung = [{ id: "a", name: "A", l: 40, w: 30, h: 30, weight: 8, qty: 9000, stackable: false, stackMax: 1, rotatable: false, slot: 1, color: "#123456" }];
  const k = mengenKappen(ladung);
  const { qty, ...rest } = k.cargo[0];
  const { qty: q0, ...rest0 } = ladung[0];
  assert.strictEqual(qty, 5000);
  assert.deepStrictEqual(rest, rest0);
  assert.strictEqual(ladung[0].qty, 9000, "die Eingabe wird nicht veraendert");
  // Nichts zu tun: dasselbe Array zurueck, kein Hinweis.
  const klein = [{ qty: 3 }, { qty: "" }, { qty: 2.5 }, { qty: -4 }];
  const k2 = mengenKappen(klein);
  assert.strictEqual(k2.cargo, klein);
  assert.strictEqual(k2.gekappt, null);
});

test("der Entwurf traegt keine 50.000 in jeden Reload", () => {
  // Vor der Grenze konnte das Mengenfeld 50.000 annehmen; der Entwurf merkte sie und
  // brachte sie bei JEDEM Start zurueck — eingefroren ohne Ausweg.
  speicher[M.DRAFT_KEY] = JSON.stringify({ v: 1, preset: "40' HC", domain: "sea",
    container: { l: 1203, w: 235, h: 270, payload: 26580 },
    cargo: [{ id: "x", name: "Karton", l: 40, w: 30, h: 30, weight: 8, qty: 50000, stackable: true, stackMax: null, rotatable: true }] });
  const d = M.loadDraft();
  assert.ok(d, "der Entwurf kam nicht zurueck");
  assert.strictEqual(d.cargo[0].qty, 5000);
  assert.strictEqual(d.cargo[0].stackMax, Infinity, "die Rueckdrehung von stackMax bleibt");
  assert.ok(d.gekappt, "der Start muss sagen, dass der Entwurf gekuerzt wurde");
  // Ein gewoehnlicher Entwurf kommt ohne Hinweis zurueck.
  M.saveDraft({ preset: "40' HC", container: { l: 1203, w: 235, h: 270, payload: 26580 }, domain: "sea",
    cargo: [{ id: "y", name: "Kiste", l: 120, w: 80, h: 110, weight: 300, qty: 40, stackable: true, stackMax: Infinity, rotatable: true }] });
  assert.strictEqual(M.loadDraft().gekappt, null);
});

// ── Die Verdrahtung im Rechner ───────────────────────────────────────────────
// Die CI hat keinen Browser; sie kann aber pruefen, dass jede Tuer die Grenze kennt.
test("jede Tuer fuer Ladung kappt", () => {
  const dec = cut("var decodePlanState = (st) => {", (l) => l.trim() === "};");
  assert.match(dec, /const k = mengenKappen\(cargo\);/);
  assert.match(dec, /cargo: k\.cargo, forceCentered, gekappt: k\.gekappt/);
  const q = cut("var QIMPORT = (() => {", (l) => l.trim() === "})();");
  assert.match(q, /mengenKappen\(rows\.map/, "?q= ist auch ein Link von aussen");
  const ld = cut("var loadDraft = () => {", (l) => l.trim() === "};");
  assert.match(ld, /mengenKappen\(draftIn\(d\.cargo\)\)/);
  const imp = cut("const applyImport = (replace) => {", (l) => l.trim() === "};");
  assert.match(imp, /mengenKappen\(replace \? items : \[\.\.\.cargo, \.\.\.items\]\)/, "angehaengt zaehlt die bestehende Ladung mit");
  const ki = cut("const kiAktionenAnwenden", (l) => l.includes("if (neu) setCargo(neu);"));
  assert.match(ki, /mengenKappen\(neu\)/, "Stevie kann ueber mehrere Positionen das Budget sprengen");
  assert.match(src, /setKappung\(d\.gekappt \? \{ quelle: "plan", \.\.\.d\.gekappt \} : null\);/, "Meine Plaene sagt es auch");
});

test("das Mengenfeld haelt dieselbe Grenze — beim Tippen, mit +/- und mit Hinweis", () => {
  const um = cut("const updMenge = (id, v) => {", (l) => l.trim() === "};");
  assert.match(um, /Math\.min\(MENGE_MAX, MENGE_GESAMT_MAX - andere\)/, "je Position UND was vom Plan bleibt");
  assert.match(um, /if \(\+v > grenze\)/, "+v statt num(v): num(Infinity) waere 0 und liesse Infinity durch");
  assert.match(um, /setToast\(/, "gekappt wird nie still");
  assert.match(src, /type: "number", min: 0, max: MENGE_MAX, value: c\.qty, onChange: \(e\) => updMenge\(c\.id,/);
  assert.match(src, /onClick: \(\) => updMenge\(c\.id, Math\.max\(0, Math\.floor\(num\(c\.qty\)\) \+ 1\)\)/);
  assert.match(src, /onClick: \(\) => updMenge\(c\.id, Math\.max\(0, Math\.floor\(num\(c\.qty\)\) - 1\)\)/);
  assert.doesNotMatch(src, /upd\(c\.id, "qty"/, "kein Weg ins Mengenfeld an der Grenze vorbei");
});

test("der Hinweis-Streifen steht unter der Kopfzeile und nennt alt und neu", () => {
  assert.match(src, /, fassungEl, vmEl, kappEl, /);
  const el = cut("const kappEl = !kappung ? null :", (l) => l.includes("streifenX(() => setKappung(null))"));
  assert.match(el, /T\.kappTitel\(/);
  assert.match(el, /T\.kappVorher\(kappung\.quelle,/);
  assert.match(el, /kappZahl\(e\.alt\) \+ " \\u2192 " \+ fmtDE\(e\.neu\)/);
  // Beim Start in derselben Rangfolge wie die Ladung: Link, ?q=, Entwurf.
  const init = cut("const [kappung, setKappung] = useState(() =>", (l) => l.includes(": null);"));
  assert.match(init, /SHARED \? \(SHARED\.gekappt[\s\S]*QIMPORT \? \(QIMPORT_KAPPUNG[\s\S]*DRAFT && DRAFT\.gekappt/);
});

test("beide Sprachen sagen es, fuer jede Quelle", () => {
  // kappVorher steht zweimal im Woerterbuch: erst Deutsch, dann Englisch — je sieben Zeilen.
  const starts = L.map((l, i) => l.trim().startsWith("kappVorher:") ? i : -1).filter((i) => i >= 0);
  assert.strictEqual(starts.length, 2, "kappVorher muss im deutschen UND im englischen Woerterbuch stehen");
  const lies = (i) => new Function("return ({" + L.slice(i, i + 7).join("\n") + "})")().kappVorher;
  const [de, en] = starts.map(lies);
  for (const q of ["link", "entwurf", "plan", "import", "stevie"]) {
    assert.ok(de(q, "50.000").includes("50.000"), `DE ${q}: die alte Zahl fehlt (${de(q, "50.000")})`);
    const t = en(q, "50,000");
    assert.ok(t.includes("50,000") && !/St\u00FCck|enthielt/.test(t), `EN ${q}: ${t}`);
  }
});
