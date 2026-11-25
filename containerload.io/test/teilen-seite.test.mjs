// Die Zwischenseite eines geteilten Plans (share.html). Sie ist 450 ms zu sehen -- und das
// Erste, was der EMPFAENGER von ContainerLoad sieht. Jareks Fund (25.11.26): ein auf
// Chinesisch geteilter Plan (…&lang=zh) begruesste auf Deutsch, weil die Seite nur Deutsch
// und Englisch kannte. Seitdem gilt: sie spricht jede Sprache, die der Rechner spricht.
import fs from "node:fs";
import assert from "node:assert";
import test from "node:test";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { teilenSeite, sprachen, texte, SCHLUESSEL } from "../../werkzeug/teilen-seiten.mjs";

const dir = path.dirname(fileURLToPath(import.meta.url));
const lies = (f) => fs.readFileSync(path.join(dir, "..", f), "utf8");
const share = lies("share.html"), app = lies("app.html");

// Das Skript der Seite in einer nachgebauten Umgebung laufen lassen.
const skriptAus = (html) => /<script>\n([\s\S]*?)<\/script>/.exec(html)[1];
let skript = skriptAus(share);
function laufAuf(html, search, gemerkt) {
  const vorher = skript;
  skript = skriptAus(html);
  try { return lauf(search, gemerkt); } finally { skript = vorher; }
}
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

// ── Die Vorschau-Karte je Sprache ─────────────────────────────────────────────────────
// WhatsApp, Teams, Slack und LinkedIn zeigen zu einem Link eine Karte. Ihr Scraper liest nur
// den KOPF der Seite und fuehrt kein Skript aus -- die uebersetzte Zwischenseite oben hilft
// dem Menschen, der klickt, aber nicht der Karte, die er vorher sieht. Deshalb hat jede
// Sprache ausser Deutsch ihre eigene Seite /<kuerzel>/share mit eigenem Kopf und Bild.

test("jede Sprache des Rechners hat ihre Teilen-Seite -- Zeichen fuer Zeichen aus dem Generator", () => {
  assert.deepStrictEqual(sprachen(share).sort(), [...FREMD].sort(), "TEXTE in share.html und die Sprachen des Rechners laufen auseinander");
  for (const k of FREMD) {
    const pfad = path.join(dir, "..", k, "share.html");
    assert.ok(fs.existsSync(pfad), `${k}/share.html fehlt -- node werkzeug/teilen-seiten.mjs laufen lassen`);
    assert.strictEqual(fs.readFileSync(pfad, "utf8"), teilenSeite(share, k),
      `${k}/share.html ist veraltet oder von Hand geaendert -- node werkzeug/teilen-seiten.mjs laufen lassen`);
  }
  // Jede Sprache traegt alle Texte: die der Seite und die der Karte
  for (const [k, t] of Object.entries(texte(share))) assert.deepStrictEqual(Object.keys(t).sort(), [...SCHLUESSEL].sort(), `${k}: andere Schluessel`);
});

test("der Kopf jeder Sprachseite steht in ihrer Sprache -- das ist, was die Karte zeigt", () => {
  const gesehen = new Set();
  for (const k of FREMD) {
    const s = lies(`${k}/share.html`);
    const kopf = s.slice(0, s.indexOf("</head>"));
    const meta = (name) => { const m = kopf.match(new RegExp(`<meta (?:property|name)="${name}" content="([^"]*)"`)); assert.ok(m, `${k}: ${name} fehlt`); return m[1]; };
    assert.ok(s.includes(`<html lang="${k}">`), `${k}: lang-Attribut`);
    assert.strictEqual(meta("og:url"), `https://containerload.io/${k}/share`);
    assert.ok(kopf.includes(`<link rel="canonical" href="https://containerload.io/${k}/share" />`), `${k}: canonical`);
    assert.ok(kopf.includes('<meta name="robots" content="noindex,follow" />'), `${k}: die Zwischenseite gehoert nicht in den Index`);
    // Bild: eigene Datei je Sprache, vorhanden, 1200 x 630 (PNG-Kopf: Breite und Hoehe ab Byte 16)
    assert.strictEqual(meta("og:image"), `https://containerload.io/share-og-${k}.png`);
    assert.strictEqual(meta("twitter:image"), meta("og:image"));
    const png = fs.readFileSync(path.join(dir, "..", `share-og-${k}.png`));
    assert.strictEqual(png.readUInt32BE(16), 1200, `${k}: Bildbreite`);
    assert.strictEqual(png.readUInt32BE(20), 630, `${k}: Bildhoehe`);
    assert.ok(/og:image:width" content="1200"/.test(kopf) && /og:image:height" content="630"/.test(kopf));
    // Texte: einsprachig, nicht deutsch, nicht die einer anderen Sprache, in ueblicher Laenge
    const titel = meta("og:title"), text = meta("og:description");
    assert.strictEqual(meta("twitter:title"), titel);
    assert.strictEqual(meta("twitter:description"), text);
    const alles = [titel, text, meta("og:image:alt"), meta("description"), (kopf.match(/<title>([^<]*)<\/title>/) || [])[1]].join(" ");
    assert.ok(!/\b(Stauplan|Ladeplan|geteilt|öffnen|ohne|Ladung|Sieh|Login)\b/i.test(alles), `${k}: deutscher Rest im Kopf — ${alles}`);
    assert.ok(!alles.includes(" · "), `${k}: die Karte ist noch zweisprachig`);
    assert.ok(titel.length >= 8 && titel.length <= 70, `${k}: og:title mit ${titel.length} Zeichen`);
    assert.ok(text.length >= 20 && text.length <= 160, `${k}: og:description mit ${text.length} Zeichen`);
    assert.ok(!gesehen.has(titel), `${k}: derselbe Kartentitel wie eine andere Sprache`);
    gesehen.add(titel);
    // Auch OHNE Skript steht der Text der Seite in der Sprache im Markup
    const leib = s.slice(s.indexOf("<body>"), s.indexOf("<script>"));
    assert.ok(!/\b(Stauplan|Ladeplan|geteilt|öffnen)\b/i.test(leib), `${k}: deutscher Rest im Markup`);
    assert.ok(leib.includes(`href="/app?lang=${k}"`), `${k}: der Knopf ohne Skript fuehrt nicht in den Rechner dieser Sprache`);
  }
  // Die deutsche Seite bleibt zweisprachig: sie traegt auch alle alten Links (…&lang=en)
  assert.match(share, /og:title" content="Ein Ladeplan wurde mit dir geteilt · A load plan was shared with you"/);
});

test("eine Sprachseite kennt ihre Sprache auch ohne ?lang= und reicht sie weiter", () => {
  for (const k of FREMD) {
    const html = lies(`${k}/share.html`);
    const ohne = laufAuf(html, "?c=a~120x80x100&id=abc12345");
    assert.strictEqual(ohne.lang, k);
    assert.strictEqual(ohne.ziel, `/app?c=a~120x80x100&id=abc12345&lang=${k}`, `${k}: der Rechner ginge in der falschen Sprache auf`);
    assert.strictEqual(ohne.href, ohne.ziel);
    // Die gemerkte Wahl des EMPFAENGERS aendert die Seite nicht -- der Link ist der des Absenders
    assert.strictEqual(laufAuf(html, "?c=x", k === "fr" ? "es" : "fr").lang, k);
    // Mit ?lang= bleibt die Abfrage unveraendert
    const mit = laufAuf(html, `?c=x&lang=${k}&u=in`);
    assert.strictEqual(mit.ziel, `/app?c=x&lang=${k}&u=in`);
  }
  assert.strictEqual(laufAuf(lies("es/share.html"), "").ziel, "/app?lang=es");
  // Die deutsche Seite haengt nichts an
  assert.strictEqual(lauf("?c=x").ziel, "/app?c=x");
});

test("der Rechner gibt jeden Link ueber die Seite seiner Sprache heraus", () => {
  const m = /var teilAdresse = (\(url\) => [^\n]+;)\n/.exec(app);
  assert.ok(m, "teilAdresse nicht gefunden");
  const fuer = (LANG) => new Function("LANG", "return " + m[1])(LANG);
  const link = "https://containerload.io/share?c=a~120x80x100&lang=";
  assert.strictEqual(fuer("de")("https://containerload.io/share?c=a~120x80x100"), "https://containerload.io/share?c=a~120x80x100", "deutsche Links bleiben, wie sie sind");
  for (const k of FREMD) assert.strictEqual(fuer(k)(link + k), `https://containerload.io/${k}/share?c=a~120x80x100&lang=${k}`);
  // Ein Name, der zufaellig "/share?c=" enthaelt, wird nicht ein zweites Mal ersetzt
  assert.strictEqual(fuer("es")("https://x.io/share?c=a~1x1x1nA%2Fshare%3Fc%3D&lang=es"), "https://x.io/es/share?c=a~1x1x1nA%2Fshare%3Fc%3D&lang=es");
  // Alle Wege nach draussen laufen darueber: Teilen, QR-Code, Kopieren (mitId) und "Meine Plaene"
  assert.ok(app.includes('const mitId = (url) => teilAdresse(url) + "&id=" + planId'), "mitId gibt die Adresse ohne Sprachseite heraus");
  assert.ok(app.includes("const url = teilAdresse(encodePlanURL(d.preset, d.container, d.cargo, d.forceCentered, d.domain))"), "der Link aus 'Meine Plaene' geht an der Sprachseite vorbei");
  // encodePlanURL selbst bleibt beim alten Pfad: der Rampen-Schluessel hasht diese Adresse
  assert.ok(/const s = encodePlanURL\(preset, container, cargo, forceCentered, domain\);\n\s*for \(let i = 0; i < s\.length; i\+\+\) h = /.test(app), "der Rampen-Schluessel haengt nicht mehr an encodePlanURL");
  // Der Pfad ist erreichbar
  assert.match(lies("_redirects"), /^\/:lang\/share\s+\/:lang\/share\.html\s+200$/m, "_redirects kennt /<kuerzel>/share nicht");
});

test("die Bildquelle kennt jede Sprache", () => {
  const karte = lies("test/og/karte.html");
  for (const k of FREMD) assert.ok(new RegExp(`\\n    share_${k}: \\{`).test(karte), `test/og/karte.html: share_${k} fehlt -- dann node werkzeug/teilen-bilder.mjs`);
});
