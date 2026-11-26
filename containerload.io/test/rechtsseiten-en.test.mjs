// Impressum und Datenschutz auf Englisch (Jareks Zusage, 25.11.26). Sein Fund: von der
// chinesischen Startseite fuehrte "法律声明" auf das deutsche Impressum.
//
// Die Regel: es gibt die deutsche Fassung (massgeblich) und EINE Uebersetzung, die englische.
// Jede nicht-deutsche Seite zeigt auf die englische -- auch die spanische, franzoesische,
// chinesische, niederlaendische. Rechtstexte in sechs Sprachen muesste man bei jeder Aenderung
// sechsfach pflegen, und eine schiefe Rechts-Uebersetzung ist schlechter als keine.
//
// Zwei Fassungen heisst: sie koennen auseinanderlaufen. Dieser Test haelt fest, was sich
// maschinell festhalten laesst -- Aufbau, Angaben, Gestaltung, Verweise.
import fs from "node:fs";
import assert from "node:assert";
import test from "node:test";
import { fileURLToPath } from "node:url";
import path from "node:path";

const dir = path.dirname(fileURLToPath(import.meta.url));
const lies = (...p) => fs.readFileSync(path.join(dir, "..", ...p), "utf8");
const PAARE = [["impressum.html", "en/imprint.html", "/impressum", "/en/imprint"], ["datenschutz.html", "en/privacy.html", "/datenschutz", "/en/privacy"]];
const stil = (s) => /<style>([\s\S]*?)<\/style>/.exec(s)[1];
const sichtbar = (s) => s.slice(s.indexOf("<body")).replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ");

test("die englische Fassung hat denselben Aufbau wie die deutsche", () => {
  for (const [de, en] of PAARE) {
    const d = lies(de), e = lies(en);
    assert.ok(e.includes('<html lang="en">'), `${en}: lang`);
    const h2 = (s) => (s.match(/<h2>/g) || []).length, abs = (s) => (s.match(/<p>|<p class="muted">/g) || []).length;
    assert.strictEqual(h2(e), h2(d), `${en}: ${h2(e)} Abschnitte, deutsch ${h2(d)} -- ein Abschnitt ist nur in einer Fassung`);
    assert.strictEqual(abs(e), abs(d), `${en}: ${abs(e)} Absaetze, deutsch ${abs(d)} -- ein Absatz ist nur in einer Fassung`);
    // Nummerierte Abschnitte (Datenschutz) tragen dieselben Nummern, und Verweise darauf stimmen.
    const nr = (s) => [...s.matchAll(/<h2>(\d+)\./g)].map((m) => m[1]).join(",");
    assert.strictEqual(nr(e), nr(d), `${en}: Abschnittsnummern`);
    const verweise = (s, wort) => [...s.matchAll(new RegExp(`${wort}&nbsp;(\\d+)`, "g"))].map((m) => m[1]).join(",");
    assert.strictEqual(verweise(e, "section"), verweise(d, "Abschnitt"), `${en}: Querverweise zeigen auf andere Abschnitte`);
    // Dieselbe Gestaltung -- keine weitere Kopie der Regeln, die wegdriftet.
    assert.strictEqual(stil(e), stil(d), `${en}: eigene Gestaltung`);
    assert.ok(e.includes('<meta name="robots" content="noindex" />'), `${en}: muss wie die deutsche Seite aus dem Index bleiben`);
  }
});

test("Anschrift, Kontakt und Empfaenger sind in beiden Fassungen dieselben", () => {
  for (const [de, en] of PAARE) {
    const d = sichtbar(lies(de)), e = sichtbar(lies(en));
    for (const t of ["Jarek Polep", "Ruhrstraße 51", "28205 Bremen", "info@containerload.io"]) assert.ok(d.includes(t) && e.includes(t), `${en}: ${t}`);
    assert.ok(e.includes("Germany") && !/\bDeutschland\b/.test(e), `${en}: Land`);
  }
  const d = sichtbar(lies("datenschutz.html")), e = sichtbar(lies("en/privacy.html"));
  // Wer Daten bekommt, steht in beiden Fassungen -- mit derselben Anschrift.
  for (const t of ["Netlify, Inc., 512 2nd Street, San Francisco, CA 94107, USA", "GoatCounter", "Anthropic, PBC", "Google Ireland Ltd.", "cdn.tailwindcss.com", "cdnjs.cloudflare.com", "Cloudflare, Inc.", "Tailwind Labs Inc."])
    assert.ok(d.includes(t) && e.includes(t), `Empfaenger ${t} fehlt in einer Fassung`);
  // Rechtsgrundlagen: gleich viele, dieselben Buchstaben in derselben Reihenfolge.
  const gr = (s, re) => [...s.matchAll(re)].map((m) => m[1]).join("");
  assert.strictEqual(gr(e, /Art\. 6 \(1\) \(([a-f])\) GDPR/g), gr(d, /Art\. 6 Abs\. 1 lit\. ([a-f]) DSGVO/g), "die Rechtsgrundlagen weichen ab");
  assert.ok(gr(e, /Art\. 6 \(1\) \(([a-f])\) GDPR/g).length >= 8);
  // Die Zusagen, an denen das Vertrauen haengt
  for (const re of [/Do Not Track/, /Global Privacy Control/, /without cookies/, /IP address is not stored/, /Nothing is transmitted until you press/, /unit of measurement/])
    assert.match(e, re, "die englische Fassung laesst eine Zusage aus: " + re);
});

test("die englische Fassung nennt die Knoepfe so, wie sie im englischen Rechner heissen", () => {
  const app = lies("app.html");
  const en = app.slice(app.indexOf("\n    en: {"));
  const e = sichtbar(lies("en/privacy.html"));
  for (const k of ["kiBtn", "kiFotoBtn", "chatBtn", "fbSendPlan", "fbSend", "fbAskTitle", "briefTitle", "briefBtn", "vmBtn", "plansBtn", "cargoReset", "undoBtn"]) {
    const m = new RegExp(`\\b${k}: "([^"]*)"`).exec(en);
    assert.ok(m, `Schluessel ${k} im englischen Woerterbuch nicht gefunden`);
    assert.ok(e.includes(`“${m[1]}”`), `en/privacy: nennt „${m[1]}" (${k}) nicht woertlich`);
  }
});

test("die Uebersetzung sagt, dass sie eine ist -- und beide Fassungen zeigen aufeinander", () => {
  for (const [de, en, dePfad, enPfad] of PAARE) {
    const e = lies(en), d = lies(de);
    assert.match(e, /<b>Translation\.<\/b>[^<]*Only the German version is legally binding/, `${en}: der Hinweis auf die massgebliche Fassung fehlt`);
    assert.ok(e.includes(`<a href="${dePfad}" hreflang="de" lang="de">`), `${en}: zeigt nicht auf die deutsche Fassung`);
    assert.ok(d.includes(`<a class="back" href="${enPfad}" hreflang="en" lang="en">English version</a>`), `${de}: zeigt nicht auf die englische Fassung`);
    assert.ok(e.includes('<a class="brand" href="/en/">') && e.includes('<a class="back" href="/en/">'), `${en}: fuehrt nicht auf die englische Startseite`);
    assert.ok(!/GOOD<\/style>/.test(d + e), "der kaputte Rest einer CSS-Regel steht wieder da");
    assert.ok(stil(d).includes(".good{color:#2FD8A0}"));
  }
});

test("nur deutsche Seiten zeigen auf die deutschen Rechtsseiten", () => {
  const alle = [];
  const lauf = (rel) => { for (const e of fs.readdirSync(path.join(dir, "..", rel), { withFileTypes: true })) { if (e.name === "test" || e.name === "node_modules") continue; const p = rel ? rel + "/" + e.name : e.name; if (e.isDirectory()) lauf(p); else if (e.name.endsWith(".html")) alle.push(p); } };
  lauf("");
  const deutsch = (p) => !/^(en|es|fr|zh|nl|pt)\//.test(p);
  let fremd = 0;
  for (const p of alle) {
    const s = lies(p);
    const de = /href="\/(impressum|datenschutz)"/.test(s), en = /href="\/en\/(imprint|privacy)"/.test(s);
    if (deutsch(p)) {
      // Deutsche Seiten zeigen nie auf die Uebersetzung -- ausser die Rechtsseiten selbst.
      if (!["impressum.html", "datenschutz.html"].includes(p)) assert.ok(!en, `${p}: deutsche Seite zeigt auf die englische Rechtsseite`);
      continue;
    }
    if (p === "en/imprint.html" || p === "en/privacy.html") continue;          // die zeigen bewusst zurueck
    assert.ok(!de, `${p}: zeigt auf die deutsche Rechtsseite statt auf die englische`);
    if (en) fremd++;
  }
  assert.ok(fremd >= 40, `nur ${fremd} nicht-deutsche Seiten verlinken die Rechtsseiten -- die Fusszeilen fehlen?`);
  // Der Generator der Startseiten haengt die Links um -- von Hand hielte das keinen Lauf aus.
  const gen = fs.readFileSync(path.join(dir, "..", "..", "werkzeug", "startseite-en.mjs"), "utf8");
  assert.ok(gen.includes("const RECHT = { '/impressum': '/en/imprint', '/datenschutz': '/en/privacy' };") && gen.includes("else if (RECHT[h]) n = RECHT[h];"));
  for (const k of ["en", "es", "fr", "zh"]) {
    const s = lies(k, "index.html");
    assert.ok(s.includes('href="/en/imprint"') && s.includes('href="/en/privacy"'), `/${k}/: Fusszeile zeigt nicht auf die englischen Rechtsseiten`);
  }
});
