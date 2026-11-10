// Hell und Dunkel auf den Wissens-, Rechts- und Teilen-Seiten.
//
// Startseite und Rechner folgen seit dem UI-Umbau der gemerkten Wahl (cl_theme) bzw. der
// Systemeinstellung -- die 49 Wissensseiten, Impressum, Datenschutz und die Teilen-
// Zwischenseite blieben als einzige dunkel. Wer mit hellem System von der hellen
// Startseite auf eine Wissensseite ging und von dort in den hellen Rechner, lief durch
// einen dunklen Raum.
//
// Diese Seiten haben keinen Build und keine gemeinsame Vorlage: das Script, das das Thema
// setzt, steht deshalb in JEDER Seite. Genau das muss ein Test festhalten, sonst laeuft
// es auseinander. Geprueft wird:
//
//   1. Jede Seite traegt dasselbe Script, und zwar VOR ihrem Stylesheet (sonst blitzt
//      beim Laden der falsche Grund auf).
//   2. Das Script VERHAELT sich wie auf der Startseite: gemerkte Wahl vor System, sonst
//      dunkel. Es wird dafuer ausgefuehrt, nicht gelesen.
//   3. Die hellen Werte sind die des Rechners (C_HELL) -- EIN Produkt, ein Farbsatz.
//   4. Im Hellen ist alles lesbar (WCAG 4,5:1), auch der Linkton auf dem Seitengrund.
//
// node --test test/wissen-thema.test.mjs
import fs from "node:fs";
import assert from "node:assert";
import test from "node:test";
import { fileURLToPath } from "node:url";
import path from "node:path";

const dir = path.dirname(fileURLToPath(import.meta.url));
const wurzel = path.join(dir, "..");
const lies = (f) => fs.readFileSync(path.join(wurzel, f), "utf8");
const html = (ordner) => fs.readdirSync(path.join(wurzel, ordner)).filter((f) => f.endsWith(".html")).map((f) => ordner + "/" + f);

const wissen = [...html("ratgeber"), ...html("en/guide"), ...html("nl/gids")];
const rand = ["impressum.html", "datenschutz.html", "share.html"];
const seiten = [...wissen, ...rand];

// Das Script einer Seite: der eine <script>-Block im <head>, der data-theme setzt.
const scriptVon = (s) => {
  const m = /<script>([^<]*dataset\.theme[^<]*)<\/script>/.exec(s);
  return m ? m[1] : null;
};

test("es sind wirklich alle Seiten gemeint", () => {
  assert.ok(wissen.length >= 49, `nur ${wissen.length} Wissensseiten gefunden -- stimmen die Ordner noch?`);
});

test("jede Seite traegt dasselbe Thema-Script, vor ihrem Stylesheet", () => {
  const erstes = scriptVon(lies(seiten[0]));
  assert.ok(erstes, `${seiten[0]}: kein Thema-Script im <head>`);
  for (const f of seiten) {
    const s = lies(f);
    const script = scriptVon(s);
    assert.ok(script, `${f}: kein Thema-Script -- die Seite bliebe im Hellen dunkel`);
    assert.strictEqual(script, erstes, `${f}: das Thema-Script weicht von den anderen Seiten ab`);
    const wo = s.indexOf("dataset.theme");
    assert.ok(wo < s.indexOf("</head>"), `${f}: das Script steht nicht im <head>`);
    // Wissensseiten laden wissen.css, die Randseiten tragen ihren <style> selbst.
    const css = wissen.includes(f) ? s.indexOf('href="/ratgeber/wissen.css"') : s.indexOf("<style>");
    assert.ok(css > 0, `${f}: Stylesheet nicht gefunden`);
    assert.ok(wo < css, `${f}: das Thema-Script muss VOR dem Stylesheet stehen, sonst blitzt der falsche Grund auf`);
    // Ohne JavaScript bleibt die Seite dunkel -- und dazu muss das feste Markup passen.
    assert.ok(s.includes('<meta name="theme-color" content="#0E1116" />'), `${f}: theme-color im Markup ist nicht mehr der dunkle Grund`);
  }
});

// Das Script ausfuehren: gegen ein nachgestelltes Fenster.
function lauf({ gemerkt = null, systemHell = false, speicherKaputt = false } = {}) {
  const html = { dataset: {} };
  let themeColor = "#0E1116";
  const meta = { setAttribute: (_, v) => { themeColor = v; } };
  const fenster = { matchMedia: (q) => ({ matches: systemHell && /light/.test(q) }) };
  const speicher = { getItem: (k) => { if (speicherKaputt) throw new Error("gesperrt"); return k === "cl_theme" ? gemerkt : null; } };
  const dokument = { documentElement: html, querySelector: (sel) => (/theme-color/.test(sel) ? meta : null) };
  new Function("window", "document", "localStorage", scriptVon(lies(seiten[0])))(fenster, dokument, speicher);
  return { thema: html.dataset.theme, themeColor };
}

test("das Script folgt der gemerkten Wahl vor dem System -- wie Startseite und Rechner", () => {
  assert.strictEqual(lauf({ gemerkt: "hell", systemHell: false }).thema, "hell", "die Wahl gewinnt gegen ein dunkles System");
  assert.strictEqual(lauf({ gemerkt: "dunkel", systemHell: true }).thema, "dunkel", "die Wahl gewinnt gegen ein helles System");
  assert.strictEqual(lauf({ systemHell: true }).thema, "hell", "ohne Wahl gilt das System");
  assert.strictEqual(lauf({ systemHell: false }).thema, "dunkel", "ohne Wahl und ohne helles System bleibt es dunkel");
  assert.strictEqual(lauf({ gemerkt: "quatsch", systemHell: true }).thema, "hell", "ein fremder Wert zaehlt nicht als Wahl");
  assert.strictEqual(lauf({ speicherKaputt: true, systemHell: true }).thema, "dunkel", "wirft der Speicher (Privatmodus), bleibt es beim dunklen Markup");
});

test("die Adressleiste zieht mit: theme-color wird im Hellen hell", () => {
  assert.strictEqual(lauf({ gemerkt: "hell" }).themeColor.toUpperCase(), "#EEF1F6");
  assert.strictEqual(lauf({ gemerkt: "dunkel" }).themeColor.toUpperCase(), "#0E1116");
});

test("dieselbe Wahl wie auf der Startseite: derselbe Schluessel, dieselbe Rangfolge", () => {
  const index = lies("index.html");
  const script = scriptVon(lies(seiten[0]));
  for (const stueck of ['localStorage.getItem("cl_theme")', 'window.matchMedia("(prefers-color-scheme: light)")']) {
    assert.ok(script.includes(stueck) && index.includes(stueck), `Startseite und Wissensseiten gehen bei ${stueck} auseinander`);
  }
  // Die Wissensseiten LESEN nur. Schreiben sie selbst, braeuchte die Datenschutzseite ein Wort dazu.
  assert.ok(!/setItem/.test(script), "die Wissensseiten duerfen cl_theme nicht schreiben -- gewaehlt wird auf Startseite und Rechner");
});

// ── Farben ────────────────────────────────────────────────────────────────────
const app = lies("app.html");
const appHell = /var C_HELL = \{([\s\S]*?)\n  \};/.exec(app)[1];
const C = (marke) => {
  const m = new RegExp("\\b" + marke + ': "(#[0-9A-Fa-f]{6})"').exec(appHell);
  assert.ok(m, `C_HELL.${marke} nicht gefunden`);
  return m[1].toUpperCase();
};
const satz = (css, kopf) => {
  const i = css.indexOf(kopf);
  assert.ok(i >= 0, `${kopf} nicht gefunden`);
  const block = css.slice(css.indexOf("{", i) + 1, css.indexOf("}", i));
  const aus = {};
  for (const m of block.matchAll(/(--[a-z0-9-]+):\s*([^;]+);/g)) aus[m[1]] = m[2].trim();
  return aus;
};
const wissenCss = lies("ratgeber/wissen.css");
const DUNKEL = satz(wissenCss, ":root{");
const HELL = satz(wissenCss, ':root[data-theme="hell"]{');

test("der helle Satz der Wissensseiten traegt die Werte des Rechners (C_HELL)", () => {
  const paare = [["--bg", "bg"], ["--card", "surface"], ["--deep", "field"], ["--line", "line"], ["--line-2", "fieldBorder"],
    ["--line-3", "lineHi"], ["--text", "text"], ["--dim", "dim"], ["--faint", "faint"], ["--accent", "accent"],
    ["--on-accent", "onAcc"], ["--good", "good"], ["--warn", "warn"], ["--link-soft", "accText"], ["--link", "info"]];
  for (const [vari, marke] of paare) {
    assert.ok(HELL[vari], `wissen.css: ${vari} fehlt im hellen Satz`);
    assert.strictEqual(HELL[vari].toUpperCase(), C(marke), `wissen.css ${vari} weicht von C_HELL.${marke} ab -- zwei Stellen, EIN Wert`);
  }
});

test("jede Farbe des dunklen Satzes hat ein helles Gegenstueck", () => {
  const farben = Object.keys(DUNKEL).filter((k) => !/^--(sans|mono|r-)/.test(k));
  const fehlt = farben.filter((k) => !(k in HELL));
  assert.deepStrictEqual(fehlt, [], "ohne helles Gegenstueck bliebe dieser Ton im Hellen der dunkle: " + fehlt.join(", "));
});

test("in den Regeln der Wissensseiten steht keine feste Farbe mehr neben den Saetzen", () => {
  // Alles ausserhalb der beiden Variablen-Bloecke und der Kommentare. Erlaubt bleibt der
  // eine Rahmenton der Zeichnung im Hellen (eine Uebersetzung, kein Markenwert).
  const ohneKommentare = wissenCss.replace(/\/\*[\s\S]*?\*\//g, "");
  const regeln = ohneKommentare.replace(/:root(\[data-theme="hell"\])?\{[\s\S]*?\}/g, "");
  const fest = [...new Set(regeln.match(/#[0-9A-Fa-f]{6}\b(?!"? i\])|rgba\([^)]*\)/g) || [])].filter((v) => v.toUpperCase() !== "#8FA0B4");
  assert.deepStrictEqual(fest, [], "feste Farbe in einer Regel -- sie wechselt nicht mit dem Thema: " + fest.join(", "));
});

const lum = (hex) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((c) => c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const kontrast = (a, b) => (Math.max(lum(a), lum(b)) + 0.05) / (Math.min(lum(a), lum(b)) + 0.05);

test("im Hellen ist alles lesbar: 4,5:1 fuer Text UND fuer Links auf dem Seitengrund", () => {
  const pruef = (p, name) => {
    // Fliesstext, Nebentext und Links stehen auf jeder Flaeche -- auch direkt auf dem Grund.
    for (const t of ["--text", "--dim", "--faint", "--link"])
      for (const f of ["--bg", "--card", "--deep"]) {
        const tv = p[t].startsWith("var(") ? p[/var\((--[a-z-]+)\)/.exec(p[t])[1]] : p[t];
        assert.ok(kontrast(tv, p[f]) >= 4.5, `${name}: ${t} (${tv}) auf ${f} (${p[f]}) = ${kontrast(tv, p[f]).toFixed(2)}:1 -- unter 4,5`);
      }
    // Status- und Akzenttoene als Text stehen auf Karten.
    for (const t of ["--good", "--warn", "--accent", "--link-soft"])
      assert.ok(kontrast(p[t], p["--card"]) >= 4.5, `${name}: ${t} (${p[t]}) auf --card = ${kontrast(p[t], p["--card"]).toFixed(2)}:1 -- unter 4,5`);
    assert.ok(kontrast(p["--on-accent"], p["--accent"]) >= 4.0, `${name}: Knopftext auf Akzent = ${kontrast(p["--on-accent"], p["--accent"]).toFixed(2)}:1`);
  };
  pruef(HELL, "wissen.css hell");
});

test("die Zeichnungen werden im Hellen uebersetzt -- jeder Ton, der in den Seiten vorkommt", () => {
  // Die SVGs tragen ihre Farben als Attribute. Kommt in einer Seite ein Ton dazu, den der
  // helle Satz nicht kennt, bliebe er blass auf Weiss stehen.
  const bekannt = new Set(["#0A2B46", "#165780", "#0F3C60"]);   // die drei Wuerfelflaechen der Marke bleiben
  const toene = new Set();
  for (const f of wissen) {
    const s = lies(f);
    for (const m of s.matchAll(/(?:fill|stroke)="(#[0-9A-Fa-f]{6})"/g)) toene.add(m[1].toUpperCase());
  }
  for (const t of toene) {
    if (bekannt.has(t)) continue;
    assert.ok(new RegExp('\\[(?:fill|stroke)="' + t + '" i\\]', "i").test(wissenCss),
      `der Ton ${t} steht in einer Zeichnung, hat aber keine helle Uebersetzung in wissen.css`);
  }
});

test("Rechtsseiten und Teilen-Seite: heller Satz mit den Werten des Rechners, kein Wort am Text", () => {
  for (const f of rand) {
    const s = lies(f);
    const stil = s.slice(s.indexOf("<style>"), s.indexOf("</style>"));
    const hell = satz(stil, ':root[data-theme="hell"]{');
    for (const [vari, marke] of [["--bg", "bg"], ["--text", "text"], ["--dim", "dim"], ["--faint", "faint"], ["--accent", "accent"]]) {
      assert.strictEqual((hell[vari] || "").toUpperCase(), C(marke), `${f}: ${vari} im Hellen weicht von C_HELL.${marke} ab`);
    }
    // Der <style>-Block endet sauber (dort stand ein verirrtes Wort vor </style>).
    assert.match(stil.trim(), /\}$/, `${f}: der <style>-Block endet nicht mit einer Regel`);
  }
  // Die Karte liest ihre Farben aus Variablen am Karten-Element -- der helle Satz muss
  // genau dort ansetzen, sonst gewinnt die dunkle Angabe am Element.
  const hk = lies("karte/hafenkarte.css");
  assert.ok(hk.includes(':root[data-theme="hell"] [data-hafenkarte]{'), "der helle Satz der Hafenkarte setzt nicht am Karten-Element an");
  const hkDunkel = satz(hk, "[data-hafenkarte]{"), hkHell = satz(hk, ':root[data-theme="hell"] [data-hafenkarte]{');
  assert.deepStrictEqual(Object.keys(hkHell).sort(), Object.keys(hkDunkel).sort(), "die Karte hat im Hellen nicht dieselben Toene wie im Dunkeln");
});
