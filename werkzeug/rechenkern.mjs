// Erzeugt netlify/functions/lib/rechenkern.mjs -- den Rechenkern des Rechners (Presets,
// Text-Import, Packer, Kette, Empfehlung) als Modul fuer die Netlify Functions.
//
// Warum es das gibt: Die Schnittstelle fuer KI-Assistenten (/api/plan, /mcp) soll GENAU die
// Zahlen liefern, die der Rechner im Browser zeigt -- und der Rechner lebt in app.html, ohne
// Build-Schritt. Eine zweite, von Hand gepflegte Fassung des Packers waere frueher oder
// spaeter eine andere Rechnung. Deshalb wird der Kern aus app.html GESCHNITTEN, Zeile fuer
// Zeile unveraendert: von "EQUIPMENT-BEGIN" bis vor den LANG-Block. Dieser Bereich enthaelt
// alles, was rechnet, und nichts, was einen Browser braucht (React, THREE, window und
// document sind leere Platzhalter).
//
// Dazu die Tabellen des Link-Formats, die weiter hinten in app.html stehen (QCONT, QFZ,
// EINHEITEN, Sprachen) -- die Schnittstelle nimmt dieselben Parameter wie der Link /app?q=.
//
// Wer am Rechenkern in app.html etwas aendert, laesst danach diesen Generator laufen;
// test/rechenkern.test.mjs vergleicht die Datei Zeichen fuer Zeichen.
//
// Abhaengigkeitsfrei (reine Zeichenketten-Arbeit), damit der Test ihn direkt laden kann.
// Aufruf: node werkzeug/rechenkern.mjs
import fs from 'node:fs';

// Was das Modul herausgibt. Jeder Name muss im geschnittenen Bereich definiert sein.
export const EXPORTE = [
  'PRESETS', 'VEHICLES', 'TARA', 'MAXCHAIN', 'LDM_REF_WIDTH_CM',
  'num', 'uid', 'parseCargoText',
  'packKind', 'packCargo', 'makeFloorPacker',
  'chainContainers', 'chainVehicles', 'kettenGrund',
  'suggestContainer', 'suggestVehicles', 'recommendAll', 'tuerKonflikte',
];

const ANFANG = '// EQUIPMENT-BEGIN';
const ENDE = 'var LANG = (() => {';

export function rechenkern(app) {
  const L = app.split('\n');
  const a = L.findIndex((l) => l.includes(ANFANG));
  const b = L.findIndex((l) => l.includes(ENDE));
  if (a < 0 || b <= a) throw new Error('rechenkern: Anfang oder Ende des Rechenkerns in app.html nicht gefunden');
  const kern = L.slice(a, b).join('\n');
  for (const n of EXPORTE) {
    if (!new RegExp(`\\n  (?:var ${n} =|function ${n}\\()`).test('\n' + kern)) throw new Error(`rechenkern: "${n}" steht nicht (mehr) im geschnittenen Bereich`);
  }
  // Die Tabellen des Link-Formats: reine Objekt-Literale hinter ihren Ankern
  const tabelle = (anker) => {
    const i = L.findIndex((l) => l.includes(anker));
    const m = i < 0 ? null : /const k = (\{[\s\S]*?\});/.exec(L.slice(i, i + 8).join('\n'));
    if (!m) throw new Error('rechenkern: Tabelle nicht gefunden: ' + anker);
    return new Function('return ' + m[1])();
  };
  const cont = tabelle('var QCONT = (() => {'), fz = tabelle('var QFZ = (() => {');
  const einheiten = /var EINHEITEN = (\[[^\]]*\]);/.exec(app);
  const register = /window\.CL_SPRACHEN = (\{[^\n]*\});/.exec(app);
  if (!einheiten || !register) throw new Error('rechenkern: EINHEITEN oder CL_SPRACHEN nicht gefunden');
  const sprachen = ['de', 'en', ...Object.keys(new Function('return ' + register[1])())];
  return `// ERZEUGT von werkzeug/rechenkern.mjs aus containerload.io/app.html -- NICHT von Hand aendern.
// Der Rechenkern des Rechners, Zeile fuer Zeile wie in app.html (von "${ANFANG.slice(3)}" bis vor
// den LANG-Block). Nach jeder Aenderung dort: node werkzeug/rechenkern.mjs
/* eslint-disable */
// Der Kern braucht keinen Browser; diese vier Namen kommen in ihm nur in Teilen vor, die hier
// niemand aufruft (Farben, Zeichenhilfen).
const React = { createElement: () => null }, THREE = {}, window = {}, document = {};
${kern}
// ── Ende des geschnittenen Bereichs ──────────────────────────────────────────────────────
// Die Tabellen des Link-Formats (in app.html: QCONT, QFZ, EINHEITEN, CL_SPRACHEN).
export const CONT_CODES = ${JSON.stringify(cont)};
export const FZ_CODES = ${JSON.stringify(fz)};
export const EINHEITEN = ${JSON.stringify(new Function('return ' + einheiten[1])())};
export const SPRACHEN = ${JSON.stringify(sprachen)};
export { ${EXPORTE.join(', ')} };
`;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const app = fs.readFileSync(new URL('../containerload.io/app.html', import.meta.url), 'utf8');
  const ziel = new URL('../netlify/functions/lib/rechenkern.mjs', import.meta.url);
  const s = rechenkern(app);
  fs.writeFileSync(ziel, s);
  console.log('netlify/functions/lib/rechenkern.mjs', s.length, 'Zeichen');
}
