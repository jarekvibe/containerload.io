// Erzeugt containerload.io/karte/land.js: Landflaechen und Laendergrenzen fuer die
// Hafenkarte als SVG-Pfade (Natural Earth 1:50 Mio., gemeinfrei, ueber world-atlas).
// Projektion Natural Earth I, eingepasst auf 2000 x 1040 (die ganze Kugel); die
// Hafen-Koordinaten rechnet haefen-bauen.mjs mit DERSELBEN Projektion (PROJ unten).
//
// Aufruf (im Ordner werkzeug/haefen):
//   npm install --no-save world-atlas@2 topojson-client@3 topojson-simplify@3 d3-geo@3
//   node land-bauen.mjs
// Nur noetig, falls die Karte neu gebaut werden muss -- die erzeugte Datei ist eingecheckt.
import fs from 'node:fs';
import * as topojson from 'topojson-client';
import * as simp from 'topojson-simplify';
import { geoNaturalEarth1, geoPath } from 'd3-geo';

export const BREITE = 2000, HOEHE = 1040;
export const PROJ = geoNaturalEarth1().fitExtent([[0, 0], [BREITE, HOEHE]], { type: 'Sphere' });

// Vereinfachen: die Haelfte der Stuetzpunkte bleibt. Gemessen (Nov. 2026): 250 KB Pfad,
// 68 KB gzip; beim Reinzoomen stehen Elbe-/Wesermuendung und die Strasse von Singapur
// noch erkennbar da. Die volle 1:50-Mio.-Fassung waere 730 KB.
const BEHALTEN = 0.5;

// Relativer Pfad mit einer Nachkommastelle (Path2D und SVG lesen beides).
export function pfadRelativ(geo) {
  const ringe = [];
  let ring = null;
  const ctx = {
    moveTo(x, y) { ring = [[x, y]]; ringe.push(ring); },
    lineTo(x, y) { ring.push([x, y]); },
    closePath() {}, arc() {}
  };
  geoPath(PROJ, ctx)(geo);
  let out = '';
  for (const r of ringe) {
    let px = Math.round(r[0][0] * 10), py = Math.round(r[0][1] * 10);
    let s = 'M' + px / 10 + ' ' + py / 10, n = 0;
    for (let i = 1; i < r.length; i++) {
      const x = Math.round(r[i][0] * 10), y = Math.round(r[i][1] * 10);
      const dx = x - px, dy = y - py;
      if (!dx && !dy) continue;
      s += 'l' + dx / 10 + (dy < 0 ? '' : ' ') + dy / 10;
      px = x; py = y; n++;
    }
    if (n >= 2) out += s + 'z';
  }
  return out.replace(/ -/g, '-');
}

// Der Weltausschnitt der Startansicht: 84 Grad Nord bis 58 Grad Sued (ohne Antarktis --
// dort liegt kein Containerhafen). Natural Earth I: y haengt nur von der Breite ab.
const r1 = (v) => Math.round(v * 10) / 10;
export const RAHMEN = [0, r1(PROJ([0, 84])[1]), BREITE, r1(PROJ([0, -58])[1])];

function vereinfacht(topo) {
  const pre = simp.presimplify(topo);
  return simp.simplify(pre, simp.quantile(pre, 1 - BEHALTEN));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const nm = (f) => new URL('node_modules/world-atlas/' + f, import.meta.url);
  const land = vereinfacht(JSON.parse(fs.readFileSync(nm('land-50m.json'), 'utf8')));
  const laender = vereinfacht(JSON.parse(fs.readFileSync(nm('countries-50m.json'), 'utf8')));
  const d = pfadRelativ(topojson.feature(land, land.objects.land));
  // Grenzen nur zwischen zwei Laendern (keine Kuestenlinie doppelt)
  const g = pfadRelativ(topojson.mesh(laender, laender.objects.countries, (a, b) => a !== b)).replace(/z/g, '');
  const js = '// Hafenkarte: Land und Laendergrenzen (Natural Earth 1:50 Mio., gemeinfrei),\n' +
    '// Projektion Natural Earth I auf ' + BREITE + ' x ' + HOEHE + '. Erzeugt von werkzeug/haefen/land-bauen.mjs -- nicht von Hand aendern.\n' +
    'window.CL_LAND = ' + JSON.stringify({ w: BREITE, h: HOEHE, rahmen: RAHMEN, land: d, grenzen: g }) + ';\n';
  const ziel = new URL('../../containerload.io/karte/land.js', import.meta.url);
  fs.mkdirSync(new URL('.', ziel), { recursive: true });
  fs.writeFileSync(ziel, js);
  console.log('land.js', js.length, 'Zeichen (Land', d.length, '· Grenzen', g.length + ')');
}
