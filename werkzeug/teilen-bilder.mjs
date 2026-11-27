// Erzeugt die Vorschaubilder je Sprache aus containerload.io/test/og/karte.html, 1200 x 630:
//   share-og-<kuerzel>.png  (?v=share&lang=<kuerzel>)  -- die Teilen-Seite der Sprache
//   og-<kuerzel>.png        (?v=start&lang=<kuerzel>)  -- Startseite und Wissensseiten der Sprache
// Die zweite Reihe gibt es seit 27.11.26 (Jarek: "wenn ich einen englischen Link verschicke,
// will ich kein deutsches Embed") -- bis dahin trugen alle Seiten aller Sprachen og.png mit
// der deutschen Schlagzeile.
//
// Anders als die uebrigen Generatoren braucht dieser einen Browser: Playwright mit Chromium
// (nicht Teil des Projekts -- nur dort laufen lassen, wo es ohnehin vorhanden ist) und die
// Schriften der Karte. Die laedt die Karte von Google Fonts; wo das nicht geht, nimmt
// --schriften <ordner> einen Ordner mit "fonts.css" (die Antwort von fonts.googleapis.com fuer
// die Adresse im Kopf der Karte) und den darin genannten Dateien. Ohne Archivo saehe die
// Karte anders aus als og.png und share-og.png -- dann lieber nicht erzeugen.
//
// Welche Sprachen: die des TEXTE-Woerterbuchs in share.html (dieselbe Liste, aus der
// werkzeug/teilen-seiten.mjs die Seiten baut). test/vorschaubild.test.mjs liest die Pixel
// jedes Bildes nach (Masse, Grundton, Markenfarben, kein Verlauf).
//
// Aufruf: node werkzeug/teilen-bilder.mjs [--schriften <ordner>]
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { sprachen } from './teilen-seiten.mjs';

const { chromium } = createRequire(import.meta.url)('playwright');
const HIER = path.dirname(fileURLToPath(import.meta.url));
const SEITE = path.join(HIER, '..', 'containerload.io');
const i = process.argv.indexOf('--schriften');
const SCHRIFTEN = i > 0 ? path.resolve(process.argv[i + 1]) : null;

const br = await chromium.launch();
const pg = await br.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
if (SCHRIFTEN) {
  await pg.route('https://fonts.googleapis.com/**', (r) => r.fulfill({ status: 200, contentType: 'text/css', body: fs.readFileSync(path.join(SCHRIFTEN, 'fonts.css'), 'utf8') }));
  await pg.route('https://fonts.gstatic.com/**', (r) => {
    const datei = path.join(SCHRIFTEN, path.basename(new URL(r.request().url()).pathname));
    return fs.existsSync(datei) ? r.fulfill({ status: 200, contentType: 'font/woff2', headers: { 'access-control-allow-origin': '*' }, body: fs.readFileSync(datei) }) : r.abort();
  });
}
for (const k of sprachen(fs.readFileSync(path.join(SEITE, 'share.html'), 'utf8'))) {
  for (const [v, name] of [['share', `share-og-${k}.png`], ['start', `og-${k}.png`]]) {
    await pg.goto('file://' + path.join(SEITE, 'test', 'og', 'karte.html') + '?v=' + v + '&lang=' + k);
    await pg.evaluate(() => document.fonts.ready);
    const archivo = await pg.evaluate(() => document.fonts.check("700 60px 'Archivo'"));
    if (!archivo) { await br.close(); throw new Error('teilen-bilder: die Schrift Archivo ist nicht geladen -- --schriften <ordner> angeben'); }
    // Die Karte muss die Sprache wirklich kennen -- sonst zeigte sie still die zweisprachige.
    const sprache = await pg.evaluate(() => document.documentElement.lang);
    if (sprache !== k) { await br.close(); throw new Error(`teilen-bilder: karte.html kennt ${v}_${k} nicht`); }
    // Nichts darf aus der Textspalte in die Zeichnung laufen (lange Schlagzeilen brechen um).
    // Passt der Satz einer Sprache nicht: in karte.html kuerzen oder anders umbrechen.
    const zeilen = await pg.evaluate(() => { const h = document.getElementById('h'); return h.getBoundingClientRect().height / (parseFloat(getComputedStyle(h).fontSize) * 1.06); });
    // Die Karten der Startseite stehen zweizeilig wie og.png. Bei den Teilen-Karten sind drei
    // Zeilen geduldet: die portugiesische laeuft seit 26.11.26 so ("compartilhado com / você.").
    const grenze = v === 'start' ? 2.2 : 3.2;
    if (zeilen > grenze) { await br.close(); throw new Error(`teilen-bilder: die Schlagzeile ${v}_${k} bricht auf ${Math.round(zeilen)} Zeilen um -- ${Math.floor(grenze)} sind Platz`); }
    const text = await pg.evaluate(() => { const e = document.getElementById('e'); return e.getBoundingClientRect().height / (parseFloat(getComputedStyle(e).fontSize) * 1.4); });
    // Einsprachige Karten: EIN Satz in EINER Zeile (ein einzelnes Wort in der zweiten sieht verloren aus).
    if (text > 1.2) { await br.close(); throw new Error(`teilen-bilder: der Satz unter der Schlagzeile ${v}_${k} bricht auf ${Math.round(text)} Zeilen um -- kuerzen`); }
    // Und der Textblock darf weder die Marke oben noch die Fusszeile unten beruehren.
    const luft = await pg.evaluate(() => { const r = (s) => document.querySelector(s).getBoundingClientRect(); return { oben: r('#k').top - r('.marke').bottom, unten: r('.fuss').top - r('#e').bottom }; });
    if (luft.oben < 40 || luft.unten < 40) { await br.close(); throw new Error(`teilen-bilder: der Text von ${v}_${k} stoesst an Marke oder Fusszeile (${Math.round(luft.oben)} / ${Math.round(luft.unten)} px Luft)`); }
    const ziel = path.join(SEITE, name);
    await pg.screenshot({ path: ziel });
    console.log(name, fs.statSync(ziel).size, 'Bytes');
  }
}
await br.close();
