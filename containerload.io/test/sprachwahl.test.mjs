// Regressionstest fuer die Sprachwahl im Rechner (app.html, LANG).
//
// Vorgeschichte: Die Sprache wurde zuletzt aus der Browsereinstellung abgeleitet.
// Damit lieferte DIESELBE Adresse je nach Besucher Deutsch oder Englisch — auch
// gegenueber Suchmaschinen, deren Renderer sich als en-US meldet. Die Folge war ein
// widerspruechliches Signal: deutscher Titel und deutsche Beschreibung im Quelltext,
// englischer Inhalt im gerenderten Dokument. Google bot fuer / und /app "Diese Seite
// uebersetzen" an, fuer die statischen Ratgeber-Seiten nicht.
//
// Neue Regel, und die haelt dieser Test fest:
//   1. ?lang aus der Adresse hat Vorrang
//   2. sonst die im Browser gemerkte eigene Wahl (cl_lang)
//   3. sonst Deutsch — NIE die Browsersprache
import fs from "node:fs";
import assert from "node:assert";
import test from "node:test";
import { fileURLToPath } from "node:url";
import path from "node:path";

const dir = path.dirname(fileURLToPath(import.meta.url));
const L = fs.readFileSync(path.join(dir, "..", "app.html"), "utf8").split("\n");

const s = L.findIndex((l) => l.includes("var LANG = (() => {"));
const e = L.findIndex((l, i) => i > s && l.trim() === "})();");
assert.ok(s >= 0 && e > s, "LANG-Block in app.html nicht gefunden — Anker geprueft?");
const quelle = L.slice(s, e + 1).join("\n");

// Baut LANG unter kontrollierten Bedingungen neu auf. URLSearchParams gibt es in Node.
// geladen: Sprachdateien, die der Lader im Kopf schon geholt hat (window.CL_SPRACHE);
// register: was es laut Kopf ueberhaupt gibt (window.CL_SPRACHEN).
function lang({ url = "", gemerkt = null, browser = "de-DE", geladen = null, register = null }) {
  const fake = {
    window: { location: { search: url }, localStorage: { getItem: () => gemerkt }, ...(geladen ? { CL_SPRACHE: geladen } : {}), ...(register ? { CL_SPRACHEN: register } : {}) },
    navigator: { language: browser },
  };
  return new Function(
    "window", "navigator",
    `${quelle}\nreturn LANG;`
  )(fake.window, fake.navigator);
}

test("Die Adresse hat Vorrang: ?lang=en ergibt Englisch", () => {
  assert.strictEqual(lang({ url: "?lang=en" }), "en");
  assert.strictEqual(lang({ url: "?lang=en-GB" }), "en");
  assert.strictEqual(lang({ url: "?p=abc&lang=en" }), "en", "auch neben anderen Parametern");
});

test("Die Adresse hat Vorrang auch andersherum: ?lang=de schlaegt eine gemerkte Wahl", () => {
  assert.strictEqual(lang({ url: "?lang=de", gemerkt: "en", browser: "en-US" }), "de");
});

test("Ohne Parameter gilt die eigene fruehere Wahl", () => {
  assert.strictEqual(lang({ gemerkt: "en" }), "en");
  assert.strictEqual(lang({ gemerkt: "de", browser: "en-US" }), "de");
});

// DER KERN: frueher stand hier "en", weil der Browser Englisch meldete.
test("Ohne Parameter und ohne eigene Wahl ist es Deutsch — egal was der Browser sagt", () => {
  assert.strictEqual(
    lang({ browser: "en-US" }), "de",
    "die Browsersprache darf die Sprache der Adresse nicht mehr ueberschreiben"
  );
  assert.strictEqual(lang({ browser: "fr-FR" }), "de");
  assert.strictEqual(lang({ browser: "" }), "de");
});

// Weitere Sprachen (Sprachfabrik): gewaehlt wird nur, was wirklich geladen ist.
test("eine weitere Sprache gilt, wenn ihre Datei geladen ist — sonst Englisch, nie Deutsch", () => {
  const register = { es: ["Español", "Cambiar la interfaz a español"] };
  const geladen = { es: { name: "Español", texte: () => ({}) } };
  assert.strictEqual(lang({ url: "?lang=es", geladen, register }), "es");
  assert.strictEqual(lang({ url: "?lang=es-MX", geladen, register }), "es", "die Landesfassung zaehlt als die Sprache");
  assert.strictEqual(lang({ gemerkt: "es", geladen, register }), "es", "die gemerkte Wahl gilt auch fuer weitere Sprachen");
  assert.strictEqual(lang({ url: "?lang=de", gemerkt: "es", geladen, register }), "de", "die Adresse schlaegt die gemerkte Wahl");
  // Im Register, aber die Datei kam nicht an (offline, alter Zwischenspeicher)
  assert.strictEqual(lang({ url: "?lang=es", register }), "en", "wer Spanisch waehlt und die Datei fehlt, bekommt Englisch");
  // Gar nicht im Register: wie bisher Deutsch
  assert.strictEqual(lang({ url: "?lang=qq", register }), "de");
  assert.strictEqual(lang({ url: "?lang=__proto__", register }), "de");
  // Der Browser entscheidet weiterhin nichts
  assert.strictEqual(lang({ browser: "es-ES", geladen, register }), "de");
});

test("Kaputte Umgebung faellt sauber auf Deutsch zurueck", () => {
  const gebrochen = new Function("window", "navigator", `${quelle}\nreturn LANG;`);
  assert.strictEqual(gebrochen(undefined, undefined), "de", "kein Absturz, sondern Deutsch");
});

console.log("sprachwahl: alle Tests gruen");
