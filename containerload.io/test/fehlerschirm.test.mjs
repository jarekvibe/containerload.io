// Der Fehlerschirm: wirft eine Komponente beim Zeichnen, haengt React 18 den ganzen Baum
// ab -- die Seite war dann leer, ohne ein Wort. Jetzt steht dort eine Meldung mit zwei
// Wegen heraus.
//
// Geprueft wird das VERHALTEN der Klasse, nicht ihr Wortlaut: sie wird aus app.html
// geschnitten und gegen eine kleine React-Attrappe ausgefuehrt. Die drei Dinge, die
// nicht kippen duerfen:
//
//   1. Ohne Fehler ist der Schirm unsichtbar -- er reicht seine Kinder durch.
//   2. "Neu laden" verspricht nichts Falsches. Beim Start gewinnt die Ladung aus der
//      Adresse vor dem Entwurf (SHARED / QIMPORT vor DRAFT). Wer einen geteilten Plan
//      bearbeitet hat, bekaeme mit einem schlichten reload() das ORIGINAL zurueck --
//      also laedt der Knopf mit frischem Entwurf ohne die Ladung in der Adresse.
//      Ohne frischen Entwurf (nichts bearbeitet, oder nur ein Entwurf von gestern)
//      bleibt die Adresse stehen: dort steckt der Plan, der gerade offen war.
//   3. "Leer starten" ist der Ausweg aus der Schleife: Entwurf weg, Adresse ohne Ladung.
//
// node --test test/fehlerschirm.test.mjs
import fs from "node:fs";
import assert from "node:assert";
import test from "node:test";
import { fileURLToPath } from "node:url";
import path from "node:path";

const dir = path.dirname(fileURLToPath(import.meta.url));
const app = fs.readFileSync(path.join(dir, "..", "app.html"), "utf8");
const L = app.split("\n");
const von = L.findIndex((l) => l.includes("class Fehlerschirm extends React.Component"));
const bis = L.findIndex((l, i) => i > von && l.includes("var _root = ReactDOM.createRoot"));
assert.ok(von >= 0 && bis > von, "Fehlerschirm-Ausschnitt nicht gefunden");

const T = { fsTitel: "TITEL", fsText: "MIT-ENTWURF", fsTextOhne: "OHNE-ENTWURF", fsNeu: "NEU", fsLeer: "LEER", fsLeerHinweis: "HINWEIS" };

// Baut eine frische Umgebung: React-Attrappe, Fenster-Attrappe, Zaehler.
function umgebung({ lang = "de", pfad = "/app" } = {}) {
  const protokoll = { reload: 0, replace: [], geleert: 0 };
  const fenster = { location: { pathname: pfad, reload: () => { protokoll.reload++; }, replace: (u) => { protokoll.replace.push(u); } } };
  const React = {
    Component: class { constructor(props) { this.props = props; } },
    createElement: (typ, props, ...kinder) => ({ typ, props: props || {}, kinder }),
  };
  const marke = new Proxy({}, { get: (_, k) => String(k) });   // C.bg -> "bg", SP.xl -> "xl" ...
  const Btn = "Btn";
  const { Fehlerschirm, setFrisch } = new Function(
    "React", "C", "SANS", "R", "SP", "FS", "FW", "T", "Btn", "LANG", "clearDraft", "window",
    "var entwurfFrisch = false;\n" + L.slice(von, bis).join("\n") +
    "\nreturn { Fehlerschirm, setFrisch: (v) => { entwurfFrisch = v; } };"
  )(React, marke, "sans", marke, marke, marke, marke, T, Btn, lang, () => { protokoll.geleert++; }, fenster);
  return { Fehlerschirm, setFrisch, protokoll };
}

// Alle Knoten eines Attrappen-Baums, flach.
const knoten = (n, aus = []) => {
  if (n && typeof n === "object") { aus.push(n); (n.kinder || []).forEach((k) => knoten(k, aus)); }
  return aus;
};
const texte = (baum) => knoten(baum).flatMap((n) => n.kinder.filter((k) => typeof k === "string"));
const knopf = (baum, beschriftung) => knoten(baum).find((n) => n.typ === "Btn" && n.kinder.includes(beschriftung));

const gestuerzt = (u) => {
  const s = new u.Fehlerschirm({ children: "KINDER" });
  s.state = { ...s.state, ...u.Fehlerschirm.getDerivedStateFromError(new Error("x")) };
  return s;
};

test("ohne Fehler ist der Schirm unsichtbar: er reicht die Kinder durch", () => {
  const u = umgebung();
  const s = new u.Fehlerschirm({ children: "KINDER" });
  assert.strictEqual(s.render(), "KINDER");
});

test("nach einem Fehler steht die Meldung da: als Alarm, mit beiden Knoepfen", () => {
  const u = umgebung();
  const baum = gestuerzt(u).render();
  assert.strictEqual(baum.props.role, "alert", "ein Screenreader muss den Wechsel mitbekommen");
  assert.ok(texte(baum).includes("TITEL"));
  assert.ok(knopf(baum, "NEU"), "der Knopf zum Neuladen fehlt");
  assert.ok(knopf(baum, "LEER"), "der Ausweg aus der Schleife fehlt");
  assert.ok(texte(baum).includes("HINWEIS"), "der Hinweis, was Leer starten verwirft, fehlt");
});

test("der Text verspricht einen Entwurf nur, wenn dieser Seitenaufruf einen geschrieben hat", () => {
  const u = umgebung();
  assert.ok(texte(gestuerzt(u).render()).includes("OHNE-ENTWURF"));
  assert.ok(!texte(gestuerzt(u).render()).includes("MIT-ENTWURF"), "ohne frischen Entwurf darf keiner versprochen werden");
  u.setFrisch(true);
  assert.ok(texte(gestuerzt(u).render()).includes("MIT-ENTWURF"));
});

test("Neu laden ohne frischen Entwurf laesst die Adresse stehen (dort steckt der Plan)", () => {
  const u = umgebung();
  knopf(gestuerzt(u).render(), "NEU").props.onClick();
  assert.deepStrictEqual(u.protokoll, { reload: 1, replace: [], geleert: 0 });
});

test("Neu laden mit frischem Entwurf laedt OHNE die Ladung in der Adresse -- sonst gewinnt der Link", () => {
  const u = umgebung();
  u.setFrisch(true);
  knopf(gestuerzt(u).render(), "NEU").props.onClick();
  assert.deepStrictEqual(u.protokoll, { reload: 0, replace: ["/app"], geleert: 0 }, "der Entwurf darf dabei nicht geleert werden");
});

test("Leer starten verwirft den Entwurf und die Ladung aus der Adresse", () => {
  const u = umgebung();
  u.setFrisch(true);
  knopf(gestuerzt(u).render(), "LEER").props.onClick();
  assert.deepStrictEqual(u.protokoll, { reload: 0, replace: ["/app"], geleert: 1 });
});

test("die Sprache ueberlebt beide Wege (Englisch haengt an der Adresse)", () => {
  const u = umgebung({ lang: "en" });
  u.setFrisch(true);
  knopf(gestuerzt(u).render(), "NEU").props.onClick();
  knopf(gestuerzt(u).render(), "LEER").props.onClick();
  assert.deepStrictEqual(u.protokoll.replace, ["/app?lang=en", "/app?lang=en"]);
});

test("der Schirm ist eingehaengt, und der Entwurf meldet sich als frisch", () => {
  assert.ok(app.includes("_root.render(React.createElement(Fehlerschirm, null, React.createElement(App)));"),
    "App wird nicht mehr vom Fehlerschirm umschlossen");
  // saveDraft setzt den Merker, clearDraft nimmt ihn zurueck -- ausgefuehrt, nicht gelesen.
  const s = L.findIndex((l) => l.includes("var DRAFT_KEY"));
  const e = L.findIndex((l, i) => i > s && l.includes("var PLANS_KEY"));
  const speicher = {};
  const fenster = { localStorage: { getItem: (k) => (k in speicher ? speicher[k] : null), setItem: (k, v) => { speicher[k] = v; }, removeItem: (k) => { delete speicher[k]; } } };
  const { saveDraft, clearDraft, frisch } = new Function("window", "uid",
    L.slice(s, e).join("\n") + "\nreturn { saveDraft, clearDraft, frisch: () => entwurfFrisch };")(fenster, () => "id");
  assert.strictEqual(frisch(), false, "beim Laden ist noch nichts geschrieben");
  saveDraft({ preset: "20' GP", container: {}, cargo: [{ name: "Pal", l: 120, w: 80, h: 110, weight: 400, qty: 2, stackMax: Infinity }], domain: "sea", forceCentered: false, planName: "" });
  assert.strictEqual(frisch(), true);
  clearDraft();
  assert.strictEqual(frisch(), false);
});

test("Zoom: die Klemme maximum-scale=1 steht nicht mehr fest im Markup, nur iOS bekommt sie", () => {
  const meta = app.match(/<meta name="viewport" content="([^"]*)"/);
  assert.ok(meta, "viewport-Meta nicht gefunden");
  assert.ok(!/maximum-scale|user-scalable/.test(meta[1]), "das feste Markup sperrt das Zoomen wieder: " + meta[1]);
  // Das Head-Script ausfuehren: einmal als Android, einmal als iPhone, einmal als iPad im Desktop-Modus.
  const a = app.indexOf("var ua = navigator.userAgent");
  const von2 = app.lastIndexOf("(function () {", a);
  const bis2 = app.indexOf("})();", a) + "})();".length;
  const lauf = (userAgent, maxTouchPoints) => {
    let inhalt = meta[1];
    const el = { getAttribute: () => inhalt, setAttribute: (_, v) => { inhalt = v; } };
    new Function("navigator", "document", app.slice(von2, bis2))({ userAgent, maxTouchPoints }, { querySelector: () => el });
    return inhalt;
  };
  assert.ok(!lauf("Mozilla/5.0 (Linux; Android 14; Pixel 7) Chrome/130 Mobile", 5).includes("maximum-scale"), "Android muss zoomen duerfen");
  assert.ok(!lauf("Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/130", 0).includes("maximum-scale"));
  assert.ok(!lauf("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Safari/605.1.15", 0).includes("maximum-scale"), "ein echter Mac ist kein iPad");
  assert.ok(lauf("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Safari/604.1", 5).endsWith(", maximum-scale=1"), "iOS behaelt das bisherige Verhalten");
  assert.ok(lauf("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Safari/605.1.15", 5).endsWith(", maximum-scale=1"), "iPadOS meldet sich als Mac mit Touch");
});
