// Erzeugt containerload.io/en/index.html -- die englische Startseite -- aus
// containerload.io/index.html. Bis November 2026 war die englische Startseite dasselbe
// HTML unter /?lang=en, per Skript uebersetzt; die Websuche zeigte sie mit dem DEUTSCHEN
// Titel, und englische Werkzeug-Anfragen ("container loading calculator") standen auf
// Platz 80+. Jetzt ist sie eine eigene Datei mit englischem Text, Kopf, Schema und Links.
//
// Quelle von allem ist index.html selbst: das EN-Woerterbuch (var EN={...}, je data-i18n-
// Schluessel der englische Inhalt, dazu meta_*/ld_* fuer Kopf und Schema) und die GUIDE-
// Tabelle (deutscher Ratgeber-Pfad -> englischer Guide-Pfad). Wer index.html aendert,
// laesst danach diesen Generator laufen; test/startseite-en.test.mjs vergleicht die Datei
// Zeichen fuer Zeichen mit dem, was startseiteEn() aus index.html macht.
//
// Abhaengigkeitsfrei (reine Zeichenketten-Arbeit), damit der Test ihn direkt laden kann.
// Aufruf: node werkzeug/startseite-en.mjs
import fs from 'node:fs';

const BASIS = 'https://containerload.io';

// Inhalt eines Elements ersetzen: vom Ende des oeffnenden Tags bis zum PASSENDEN
// schliessenden Tag (gleichnamige Tags dazwischen werden mitgezaehlt).
function innenErsetzen(html, start, tag, neu) {
  const auf = html.indexOf('>', start) + 1;
  const re = new RegExp('<(/?)' + tag + '(?=[\\s>/])', 'gi');
  re.lastIndex = auf;
  let tiefe = 1, m;
  while ((m = re.exec(html))) {
    tiefe += m[1] ? -1 : 1;
    if (tiefe === 0) return html.slice(0, auf) + neu + html.slice(m.index);
  }
  throw new Error('kein schliessendes </' + tag + '> ab ' + start);
}

const ersetzeGenau = (s, alt, neu) => {
  const n = s.split(alt).length - 1;
  if (n !== 1) throw new Error(n + '× gefunden: ' + alt.slice(0, 80));
  return s.replace(alt, () => neu);
};
const attr = (v) => v.replace(/&/g, '&amp;').replace(/"/g, '&quot;');

export function woerterbuch(de) {
  const m = de.match(/var EN=(\{.*?\});\n/s);
  if (!m) throw new Error('EN-Woerterbuch nicht gefunden');
  return JSON.parse(m[1]);
}

export function guideTabelle(de) {
  const a = de.indexOf('var GUIDE={'), e = de.indexOf('};', a);
  const t = {};
  for (const [, von, nach] of de.slice(a, e).matchAll(/'([^']+)':'([^']+)'/g)) t[von] = nach;
  return t;
}

export function startseiteEn(de) {
  const EN = woerterbuch(de), GUIDE = guideTabelle(de);
  let s = de;

  // 1) Jeder data-i18n-Block bekommt seinen englischen Inhalt
  const re = /<([a-z][a-z0-9]*)\b[^>]*\bdata-i18n="([^"]+)"[^>]*>/gi;
  const stellen = [];
  let m;
  while ((m = re.exec(s))) stellen.push({ start: m.index, tag: m[1], key: m[2] });
  for (const st of stellen.reverse()) {
    if (EN[st.key] === undefined) throw new Error('kein englischer Text fuer ' + st.key);
    s = innenErsetzen(s, st.start, st.tag, EN[st.key]);
  }

  // 2) Sprache, Kopf, Kanonische Adresse
  s = ersetzeGenau(s, '<html lang="de"', '<html lang="en"');
  s = s.replace(/<title>[^<]*<\/title>/, () => '<title>' + EN.meta_t + '</title>');
  const meta = (sel, wert) => {
    const r = new RegExp('(<meta ' + sel + ' content=")[^"]*(")');
    if (!r.test(s)) throw new Error('Kopfzeile fehlt: ' + sel);
    s = s.replace(r, (_, a, b) => a + attr(wert) + b);
  };
  meta('name="description"', EN.meta_d);
  meta('property="og:title"', EN.meta_ot);
  meta('property="og:description"', EN.meta_od);
  meta('property="og:image:alt"', EN.meta_ot);
  meta('name="twitter:title"', EN.meta_ot);
  meta('name="twitter:description"', EN.meta_od);
  meta('property="og:url"', BASIS + '/en/');
  s = ersetzeGenau(s, '<link rel="canonical" href="' + BASIS + '/" />', '<link rel="canonical" href="' + BASIS + '/en/" />');

  // 3) Strukturierte Daten auf Englisch (dieselben Fakten, andere Sprache)
  s = s.replace(/<script type="application\/ld\+json">(.*?)<\/script>/s, (_, j) => {
    const o = JSON.parse(j);
    o.url = BASIS + '/en/';
    o.alternateName = EN.ld_name;
    o.applicationSubCategory = EN.ld_sub;
    o.browserRequirements = EN.ld_browser;
    o.description = EN.ld_d;
    o.featureList = EN.ld_features.split('|');
    return '<script type="application/ld+json">' + JSON.stringify(o) + '</script>';
  });

  // 4) Links im Seitenkoerper: Rechner auf Englisch, Wissen auf den Guide, Start auf /en/.
  //    Sprachknoepfe (data-lang) bleiben, wie sie sind -- DE muss auf / zeigen.
  const kopfEnde = s.indexOf('<body');
  const kopf = s.slice(0, kopfEnde);
  let koerper = s.slice(kopfEnde);
  koerper = koerper.replace(/<a\b[^>]*>/g, (tag) => {
    if (/\bdata-lang=/.test(tag)) return tag;
    return tag.replace(/\bhref="([^"]*)"/, (ganz, h) => {
      let n = h;
      if (h === '/' || h === '/?lang=en') n = '/en/';
      else if (/^\/app(\?|$)/.test(h)) n = /[?&]lang=/.test(h) ? h : h + (h.includes('?') ? '&' : '?') + 'lang=en';
      else if (GUIDE[h]) n = GUIDE[h];
      return 'href="' + n + '"';
    });
  });
  s = kopf + koerper;

  // 5) Aktive Sprache: der EN-Knopf ist "on", der DE-Knopf nicht
  s = s.replace(/class="langbtn on">DE<\/a>/g, 'class="langbtn">DE</a>');
  s = s.replace(/(href="\/en\/" hreflang="en" title="English" class="langbtn)">EN<\/a>/g, '$1 on">EN</a>');

  // 6) Herkunft vermerken
  s = ersetzeGenau(s, '<!DOCTYPE html>\n', '<!DOCTYPE html>\n<!-- Erzeugt von werkzeug/startseite-en.mjs aus index.html -- nicht von Hand aendern. -->\n');
  return s;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const quelle = new URL('../containerload.io/index.html', import.meta.url);
  const ziel = new URL('../containerload.io/en/index.html', import.meta.url);
  const en = startseiteEn(fs.readFileSync(quelle, 'utf8'));
  fs.mkdirSync(new URL('.', ziel), { recursive: true });
  fs.writeFileSync(ziel, en);
  console.log('en/index.html', en.length, 'Zeichen');
}
