// Hell/Dunkel-Umschalter (UI-Umbau Phase 1, Jareks Go vom 29.10.26).
//
// Die Zusagen, die hier festgenagelt sind:
//   * Voreinstellung ist die SYSTEMEINSTELLUNG des Geraets (prefers-color-scheme) —
//     Jareks ausdruecklicher Wunsch („je nach User immer das jeweilige Systemdefault").
//   * Eine Wahl per Hand ueberschreibt das System und wird unter cl_theme gemerkt —
//     und steht deshalb namentlich in der Datenschutzerklaerung (Ehrlichkeitsregel).
//   * Ohne gemerkte Wahl folgt die App dem System auch LIVE (matchMedia-change);
//     mit gemerkter Wahl schweigt der Wechsel.
//   * Eingebettet (iframe der Startseite) bleibt es dunkel — die Landingpage ist dunkel,
//     eine helle Naht im iframe faellt sofort auf.
//   * Das Thema steht VOR dem ersten Zeichnen am <html> (frueher Head-Script), sonst
//     blitzt beim Laden der falsche Grund auf.
//   * Die head-CSS-Variablen spiegeln die Modul-Paletten — zwei Stellen, EIN Wert.
import fs from "node:fs";
import assert from "node:assert";
import test from "node:test";
import { fileURLToPath } from "node:url";
import path from "node:path";

const dir = path.dirname(fileURLToPath(import.meta.url));
const app = fs.readFileSync(path.join(dir, "..", "app.html"), "utf8");
const datenschutz = fs.readFileSync(path.join(dir, "..", "datenschutz.html"), "utf8");

test("Voreinstellung ist das System, die Wahl wird gemerkt", () => {
  // themaStart: gemerkte Wahl -> System -> dunkel.
  assert.ok(/const t = localStorage\.getItem\("cl_theme"\);\s*\n\s*if \(t === "hell" \|\| t === "dunkel"\) return t;/.test(app),
    "themaStart liest die gemerkte Wahl nicht zuerst");
  assert.ok(app.includes('window.matchMedia("(prefers-color-scheme: light)").matches) return "hell";'),
    "themaStart fragt die Systemeinstellung nicht");
  // Gemerkt wird NUR bei einer Hand-Wahl — genau ein setItem.
  const setzer = app.match(/localStorage\.setItem\("cl_theme"/g) || [];
  assert.strictEqual(setzer.length, 1, `cl_theme wird ${setzer.length}x geschrieben statt genau 1x (nur die Hand-Wahl)`);
});

test("eingebettet bleibt es dunkel", () => {
  assert.ok(app.includes('React.useState(EMBEDDED ? "dunkel" : themaStart())'),
    "der Demo-iframe der Startseite muss dunkel starten — die Landingpage ist dunkel");
  // und der Umschalter erscheint dort gar nicht erst.
  assert.ok(/!EMBEDDED && \/\* @__PURE__ \*\/ React\.createElement\("div", \{ className: "flex items-center", role: "group"/.test(app),
    "der Sonne/Mond-Umschalter muss hinter !EMBEDDED stehen");
});

test("das Thema steht VOR dem ersten Zeichnen am <html>", () => {
  const skript = app.indexOf("document.documentElement.dataset.theme = t;");
  const css = app.indexOf("<style>");
  const react = app.indexOf("react-dom");
  assert.ok(skript > 0, "das fruehe Head-Script fehlt");
  assert.ok(skript < css, "das fruehe Script muss VOR dem Stylesheet laufen, sonst blitzt der falsche Grund auf");
  assert.ok(skript < react, "das fruehe Script muss VOR React laufen");
  // und auch dort gilt: eingebettet dunkel, Rangfolge Wahl -> System.
  const kopf = app.slice(0, css);
  assert.ok(kopf.includes("window.self !== window.top"), "das fruehe Script kennt den iframe-Fall nicht");
  assert.ok(kopf.includes('localStorage.getItem("cl_theme")'), "das fruehe Script liest die gemerkte Wahl nicht");
});

test("der Wechsel schreibt C um und zeichnet neu", () => {
  assert.ok(app.includes('Object.assign(C, thema === "hell" ? C_HELL : C_DUNKEL);'),
    "App() muss den aktiven Satz VOR dem Rendern nach C kopieren");
  assert.ok(app.includes("document.documentElement.dataset.theme = thema;"),
    "der data-theme-Spiegel am <html> fehlt (die head-CSS-Variablen haengen daran)");
  assert.ok(app.includes('meta.setAttribute("content", C.bg);'),
    "die theme-color-Meta (Adressleiste am Telefon) wird nicht nachgefuehrt");
});

test("ohne gemerkte Wahl folgt die App dem System live — mit Wahl schweigt sie", () => {
  assert.ok(/const folge = \(\) => \{\s*\n\s*try \{ if \(localStorage\.getItem\("cl_theme"\)\) return; \} catch \(e\) \{\}/.test(app),
    "der matchMedia-Listener muss die gemerkte Wahl respektieren");
  assert.ok(app.includes('mq.addEventListener("change", folge)'),
    "der matchMedia-change-Listener fehlt");
});

test("beide Wege zaehlen, mit festen Zeichenketten", () => {
  assert.ok(app.includes('if (t === "hell") zaehl("thema-hell"); else zaehl("thema-dunkel");'),
    "der Wechsel zaehlt nicht (oder nicht mit festen Zeichenketten)");
});

test("die head-CSS-Variablen spiegeln die Modul-Paletten", () => {
  const palette = (name) => {
    const m = new RegExp(`var ${name} = \\{([\\s\\S]*?)\\n  \\};`).exec(app);
    assert.ok(m, `${name} nicht gefunden`);
    const o = {};
    for (const z of m[1].matchAll(/(\w+): "(#[0-9A-Fa-f]{6})"/g)) o[z[1]] = z[2];
    return o;
  };
  const dunkel = palette("C_DUNKEL");
  const hell = palette("C_HELL");
  const root = /:root \{([^}]*)\}/.exec(app)[1];
  const rootHell = /:root\[data-theme="hell"\] \{([^}]*)\}/.exec(app)[1];
  const vars = (s) => Object.fromEntries([...s.matchAll(/--(\w+): (#[0-9A-Fa-f]{6})/g)].map((m) => [m[1], m[2]]));
  const vd = vars(root);
  const vh = vars(rootHell);
  assert.strictEqual(vd.bg, dunkel.bg, ":root --bg weicht von C_DUNKEL.bg ab — zwei Stellen, EIN Wert");
  assert.strictEqual(vd.text, dunkel.text, ":root --text weicht von C_DUNKEL.text ab");
  assert.strictEqual(vh.bg, hell.bg, ':root[data-theme="hell"] --bg weicht von C_HELL.bg ab');
  assert.strictEqual(vh.text, hell.text, ':root[data-theme="hell"] --text weicht von C_HELL.text ab');
  assert.strictEqual(vh.focus, hell.accent, "der Fokus-Ring im Hellen muss den hellen Akzent tragen");
});

test("die Datenschutzerklaerung nennt die gemerkte Wahl", () => {
  // Dieselbe Ehrlichkeitsregel wie bei Entwurf, Reederei und Feedback-Datum: was lokal
  // gespeichert wird, steht dort namentlich.
  assert.ok(/hell\/dunkel|Hell-\/Dunkel|Erscheinungsbild/.test(datenschutz),
    "datenschutz.html erwaehnt die Hell/Dunkel-Wahl nicht — neuer localStorage-Schluessel cl_theme");
});

// ── Die Startseite traegt denselben Schalter ─────────────────────────────────────────
const index = fs.readFileSync(path.join(dir, "..", "index.html"), "utf8");

test("die Startseite teilt Schluessel und Farbsatz mit dem Rechner", () => {
  // EIN Produkt: dieselbe gemerkte Wahl (cl_theme) gilt auf beiden Seiten, und der helle
  // Variablensatz der Landingpage traegt WOERTLICH die Kernwerte von C_HELL aus app.html.
  assert.ok(index.includes('localStorage.getItem("cl_theme")'), "index.html liest cl_theme nicht (fruehes Script)");
  assert.ok(index.includes("localStorage.setItem('cl_theme',t)"), "index.html merkt die Hand-Wahl nicht unter cl_theme");
  assert.ok(index.includes('window.matchMedia("(prefers-color-scheme: light)")'), "index.html fragt die Systemeinstellung nicht");
  const hell = /:root\[data-theme="hell"\]\{([\s\S]*?)\}/.exec(index);
  assert.ok(hell, 'index.html: :root[data-theme="hell"] fehlt');
  const appHell = /var C_HELL = \{([\s\S]*?)\n  \};/.exec(app)[1];
  for (const [vari, marke] of [["--bg", "bg"], ["--text", "text"], ["--accent", "accent"], ["--good", "good"], ["--warn", "warn"], ["--bad", "bad"]]) {
    const iv = new RegExp(vari.replace(/-/g, "\\-") + ":(#[0-9A-Fa-f]{6})").exec(hell[1]);
    const av = new RegExp(marke + ': "(#[0-9A-Fa-f]{6})"').exec(appHell);
    assert.ok(iv && av, `${vari}/${marke} nicht gefunden`);
    assert.strictEqual(iv[1].toUpperCase(), av[1].toUpperCase(),
      `Startseite ${vari} (${iv[1]}) weicht von C_HELL.${marke} (${av[1]}) ab — zwei Stellen, EIN Wert`);
  }
  // Das fruehe Script laeuft VOR dem Stylesheet, sonst blitzt der falsche Grund auf.
  assert.ok(index.indexOf("document.documentElement.dataset.theme=t") < index.indexOf("<style>"),
    "das fruehe Theme-Script der Startseite muss VOR dem Stylesheet stehen");
  // Sonne/Mond stehen in der Nav; der aktive Knopf haengt REIN am data-theme (CSS).
  assert.ok(index.includes('data-thema="hell"') && index.includes('data-thema="dunkel"'), "der Umschalter fehlt in der Nav");
  assert.ok(index.includes(':root[data-theme="hell"] .themabtn[data-thema="hell"]'), "der aktive Knopf haengt nicht am data-theme");
});

test("die 3D-Buehne wechselt mit — ueber die Buehnen-Palette B", () => {
  // Jareks Wunsch (30.10.26): die 3D-View auch hell. Die Buehne liest seither die eigene
  // Palette B (B_DUNKEL/B_HELL) — DOM-Verlaeufe, Nebel, Licht, Stahl, Raster. Signalfarben
  // (Ghost-Gruen/-Rot, Warn-Bernstein) und Kennfarben bleiben bewusst in beiden gleich.
  const palette = (name) => {
    const m = new RegExp(`var ${name} = \\{([\\s\\S]*?)\\n  \\};`).exec(app);
    assert.ok(m, `${name} nicht gefunden`);
    return Object.fromEntries([...m[1].matchAll(/(\w+): (0x[0-9a-fA-F]{6}|"[^"]*"|[\d.]+)/g)].map((x) => [x[1], x[2]]));
  };
  const d = palette("B_DUNKEL");
  const h = palette("B_HELL");
  assert.deepStrictEqual(Object.keys(h).sort(), Object.keys(d).sort(),
    "B_HELL und B_DUNKEL muessen DIESELBEN Schluessel tragen");
  assert.ok(app.includes('Object.assign(B, thema === "hell" ? B_HELL : B_DUNKEL);'),
    "App() schaltet die Buehnen-Palette nicht um");
  // Beide Buehnen-Flaechen (Hauptansicht + Palettierer-Vorschau) lesen den Verlauf aus B.
  assert.ok((app.match(/background: B\.grad/g) || []).length >= 2,
    "die Buehnen-Verlaeufe haengen nicht an B.grad");
  // Der Bau-Effekt der Szene haengt am Thema — sonst bleibt die Huelle beim Wechsel stehen.
  assert.ok(app.includes("[result, container, domain, cargo, preset, manualMode, manualPlaced, manualSel, thema]"),
    "der Bau-Effekt der Szene kennt das Thema nicht");
  // Und der Nachzieh-Effekt fasst an, was nur einmal gebaut wird.
  assert.ok(app.includes("t.scene.fog.color.setHex(B.nebel)"), "der Nebel wechselt nicht mit");
});
