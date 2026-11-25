// Die Kopfzeile des Rechners: der Planname steht WIRKLICH in der Fenstermitte, und die
// Einstellungen (Hell/Dunkel, Sprache) stehen abgesetzt von den Plan-Aktionen.
//
// Jarek, 25.11.26: "das 'Plan benennen und Speichern' ist nicht mittig und sieht komisch aus ...
// Sprach- und Hell-Dunkel-Schalter sind Systemeinstellungen, stehen aber direkt neben
// Ladevorschlag, Bild und VGM."
//
// Mittig heisst: links und rechts vom Namen ist gleich viel Platz. Rechts steht aber dreimal
// so viel wie links, und wie viel genau, haengt an der Sprache ("Proposition de chargement").
// Eine feste Fensterbreite, ab der es passt, gibt es deshalb nicht -- die Kopfzeile misst sich
// aus. Dieser Test laesst GENAU DIESE Messung aus app.html gegen eine nachgebaute Kopfzeile
// laufen (Breiten aus dem Browser: Deutsch, Spanisch, Franzoesisch) und haelt Aufbau und
// Regeln fest.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const app = fs.readFileSync(path.join(ROOT, "app.html"), "utf8");
const zwischen = (a, b, ab = 0) => {
  const i = app.indexOf(a, ab);
  assert.ok(i >= 0, `Anfang nicht gefunden: ${a.slice(0, 60)}`);
  const j = app.indexOf(b, i + a.length);
  assert.ok(j > i, `Ende nicht gefunden: ${b.slice(0, 60)}`);
  return app.slice(i, j);
};

const EINZEILIG = +(/var KOPF_EINZEILIG = (\d+);/.exec(app) || [])[1];
const FELD = (() => { const m = /var KOPF_FELD = \{ voll: (\d+), eng: (\d+) \};/.exec(app); assert.ok(m, "KOPF_FELD nicht gefunden"); return { voll: +m[1], eng: +m[2] }; })();

// ── Die Messung, wortgleich aus app.html ──────────────────────────────────────────────
const messenQuelle = zwischen("const messen = () => {\n        if (!eins.matches)", "\n      messen();\n");
const messenBauen = new Function("h", "eins", "px", "breite", "getComputedStyle", "KOPF_FELD", messenQuelle + "\nreturn messen;");

// Eine nachgebaute Kopfzeile: sie reagiert auf data-worte so, wie es die CSS-Regeln tun
// (Woerter erscheinen, Knoepfe und rechte Seite werden breiter).
function kopf({ fenster, marke, symbole, worte, speichernSym = 42, speichernWort, einzeilig = true, start = null }) {
  let stufe = start;
  const vars = {};
  const LUECKE = 8;
  const ausAn = () => stufe === "a" || stufe === "b", spAn = () => stufe === "a" || stufe === "c";
  const knopf = {};
  const wort = (b, an) => ({ offsetParent: {}, parentElement: knopf, get scrollWidth() { return Math.round(b); }, getBoundingClientRect: () => ({ width: an() ? b : 0 }) });
  const ausWorte = worte.map((b) => wort(b, ausAn));
  const spWort = wort(speichernWort, spAn);
  const el = (w) => ({ getBoundingClientRect: () => ({ width: w() }) });
  const speichern = Object.assign(el(() => speichernSym + (spAn() ? speichernWort + LUECKE : 0)), { querySelector: () => spWort });
  const plan = { querySelector: () => speichern };
  const rechtsBreite = () => symbole + (ausAn() ? worte.reduce((s, b) => s + b + LUECKE, 0) : 0);
  const teile = { ".kopf-marke": el(() => marke), ".kopf-rechts": el(rechtsBreite), ".kopf-plan": plan };
  const h = {
    clientWidth: fenster,
    getAttribute: () => stufe, setAttribute: (_, v) => { stufe = v; }, removeAttribute: () => { stufe = null; },
    style: { setProperty: (k, v) => { vars[k] = v; }, removeProperty: (k) => { delete vars[k]; } },
    querySelector: (s) => teile[s], querySelectorAll: (s) => (s === ".kopf-wort" ? ausWorte : [])
  };
  const stil = (e) => e === h ? { paddingLeft: "24px", paddingRight: "24px", columnGap: "8px" } : e === plan ? { paddingLeft: "16px", paddingRight: "16px", columnGap: "8px" } : e === knopf ? { columnGap: LUECKE + "px" } : {};
  const messen = messenBauen(h, { matches: einzeilig }, (v) => parseFloat(v) || 0, (e) => e.getBoundingClientRect().width, stil, FELD);
  return {
    messen,
    get stufe() { return stufe; },
    get feld() { return vars["--kopf-feld"] === undefined ? null : parseFloat(vars["--kopf-feld"]); },
    // So viel Platz braucht die Zeile, wenn beide Seiten gleich breit sind
    bedarf: (feld) => 2 * Math.max(marke, rechtsBreite()) + 16 + 32 + 8 + speichern.getBoundingClientRect().width + feld + 48
  };
}

// Breiten aus dem Browser (Seefracht, Symbol-Zustand; Woerter einzeln)
const DE = { marke: 163, symbole: 452, worte: [86, 24, 32], speichernWort: 62 };
const ES = { marke: 180, symbole: 477, worte: [107, 46, 39], speichernWort: 49 };
const FR = { marke: 211, symbole: 468, worte: [158, 40, 31], speichernWort: 67 };

test("die Marken der Kopfzeile stehen im Quelltext", () => {
  assert.strictEqual(EINZEILIG, 1280, "die einzeilige Aufstellung beginnt nicht mehr bei 1280 px -- gemessen wurde dort (Spanisch: Feld 179 px)");
  assert.ok(FELD.voll > FELD.eng && FELD.eng >= 120, "die Schwellen fuer die Woerter sind verrutscht");
});

test("Deutsch: die Stufen bei den ueblichen Fensterbreiten", () => {
  // gemessen im Browser: 1280 c/159, 1440 c/300, 1536 b/154, 1680 a/229, 1920 a/300
  for (const [fenster, stufe, feld] of [[1280, "c", 160], [1366, "c", 246], [1440, "c", 320], [1536, "b", 154], [1680, "a", 228], [1920, "a", 468]]) {
    const k = kopf({ fenster, ...DE });
    k.messen();
    k.messen();   // zweimal: beim ersten Mal sind die Woerter noch zugeklappt und um 1 px ueberschaetzt
    assert.strictEqual(k.stufe, stufe, `${fenster} px: Stufe ${k.stufe} statt ${stufe}`);
    assert.strictEqual(k.feld, feld, `${fenster} px: Feld ${k.feld} statt ${feld}`);
  }
});

test("lange Woerter (Spanisch, Franzoesisch) kommen spaeter -- und nie auf Kosten der Mitte", () => {
  let k = kopf({ fenster: 1280, ...ES }); k.messen();
  assert.strictEqual(k.stufe, null, "Spanisch bei 1280 px: fuer 'Guardar' ist kein Platz, es bleiben Symbole");
  assert.ok(k.feld >= 170, `Spanisch bei 1280 px: Namensfeld nur ${k.feld} px`);
  k = kopf({ fenster: 1536, ...FR }); k.messen();
  assert.strictEqual(k.stufe, "c", "Franzoesisch bei 1536 px: 'Proposition de chargement' passt nicht, Speichern schon");
  k = kopf({ fenster: 1920, ...FR }); k.messen();
  assert.strictEqual(k.stufe, "a", "Franzoesisch bei 1920 px: alle Woerter");
  assert.ok(k.feld >= FELD.voll);
});

test("was die Messung dem Namensfeld gibt, passt neben zwei gleich breite Seiten", () => {
  // Das ist die Mitte: Marke-Seite = Aktionen-Seite, und alles zusammen ist nicht breiter als
  // das Fenster. Geprueft fuer jede Fensterbreite von der einzeiligen Grenze bis 2600 px.
  for (const sprache of [DE, ES, FR]) for (let fenster = EINZEILIG; fenster <= 2600; fenster += 3) {
    const k = kopf({ fenster, ...sprache });
    k.messen();
    const feld = Math.max(120, Math.min(300, k.feld));           // die clamp()-Regel der Seite
    if (k.feld >= 120) assert.ok(k.bedarf(feld) <= fenster, `${fenster} px, Stufe ${k.stufe}: braucht ${k.bedarf(feld)} px`);
    if (k.stufe === "a") assert.ok(k.feld >= FELD.voll);
    if (k.stufe === "b" || k.stufe === "c") assert.ok(k.feld >= FELD.eng);
  }
});

test("die Anzeige springt nicht: einmal gemessen, bleibt die Stufe stehen", () => {
  // Ein zugeklapptes Wort wird einen Pixel zu breit geschaetzt. Sonst koennte an der Grenze
  // "passt" (zugeklappt gemessen) und "passt nicht" (aufgeklappt gemessen) abwechseln.
  for (const sprache of [DE, ES, FR]) for (let fenster = EINZEILIG; fenster <= 2000; fenster += 1) {
    for (const start of [null, "a", "b", "c", "d"]) {
      const k = kopf({ fenster, ...sprache, start });
      k.messen(); k.messen();
      const s = k.stufe, f = k.feld;
      k.messen(); k.messen();
      assert.strictEqual(k.stufe, s, `${fenster} px ab Stufe ${start}: die Stufe wechselt weiter (${s} -> ${k.stufe})`);
      assert.ok(Math.abs(k.feld - f) <= 1, `${fenster} px ab Stufe ${start}: das Feld wandert (${f} -> ${k.feld})`);
    }
  }
});

test("unter der einzeiligen Grenze raeumt die Messung hinter sich auf", () => {
  const k = kopf({ fenster: 1000, ...DE, einzeilig: false, start: "a" });
  k.messen();
  assert.strictEqual(k.stufe, null, "data-worte bleibt stehen, obwohl die Kopfzeile zweizeilig ist");
  assert.strictEqual(k.feld, null, "--kopf-feld bleibt stehen");
});

test("die Messung haengt am Fenster und am Inhalt, nicht an einer festen Breite", () => {
  const eff = zwischen("const kopfRef = useRef(null);", "// Genau eine Position ist aufgeklappt.");
  assert.match(eff, /React\.useLayoutEffect\(\(\) => \{/, "gemessen wird vor dem ersten Zeichnen, sonst springt die Kopfzeile beim Laden");
  assert.match(eff, /window\.matchMedia\(`\(min-width: \$\{KOPF_EINZEILIG\}px\)`\)/, "die Grenze kommt aus KOPF_EINZEILIG");
  assert.match(eff, /new ResizeObserver\(spaeter\)/);
  assert.match(eff, /requestAnimationFrame\(messen\)/, "der Beobachter fasst das Layout nicht selbst an");
  assert.match(eff, /\[h, h\.querySelector\("\.kopf-marke"\), h\.querySelector\("\.kopf-rechts"\)\]/, "beobachtet werden Fenster, Marke und rechte Seite");
  assert.match(eff, /ro\.disconnect\(\)/);
  assert.doesNotMatch(eff, /setState|useState/, "die Messung loest keinen Render aus");
  // Kein Tailwind-Breakpoint entscheidet mehr ueber die Woerter
  const knopf = zwischen("const kopfKnopf = (", "const kopfAusgaben = [");
  assert.ok(knopf.includes('{ className: "kopf-wort" }, label)'), "das Wort am Ausgabe-Knopf ist nicht mehr messbar eingesetzt");
  assert.doesNotMatch(knopf, /xl:inline|min-\[/, "am Ausgabe-Knopf entscheidet wieder eine feste Fensterbreite");
  assert.ok(app.includes('React.createElement("span", { className: "kopf-wort-s" }, T.plansSave)'), "das Wort am Speichern-Knopf");
});

test("die Regeln: drei Aufstellungen, Woerter zugeklappt, Grenze aus der Marke", () => {
  const css = zwischen("        .kopf{display:grid;", "        @keyframes clspin");
  assert.match(css, /^\s*\.kopf\{display:grid;align-items:center;gap:8px;grid-template-columns:minmax\(0,1fr\) auto;grid-template-areas:"marke einst" "plan aktionen"\}/, "Telefon: Marke | Einstellungen, darunter Planname | Aktionen");
  assert.match(css, /@media \(min-width: 768px\)\{\s*\.kopf\{grid-template-areas:"marke rechts" "plan plan"\}/, "Tablett: der Planname bekommt eine eigene Zeile");
  assert.match(css, /@media \(min-width: \$\{KOPF_EINZEILIG\}px\)\{\s*\.kopf\{grid-template-columns:1fr auto 1fr;grid-template-areas:"marke plan rechts"\}/, "eine Zeile: 1fr | auto | 1fr, Grenze aus KOPF_EINZEILIG");
  assert.doesNotMatch(css, /1280/, "die Grenze steht als Zahl in den Regeln statt als KOPF_EINZEILIG");
  assert.match(css, /\.planname\{width:clamp\(120px,var\(--kopf-feld,300px\),300px\)\}/, "das Namensfeld nimmt, was die Messung ihm gibt");
  assert.match(css, /\.kopf-wort,\.kopf-wort-s\{display:block;max-width:0;overflow:hidden;white-space:nowrap;margin-left:-8px\}/, "ein zugeklapptes Wort ist null breit und hebt den Abstand zum Symbol auf");
  assert.match(css, /\.kopf\[data-worte="a"\] \.kopf-wort,\.kopf\[data-worte="b"\] \.kopf-wort,\.kopf\[data-worte="a"\] \.kopf-wort-s,\.kopf\[data-worte="c"\] \.kopf-wort-s\{max-width:none;margin-left:0\}/);
  assert.match(css, /\.kopf-aktionen>\*,\.kopf-einst>\*\{flex-shrink:0\}/, "rechts darf nichts schrumpfen -- sonst brechen die Woerter in den Knoepfen um");
  assert.match(css, /\.kopf-strich\{display:none;/, "auf dem Telefon stehen die Gruppen in verschiedenen Zeilen, dort gibt es keine Trennlinie");
});

test("der Aufbau: Marke, Planname, Aktionen, Trennlinie, Einstellungen", () => {
  const kopf = zwischen('React.createElement("header", { ref: kopfRef, className: "kopf ', "fassungEl, vmEl,");
  const stellen = ['className: "kopf-marke ', 'className: "kopf-plan ', 'className: "kopf-rechts" }', 'className: "kopf-aktionen ', "!EMBEDDED && kopfAusgaben,", "onClick: manualMode ? void 0 : doShare", "setMenuOpen((o) => !o)", 'className: "kopf-strich"', 'className: "kopf-einst ', "themaSchalter, sprachWahl)"];
  let ab = -1;
  for (const s of stellen) {
    const i = kopf.indexOf(s);
    assert.ok(i >= 0, `in der Kopfzeile fehlt: ${s}`);
    assert.ok(i > ab, `steht an der falschen Stelle: ${s}`);
    ab = i;
  }
  // Einstellungen und Trennlinie gibt es eingebettet nicht (dort bleibt es dunkel und einsprachig)
  assert.match(kopf, /!EMBEDDED && \/\* @__PURE__ \*\/ React\.createElement\("span", \{ "aria-hidden": "true", className: "kopf-strich"/);
  assert.match(kopf, /!EMBEDDED && \/\* @__PURE__ \*\/ React\.createElement\("div", \{ className: "kopf-einst flex items-center gap-2" \}, themaSchalter, sprachWahl\)/);
  // Hell/Dunkel und Sprache sind je EINE Konstante und werden genau einmal eingesetzt
  for (const n of ["themaSchalter", "sprachWahl"]) assert.strictEqual(app.split(n).length - 1, 2, `${n} wird mehrfach eingesetzt`);
  // Die Trennlinie traegt eine Themenfarbe, keinen festen Ton
  assert.match(kopf, /className: "kopf-strich", style: \{ background: C\.lineHi \}/);
});

test("die Sprach-Liste klappt nach links auf -- der Knopf steht ganz rechts aussen", () => {
  const wahl = zwischen("const sprachWahl = ", "const kopfKnopf = (");
  assert.match(wahl, /role: "menu", className: "p-2", style: \{ position: "absolute", top: "100%", right: 0,/, "mit left: 0 ragt die Liste aus dem Fenster");
  // dasselbe gilt fuer das "…"-Menue
  assert.match(app, /position: "absolute", top: "100%", right: 0, marginTop: SP\.xs, zIndex: 41, minWidth: 284/);
});
