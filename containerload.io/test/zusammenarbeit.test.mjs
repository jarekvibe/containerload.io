// Zusammenarbeit ueber den Link: was hat sich seit dem letzten Oeffnen geaendert, und die
// Rueckmeldung von der Rampe („Verladen melden").
//
// Ausgangslage (Auswertung November 2026): der haeufigste echte Ablauf ist ein Plan, der
// zwischen zwei Firmen hin- und hergeht — derselbe Link 97-mal geoeffnet, fuenf Fassungen,
// in jeder ein, zwei Zahlen anders (Hoehe 212 → 214, Breite 110 → 127, Gewicht 177 → 348).
// Wer die neue Fassung oeffnete, musste die Aenderung selbst suchen. Und an der Rampe endete
// der Weg mit dem letzten Haken: Container- und Siegelnummer gingen per Anruf oder Foto zurueck.
//
// Beides geht ohne Server: eine zufaellige Plan-Kennung (&id=) haelt die Fassungen zusammen,
// verglichen wird lokal gegen die zuletzt gesehene; die Meldung reist im Link (&ok=), den der
// Verlader selbst verschickt.
//
// node --test test/zusammenarbeit.test.mjs
import fs from "node:fs";
import assert from "node:assert";
import test from "node:test";
import { fileURLToPath } from "node:url";
import path from "node:path";

const dir = path.dirname(fileURLToPath(import.meta.url));
const roh = fs.readFileSync(path.join(dir, "..", "app.html"), "utf8");
const L = roh.split("\n");
const zeile = (t) => { const i = L.findIndex((l) => l.includes(t)); assert.ok(i >= 0, `nicht gefunden: ${t}`); return i; };
const v2a = zeile("// V2-ENCODE-BEGIN"), v2e = zeile("// V2-ENCODE-END");
const ma = zeile("var PLAN_ID_RE = "), me = zeile("var URL_VM = vmLesen");

const speicher = new Map();
const fakeStorage = {
  getItem: (k) => (speicher.has(k) ? speicher.get(k) : null),
  setItem: (k, v) => speicher.set(k, String(v)),
  removeItem: (k) => speicher.delete(k)
};
const M = new Function("window", "localStorage",
  L.slice(v2a, v2e + 1).join("\n") + "\n" + L.slice(ma, me + 1).join("\n") +
  "\nreturn { compactDecode, fassungUnterschiede, containerNrPruefen, vmPacken, vmLesen, neuePlanId, PLAN_ID_RE, URL_VM, fassungMerken, fassungLesen, V2_DEFAULT_NAME };"
)({ location: { search: "" } }, fakeStorage);

// ── Fassungen vergleichen ────────────────────────────────────────────────────

test("Jareks Fall: eine Position, drei Zahlen geaendert — genau diese drei Felder", () => {
  const alt = "d~120x110x212w177q4nKiste~120x80x150w300q6sr";
  const neu = "d~120x127x214w348q4nKiste~120x80x150w300q6sr";
  const u = M.fassungUnterschiede(alt, neu);
  assert.deepStrictEqual(u.map((e) => [e.art, e.p, e.feld, e.alt, e.neu]), [
    ["feld", 1, "w", 110, 127],
    ["feld", 1, "h", 212, 214],
    ["feld", 1, "wt", 177, 348]
  ]);
  assert.equal(u[0].name, "Kiste");
});

test("eine eingefuegte Position aendert nicht jede folgende", () => {
  const alt = "a~120x80x100nA~100x100x100nB";
  const neu = "a~60x40x50q2nNeu~120x80x100nA~100x100x100nB";
  const u = M.fassungUnterschiede(alt, neu);
  assert.equal(u.length, 1, JSON.stringify(u));
  assert.equal(u[0].art, "neu");
  assert.equal(u[0].p, 1);
  assert.equal(u[0].it.n, "Neu");
});

test("eine entfernte Position steht als entfernt da, der Rest bleibt still", () => {
  const u = M.fassungUnterschiede("a~120x80x100nA~100x100x100nB~50x50x50nC", "a~120x80x100nA~50x50x50nC");
  assert.deepStrictEqual(u.map((e) => [e.art, e.it && e.it.n]), [["weg", "B"]]);
});

test("Container gewechselt, umbenannt, Stapeln und Drehen", () => {
  const u = M.fassungUnterschiede("a~120x80x100nKiste", "d~120x80x100srnBox");
  assert.deepStrictEqual(u[0], { art: "container", alt: "20' GP", neu: "40' HC" });
  const felder = u.filter((e) => e.art === "feld").map((e) => [e.feld, e.alt, e.neu]);
  assert.deepStrictEqual(felder, [["n", "Kiste", "Box"], ["s", 1, 0], ["r", 1, 0]]);
});

test("gleiche Fassung oder kaputter Link: nichts zu melden", () => {
  assert.deepStrictEqual(M.fassungUnterschiede("a~120x80x100", "a~120x80x100"), []);
  assert.deepStrictEqual(M.fassungUnterschiede("a~120x80x100", "kaputt"), []);
  assert.deepStrictEqual(M.fassungUnterschiede("", "a~120x80x100"), []);
});

test("die Fassungen bleiben lokal, je Plan-Kennung, hoechstens 20", () => {
  speicher.clear();
  for (let i = 0; i < 25; i++) M.fassungMerken("plan" + String(i).padStart(4, "0"), "a~" + (100 + i) + "x80x100");
  const a = JSON.parse(speicher.get("cl-fassungen-v1"));
  assert.equal(Object.keys(a).length, 20);
  assert.equal(M.fassungLesen("plan0024").c, "a~124x80x100");
  // Ungueltige Kennung oder leerer Plan wird gar nicht erst gemerkt
  M.fassungMerken("../böse", "a~1x1x1");
  M.fassungMerken("abcdefgh", "");
  assert.equal(M.fassungLesen("../böse"), null);
  assert.equal(M.fassungLesen("abcdefgh"), null);
});

test("die Plan-Kennung: acht Zeichen a-z0-9, jedes Mal neu", () => {
  const ids = new Set(Array.from({ length: 50 }, () => M.neuePlanId()));
  assert.equal(ids.size, 50);
  for (const id of ids) assert.match(id, M.PLAN_ID_RE);
  assert.equal(M.URL_VM, null, "ohne &ok= gibt es keine Meldung");
});

// ── Container-Nummer nach ISO 6346 ──────────────────────────────────────────

test("Pruefziffer: richtig, falsch, unvollstaendig — Schreibweise egal", () => {
  assert.deepStrictEqual(M.containerNrPruefen("CSQU3054383"), { ok: true, norm: "CSQU3054383", pz: 3 });
  assert.deepStrictEqual(M.containerNrPruefen("csqu 305438-3"), { ok: true, norm: "CSQU3054383", pz: 3 });
  const falsch = M.containerNrPruefen("CSQU3054384");
  assert.equal(falsch.ok, false);
  assert.equal(falsch.pz, 3, "die erwartete Ziffer wird genannt");
  assert.equal(M.containerNrPruefen("CSQU30"), null, "unvollstaendig: noch kein Urteil");
  assert.equal(M.containerNrPruefen(""), null);
  assert.equal(M.containerNrPruefen("1234ABCDEFG"), null);
});

// ── Die Verlade-Meldung im Link ─────────────────────────────────────────────

const b64 = (o) => Buffer.from(JSON.stringify(o), "utf8").toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

test("Meldung hin und zurueck: Nummern, Siegel, Notiz mit Umlauten, Haken-Stand", () => {
  const roh2 = M.vmPacken({ t: 1762300000000, n: "Zwei Kartons beschädigt", c: [
    { m: "C1", ty: "40' HC", nr: "csqu3054383", sg: "ML-123456", h: 7, s: 7 },
    { m: "C2", ty: "20' GP", nr: "", sg: "", h: 2, s: 5 }
  ] });
  assert.match(roh2, /^[A-Za-z0-9_-]+$/, "base64url, ohne + / =");
  const m = M.vmLesen(roh2);
  assert.equal(m.t, 1762300000000);
  assert.equal(m.n, "Zwei Kartons beschädigt");
  assert.deepStrictEqual(m.c[0], { m: "C1", ty: "40' HC", nr: "CSQU3054383", sg: "ML-123456", h: 7, s: 7 });
  assert.deepStrictEqual(m.c[1], { m: "C2", ty: "20' GP", nr: "", sg: "", h: 2, s: 5 });
});

test("der Link kommt von aussen: alles wird neu aufgebaut und begrenzt", () => {
  const t = 1762300000000;
  const m = M.vmLesen(b64({ v: 1, t, n: "ok\u0007", x: "fremd", c: [
    { m: "c1<b>", ty: "40' HC\n", nr: "csqu-305438-3<script>", sg: "<img src=x onerror=1>", h: -3, s: 1e9, boese: 1 }
  ] }));
  assert.deepStrictEqual(Object.keys(m).sort(), ["c", "n", "t"], "fremde Felder fallen weg");
  assert.equal(m.n, "ok");
  const k = m.c[0];
  assert.deepStrictEqual(Object.keys(k).sort(), ["h", "m", "nr", "s", "sg", "ty"]);
  assert.equal(k.m, "1", "Marke nur A-Z0-9");
  assert.equal(k.ty, "40' HC");
  assert.match(k.nr, /^[A-Z0-9]{0,11}$/);
  assert.doesNotMatch(k.sg, /[<>=]/);
  assert.equal(k.h, 0);
  assert.equal(k.s, 999);
  // Abgelehnt: falsche Version, kein Container, unplausible Zeit, zu lang, Unsinn
  assert.equal(M.vmLesen(b64({ v: 2, t, c: [{}] })), null);
  assert.equal(M.vmLesen(b64({ v: 1, t, c: [] })), null);
  assert.equal(M.vmLesen(b64({ v: 1, t: 5, c: [{}] })), null);
  assert.equal(M.vmLesen("A".repeat(6001)), null);
  assert.equal(M.vmLesen("%%%"), null);
  assert.equal(M.vmLesen(null), null);
});

// ── Vertraege in der App ─────────────────────────────────────────────────────

test("jeder verschickte Plan-Link traegt die Kennung, und der Absender merkt sich die Fassung", () => {
  const teilen = roh.slice(roh.indexOf("const doShare = () => {"), roh.indexOf("setShareURL(url);"));
  assert.match(teilen, /mitId\(encodePlanURL\(preset, container, cargo, forceCentered, domain\)\)/);
  assert.match(teilen, /fassungJetztMerken\(\)/);
  assert.match(roh, /const planURL = mitId\(encodePlanURL\(preset, container, cargo, forceCentered, domain\)\);\n\s*fassungJetztMerken\(\);/,
    "der QR-Code im Ladevorschlag fuehrt zur selben Plan-Kennung");
  assert.match(roh, /writeText\(mitId\(encodePlanURL\(preset, container, cargo, forceCentered, domain\)\) \+ "&rampe=1"\)/);
  assert.match(roh, /const mitId = \(url\) => url \+ "&id=" \+ planId;/, "eigener Parameter -- die Codetabelle von ?c= bleibt unberuehrt");
  assert.match(roh, /setPlanId\(neuePlanId\(\)\); \/\/ geleert = neuer Plan/, "Leeren beginnt einen neuen Plan");
});

test("die Aenderungs-Anzeige: nur bei einem Link mit Kennung, nie eingebettet, rein lokal", () => {
  const eff = roh.slice(roh.indexOf("const [fassung, setFassung]"), roh.indexOf("const [vmAnzeige"));
  assert.match(eff, /if \(!SHARED \|\| !URL_PLAN_ID \|\| !URL_PLAN_C \|\| EMBEDDED\) return;/);
  assert.match(eff, /fassungUnterschiede\(alt\.c, URL_PLAN_C\)/);
  assert.match(eff, /fassungMerken\(URL_PLAN_ID, URL_PLAN_C\)/, "danach gilt die neue Fassung als gesehen");
  assert.doesNotMatch(eff, /fetch\(/);
  assert.match(roh, /\)\)\)\)\), fassungEl, vmEl, /, "beide Streifen stehen direkt unter der Kopfzeile");
});

test("Verladen melden: Nummern im Rampen-Eintrag, Meldung nur im selbst verschickten Link", () => {
  assert.match(roh, /JSON\.stringify\(\{ t: Date\.now\(\), h: haken, vm \}\)/, "Haken und Meldung in einem Eintrag");
  const sende = roh.slice(roh.indexOf("const vmLink = () =>"), roh.indexOf("const vmFeld = "));
  assert.match(sende, /"&ok=" \+ vmPacken\(/);
  assert.match(sende, /navigator\.share/);
  assert.match(sende, /mailto:\?subject=/);
  assert.doesNotMatch(sende, /fetch\(|XMLHttpRequest|sendBeacon/, "kein Server -- die Meldung geht nur ueber den Verlader");
  assert.match(roh, /useState\(\(\) => SHARED && !EMBEDDED \? URL_VM : null\)/);
  // Zuruecksetzen nimmt die Haken, nicht die getippten Nummern
  const reset = roh.slice(roh.indexOf("const rampeReset = () => {"), roh.indexOf("const fbUhr = useRef"));
  assert.match(reset, /rampeSpeichern\(\{\}, vm\)/);
});

test("die Datenschutzseite nennt beide Speicher und den Weg der Meldung", () => {
  const ds = fs.readFileSync(path.join(dir, "..", "datenschutz.html"), "utf8");
  assert.ok(ds.includes("„Verladen melden“"), "die Nummern aus dem Rampen-Modus fehlen");
  assert.ok(ds.includes("zufälligen Plan-Kennung"), "der Fassungs-Speicher fehlt");
  assert.ok(ds.includes("nur in dem Link, den du selbst verschickst"), "der Weg der Meldung fehlt");
});
