// Ein geteilter Plan oeffnet sich in der Sprache des EMPFAENGERS.
//
// Jareks Frage (26.11.26): "Wenn ich ein franzoesischer Verlader bin, die Seite auf
// Franzoesisch habe und den Plan meinem mexikanischen Kunden teile -- wie kommt der Link bei
// ihm an?" Bis dahin: auf Franzoesisch. Der Link traegt die Sprache des ABSENDERS (die
// Sprachseite /fr/share und lang=fr), und Teilen-Seite wie Rechner zeigten genau die.
// Seine Antwort: "bitte in der Sprache des Empfaengers".
//
// Die Rangfolge, an ZWEI Stellen gefuehrt -- im Skript der Teilen-Seite (share.html und die
// daraus erzeugten Sprachseiten) und im Kopf des Rechners (CL_SPRACHE_WUNSCH in app.html):
//   1. die Sprache, die der Empfaenger bei ContainerLoad selbst gewaehlt hat (cl_lang "xx!"),
//   2. sonst die Sprache seines Browsers, wenn es sie gibt,
//   3. sonst wie verschickt.
// Zwei Stellen koennen auseinanderlaufen. Dieser Test laesst deshalb BEIDE mit denselben
// Eingaben laufen: was die Teilen-Seite 450 ms lang zeigt, muss der Rechner danach auch zeigen.
// (Die Regel des Rechners fuer sich prueft test/sprachwahl, die Seite fuer sich test/teilen-seite.)
import fs from "node:fs";
import assert from "node:assert";
import test from "node:test";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { texte } from "../../werkzeug/teilen-seiten.mjs";

const dir = path.dirname(fileURLToPath(import.meta.url));
const lies = (f) => fs.readFileSync(path.join(dir, "..", f), "utf8");
const app = lies("app.html"), share = lies("share.html");

const register = /window\.CL_SPRACHEN = \{([\s\S]*?)\};/.exec(app)[1];
const WEITERE = [...register.matchAll(/(?:^|[\s,{])([a-z]{2}): \[/g)].map((m) => m[1]);
const SPRACHEN = ["de", "en", ...WEITERE];
// Die Teilen-Seiten: "" ist /share (deutsch), sonst /<k>/share
const SEITEN = ["", "en", ...WEITERE];
const html = (k) => (k ? lies(`${k}/share.html`) : share);
const TEXTE = texte(share);

// ── Die Teilen-Seite, nachgestellt ──────────────────────────────────────────────────────
function teilen(seite, search, { gemerkt = null, browser = "" } = {}) {
  const quelle = html(seite);
  const skript = /<script>\n([\s\S]*?)<\/script>/.exec(quelle)[1];
  const el = {};
  for (const id of ["s-ey", "s-h1", "s-p", "go", "s-noscript"]) el[id] = { innerHTML: "", textContent: "", attr: {}, setAttribute(k, v) { this.attr[k] = v; } };
  const markup = /<html lang="([a-z]{2})">/.exec(quelle)[1];
  const document = { documentElement: { lang: markup }, title: "", getElementById: (id) => el[id] || null };
  let ziel = null, warte = null;
  const window = {
    location: { search, replace: (u) => { ziel = u; } },
    localStorage: { getItem: (k) => (k === "cl_lang" ? gemerkt : null) },
    navigator: { language: browser },
  };
  new Function("window", "document", "setTimeout", "URLSearchParams", skript)(window, document, (fn) => { warte = fn; }, URLSearchParams);
  warte();
  return { lang: document.documentElement.lang, markup, titel: document.title, el, ziel, href: el.go.attr.href };
}

// ── Der Rechner, nachgestellt: Kopf-Skript (Regel + Lader), dann der LANG-Block ──────────
const ka = app.indexOf("  window.CL_SPRACHEN = ");
const kopf = app.slice(ka, app.indexOf("</script>", ka));
const Z = app.split("\n");
const ls = Z.findIndex((l) => l.includes("var LANG = (() => {"));
const le = Z.findIndex((l, i) => i > ls && l.trim() === "})();");
const langBlock = Z.slice(ls, le + 1).join("\n");
function rechner(search, { gemerkt = null, browser = "" } = {}) {
  const geladen = [];
  const window = { location: { search }, localStorage: { getItem: () => gemerkt }, navigator: { language: browser } };
  window.self = window.top = window;
  new Function("window", "document", "URLSearchParams", kopf)(window, { write: (h) => geladen.push(h) }, URLSearchParams);
  // alle Sprachdateien kommen an
  window.CL_SPRACHE = Object.fromEntries(WEITERE.map((k) => [k, {}]));
  return new Function("window", `${langBlock}\nreturn LANG;`)(window);
}
// Die Abfrage ohne ihr lang= -- alles andere muss Zeichen fuer Zeichen gleich bleiben
const ohneLang = (adresse) => adresse.replace(/^\/app\??/, "").split("&").filter((t) => t && !t.startsWith("lang=")).join("&");

test("Jareks Fall: franzoesischer Absender, mexikanischer Empfaenger -- es kommt Spanisch an", () => {
  assert.ok(WEITERE.includes("fr") && WEITERE.includes("es"), "das Register wurde nicht gelesen");
  const q = "?c=a~120x80x100w300q22nPalettes&lang=fr&id=r382yk8l";
  const r = teilen("fr", q, { browser: "es-MX" });
  assert.strictEqual(r.lang, "es", "die Teilen-Seite bleibt franzoesisch");
  assert.strictEqual(r.el["s-h1"].innerHTML, TEXTE.es.h1);
  assert.strictEqual(r.el["s-p"].innerHTML, TEXTE.es.p);
  assert.strictEqual(r.el.go.innerHTML, TEXTE.es.go);
  assert.strictEqual(r.titel, TEXTE.es.titel);
  assert.strictEqual(r.ziel, "/app?c=a~120x80x100w300q22nPalettes&lang=es&id=r382yk8l", "der Plan, die Kennung und ihre Reihenfolge bleiben -- nur lang= wechselt");
  assert.strictEqual(r.href, r.ziel, "der Knopf zeigt woandershin als die Weiterleitung");
  assert.strictEqual(rechner(r.ziel.slice(4), { browser: "es-MX" }), "es");
  // Und wer die Adresse des Absenders am Rechner vorbei direkt oeffnet (aus der Adresszeile
  // kopiert und weitergeschickt), bekommt dasselbe
  assert.strictEqual(rechner("?c=a~120x80x100w300q22nPalettes&lang=fr&id=r382yk8l", { browser: "es-MX" }), "es");
});

test("jede Sprache des Empfaengers auf jeder Teilen-Seite", () => {
  for (const seite of SEITEN) {
    const absender = seite || "de";
    for (const b of SPRACHEN) {
      const q = "?c=a~120x80x100" + (seite ? "&lang=" + seite : "") + "&u=in";
      const r = teilen(seite, q, { browser: b + "-XX" });
      assert.strictEqual(r.lang, b, `Seite ${absender}, Browser ${b}`);
      if (b === absender) {
        // Absender und Empfaenger sprechen dieselbe Sprache: nichts wird angefasst
        assert.strictEqual(r.ziel, "/app" + q, `${absender} → ${b}: die Abfrage wandert nicht unveraendert weiter`);
        assert.strictEqual(r.el["s-h1"].innerHTML, seite ? TEXTE[seite].h1 : "", `${absender} → ${b}`);
      } else {
        assert.ok(new RegExp(`[?&]lang=${b}(&|$)`).test(r.ziel), `${absender} → ${b}: ${r.ziel}`);
        assert.strictEqual((r.ziel.match(/[?&]lang=/g) || []).length, 1, `${absender} → ${b}: lang= steht doppelt in ${r.ziel}`);
        assert.ok(r.el["s-h1"].innerHTML.length > 5, `${absender} → ${b}: die Ueberschrift bleibt in der Sprache der Seite`);
        if (b !== "de") assert.strictEqual(r.el["s-h1"].innerHTML, TEXTE[b].h1);
      }
      assert.strictEqual(ohneLang(r.ziel), ohneLang("/app" + q), `${absender} → ${b}: mehr als die Sprache hat sich geaendert`);
      assert.strictEqual(rechner(r.ziel.slice(4), { browser: b + "-XX" }), b, `${absender} → ${b}: der Rechner zeigt etwas anderes als die Teilen-Seite`);
    }
  }
});

test("ein deutscher Empfaenger liest auch auf einer fremden Teilen-Seite Deutsch", () => {
  // Die deutschen Texte stehen im MARKUP von /share -- auf /es/share steht dort Spanisch.
  // Das Skript traegt sie deshalb noch einmal; hier der Vergleich mit dem Markup.
  const m = /var DEUTSCH = (\{[\s\S]*?\n    \});/.exec(share);
  assert.ok(m, "DEUTSCH in share.html nicht gefunden");
  const DE = new Function("return " + m[1])();
  const leib = share.slice(share.indexOf("<body>"), share.indexOf("<script>"));
  assert.ok(share.includes(`<title>${DE.titel}</title>`), "DEUTSCH.titel weicht vom Titel der Seite ab");
  assert.ok(leib.includes(`id="s-ey">${DE.ey}</div>`), "DEUTSCH.ey weicht vom Markup ab");
  assert.ok(leib.includes(`<h1 id="s-h1">${DE.h1}</h1>`), "DEUTSCH.h1 weicht vom Markup ab");
  assert.ok(leib.includes(`<p id="s-p">${DE.p}</p>`), "DEUTSCH.p weicht vom Markup ab");
  assert.ok(leib.includes(`href="/app">${DE.go}</a>`), "DEUTSCH.go weicht vom Markup ab");
  assert.ok(share.includes(`>${DE.ns}</div></noscript>`), "DEUTSCH.ns weicht vom Hinweis ohne JavaScript ab");
  for (const seite of SEITEN.filter(Boolean)) {
    const r = teilen(seite, `?c=x&lang=${seite}&id=abc12345`, { browser: "de-DE" });
    assert.strictEqual(r.lang, "de", seite);
    assert.strictEqual(r.titel, DE.titel, seite);
    assert.strictEqual(r.el["s-h1"].innerHTML, DE.h1, seite);
    assert.strictEqual(r.el["s-noscript"].textContent, DE.ns, seite);
    assert.strictEqual(r.ziel, "/app?c=x&lang=de&id=abc12345", seite);
  }
  // Auf /share selbst bleibt das Markup stehen
  const r = teilen("", "?c=x", { browser: "de-DE" });
  assert.strictEqual(r.el["s-h1"].innerHTML, "");
  assert.strictEqual(r.ziel, "/app?c=x", "ein deutscher Link an einen deutschen Leser wird veraendert");
});

test("spricht ContainerLoad die Browsersprache nicht, aendert sich nichts gegenueber vorher", () => {
  // Vorher: lang= aus dem Link, sonst die Sprache der Seite, sonst die gemerkte.
  const vorher = (seite, q) => "/app" + q + (seite && !/[?&]lang=/.test(q) ? (q ? "&" : "?") + "lang=" + seite : "");
  for (const seite of SEITEN) {
    for (const q of ["?c=x", "?c=x&lang=fr&id=abc12345", "?c=x&lang=en", "?lang=es&c=x&u=in", ""]) {
      for (const browser of ["pl-PL", "tr", "", "it-IT", "ja-JP"]) {
        const r = teilen(seite, q, { browser });
        assert.strictEqual(r.ziel, vorher(seite, q), `Seite "${seite}", ${q}, Browser ${browser}`);
        const erwartet = (/lang=([a-z]{2})/.exec(q) || [])[1] || seite || "de";
        assert.strictEqual(r.lang, erwartet, `Seite "${seite}", ${q}, Browser ${browser}`);
      }
    }
  }
  // Die zuletzt gesehene Sprache gilt weiter, wo der Link keine nennt
  assert.strictEqual(teilen("", "?c=x", { gemerkt: "fr", browser: "pl-PL" }).lang, "fr");
  // Nur die erste Browsersprache: die Liste (navigator.languages) traegt fast immer Englisch
  for (const seite of SEITEN) assert.ok(!/navigator\.languages/.test(html(seite)), `${seite}: die Liste der Browsersprachen wird gelesen`);
});

test("die selbst gewaehlte Sprache schlaegt den Browser, die bloss gesehene nicht", () => {
  // Ein Deutscher mit englischem Browser, der hier einmal "Deutsch" gewaehlt hat
  const a = teilen("fr", "?c=x&lang=fr", { gemerkt: "de!", browser: "en-US" });
  assert.strictEqual(a.lang, "de");
  assert.strictEqual(a.ziel, "/app?c=x&lang=de");
  // Bloss gesehen: der Fall aus den Zugriffsdaten (Peru, erster Link trug lang=en)
  const b = teilen("en", "?c=x&lang=en", { gemerkt: "en", browser: "es-PE" });
  assert.strictEqual(b.lang, "es");
  // Eine gewaehlte Sprache, die es nicht gibt
  assert.strictEqual(teilen("", "?c=x&lang=en", { gemerkt: "xx!", browser: "pl-PL" }).lang, "en");
  assert.strictEqual(teilen("", "?c=x", { gemerkt: "__!", browser: "" }).lang, "de");
});

// DER KERN: zwei Stellen, eine Rangfolge.
test("Teilen-Seite und Rechner entscheiden in jedem Fall gleich", () => {
  const LINKS = [null, "de", "en", "es", "fr", "zh", "xx", ""];
  const GEMERKT = [null, "de", "es", "fr", "en!", "pt!", "de!", "xx!", "ES!", "nl"];
  const BROWSER = ["", "de-DE", "es-MX", "pl-PL", "zh-TW", "en-US", "PT-br", "nl", "fr-CA"];
  let faelle = 0;
  for (const seite of SEITEN) for (const link of LINKS) for (const gemerkt of GEMERKT) for (const browser of BROWSER) {
    const q = "?c=a~120x80x100q11" + (link === null ? "" : "&lang=" + link) + "&id=abc12345";
    const fall = `Seite "${seite}", ${q}, gemerkt ${gemerkt}, Browser "${browser}"`;
    const r = teilen(seite, q, { gemerkt, browser });
    // Der Rechner oeffnet, wohin die Seite weiterleitet -- mit demselben Speicher und Browser
    assert.strictEqual(rechner(r.ziel.slice(4), { gemerkt, browser }), r.lang, fall);
    // Nur lang= darf sich aendern
    assert.strictEqual(ohneLang(r.ziel), ohneLang("/app" + q), fall);
    assert.strictEqual(r.href, r.ziel, fall);
    // Was gezeigt wird, steht in der gezeigten Sprache da
    if (r.lang !== r.markup) assert.ok(r.el["s-h1"].innerHTML.length > 5 && r.titel.length > 5, fall + " -- Text bleibt in der Sprache der Seite");
    else assert.strictEqual(r.el["s-h1"].innerHTML, r.lang === "de" ? "" : TEXTE[r.lang].h1, fall);
    // Nach dem Oeffnen merkt der Rechner die gezeigte Sprache (eine eigene Wahl bleibt stehen):
    // wer die Adresse aus der Adresszeile neu laedt, sieht dasselbe.
    const danach = gemerkt && gemerkt.endsWith("!") ? gemerkt : r.lang;
    assert.strictEqual(rechner(r.ziel.slice(4), { gemerkt: danach, browser }), r.lang, fall + " -- beim Neuladen");
    faelle++;
  }
  assert.ok(faelle > 4000, "die Faelle wurden nicht durchlaufen: " + faelle);
});

test("die Vorschau-Karte bleibt, wie der Absender sie verschickt hat", () => {
  // Der Scraper von WhatsApp, Teams und Co. liest den Kopf und fuehrt kein Skript aus --
  // die Karte kann die Sprache des Empfaengers nicht kennen. Das Skript fasst den Kopf
  // deshalb gar nicht erst an (ausser dem Titel des Fensters).
  const skript = /<script>\n([\s\S]*?)<\/script>/.exec(share)[1];
  assert.ok(!/querySelector|getElementsByTagName|\.content\s*=|setAttribute\("content"/.test(skript), "das Skript der Teilen-Seite aendert die Angaben der Karte");
  // Und der Rechner gibt Links weiter in der Sprache des Absenders heraus
  assert.ok(app.includes('var teilAdresse = (url) => LANG === "de" ? url : url.replace("/share?c=", "/" + LANG + "/share?c=");'));
});

test("der Teilen-Dialog sagt es dem Absender -- in jeder Sprache", () => {
  const satz = (quelle) => (/shareDesc: "([^"]*)"/.exec(quelle) || [])[1];
  const de = /de: \{[\s\S]*?shareDesc: "([^"]*)"/.exec(app)[1];
  assert.match(de, /in seiner Sprache\.$/);
  const en = app.slice(app.indexOf('shareTitle: "Share plan"'));
  assert.match(satz(en), /in their own language\.$/);
  const gesehen = new Set([de, satz(en)]);
  for (const k of WEITERE) {
    const s = satz(lies(`sprache/${k}.js`));
    assert.ok(s && s.length > 25, `${k}: shareDesc fehlt`);
    assert.ok(/idioma|langue|taal|语言/.test(s), `${k}: der Satz nennt die Sprache des Empfaengers nicht — ${s}`);
    assert.ok(!gesehen.has(s), `${k}: derselbe Satz wie eine andere Sprache`);
    gesehen.add(s);
  }
});

console.log("empfaenger-sprache: alle Tests gruen");
