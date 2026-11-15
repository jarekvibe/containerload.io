// Erzeugt containerload.io/karte/seeweg.js: das Seeweg-Netz fuer die Routen auf der
// Hafenkarte (Eurostat SeaRoute "marnet_plus_100km", EUPL-1.2).
//
// Aufruf (im Ordner werkzeug/haefen, braucht nur Node -- keine npm-Pakete):
//   node seeweg-bauen.mjs
//
// Bezogen wird das Netz aus dem npm-Paket searoute-ts@2.3.1 (Mayur Rawte, MIT), das es als
// Datei mitliefert. Wie beim World Port Index: Tarball laden, sha512 pruefen, die Datei
// dist/data/marnet.cjs als TEXT lesen und den eingebetteten JSON-Block selbst auslesen --
// der Code des Pakets laeuft nie. Gerechnet wird spaeter im Browser (karte/hafenkarte.js,
// HK_SEEWEG_START..ENDE), mit eigener Dijkstra-Suche.
import fs from 'node:fs';
import { paketLaden, tarDatei } from './npm-paket.mjs';

const PAKET = 'https://registry.npmjs.org/searoute-ts/-/searoute-ts-2.3.1.tgz';
const PAKET_SHA512 = 'edHIFZh1Q0SUsu5G12gf3Y+Qu/fBcNzFZIniujHFjRBSS/3xi+hhk//Vsnt3CX/mwbt1FxbHYj3s6yVzYMCDkA==';
const ZIEL = new URL('../../containerload.io/karte/seeweg.js', import.meta.url);

// Die Datei ist "module.exports = JSON.parse('<json>');" -- nur der String wird gelesen.
export function netzAusDatei(text) {
  const a = text.indexOf("JSON.parse(");
  if (a < 0) throw new Error('kein JSON.parse-Block');
  const rest = text.slice(a + 11).trim();
  if (rest[0] !== "'") throw new Error('unerwartetes Format');
  let s = '', i = 1;
  for (; i < rest.length; i++) {
    const c = rest[i];
    if (c === '\\') { s += rest[i + 1]; i++; continue; }
    if (c === "'") break;
    s += c;
  }
  const netz = JSON.parse(s);
  if (netz.type !== 'FeatureCollection' || !Array.isArray(netz.features) || netz.features.length < 5000) throw new Error('unerwartetes Netz');
  return netz;
}

export function netzVerdichten(netz) {
  // Knoten auf 0,01 Grad (gut 1 km) -- fuer Entfernungen und Zeichnung mehr als genug
  const idx = new Map(), n = [], e = [], p = {};
  const knoten = (c) => {
    const lo = Math.round(c[0] * 100), la = Math.round(c[1] * 100), k = lo + ',' + la;
    if (!idx.has(k)) { idx.set(k, n.length / 2); n.push(lo, la); }
    return idx.get(k);
  };
  const gesehen = new Set();
  for (const f of netz.features) {
    const cs = f.geometry && f.geometry.type === 'LineString' ? f.geometry.coordinates : [];
    const pass = f.properties && f.properties.pass ? String(f.properties.pass) : '';
    for (let j = 1; j < cs.length; j++) {
      const a = knoten(cs[j - 1]), b = knoten(cs[j]);
      if (a === b) continue;
      const k = a < b ? a + '-' + b : b + '-' + a;
      if (gesehen.has(k)) continue;
      gesehen.add(k);
      if (pass) p[e.length / 2] = pass;
      e.push(a, b);
    }
  }
  // Die Datumsgrenze braucht nichts Eigenes: das Netz fuehrt Kanten direkt ueber +-180 Grad
  // (z. B. 175 -> -180), und die Haversine-Formel rechnet sie richtig kurz. Die Karte
  // bricht die Linie dort nur beim Zeichnen.
  return { n, e, p };
}

async function haupt() {
  const tgz = await paketLaden(PAKET, PAKET_SHA512);
  const netz = netzAusDatei(tarDatei(tgz, 'package/dist/data/marnet.cjs').toString('utf8'));
  const { n, e, p } = netzVerdichten(netz);
  const out = { quelle: 'Eurostat SeaRoute, marnet_plus_100km (EUPL-1.2), über searoute-ts@2.3.1', n, e, p };
  const js = '// Hafenkarte: Seeweg-Netz (Eurostat SeaRoute marnet_plus_100km, EUPL-1.2; ueber searoute-ts).\n' +
    '// Knoten als [Laenge*100, Breite*100], Kanten als Knotenpaare, p = Passage je Kante.\n' +
    '// Erzeugt von werkzeug/haefen/seeweg-bauen.mjs -- nicht von Hand aendern.\n' +
    'window.CL_SEEWEG = ' + JSON.stringify(out) + ';\n';
  fs.writeFileSync(ZIEL, js);
  console.log('seeweg.js', js.length, 'Zeichen ·', n.length / 2, 'Knoten ·', e.length / 2, 'Kanten ·', Object.keys(p).length, 'mit Passage');
}

if (import.meta.url === `file://${process.argv[1]}`) haupt();
