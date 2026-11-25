// Erzeugt den Palettenrechner in beiden Sprachen:
//   containerload.io/ratgeber/palettenrechner.html
//   containerload.io/en/guide/pallet-calculator.html
//
// Warum ein Generator und keine Handarbeit: Die Seite rechnet mit DEMSELBEN Packer wie der
// 3D-Rechner (makeFloorPacker, woertlich aus app.html kopiert) und mit denselben Innenmassen
// (PRESETS / VEHICLES). Auch jede Zahl im Text und in den Tabellen kommt aus diesem Packer.
// Aendert sich in app.html der Packer oder ein Mass, laesst man diesen Generator laufen, und
// Widget, Tabellen und Text ziehen mit. test/palettenrechner.test.mjs vergleicht beide
// Dateien Zeichen fuer Zeichen mit dem, was palettenSeiten() aus app.html macht.
//
// Geprueft (Nov. 2026, 720 Faelle): Bodenlage x floor(Innenhoehe / Palettenhoehe), begrenzt
// durch floor(Zuladung / kg), ist genau das, was packCargo im Rechner stellt. Darum darf das
// Widget diese Zahl nennen UND jede Zeile mit genau dieser Menge in 3D oeffnen.
//
// Abhaengigkeitsfrei. Aufruf: node werkzeug/palettenrechner.mjs
import fs from 'node:fs';

const BASIS = 'https://containerload.io';
const DE_PFAD = '/ratgeber/palettenrechner', EN_PFAD = '/en/guide/pallet-calculator';

// Der Packer als Quelltext, genau so, wie er in app.html steht (von "function makeFloorPacker"
// bis zur schliessenden Klammer auf derselben Einrueckung).
export function packerQuelle(app) {
  const L = app.split('\n');
  const a = L.findIndex((l) => l.startsWith('  function makeFloorPacker('));
  const e = L.findIndex((l, i) => i > a && l === '  }');
  if (a < 0 || e < 0) throw new Error('makeFloorPacker nicht gefunden');
  return L.slice(a, e + 1).join('\n');
}
function tabelleAus(app, name) {
  const L = app.split('\n');
  const a = L.findIndex((l) => l.includes('var ' + name + ' = {'));
  const e = L.findIndex((l, i) => i > a && l.trim() === '};');
  return new Function(L.slice(a, e + 1).join('\n') + '\nreturn ' + name + ';')();
}

// Die Laderaeume des Widgets, in Anzeigereihenfolge. cont/fz = der Deeplink-Schluessel, den
// app.html in seiner Whitelist kennt (QCONT / QFZ).
const RAEUME = [
  { k: '20gp', quelle: 'P', name: "20' GP", cont: '20gp' },
  { k: '40gp', quelle: 'P', name: "40' GP", cont: '40gp' },
  { k: '40hc', quelle: 'P', name: "40' HC", cont: '40hc' },
  { k: '45hc', quelle: 'P', name: "45' HC", cont: '45hc' },
  { k: 'sattel', quelle: 'V', name: 'Planensattel', fz: 'sattel' },
  { k: 'wb', quelle: 'V', name: 'Wechselbrücke', fz: 'wb' },
  { k: 'mw', quelle: 'V', name: 'Motorwagen', fz: 'mw' },
  { k: '75t', quelle: 'V', name: '7,5-Tonner', fz: '75t' },
  { k: 'sprinter', quelle: 'V', name: 'Sprinter', fz: 'sprinter' }
];
export function raeume(app) {
  const P = tabelleAus(app, 'PRESETS'), V = tabelleAus(app, 'VEHICLES');
  return RAEUME.map((r) => {
    const m = (r.quelle === 'P' ? P : V)[r.name];
    if (!m) throw new Error('Laderaum fehlt in app.html: ' + r.name);
    const o = { k: r.k, l: m.l, w: m.w, h: m.h, kg: m.payload };
    if (r.cont) o.cont = r.cont; else o.fz = r.fz;
    return o;
  });
}

const PALETTEN = [
  { k: '120x80', l: 120, w: 80 }, { k: '120x100', l: 120, w: 100 }, { k: '122x102', l: 122, w: 102 },
  { k: '124x83', l: 124, w: 83 }, { k: '80x60', l: 80, w: 60 }, { k: '114x114', l: 114, w: 114 }
];

const TXT = {
  de: {
    lang: 'de', locale: 'de_DE', pfad: DE_PFAD, home: '/', app: '/app', loc: 'de-DE', dez: ',',
    titel: 'Palettenrechner: Wie viele Paletten passen in den Container?',
    desc: 'Kostenloser Palettenrechner: Euro-, Industrie- und US-Paletten für 20′, 40′, High Cube, Planensattel und Transporter – mit Stapeln, Gewicht und 3D.',
    langLabel: 'Sprache', kopfBtn: '3D-Rechner öffnen', eyebrow: 'Container-Wissen · Palettenrechner',
    h1: 'Palettenrechner: Wie viele Paletten passen in Container und LKW?',
    raum: { '20gp': '20′ Standard', '40gp': '40′ Standard', '40hc': '40′ High Cube', '45hc': '45′ High Cube', sattel: 'Planensattel', wb: 'Wechselbrücke', mw: 'Motorwagen', '75t': '7,5-Tonner', sprinter: 'Transporter (Sprinter)' },
    pal: { '120x80': 'Europalette 120 × 80', '120x100': 'Industriepalette 120 × 100', '122x102': 'US-Palette 122 × 102 (48 × 40″)', '124x83': 'Gitterbox 124 × 83', '80x60': 'Halbpalette 80 × 60', '114x114': 'Chemiepalette CP3 114 × 114', eigen: 'Eigene Maße' },
    f: { art: 'Palette', l: 'Länge (cm)', w: 'Breite (cm)', h: 'Höhe inkl. Ware (cm)', kg: 'kg je Palette · optional', stapel: 'stapelbar', hPh: 'z. B. 150', kgPh: 'z. B. 400' },
    th: ['Laderaum', 'Boden', 'Lagen', 'Paletten', ''],
    cfgT: "{ zuHoch: 'zu hoch', zul: 'Zuladung', d3: '3D →', d3Titel: 'Diese Zeile im 3D-Rechner öffnen', ohneH: 'Höhe eintragen: dann zählt der Rechner die Lagen und öffnet jede Zeile in 3D.', stapelOhneH: 'Für „stapelbar“ braucht der Rechner die Höhe der beladenen Palette.', kgHinweis: '„Zuladung“: Hier ist das Gewicht zuerst voll, nicht der Platz.', klein: 'Ab 40 cm je Seite. Kleinere Packstücke (Kartons) rechnet der 3D-Rechner.', rechnet: 'rechnet …' }",
    flach: ' nicht stapelbar', qhref: "function (q, r) { return '/app?q=' + encodeURIComponent(q) + (r.cont ? '&cont=' + r.cont : '&d=road&fz=' + r.fz); }",
    unterWidget: 'Gerechnet mit demselben Packer wie der 3D-Rechner, auf den typischen Innenmaßen der Container und Fahrzeuge. Ein Klick auf „3D →“ öffnet genau diese Ladung.',
  },
  en: {
    lang: 'en', locale: 'en_GB', pfad: EN_PFAD, home: '/en/', app: '/app?lang=en', loc: 'en-GB', dez: '.',
    titel: 'Pallet calculator: how many pallets fit in a container?',
    desc: 'Free pallet calculator: euro, industrial and standard US pallets in 20ft, 40ft and high cube containers and trucks – with stacking, weight and a 3D check.',
    langLabel: 'Language', kopfBtn: 'Open 3D calculator', eyebrow: 'Container Guide · Pallet calculator',
    h1: 'Pallet calculator: how many pallets fit in a container or truck?',
    raum: { '20gp': '20ft standard', '40gp': '40ft standard', '40hc': '40ft high cube', '45hc': '45ft high cube', sattel: 'Curtainsider', wb: 'Swap body', mw: 'Rigid truck', '75t': '7.5-t truck', sprinter: 'Van (Sprinter)' },
    pal: { '120x80': 'Euro pallet 120 × 80', '120x100': 'Industrial pallet 120 × 100', '122x102': 'US pallet 48 × 40″ (122 × 102)', '124x83': 'Wire mesh pallet 124 × 83', '80x60': 'Half pallet 80 × 60', '114x114': 'Chemical pallet CP3 114 × 114', eigen: 'Custom size' },
    f: { art: 'Pallet', l: 'Length (cm)', w: 'Width (cm)', h: 'Height incl. goods (cm)', kg: 'kg per pallet · optional', stapel: 'stackable', hPh: 'e.g. 150', kgPh: 'e.g. 400' },
    th: ['Load space', 'Floor', 'Tiers', 'Pallets', ''],
    cfgT: "{ zuHoch: 'too high', zul: 'payload', d3: '3D →', d3Titel: 'Open this row in the 3D calculator', ohneH: 'Enter the height: the calculator then counts the tiers and opens each row in 3D.', stapelOhneH: 'For “stackable” the calculator needs the height of the loaded pallet.', kgHinweis: '“payload”: here the weight runs out before the space does.', klein: 'From 40 cm per side. Smaller packages (cartons) are handled by the 3D calculator.', rechnet: 'calculating …' }",
    flach: ' not stackable', qhref: "function (q, r) { return '/app?q=' + encodeURIComponent(q) + (r.cont ? '&cont=' + r.cont : '&d=road&fz=' + r.fz) + '&lang=en'; }",
    unterWidget: 'Calculated with the same packer as the 3D calculator, on the typical internal dimensions of the containers and vehicles. A click on “3D →” opens exactly this load.',
  }
};

const LOGO = '<span class="mark"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true"><polygon points="12,3.4 19.6,7.8 12,12.2 4.4,7.8" fill="#0A2B46" /><polygon points="4.4,7.8 12,12.2 12,20.6 4.4,16.2" fill="#165780" /><polygon points="19.6,7.8 12,12.2 12,20.6 19.6,16.2" fill="#0F3C60" /></svg></span><span class="brand-name">Container<span class="brand-load">Load</span></span>';
const KOPF = `<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Archivo:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;700&display=swap" media="print" onload="this.media='all'" />
<noscript><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Archivo:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;700&display=swap" /></noscript>
<link rel="icon" href="/favicon.ico" sizes="any" />
<link rel="icon" type="image/svg+xml" href="/favicon.svg" />
<link rel="apple-touch-icon" href="/apple-touch-icon.png" />
<link rel="stylesheet" href="/ratgeber/wissen.css" />`;

// Der Rechenkern: woertlich gleich auf beiden Seiten (PAL_CALC). palRechnen ist die eine
// Regel, die gegen packCargo geprueft ist.
function rechenkern(packer, R) {
  return `    // PAL_CALC_START
    // PACKER_START -- von werkzeug/palettenrechner.mjs aus app.html uebernommen, nicht von Hand aendern
${packer}
    var RAEUME = ${JSON.stringify(R)};
    // PACKER_END
    // Bodenlage x Lagen, begrenzt durch die Zuladung. Lagen nur, wenn gestapelt werden darf UND die Hoehe
    // bekannt ist -- ohne Hoehe ist "wie oft uebereinander" unbekannt, also eine Lage.
    function palRechnen(l, w, h, stapel, kg, R) {
      var L = Number(l), W = Number(w), H = Number(h), G = Number(kg);
      if (!(L > 0) || !(W > 0)) return null;
      var boden = makeFloorPacker(L, W, true)(R.l, R.w).count, hoch = H > 0;
      if (hoch && H > R.h) return { boden: boden, lagen: 0, n: 0, zuHoch: true, kgGrenze: false, hoch: true };
      var lagen = hoch && stapel ? Math.max(1, Math.floor(R.h / H)) : 1, geo = boden * lagen, n = geo, kgGrenze = false;
      if (G > 0) { var nachKg = Math.floor(R.kg / G); if (nachKg < geo) { n = nachKg; kgGrenze = true; } }
      return { boden: boden, lagen: lagen, n: n, zuHoch: false, kgGrenze: kgGrenze, hoch: hoch };
    }
    // PAL_CALC_END`;
}

const UI = `    // PAL_UI_START
    var art = document.getElementById('palArt'), fl = document.getElementById('palL'), fw = document.getElementById('palW'),
        fh = document.getElementById('palH'), fkg = document.getElementById('palKg'), fst = document.getElementById('palStapel'),
        body = document.getElementById('palRows'), hinweis = document.getElementById('palHinweis'), lauf = 0, warte = null;
    function zelle(r, e) {
      var t = palCfg.t(), loc = palCfg.loc(), f0 = function (n) { return n.toLocaleString(loc); };
      var tr = document.createElement('tr');
      var link = '';
      if (e && e.hoch && e.n > 0) {
        var q = e.n + 'x ' + Number(fl.value) + 'x' + Number(fw.value) + 'x' + Number(fh.value) + (Number(fkg.value) > 0 ? ' ' + Number(fkg.value) + 'kg' : '') + (fst.checked ? '' : palCfg.flach);
        link = '<a href="' + palCfg.qhref(q, r).replace(/&/g, '&amp;') + '" title="' + t.d3Titel + '">' + t.d3 + '</a>';
      }
      tr.innerHTML = '<td>' + palCfg.raum[r.k] + '</td>' +
        '<td class="num">' + (e ? f0(e.boden) : '–') + '</td>' +
        '<td class="num">' + (!e ? '–' : e.zuHoch ? '<span class="pal-warn">' + t.zuHoch + '</span>' : e.hoch ? e.lagen : '–') + '</td>' +
        '<td class="num"><b>' + (e ? f0(e.n) : '–') + '</b>' + (e && e.kgGrenze ? ' <span class="pal-warn">' + t.zul + '</span>' : '') + '</td>' +
        '<td class="num pal-3d">' + link + '</td>';
      return tr;
    }
    function zeichnen() {
      var t = palCfg.t(), meinLauf = ++lauf;
      var L = Number(fl.value), W = Number(fw.value);
      if (!(L >= 40) || !(W >= 40)) {
        body.innerHTML = '';
        RAEUME.forEach(function (r) { body.appendChild(zelle(r, null)); });
        hinweis.textContent = t.klein;
        return;
      }
      hinweis.textContent = t.rechnet;
      var zeilen = [], kgDa = false, i = 0;
      // Zeile fuer Zeile, mit Luft dazwischen: ungewoehnliche Masse (43 x 40 cm) brauchen
      // im grossen Laderaum bis zu einer halben Sekunde. Die Seite bleibt dabei bedienbar,
      // und eine neue Eingabe bricht den alten Lauf ab.
      (function weiter() {
        if (meinLauf !== lauf) return;
        var r = RAEUME[i], e = palRechnen(L, W, fh.value, fst.checked, fkg.value, r);
        if (e && e.kgGrenze) kgDa = true;
        zeilen.push(zelle(r, e));
        if (++i < RAEUME.length) { setTimeout(weiter, 0); return; }
        body.innerHTML = '';
        zeilen.forEach(function (z) { body.appendChild(z); });
        var h = [];
        if (!(Number(fh.value) > 0)) h.push(fst.checked ? t.stapelOhneH : t.ohneH);
        if (kgDa) h.push(t.kgHinweis);
        hinweis.textContent = h.join(' ');
      })();
    }
    function spaeter() { clearTimeout(warte); warte = setTimeout(zeichnen, 250); }
    art.addEventListener('change', function () {
      var m = /^(\\d+)x(\\d+)$/.exec(art.value);
      if (m) { fl.value = m[1]; fw.value = m[2]; }
      zeichnen();
    });
    [fl, fw].forEach(function (el) {
      el.addEventListener('input', function () {
        var k = Number(fl.value) + 'x' + Number(fw.value), da = false;
        [].forEach.call(art.options, function (o) { if (o.value === k) da = true; });
        art.value = da ? k : 'eigen';
        spaeter();
      });
    });
    [fh, fkg].forEach(function (el) { el.addEventListener('input', spaeter); });
    fst.addEventListener('change', zeichnen);
    zeichnen();
    // PAL_UI_END`;

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export function palettenSeiten(app) {
  const packer = packerQuelle(app), R = raeume(app);
  const fp = new Function(packer + '\nreturn makeFloorPacker;')();
  const raum = (k) => R.find((r) => r.k === k);
  const boden = (l, w, k) => fp(l, w, true)(raum(k).l, raum(k).w).count;
  // Die Zahlen, die im Text stehen -- alle vom Packer
  const Z = {
    eur20: boden(120, 80, '20gp'), eur40: boden(120, 80, '40gp'), eurSattel: boden(120, 80, 'sattel'),
    us20: boden(122, 102, '20gp'), us40: boden(122, 102, '40gp'), indSattel: boden(120, 100, 'sattel'), usSattel: boden(122, 102, 'sattel'),
    eur75: boden(120, 80, '75t'), eurSpr: boden(120, 80, 'sprinter'),
    hGp: raum('20gp').h, hHc: raum('40hc').h, hSattel: raum('sattel').h, h75: raum('75t').h, hSpr: raum('sprinter').h,
    kg75: raum('75t').kg, kgSpr: raum('sprinter').kg
  };
  Z.max2Gp = Math.floor(Z.hGp / 2); Z.max2Hc = Math.floor(Z.hHc / 2);
  Z.n75bei250 = Math.min(Z.eur75, Math.floor(Z.kg75 / 250)); Z.nSprBei250 = Math.min(Z.eurSpr, Math.floor(Z.kgSpr / 250));
  const out = {};
  for (const sp of ['de', 'en']) {
    const T = TXT[sp], d = T.dez;
    const n = (x) => x.toLocaleString(T.loc);
    const zoll = (cm) => (cm / 2.54).toFixed(1).replace('.', d);
    // Tabelle 1: Bodenlage je Laderaum und Palette (40' GP und HC haben denselben Boden)
    const t1z = [['20gp'], ['40gp', '40hc'], ['45hc'], ['sattel'], ['wb'], ['mw'], ['75t'], ['sprinter']].map((ks) => {
      const name = ks.map((k) => T.raum[k]).join(sp === 'de' ? ' / ' : ' / ').replace('40′ Standard / 40′ High Cube', '40′ Standard / High Cube').replace('40ft standard / 40ft high cube', '40ft standard / high cube');
      return `<tr><td>${name}</td>` + [[120, 80], [120, 100], [122, 102], [124, 83]].map(([l, w]) => `<td class="num">${boden(l, w, ks[0])}</td>`).join('') + '</tr>';
    }).join('\n    ');
    // Tabelle 2: Innenhoehe und hoechste Palette fuer zwei / drei Lagen
    const t2z = [[sp === 'de' ? '20′ / 40′ Standard' : '20ft / 40ft standard', '20gp'], [sp === 'de' ? '40′ / 45′ High Cube' : '40ft / 45ft high cube', '40hc'], [T.raum.sattel, 'sattel'], [T.raum['75t'], '75t'], [T.raum.sprinter, 'sprinter']]
      .map(([name, k]) => { const h = raum(k).h; return `<tr><td>${name}</td><td class="num">${h} cm</td><td class="num">${Math.floor(h / 2)} cm</td><td class="num">${Math.floor(h / 3)} cm</td></tr>`; }).join('\n    ');
    // Statische Erstbelegung der Widget-Tabelle (Europalette, ohne Hoehe) -- was der Browser
    // ohne JavaScript und die Suchmaschine sehen. Das Skript zeichnet dieselben Zeilen neu.
    const t0 = R.map((r) => `<tr><td>${T.raum[r.k]}</td><td class="num">${n(boden(120, 80, r.k))}</td><td class="num">–</td><td class="num"><b>${n(boden(120, 80, r.k))}</b></td><td class="num pal-3d"></td></tr>`).join('');
    const opts = PALETTEN.map((p) => `<option value="${p.k}"${p.k === '120x80' ? ' selected' : ''}>${T.pal[p.k]}</option>`).join('') + `<option value="eigen">${T.pal.eigen}</option>`;
    const DE = sp === 'de';
    const antwort = DE
      ? `In einen <b>20-Fuß-Container</b> passen <b>${Z.eur20} Europaletten</b>, in einen <b>40-Fuß</b> <b>${Z.eur40}</b>, auf einen <b>Planensattel ${Z.eurSattel}</b> – jeweils in einer Lage. Gestapelt verdoppelt sich die Zahl, wenn Höhe und Zuladung es erlauben. Der Rechner unten rechnet jede Palette für alle Container und Fahrzeuge auf einmal.`
      : `A <b>20ft container</b> fits <b>${Z.eur20} euro pallets</b> or <b>${Z.us20} standard pallets</b> (48 × 40 in), a <b>40ft</b> <b>${Z.eur40}</b> or <b>${Z.us40}</b> – single-tier. Stacked two high the figures double, if height and payload allow. The calculator below works out any pallet for every container and truck at once.`;
    const faq = DE ? [
      ['Wie viele Europaletten passen in einen 20-Fuß-Container?', `${Z.eur20} in einer Lage. Gestapelt ${Z.eur20 * 2}, wenn jede Palette höchstens ${Z.max2Gp} cm hoch ist und das Gewicht passt.`],
      ['Wie viele Europaletten passen in einen 40-Fuß-Container?', `${Z.eur40} in einer Lage. Im 40-Fuß High Cube gestapelt ${Z.eur40 * 2}, bei Paletten bis ${Z.max2Hc} cm Höhe.`],
      ['Wie viele Paletten passen auf einen LKW?', `Auf einen Planensattel ${Z.eurSattel} Europaletten oder ${Z.indSattel} Industriepaletten in einer Lage, auf einen 7,5-Tonner ${Z.eur75} und in einen Transporter ${Z.eurSpr} Europaletten.`],
      ['Wie hoch darf eine Palette für zwei Lagen sein?', `Im Standardcontainer höchstens ${Z.max2Gp} cm, im High Cube und im Planensattel ${Z.max2Hc} cm – gerechnet auf die Innenhöhe von ${Z.hGp} bzw. ${Z.hHc} cm.`]
    ] : [
      ['How many pallets fit in a 20ft container?', `${Z.eur20} euro pallets or ${Z.us20} standard pallets (48 × 40 in) single-tier. Stacked, twice that, if each pallet is at most ${Z.max2Gp} cm (${zoll(Z.max2Gp)} in) high and the weight allows.`],
      ['How many pallets fit in a 40ft container?', `${Z.eur40} euro pallets or ${Z.us40} standard pallets single-tier. In a 40ft high cube, stacked twice that, with pallets up to ${Z.max2Hc} cm (${zoll(Z.max2Hc)} in) high.`],
      ['How many pallets fit on a truck?', `A curtainsider takes ${Z.eurSattel} euro pallets or ${Z.usSattel} standard pallets single-tier, a 7.5-t truck ${Z.eur75} and a van ${Z.eurSpr} euro pallets.`],
      ['How high can a pallet be to stack two high?', `In a standard container at most ${Z.max2Gp} cm (${zoll(Z.max2Gp)} in), in a high cube and on a curtainsider ${Z.max2Hc} cm (${zoll(Z.max2Hc)} in) – based on internal heights of ${Z.hGp} and ${Z.hHc} cm.`]
    ];
    const ld = { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: faq.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })) };
    const inhalt = DE ? `    <h2>Paletten je Container und LKW auf einen Blick</h2>
    <p>Eine Lage, beide Ausrichtungen gemischt – so, wie der Packer die Paletten wirklich stellt:</p>
    <div class="tabelle"><table><thead><tr><th>Laderaum</th><th>Euro 120 × 80</th><th>Industrie 120 × 100</th><th>US 122 × 102</th><th>Gitterbox 124 × 83</th></tr></thead><tbody>
    ${t1z}
    </tbody></table></div>
    <p>Warum nicht einfach die Bodenfläche durch die Palettenfläche teilen? Weil die Breite entscheidet: Der Container ist innen 235 cm breit. Zwei Europaletten längs (160 cm) lassen 75 cm frei – zu wenig für eine dritte. Erst die Mischung aus längs und quer füllt den Boden; die Herleitung steht bei den <a href="/ratgeber/stellplaetze-container">Stellplätzen im Container</a>.</p>

    <h2>Gestapelt: Wie hoch darf eine Palette sein?</h2>
    <p>Ob zwei Lagen passen, entscheidet die Innenhöhe. Die Tabelle zeigt, wie hoch jede beladene Palette höchstens sein darf:</p>
    <div class="tabelle"><table><thead><tr><th>Laderaum</th><th>Innenhöhe</th><th>2 Lagen bis</th><th>3 Lagen bis</th></tr></thead><tbody>
    ${t2z}
    </tbody></table></div>
    <p>Der Unterschied ist groß: Paletten mit 125 cm Höhe stehen im Standardcontainer nur einlagig, im <b>High Cube</b> zweilagig – doppelt so viele im selben 40-Fuß-Stellplatz. Wird gestapelt verladen, muss der Stapel außerdem durch die Tür: Die ist niedriger als der Innenraum (siehe <a href="/ratgeber/container-masse-innenmasse">Container-Maße</a>). Und stapelbar ist nur, was die Last oben auch trägt.</p>

    <h2>Gewicht: Wann die Zuladung zuerst voll ist</h2>
    <p>Bei kleinen Fahrzeugen ist oft das Gewicht die Grenze, nicht der Platz. Ein <b>7,5-Tonner</b> nimmt ${Z.eur75} Europaletten auf den Boden, trägt aber rund ${n(Z.kg75)} kg – bei 250 kg je Palette sind das <b>${Z.n75bei250}</b>. Ein <b>Transporter</b> mit rund ${n(Z.kgSpr)} kg Zuladung nimmt bei 250 kg je Palette <b>${Z.nSprBei250} statt ${Z.eurSpr}</b>. Tragen Sie das Gewicht oben ein, dann zeigt der Rechner, wo die Zuladung zuerst voll ist. Beim Container zählt zusätzlich, was auf der Straße erlaubt ist: <a href="/ratgeber/container-gewicht-strasse">Gewichtsgrenzen je Land</a>.</p>

    <h2>Häufige Fragen</h2>
${faq.map(([q, a]) => `    <p><b>${q}</b><br>${a}</p>`).join('\n')}` : `    <h2>Pallets per container and truck at a glance</h2>
    <p>Single-tier, both orientations mixed – the way the packer actually places the pallets:</p>
    <div class="tabelle"><table><thead><tr><th>Load space</th><th>Euro 120 × 80</th><th>Industrial 120 × 100</th><th>US 48 × 40″</th><th>Wire mesh 124 × 83</th></tr></thead><tbody>
    ${t1z}
    </tbody></table></div>
    <p>Why not just divide the floor area by the pallet area? Because the width decides: a container is 235 cm (92.5 in) wide inside. Two euro pallets lengthwise (160 cm) leave 75 cm – too little for a third. Only a mix of lengthwise and crosswise fills the floor; the reasoning is on the page about <a href="/en/guide/container-floor-positions">floor positions in a container</a>.</p>

    <h2>Stacked: how high can a pallet be?</h2>
    <p>Whether two tiers fit depends on the internal height. The table shows the maximum height of each loaded pallet:</p>
    <div class="tabelle"><table><thead><tr><th>Load space</th><th>Internal height</th><th>2 tiers up to</th><th>3 tiers up to</th></tr></thead><tbody>
    ${t2z}
    </tbody></table></div>
    <p>The difference is large: pallets 125 cm (49 in) high stand single-tier in a standard container but two high in a <b>high cube</b> – twice as many in the same 40ft slot. If pallets go in already stacked, the stack must also pass the door, which is lower than the interior (see <a href="/en/guide/container-internal-dimensions">container dimensions</a>). And only what can carry the load on top is stackable.</p>

    <h2>Weight: when the payload runs out first</h2>
    <p>With small vehicles the limit is often the weight, not the space. A <b>7.5-t truck</b> takes ${Z.eur75} euro pallets on the floor but carries around ${n(Z.kg75)} kg – at 250 kg per pallet that is <b>${Z.n75bei250}</b>. A <b>van</b> with around ${n(Z.kgSpr)} kg payload takes <b>${Z.nSprBei250} instead of ${Z.eurSpr}</b> at 250 kg each. Enter the weight above and the calculator shows where the payload runs out first. For containers, what is allowed on the road also counts: <a href="/en/guide/container-road-weight-limits">weight limits by country</a>.</p>

    <h2>Frequent questions</h2>
${faq.map(([q, a]) => `    <p><b>${q}</b><br>${a}</p>`).join('\n')}`;
    const langLinks = `<a${DE ? ' class="on"' : ''} href="${DE_PFAD}" hreflang="de" title="Deutsch">DE</a><a${DE ? '' : ' class="on"'} href="${EN_PFAD}" hreflang="en" title="English">EN</a>`;
    const related = DE
      ? '<a href="/ratgeber/stellplaetze-container">Stellplätze je Container</a><a href="/ratgeber/europaletten-20-fuss-container">Europaletten 20′</a><a href="/ratgeber/europaletten-40-fuss-container">Europaletten 40′</a><a href="/ratgeber/industriepaletten-container">Industriepaletten</a><a href="/ratgeber/us-paletten-40-fuss-container">US-Paletten 40′</a><a href="/ratgeber/lademeter-rechner">Lademeter-Rechner</a><a href="/ratgeber/lkw-beladen">LKW richtig beladen</a><a href="/ratgeber/container-masse-innenmasse">Container-Maße</a>'
      : '<a href="/en/guide/container-floor-positions">Floor positions per container</a><a href="/en/guide/euro-pallets-20ft-container">Euro pallets 20ft</a><a href="/en/guide/euro-pallets-40ft-container">Euro pallets 40ft</a><a href="/en/guide/pallets-20ft-container">Pallets in a 20ft</a><a href="/en/guide/pallets-40ft-container">Pallets in a 40ft</a><a href="/en/guide/industrial-pallets-container">Industrial pallets</a><a href="/en/guide/loading-metre-calculator">Loading metre calculator</a><a href="/en/guide/how-to-load-a-truck">How to load a truck</a><a href="/en/guide/container-internal-dimensions">Container dimensions</a>';
    const url = BASIS + T.pfad;
    out[sp] = `<!DOCTYPE html>
<!-- Erzeugt von werkzeug/palettenrechner.mjs aus app.html -- nicht von Hand aendern. -->
<html lang="${T.lang}">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${T.titel}</title>
<meta name="description" content="${T.desc}" />
<link rel="canonical" href="${url}" />
<link rel="alternate" hreflang="de" href="${BASIS + DE_PFAD}" />
<link rel="alternate" hreflang="en" href="${BASIS + EN_PFAD}" />
<link rel="alternate" hreflang="x-default" href="${BASIS + DE_PFAD}" />
<meta name="robots" content="index,follow" />
<meta property="og:type" content="article" />
<meta property="og:locale" content="${T.locale}" />
<meta property="og:title" content="${T.titel}" />
<meta property="og:description" content="${T.desc}" />
<meta property="og:url" content="${url}" />
<meta property="og:site_name" content="ContainerLoad" />
<meta property="og:image" content="https://containerload.io/og.png" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="${T.titel}" />
<meta name="twitter:description" content="${T.desc}" />
<meta name="twitter:image" content="https://containerload.io/og.png" />
<meta name="theme-color" content="#0E1116" />
${KOPF}
<script type="application/ld+json">${JSON.stringify(ld)}</script>
</head>
<body>
<header class="nav">
  <div class="nav-in">
    <a class="brand" href="${T.home}">${LOGO}</a>
    <div class="lang" role="group" aria-label="${T.langLabel}">${langLinks}</div><a class="btn btn-primary" href="${T.app}">${T.kopfBtn}</a>
  </div>
</header>
<main>
  <article class="wrap">
    <div class="eyebrow">${T.eyebrow}</div>
    <h1>${T.h1}</h1>
    <div class="answer"><p class="lead" style="margin:0">${antwort}</p></div>

    <div class="cbm-calc" data-pal-widget>
      <div class="pal-eingabe">
        <div class="field pal-art"><label for="palArt">${T.f.art}</label><select id="palArt">${opts}</select></div>
        <div class="field"><label for="palL">${T.f.l}</label><input type="number" id="palL" inputmode="numeric" min="1" step="1" value="120" /></div>
        <div class="field"><label for="palW">${T.f.w}</label><input type="number" id="palW" inputmode="numeric" min="1" step="1" value="80" /></div>
        <div class="field"><label for="palH">${T.f.h}</label><input type="number" id="palH" inputmode="numeric" min="1" step="1" placeholder="${T.f.hPh}" /></div>
        <div class="field"><label for="palKg">${T.f.kg}</label><input type="number" id="palKg" inputmode="decimal" min="0" step="any" placeholder="${T.f.kgPh}" /></div>
        <label class="pal-stapel"><input type="checkbox" id="palStapel" /> ${T.f.stapel}</label>
      </div>
      <div class="pal-tabelle"><div class="tabelle"><table><thead><tr>${T.th.map((h, i) => `<th${i > 0 && i < 4 ? ' class="num"' : ''}>${h}</th>`).join('')}</tr></thead><tbody id="palRows">${t0}</tbody></table></div></div>
      <div class="cbm-calc-result" id="palHinweis"></div>
    </div>
    <p style="font-size:13px;color:var(--faint);margin-top:6px">${T.unterWidget}</p>
    <script>
    (function(){
${rechenkern(packer, R)}
    var palCfg = {
      t: function () { return ${T.cfgT}; },
      loc: function () { return '${T.loc}'; },
      raum: ${JSON.stringify(T.raum)},
      flach: '${T.flach}',
      qhref: ${T.qhref}
    };
${UI}
    })();
    </script>

${inhalt}

    <div class="cta">
      <a class="btn btn-primary" href="${T.app}">${DE ? '➜ Eigene Ladung im 3D-Rechner planen' : '➜ Plan your own load in the 3D calculator'}</a>
      <a class="btn btn-ghost" href="${DE ? '/ratgeber/stellplaetze-container' : '/en/guide/container-floor-positions'}">${DE ? 'Stellplätze je Palettenart' : 'Floor positions by pallet type'}</a>
    </div>

    <h2>${DE ? 'Verwandte Fragen' : 'Related questions'}</h2>
    <div class="related">${related}</div>

    <div class="note">${DE
      ? '<b style="color:var(--dim)">Ohne Gewähr:</b> Die Zahlen gelten für typische Innenmaße und Zuladungen; reale Container und Fahrzeuge weichen ab. Maßgeblich sind das konkrete Equipment, Gewichtsverteilung, Ladungssicherung und die Tragfähigkeit der Paletten.'
      : '<b style="color:var(--dim)">No warranty:</b> The figures apply to typical internal dimensions and payloads; real containers and vehicles differ. What counts is the actual equipment, weight distribution, load securing and what the pallets can carry.'}</div>
  </article>
</main>
<footer>
  <div class="wrap">
    <span>${DE ? '© ContainerLoad · Bremen' : '© ContainerLoad · Bremen, Germany'}</span>
    <span>${DE
      ? '<a href="/">Rechner</a> · <a href="/ratgeber/">Container-Wissen</a> · <a href="/impressum">Impressum</a> · <a href="/datenschutz">Datenschutz</a>'
      : '<a href="/en/">Calculator</a> · <a href="/en/guide/">Container Guide</a> · <a href="/en/imprint">Imprint</a> · <a href="/en/privacy">Privacy</a>'}</span>
  </div>
</footer>
<script src="/puls.js" defer></script>
</body>
</html>
`;
  }
  out.zahlen = Z;
  return out;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const app = fs.readFileSync(new URL('../containerload.io/app.html', import.meta.url), 'utf8');
  const s = palettenSeiten(app);
  fs.writeFileSync(new URL('../containerload.io/ratgeber/palettenrechner.html', import.meta.url), s.de);
  fs.writeFileSync(new URL('../containerload.io/en/guide/pallet-calculator.html', import.meta.url), s.en);
  console.log('palettenrechner.html', s.de.length, '· pallet-calculator.html', s.en.length, 'Zeichen');
}
