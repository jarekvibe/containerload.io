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
function lang({ url = "", gemerkt = null, browser = "de-DE" }) {
  const fake = {
    window: { location: { search: url }, localStorage: { getItem: () => gemerkt } },
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

test("Kaputte Umgebung faellt sauber auf Deutsch zurueck", () => {
  const gebrochen = new Function("window", "navigator", `${quelle}\nreturn LANG;`);
  assert.strictEqual(gebrochen(undefined, undefined), "de", "kein Absturz, sondern Deutsch");
});

console.log("sprachwahl: alle Tests gruen");
