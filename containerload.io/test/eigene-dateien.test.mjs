// Die Seite liefert alles selbst aus: Tailwind (tailwind.css), React und Three.js (vendor/)
// und die Schriften (schrift/). Bis November 2026 kamen sie von cdn.tailwindcss.com,
// cdnjs.cloudflare.com und Google Fonts -- jeder Aufruf gab die IP-Adresse an drei fremde
// Server, und hinter einer Firmen-Firewall, die einen davon sperrt, blieb der Rechner stehen.
//
// Was dieser Test festhaelt:
//
//   1. Keine Seite laedt eine Ressource von einem fremden Server -- ausser dem einen, der
//      bleibt (der Besucherzaehler). Ein Link, den jemand anklickt, ist keine Ressource.
//   2. Die Content-Security-Policy in _headers erlaubt genau das und nicht mehr. Sie ist
//      die zweite Haelfte derselben Aussage: was dort nicht steht, blockiert der Browser.
//   3. Alles, worauf die Seiten zeigen, liegt auch da.
//   4. Die Bibliotheken sind unveraendert (Pruefsumme) -- "vendored" heisst: wie veroeffentlicht.
//
// Wer eine neue fremde Quelle braucht, traegt sie in ERLAUBT ein UND in _headers -- und
// klaert vorher die Datenschutzerklaerung (CLAUDE.md, Abschnitt 2 und 4).
//
// node --test test/eigene-dateien.test.mjs
import fs from "node:fs";
import assert from "node:assert";
import test from "node:test";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import path from "node:path";

const dir = path.dirname(fileURLToPath(import.meta.url));
const wurzel = path.join(dir, "..");
const lies = (f) => fs.readFileSync(path.join(wurzel, f), "utf8");
const html = (ordner) => fs.readdirSync(path.join(wurzel, ordner)).filter((f) => f.endsWith(".html")).map((f) => (ordner === "." ? f : ordner + "/" + f));
const seiten = [...html("."), ...html("ratgeber"), ...html("en/guide"), ...html("nl/gids")];

// Der eine fremde Server, der bleibt: GoatCounter (cookielos, in der Datenschutzerklaerung genannt).
const ERLAUBT = new Set(["gc.zgo.at"]);

// Alles, was eine Seite beim Oeffnen LAEDT (nicht: worauf sie verlinkt).
function ressourcen(s) {
  const aus = [];
  for (const m of s.matchAll(/<(script|img|iframe|source)\b[^>]*?\bsrc=(["'])(.*?)\2/g)) aus.push(m[3]);
  for (const m of s.matchAll(/<link\b([^>]*)>/g)) {
    if (/rel=(["'])(canonical|alternate)\1/.test(m[1])) continue;   // Verweise fuer Suchmaschinen, kein Abruf
    const h = /\bhref=(["'])(.*?)\1/.exec(m[1]);
    if (h) aus.push(h[2]);
  }
  for (const m of s.matchAll(/\.src\s*=\s*(["'])(.*?)\1/g)) aus.push(m[2]);                       // nachgeladene Skripte
  for (const m of s.matchAll(/@import\s+(?:url\()?\s*(["'])(.*?)\1/g)) aus.push(m[2]);
  for (const m of s.matchAll(/url\(\s*(["']?)((?:https?:)?\/\/[^)"']+)\1\s*\)/g)) aus.push(m[2]);
  return aus.filter((u) => u && !u.startsWith("data:") && !u.startsWith("#") && !u.includes("${"));
}
const istFremd = (u) => /^(https?:)?\/\//.test(u);
const host = (u) => new URL(u.startsWith("//") ? "https:" + u : u).host;

test("die Auslese sieht die Ressourcen ueberhaupt", () => {
  assert.ok(seiten.length >= 55, `nur ${seiten.length} Seiten gefunden`);
  const app = ressourcen(lies("app.html"));
  for (const erwartet of ["vendor/react-18.3.1.production.min.js", "vendor/react-dom-18.3.1.production.min.js", "vendor/three-r128.min.js", "tailwind.css", "schrift/schrift.css"]) {
    assert.ok(app.includes(erwartet), `app.html: ${erwartet} wird nicht (mehr) geladen oder nicht erkannt`);
  }
  assert.ok(ressourcen(lies("index.html")).includes("vendor/three-r128.min.js"), "index.html: das nachgeladene Three.js wird nicht erkannt");
});

test("keine Seite laedt etwas von einem fremden Server -- ausser dem Besucherzaehler", () => {
  for (const f of seiten) {
    const fremd = [...new Set(ressourcen(lies(f)).filter(istFremd).map(host).filter((h) => h !== "containerload.io" && !ERLAUBT.has(h)))];
    assert.deepStrictEqual(fremd, [], `${f} laedt von ${fremd.join(", ")} -- jeder fremde Server sieht die IP-Adresse des Besuchers`);
  }
});

test("die Content-Security-Policy erlaubt genau das und nicht mehr", () => {
  const m = /^\s*Content-Security-Policy:\s*(.+)$/m.exec(lies("_headers"));
  assert.ok(m, "_headers: keine Content-Security-Policy");
  const csp = Object.fromEntries(m[1].split(";").map((d) => d.trim().split(/\s+/)).map(([name, ...werte]) => [name, werte]));
  for (const weg of ["cdn.tailwindcss.com", "cdnjs.cloudflare.com", "fonts.googleapis.com", "fonts.gstatic.com"]) {
    assert.ok(!m[1].includes(weg), `_headers erlaubt noch ${weg} -- die Seite laedt von dort nichts mehr`);
  }
  // Skripte, Stile und Schriften: nur die eigene Seite (plus der Zaehler bei den Skripten).
  assert.deepStrictEqual(csp["script-src"].filter((w) => w.startsWith("http")), [...ERLAUBT].map((h) => "https://" + h));
  assert.deepStrictEqual(csp["style-src"].filter((w) => w.startsWith("http")), [], "style-src erlaubt einen fremden Server");
  assert.deepStrictEqual(csp["font-src"].filter((w) => w.startsWith("http")), [], "font-src erlaubt einen fremden Server");
  assert.ok(csp["default-src"].includes("'self'") && csp["object-src"].includes("'none'"));
});

test("alles, worauf die Seiten zeigen, liegt auch da", () => {
  for (const f of seiten) {
    for (const u of ressourcen(lies(f)).filter((u) => !istFremd(u))) {
      const pfad = u.split(/[?#]/)[0];
      if (!/\.(js|css|woff2|png|svg|ico|webmanifest)$/.test(pfad)) continue;
      const ziel = pfad.startsWith("/") ? path.join(wurzel, pfad) : path.join(wurzel, path.dirname(f), pfad);
      assert.ok(fs.existsSync(ziel), `${f}: ${u} gibt es nicht`);
    }
  }
  // Die Font-CSS zeigt relativ auf ihre Schriftdateien.
  for (const css of ["schrift/schrift.css", "schrift/druck.css"]) {
    const dateien = [...lies(css).matchAll(/url\(([^)]+)\)/g)].map((x) => x[1]);
    assert.ok(dateien.length >= 4, `${css}: keine Schriftdateien gefunden`);
    for (const d of dateien) assert.ok(fs.existsSync(path.join(wurzel, "schrift", d)), `${css}: ${d} gibt es nicht`);
  }
});

test("die Bibliotheken sind unveraendert", () => {
  // sha256 der Dateien, wie sie in den npm-Paketen stehen (react 18.3.1, react-dom 18.3.1,
  // three 0.128.0 = r128). Wer eine Version anhebt, aendert Dateiname UND Pruefsumme --
  // ueber werkzeug/bibliotheken/holen.mjs, nicht von Hand.
  const soll = {
    "vendor/react-18.3.1.production.min.js": "d949f1c3687aedadcedac85261865f29b17cd273997e7f6b2bfc53b2f9d4c4dd",
    "vendor/react-dom-18.3.1.production.min.js": "35f4f974f4b2bcd44da73963347f8952e341f83909e4498227d4e26b98f66f0d",
    "vendor/three-r128.min.js": "9274bbcec8d96168626c732b5d31c775aa8cfb7eaa0599bec0c175908a2c1ce2",
  };
  for (const [f, hash] of Object.entries(soll)) {
    const ist = crypto.createHash("sha256").update(fs.readFileSync(path.join(wurzel, f))).digest("hex");
    assert.strictEqual(ist, hash, `${f} ist nicht mehr die veroeffentlichte Datei`);
  }
  // React muss vor ReactDOM stehen, beide vor dem Rechner.
  const app = lies("app.html");
  assert.ok(app.indexOf("vendor/react-18.3.1") < app.indexOf("vendor/react-dom-18.3.1"), "ReactDOM steht vor React");
  // Die Lizenzen liegen bei den Dateien (MIT und OFL verlangen genau das).
  assert.ok(/MIT License/.test(lies("vendor/LIZENZEN.txt")) && /three/.test(lies("vendor/LIZENZEN.txt")));
  assert.ok(/SIL OPEN FONT LICENSE/i.test(lies("schrift/LIZENZEN.txt")));
});

test("der Ladevorschlag findet seine Schriften -- auch aus dem leeren Fenster heraus", () => {
  // Das Dokument entsteht per document.write in einem neuen Fenster; eine relative Adresse
  // haengt dort an einer geerbten Basis. LV_SCHRIFT loest sie deshalb einmal absolut auf.
  const app = lies("app.html");
  const zeile = app.split("\n").find((z) => z.includes("var LV_SCHRIFT ="));
  assert.ok(zeile, "LV_SCHRIFT nicht gefunden");
  const adresse = (href) => new Function("window", zeile + "\nreturn LV_SCHRIFT;")(href ? { location: { href } } : undefined);
  assert.strictEqual(adresse("https://containerload.io/app?c=abc"), "https://containerload.io/schrift/druck.css");
  assert.strictEqual(adresse("file:///C:/ordner/containerload.io/app.html"), "file:///C:/ordner/containerload.io/schrift/druck.css");
  assert.strictEqual(adresse(null), "schrift/druck.css", "ohne Fenster (Tests) bleibt die relative Adresse");
  assert.ok(app.includes('<link href="${LV_SCHRIFT}" rel="stylesheet">'), "LV_DOC bindet die Schriften nicht ueber LV_SCHRIFT ein");
});
