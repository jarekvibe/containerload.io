// Der Rechner startet — oder sagt, warum nicht.
//
// React, ReactDOM und Three.js kommen als synchrone <script src> von cdnjs. Blockt eine
// Firmen-Firewall die Adresse (oder hat das CDN eine Stoerung), ist die Bibliothek beim
// Start endgueltig nicht da. Die Startfunktion pruefte
//   if (!window.React || !window.ReactDOM || !window.THREE) { setTimeout(start, 40); return; }
// und pollte damit fuer immer. Im Browser nachgestellt (Three.js blockiert): nach 8 s stand
// weiter nur "ContainerLoad laedt…". Die Meldung im catch ("Bitte Internetverbindung
// pruefen (CDN)") wurde in diesem Fall nie erreicht.
//
// Jetzt: onerror an den Script-Tags -> sofort eine Meldung; sonst eine feste Frist ab
// Navigationsbeginn (CDN_FRIST_MS). Die Meldung nennt die fehlende Bibliothek und die
// Adresse, gibt den Hinweis auf Netzwerk/Firewall, hat einen Knopf zum Neuladen und spricht
// die Sprache des Ladehinweises (?lang= vor cl_lang).
//
// node --test test/start-robustheit.test.mjs
import fs from "node:fs";
import assert from "node:assert";
import test from "node:test";
import { fileURLToPath } from "node:url";
import path from "node:path";

const dir = path.dirname(fileURLToPath(import.meta.url));
const src = fs.readFileSync(path.join(dir, "..", "app.html"), "utf8");
const L = src.split("\n");

// Die Wache samt dem Anfang von start() — bis zu dem try, hinter dem die App selbst beginnt.
const von = L.findIndex((l) => l.includes("// CDN-WACHE-BEGIN"));
const fn = L.findIndex((l, i) => i > von && l.trim() === "function start() {");
const bis = L.findIndex((l, i) => i > fn && l.trim() === "try {");
assert.ok(von > 0 && fn > von && bis > fn, "CDN-Wache oder start() nicht gefunden");
const WACHE = L.slice(von, bis).join("\n") +
  "\n  window.__gestartet = (window.__gestartet || 0) + 1;\n}\nreturn { start, cdnFehlt, cdnMeldung, CDN_FRIST_MS, CDN_HOST };";

// Ein Fenster mit einer Uhr, die nur weiterlaeuft, wenn der Test sie stellt.
function lauf({ da = ["React", "ReactDOM", "THREE"], fehlerGemeldet = false, jetzt = 120, sprache, spaeter } = {}) {
  const uhr = { t: jetzt };
  const timer = [];
  const root = { innerHTML: '<div id="boot">ContainerLoad lädt…</div>' };
  const window = { performance: { now: () => uhr.t }, __clBootSprache: sprache };
  for (const k of da) window[k] = {};
  if (fehlerGemeldet) window.__clCdnFehler = 1;
  const document = { getElementById: (id) => (id === "root" ? root : null) };
  const fehler = [];
  const w = new Function("window", "document", "setTimeout", "console", WACHE)(
    window, document, (f, ms) => timer.push({ f, ms }), { error: (m) => fehler.push(m) });
  w.start();
  // Die Uhr laeuft, solange start() sich neu einplant — hoechstens etwas ueber die Frist.
  let runden = 0;
  while (timer.length && runden++ < 1000) {
    const { f, ms } = timer.shift();
    uhr.t += ms;
    if (spaeter && uhr.t >= spaeter.ab) for (const k of spaeter.kommt) window[k] = {};
    f();
  }
  return { w, root, window, uhr, runden, fehler };
}

test("alles da: der Rechner startet sofort, ohne Meldung", () => {
  const r = lauf();
  assert.strictEqual(r.window.__gestartet, 1);
  assert.strictEqual(r.runden, 0, "kein Warten, wenn alles geladen ist");
  assert.ok(r.root.innerHTML.includes('id="boot"'), "der Ladehinweis bleibt, bis React ihn ersetzt");
});

test("der nachgestellte Fall: Three.js blockiert — die Meldung kommt sofort, statt ewig zu pollen", () => {
  const r = lauf({ da: ["React", "ReactDOM"], fehlerGemeldet: true });
  assert.strictEqual(r.window.__gestartet, undefined, "ohne Three.js darf die App nicht starten");
  assert.strictEqual(r.runden, 0, "onerror hat gemeldet: es gibt nichts mehr zu warten");
  assert.match(r.root.innerHTML, /role="alert"/);
  assert.match(r.root.innerHTML, /Three\.js/, "die Meldung muss sagen, WELCHE Bibliothek fehlt");
  assert.doesNotMatch(r.root.innerHTML, /React,|ReactDOM/, "was geladen ist, steht nicht in der Liste");
  assert.match(r.root.innerHTML, /cdnjs\.cloudflare\.com/, "die Adresse, die die IT freigeben muss");
  assert.match(r.root.innerHTML, /Firewall/);
  assert.match(r.root.innerHTML, /onclick="window\.location\.reload\(\)"[^>]*>Neu laden</, "der Knopf zum Neuladen");
  assert.ok(r.fehler.length === 1 && r.fehler[0].includes("Three.js"), "auch die Konsole nennt die Bibliothek");
});

test("ohne onerror-Meldung endet das Warten an der Frist", () => {
  // Etwa ein Proxy, der statt JavaScript eine HTML-Seite ausliefert: das Script "laedt",
  // setzt aber nichts, und onerror feuert nicht.
  const r = lauf({ da: ["React", "ReactDOM"] });
  assert.strictEqual(r.window.__gestartet, undefined);
  assert.ok(r.uhr.t >= r.w.CDN_FRIST_MS, "die Meldung kam vor der Frist");
  assert.ok(r.uhr.t <= r.w.CDN_FRIST_MS + 100, `die Meldung kam erst nach ${r.uhr.t} ms`);
  assert.match(r.root.innerHTML, /Three\.js/);
  assert.ok(r.w.CDN_FRIST_MS >= 8000 && r.w.CDN_FRIST_MS <= 10000, "vereinbart: 8–10 s");
});

test("kommt eine Bibliothek innerhalb der Frist doch noch, startet der Rechner normal", () => {
  const r = lauf({ da: ["React", "ReactDOM"], spaeter: { ab: 2000, kommt: ["THREE"] } });
  assert.strictEqual(r.window.__gestartet, 1);
  assert.ok(r.root.innerHTML.includes('id="boot"'), "keine Fehlermeldung, wenn es doch geklappt hat");
});

test("hing der Kopf schon laenger als die Frist, wird nicht noch einmal gewartet", () => {
  // Die Frist zaehlt ab Navigationsbeginn (performance.now), nicht ab dem ersten Aufruf.
  const r = lauf({ da: ["THREE"], jetzt: 45000 });
  assert.strictEqual(r.runden, 0);
  assert.match(r.root.innerHTML, /Diese Bibliotheken wurden nicht geladen: React, ReactDOM/);
});

test("die Meldung spricht Englisch, wenn der Ladehinweis Englisch spricht", () => {
  const r = lauf({ da: [], fehlerGemeldet: true, sprache: "en" });
  assert.match(r.root.innerHTML, /ContainerLoad could not start/);
  assert.match(r.root.innerHTML, /These libraries did not load: React, ReactDOM, Three\.js \(from cdnjs\.cloudflare\.com\)/);
  assert.match(r.root.innerHTML, />Reload</);
  assert.doesNotMatch(r.root.innerHTML, /Bibliothek|Neu laden/);
  const eins = lauf({ da: ["React", "ReactDOM"], fehlerGemeldet: true, sprache: "en" });
  assert.match(eins.root.innerHTML, /This library did not load: Three\.js/);
});

// ── Die Sprache des Ladehinweises ────────────────────────────────────────────
// Dieselbe Rangfolge wie LANG im Modul: die Adresse vor der gemerkten Wahl.
const BV = L.findIndex((l) => l.includes("// Der Ladehinweis steht im Markup"));
const BB = L.findIndex((l, i) => i > BV && l.trim() === "})();");
assert.ok(BV > 0 && BB > BV, "Ladehinweis nicht gefunden");
const BOOT = L.slice(BV, BB + 1).join("\n");
const bootSprache = (search, gemerkt) => {
  const boot = { textContent: "ContainerLoad lädt…" };
  const window = { location: { search }, localStorage: { getItem: (k) => (k === "cl_lang" ? gemerkt ?? null : null) } };
  new Function("window", "document", BOOT)(window, { getElementById: (id) => (id === "boot" ? boot : null) });
  return { sprache: window.__clBootSprache, text: boot.textContent };
};

test("der Ladehinweis entscheidet die Sprache — und merkt sie fuer die Meldung", () => {
  assert.deepStrictEqual(bootSprache("?lang=en", null), { sprache: "en", text: "ContainerLoad is loading…" });
  assert.deepStrictEqual(bootSprache("", "en"), { sprache: "en", text: "ContainerLoad is loading…" });
  assert.strictEqual(bootSprache("?lang=de", "en").sprache, "de", "?lang= geht vor cl_lang");
  assert.strictEqual(bootSprache("", null).sprache, "de", "Deutsch ist die Vorgabe");
  assert.match(WACHE, /window\.__clBootSprache === "en"/, "die Meldung liest genau diese Entscheidung");
});

test("die drei Bibliotheken im Kopf melden einen Fehlschlag", () => {
  for (const datei of ["react.production.min.js", "react-dom.production.min.js", "three.min.js"]) {
    const tag = L.find((l) => l.startsWith("<script src=") && l.includes("/" + datei));
    assert.ok(tag, `${datei}: Script-Tag nicht gefunden`);
    assert.match(tag, /onerror="window\.__clCdnFehler=1"/, `${datei}: ohne onerror wartet der Start bis zur Frist`);
  }
  // Versionen und Quelle bleiben, was CLAUDE.md festlegt.
  assert.ok(src.includes("cdnjs.cloudflare.com/ajax/libs/react/18.3.1/umd/react.production.min.js"));
  assert.ok(src.includes("cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"));
});

test("die Meldung nutzt nur die Farben des Kopfes — lesbar in hell und dunkel", () => {
  const html = lauf({ da: [], fehlerGemeldet: true }).root.innerHTML;
  const farben = html.match(/#[0-9A-Fa-f]{3,6}\b/g) || [];
  assert.deepStrictEqual(farben, ["#FFFFFF"], "nur die Schrift auf dem Knopf ist fest (Weiss auf Akzent)");
  for (const v of ["--text", "--focus", "--sbThumb"]) assert.ok(html.includes(`var(${v})`), `${v} fehlt`);
  // --boot (#5C7085 auf #0E1116) liegt unter 4,5:1 — fuer einen Absatz zu blass.
  assert.ok(!html.includes("var(--boot)"), "die Erklaerung muss lesbar sein, nicht nur dekorativ");
});
