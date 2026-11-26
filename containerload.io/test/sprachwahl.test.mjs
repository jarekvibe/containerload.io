// Regressionstest fuer die Sprachwahl im Rechner (app.html).
//
// Vorgeschichte: Die Sprache wurde zuletzt aus der Browsereinstellung abgeleitet.
// Damit lieferte DIESELBE Adresse je nach Besucher Deutsch oder Englisch — auch
// gegenueber Suchmaschinen, deren Renderer sich als en-US meldet. Die Folge war ein
// widerspruechliches Signal: deutscher Titel und deutsche Beschreibung im Quelltext,
// englischer Inhalt im gerenderten Dokument. Google bot fuer / und /app "Diese Seite
// uebersetzen" an, fuer die statischen Ratgeber-Seiten nicht.
//
// Die Regel, und die haelt dieser Test fest:
//   1. ?lang aus der Adresse hat Vorrang
//   2. sonst die im Browser gemerkte Sprache (cl_lang)
//   3. sonst Deutsch — NIE die Browsersprache
//
// Seit 26.11.26 mit EINER Ausnahme (Jarek: "bitte in der Sprache des Empfaengers"): ein
// GETEILTER PLAN (?c= / ?p=) oeffnet sich in der Sprache dessen, der ihn oeffnet --
//   1. die Sprache, die er hier selbst gewaehlt hat (cl_lang mit "!" dahinter),
//   2. sonst die Sprache seines Browsers, wenn der Rechner sie spricht,
//   3. sonst wie verschickt (lang= im Link, dann die zuletzt gesehene Sprache).
//
// Die Regel steht EINMAL, im Kopf der Seite (CL_SPRACHE_WUNSCH): der Lader dort holt damit
// die Sprachdatei, LANG liest dasselbe Ergebnis. Der Test laesst beides laufen, wie die
// Seite es tut: erst das Skript im Kopf, dann den LANG-Block.
import fs from "node:fs";
import assert from "node:assert";
import test from "node:test";
import { fileURLToPath } from "node:url";
import path from "node:path";

const dir = path.dirname(fileURLToPath(import.meta.url));
const roh = fs.readFileSync(path.join(dir, "..", "app.html"), "utf8");
const L = roh.split("\n");

const s = L.findIndex((l) => l.includes("var LANG = (() => {"));
const e = L.findIndex((l, i) => i > s && l.trim() === "})();");
assert.ok(s >= 0 && e > s, "LANG-Block in app.html nicht gefunden — Anker geprueft?");
const quelle = L.slice(s, e + 1).join("\n");

// Das Skript im Kopf: Register, Regel, Lader (bis zum Ende dieses <script>).
const ka = roh.indexOf("  window.CL_SPRACHEN = ");
assert.ok(ka > 0 && ka < roh.indexOf("var LANG = (() => {"), "das Sprach-Register steht nicht mehr im Kopf");
const kopf = roh.slice(ka, roh.indexOf("</script>", ka));
assert.ok(kopf.includes("window.CL_SPRACHE_WUNSCH = function"), "die Regel steht nicht im Kopf-Skript");

// Baut die Seite unter kontrollierten Bedingungen nach.
// geladen: Sprachdateien, die angekommen sind (window.CL_SPRACHE) -- das Register selbst
// (window.CL_SPRACHEN) setzt das Kopf-Skript.
function seite({ url = "", gemerkt = null, browser = "de-DE", geladen = null, eingebettet = false, speicherGesperrt = false }) {
  const geschrieben = [];
  const window = {
    location: { search: url },
    localStorage: { getItem: () => { if (speicherGesperrt) throw new Error("gesperrt"); return gemerkt; } },
    navigator: { language: browser },
  };
  window.self = window;
  window.top = eingebettet ? {} : window;
  new Function("window", "document", "URLSearchParams", kopf)(window, { write: (h) => geschrieben.push(h) }, URLSearchParams);
  if (geladen) window.CL_SPRACHE = geladen;
  const LANG = new Function("window", `${quelle}\nreturn LANG;`)(window);
  return { LANG, wunsch: window.CL_LANG_WUNSCH, geschrieben };
}
const lang = (o) => seite(o).LANG;
const datei = (k) => ({ [k]: { name: k, texte: () => ({}) } });
const ALLE = { es: {}, fr: {}, zh: {}, nl: {}, pt: {} };

test("Die Adresse hat Vorrang: ?lang=en ergibt Englisch", () => {
  assert.strictEqual(lang({ url: "?lang=en" }), "en");
  assert.strictEqual(lang({ url: "?lang=en-GB" }), "en");
  assert.strictEqual(lang({ url: "?q=abc&lang=en" }), "en", "auch neben anderen Parametern");
});

test("Die Adresse hat Vorrang auch andersherum: ?lang=de schlaegt eine gemerkte Wahl", () => {
  assert.strictEqual(lang({ url: "?lang=de", gemerkt: "en", browser: "en-US" }), "de");
  assert.strictEqual(lang({ url: "?lang=de", gemerkt: "en!", browser: "en-US" }), "de", "auch eine selbst gewaehlte: die Adresse sagt, was sie zeigt");
});

test("Ohne Parameter gilt die eigene fruehere Wahl", () => {
  assert.strictEqual(lang({ gemerkt: "en" }), "en");
  assert.strictEqual(lang({ gemerkt: "de", browser: "en-US" }), "de");
  // Selbst gewaehlt traegt ein "!" -- gelesen werden die ersten zwei Zeichen
  assert.strictEqual(lang({ gemerkt: "en!" }), "en");
  assert.strictEqual(lang({ gemerkt: "ES!", geladen: datei("es") }), "es");
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
  const geladen = datei("es");
  assert.strictEqual(lang({ url: "?lang=es", geladen }), "es");
  assert.strictEqual(lang({ url: "?lang=es-MX", geladen }), "es", "die Landesfassung zaehlt als die Sprache");
  assert.strictEqual(lang({ gemerkt: "es", geladen }), "es", "die gemerkte Wahl gilt auch fuer weitere Sprachen");
  assert.strictEqual(lang({ url: "?lang=de", gemerkt: "es", geladen }), "de", "die Adresse schlaegt die gemerkte Wahl");
  // Im Register, aber die Datei kam nicht an (offline, alter Zwischenspeicher)
  assert.strictEqual(lang({ url: "?lang=es" }), "en", "wer Spanisch waehlt und die Datei fehlt, bekommt Englisch");
  // Gar nicht im Register: wie bisher Deutsch
  assert.strictEqual(lang({ url: "?lang=qq" }), "de");
  assert.strictEqual(lang({ url: "?lang=__proto__" }), "de");
  assert.strictEqual(lang({ url: "?lang=constructor" }), "de");
  // Der Browser entscheidet weiterhin nichts
  assert.strictEqual(lang({ browser: "es-ES", geladen }), "de");
});

test("Kaputte Umgebung faellt sauber auf Deutsch zurueck", () => {
  const gebrochen = new Function("window", "navigator", `${quelle}\nreturn LANG;`);
  assert.strictEqual(gebrochen(undefined, undefined), "de", "kein Absturz, sondern Deutsch");
  // Gesperrter Speicher (privater Modus): die Adresse gilt trotzdem
  assert.strictEqual(lang({ url: "?lang=en", speicherGesperrt: true }), "en");
  assert.strictEqual(lang({ speicherGesperrt: true, browser: "en-US" }), "de");
});

// ── Der geteilte Plan: Sprache des Empfaengers ───────────────────────────────────────────
// Jareks Frage (26.11.26): Ein franzoesischer Verlader schickt den Plan seinem mexikanischen
// Kunden -- was kommt an? Bis dahin: Franzoesisch (das lang= des Absenders im Link).

test("ein geteilter Plan oeffnet sich in der Browsersprache des Empfaengers", () => {
  const fr = seite({ url: "?c=a~120x80x100&lang=fr&id=abc12345", browser: "es-MX", geladen: datei("es") });
  assert.strictEqual(fr.LANG, "es", "franzoesischer Link, spanischer Browser");
  assert.deepStrictEqual(fr.geschrieben, ['<script src="sprache/es.js"></script>'], "geladen wird die Sprache des Empfaengers, nicht die des Links");
  // Ein deutscher Empfaenger: nichts zu laden
  const de = seite({ url: "?c=a~120x80x100&lang=fr", browser: "de-DE" });
  assert.strictEqual(de.LANG, "de");
  assert.deepStrictEqual(de.geschrieben, []);
  assert.strictEqual(lang({ url: "?c=x&lang=es", browser: "en-US" }), "en");
  assert.strictEqual(lang({ url: "?c=x&lang=en", browser: "de-AT" }), "de", "ein alter englischer Link bei einem deutschen Empfaenger");
  // Ein deutscher Link (ohne lang=) bei einem brasilianischen Empfaenger
  assert.strictEqual(lang({ url: "?c=x", browser: "pt-BR", geladen: datei("pt") }), "pt");
  assert.strictEqual(lang({ url: "?c=x", browser: "zh-TW", geladen: datei("zh") }), "zh");
  // Das alte Link-Format ?p= genauso
  assert.strictEqual(lang({ url: "?p=abc&lang=en", browser: "de-DE" }), "de");
  // Die Datei der Empfaenger-Sprache kam nicht an: Englisch, wie ueberall
  assert.strictEqual(lang({ url: "?c=x&lang=fr", browser: "es-ES", geladen: datei("fr") }), "en");
});

test("spricht der Rechner die Browsersprache nicht, kommt der Plan an wie verschickt", () => {
  // Polnisch gibt es nicht: es bleibt beim lang= des Absenders -- niemand steht schlechter da als vorher
  assert.strictEqual(lang({ url: "?c=x&lang=fr", browser: "pl-PL", geladen: datei("fr") }), "fr");
  assert.strictEqual(lang({ url: "?c=x&lang=en", browser: "pl-PL" }), "en");
  assert.strictEqual(lang({ url: "?c=x", browser: "pl-PL" }), "de", "ein deutscher Link bleibt deutsch");
  assert.strictEqual(lang({ url: "?c=x", browser: "pl-PL", gemerkt: "en" }), "en", "ohne lang= die zuletzt gesehene Sprache, wie bisher");
  assert.strictEqual(lang({ url: "?c=x&lang=fr", browser: "", geladen: datei("fr") }), "fr", "kein Browser-Wert");
  assert.strictEqual(lang({ url: "?c=x&lang=fr", browser: "__proto__", geladen: datei("fr") }), "fr");
  // Nur die ERSTE Browsersprache zaehlt (Chrome und Firefox haengen jeder Liste Englisch an)
  assert.ok(!/navigator\.languages/.test(kopf), "die Liste der Browsersprachen wird durchsucht -- dort steht fast immer Englisch");
});

test("die selbst gewaehlte Sprache schlaegt den Browser -- eine bloss gesehene nicht", () => {
  // Ein Deutscher mit englischem Browser, der hier Deutsch gewaehlt hat
  assert.strictEqual(lang({ url: "?c=x&lang=fr", gemerkt: "de!", browser: "en-US" }), "de");
  assert.strictEqual(lang({ url: "?c=x&lang=fr", gemerkt: "pt!", browser: "de-DE", geladen: datei("pt") }), "pt");
  // Bloss gesehen (der Rechner merkt sich die zuletzt gezeigte Sprache): der Browser entscheidet.
  // Genau der Fall aus den Zugriffsdaten: Empfaenger in Peru hatten "en" gemerkt, weil ihr
  // erster Link lang=en trug.
  assert.strictEqual(lang({ url: "?c=x&lang=en", gemerkt: "en", browser: "es-PE", geladen: datei("es") }), "es");
  // Eine "gewaehlte" Sprache, die es nicht gibt, zaehlt nicht
  assert.strictEqual(lang({ url: "?c=x&lang=fr", gemerkt: "xx!", browser: "es-ES", geladen: datei("es") }), "es");
  assert.strictEqual(lang({ url: "?c=x&lang=en", gemerkt: "!!!", browser: "pl-PL" }), "en");
});

test("die Ausnahme gilt NUR fuer geteilte Plaene -- und nicht im eingebetteten Rechner", () => {
  const geladen = { ...datei("es"), ...datei("fr") };
  // Import-Links (?q=) der Wissensseiten, aus Excel, von KI-Assistenten: die Adresse entscheidet
  assert.strictEqual(lang({ url: "?lang=es&q=10%20palets%20120x80x100", browser: "de-DE", geladen }), "es");
  assert.strictEqual(lang({ url: "?q=10%20Paletten%20120x80x100", browser: "en-US" }), "de");
  assert.strictEqual(lang({ url: "?lang=fr&cont=40gp", browser: "de-DE", gemerkt: "de!", geladen }), "fr");
  // Eingebettet (iframe): dort bestimmt die einbettende Seite
  assert.strictEqual(lang({ url: "?c=x&lang=fr", browser: "de-DE", eingebettet: true, geladen }), "fr");
  assert.strictEqual(lang({ url: "?c=x", browser: "en-US", eingebettet: true }), "de");
  // Leeres c= ist kein Plan
  assert.strictEqual(lang({ url: "?c=&lang=fr", browser: "de-DE", geladen }), "fr");
});

test("gesperrter Speicher: der Empfaenger bekommt trotzdem seine Sprache", () => {
  assert.strictEqual(lang({ url: "?c=x&lang=fr", browser: "es-ES", speicherGesperrt: true, geladen: datei("es") }), "es");
  assert.strictEqual(lang({ url: "?c=x&lang=fr", browser: "pl-PL", speicherGesperrt: true, geladen: datei("fr") }), "fr");
});

test("was der Rechner entscheidet, entscheidet er beim naechsten Oeffnen wieder", () => {
  // Die Teilen-Seite reicht die entschiedene Sprache als lang= weiter, und in der Adresszeile
  // steht sie danach auch. Wer diese Adresse neu laedt, darf nichts anderes sehen.
  for (const browser of ["de-DE", "es-MX", "pl-PL", "en-US", "zh-CN", ""]) {
    for (const gemerkt of [null, "de", "fr", "en!", "nl!"]) {
      for (const link of ["", "&lang=fr", "&lang=en", "&lang=de"]) {
        const a = seite({ url: "?c=x" + link, browser, gemerkt, geladen: ALLE });
        const b = seite({ url: "?c=x&lang=" + a.LANG, browser, gemerkt: gemerkt && gemerkt.endsWith("!") ? gemerkt : a.LANG, geladen: ALLE });
        assert.strictEqual(b.LANG, a.LANG, `${browser} / ${gemerkt} / ${link}`);
      }
    }
  }
});

test("gemerkt wird: selbst gewaehlt mit Ausrufezeichen, und das bleibt stehen", () => {
  // Der Sprachumschalter im Rechner
  assert.ok(roh.includes('window.localStorage.setItem("cl_lang", l + "!");'), "setLangTo kennzeichnet die eigene Wahl nicht");
  // Beim Start merkt der Rechner die gezeigte Sprache -- aber nicht ueber eine eigene Wahl hinweg
  assert.ok(roh.includes('if (alt.charAt(2) !== "!") window.localStorage.setItem("cl_lang", LANG);'), "der Start ueberschreibt eine selbst gewaehlte Sprache");
  assert.strictEqual(roh.split('localStorage.setItem("cl_lang"').length - 1, 2, "eine weitere Stelle schreibt cl_lang -- gewaehlt oder gesehen?");
  // Die Sprachlinks der Startseite sind ebenfalls eine eigene Wahl; gelesen werden zwei Zeichen
  const start = fs.readFileSync(path.join(dir, "..", "index.html"), "utf8");
  assert.ok(start.includes("function merken(lang){try{localStorage.setItem('cl_lang',lang+'!');}catch(e){}}"));
  assert.ok(start.includes("var sv=String(localStorage.getItem('cl_lang')||'').toLowerCase().slice(0,2);"), "die Startseite liest \"en!\" nicht als Englisch");
  // Kein neuer Schluessel im Browser-Speicher: die Datenschutzseite nennt "die Sprache"
  assert.ok(!/cl_lang_|cl_sprache/.test(roh));
});

console.log("sprachwahl: alle Tests gruen");
