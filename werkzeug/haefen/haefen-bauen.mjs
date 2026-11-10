// Erzeugt containerload.io/karte/haefen.js aus dem World Port Index (NGA Pub. 150,
// gemeinfrei): werkzeug/haefen/quelle/UpdatedPub150.csv (siehe HERKUNFT.md daneben).
//
// Aufruf (im Ordner werkzeug/haefen):
//   npm install --no-save d3-geo@3 world-atlas@2 topojson-client@3 topojson-simplify@3
//   node haefen-bauen.mjs
// Die Projektion kommt aus land-bauen.mjs -- Kueste und Haefen MUESSEN dieselbe haben.
//
// Was als "Hafen mit Containerumschlag" zaehlt, entscheidet der Index selbst: die Spalte
// "Facilities - Container" oder "Cranes - Container" steht auf Ja. Kein eigenes Urteil,
// keine Liste aus dem Gedaechtnis -- dieselbe Ehrlichkeitslinie wie im Rechner.
import fs from 'node:fs';
import { PROJ, RAHMEN } from './land-bauen.mjs';

const QUELLE = new URL('quelle/UpdatedPub150.csv', import.meta.url);
const HERKUNFT = new URL('quelle/HERKUNFT.md', import.meta.url);
const ZIEL = new URL('../../containerload.io/karte/haefen.js', import.meta.url);

// ── CSV lesen (Felder in Anfuehrungszeichen, Kommas und Zeilenumbrueche darin) ──
export function csvLesen(text) {
  const zeilen = [];
  let feld = '', zeile = [], inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) {
      if (c === '"') { if (text[i + 1] === '"') { feld += '"'; i++; } else inQ = false; }
      else feld += c;
    } else if (c === '"') inQ = true;
    else if (c === ',') { zeile.push(feld); feld = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      zeile.push(feld); feld = '';
      if (zeile.length > 1 || zeile[0] !== '') zeilen.push(zeile);
      zeile = [];
    } else feld += c;
  }
  if (feld !== '' || zeile.length) { zeile.push(feld); zeilen.push(zeile); }
  return zeilen;
}

// Spalten ueber ihren Namen finden; fehlt eine Pflichtspalte, bricht der Lauf ab
// (lieber laut scheitern als stillschweigend leere Felder ausliefern).
function spalten(kopf, wunsch) {
  const norm = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '');
  const idx = {};
  for (const [schluessel, namen, pflicht] of wunsch) {
    const i = kopf.findIndex((k) => namen.some((n) => norm(k) === norm(n)));
    if (i < 0 && pflicht) throw new Error('Spalte fehlt: ' + namen[0] + '\nKopf: ' + kopf.join(' | '));
    idx[schluessel] = i;
  }
  return idx;
}

const ja = (v) => /^(y|yes|ja|true|1)$/i.test(String(v || '').trim());
const zahl = (v) => { const n = parseFloat(String(v || '').replace(',', '.')); return Number.isFinite(n) && n > 0 ? Math.round(n * 10) / 10 : 0; };
const GROESSE = { 'very small': 1, 'small': 2, 'medium': 3, 'large': 4, v: 1, s: 2, m: 3, l: 4 };

// Laendername -> ISO-3166-Alpha-2, falls ein Hafen keinen UN/LOCODE traegt.
// Grundlage sind die englischen Namen, die Intl kennt, plus die Schreibweisen des Index.
const LAND_ALIAS = {
  'united states': 'US', 'united states of america': 'US', 'russia': 'RU', 'south korea': 'KR', 'korea, south': 'KR',
  'north korea': 'KP', 'korea, north': 'KP', 'vietnam': 'VN', 'taiwan': 'TW', 'iran': 'IR', 'syria': 'SY',
  'tanzania': 'TZ', 'bolivia': 'BO', 'venezuela': 'VE', 'moldova': 'MD', 'laos': 'LA', 'brunei': 'BN',
  'cape verde': 'CV', 'ivory coast': 'CI', "cote d'ivoire": 'CI', 'burma': 'MM', 'myanmar': 'MM',
  'congo': 'CG', 'democratic republic of the congo': 'CD', 'congo (democratic republic)': 'CD',
  'micronesia': 'FM', 'east timor': 'TL', 'timor-leste': 'TL', 'macau': 'MO', 'hong kong': 'HK',
  'falkland islands': 'FK', 'bahamas': 'BS', 'the bahamas': 'BS', 'gambia': 'GM', 'the gambia': 'GM',
  'turkey': 'TR', 'turkiye': 'TR', 'netherlands': 'NL', 'curacao': 'CW', 'saint martin': 'MF', 'sint maarten': 'SX'
};
const ISO2 = (() => {
  const dn = new Intl.DisplayNames(['en'], { type: 'region' });
  const m = { ...LAND_ALIAS };
  for (let a = 65; a <= 90; a++) for (let b = 65; b <= 90; b++) {
    const c = String.fromCharCode(a, b);
    try { const n = dn.of(c); if (n && n !== c) m[n.toLowerCase()] = m[n.toLowerCase()] || c; } catch (e) {}
  }
  return m;
})();

// Gewaesser: deutsche Namen fuer die Filter-Knoepfe. Fehlt ein Eintrag, steht dort der
// englische Name des Index -- und der Lauf meldet die Luecke.
export const GEW_DE = {};

function haupt() {
  const roh = fs.readFileSync(QUELLE, 'utf8').replace(/^﻿/, '');
  const [kopf, ...daten] = csvLesen(roh);
  const S = spalten(kopf, [
    ['nr', ['World Port Index Number'], true],
    ['name', ['Main Port Name'], true],
    ['alias', ['Alternate Port Name'], false],
    ['locode', ['UN/LOCODE', 'UNLOCODE'], true],
    ['land', ['Country Code', 'Country'], true],
    ['gew', ['World Water Body'], true],
    ['groesse', ['Harbor Size'], true],
    ['container', ['Facilities - Container'], true],
    ['kraene', ['Cranes - Container'], false],
    ['roro', ['Facilities - Ro-Ro'], false],
    ['stueckgut', ['Facilities - Breakbulk'], false],
    ['bahn', ['Communications - Rail', 'Railway'], false],
    ['tiefe', ['Cargo Pier Depth (m)'], false],
    ['laenge', ['Maximum Vessel Length (m)'], false],
    ['lat', ['Latitude'], true],
    ['lon', ['Longitude'], true]
  ]);
  const wert = (z, k) => (S[k] >= 0 ? String(z[S[k]] || '').trim() : '');
  const gewListe = [], gewIdx = new Map(), fehltDe = new Set(), ohneLand = new Set();
  const h = [];
  for (const z of daten) {
    const lat = parseFloat(wert(z, 'lat')), lon = parseFloat(wert(z, 'lon'));
    if (!Number.isFinite(lat) || !Number.isFinite(lon) || lat < -58 || lat > 84) continue;
    const locode = wert(z, 'locode').toUpperCase().replace(/[^A-Z0-9]/g, '');
    const lc = /^[A-Z]{2}[A-Z0-9]{3}$/.test(locode) ? locode : '';
    let iso = lc ? lc.slice(0, 2) : (ISO2[wert(z, 'land').toLowerCase()] || '');
    if (!iso) ohneLand.add(wert(z, 'land'));
    // Gewaesser: der erste Teil ("North Pacific Ocean; Gulf of Alaska" -> "North Pacific Ocean")
    const gewEn = wert(z, 'gew').split(';')[0].trim();
    let gi = -1;
    if (gewEn) {
      if (!gewIdx.has(gewEn)) { gewIdx.set(gewEn, gewListe.length); gewListe.push([gewEn, GEW_DE[gewEn] || '']); if (!GEW_DE[gewEn]) fehltDe.add(gewEn); }
      gi = gewIdx.get(gewEn);
    }
    let bits = 0;
    if (ja(wert(z, 'container')) || ja(wert(z, 'kraene'))) bits |= 1;
    if (ja(wert(z, 'kraene'))) bits |= 2;
    if (ja(wert(z, 'roro'))) bits |= 4;
    if (ja(wert(z, 'bahn'))) bits |= 8;
    if (ja(wert(z, 'stueckgut'))) bits |= 16;
    const [x, y] = PROJ([lon, lat]);
    const alias = wert(z, 'alias');
    h.push([wert(z, 'name'), lc, iso, Math.round(x * 10) / 10, Math.round(y * 10) / 10, bits,
      GROESSE[wert(z, 'groesse').toLowerCase()] || 0, zahl(wert(z, 'tiefe')), zahl(wert(z, 'laenge')), gi,
      Math.round(lat * 1e4) / 1e4, Math.round(lon * 1e4) / 1e4, alias === wert(z, 'name') ? '' : alias]);
  }
  h.sort((a, b) => (b[6] - a[6]) || (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
  const herkunft = fs.existsSync(HERKUNFT) ? fs.readFileSync(HERKUNFT, 'utf8') : '';
  const stand = (herkunft.match(/\d{4}-\d{2}-\d{2}/) || [''])[0];
  const out = { stand, quelle: 'World Port Index (NGA Pub. 150)', rahmen: RAHMEN, gew: gewListe, h };
  const js = '// Hafenkarte: Haefen aus dem World Port Index (NGA Pub. 150, gemeinfrei), Stand ' + stand + '.\n' +
    '// Erzeugt von werkzeug/haefen/haefen-bauen.mjs -- nicht von Hand aendern.\n' +
    'window.CL_HAEFEN = ' + JSON.stringify(out) + ';\n';
  fs.writeFileSync(ZIEL, js);
  const mitC = h.filter((r) => r[5] & 1).length;
  console.log('haefen.js', js.length, 'Zeichen ·', h.length, 'Haefen ·', mitC, 'mit Containerumschlag ·', gewListe.length, 'Gewaesser');
  if (fehltDe.size) console.log('Ohne deutschen Namen:', [...fehltDe].join(' | '));
  if (ohneLand.size) console.log('Ohne ISO-Land:', [...ohneLand].join(' | '));
}

if (import.meta.url === `file://${process.argv[1]}`) haupt();
