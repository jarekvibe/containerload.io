// Erzeugt die Vorschaubilder der Teilen-Seiten je Sprache -- containerload.io/share-og-<kuerzel>.png --
// aus containerload.io/test/og/karte.html (?v=share&lang=<kuerzel>), 1200 x 630.
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
  await pg.goto('file://' + path.join(SEITE, 'test', 'og', 'karte.html') + '?v=share&lang=' + k);
  await pg.evaluate(() => document.fonts.ready);
  const archivo = await pg.evaluate(() => document.fonts.check("700 60px 'Archivo'"));
  if (!archivo) { await br.close(); throw new Error('teilen-bilder: die Schrift Archivo ist nicht geladen -- --schriften <ordner> angeben'); }
  const ziel = path.join(SEITE, `share-og-${k}.png`);
  await pg.screenshot({ path: ziel });
  console.log(`share-og-${k}.png`, fs.statSync(ziel).size, 'Bytes');
}
await br.close();
