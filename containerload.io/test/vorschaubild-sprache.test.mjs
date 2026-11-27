// Das Vorschaubild spricht die Sprache der Seite.
//
// Jarek, 27.11.26, mit einem Bildschirmfoto: der Link auf die ENGLISCHE Startseite zeigte in
// der Vorschau einen englischen Titel -- und daneben das Bild mit der deutschen Schlagzeile
// "Jede Ladung. Im richtigen Container." ("wenn ich einen englischen Link verschicke, will ich
// kein deutsches Embed"). Bis dahin trug jede Seite jeder Sprache og.png; eigene Bilder gab es
// nur fuer die Teilen-Seiten (share-og-<kuerzel>.png).
//
// Seitdem: og-<kuerzel>.png je Sprache (erzeugt von werkzeug/teilen-bilder.mjs aus
// test/og/karte.html?v=start&lang=<kuerzel>), und jede Seite zeigt auf das Bild IHRER Sprache.
// Die Pixel der Bilder prueft test/vorschaubild.test.mjs; hier: die Zuordnung.
import fs from "node:fs";
import assert from "node:assert";
import test from "node:test";
import { fileURLToPath } from "node:url";
import path from "node:path";

const dir = path.dirname(fileURLToPath(import.meta.url));
const W = path.join(dir, "..");
const lies = (p) => fs.readFileSync(path.join(W, p), "utf8");
const B = "https://containerload.io";

// Die Sprachen des Rechners ausser Deutsch: Englisch plus das Register im Kopf von app.html.
const register = /window\.CL_SPRACHEN = (\{.*\});/.exec(lies("app.html"));
assert.ok(register, "CL_SPRACHEN nicht gefunden");
const SPRACHEN = ["en", ...Object.keys(new Function("return " + register[1])())];

const meta = (s, name) => {
  const m = new RegExp(`<meta (?:property|name)="${name}" content="([^"]*)"`).exec(s);
  return m ? m[1] : null;
};
const alleSeiten = (ordner) => {
  const aus = [];
  const lauf = (o) => {
    for (const e of fs.readdirSync(path.join(W, o), { withFileTypes: true })) {
      const p = path.join(o, e.name);
      if (e.isDirectory()) lauf(p);
      else if (e.name.endsWith(".html")) aus.push(p);
    }
  };
  lauf(ordner);
  return aus;
};
// Breite und Hoehe stehen im Kopf jeder PNG-Datei (IHDR).
const masse = (datei) => { const b = fs.readFileSync(path.join(W, datei)); return [b.readUInt32BE(16), b.readUInt32BE(20), b.length]; };

test("jede Sprache des Rechners hat ihr eigenes Vorschaubild, 1200 x 630", () => {
  assert.ok(SPRACHEN.length >= 6, "das Register ist zu kurz gelesen: " + SPRACHEN.join(" "));
  for (const k of SPRACHEN) {
    const f = `og-${k}.png`;
    assert.ok(fs.existsSync(path.join(W, f)), `${f} fehlt -- node werkzeug/teilen-bilder.mjs laufen lassen`);
    const [w, h, bytes] = masse(f);
    assert.deepStrictEqual([w, h], [1200, 630], f);
    // Die Dienste (WhatsApp, Teams, LinkedIn) nehmen grosse Bilder nicht -- weit darunter bleiben.
    assert.ok(bytes > 20000 && bytes < 300000, `${f}: ${bytes} Bytes`);
  }
  // Und kein Bild fuer eine Sprache, die es nicht gibt (eine entfernte Sprache liesse es liegen).
  for (const f of fs.readdirSync(W).filter((x) => /^og-[a-z]{2}\.png$/.test(x))) {
    assert.ok(SPRACHEN.includes(f.slice(3, 5)), `${f}: diese Sprache steht nicht im Register`);
  }
});

test("jede Seite zeigt auf das Bild IHRER Sprache -- og:image und twitter:image gleich", () => {
  let gezaehlt = 0;
  for (const k of SPRACHEN) {
    for (const p of alleSeiten(k)) {
      const s = lies(p);
      const og = meta(s, "og:image");
      if (og === null) continue;   // Rechtsseiten u. ae. tragen kein Bild
      const soll = path.basename(p) === "share.html" && path.dirname(p) === k ? `${B}/share-og-${k}.png` : `${B}/og-${k}.png`;
      assert.strictEqual(og, soll, `${p}: og:image`);
      assert.strictEqual(meta(s, "twitter:image"), soll, `${p}: twitter:image`);
      assert.ok(!s.includes(`${B}/og.png`), `${p}: nennt noch das deutsche Bild`);
      gezaehlt++;
    }
  }
  assert.ok(gezaehlt > 50, `nur ${gezaehlt} Seiten geprueft -- die Suche greift nicht`);
});

test("die deutschen Seiten und der Rechner behalten og.png", () => {
  // Der Rechner hat EINE Adresse fuer alle Sprachen (/app, /app?lang=en ...): der Scraper liest
  // den Kopf, bevor ein ?lang= wirken koennte. Seine Karte bleibt deshalb die zweisprachige.
  const deutsch = ["index.html", "app.html", ...alleSeiten("ratgeber")];
  for (const p of deutsch) {
    const s = lies(p);
    assert.strictEqual(meta(s, "og:image"), `${B}/og.png`, `${p}: og:image`);
    // (Die deutsche Uebersicht /ratgeber/ traegt kein twitter:image -- dann gilt og:image.)
    const tw = meta(s, "twitter:image");
    if (tw !== null) assert.strictEqual(tw, `${B}/og.png`, `${p}: twitter:image`);
  }
  assert.strictEqual(meta(lies("share.html"), "og:image"), `${B}/share-og.png`);
  // Kein deutsches Bild einer Sprache auf einer deutschen Seite
  for (const p of deutsch) assert.ok(!/og-[a-z]{2}\.png/.test(lies(p)), `${p}: nennt ein Sprach-Bild`);
});

test("die Startseite jeder Sprache: Bild, Beschreibung des Bildes und strukturierte Daten in ihrer Sprache", () => {
  const de = lies("index.html");
  for (const k of SPRACHEN) {
    const s = lies(`${k}/index.html`);
    assert.strictEqual(meta(s, "og:image"), `${B}/og-${k}.png`);
    assert.strictEqual(meta(s, "og:image:width"), "1200");
    assert.strictEqual(meta(s, "og:image:height"), "630");
    // Die Beschreibung des Bildes ist der Satz der Sprache, nicht der deutsche
    assert.ok(meta(s, "og:image:alt") && meta(s, "og:image:alt") !== meta(de, "og:image:alt"), `${k}: og:image:alt ist deutsch`);
    const ld = JSON.parse(/<script type="application\/ld\+json">(.*?)<\/script>/s.exec(s)[1]);
    assert.strictEqual(ld.screenshot, `${B}/og-${k}.png`, `${k}: die strukturierten Daten zeigen das deutsche Bild`);
  }
  assert.strictEqual(JSON.parse(/<script type="application\/ld\+json">(.*?)<\/script>/s.exec(de)[1]).screenshot, `${B}/og.png`);
});

test("die Karte je Sprache ist einsprachig -- und ihre Schlagzeile ist der Satz der Startseite", () => {
  const quelle = lies("test/og/karte.html");
  const txt = new Function(/var TXT = (\{[\s\S]*?\n {2}\});\n/.exec(quelle)[1].replace(/^/, "return "))();
  const glatt = (t) => t.replace(/<[^>]+>/g, " ").replace(/[.,。，]/g, " ").replace(/\s+/g, " ").trim().toLowerCase();
  for (const k of SPRACHEN) {
    for (const art of ["start", "share"]) {
      const t = txt[`${art}_${k}`];
      assert.ok(t && t.k && t.h && t.e && t.f, `karte.html: ${art}_${k} fehlt oder ist unvollstaendig`);
      // Einsprachig: kein Trenner zwischen zwei Sprachen, keine zweite Zeile im Satz darunter
      assert.ok(!/&nbsp;|<br>/.test(t.k + t.e + t.f), `${art}_${k}: sieht nach der zweisprachigen Karte aus`);
      assert.strictEqual((t.h.match(/<br>/g) || []).length, 1, `${art}_${k}: die Schlagzeile hat nicht genau zwei Zeilen`);
      // Kein deutscher Rest
      assert.ok(!/Ladung|kostenlos|ohne Account|ohne Login|Stauplan|rechnen/.test(t.k + t.h + t.e + t.f), `${art}_${k}: deutscher Text auf der Karte`);
    }
    // Die Schlagzeile der Startseiten-Karte = og:title der Startseite dieser Sprache (ohne die Marke davor)
    const titel = meta(lies(`${k}/index.html`), "og:title");
    assert.ok(titel && titel.startsWith("ContainerLoad — "), `${k}: og:title der Startseite`);
    assert.strictEqual(glatt(txt[`start_${k}`].h), glatt(titel.slice("ContainerLoad — ".length)), `${k}: die Karte sagt etwas anderes als der Titel daneben`);
  }
  // Auswahl: ?v=start&lang=<k> nimmt die Karte der Sprache, ohne lang= die zweisprachige
  assert.ok(quelle.includes('Q.get("v") === "start" ? (TXT["start_" + SPR] || TXT.start) : (TXT["share_" + SPR] || TXT.share)'), "karte.html waehlt die Karte der Sprache nicht");
});

test("der Generator erzeugt beide Reihen und bricht ab, wenn ein Text nicht passt", () => {
  const gen = fs.readFileSync(path.join(W, "..", "werkzeug", "teilen-bilder.mjs"), "utf8");
  assert.ok(gen.includes("['share', `share-og-${k}.png`], ['start', `og-${k}.png`]"), "teilen-bilder.mjs erzeugt nicht beide Reihen");
  // Ohne die Schrift, ohne die Sprache oder mit einer umbrechenden Schlagzeile entsteht kein Bild
  for (const wache of ["die Schrift Archivo ist nicht geladen", "kennt ${v}_${k} nicht", "bricht auf ${Math.round(zeilen)} Zeilen um", "stoesst an Marke oder Fusszeile"]) {
    assert.ok(gen.includes(wache), `teilen-bilder.mjs: die Wache "${wache}" fehlt`);
  }
  // Der Startseiten-Generator setzt das Bild der Sprache
  const start = fs.readFileSync(path.join(W, "..", "werkzeug", "startseite-en.mjs"), "utf8");
  assert.ok(start.includes(`meta('property="og:image"', BASIS + '/og-' + K + '.png');`) && start.includes(`meta('name="twitter:image"', BASIS + '/og-' + K + '.png');`), "startseite-en.mjs setzt das Bild der Sprache nicht");
});
