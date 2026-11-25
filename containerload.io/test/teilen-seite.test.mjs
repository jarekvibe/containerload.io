// Die Zwischenseite eines geteilten Plans (share.html). Sie ist 450 ms zu sehen -- und das
// Erste, was der EMPFAENGER von ContainerLoad sieht. Jareks Fund (25.11.26): ein auf
// Chinesisch geteilter Plan (…&lang=zh) begruesste auf Deutsch, weil die Seite nur Deutsch
// und Englisch kannte. Seitdem gilt: sie spricht jede Sprache, die der Rechner spricht.
import fs from "node:fs";
import assert from "node:assert";
import test from "node:test";
import { fileURLToPath } from "node:url";
import path from "node:path";

const dir = path.dirname(fileURLToPath(import.meta.url));
const lies = (f) => fs.readFileSync(path.join(dir, "..", f), "utf8");
const share = lies("share.html"), app = lies("app.html");

// Das Skript der Seite in einer nachgebauten Umgebung laufen lassen.
const skript = /<script>\n([\s\S]*?)<\/script>/.exec(share)[1];
function lauf(search, gemerkt) {
  const el = {};
  for (const id of ["s-ey", "s-h1", "s-p", "go", "s-noscript"]) el[id] = { innerHTML: "", textContent: "", attr: {}, setAttribute(k, v) { this.attr[k] = v; } };
  const document = { documentElement: { lang: "de" }, title: "Stauplan ansehen — ContainerLoad", getElementById: (id) => el[id] || null };
  let ziel = null;
  const window = {
    location: { search, replace: (u) => { ziel = u; } },
    localStorage: { getItem: (k) => (k === "cl_lang" ? gemerkt || null : null) },
  };
  let warte = null;
  new Function("window", "document", "setTimeout", "URLSearchParams", skript)(window, document, (fn, ms) => { warte = [fn, ms]; }, URLSearchParams);
  warte[0]();
  return { lang: document.documentElement.lang, titel: document.title, el, ziel, ms: warte[1], href: el.go.attr.href };
}

// Die Sprachen des Rechners: Deutsch und Englisch eingebaut, der Rest aus dem Register.
const register = /window\.CL_SPRACHEN = \{([\s\S]*?)\};/.exec(app)[1];
const WEITERE = [...register.matchAll(/(?:^|[\s,{])([a-z]{2}): \[/g)].map((m) => m[1]);
const FREMD = ["en", ...WEITERE];

test("die Seite spricht jede Sprache des Rechners", () => {
  assert.ok(WEITERE.length >= 3, "das Sprach-Register wurde nicht gelesen: " + WEITERE.join(","));
  const de = lauf("?c=a~120x80x100");
  assert.strictEqual(de.lang, "de");
  assert.strictEqual(de.el["s-h1"].innerHTML, "", "auf Deutsch bleibt der Text aus dem Markup stehen");
  const gesehen = new Set();
  for (const k of FREMD) {
    const r = lauf(`?c=a~120x80x100&lang=${k}&id=abc12345`);
    assert.strictEqual(r.lang, k, `${k}: lang-Attribut`);
    for (const id of ["s-ey", "s-h1", "s-p", "go"]) assert.ok(r.el[id].innerHTML.length > 3, `${k}: ${id} bleibt deutsch`);
    assert.ok(r.el["s-noscript"].textContent.length > 10, `${k}: der Hinweis ohne JavaScript bleibt deutsch`);
    assert.ok(/ContainerLoad$/.test(r.titel) && r.titel !== de.titel, `${k}: Titel bleibt deutsch`);
    assert.ok(r.el.go.innerHTML.endsWith("→"), `${k}: der Knopf traegt den Pfeil nicht`);
    assert.ok(r.el["s-h1"].innerHTML.includes("<br>"), `${k}: die Ueberschrift bricht nicht um`);
    // Kein deutsches Wort ist stehengeblieben, und keine zwei Sprachen teilen sich einen Text.
    const alles = [r.titel, ...["s-ey", "s-h1", "s-p", "go"].map((id) => r.el[id].innerHTML), r.el["s-noscript"].textContent].join(" ");
    assert.ok(!/\b(Stauplan|Ladeplan|geteilt|öffnen|ohne|Ladung|siehst)\b/i.test(alles), `${k}: deutscher Rest — ${alles}`);
    assert.ok(!gesehen.has(r.el["s-h1"].innerHTML), `${k}: dieselbe Ueberschrift wie eine andere Sprache`);
    gesehen.add(r.el["s-h1"].innerHTML);
  }
});

test("die Sprache kommt aus dem Link, sonst aus der gemerkten Wahl -- Unbekanntes bleibt deutsch", () => {
  assert.strictEqual(lauf("?c=x&lang=ZH-CN").lang, "zh", "Landesfassung und Grossschreibung");
  assert.strictEqual(lauf("?c=x", "fr").lang, "fr", "ohne ?lang= gilt die gemerkte Wahl");
  assert.strictEqual(lauf("?c=x&lang=es", "fr").lang, "es", "die Adresse schlaegt die gemerkte Wahl");
  assert.strictEqual(lauf("?c=x&lang=de", "en").lang, "de", "ein deutscher Link bleibt deutsch");
  assert.strictEqual(lauf("?c=x&lang=xx").lang, "de");
  assert.strictEqual(lauf("?c=x&lang=__proto__").lang, "de");
});

test("die Abfrage wandert unveraendert weiter -- Sprache, Einheit, Kennung", () => {
  const q = "?c=a~121.92x101.6x139.7w498.951607q9nPallets&lang=zh&id=r382yk8l&u=in";
  const r = lauf(q);
  assert.strictEqual(r.ziel, "/app" + q);
  assert.strictEqual(r.href, "/app" + q, "der Knopf zeigt woandershin als die Weiterleitung");
  assert.strictEqual(r.ms, 450);
});

test("der Rechner haengt die Sprache an jeden geteilten Link, der nicht deutsch ist", () => {
  assert.ok(app.includes('return window.location.origin + "/share?c=" + encodeURIComponent(s) + (LANG === "de" ? "" : "&lang=" + LANG);'));
});
