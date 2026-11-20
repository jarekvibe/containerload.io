// White-Label (Partner-Rechner, /p/<kunde>).
//
// Eine Spedition zahlt dafuer, dass der Rechner wie IHR Produkt aussieht. Diese Wache haelt
// fest, was im White-Label-Modus (?wl=<slug>) verschwinden muss und was die Partner-Seite
// dem Rechner mitgeben muss. Faellt hier etwas, steht wieder "ContainerLoad" in einem
// Rechner, fuer den jemand 149 Euro im Monat bezahlt.
import fs from "node:fs";
import assert from "node:assert";
import test from "node:test";
import { fileURLToPath } from "node:url";
import path from "node:path";

const dir = path.dirname(fileURLToPath(import.meta.url));
const app = fs.readFileSync(path.join(dir, "..", "app.html"), "utf8");
const partner = fs.readFileSync(path.join(dir, "..", "partner", "index.html"), "utf8");
const redirects = fs.readFileSync(path.join(dir, "..", "_redirects"), "utf8");

test("WL liest Slug, Akzent und Thema aus der Adresse — und nur gueltige Werte", () => {
  const def = app.match(/var WL = \(\(\) => \{([\s\S]{0,900}?)\}\)\(\);/);
  assert.ok(def, "WL-Definition nicht gefunden");
  assert.ok(def[1].includes('sp.get("wl")'), "liest ?wl=");
  assert.ok(/\^\[a-z0-9-\]\{1,40\}\$/.test(def[1]), "Slug muss auf [a-z0-9-] begrenzt sein (er landet in einem Link)");
  assert.ok(/\^#\[0-9a-f\]\{6\}\$/.test(def[1]), "Akzent muss ein #rrggbb sein (er landet in style={})");
  assert.ok(def[1].includes('th === "hell" || th === "dunkel"'), "Thema nur hell oder dunkel");
});

test("die Firmenfarbe wird in BEIDEN Farbsaetzen zum Akzent, mit passender Textfarbe", () => {
  const i = app.indexOf("if (WL && WL.accent) {");
  assert.ok(i > 0, "Akzent-Uebernahme nicht gefunden");
  const block = app.slice(i, i + 700);
  assert.ok(block.includes("[C_DUNKEL, C_HELL].forEach"), "beide Saetze");
  assert.ok(block.includes("S.accent = WL.accent"), "accent");
  assert.ok(block.includes("S.onAcc = lum > 150"), "onAcc nach Helligkeit, sonst weisse Schrift auf Gelb");
  assert.ok(i < app.indexOf("var C = Object.assign({}, C_DUNKEL);"), "muss VOR der lebenden Kopie C passieren");
});

test("im White-Label verschwindet die Marke aus dem Rechner", () => {
  assert.ok(app.includes('!WL && /* @__PURE__ */ React.createElement("a", { href: EMBEDDED ? void 0 : homeHref, className: "brandlogo'), "Kopf-Logo hinter !WL");
  assert.ok(/!WL && \/\* @__PURE__ \*\/ React\.createElement\(Btn, \{ variant: "ghost", size: "s", onClick: \(\) => \{ zaehl\("feedback-geoeffnet"\)/.test(app), "Feedback-Knopf hinter !WL");
  assert.ok(app.includes("if (!SHARED || WL) return false;"), "keine 'mit ContainerLoad erstellt'-Leiste");
  assert.ok(app.includes("} else if (!WL) {") && app.includes("// Standard ContainerLoad Logo"), "Bild-Export ohne eigenes Logo zeigt im WL kein ContainerLoad-Zeichen");
  assert.ok(app.includes('document.title = WL ? (LANG === "en" ? "Load calculator" : "Laderaum-Rechner")'), "Fenstertitel ohne Marke");
});

test("Teilen-Links fuehren im White-Label auf die Partner-Adresse", () => {
  assert.ok(app.includes('(WL ? "/p/" + WL.slug + "?c=" : "/share?c=")'), "encodePlanURL muss /p/<slug>?c= bauen");
  assert.ok(/^\/p\/\*\s+\/partner\/index\.html\s+200/m.test(redirects), "_redirects: /p/* -> partner/index.html");
});

test("die Partner-Seite gibt dem Rechner wl, accent und thema mit und reicht geteilte Plaene durch", () => {
  assert.ok(partner.includes("sp.set('wl', p.demo ? 'vorschau' : slug)"), "wl");
  assert.ok(partner.includes("sp.set('accent', color)"), "accent");
  assert.ok(partner.includes("sp.set('thema', thema)"), "thema");
  assert.ok(/\['c', 'p', 'q', 'd', 'cont', 'lang', 'rampe'\]/.test(partner), "Plan-Parameter werden durchgereicht");
  assert.ok(partner.includes("location.replace('/app' + location.search)"), "unbekannter Partner: Plan bleibt erhalten");
  assert.ok(!/ContainerLoad/.test(partner.replace(/<!--[\s\S]*?-->|\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, "")), "kein 'ContainerLoad' im sichtbaren Markup der Partner-Seite");
});
