// Erzeugt containerload.io/welt-karte.js: alle Laender als SVG-Pfade
// (Natural-Earth-Projektion, 1000x520, eine Nachkommastelle) mit deutschem
// Namen, Schluessel = ISO-Alpha-2. Einmalig generiert aus world-atlas.
import fs from 'node:fs';
import * as topojson from 'topojson-client';
import { geoNaturalEarth1, geoPath } from 'd3-geo';
import { iso31661 } from 'iso-3166';

const welt = JSON.parse(fs.readFileSync(new URL('node_modules/world-atlas/countries-110m.json', import.meta.url), 'utf8'));
const laender = topojson.feature(welt, welt.objects.countries);
const numZuAlpha = Object.fromEntries(iso31661.map((l) => [l.numeric, l.alpha2]));
const namen = new Intl.DisplayNames(['de'], { type: 'region' });

const proj = geoNaturalEarth1().fitSize([1000, 520], { type: 'FeatureCollection',
  features: laender.features.filter((f) => f.id !== '010') }); // ohne Antarktis
const pfad = geoPath(proj);

const out = {};
for (const f of laender.features) {
  if (f.id === '010') continue;
  const a2 = numZuAlpha[f.id];
  if (!a2) continue;
  const d = pfad(f);
  if (!d) continue;
  let name = a2;
  try { name = namen.of(a2) || a2; } catch (e) {}
  out[a2] = { p: d.replace(/(\d+\.\d)\d+/g, '$1'), n: name };
}
const js = "// Weltkarte fuer /admin: Laender als SVG-Pfade (Natural Earth, 1000x520,\n" +
  "// ohne Antarktis), generiert aus world-atlas countries-110m + ISO-3166 +\n" +
  "// deutschen Regionsnamen. Statische Daten -- nicht von Hand editieren.\n" +
  "var WELT = " + JSON.stringify(out) + ";\n";
fs.writeFileSync(new URL('../containerload.io/welt-karte.js', import.meta.url), js);
console.log('Laender:', Object.keys(out).length, '· Groesse:', Math.round(js.length / 1024) + ' KB', '· DE dabei:', !!out.DE, out.DE && out.DE.n);
